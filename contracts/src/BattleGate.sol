// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./GameConfig.sol";

/**
 * @title BattleGate
 * @notice Entry point for battles. Burns DGNE tokens as entry fee.
 * @dev Backend verifies payment via event logs before allowing battle.
 */
contract BattleGate is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ State ============
    
    GameConfig public gameConfig;
    IERC20 public dragonToken;
    
    // Track battle entries to prevent replay
    mapping(bytes32 => bool) public usedNonces;
    
    // ============ Events ============
    
    event BattleEntryPaid(
        address indexed player,
        uint256 indexed creatureId,
        uint256 dgneCost,
        bytes32 nonce
    );
    
    event BattleRefunded(
        address indexed player,
        uint256 indexed creatureId,
        bytes32 nonce
    );
    
    // ============ Constructor ============
    
    constructor(address _gameConfig, address _dragonToken) Ownable(msg.sender) {
        require(_gameConfig != address(0), "Invalid game config");
        require(_dragonToken != address(0), "Invalid dragon token");
        gameConfig = GameConfig(_gameConfig);
        dragonToken = IERC20(_dragonToken);
    }
    
    // ============ Battle Entry ============
    
    /**
     * @notice Pay entry fee to join a battle
     * @param creatureId The creature token ID entering battle
     * @param nonce Unique nonce to prevent replay attacks
     */
    function payEntryFee(uint256 creatureId, bytes32 nonce) external whenNotPaused nonReentrant {
        require(!usedNonces[nonce], "Nonce already used");
        
        uint256 dgneCost = gameConfig.battleCostDGNE();
        
        // Check balance
        require(dragonToken.balanceOf(msg.sender) >= dgneCost, "Insufficient DGNE");
        
        // Transfer DGNE (using SafeERC20)
        dragonToken.safeTransferFrom(msg.sender, address(this), dgneCost);
        
        // Mark nonce as used
        usedNonces[nonce] = true;
        
        emit BattleEntryPaid(msg.sender, creatureId, dgneCost, nonce);
    }
    
    /**
     * @notice Refund entry fee if battle didn't start (admin only)
     * @param player Player to refund
     * @param creatureId The creature token ID
     * @param nonce The original nonce
     */
    function refundEntryFee(address player, uint256 creatureId, bytes32 nonce) external onlyOwner {
        uint256 dgneCost = gameConfig.battleCostDGNE();
        
        // Refund from contract balance (using SafeERC20)
        dragonToken.safeTransfer(player, dgneCost);
        
        emit BattleRefunded(player, creatureId, nonce);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get current battle entry costs and reward
     */
    function getEntryCost() external view returns (uint256 dgneCost, uint256 reward) {
        return (gameConfig.battleCostDGNE(), gameConfig.battleRewardDGNE());
    }
    
    /**
     * @notice Check if player has sufficient balance for entry
     */
    function canEnterBattle(address player) external view returns (bool) {
        return dragonToken.balanceOf(player) >= gameConfig.battleCostDGNE();
    }
    
    // ============ Operator Functions ============
    
    /// @notice Authorized operators (backend wallets) that can reward winners
    mapping(address => bool) public authorizedOperators;
    
    /**
     * @notice Reward the winner of a battle with DGNE tokens
     * @param winner Address of the battle winner
     * @param battleNonce The battle nonce for verification
     */
    function rewardWinner(address winner, bytes32 battleNonce) external {
        require(authorizedOperators[msg.sender], "Not authorized operator");
        require(usedNonces[battleNonce], "Battle not found");
        
        uint256 reward = gameConfig.battleRewardDGNE();
        
        // Mint DGNE to winner (BattleGate must be an authorized minter)
        IDragonToken(address(dragonToken)).mint(winner, reward);
        
        emit WinnerRewarded(winner, reward, battleNonce);
    }
    
    event WinnerRewarded(address indexed winner, uint256 amount, bytes32 battleNonce);
    
    // ============ Admin Functions ============
    
    function setOperator(address operator, bool authorized) external onlyOwner {
        authorizedOperators[operator] = authorized;
        emit OperatorUpdated(operator, authorized);
    }
    
    event OperatorUpdated(address indexed operator, bool authorized);
    
    function setGameConfig(address _gameConfig) external onlyOwner {
        require(_gameConfig != address(0), "Invalid game config");
        gameConfig = GameConfig(_gameConfig);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Withdraw accumulated tokens (for burning or treasury)
     */
    function withdrawTokens(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(to, amount);
    }
}

// Interface for DragonToken minting
interface IDragonToken {
    function mint(address to, uint256 amount) external;
}
