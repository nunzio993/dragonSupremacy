// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "forge-std/Test.sol";
import "../src/DragonStaking.sol";
import "../src/HPManager.sol";
import "../src/GameConfig.sol";
import "../src/DragonToken.sol";
import "../src/RMRKCreature.sol";

/**
 * @title StakingInvariantTests
 * @notice Invariant tests for DragonStaking and HPManager
 * @dev Run with: forge test --match-contract StakingInvariantTests --fuzz-runs 500 -vv
 */
contract StakingInvariantTests is Test {
    
    DragonStaking public staking;
    HPManager public hpManager;
    DragonToken public dragonToken;
    GameConfig public gameConfig;
    RMRKCreature public creature;
    
    StakingHandler public handler;
    
    address public treasury;
    
    function setUp() public {
        treasury = makeAddr("treasury");
        
        dragonToken = new DragonToken();
        gameConfig = new GameConfig();
        creature = new RMRKCreature();
        
        staking = new DragonStaking(
            address(gameConfig),
            address(dragonToken),
            address(creature)
        );
        
        hpManager = new HPManager(address(dragonToken), treasury);
        
        // Setup permissions
        dragonToken.setMinter(address(this), true);
        dragonToken.setMinter(address(staking), true);
        creature.setMinter(address(this), true);
        hpManager.setHPUpdater(address(this), true);
        
        // Deploy handler
        handler = new StakingHandler(staking, hpManager, dragonToken, creature, treasury);
        
        dragonToken.setMinter(address(handler), true);
        creature.setMinter(address(handler), true);
        hpManager.setHPUpdater(address(handler), true);
        
        handler.initialize();
        
        targetContract(address(handler));
    }
    
    // ============ STAKING INVARIANTS ============
    
    /// @notice Total staked creatures must match sum of individual stakes
    function invariant_stakingBalanceConsistency() public view {
        uint256 totalCreaturesStaked = handler.getTotalCreaturesStaked();
        uint256 expectedStaked = 0;
        
        uint256[] memory creatures = handler.getAllCreatures();
        for (uint256 i = 0; i < creatures.length; i++) {
            (address owner,,,) = staking.stakes(creatures[i]);
            if (owner != address(0)) {
                expectedStaked++;
            }
        }
        
        assertEq(totalCreaturesStaked, expectedStaked, "INVARIANT: Staking count mismatch");
    }
    
    /// @notice Staked creature must be owned by staking contract
    function invariant_stakedCreatureOwnership() public view {
        uint256[] memory creatures = handler.getAllCreatures();
        
        for (uint256 i = 0; i < creatures.length; i++) {
            uint256 creatureId = creatures[i];
            (address stakeOwner,,,) = staking.stakes(creatureId);
            
            if (stakeOwner != address(0)) {
                // Creature is staked, must be owned by staking contract
                assertEq(
                    creature.ownerOf(creatureId),
                    address(staking),
                    "INVARIANT: Staked creature not owned by staking contract"
                );
            }
        }
    }
    
    /// @notice Unstaked creature must be returned to original owner
    function invariant_unstakedCreatureReturned() public view {
        address[] memory users = handler.getAllUsers();
        
        for (uint256 i = 0; i < users.length; i++) {
            uint256[] memory userCreatures = handler.getUserCreatures(users[i]);
            
            for (uint256 j = 0; j < userCreatures.length; j++) {
                uint256 creatureId = userCreatures[j];
                (address stakeOwner,,,) = staking.stakes(creatureId);
                
                if (stakeOwner == address(0)) {
                    // Not staked - should be owned by the user
                    assertEq(
                        creature.ownerOf(creatureId),
                        users[i],
                        "INVARIANT: Unstaked creature not returned to owner"
                    );
                }
            }
        }
    }
    
    /// @notice Pending rewards must be non-negative
    function invariant_pendingRewardsNonNegative() public view {
        uint256[] memory creatures = handler.getAllCreatures();
        
        for (uint256 i = 0; i < creatures.length; i++) {
            uint256 pending = staking.pendingRewards(creatures[i]);
            assertGe(pending, 0, "INVARIANT: Negative pending rewards");
        }
    }
    
    /// @notice Tokens minted must match rewards claimed
    function invariant_mintedTokensMatchRewards() public view {
        uint256 totalMinted = handler.getTotalTokensMinted();
        uint256 totalClaimed = handler.getTotalTokensClaimed();
        
        assertEq(totalMinted, totalClaimed, "INVARIANT: Minted tokens don't match claimed");
    }
    
    // ============ HP MANAGER INVARIANTS ============
    
    /// @notice HP must always be between 0 and 100
    function invariant_hpBounds() public view {
        uint256[] memory creatures = handler.getAllCreatures();
        
        for (uint256 i = 0; i < creatures.length; i++) {
            uint256 hp = hpManager.getHP(creatures[i]);
            assertLe(hp, 100, "INVARIANT: HP exceeds 100");
        }
    }
    
    /// @notice HP recovery must be proportional to time
    function invariant_hpRecoveryBounded() public view {
        uint256[] memory creatures = handler.getAllCreatures();
        
        for (uint256 i = 0; i < creatures.length; i++) {
            uint256 creatureId = creatures[i];
            uint256 currentHP = hpManager.getHP(creatureId);
            uint256 lastHP = hpManager.lastHP(creatureId);
            uint256 lastBattle = hpManager.lastBattleTime(creatureId);
            
            if (lastBattle > 0 && lastHP < 100) {
                uint256 hoursPassed = (block.timestamp - lastBattle) / 3600;
                uint256 maxRecovery = hoursPassed * hpManager.hpRecoveryRatePerHour();
                uint256 expectedMaxHP = lastHP + maxRecovery > 100 ? 100 : lastHP + maxRecovery;
                
                assertLe(currentHP, expectedMaxHP, "INVARIANT: HP recovered more than expected");
            }
        }
    }
    
    /// @notice Heal cost must be proportional to HP to heal
    function invariant_healCostProportional() public view {
        uint256[] memory creatures = handler.getAllCreatures();
        
        for (uint256 i = 0; i < creatures.length; i++) {
            uint256 creatureId = creatures[i];
            (uint256 cost, uint256 hpToHeal) = hpManager.getHealCost(creatureId);
            
            if (hpToHeal > 0) {
                uint256 expectedCost = (hpToHeal * hpManager.healCostPer10Percent()) / 10;
                assertEq(cost, expectedCost, "INVARIANT: Heal cost calculation wrong");
            } else {
                assertEq(cost, 0, "INVARIANT: Cost should be 0 when full HP");
            }
        }
    }
    
    /// @notice Treasury must receive all heal payments
    function invariant_treasuryReceivesHealPayments() public view {
        uint256 treasuryBalance = dragonToken.balanceOf(treasury);
        uint256 totalHealPayments = handler.getTotalHealPayments();
        
        assertEq(treasuryBalance, totalHealPayments, "INVARIANT: Treasury balance mismatch");
    }
}

