// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./DragonToken.sol";
import "./GameConfig.sol";

// ============ Custom Errors (Gas Optimization) ============
error NotOwner();
error AlreadyStaked();
error InvalidTalent();
error NotStakeOwner();
error NothingToClaim();
error InvalidConfig();

/**
 * @title DragonStaking
 * @notice Stake dragons (NFTs) to generate Dragon Essence (DGNE) tokens
 * @dev Rate based on GameConfig. Talent affects generation rate.
 */
contract DragonStaking is Ownable, Pausable, ReentrancyGuard {
    
    // ============ State ============
    
    GameConfig public gameConfig;
    DragonToken public dragonToken;
    IERC721 public creatureContract;
    
    struct StakeInfo {
        address owner;
        uint64 stakedAt;
        uint64 lastClaimAt;
        uint8 talent;
    }
    
    // tokenId => StakeInfo
    mapping(uint256 => StakeInfo) public stakes;
    
    // owner => staked token IDs
    mapping(address => uint256[]) public stakedByOwner;
    
    // ============ Events ============
    
    event Staked(address indexed owner, uint256 indexed tokenId, uint8 talent);
    event Unstaked(address indexed owner, uint256 indexed tokenId, uint256 tokensEarned);
    event Claimed(address indexed owner, uint256 indexed tokenId, uint256 amount);
    
    // ============ Constructor ============
    
    constructor(address _gameConfig, address _dragonToken, address _creatureContract) Ownable(msg.sender) {
        gameConfig = GameConfig(_gameConfig);
        dragonToken = DragonToken(_dragonToken);
        creatureContract = IERC721(_creatureContract);
    }
    
    // ============ Staking Functions ============
    
    /**
     * @notice Stake a dragon to start generating tokens
     * @param tokenId The creature NFT token ID
     */
    function stake(uint256 tokenId) external whenNotPaused nonReentrant {
        // Check if already staked FIRST (before ownership, since creature is transferred)
        if (stakes[tokenId].owner != address(0)) revert AlreadyStaked();
        if (creatureContract.ownerOf(tokenId) != msg.sender) revert NotOwner();
        
        // SECURITY: Read talent directly from creature contract to prevent manipulation
        uint8 talent = _getCreatureTalent(tokenId);
        if (talent < 1 || talent > 100) revert InvalidTalent();
        
        // Transfer NFT to this contract
        creatureContract.transferFrom(msg.sender, address(this), tokenId);
        
        // Record stake
        stakes[tokenId] = StakeInfo({
            owner: msg.sender,
            stakedAt: uint64(block.timestamp),
            lastClaimAt: uint64(block.timestamp),
            talent: talent
        });
        
        stakedByOwner[msg.sender].push(tokenId);
        
        emit Staked(msg.sender, tokenId, talent);
    }
    
    /**
     * @notice Unstake a dragon and claim all pending tokens
     * @param tokenId The staked creature token ID
     */
    function unstake(uint256 tokenId) external nonReentrant {
        StakeInfo storage info = stakes[tokenId];
        if (info.owner != msg.sender) revert NotStakeOwner();
        
        // Calculate and mint pending tokens
        uint256 pending = pendingRewards(tokenId);
        if (pending > 0) {
            dragonToken.mint(msg.sender, pending);
        }
        
        // Transfer NFT back
        creatureContract.transferFrom(address(this), msg.sender, tokenId);
        
        // Remove from stakedByOwner array
        _removeFromStakedArray(msg.sender, tokenId);
        
        // Clear stake
        delete stakes[tokenId];
        
        emit Unstaked(msg.sender, tokenId, pending);
    }
    
    /**
     * @notice Claim pending tokens without unstaking
     * @param tokenId The staked creature token ID
     */
    function claimTokens(uint256 tokenId) external nonReentrant {
        StakeInfo storage info = stakes[tokenId];
        if (info.owner != msg.sender) revert NotStakeOwner();
        
        uint256 pending = pendingRewards(tokenId);
        if (pending == 0) revert NothingToClaim();
        
        // Update last claim time
        info.lastClaimAt = uint64(block.timestamp);
        
        // Mint tokens
        dragonToken.mint(msg.sender, pending);
        
        emit Claimed(msg.sender, tokenId, pending);
    }
    
    uint256 public constant MAX_CLAIM_BATCH = 50; // Maximum creatures per claimAll call
    
    /**
     * @notice Claim pending tokens from staked dragons (with pagination to prevent DoS)
     * @param maxClaims Maximum number of creatures to process (0 = MAX_CLAIM_BATCH)
     */
    function claimAll(uint256 maxClaims) external nonReentrant {
        uint256[] storage tokenIds = stakedByOwner[msg.sender];
        uint256 totalClaimed = 0;
        
        // Default to MAX_CLAIM_BATCH if 0, and cap at MAX_CLAIM_BATCH
        uint256 requested = maxClaims == 0 ? MAX_CLAIM_BATCH : maxClaims;
        if (requested > MAX_CLAIM_BATCH) requested = MAX_CLAIM_BATCH;
        uint256 limit = requested < tokenIds.length ? requested : tokenIds.length;
        
        for (uint256 i = 0; i < limit; ++i) {
            uint256 tokenId = tokenIds[i];
            uint256 pending = pendingRewards(tokenId);
            
            if (pending > 0) {
                stakes[tokenId].lastClaimAt = uint64(block.timestamp);
                totalClaimed += pending;
                emit Claimed(msg.sender, tokenId, pending);
            }
        }
        
        if (totalClaimed == 0) revert NothingToClaim();
        dragonToken.mint(msg.sender, totalClaimed);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Calculate pending rewards for a staked creature
     * @param tokenId The staked creature token ID
     * @return Pending DGNE in wei
     */
    function pendingRewards(uint256 tokenId) public view returns (uint256) {
        StakeInfo storage info = stakes[tokenId];
        if (info.owner == address(0)) return 0;
        
        uint256 elapsed = block.timestamp - info.lastClaimAt;
        uint256 dailyRate = gameConfig.getStakingRate(info.talent);
        
        // tokens = dailyRate * elapsed / 1 day
        return (dailyRate * elapsed) / 1 days;
    }
    
    /**
     * @notice Get all staked token IDs for an owner
     * @param owner The address to query
     * @return Array of staked token IDs
     */
    function getStakedTokens(address owner) external view returns (uint256[] memory) {
        return stakedByOwner[owner];
    }
    
    /**
     * @notice Get total pending rewards for an owner across all staked creatures
     * @param owner The address to query
     * @return Total pending DGNE in wei
     */
    function totalPendingRewards(address owner) external view returns (uint256) {
        uint256[] storage tokenIds = stakedByOwner[owner];
        uint256 total = 0;
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            total += pendingRewards(tokenIds[i]);
        }
        
        return total;
    }
    
    // ============ Admin Functions ============
    
    event GameConfigChanged(address indexed oldConfig, address indexed newConfig);
    
    /// @notice Update the GameConfig contract reference
    /// @param _gameConfig New GameConfig contract address
    function setGameConfig(address _gameConfig) external onlyOwner {
        if (_gameConfig == address(0)) revert InvalidConfig();
        address oldConfig = address(gameConfig);
        gameConfig = GameConfig(_gameConfig);
        emit GameConfigChanged(oldConfig, _gameConfig);
    }
    
    /// @notice Pause staking operations for emergency
    function pause() external onlyOwner {
        _pause();
    }
    
    /// @notice Resume staking operations
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Internal ============
    
    function _removeFromStakedArray(address owner, uint256 tokenId) internal {
        uint256[] storage arr = stakedByOwner[owner];
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == tokenId) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                break;
            }
        }
    }
    
    /**
     * @notice Read talent from RMRKCreature contract
     * @dev Calls coreData(tokenId) to get the CoreData struct which includes talent
     */
    function _getCreatureTalent(uint256 tokenId) internal view returns (uint8) {
        // coreData returns: (genSeed, personality, elementType, temperament, bornAt, talent)
        (,,,,,uint8 talent) = IRMRKCreature(address(creatureContract)).coreData(tokenId);
        return talent;
    }
}

// Interface for reading creature talent
interface IRMRKCreature {
    function coreData(uint256 tokenId) external view returns (
        bytes32 genSeed,
        bytes32 personality,
        bytes32 elementType,
        bytes32 temperament,
        uint48 bornAt,
        uint8 talent
    );
}
