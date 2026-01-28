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
    
    mapping(address => uint256) public nonces;
    mapping(address => uint256) public skipCounts; // Track skips per user for unique previews
    
    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    
    bytes32 public constant MINT_TYPEHASH = keccak256(
        "MintCreature(address to,bytes32 genSeed,uint8 talent,bytes32 personality,bytes32 elementType,bytes32 temperament,uint72 baseStats,uint144 growthRates,uint64 aptitudes,uint8 moveCount,uint256 nonce,uint256 deadline)"
    );
    
    bytes32 public DOMAIN_SEPARATOR;
    
    event CreatureMinted(uint256 indexed tokenId, address indexed minter, uint256 dgneSpent, bytes32 genSeed);
    event PreviewSkipped(address indexed user, uint256 dgneSpent);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    
    constructor(
        address _gameConfig, 
        address _creatureContract,
        address _signer
    ) Ownable(msg.sender) {
        require(_gameConfig != address(0), "Invalid GameConfig");
        require(_creatureContract != address(0), "Invalid CreatureContract");
        require(_signer != address(0), "Invalid signer");
        
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
        require(block.timestamp <= deadline, "Signature expired");
        
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
        require(recoveredSigner == signer, "Invalid signature");
        
        nonces[msg.sender] = currentNonce + 1;
        skipCounts[msg.sender] = 0; // Reset skip count after successful mint
        
        uint256 mintCost = gameConfig.mintCostDGNE();
        address treasury = gameConfig.mintTreasury();
        require(treasury != address(0), "Treasury not set");
        
        IERC20 dgneToken = IERC20(gameConfig.dragonToken());
        dgneToken.safeTransferFrom(msg.sender, treasury, mintCost);
        
        tokenId = IRMRKCreature(creatureContract).mintCreature(
            to, genSeed, talent, personality, elementType, temperament,
            baseStats, growthRates, moves, moveCount, mastery, aptitudes
        );
        
        emit CreatureMinted(tokenId, msg.sender, mintCost, genSeed);
    }
    
    function skipPreview() external nonReentrant whenNotPaused {
        uint256 skipCost = gameConfig.skipCostDGNE();
        address treasury = gameConfig.mintTreasury();
        require(treasury != address(0), "Treasury not set");
        
        IERC20 dgneToken = IERC20(gameConfig.dragonToken());
        dgneToken.safeTransferFrom(msg.sender, treasury, skipCost);
        
        // Increment skip count to generate new preview seed
        skipCounts[msg.sender]++;
        
        emit PreviewSkipped(msg.sender, skipCost);
    }
    
    function getCosts() external view returns (uint256 mintCost, uint256 skipCost) {
        return (gameConfig.mintCostDGNE(), gameConfig.skipCostDGNE());
    }
    
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }
    
    function getSkipCount(address user) external view returns (uint256) {
        return skipCounts[user];
    }
    
    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        address oldSigner = signer;
        signer = _signer;
        emit SignerUpdated(oldSigner, _signer);
    }
    
    function setGameConfig(address _gameConfig) external onlyOwner {
        gameConfig = GameConfig(_gameConfig);
    }
    
    function setCreatureContract(address _creatureContract) external onlyOwner {
        creatureContract = _creatureContract;
    }
    
    function pause() external onlyOwner { _pause(); }
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