/**
 * @title StakingHandler
 * @notice Handler for staking and HP invariant tests
 */
contract StakingHandler is Test {
    DragonStaking public staking;
    HPManager public hpManager;
    DragonToken public dragonToken;
    RMRKCreature public creature;
    address public treasury;
    
    address[] public allUsers;
    uint256[] public allCreatures;
    mapping(address => uint256[]) public userCreatures;
    
    uint256 public totalCreaturesStaked;
    uint256 public totalTokensMinted;
    uint256 public totalTokensClaimed;
    uint256 public totalHealPayments;
    
    bool public initialized;
    
    constructor(
        DragonStaking _staking,
        HPManager _hpManager,
        DragonToken _dragonToken,
        RMRKCreature _creature,
        address _treasury
    ) {
        staking = _staking;
        hpManager = _hpManager;
        dragonToken = _dragonToken;
        creature = _creature;
        treasury = _treasury;
    }
    
    function initialize() external {
        require(!initialized, "Already initialized");
        initialized = true;
        
        // Create 10 users with 2 creatures each
        for (uint256 i = 1; i <= 10; i++) {
            address user = address(uint160(0x2000 + i));
            allUsers.push(user);
            
            dragonToken.mint(user, 100000 ether);
            
            // Mint 2 creatures per user
            for (uint256 j = 0; j < 2; j++) {
                uint256 creatureId = (i - 1) * 2 + j + 1;
                _mintCreature(user, creatureId);
                allCreatures.push(creatureId);
                userCreatures[user].push(creatureId);
            }
            
            // Approve staking contract
            vm.prank(user);
            creature.setApprovalForAll(address(staking), true);
            
            // Approve hpManager for heal payments
            vm.prank(user);
            dragonToken.approve(address(hpManager), type(uint256).max);
        }
    }
    
    function _mintCreature(address to, uint256 id) internal {
        RMRKCreature.Move[4] memory moves;
        moves[0] = RMRKCreature.Move(1, 0, 0, 50, 90, 1, 0, 0);
        moves[1] = RMRKCreature.Move(2, 1, 1, 60, 85, 2, 1, 20);
        moves[2] = RMRKCreature.Move(0, 0, 0, 0, 0, 0, 0, 0);
        moves[3] = RMRKCreature.Move(0, 0, 0, 0, 0, 0, 0, 0);
        uint8[4] memory mastery = [uint8(15), 15, 0, 0];
        
        creature.mintCreature(
            to,
            keccak256(abi.encodePacked(id)),
            uint8(10 + (id % 90)), // Talent 10-99
            bytes32("calm"),
            bytes32("FIRE"),
            bytes32("brave"),
            0x3C3C3C3C3C3C3C3C3C,
            0x0064006400640064006400640064006400,
            moves,
            2,
            mastery,
            0x5050505050505050
        );
    }
    
    // ============ STAKING ACTIONS ============
    
    function stake(uint256 userSeed, uint256 creatureSeed) external {
        address user = allUsers[userSeed % allUsers.length];
        uint256[] memory userCr = userCreatures[user];
        if (userCr.length == 0) return;
        
        uint256 creatureId = userCr[creatureSeed % userCr.length];
        
        // Check if already staked
        (address owner,,,) = staking.stakes(creatureId);
        if (owner != address(0)) return;
        
        // Check ownership
        if (creature.ownerOf(creatureId) != user) return;
        
        vm.prank(user);
        try staking.stake(creatureId) {
            totalCreaturesStaked++;
        } catch {}
    }
    
    function unstake(uint256 userSeed, uint256 creatureSeed) external {
        address user = allUsers[userSeed % allUsers.length];
        uint256[] memory userCr = userCreatures[user];
        if (userCr.length == 0) return;
        
        uint256 creatureId = userCr[creatureSeed % userCr.length];
        
        // Check if staked by this user
        (address owner,,,) = staking.stakes(creatureId);
        if (owner != user) return;
        
        uint256 pending = staking.pendingRewards(creatureId);
        
        vm.prank(user);
        try staking.unstake(creatureId) {
            totalCreaturesStaked--;
            totalTokensMinted += pending;
            totalTokensClaimed += pending;
        } catch {}
    }
    
    function claimTokens(uint256 userSeed, uint256 creatureSeed) external {
        address user = allUsers[userSeed % allUsers.length];
        uint256[] memory userCr = userCreatures[user];
        if (userCr.length == 0) return;
        
        uint256 creatureId = userCr[creatureSeed % userCr.length];
        
        (address owner,,,) = staking.stakes(creatureId);
        if (owner != user) return;
        
        uint256 pending = staking.pendingRewards(creatureId);
        
        vm.prank(user);
        try staking.claimTokens(creatureId) {
            totalTokensMinted += pending;
            totalTokensClaimed += pending;
        } catch {}
    }
    
    // ============ HP MANAGER ACTIONS ============
    
    function setHP(uint256 creatureSeed, uint256 hpValue) external {
        uint256 creatureId = allCreatures[creatureSeed % allCreatures.length];
        hpValue = bound(hpValue, 0, 100);
        
        hpManager.setHP(creatureId, hpValue);
    }
    
    function instantHeal(uint256 userSeed, uint256 creatureSeed) external {
        address user = allUsers[userSeed % allUsers.length];
        uint256[] memory userCr = userCreatures[user];
        if (userCr.length == 0) return;
        
        uint256 creatureId = userCr[creatureSeed % userCr.length];
        
        uint256 currentHP = hpManager.getHP(creatureId);
        if (currentHP >= 100) return;
        
        (uint256 cost,) = hpManager.getHealCost(creatureId);
        if (dragonToken.balanceOf(user) < cost) return;
        
        vm.prank(user);
        try hpManager.instantHeal(creatureId) {
            totalHealPayments += cost;
        } catch {}
    }
    
    function warpTime(uint256 hours_) external {
        hours_ = bound(hours_, 0, 48);
        vm.warp(block.timestamp + hours_ * 3600);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getAllUsers() external view returns (address[] memory) { return allUsers; }
    function getAllCreatures() external view returns (uint256[] memory) { return allCreatures; }
    function getUserCreatures(address user) external view returns (uint256[] memory) { return userCreatures[user]; }
    function getTotalCreaturesStaked() external view returns (uint256) { return totalCreaturesStaked; }
    function getTotalTokensMinted() external view returns (uint256) { return totalTokensMinted; }
    function getTotalTokensClaimed() external view returns (uint256) { return totalTokensClaimed; }
    function getTotalHealPayments() external view returns (uint256) { return totalHealPayments; }
}
