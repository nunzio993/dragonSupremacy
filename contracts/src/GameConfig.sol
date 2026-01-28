// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title GameConfig
 * @notice On-chain configuration for all game parameters. Only owner can modify.
 * @dev All other contracts should read from this contract for consistency.
 */
contract GameConfig is Ownable, Pausable {
    
    // ============ Battle Costs ============
    uint256 public battleCostDGNE = 5 ether;      // Dragon Token cost per battle
    uint256 public battleCostRMRK = 1 ether;      // RMRK cost per battle
    uint256 public battleRewardDGNE = 8 ether;    // DGNE reward for winner
    
    // ============ Mint Costs ============
    uint256 public mintCostDGNE = 1000 ether;     // Dragon Token cost to mint (1000 DGNE)
    uint256 public skipCostDGNE = 100 ether;      // Dragon Token cost to skip preview (100 DGNE)
    uint256 public mintCostRMRK = 10 ether;       // RMRK cost to mint (legacy)
    address public mintTreasury;                   // Where mint/skip payments go
    
    // ============ Staking Parameters ============
    uint256 public stakingBaseRate = 10 ether;    // Base DGNE per day
    uint256 public talentMultiplier = 100;        // Rate = baseRate * (1 + talent/multiplier)
    
    // ============ Healing Parameters ============
    uint256 public healCostPerHP = 0.1 ether;     // DGNE cost per HP healed
    uint256 public regenPercentPerHour = 5;       // % of max HP regenerated per hour
    
    // ============ Contract References ============
    address public dragonToken;
    address public rmrkToken;
    address public creatureContract;
    address public stakingContract;
    address public battleGate;
    
    // ============ Events ============
    event BattleCostsUpdated(uint256 dgne, uint256 rmrk, uint256 reward);
    event MintCostsUpdated(uint256 dgne, uint256 rmrk);
    event StakingParamsUpdated(uint256 baseRate, uint256 multiplier);
    event HealingParamsUpdated(uint256 costPerHP, uint256 regenPercent);
    event ContractAddressUpdated(string name, address addr);
    
    constructor() Ownable(msg.sender) {}
    
    // ============ Owner Functions ============
    
    function setBattleCosts(uint256 _dgne, uint256 _rmrk, uint256 _reward) external onlyOwner {
        battleCostDGNE = _dgne;
        battleCostRMRK = _rmrk;
        battleRewardDGNE = _reward;
        emit BattleCostsUpdated(_dgne, _rmrk, _reward);
    }
    
    function setMintCosts(uint256 _mintCost, uint256 _skipCost, uint256 _rmrk) external onlyOwner {
        mintCostDGNE = _mintCost;
        skipCostDGNE = _skipCost;
        mintCostRMRK = _rmrk;
        emit MintCostsUpdated(_mintCost, _rmrk);
    }
    
    function setMintTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        mintTreasury = _treasury;
        emit ContractAddressUpdated("mintTreasury", _treasury);
    }
    
    function setStakingParams(uint256 _baseRate, uint256 _multiplier) external onlyOwner {
        require(_multiplier > 0, "Multiplier must be > 0");
        stakingBaseRate = _baseRate;
        talentMultiplier = _multiplier;
        emit StakingParamsUpdated(_baseRate, _multiplier);
    }
    
    function setHealingParams(uint256 _costPerHP, uint256 _regenPercent) external onlyOwner {
        require(_regenPercent <= 100, "Regen percent max 100");
        healCostPerHP = _costPerHP;
        regenPercentPerHour = _regenPercent;
        emit HealingParamsUpdated(_costPerHP, _regenPercent);
    }
    
    function setDragonToken(address _addr) external onlyOwner {
        dragonToken = _addr;
        emit ContractAddressUpdated("dragonToken", _addr);
    }
    
    function setRmrkToken(address _addr) external onlyOwner {
        rmrkToken = _addr;
        emit ContractAddressUpdated("rmrkToken", _addr);
    }
    
    function setCreatureContract(address _addr) external onlyOwner {
        creatureContract = _addr;
        emit ContractAddressUpdated("creatureContract", _addr);
    }
    
    function setStakingContract(address _addr) external onlyOwner {
        stakingContract = _addr;
        emit ContractAddressUpdated("stakingContract", _addr);
    }
    
    function setBattleGate(address _addr) external onlyOwner {
        battleGate = _addr;
        emit ContractAddressUpdated("battleGate", _addr);
    }
    
    // ============ Emergency ============
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ View Helpers ============
    
    /**
     * @notice Calculate staking rate for a creature based on talent
     * @param talent Creature talent (1-100)
     * @return Daily token generation rate in wei
     */
    function getStakingRate(uint8 talent) external view returns (uint256) {
        // Rate = baseRate * (1 + talent/multiplier)
        return stakingBaseRate + (stakingBaseRate * talent / talentMultiplier);
    }
    
    /**
     * @notice Calculate heal cost for given HP amount
     * @param hpToHeal Amount of HP to restore
     * @return Cost in DGNE wei
     */
    function getHealCost(uint256 hpToHeal) external view returns (uint256) {
        return hpToHeal * healCostPerHP;
    }
    
    /**
     * @notice Calculate HP regenerated over time
     * @param maxHP Creature max HP
     * @param hoursElapsed Hours since last damage
     * @return HP regenerated
     */
    function getHPRegen(uint256 maxHP, uint256 hoursElapsed) external view returns (uint256) {
        uint256 regen = maxHP * regenPercentPerHour * hoursElapsed / 100;
        return regen > maxHP ? maxHP : regen;
    }
}
