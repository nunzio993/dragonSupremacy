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

// Interface for AirdropVault
interface IAirdropVault {
    function spendLockedBalance(address user, uint256 amount) external returns (uint256);
    function restoreLockedBalance(address user, uint256 amount) external;
    function finalizeLockedSpend(uint256 amount) external;
    function getLockedBalance(address user) external view returns (uint256);
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
    IAirdropVault public airdropVault;   // AirdropVault for locked balance
    
    uint256 public minStake = 10 ether;  // Minimum stake (10 DGNE)
    uint256 public maxStake = 1000 ether; // Maximum stake (1000 DGNE)
    
    uint256 public battleNonce;          // Auto-increment for battle IDs
    
    // Mappings
    mapping(bytes32 => Battle) public battles;
    mapping(address => bytes32) public walletInBattle;
    mapping(uint256 => bytes32) public creatureInBattle;
    mapping(bytes32 => bool) public usedSignatures;
    
    // Track locked stake portions for refunds
    mapping(bytes32 => uint256) public hostLockedStake;
    mapping(bytes32 => uint256) public guestLockedStake;
    
    // Timelock state
    address public pendingBackend;
    uint256 public pendingBackendTime;
    
    // Win Boost configuration
    uint256 public winBoostBPS = 0;         // Bonus percentage (500 = 5%)
    address public winBoostWallet;          // Source of boost tokens
    
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
        uint256 baseAmount,
        uint256 boostAmount
    );
    
    event BattleCancelled(
        bytes32 indexed battleId,
        address indexed host
    );
    
    event BattleExpired(
        bytes32 indexed battleId,
        string reason
    );
    
    event WinBoostUpdated(uint256 newBoostBPS);
    event WinBoostWalletUpdated(address newWallet);
    
    // ============ Constructor ============
    
    constructor(
        address _stakeToken,
        address _trustedBackend,
        address _treasury,
        address _creatureContract
    ) Ownable(msg.sender) {
        if (_stakeToken == address(0)) revert InvalidStakeAmount(); // reusing existing error for address check
        if (_trustedBackend == address(0)) revert InvalidSignature(); // reusing existing error  
        if (_treasury == address(0)) revert FeeTransferFailed(); // reusing existing error
        if (_creatureContract == address(0)) revert NotCreatureOwner(); // reusing existing error
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
        
        // Transfer stake to contract - use locked balance first if available
        uint256 fromLocked = 0;
        if (address(airdropVault) != address(0)) {
            fromLocked = airdropVault.spendLockedBalance(msg.sender, stakeAmount);
        }
        uint256 remaining = stakeAmount - fromLocked;
        if (remaining > 0) {
            if (!stakeToken.transferFrom(msg.sender, address(this), remaining)) revert StakeTransferFailed();
        }
        
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
        
        // Track how much came from locked balance (for refunds)
        hostLockedStake[battleId] = fromLocked;
        
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
        
        // Transfer stake to contract - use locked balance first if available
        uint256 fromLocked = 0;
        if (address(airdropVault) != address(0)) {
            fromLocked = airdropVault.spendLockedBalance(msg.sender, battle.stakeAmount);
        }
        uint256 remaining = battle.stakeAmount - fromLocked;
        if (remaining > 0) {
            if (!stakeToken.transferFrom(msg.sender, address(this), remaining)) revert StakeTransferFailed();
        }
        
        // Update battle
        battle.guest = msg.sender;
        battle.guestCreatureId = creatureId;
        battle.matchedAt = block.timestamp;
        battle.state = BattleState.MATCHED;
        
        // Track how much came from locked balance (for refunds)
        guestLockedStake[battleId] = fromLocked;
        
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
        
        // Calculate boost
        uint256 boost = (winnerPrize * winBoostBPS) / BPS_DENOMINATOR;
        
        // Update state BEFORE transfers (CEI pattern)
        battle.state = BattleState.CLAIMED;
        
        // Unlock the winner (loser was already unlocked in resolveBattle)
        _unlockWinner(battle);
        
        // NOW finalize locked balance splits (WinBoost gets its 31% only after battle completion)
        if (address(airdropVault) != address(0)) {
            uint256 totalLocked = hostLockedStake[battleId] + guestLockedStake[battleId];
            if (totalLocked > 0) {
                airdropVault.finalizeLockedSpend(totalLocked);
            }
        }
        
        // Transfer base prize
        if (!stakeToken.transfer(msg.sender, winnerPrize)) revert PrizeTransferFailed();
        
        // Transfer boost from WinBoost wallet (if configured and has allowance)
        if (boost > 0 && winBoostWallet != address(0)) {
            // Try to transfer boost - if fails (no allowance), continue without boost
            try IERC20(stakeToken).transferFrom(winBoostWallet, msg.sender, boost) returns (bool success) {
                if (!success) boost = 0;
            } catch {
                boost = 0;
            }
        } else {
            boost = 0;
        }
        
        // Transfer platform fee
        if (platformFee > 0 && treasury != address(0)) {
            if (!stakeToken.transfer(treasury, platformFee)) revert FeeTransferFailed();
        }
        
        emit WinningsClaimed(battleId, msg.sender, winnerPrize, boost);
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
        
        // Get locked vs wallet portions
        uint256 lockedPortion = hostLockedStake[battleId];
        uint256 walletPortion = battle.stakeAmount - lockedPortion;
        
        // Restore FULL locked portion (100% refund - WinBoost was never sent)
        if (lockedPortion > 0 && address(airdropVault) != address(0)) {
            airdropVault.restoreLockedBalance(battle.host, lockedPortion);
        }
        
        // Handle wallet portion (apply cancel fee, transfer)
        if (walletPortion > 0) {
            // Calculate cancel fee (1% anti-griefing)
            uint256 cancelFee = (walletPortion * CANCEL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 walletRefund = walletPortion - cancelFee;
            
            // Refund wallet portion minus fee
            if (walletRefund > 0) {
                if (!stakeToken.transfer(battle.host, walletRefund)) revert RefundFailed();
            }
            
            // Send fee to treasury
            if (cancelFee > 0 && treasury != address(0)) {
                if (!stakeToken.transfer(treasury, cancelFee)) revert FeeTransferFailed();
            }
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
        
        // Get locked vs wallet portions
        uint256 lockedPortion = hostLockedStake[battleId];
        uint256 walletPortion = battle.stakeAmount - lockedPortion;
        
        // Restore FULL locked portion (100% refund)
        if (lockedPortion > 0 && address(airdropVault) != address(0)) {
            airdropVault.restoreLockedBalance(battle.host, lockedPortion);
        }
        
        // Refund wallet portion (full amount, no fee on timeout)
        if (walletPortion > 0) {
            if (!stakeToken.transfer(battle.host, walletPortion)) revert RefundFailed();
        }
        
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
        
        // Cache addresses before state changes
        address hostAddr = battle.host;
        address guestAddr = battle.guest;
        uint256 hostCreature = battle.hostCreatureId;
        uint256 guestCreature = battle.guestCreatureId;
        uint256 stakeAmount = battle.stakeAmount;
        
        // Get locked portions
        uint256 hostLocked = hostLockedStake[battleId];
        uint256 hostWallet = stakeAmount - hostLocked;
        uint256 guestLocked = guestLockedStake[battleId];
        uint256 guestWallet = stakeAmount - guestLocked;
        
        // Update state FIRST (CEI pattern)
        battle.state = BattleState.EXPIRED;
        
        // Unlock all participants
        walletInBattle[hostAddr] = bytes32(0);
        creatureInBattle[hostCreature] = bytes32(0);
        if (guestAddr != address(0)) {
            walletInBattle[guestAddr] = bytes32(0);
            creatureInBattle[guestCreature] = bytes32(0);
        }
        
        // Restore FULL host locked balance (100% refund)
        if (hostLocked > 0 && address(airdropVault) != address(0)) {
            airdropVault.restoreLockedBalance(hostAddr, hostLocked);
        }
        
        // Transfer host wallet portion
        if (hostWallet > 0) {
            if (!stakeToken.transfer(hostAddr, hostWallet)) revert RefundFailed();
        }
        
        // Handle guest if battle was matched
        if (guestAddr != address(0)) {
            // Restore FULL guest locked balance (100% refund)
            if (guestLocked > 0 && address(airdropVault) != address(0)) {
                airdropVault.restoreLockedBalance(guestAddr, guestLocked);
            }
            
            // Transfer guest wallet portion
            if (guestWallet > 0) {
                if (!stakeToken.transfer(guestAddr, guestWallet)) revert RefundFailed();
            }
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
    
    /// @notice Update the treasury address for platform fees
    /// @param _treasury New treasury address (cannot be zero)
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryChanged(oldTreasury, _treasury);
    }
    
    /// @notice Update the creature contract address for XP updates
    /// @param _creature New RMRKCreature contract address
    function setCreatureContract(address _creature) external onlyOwner {
        require(_creature != address(0), "Invalid creature");
        address oldCreature = creatureContract;
        creatureContract = _creature;
        emit CreatureContractChanged(oldCreature, _creature);
    }
    
    /// @notice Update stake limits for battle entry
    /// @param _min Minimum stake in wei (must be > 0)
    /// @param _max Maximum stake in wei (must be > min)
    function setStakeLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min > 0 && _min < _max, "Invalid limits");
        minStake = _min;
        maxStake = _max;
        emit StakeLimitsChanged(_min, _max);
    }
    
    /// @notice Pause all battle operations for emergency
    function pause() external onlyOwner {
        _pause();
    }
    
    /// @notice Resume battle operations
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /// @notice Set win boost percentage (admin only)
    /// @param _winBoostBPS Boost in basis points (500 = 5%, max 5000 = 50%)
    function setWinBoost(uint256 _winBoostBPS) external onlyOwner {
        require(_winBoostBPS <= 5000, "Max 50% boost");
        winBoostBPS = _winBoostBPS;
        emit WinBoostUpdated(_winBoostBPS);
    }
    
    /// @notice Set win boost wallet (source of bonus tokens)
    /// @param _wallet Address holding boost tokens
    function setWinBoostWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "Invalid wallet");
        winBoostWallet = _wallet;
        emit WinBoostWalletUpdated(_wallet);
    }
    
    // ============ View Functions ============
    
    /// @notice Calculate expected winnings for a given stake (for frontend display)
    /// @param stakeAmount The stake amount
    /// @return baseAmount Normal prize (pot minus platform fee)
    /// @return boostAmount Bonus amount from win boost percentage
    function calculateWinnings(uint256 stakeAmount) external view returns (uint256 baseAmount, uint256 boostAmount) {
        uint256 totalPot = stakeAmount * 2;
        uint256 platformFee = (totalPot * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        baseAmount = totalPot - platformFee;
        boostAmount = (baseAmount * winBoostBPS) / BPS_DENOMINATOR;
    }
    
    // Timelock events
    event BackendProposed(address indexed newBackend, uint256 effectiveTime);
    event BackendChanged(address indexed oldBackend, address indexed newBackend);
    
    // Admin change events
    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);
    event CreatureContractChanged(address indexed oldContract, address indexed newContract);
    event StakeLimitsChanged(uint256 newMin, uint256 newMax);
    event AirdropVaultChanged(address indexed oldVault, address indexed newVault);
    
    /// @notice Update the AirdropVault contract reference
    /// @param _airdropVault New AirdropVault contract address (can be zero to disable)
    function setAirdropVault(address _airdropVault) external onlyOwner {
        address oldVault = address(airdropVault);
        airdropVault = IAirdropVault(_airdropVault);
        emit AirdropVaultChanged(oldVault, _airdropVault);
    }
    
    // ============ View Functions ============
    
    /// @notice Get full battle details by ID
    /// @param battleId The battle identifier
    /// @return Battle struct with all battle data
    function getBattle(bytes32 battleId) external view returns (Battle memory) {
        return battles[battleId];
    }
    
    /// @notice Check if a wallet is currently in an active battle
    /// @param wallet Address to check
    /// @return True if wallet is in a battle
    function isInBattle(address wallet) external view returns (bool) {
        return walletInBattle[wallet] != bytes32(0);
    }
    
    /// @notice Get the active battle ID for a wallet
    /// @param wallet Address to check
    /// @return Battle ID or bytes32(0) if not in battle
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
