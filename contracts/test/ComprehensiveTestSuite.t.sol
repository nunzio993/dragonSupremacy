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
 * @title ComprehensiveTestSuite
 * @notice Complete test coverage: legitimate, malicious, anomalous, borderline, inverted
 * @dev Run with: forge test --match-contract ComprehensiveTestSuite -vvv
 */
contract ComprehensiveTestSuite is Test {
    
    // ============ Contracts ============
    BattleGateV2 public battleGate;
    DragonStaking public staking;
    HPManager public hpManager;
    DragonToken public dragonToken;
    GameConfig public gameConfig;
    RMRKCreature public creature;
    
    // ============ Test Addresses ============
    address public owner;
    address public backend;
    address public treasury;
    address public alice;
    address public bob;
    address public charlie;
    uint256 public backendKey;
    
    // ============ Test Creatures ============
    uint256 public creature1;
    uint256 public creature2;
    uint256 public creature3;
    
    function setUp() public {
        // Start at a safe timestamp to prevent underflow in tests
        vm.warp(1 days);
        
        owner = address(this);
        backend = vm.addr(1);
        backendKey = 1;
        treasury = makeAddr("treasury");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
        
        // Deploy contracts
        dragonToken = new DragonToken();
        gameConfig = new GameConfig();
        creature = new RMRKCreature();
        
        battleGate = new BattleGateV2(
            address(dragonToken),
            backend,
            treasury,
            address(creature)
        );
        
        staking = new DragonStaking(
            address(gameConfig),
            address(dragonToken),
            address(creature)
        );
        
        hpManager = new HPManager(
            address(dragonToken),
            treasury
        );
        
        // Setup permissions
        dragonToken.setMinter(address(this), true);
        dragonToken.setMinter(address(staking), true);
        creature.setMinter(address(this), true);
        hpManager.setHPUpdater(address(this), true);
        
        // Setup test users
        _setupUser(alice, 1);
        _setupUser(bob, 2);
        _setupUser(charlie, 3);
        
        creature1 = 1;
        creature2 = 2;
        creature3 = 3;
    }
    
    function _setupUser(address user, uint256 creatureId) internal {
        dragonToken.mint(user, 10000 ether);
        _mintCreature(user, creatureId);
        
        vm.prank(user);
        dragonToken.approve(address(battleGate), type(uint256).max);
        
        vm.prank(user);
        dragonToken.approve(address(hpManager), type(uint256).max);
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
            0x3C3C3C3C3C3C3C3C3C,
            0x0064006400640064006400640064006400,
            moves,
            2,
            mastery,
            0x5050505050505050
        );
    }
    
    function _createSignature(bytes32 battleId, address winner, uint256 timestamp) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(abi.encodePacked(
            battleId, winner, timestamp, block.chainid
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(backendKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }
    
    // ========================================================================
    // SECTION 1: LEGITIMATE SEQUENCES
    // ========================================================================
    
    /// @notice TC-L1: Complete standard flow
    function test_TC_L1_CompleteStandardFlow() public {
        // 1. Alice creates battle
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        
        // 2. Bob joins
        vm.prank(bob);
        battleGate.joinBattle(battleId, creature2);
        
        // 3. Backend resolves (Alice wins)
        uint256 timestamp = block.timestamp;
        bytes memory sig = _createSignature(battleId, alice, timestamp);
        battleGate.resolveBattle(battleId, alice, timestamp, sig);
        
        // 4. Alice claims
        uint256 aliceBalanceBefore = dragonToken.balanceOf(alice);
        vm.prank(alice);
        battleGate.claimWinnings(battleId);
        
        // Verify: Alice receives 190 (200 - 5% fee)
        uint256 aliceBalanceAfter = dragonToken.balanceOf(alice);
        assertEq(aliceBalanceAfter - aliceBalanceBefore, 190 ether, "Alice should receive 190 DGNE");
        
        // Verify: Treasury receives 10 (5% fee)
        assertEq(dragonToken.balanceOf(treasury), 10 ether, "Treasury should receive 10 DGNE");
    }
    
    /// @notice TC-L2: Cancel after lockout
    function test_TC_L2_CancelAfterLockout() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        
        // Wait past CANCEL_LOCKOUT (30 seconds)
        vm.warp(block.timestamp + 31);
        
        uint256 aliceBefore = dragonToken.balanceOf(alice);
        vm.prank(alice);
        battleGate.cancelBattle(battleId);
        
        uint256 aliceAfter = dragonToken.balanceOf(alice);
        // Should receive 99 (100 - 1% cancel fee)
        assertEq(aliceAfter - aliceBefore, 99 ether, "Alice should receive 99 DGNE after cancel");
    }
    
    /// @notice TC-L3: Host timeout refund
    function test_TC_L3_HostTimeoutRefund() public {
        uint256 aliceBefore = dragonToken.balanceOf(alice);
        
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        
        // Wait past HOST_TIMEOUT (10 minutes)
        vm.warp(block.timestamp + 11 minutes);
        
        vm.prank(alice);
        battleGate.claimHostTimeout(battleId);
        
        uint256 aliceAfter = dragonToken.balanceOf(alice);
        // Full refund
        assertEq(aliceAfter, aliceBefore, "Alice should get full refund");
    }
    
    // ========================================================================
    // SECTION 2: MALICIOUS SEQUENCES (Expected Reverts)
    // ========================================================================
    
    /// @notice TC-M1: Double claim attack
    function test_TC_M1_DoubleClaimAttack() public {
        // Setup: complete battle
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        vm.prank(bob);
        battleGate.joinBattle(battleId, creature2);
        bytes memory sig = _createSignature(battleId, alice, block.timestamp);
        battleGate.resolveBattle(battleId, alice, block.timestamp, sig);
        
        // First claim succeeds
        vm.prank(alice);
        battleGate.claimWinnings(battleId);
        
        // Second claim should revert
        vm.prank(alice);
        vm.expectRevert(BattleNotResolved.selector);
        battleGate.claimWinnings(battleId);
    }
    
    /// @notice TC-M2: Claim as non-winner
    function test_TC_M2_ClaimAsNonWinner() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        vm.prank(bob);
        battleGate.joinBattle(battleId, creature2);
        bytes memory sig = _createSignature(battleId, alice, block.timestamp);
        battleGate.resolveBattle(battleId, alice, block.timestamp, sig);
        
        // Bob tries to claim (Alice won)
        vm.prank(bob);
        vm.expectRevert(NotTheWinner.selector);
        battleGate.claimWinnings(battleId);
    }
    
    /// @notice TC-M3: Signature replay
    function test_TC_M3_SignatureReplay() public {
        // Battle 1
        vm.prank(alice);
        bytes32 battleId1 = battleGate.createBattle(creature1, 100 ether);
        vm.prank(bob);
        battleGate.joinBattle(battleId1, creature2);
        
        uint256 timestamp = block.timestamp;
        bytes memory sig = _createSignature(battleId1, alice, timestamp);
        battleGate.resolveBattle(battleId1, alice, timestamp, sig);
        
        // Try to reuse same signature
        vm.expectRevert(SignatureAlreadyUsed.selector);
        battleGate.resolveBattle(battleId1, alice, timestamp, sig);
    }
    
    /// @notice TC-M4: Expired signature
    function test_TC_M4_ExpiredSignature() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        vm.prank(bob);
        battleGate.joinBattle(battleId, creature2);
        
        // Create signature with old timestamp
        uint256 oldTimestamp = block.timestamp - 6 minutes;
        bytes memory sig = _createSignature(battleId, alice, oldTimestamp);
        
        vm.expectRevert(SignatureExpired.selector);
        battleGate.resolveBattle(battleId, alice, oldTimestamp, sig);
    }
    
    /// @notice TC-M5: Join own battle
    function test_TC_M5_JoinOwnBattle() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        
        vm.prank(alice);
        vm.expectRevert(CannotJoinOwnBattle.selector);
        battleGate.joinBattle(battleId, creature1);
    }
    
    /// @notice TC-M6: Join after timeout
    function test_TC_M6_JoinAfterTimeout() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        
        // Wait past HOST_TIMEOUT
        vm.warp(block.timestamp + 11 minutes);
        
        vm.prank(bob);
        vm.expectRevert(BattleExpiredError.selector);
        battleGate.joinBattle(battleId, creature2);
    }
    
    /// @notice TC-M7: Cancel too early
    function test_TC_M7_CancelTooEarly() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        
        // Try to cancel immediately (before CANCEL_LOCKOUT)
        vm.prank(alice);
        vm.expectRevert(CancelLockoutNotPassed.selector);
        battleGate.cancelBattle(battleId);
    }
    
    /// @notice TC-M8: Cancel as non-host
    function test_TC_M8_CancelAsNonHost() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        
        vm.warp(block.timestamp + 31);
        
        vm.prank(bob);
        vm.expectRevert(NotHost.selector);
        battleGate.cancelBattle(battleId);
    }
    
    // ========================================================================
    // SECTION 3: ANOMALOUS INPUTS
    // ========================================================================
    
    /// @notice TC-A1: Stake below minimum
    function test_TC_A1_StakeBelowMinimum() public {
        vm.prank(alice);
        vm.expectRevert(InvalidStakeAmount.selector);
        battleGate.createBattle(creature1, 9 ether);
    }
    
    /// @notice TC-A2: Stake above maximum
    function test_TC_A2_StakeAboveMaximum() public {
        vm.prank(alice);
        vm.expectRevert(InvalidStakeAmount.selector);
        battleGate.createBattle(creature1, 1001 ether);
    }
    
    /// @notice TC-A3: Stake = 0
    function test_TC_A3_StakeZero() public {
        vm.prank(alice);
        vm.expectRevert(InvalidStakeAmount.selector);
        battleGate.createBattle(creature1, 0);
    }
    
    /// @notice TC-A4: Stake = max uint256
    function test_TC_A4_StakeMaxUint() public {
        vm.prank(alice);
        vm.expectRevert(InvalidStakeAmount.selector);
        battleGate.createBattle(creature1, type(uint256).max);
    }
    
    /// @notice TC-A5: Battle ID non-existent
    function test_TC_A5_NonExistentBattleId() public {
        vm.prank(bob);
        vm.expectRevert(BattleNotOpen.selector);
        battleGate.joinBattle(bytes32(0), creature2);
    }
    
    /// @notice TC-A6: Creature not owned
    function test_TC_A6_CreatureNotOwned() public {
        // Alice owns creature1, Bob tries to use it
        vm.prank(bob);
        vm.expectRevert(NotCreatureOwner.selector);
        battleGate.createBattle(creature1, 100 ether);
    }
    
    // ========================================================================
    // SECTION 4: BORDERLINE STATES
    // ========================================================================
    
    /// @notice TC-B1: Stake exactly minimum
    function test_TC_B1_StakeExactlyMinimum() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 10 ether);
        
        BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
        assertEq(battle.stakeAmount, 10 ether, "Stake should be exactly minimum");
    }
    
    /// @notice TC-B2: Stake exactly maximum
    function test_TC_B2_StakeExactlyMaximum() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 1000 ether);
        
        BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
        assertEq(battle.stakeAmount, 1000 ether, "Stake should be exactly maximum");
    }
    
    /// @notice TC-B3: Cancel exactly at lockout
    function test_TC_B3_CancelExactlyAtLockout() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        
        // Warp to exactly CANCEL_LOCKOUT (30 seconds)
        vm.warp(block.timestamp + 30);
        
        // Should succeed at exactly 30 seconds
        vm.prank(alice);
        battleGate.cancelBattle(battleId);
    }
    
    /// @notice TC-B4: Cancel 1 second before lockout
    function test_TC_B4_CancelOneSecondBeforeLockout() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        
        // Warp to 29 seconds (1 second before CANCEL_LOCKOUT)
        vm.warp(block.timestamp + 29);
        
        // Should fail
        vm.prank(alice);
        vm.expectRevert(CancelLockoutNotPassed.selector);
        battleGate.cancelBattle(battleId);
    }
    
    /// @notice TC-B5: Join exactly at timeout (should fail - >= check)
    function test_TC_B5_JoinExactlyAtTimeout() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        
        // Warp to exactly HOST_TIMEOUT (10 minutes = 600 seconds)
        vm.warp(block.timestamp + 600);
        
        // Should fail (>= check means exactly at timeout fails)
        vm.prank(bob);
        vm.expectRevert(BattleExpiredError.selector);
        battleGate.joinBattle(battleId, creature2);
    }
    
    /// @notice TC-B6: Signature exactly at expiry limit
    function test_TC_B6_SignatureExactlyAtExpiryLimit() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        vm.prank(bob);
        battleGate.joinBattle(battleId, creature2);
        
        // Signature with timestamp 5 minutes ago (exactly at limit - should fail)
        uint256 timestamp = block.timestamp - 5 minutes;
        bytes memory sig = _createSignature(battleId, alice, timestamp);
        
        // Should fail (timestamp <= block.timestamp - 5 minutes)
        vm.expectRevert(SignatureExpired.selector);
        battleGate.resolveBattle(battleId, alice, timestamp, sig);
    }
    
    // ========================================================================
    // SECTION 5: INVERTED CALL ORDERS
    // ========================================================================
    
    /// @notice TC-O1: Claim before resolve
    function test_TC_O1_ClaimBeforeResolve() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        vm.prank(bob);
        battleGate.joinBattle(battleId, creature2);
        
        // Try to claim without resolving
        vm.prank(alice);
        vm.expectRevert(BattleNotResolved.selector);
        battleGate.claimWinnings(battleId);
    }
    
    /// @notice TC-O2: Resolve before match
    function test_TC_O2_ResolveBeforeMatch() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        
        // Try to resolve without guest
        bytes memory sig = _createSignature(battleId, alice, block.timestamp);
        
        vm.expectRevert(BattleNotInProgress.selector);
        battleGate.resolveBattle(battleId, alice, block.timestamp, sig);
    }
    
    /// @notice TC-O3: Join before create (non-existent battle)
    function test_TC_O3_JoinBeforeCreate() public {
        bytes32 fakeBattleId = keccak256("fake");
        
        vm.prank(bob);
        vm.expectRevert(BattleNotOpen.selector);
        battleGate.joinBattle(fakeBattleId, creature2);
    }
    
    /// @notice TC-O4: Cancel after match
    function test_TC_O4_CancelAfterMatch() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        vm.prank(bob);
        battleGate.joinBattle(battleId, creature2);
        
        vm.warp(block.timestamp + 31);
        
        // Try to cancel after guest joined
        vm.prank(alice);
        vm.expectRevert(CannotCancel.selector);
        battleGate.cancelBattle(battleId);
    }
    
    /// @notice TC-O5: HostTimeout before timeout
    function test_TC_O5_HostTimeoutBeforeTimeout() public {
        vm.prank(alice);
        bytes32 battleId = battleGate.createBattle(creature1, 100 ether);
        
        // Wait only 5 minutes (less than HOST_TIMEOUT)
        vm.warp(block.timestamp + 5 minutes);
        
        vm.prank(alice);
        vm.expectRevert(TimeoutNotReached.selector);
        battleGate.claimHostTimeout(battleId);
    }
    
    // ========================================================================
    // SECTION 6: DRAGON STAKING TESTS
    // ========================================================================
    
    /// @notice TC-DS-L1: Stake and unstake
    function test_TC_DS_L1_StakeAndUnstake() public {
        // Approve staking contract for creature transfer
        vm.prank(alice);
        creature.setApprovalForAll(address(staking), true);
        
        // Stake
        vm.prank(alice);
        staking.stake(creature1);
        
        // Wait 1 day
        vm.warp(block.timestamp + 1 days);
        
        // Unstake
        uint256 tokensBefore = dragonToken.balanceOf(alice);
        vm.prank(alice);
        staking.unstake(creature1);
        uint256 tokensAfter = dragonToken.balanceOf(alice);
        
        // Should have earned tokens
        assertGt(tokensAfter, tokensBefore, "Should have earned tokens");
    }
    
    /// @notice TC-DS-M1: Double stake
    function test_TC_DS_M1_DoubleStake() public {
        vm.prank(alice);
        creature.setApprovalForAll(address(staking), true);
        
        vm.prank(alice);
        staking.stake(creature1);
        
        vm.prank(alice);
        vm.expectRevert(AlreadyStaked.selector);
        staking.stake(creature1);
    }
    
    /// @notice TC-DS-M2: Unstake not owner
    function test_TC_DS_M2_UnstakeNotOwner() public {
        vm.prank(alice);
        creature.setApprovalForAll(address(staking), true);
        
        vm.prank(alice);
        staking.stake(creature1);
        
        vm.prank(bob);
        vm.expectRevert(NotStakeOwner.selector);
        staking.unstake(creature1);
    }
    
    // ========================================================================
    // SECTION 7: HP MANAGER TESTS
    // ========================================================================
    
    /// @notice TC-HP-L1: Heal complete
    function test_TC_HP_L1_HealComplete() public {
        // Set HP to 50
        hpManager.setHP(creature1, 50);
        
        uint256 treasuryBefore = dragonToken.balanceOf(treasury);
        
        // Alice heals
        vm.prank(alice);
        hpManager.instantHeal(creature1);
        
        // HP should be 100
        assertEq(hpManager.getHP(creature1), 100, "HP should be 100");
        
        // Treasury should receive payment
        uint256 treasuryAfter = dragonToken.balanceOf(treasury);
        assertGt(treasuryAfter, treasuryBefore, "Treasury should receive payment");
    }
    
    /// @notice TC-HP-M1: SetHP unauthorized
    function test_TC_HP_M1_SetHPUnauthorized() public {
        vm.prank(bob);
        vm.expectRevert("Not authorized to update HP");
        hpManager.setHP(creature1, 50);
    }
    
    /// @notice TC-HP-M2: Heal at full HP
    function test_TC_HP_M2_HealAtFullHP() public {
        // New creature has 100 HP
        vm.prank(alice);
        vm.expectRevert("Already at full HP");
        hpManager.instantHeal(creature1);
    }
    
    /// @notice TC-HP-A1: SetHP > 100
    function test_TC_HP_A1_SetHPOver100() public {
        vm.expectRevert("HP cannot exceed 100");
        hpManager.setHP(creature1, 101);
    }
    
    // ========================================================================
    // SECTION 8: TIMELOCK TESTS
    // ========================================================================
    
    /// @notice TC-TL-L1: Complete backend change with timelock
    function test_TC_TL_L1_CompleteBackendChange() public {
        address newBackend = makeAddr("newBackend");
        
        // Propose
        battleGate.proposeBackend(newBackend);
        
        // Wait 48 hours
        vm.warp(block.timestamp + 48 hours);
        
        // Execute
        battleGate.executeBackendChange();
        
        assertEq(battleGate.trustedBackend(), newBackend, "Backend should be changed");
    }
    
    /// @notice TC-TL-M1: Execute too early
    function test_TC_TL_M1_ExecuteTooEarly() public {
        address newBackend = makeAddr("newBackend");
        
        battleGate.proposeBackend(newBackend);
        
        // Wait only 47 hours
        vm.warp(block.timestamp + 47 hours);
        
        vm.expectRevert("Timelock not expired");
        battleGate.executeBackendChange();
    }
    
    /// @notice TC-TL-M2: Execute without propose
    function test_TC_TL_M2_ExecuteWithoutPropose() public {
        vm.expectRevert("No pending backend");
        battleGate.executeBackendChange();
    }
    
    /// @notice TC-TL-M3: Execute from non-owner
    function test_TC_TL_M3_ExecuteFromNonOwner() public {
        address newBackend = makeAddr("newBackend");
        
        battleGate.proposeBackend(newBackend);
        vm.warp(block.timestamp + 48 hours);
        
        vm.prank(alice);
        vm.expectRevert();
        battleGate.executeBackendChange();
    }
}
