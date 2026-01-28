// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// ============ Custom Errors (Gas Optimization) ============
error InvalidTreasuryAddress();
error MultiplierMustBePositive();
error RegenPercentTooHigh();

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
    
    /**
     * @notice Update battle entry costs and winner reward
     * @param _dgne DGNE token cost per battle
     * @param _rmrk RMRK token cost per battle (legacy)
     * @param _reward DGNE reward for battle winner
     */
    function setBattleCosts(uint256 _dgne, uint256 _rmrk, uint256 _reward) external onlyOwner {
        battleCostDGNE = _dgne;
        battleCostRMRK = _rmrk;
        battleRewardDGNE = _reward;
        emit BattleCostsUpdated(_dgne, _rmrk, _reward);
    }
    
    /**
     * @notice Update creature minting costs
     * @param _mintCost DGNE cost to mint a new creature
     * @param _skipCost DGNE cost to skip preview and regenerate
     * @param _rmrk RMRK cost to mint (legacy)
     */
    function setMintCosts(uint256 _mintCost, uint256 _skipCost, uint256 _rmrk) external onlyOwner {
        mintCostDGNE = _mintCost;
        skipCostDGNE = _skipCost;
        mintCostRMRK = _rmrk;
        emit MintCostsUpdated(_mintCost, _rmrk);
    }
    
    /**
     * @notice Set treasury address for mint payments
     * @param _treasury Address to receive mint fees
     */
    function setMintTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert InvalidTreasuryAddress();
        mintTreasury = _treasury;
        emit ContractAddressUpdated("mintTreasury", _treasury);
    }
    
    /**
     * @notice Update staking reward parameters
     * @param _baseRate Base DGNE per day for staking
     * @param _multiplier Talent divisor (rate = base * (1 + talent/multiplier))
     */
    function setStakingParams(uint256 _baseRate, uint256 _multiplier) external onlyOwner {
        if (_multiplier == 0) revert MultiplierMustBePositive();
        stakingBaseRate = _baseRate;
        talentMultiplier = _multiplier;
        emit StakingParamsUpdated(_baseRate, _multiplier);
    }
    
    /**
     * @notice Update HP healing parameters
     * @param _costPerHP DGNE cost per HP healed
     * @param _regenPercent Passive HP regen percentage per hour (max 100)
     */
    function setHealingParams(uint256 _costPerHP, uint256 _regenPercent) external onlyOwner {
        if (_regenPercent > 100) revert RegenPercentTooHigh();
        healCostPerHP = _costPerHP;
        regenPercentPerHour = _regenPercent;
        emit HealingParamsUpdated(_costPerHP, _regenPercent);
    }
    
    /// @notice Set the Dragon Token (DGNE) contract address
    /// @param _addr DGNE token contract address
    function setDragonToken(address _addr) external onlyOwner {
        dragonToken = _addr;
        emit ContractAddressUpdated("dragonToken", _addr);
    }
    
    /// @notice Set the RMRK token contract address (legacy)
    /// @param _addr RMRK token contract address
    function setRmrkToken(address _addr) external onlyOwner {
        rmrkToken = _addr;
        emit ContractAddressUpdated("rmrkToken", _addr);
    }
    
    /// @notice Set the creature NFT contract address
    /// @param _addr RMRKCreature contract address
    function setCreatureContract(address _addr) external onlyOwner {
        creatureContract = _addr;
        emit ContractAddressUpdated("creatureContract", _addr);
    }
    
    /// @notice Set the staking contract address
    /// @param _addr DragonStaking contract address
    function setStakingContract(address _addr) external onlyOwner {
        stakingContract = _addr;
        emit ContractAddressUpdated("stakingContract", _addr);
    }
    
    /// @notice Set the battle gate contract address
    /// @param _addr BattleGateV2 contract address
    function setBattleGate(address _addr) external onlyOwner {
        battleGate = _addr;
        emit ContractAddressUpdated("battleGate", _addr);
    }
    
    // ============ Emergency ============
    
    /// @notice Pause all game operations that read from this config
    function pause() external onlyOwner {
        _pause();
    }
    
    /// @notice Resume game operations
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
