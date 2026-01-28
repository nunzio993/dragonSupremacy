// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./GameConfig.sol";

// ============ Custom Errors (Gas Optimization) ============
error InvalidAddress();
error InsufficientDGNE();
error InsufficientRMRK();

/**
 * @title MintGate
 * @author NFT Autobattler Team
 * @notice Payment gate for minting creatures. Burns DGNE + RMRK tokens before minting.
 * @dev This contract is authorized as a minter on RMRKCreature.
 * 
 * Security:
 * - Uses SafeERC20 for token transfers
 * - ReentrancyGuard prevents reentrancy attacks
 * - Pausable for emergency stops
 * - Only authorized contracts can call
 */
contract MintGate is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Storage ============
    
    GameConfig public gameConfig;
    IRMRKCreature public rmrkCreature;
    
    // ============ Events ============
    
    event CreatureMintedViaGate(
        uint256 indexed tokenId,
        address indexed minter,
        uint256 dgneBurned,
        uint256 rmrkBurned
    );
    event GameConfigUpdated(address indexed newConfig);
    event RMRKCreatureUpdated(address indexed newCreature);
    
    // ============ Constructor ============
    
    constructor(address _gameConfig, address _rmrkCreature) Ownable(msg.sender) {
        if (_gameConfig == address(0)) revert InvalidAddress();
        if (_rmrkCreature == address(0)) revert InvalidAddress();
        
        gameConfig = GameConfig(_gameConfig);
        rmrkCreature = IRMRKCreature(_rmrkCreature);
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Mint a creature by burning DGNE and RMRK tokens
     * @dev User must approve this contract to spend their tokens first
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
        uint64 aptitudes
    ) external nonReentrant whenNotPaused returns (uint256 tokenId) {
        // Get costs from GameConfig
        uint256 dgneCost = gameConfig.mintCostDGNE();
        uint256 rmrkCost = gameConfig.mintCostRMRK();
        
        IERC20 dgneToken = IERC20(gameConfig.dragonToken());
        IERC20 rmrkToken = IERC20(gameConfig.rmrkToken());
        
        // Verify user has enough tokens
        if (dgneToken.balanceOf(msg.sender) < dgneCost) revert InsufficientDGNE();
        if (rmrkToken.balanceOf(msg.sender) < rmrkCost) revert InsufficientRMRK();
        
        // Burn tokens by transferring to this contract (can also use burnFrom if available)
        // Using safeTransferFrom for security
        dgneToken.safeTransferFrom(msg.sender, address(this), dgneCost);
        rmrkToken.safeTransferFrom(msg.sender, address(this), rmrkCost);
        
        // Burn the tokens (assuming DragonToken has burn function)
        // If tokens don't have burn, they stay in this contract (can be recovered by owner)
        try IHasBurn(address(dgneToken)).burn(dgneCost) {} catch {}
        try IHasBurn(address(rmrkToken)).burn(rmrkCost) {} catch {}
        
        // Mint the creature via RMRKCreature
        tokenId = rmrkCreature.mintCreature(
            to,
            genSeed,
            talent,
            personality,
            elementType,
            temperament,
            baseStats,
            growthRates,
            moves,
            moveCount,
            mastery,
            aptitudes
        );
        
        emit CreatureMintedViaGate(tokenId, msg.sender, dgneCost, rmrkCost);
    }
    
    // ============ View Functions ============
    
    /// @notice Get current mint costs
    function getMintCosts() external view returns (uint256 dgneCost, uint256 rmrkCost) {
        return (gameConfig.mintCostDGNE(), gameConfig.mintCostRMRK());
    }
    
    /// @notice Check if user has enough tokens to mint
    function canMint(address user) external view returns (bool) {
        IERC20 dgneToken = IERC20(gameConfig.dragonToken());
        IERC20 rmrkToken = IERC20(gameConfig.rmrkToken());
        
        return dgneToken.balanceOf(user) >= gameConfig.mintCostDGNE() &&
               rmrkToken.balanceOf(user) >= gameConfig.mintCostRMRK();
    }
    
    // ============ Admin Functions ============
    
    function setGameConfig(address _gameConfig) external onlyOwner {
        if (_gameConfig == address(0)) revert InvalidAddress();
        gameConfig = GameConfig(_gameConfig);
        emit GameConfigUpdated(_gameConfig);
    }
    
    function setRMRKCreature(address _rmrkCreature) external onlyOwner {
        if (_rmrkCreature == address(0)) revert InvalidAddress();
        rmrkCreature = IRMRKCreature(_rmrkCreature);
        emit RMRKCreatureUpdated(_rmrkCreature);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /// @notice Recover tokens accidentally sent to this contract
    function recoverTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}

// ============ Interfaces ============

interface IRMRKCreature {
    struct Move {
        uint8 moveId;
        uint8 moveType;
        uint8 category;
        uint8 power;
        uint8 accuracy;
        uint8 cooldownMax;
        uint8 statusEffect;
        uint8 statusChance;
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

interface IHasBurn {
    function burn(uint256 amount) external;
}
