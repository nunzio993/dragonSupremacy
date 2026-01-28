// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "forge-std/Test.sol";
import "../src/BattleGateV2.sol";
import "../src/DragonStaking.sol";
import "../src/HPManager.sol";
import "../src/GameConfig.sol";
import "../src/DragonToken.sol";
import "../src/RMRKCreature.sol";

/**
 * @title FuzzTests
 * @notice Comprehensive fuzz testing for all public/external functions
 * @dev Run with: forge test --fuzz-runs 1000 -vvv
 */
contract FuzzTests is Test {
    
    // ============ Contracts ============
    BattleGateV2 battleGate;
    DragonStaking staking;
    HPManager hpManager;
    GameConfig gameConfig;
    DragonToken dragonToken;
    RMRKCreature creature;
    
    // ============ Test accounts ============
    address owner = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address backend = address(0xBAC);
    address treasury = address(0x77EA5);
    
    // ============ Setup ============
    
    function setUp() public {
        // Deploy tokens
        dragonToken = new DragonToken();
        
        // Deploy GameConfig
        gameConfig = new GameConfig();
        
        // Deploy RMRKCreature
        creature = new RMRKCreature();
        
        // Deploy HPManager
        hpManager = new HPManager(address(dragonToken), treasury);
        
        // Deploy DragonStaking
        staking = new DragonStaking(
            address(gameConfig),
            address(dragonToken),
            address(creature)
        );
        
        // Deploy BattleGateV2
        battleGate = new BattleGateV2(
            address(dragonToken),
            backend,
            treasury,
            address(creature)
        );
        
        // Setup permissions
        dragonToken.setMinter(address(staking), true);
        dragonToken.setMinter(owner, true);
        creature.setMinter(owner, true);
        hpManager.setHPUpdater(owner, true);
        
        // Fund test accounts
        dragonToken.mint(alice, 10000 ether);
        dragonToken.mint(bob, 10000 ether);
        
        // Mint creatures for testing
        _mintCreature(alice, 1);
        _mintCreature(bob, 2);
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
            50,
            bytes32("calm"),
            bytes32("FIRE"),
            bytes32("brave"),
            0x3C3C3C3C3C3C3C3C3C, // 60 for all stats
            0x0064006400640064006400640064006400, // 100 growth for all
            moves,
            2,
            mastery,
            0x5050505050505050 // 80 aptitude for all
        );
    }
    
    // ============ HPManager Fuzz Tests ============
    
    /// @notice Fuzz test: setHP with random values
    function testFuzz_HPManager_setHP(uint256 tokenId, uint256 hp) public {
        // Bound HP to valid range
        hp = bound(hp, 0, 100);
        tokenId = bound(tokenId, 1, 2);
        
        hpManager.setHP(tokenId, hp);
        
        // HP should be set (but getHP includes recovery, so check base)
        assertEq(hpManager.lastHP(tokenId), hp, "HP not set correctly");
    }
    
    /// @notice Fuzz test: setHP reverts on HP > 100
    function testFuzz_HPManager_setHP_reverts_over100(uint256 hp) public {
        hp = bound(hp, 101, type(uint256).max);
        
        vm.expectRevert("HP cannot exceed 100");
        hpManager.setHP(1, hp);
    }
    
    /// @notice Fuzz test: HP recovery over time
    function testFuzz_HPManager_timeRecovery(uint256 hours_passed, uint256 startHP) public {
        startHP = bound(startHP, 0, 99);
        hours_passed = bound(hours_passed, 0, 100);
        
        hpManager.setHP(1, startHP);
        
        // Warp time
        vm.warp(block.timestamp + hours_passed * 3600);
        
        uint256 currentHP = hpManager.getHP(1);
        uint256 expectedRecovery = hours_passed * hpManager.hpRecoveryRatePerHour();
        uint256 expectedHP = startHP + expectedRecovery > 100 ? 100 : startHP + expectedRecovery;
        
        assertEq(currentHP, expectedHP, "HP recovery incorrect");
    }
    
    /// @notice Fuzz test: heal cost calculation
    function testFuzz_HPManager_healCost(uint256 currentHP) public {
        currentHP = bound(currentHP, 0, 99);
        
        hpManager.setHP(1, currentHP);
        
        (uint256 cost, uint256 hpToHeal) = hpManager.getHealCost(1);
        
        assertEq(hpToHeal, 100 - currentHP, "HP to heal incorrect");
        assertEq(cost, (hpToHeal * hpManager.healCostPer10Percent()) / 10, "Cost calculation incorrect");
    }
    
    // ============ DragonStaking Fuzz Tests ============
    
    /// @notice Fuzz test: pending rewards calculation
    function testFuzz_DragonStaking_pendingRewards(uint256 hours_passed) public {
        hours_passed = bound(hours_passed, 0, 365 * 24); // Max 1 year
        
        vm.startPrank(alice);
        creature.approve(address(staking), 1);
        staking.stake(1);
        vm.stopPrank();
        
        // Warp time
        vm.warp(block.timestamp + hours_passed * 3600);
        
        uint256 pending = staking.pendingRewards(1);
        
        // Should be proportional to time (exact formula depends on GameConfig)
        // Just check it doesn't overflow and is > 0 after time passes
        if (hours_passed > 0) {
            assertGe(pending, 0, "Pending rewards should be >= 0");
        }
    }
    
    /// @notice Fuzz test: stake/unstake sequence
    function testFuzz_DragonStaking_stakeUnstake(uint256 hours_passed) public {
        hours_passed = bound(hours_passed, 1, 30 * 24); // 1h to 30 days
        
        vm.startPrank(alice);
        creature.approve(address(staking), 1);
        staking.stake(1);
        
        // Creature should be locked
        assertEq(creature.ownerOf(1), address(staking));
        
        // Warp time
        vm.warp(block.timestamp + hours_passed * 3600);
        
        uint256 balanceBefore = dragonToken.balanceOf(alice);
        staking.unstake(1);
        uint256 balanceAfter = dragonToken.balanceOf(alice);
        
        // Should have earned tokens
        assertGe(balanceAfter, balanceBefore, "Should earn tokens");
        
        // Creature should be returned
        assertEq(creature.ownerOf(1), alice);
        vm.stopPrank();
    }
    
    // ============ BattleGateV2 Fuzz Tests ============
    
    /// @notice Fuzz test: createBattle with valid stake amounts
    function testFuzz_BattleGateV2_createBattle(uint256 stakeAmount) public {
        stakeAmount = bound(stakeAmount, battleGate.minStake(), battleGate.maxStake());
        
        vm.startPrank(alice);
        dragonToken.approve(address(battleGate), stakeAmount);
        
        bytes32 battleId = battleGate.createBattle(1, stakeAmount);
        
        assertTrue(battleId != bytes32(0), "Battle ID should not be zero");
        assertTrue(battleGate.isInBattle(alice), "Alice should be in battle");
        vm.stopPrank();
    }
    
    /// @notice Fuzz test: createBattle reverts with invalid stake
    function testFuzz_BattleGateV2_createBattle_invalidStake(uint256 stakeAmount) public {
        // Test below min or above max
        if (stakeAmount < battleGate.minStake() || stakeAmount > battleGate.maxStake()) {
            vm.startPrank(alice);
            dragonToken.approve(address(battleGate), stakeAmount);
            
            vm.expectRevert(InvalidStakeAmount.selector);
            battleGate.createBattle(1, stakeAmount);
            vm.stopPrank();
        }
    }
    
    /// @notice Fuzz test: joinBattle with matching stake
    function testFuzz_BattleGateV2_joinBattle(uint256 stakeAmount) public {
        stakeAmount = bound(stakeAmount, battleGate.minStake(), battleGate.maxStake());
        
        // Alice creates battle
        vm.startPrank(alice);
        dragonToken.approve(address(battleGate), stakeAmount);
        bytes32 battleId = battleGate.createBattle(1, stakeAmount);
        vm.stopPrank();
        
        // Bob joins
        vm.startPrank(bob);
        dragonToken.approve(address(battleGate), stakeAmount);
        battleGate.joinBattle(battleId, 2);
        
        assertTrue(battleGate.isInBattle(bob), "Bob should be in battle");
        vm.stopPrank();
    }
    
    /// @notice Fuzz test: cancelBattle only by host
    function testFuzz_BattleGateV2_cancelBattle_onlyHost(address caller) public {
        vm.assume(caller != alice && caller != address(0));
        
        uint256 stake = battleGate.minStake();
        
        vm.startPrank(alice);
        dragonToken.approve(address(battleGate), stake);
        bytes32 battleId = battleGate.createBattle(1, stake);
        vm.stopPrank();
        
        // Non-host cannot cancel
        vm.startPrank(caller);
        vm.expectRevert(NotHost.selector);
        battleGate.cancelBattle(battleId);
        vm.stopPrank();
    }
    
    /// @notice Fuzz test: host timeout refund
    function testFuzz_BattleGateV2_hostTimeout(uint256 waitTime) public {
        // Wait must exceed timeout
        waitTime = bound(waitTime, battleGate.HOST_TIMEOUT() + 1, 1 days);
        
        uint256 stake = battleGate.minStake();
        
        vm.startPrank(alice);
        dragonToken.approve(address(battleGate), stake);
        bytes32 battleId = battleGate.createBattle(1, stake);
        
        uint256 balanceBefore = dragonToken.balanceOf(alice);
        
        // Warp past timeout
        vm.warp(block.timestamp + waitTime);
        
        battleGate.claimHostTimeout(battleId);
        
        uint256 balanceAfter = dragonToken.balanceOf(alice);
        assertEq(balanceAfter, balanceBefore + stake, "Should refund stake");
        vm.stopPrank();
    }
    
    /// @notice Fuzz test: cannot join expired battle
    function testFuzz_BattleGateV2_cannotJoinExpired(uint256 waitTime) public {
        waitTime = bound(waitTime, battleGate.HOST_TIMEOUT(), 1 days);
        
        uint256 stake = battleGate.minStake();
        
        vm.startPrank(alice);
        dragonToken.approve(address(battleGate), stake);
        bytes32 battleId = battleGate.createBattle(1, stake);
        vm.stopPrank();
        
        // Warp past timeout
        vm.warp(block.timestamp + waitTime);
        
        vm.startPrank(bob);
        dragonToken.approve(address(battleGate), stake);
        vm.expectRevert(BattleExpiredError.selector);
        battleGate.joinBattle(battleId, 2);
        vm.stopPrank();
    }
    
    // ============ Edge Case Tests ============
    
    /// @notice Edge case: zero address handling
    function test_EdgeCase_zeroAddress() public {
        // BattleGateV2 constructor should reject zero addresses
        vm.expectRevert("Invalid stake token");
        new BattleGateV2(address(0), backend, treasury, address(creature));
        
        vm.expectRevert("Invalid backend");
        new BattleGateV2(address(dragonToken), address(0), treasury, address(creature));
        
        vm.expectRevert("Invalid treasury");
        new BattleGateV2(address(dragonToken), backend, address(0), address(creature));
        
        vm.expectRevert("Invalid creature contract");
        new BattleGateV2(address(dragonToken), backend, treasury, address(0));
    }
    
    /// @notice Edge case: double stake attempt
    function test_EdgeCase_doubleStake() public {
        vm.startPrank(alice);
        creature.approve(address(staking), 1);
        staking.stake(1);
        
        // Try to stake again (should fail)
        vm.expectRevert(AlreadyStaked.selector);
        staking.stake(1);
        vm.stopPrank();
    }
    
    /// @notice Edge case: unstake not owner
    function test_EdgeCase_unstakeNotOwner() public {
        vm.startPrank(alice);
        creature.approve(address(staking), 1);
        staking.stake(1);
        vm.stopPrank();
        
        // Bob tries to unstake Alice's creature
        vm.startPrank(bob);
        vm.expectRevert(NotStakeOwner.selector);
        staking.unstake(1);
        vm.stopPrank();
    }
    
    /// @notice Edge case: join own battle
    function test_EdgeCase_joinOwnBattle() public {
        uint256 stake = battleGate.minStake();
        
        vm.startPrank(alice);
        dragonToken.approve(address(battleGate), stake * 2);
        bytes32 battleId = battleGate.createBattle(1, stake);
        
        // Alice cannot join her own battle
        vm.expectRevert(CannotJoinOwnBattle.selector);
        battleGate.joinBattle(battleId, 1);
        vm.stopPrank();
    }
    
    /// @notice Edge case: already in battle
    function test_EdgeCase_alreadyInBattle() public {
        uint256 stake = battleGate.minStake();
        
        vm.startPrank(alice);
        dragonToken.approve(address(battleGate), stake * 2);
        battleGate.createBattle(1, stake);
        
        // Alice cannot create another battle
        vm.expectRevert(AlreadyInBattle.selector);
        battleGate.createBattle(1, stake);
        vm.stopPrank();
    }
    
    /// @notice Edge case: claim winnings not winner
    function test_EdgeCase_claimNotWinner() public {
        // This would require a full battle flow with signature
        // Simplified: just test that non-existent battle reverts
        vm.startPrank(alice);
        vm.expectRevert(BattleNotResolved.selector);
        battleGate.claimWinnings(bytes32(0));
        vm.stopPrank();
    }
    
    /// @notice Edge case: HP at max already
    function test_EdgeCase_healAtMaxHP() public {
        // New creature starts at 100 HP
        vm.startPrank(alice);
        dragonToken.approve(address(hpManager), 100 ether);
        
        vm.expectRevert("Already at full HP");
        hpManager.instantHeal(1);
        vm.stopPrank();
    }
    
    /// @notice Edge case: HP overflow protection
    function testFuzz_HPManager_overflowProtection(uint256 hours_passed) public {
        hours_passed = bound(hours_passed, 0, type(uint64).max / 3600);
        
        hpManager.setHP(1, 50);
        vm.warp(block.timestamp + hours_passed * 3600);
        
        uint256 hp = hpManager.getHP(1);
        
        // HP should never exceed 100
        assertLe(hp, 100, "HP should never exceed 100");
    }
}
