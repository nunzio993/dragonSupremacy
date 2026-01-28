// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

// Interface for creature XP (type-safe alternative to low-level call)
interface ICreatureXP {
    function addXP(uint256 tokenId, uint256 amount) external;
}

// ============ Custom Errors (Gas Optimization) ============
error InvalidStakeAmount();
error AlreadyInBattle();
error CreatureInBattle();
error NotCreatureOwner();
error StakeTransferFailed();
error BattleNotOpen();
error CannotJoinOwnBattle();
error BattleExpiredError();
error BattleNotInProgress();
error InvalidWinner();
error SignatureExpired();
error SignatureAlreadyUsed();
error InvalidSignature();
error BattleNotResolved();
error NotTheWinner();
error PrizeTransferFailed();
error FeeTransferFailed();
error CannotCancel();
error NotHost();
error RefundFailed();
error TimeoutNotReached();
error CannotRefund();
error InvalidLimits();
error CancelLockoutNotPassed();

/**
 * @title BattleGateV2
 * @notice Secure escrow-based battle entry system
 * @dev Implements atomic escrow, signature verification, and XP rewards
 */
contract BattleGateV2 is Ownable, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Constants ============
    
    uint256 public constant PLATFORM_FEE_BPS = 500; // 5% platform fee
    uint256 public constant CANCEL_FEE_BPS = 100;   // 1% cancel fee (anti-griefing)
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant HOST_TIMEOUT = 10 minutes;
    uint256 public constant CANCEL_LOCKOUT = 30 seconds; // Min time before cancel allowed
    uint256 public constant CLAIM_TIMEOUT = 7 days;
    uint256 public constant TIMELOCK_DURATION = 48 hours; // Timelock for critical changes
    
    // ============ Types ============
    
    enum BattleState {
        NONE,       // 0: Does not exist
        CREATED,    // 1: Host deposited, waiting for guest
        MATCHED,    // 2: Guest deposited, battle in progress
        RESOLVED,   // 3: Winner declared, can claim
        CLAIMED,    // 4: Prize distributed
        EXPIRED     // 5: Timeout, refunded
    }
    
    struct Battle {
        address host;
        address guest;
        uint256 hostCreatureId;
        uint256 guestCreatureId;
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 matchedAt;
        uint256 resolvedAt;
        BattleState state;
        address winner;
    }
    
    // ============ State ============
    
    IERC20 public stakeToken;           // DGNE token
    address public trustedBackend;       // Backend signer address
    address public treasury;             // Platform fee recipient
    address public creatureContract;     // RMRKCreature for XP updates
    
    uint256 public minStake = 10 ether;  // Minimum stake (10 DGNE)
    uint256 public maxStake = 1000 ether; // Maximum stake (1000 DGNE)
    
    uint256 public battleNonce;          // Auto-increment for battle IDs
    
    // Mappings
    mapping(bytes32 => Battle) public battles;
    mapping(address => bytes32) public walletInBattle;
    mapping(uint256 => bytes32) public creatureInBattle;
    mapping(bytes32 => bool) public usedSignatures;
    
    // Timelock state
    address public pendingBackend;
    uint256 public pendingBackendTime;
    
    // ============ Events ============
    
    event BattleCreated(
        bytes32 indexed battleId,
        address indexed host,
        uint256 creatureId,
        uint256 stakeAmount
    );
    
    event BattleMatched(
        bytes32 indexed battleId,
        address indexed guest,
        uint256 creatureId
    );
    
    event BattleResolved(
        bytes32 indexed battleId,
        address indexed winner,
        address indexed loser
    );
    
    event WinningsClaimed(
        bytes32 indexed battleId,
        address indexed winner,
        uint256 amount
    );
    
    event BattleCancelled(
        bytes32 indexed battleId,
        address indexed host
    );
    
    event BattleExpired(
        bytes32 indexed battleId,
        string reason
    );
    
    // ============ Constructor ============
    
    constructor(
        address _stakeToken,
        address _trustedBackend,
        address _treasury,
        address _creatureContract
    ) Ownable(msg.sender) {
        require(_stakeToken != address(0), "Invalid stake token");
        require(_trustedBackend != address(0), "Invalid backend");
        require(_treasury != address(0), "Invalid treasury");
        require(_creatureContract != address(0), "Invalid creature contract");
        stakeToken = IERC20(_stakeToken);
        trustedBackend = _trustedBackend;
        treasury = _treasury;
        creatureContract = _creatureContract;
    }
    
    // ============ Battle Entry - Host ============
    
    /**
     * @notice Create a new battle and deposit stake
     * @param creatureId The creature token ID to battle with
     * @param stakeAmount Amount of DGNE to stake
     * @return battleId Unique battle identifier
     */
    function createBattle(
        uint256 creatureId,
        uint256 stakeAmount
    ) external whenNotPaused nonReentrant returns (bytes32 battleId) {
        if (stakeAmount < minStake || stakeAmount > maxStake) revert InvalidStakeAmount();
        if (walletInBattle[msg.sender] != bytes32(0)) revert AlreadyInBattle();
        if (creatureInBattle[creatureId] != bytes32(0)) revert CreatureInBattle();
        
        // Verify creature ownership
        if (IERC721(creatureContract).ownerOf(creatureId) != msg.sender) revert NotCreatureOwner();
        
        // Generate unique battle ID
        ++battleNonce;
        battleId = keccak256(abi.encodePacked(msg.sender, block.timestamp, battleNonce));
        
        // Transfer stake to contract
        if (!stakeToken.transferFrom(msg.sender, address(this), stakeAmount)) revert StakeTransferFailed();
        
        // Create battle
        battles[battleId] = Battle({
            host: msg.sender,
            guest: address(0),
            hostCreatureId: creatureId,
            guestCreatureId: 0,
            stakeAmount: stakeAmount,
            createdAt: block.timestamp,
            matchedAt: 0,
            resolvedAt: 0,
            state: BattleState.CREATED,
            winner: address(0)
        });
        
        // Lock wallet and creature
        walletInBattle[msg.sender] = battleId;
        creatureInBattle[creatureId] = battleId;
        
        emit BattleCreated(battleId, msg.sender, creatureId, stakeAmount);
    }
    
    // ============ Battle Entry - Guest ============
    
    /**
     * @notice Join an existing battle and deposit stake
     * @param battleId The battle to join
     * @param creatureId The creature token ID to battle with
     */
    function joinBattle(
        bytes32 battleId,
        uint256 creatureId
    ) external whenNotPaused nonReentrant {
        Battle storage battle = battles[battleId];
        
        if (battle.state != BattleState.CREATED) revert BattleNotOpen();
        if (battle.host == msg.sender) revert CannotJoinOwnBattle();
        if (walletInBattle[msg.sender] != bytes32(0)) revert AlreadyInBattle();
        if (creatureInBattle[creatureId] != bytes32(0)) revert CreatureInBattle();
        if (block.timestamp >= battle.createdAt + HOST_TIMEOUT) revert BattleExpiredError();
        
        // Verify creature ownership
        if (IERC721(creatureContract).ownerOf(creatureId) != msg.sender) revert NotCreatureOwner();
        
        // Transfer stake to contract
        if (!stakeToken.transferFrom(msg.sender, address(this), battle.stakeAmount)) revert StakeTransferFailed();
        
        // Update battle
        battle.guest = msg.sender;
        battle.guestCreatureId = creatureId;
        battle.matchedAt = block.timestamp;
        battle.state = BattleState.MATCHED;
        
        // Lock wallet and creature
        walletInBattle[msg.sender] = battleId;
        creatureInBattle[creatureId] = battleId;
        
        emit BattleMatched(battleId, msg.sender, creatureId);
    }
    
    // ============ Battle Resolution ============
    
    /**
     * @notice Resolve a battle with backend signature
     * @param battleId The battle to resolve
     * @param winner The winner's address
     * @param timestamp Signature timestamp
     * @param signature Backend signature
     */
    function resolveBattle(
        bytes32 battleId,
        address winner,
        uint256 timestamp,
        bytes calldata signature
    ) external nonReentrant {
        Battle storage battle = battles[battleId];
        
        if (battle.state != BattleState.MATCHED) revert BattleNotInProgress();
        if (winner != battle.host && winner != battle.guest) revert InvalidWinner();
        if (timestamp <= block.timestamp - 5 minutes) revert SignatureExpired();
        if (usedSignatures[keccak256(signature)]) revert SignatureAlreadyUsed();
        
        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            battleId,
            winner,
            timestamp,
            block.chainid
        ));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        if (signer != trustedBackend) revert InvalidSignature();
        
        // Mark signature as used
        usedSignatures[keccak256(signature)] = true;
        
        // Update battle state
        battle.winner = winner;
        battle.state = BattleState.RESOLVED;
        battle.resolvedAt = block.timestamp;
        
        // Determine loser
        address loser = winner == battle.host ? battle.guest : battle.host;
        
        // Award XP (winner: 100, loser: 30)
        _addXP(winner == battle.host ? battle.hostCreatureId : battle.guestCreatureId, 100);
        _addXP(loser == battle.host ? battle.hostCreatureId : battle.guestCreatureId, 30);
        
        // Unlock LOSER immediately so they can play again
        // Winner stays locked until they claim (they need battleId to claim winnings)
        _unlockLoser(battle);
        
        emit BattleResolved(battleId, winner, loser);
    }
    
    // ============ Claim Winnings ============
    
    /**
     * @notice Claim winnings after battle resolution
     * @param battleId The battle ID
     */
    function claimWinnings(bytes32 battleId) external nonReentrant {
        Battle storage battle = battles[battleId];
        
        if (battle.state != BattleState.RESOLVED) revert BattleNotResolved();
        if (battle.winner != msg.sender) revert NotTheWinner();
        
        // Calculate payouts
        uint256 totalPot = battle.stakeAmount * 2;
        uint256 platformFee = (totalPot * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 winnerPrize = totalPot - platformFee;
        
        // Update state BEFORE transfers (CEI pattern)
        battle.state = BattleState.CLAIMED;
        
        // Unlock the winner (loser was already unlocked in resolveBattle)
        _unlockWinner(battle);
        
        // Transfer prize
        if (!stakeToken.transfer(msg.sender, winnerPrize)) revert PrizeTransferFailed();
        
        // Transfer platform fee
        if (platformFee > 0 && treasury != address(0)) {
            if (!stakeToken.transfer(treasury, platformFee)) revert FeeTransferFailed();
        }
        
        emit WinningsClaimed(battleId, msg.sender, winnerPrize);
    }
    
    // ============ Cancellation ============
    
    /**
     * @notice Cancel a battle (host only, before guest joins)
     * @param battleId The battle to cancel
     */
    function cancelBattle(bytes32 battleId) external nonReentrant {
        Battle storage battle = battles[battleId];
        
        if (battle.state != BattleState.CREATED) revert CannotCancel();
        if (battle.host != msg.sender) revert NotHost();
        if (block.timestamp < battle.createdAt + CANCEL_LOCKOUT) revert CancelLockoutNotPassed();
        
        // Update state BEFORE transfer
        battle.state = BattleState.EXPIRED;
        
        // Unlock
        walletInBattle[battle.host] = bytes32(0);
        creatureInBattle[battle.hostCreatureId] = bytes32(0);
        
        // Calculate cancel fee (1% anti-griefing)
        uint256 cancelFee = (battle.stakeAmount * CANCEL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 refundAmount = battle.stakeAmount - cancelFee;
        
        // Refund host minus fee
        if (!stakeToken.transfer(battle.host, refundAmount)) revert RefundFailed();
        
        // Send fee to treasury
        if (cancelFee > 0 && treasury != address(0)) {
            if (!stakeToken.transfer(treasury, cancelFee)) revert FeeTransferFailed();
        }
        
        emit BattleCancelled(battleId, msg.sender);
    }
    
    /**
     * @notice Claim timeout refund (host only, after timeout)
     * @param battleId The battle ID
     */
    function claimHostTimeout(bytes32 battleId) external nonReentrant {
        Battle storage battle = battles[battleId];
        
        if (battle.state != BattleState.CREATED) revert CannotRefund();
        if (battle.host != msg.sender) revert NotHost();
        if (block.timestamp <= battle.createdAt + HOST_TIMEOUT) revert TimeoutNotReached();
        
        // Update state
        battle.state = BattleState.EXPIRED;
        
        // Unlock
        walletInBattle[battle.host] = bytes32(0);
        creatureInBattle[battle.hostCreatureId] = bytes32(0);
        
        // Refund
        if (!stakeToken.transfer(battle.host, battle.stakeAmount)) revert RefundFailed();
        
        emit BattleExpired(battleId, "Host timeout - no guest");
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Emergency refund for stuck battles (admin only)
     * @param battleId The battle ID
     * @dev Uses pull pattern to prevent partial failure
     */
    function emergencyRefund(bytes32 battleId) external onlyOwner nonReentrant {
        Battle storage battle = battles[battleId];
        
        if (battle.state != BattleState.CREATED && battle.state != BattleState.MATCHED) revert CannotRefund();
        
        // Calculate total refund needed BEFORE any state changes
        uint256 hostRefund = battle.stakeAmount;
        uint256 guestRefund = battle.guest != address(0) ? battle.stakeAmount : 0;
        address hostAddr = battle.host;
        address guestAddr = battle.guest;
        uint256 hostCreature = battle.hostCreatureId;
        uint256 guestCreature = battle.guestCreatureId;
        
        // Update state FIRST (CEI pattern)
        battle.state = BattleState.EXPIRED;
        
        // Unlock all participants
        walletInBattle[hostAddr] = bytes32(0);
        creatureInBattle[hostCreature] = bytes32(0);
        if (guestAddr != address(0)) {
            walletInBattle[guestAddr] = bytes32(0);
            creatureInBattle[guestCreature] = bytes32(0);
        }
        
        // Transfer to host (if fails, revert entire tx)
        if (!stakeToken.transfer(hostAddr, hostRefund)) revert RefundFailed();
        
        // Transfer to guest if applicable
        if (guestRefund > 0) {
            if (!stakeToken.transfer(guestAddr, guestRefund)) revert RefundFailed();
        }
        
        emit BattleExpired(battleId, "Emergency refund by admin");
    }
    
    /**
     * @notice Propose a new backend address (starts timelock)
     * @param _backend New backend address
     */
    function proposeBackend(address _backend) external onlyOwner {
        require(_backend != address(0), "Invalid backend");
        pendingBackend = _backend;
        pendingBackendTime = block.timestamp;
        emit BackendProposed(_backend, block.timestamp + TIMELOCK_DURATION);
    }
    
    /**
     * @notice Execute backend change after timelock expires
     */
    function executeBackendChange() external onlyOwner {
        require(pendingBackend != address(0), "No pending backend");
        require(block.timestamp >= pendingBackendTime + TIMELOCK_DURATION, "Timelock not expired");
        
        address oldBackend = trustedBackend;
        trustedBackend = pendingBackend;
        pendingBackend = address(0);
        pendingBackendTime = 0;
        
        emit BackendChanged(oldBackend, trustedBackend);
    }
    
    /**
     * @notice Cancel pending backend change
     */
    function cancelBackendChange() external onlyOwner {
        pendingBackend = address(0);
        pendingBackendTime = 0;
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryChanged(oldTreasury, _treasury);
    }
    
    function setCreatureContract(address _creature) external onlyOwner {
        require(_creature != address(0), "Invalid creature");
        address oldCreature = creatureContract;
        creatureContract = _creature;
        emit CreatureContractChanged(oldCreature, _creature);
    }
    
    function setStakeLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min > 0 && _min < _max, "Invalid limits");
        minStake = _min;
        maxStake = _max;
        emit StakeLimitsChanged(_min, _max);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Timelock events
    event BackendProposed(address indexed newBackend, uint256 effectiveTime);
    event BackendChanged(address indexed oldBackend, address indexed newBackend);
    
    // Admin change events
    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);
    event CreatureContractChanged(address indexed oldContract, address indexed newContract);
    event StakeLimitsChanged(uint256 newMin, uint256 newMax);
    
    // ============ View Functions ============
    
    function getBattle(bytes32 battleId) external view returns (Battle memory) {
        return battles[battleId];
    }
    
    function isInBattle(address wallet) external view returns (bool) {
        return walletInBattle[wallet] != bytes32(0);
    }
    
    function getPlayerBattle(address wallet) external view returns (bytes32) {
        return walletInBattle[wallet];
    }
    
    // ============ Internal Functions ============
    
    function _unlockParticipants(Battle storage battle) internal {
        walletInBattle[battle.host] = bytes32(0);
        walletInBattle[battle.guest] = bytes32(0);
        creatureInBattle[battle.hostCreatureId] = bytes32(0);
        creatureInBattle[battle.guestCreatureId] = bytes32(0);
    }
    
    function _unlockLoser(Battle storage battle) internal {
        address loser = battle.winner == battle.host ? battle.guest : battle.host;
        uint256 loserCreatureId = battle.winner == battle.host ? battle.guestCreatureId : battle.hostCreatureId;
        
        walletInBattle[loser] = bytes32(0);
        creatureInBattle[loserCreatureId] = bytes32(0);
    }
    
    function _unlockWinner(Battle storage battle) internal {
        uint256 winnerCreatureId = battle.winner == battle.host ? battle.hostCreatureId : battle.guestCreatureId;
        
        walletInBattle[battle.winner] = bytes32(0);
        creatureInBattle[winnerCreatureId] = bytes32(0);
    }
    
    function _addXP(uint256 creatureId, uint256 amount) internal {
        // Use typed interface instead of low-level call for safety
        try ICreatureXP(creatureContract).addXP(creatureId, amount) {
            // XP added successfully
        } catch {
            // Don't revert if XP fails - battle is more important
            emit XPFailed(creatureId, amount);
        }
    }
    
    event XPFailed(uint256 indexed creatureId, uint256 amount);
}
