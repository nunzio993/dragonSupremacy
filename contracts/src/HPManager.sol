// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title HPManager
 * @notice Manages creature HP, time-based recovery, and instant heal with DGNE payment
 * @dev Separated from RMRKCreature to reduce contract size
 */
contract HPManager is Ownable {
    
    // ============ State ============
    
    /// @notice HP after last battle (0-100 percentage)
    mapping(uint256 => uint256) public lastHP;
    
    /// @notice Timestamp of last battle
    mapping(uint256 => uint256) public lastBattleTime;
    
    /// @notice Authorized callers that can set HP (BattleGate, backend)
    mapping(address => bool) public hpUpdaters;
    
    // ============ Configuration ============
    
    IERC20 public dgneToken;
    address public treasury;
    uint256 public hpRecoveryRatePerHour = 5;       // 5% per hour default
    uint256 public healCostPer10Percent = 1 ether;  // 1 DGNE per 10% HP
    
    // ============ Events ============
    
    event HPSet(uint256 indexed tokenId, uint256 hp, address indexed setter);
    event CreatureHealed(uint256 indexed tokenId, uint256 oldHP, uint256 newHP, uint256 dgneCost);
    event HPUpdaterSet(address indexed updater, bool authorized);
    event ConfigUpdated(string param, uint256 value);
    event DgneTokenChanged(address indexed oldToken, address indexed newToken);
    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);
    
    // ============ Constructor ============
    
    constructor(address _dgneToken, address _treasury) Ownable(msg.sender) {
        dgneToken = IERC20(_dgneToken);
        treasury = _treasury;
    }
    
    // ============ Modifiers ============
    
    modifier onlyHPUpdater() {
        require(hpUpdaters[msg.sender] || msg.sender == owner(), "Not authorized to update HP");
        _;
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get current HP of a creature (includes time-based recovery)
     * @param tokenId The creature token ID
     * @return Current HP percentage (0-100)
     */
    function getHP(uint256 tokenId) public view returns (uint256) {
        // New creatures start with 100 HP
        if (lastBattleTime[tokenId] == 0) {
            return 100;
        }
        
        uint256 baseHP = lastHP[tokenId];
        if (baseHP >= 100) return 100;
        
        // Calculate recovered HP based on time
        uint256 hoursSinceBattle = (block.timestamp - lastBattleTime[tokenId]) / 3600;
        uint256 recoveredHP = hoursSinceBattle * hpRecoveryRatePerHour;
        
        uint256 currentHP = baseHP + recoveredHP;
        return currentHP > 100 ? 100 : currentHP;
    }
    
    /**
     * @notice Get heal cost for a specific creature
     * @param tokenId The creature token ID
     * @return cost The DGNE cost to fully heal
     * @return hpToHeal The HP percentage that needs healing
     */
    function getHealCost(uint256 tokenId) public view returns (uint256 cost, uint256 hpToHeal) {
        uint256 currentHP = getHP(tokenId);
        hpToHeal = 100 - currentHP;
        cost = (hpToHeal * healCostPer10Percent) / 10;
    }
    
    // ============ HP Management ============
    
    /**
     * @notice Set HP after battle (only authorized updaters)
     * @param tokenId The creature token ID
     * @param hp New HP percentage (0-100)
     */
    function setHP(uint256 tokenId, uint256 hp) external onlyHPUpdater {
        require(hp <= 100, "HP cannot exceed 100");
        
        lastHP[tokenId] = hp;
        lastBattleTime[tokenId] = block.timestamp;
        
        emit HPSet(tokenId, hp, msg.sender);
    }
    
    /**
     * @notice Instantly heal a creature by paying DGNE
     * @param tokenId The creature token ID
     * @dev Requires DGNE approval from user
     */
    function instantHeal(uint256 tokenId) external {
        require(address(dgneToken) != address(0), "DGNE token not set");
        require(treasury != address(0), "Treasury not set");
        
        uint256 currentHP = getHP(tokenId);
        require(currentHP < 100, "Already at full HP");
        
        // Calculate cost
        uint256 hpToHeal = 100 - currentHP;
        uint256 cost = (hpToHeal * healCostPer10Percent) / 10;
        
        // Transfer DGNE from user to treasury
        require(dgneToken.transferFrom(msg.sender, treasury, cost), "DGNE transfer failed");
        
        // Set HP to 100
        lastHP[tokenId] = 100;
        lastBattleTime[tokenId] = block.timestamp;
        
        emit CreatureHealed(tokenId, currentHP, 100, cost);
    }
    
    // ============ Admin Functions ============
    
    function setHPUpdater(address updater, bool authorized) external onlyOwner {
        hpUpdaters[updater] = authorized;
        emit HPUpdaterSet(updater, authorized);
    }
    
    function setDgneToken(address _token) external onlyOwner {
        address oldToken = address(dgneToken);
        dgneToken = IERC20(_token);
        emit DgneTokenChanged(oldToken, _token);
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryChanged(oldTreasury, _treasury);
    }
    
    function setHpRecoveryRate(uint256 _ratePerHour) external onlyOwner {
        require(_ratePerHour <= 100, "Rate too high");
        hpRecoveryRatePerHour = _ratePerHour;
        emit ConfigUpdated("hpRecoveryRatePerHour", _ratePerHour);
    }
    
    function setHealCost(uint256 _costPer10Percent) external onlyOwner {
        healCostPer10Percent = _costPer10Percent;
        emit ConfigUpdated("healCostPer10Percent", _costPer10Percent);
    }
}
