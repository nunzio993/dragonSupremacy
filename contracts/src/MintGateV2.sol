// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./GameConfig.sol";

// Interface for AirdropVault (to avoid error naming conflicts)
interface IAirdropVault {
    function spendLockedBalance(address user, uint256 amount) external returns (uint256);
    function getLockedBalance(address user) external view returns (uint256);
}

// ============ Custom Errors (Gas Optimization) ============
error InvalidAddress();
error SignatureExpired();
error InvalidSignature();
error TreasuryNotSet();

/**
 * @title MintGateV2
 * @notice Secure payment gate for minting creatures with EIP-712 signature verification.
 */
contract MintGateV2 is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    
    GameConfig public gameConfig;
    address public creatureContract;
    address public signer;
    IAirdropVault public airdropVault;
    
    mapping(address => uint256) public nonces;
    mapping(address => uint256) public skipCounts; // Track skips per user for unique previews
    
    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    
    bytes32 public constant MINT_TYPEHASH = keccak256(
        "MintCreature(address to,bytes32 genSeed,uint8 talent,bytes32 personality,bytes32 elementType,bytes32 temperament,uint72 baseStats,uint144 growthRates,uint64 aptitudes,uint8 moveCount,uint256 nonce,uint256 deadline)"
    );
    
    bytes32 public DOMAIN_SEPARATOR;
    
    event CreatureMinted(uint256 indexed tokenId, address indexed minter, uint256 dgneSpent, uint256 fromLocked, bytes32 genSeed);
    event PreviewSkipped(address indexed user, uint256 dgneSpent, uint256 fromLocked);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event AirdropVaultUpdated(address indexed oldVault, address indexed newVault);
    
    constructor(
        address _gameConfig, 
        address _creatureContract,
        address _signer
    ) Ownable(msg.sender) {
        if (_gameConfig == address(0)) revert InvalidAddress();
        if (_creatureContract == address(0)) revert InvalidAddress();
        if (_signer == address(0)) revert InvalidAddress();
        
        gameConfig = GameConfig(_gameConfig);
        creatureContract = _creatureContract;
        signer = _signer;
        
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            DOMAIN_TYPEHASH,
            keccak256("MintGateV2"),
            keccak256("1"),
            block.chainid,
            address(this)
        ));
    }
    
    /**
     * @notice Mint a creature with verified signature - Move struct matches RMRKCreature exactly
     */
    function mintCreature(
        address to,
        bytes32 genSeed,
        uint8 talent,
        bytes32 personality,
        bytes32 elementType,
        bytes32 temperament,
        uint72 baseStats,
        uint144 growthRates,
        IRMRKCreature.Move[4] calldata moves,
        uint8 moveCount,
        uint8[4] calldata mastery,
        uint64 aptitudes,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant whenNotPaused returns (uint256 tokenId) {
        if (block.timestamp > deadline) revert SignatureExpired();
        
        uint256 currentNonce = nonces[msg.sender];
        bytes32 structHash = keccak256(abi.encode(
            MINT_TYPEHASH,
            to,
            genSeed,
            talent,
            personality,
            elementType,
            temperament,
            baseStats,
            growthRates,
            aptitudes,
            moveCount,
            currentNonce,
            deadline
        ));
        
        bytes32 digest = MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR, structHash);
        address recoveredSigner = ECDSA.recover(digest, signature);
        if (recoveredSigner != signer) revert InvalidSignature();
        
        nonces[msg.sender] = currentNonce + 1;
        skipCounts[msg.sender] = 0; // Reset skip count after successful mint
        
        uint256 mintCost = gameConfig.mintCostDGNE();
        address treasury = gameConfig.mintTreasury();
        if (treasury == address(0)) revert TreasuryNotSet();
        
        // Try to spend from locked balance first (airdrop credits)
        uint256 fromLocked = 0;
        if (address(airdropVault) != address(0)) {
            fromLocked = airdropVault.spendLockedBalance(msg.sender, mintCost);
        }
        
        // Pay remaining from wallet
        uint256 remaining = mintCost - fromLocked;
        if (remaining > 0) {
            IERC20 dgneToken = IERC20(gameConfig.dragonToken());
            dgneToken.safeTransferFrom(msg.sender, treasury, remaining);
        }
        
        tokenId = IRMRKCreature(creatureContract).mintCreature(
            to, genSeed, talent, personality, elementType, temperament,
            baseStats, growthRates, moves, moveCount, mastery, aptitudes
        );
        
        emit CreatureMinted(tokenId, msg.sender, mintCost, fromLocked, genSeed);
    }
    
    /**
     * @notice Pay DGNE to skip current preview and regenerate creature stats
     * @dev Increments skipCount used as salt for new preview seed
     */
    function skipPreview() external nonReentrant whenNotPaused {
        uint256 skipCost = gameConfig.skipCostDGNE();
        address treasury = gameConfig.mintTreasury();
        if (treasury == address(0)) revert TreasuryNotSet();
        
        // Try to spend from locked balance first (airdrop credits)
        uint256 fromLocked = 0;
        if (address(airdropVault) != address(0)) {
            fromLocked = airdropVault.spendLockedBalance(msg.sender, skipCost);
        }
        
        // Pay remaining from wallet
        uint256 remaining = skipCost - fromLocked;
        if (remaining > 0) {
            IERC20 dgneToken = IERC20(gameConfig.dragonToken());
            dgneToken.safeTransferFrom(msg.sender, treasury, remaining);
        }
        
        // Increment skip count to generate new preview seed
        skipCounts[msg.sender]++;
        
        emit PreviewSkipped(msg.sender, skipCost, fromLocked);
    }
    
    /// @notice Get current mint and skip costs from GameConfig
    /// @return mintCost DGNE cost to mint a creature
    /// @return skipCost DGNE cost to skip preview
    function getCosts() external view returns (uint256 mintCost, uint256 skipCost) {
        return (gameConfig.mintCostDGNE(), gameConfig.skipCostDGNE());
    }
    
    /// @notice Get user's current nonce for signature verification
    /// @param user Address to check
    /// @return Current nonce value
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }
    
    /// @notice Get user's skip count (used as salt for preview regeneration)
    /// @param user Address to check
    /// @return Number of skips since last successful mint
    function getSkipCount(address user) external view returns (uint256) {
        return skipCounts[user];
    }
    
    /// @notice Update the trusted signer address for EIP-712 signatures
    /// @param _signer New signer address (cannot be zero)
    function setSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert InvalidAddress();
        address oldSigner = signer;
        signer = _signer;
        emit SignerUpdated(oldSigner, _signer);
    }
    
    /// @notice Update the GameConfig contract reference
    /// @param _gameConfig New GameConfig contract address
    function setGameConfig(address _gameConfig) external onlyOwner {
        gameConfig = GameConfig(_gameConfig);
    }
    
    /// @notice Update the creature NFT contract reference
    /// @param _creatureContract New RMRKCreature contract address
    function setCreatureContract(address _creatureContract) external onlyOwner {
        creatureContract = _creatureContract;
    }
    
    /// @notice Update the AirdropVault contract reference
    /// @param _airdropVault New AirdropVault contract address (can be zero to disable)
    function setAirdropVault(address _airdropVault) external onlyOwner {
        address oldVault = address(airdropVault);
        airdropVault = IAirdropVault(_airdropVault);
        emit AirdropVaultUpdated(oldVault, _airdropVault);
    }
    
    /// @notice Pause minting operations for emergency
    function pause() external onlyOwner { _pause(); }
    /// @notice Resume minting operations
    function unpause() external onlyOwner { _unpause(); }
}

// Interface with CORRECT Move struct matching RMRKCreature
interface IRMRKCreature {
    struct Move {
        uint8 moveId;       // Move identifier (0 = empty slot)
        uint8 moveType;     // Element type: 0=FIRE, 1=WATER, etc
        uint8 category;     // 0=Physical, 1=Special, 2=Status
        uint8 power;        // 0-200
        uint8 accuracy;     // 0-100
        uint8 cooldownMax;  // 0-10 turns
        uint8 statusEffect; // 0=None, 1=Burn, etc
        uint8 statusChance; // 0-100 percentage
    }
    
    function mintCreature(
        address to,
        bytes32 genSeed,
        uint8 talent,
        bytes32 personality,
        bytes32 elementType,
        bytes32 temperament,
        uint72 baseStats,
        uint144 growthRates,
        Move[4] calldata moves,
        uint8 moveCount,
        uint8[4] calldata mastery,
        uint64 aptitudes
    ) external returns (uint256 tokenId);
}
