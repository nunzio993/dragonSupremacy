// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/BattleGateV2.sol";
import "../src/DragonStaking.sol";
import "../src/HPManager.sol";
import "../src/GameConfig.sol";
import "../src/DragonToken.sol";
import "../src/RMRKCreature.sol";

/**
 * @title AdvancedInvariantTests
 * @notice Enhanced invariant testing with attack scenarios
 * @dev Run with: forge test --match-contract AdvancedInvariantTests --fuzz-runs 1000 -vvv
 * 
 * ENHANCED SCENARIOS:
 * - 20 users (vs 5 before)
 * - Timeout exploitation attempts
 * - Signature replay attempts  
 * - Concurrent battle attempts
 * - Emergency refund edge cases
 * - Stake boundary testing (min/max)
 */
contract AdvancedInvariantTests is Test {
    
    // ============ Contracts ============
    BattleGateV2 public battleGate;
    DragonStaking public staking;
    DragonToken public dragonToken;
    GameConfig public gameConfig;
    RMRKCreature public creature;
    
    // ============ Handler ============
    AdvancedBattleHandler public handler;
    
    // ============ Test addresses ============
    address public backend;
    address public treasury;
    
    function setUp() public {
        backend = makeAddr("backend");
        treasury = makeAddr("treasury");
        
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
        
        // Setup permissions
        dragonToken.setMinter(address(this), true);
        dragonToken.setMinter(address(staking), true);
        creature.setMinter(address(this), true);
        
        // Deploy handler
        handler = new AdvancedBattleHandler(
            battleGate,
            dragonToken,
            creature,
            backend,
            treasury
        );
        
        // Setup permissions for handler BEFORE initialization
        dragonToken.setMinter(address(handler), true);
        creature.setMinter(address(handler), true);
        
        // Now initialize the handler (creates test actors)
        handler.initialize();
        
        // Target the handler for invariant testing
        targetContract(address(handler));
    }
    
    // ============ INVARIANT 1: Fund Conservation ============
    function invariant_fundConservation() public view {
        uint256 contractBalance = dragonToken.balanceOf(address(battleGate));
        uint256 activeStakes = handler.totalActiveStakes();
        
        assertGe(
            contractBalance,
            activeStakes,
            "INVARIANT VIOLATED: Contract balance < active stakes"
        );
    }
    
    // ============ INVARIANT 2: Prize Correctness ============
    function invariant_prizeCorrectness() public view {
        bytes32[] memory resolvedBattles = handler.getResolvedBattles();
        
        for (uint256 i = 0; i < resolvedBattles.length; i++) {
            bytes32 battleId = resolvedBattles[i];
            BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
            
            if (battle.state == BattleGateV2.BattleState.CLAIMED) {
                uint256 totalPot = battle.stakeAmount * 2;
                uint256 expectedFee = (totalPot * battleGate.PLATFORM_FEE_BPS()) / battleGate.BPS_DENOMINATOR();
                uint256 expectedPrize = totalPot - expectedFee;
                
                uint256 actualPrize = handler.getPrizePaid(battleId);
                assertEq(actualPrize, expectedPrize, "INVARIANT VIOLATED: Prize calculation incorrect");
            }
        }
    }
    
    // ============ INVARIANT 3: No Double Distribution ============
    function invariant_noDoubleDistribution() public view {
        bytes32[] memory allBattles = handler.getAllBattles();
        
        for (uint256 i = 0; i < allBattles.length; i++) {
            bytes32 battleId = allBattles[i];
            uint256 claimCount = handler.getClaimCount(battleId);
            
            assertLe(claimCount, 1, "INVARIANT VIOLATED: Battle claimed more than once");
        }
    }
    
    // ============ INVARIANT 4: Terminal State Consistency ============
    function invariant_terminalStateConsistency() public view {
        bytes32[] memory terminalBattles = handler.getTerminalBattles();
        
        for (uint256 i = 0; i < terminalBattles.length; i++) {
            bytes32 battleId = terminalBattles[i];
            BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
            BattleGateV2.BattleState recordedState = handler.getRecordedTerminalState(battleId);
            
            assertEq(uint256(battle.state), uint256(recordedState), "INVARIANT VIOLATED: Terminal state changed");
        }
    }
    
    // ============ INVARIANT 5: Wallet Lock Consistency ============
    function invariant_walletLockConsistency() public view {
        address[] memory users = handler.getAllUsers();
        
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            bytes32 userBattle = battleGate.walletInBattle(user);
            
            if (userBattle != bytes32(0)) {
                BattleGateV2.Battle memory battle = battleGate.getBattle(userBattle);
                
                assertTrue(
                    battle.host == user || battle.guest == user,
                    "INVARIANT VIOLATED: Wallet locked in wrong battle"
                );
                
                assertTrue(
                    battle.state != BattleGateV2.BattleState.CLAIMED &&
                    battle.state != BattleGateV2.BattleState.EXPIRED,
                    "INVARIANT VIOLATED: Wallet locked in terminal battle"
                );
            }
        }
    }
    
    // ============ INVARIANT 6: Creature Lock Consistency ============
    function invariant_creatureLockConsistency() public view {
        uint256[] memory creatures = handler.getAllCreatures();
        
        for (uint256 i = 0; i < creatures.length; i++) {
            uint256 creatureId = creatures[i];
            bytes32 creatureBattle = battleGate.creatureInBattle(creatureId);
            
            if (creatureBattle != bytes32(0)) {
                BattleGateV2.Battle memory battle = battleGate.getBattle(creatureBattle);
                
                assertTrue(
                    battle.hostCreatureId == creatureId || battle.guestCreatureId == creatureId,
                    "INVARIANT VIOLATED: Creature locked in wrong battle"
                );
            }
        }
    }
    
    // ============ INVARIANT 7: Treasury Fee Accumulation ============
    function invariant_treasuryFeeCorrectness() public view {
        uint256 treasuryBalance = dragonToken.balanceOf(treasury);
        uint256 expectedFees = handler.totalFeesCollected();
        
        assertEq(treasuryBalance, expectedFees, "INVARIANT VIOLATED: Treasury fees mismatch");
    }
    
    // ============ INVARIANT 8: No Signature Replay ============
    function invariant_noSignatureReplay() public view {
        bytes32[] memory usedSigs = handler.getUsedSignatures();
        
        for (uint256 i = 0; i < usedSigs.length; i++) {
            for (uint256 j = i + 1; j < usedSigs.length; j++) {
                assertTrue(usedSigs[i] != usedSigs[j], "INVARIANT VIOLATED: Duplicate signature used");
            }
        }
    }
    
    // ============ INVARIANT 9: Battle State Machine ============
    function invariant_validStateTransitions() public view {
        bytes32[] memory allBattles = handler.getAllBattles();
        
        for (uint256 i = 0; i < allBattles.length; i++) {
            bytes32 battleId = allBattles[i];
            BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
            
            // Valid states only
            assertTrue(
                uint256(battle.state) <= 5,
                "INVARIANT VIOLATED: Invalid battle state"
            );
            
            // MATCHED requires guest
            if (battle.state == BattleGateV2.BattleState.MATCHED ||
                battle.state == BattleGateV2.BattleState.RESOLVED ||
                battle.state == BattleGateV2.BattleState.CLAIMED) {
                assertTrue(battle.guest != address(0), "INVARIANT VIOLATED: MATCHED state without guest");
            }
            
            // RESOLVED/CLAIMED requires winner
            if (battle.state == BattleGateV2.BattleState.RESOLVED ||
                battle.state == BattleGateV2.BattleState.CLAIMED) {
                assertTrue(
                    battle.winner == battle.host || battle.winner == battle.guest,
                    "INVARIANT VIOLATED: Invalid winner"
                );
            }
        }
    }
    
    // ============ INVARIANT 10: Stake Boundaries ============
    function invariant_stakeBoundaries() public view {
        bytes32[] memory allBattles = handler.getAllBattles();
        
        for (uint256 i = 0; i < allBattles.length; i++) {
            bytes32 battleId = allBattles[i];
            BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
            
            if (battle.state != BattleGateV2.BattleState.NONE) {
                assertGe(battle.stakeAmount, battleGate.minStake(), "INVARIANT VIOLATED: Stake below minimum");
                assertLe(battle.stakeAmount, battleGate.maxStake(), "INVARIANT VIOLATED: Stake above maximum");
            }
        }
    }
}

/**
 * @title AdvancedBattleHandler
 * @notice Enhanced handler with attack scenarios
 */
contract AdvancedBattleHandler is Test {
    BattleGateV2 public battleGate;
    DragonToken public dragonToken;
    RMRKCreature public creature;
    address public backend;
    address public treasury;
    
    // State tracking
    bytes32[] public allBattles;
    bytes32[] public resolvedBattles;
    bytes32[] public terminalBattles;
    address[] public allUsers;
    uint256[] public allCreatures;
    bytes32[] public usedSignatures;
    
    mapping(bytes32 => uint256) public prizePaid;
    mapping(bytes32 => uint256) public claimCount;
    mapping(bytes32 => BattleGateV2.BattleState) public recordedTerminalState;
    
    uint256 public totalActiveStakes;
    uint256 public totalFeesCollected;
    uint256 public userCount;
    uint256 public creatureCount;
    bool public initialized;
    
    // Attack attempt counters
    uint256 public doubleClaimAttempts;
    uint256 public replayAttempts;
    uint256 public unauthorizedClaimAttempts;
    
    constructor(
        BattleGateV2 _battleGate,
        DragonToken _dragonToken,
        RMRKCreature _creature,
        address _backend,
        address _treasury
    ) {
        battleGate = _battleGate;
        dragonToken = _dragonToken;
        creature = _creature;
        backend = _backend;
        treasury = _treasury;
    }
    
    function initialize() external {
        require(!initialized, "Already initialized");
        initialized = true;
        _setupTestActors();
    }
    
    function _setupTestActors() internal {
        // Create 20 users with creatures and tokens (4x more than before)
        for (uint256 i = 1; i <= 20; i++) {
            address user = address(uint160(0x1000 + i));
            allUsers.push(user);
            
            dragonToken.mint(user, 1000000 ether); // 10x more tokens
            _mintCreature(user, i);
            allCreatures.push(i);
            
            vm.prank(user);
            dragonToken.approve(address(battleGate), type(uint256).max);
        }
        userCount = 20;
        creatureCount = 20;
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
            uint8(50 + (id % 50)), // Varying talents
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
    
    // ============ STANDARD ACTIONS ============
    
    function createBattle(uint256 userSeed, uint256 stakeSeed) external {
        address user = allUsers[userSeed % allUsers.length];
        uint256 creatureId = (userSeed % creatureCount) + 1;
        
        if (battleGate.walletInBattle(user) != bytes32(0)) return;
        if (battleGate.creatureInBattle(creatureId) != bytes32(0)) return;
        
        try creature.ownerOf(creatureId) returns (address owner) {
            if (owner != user) return;
        } catch { return; }
        
        uint256 stake = bound(stakeSeed, battleGate.minStake(), battleGate.maxStake());
        
        vm.prank(user);
        try battleGate.createBattle(creatureId, stake) returns (bytes32 battleId) {
            allBattles.push(battleId);
            totalActiveStakes += stake;
        } catch {}
    }
    
    function joinBattle(uint256 battleSeed, uint256 userSeed) external {
        if (allBattles.length == 0) return;
        
        bytes32 battleId = allBattles[battleSeed % allBattles.length];
        BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
        
        if (battle.state != BattleGateV2.BattleState.CREATED) return;
        
        address user = allUsers[userSeed % allUsers.length];
        uint256 creatureId = (userSeed % creatureCount) + 1;
        
        if (user == battle.host) return;
        if (battleGate.walletInBattle(user) != bytes32(0)) return;
        if (battleGate.creatureInBattle(creatureId) != bytes32(0)) return;
        
        try creature.ownerOf(creatureId) returns (address owner) {
            if (owner != user) return;
        } catch { return; }
        
        vm.prank(user);
        try battleGate.joinBattle(battleId, creatureId) {
            totalActiveStakes += battle.stakeAmount;
        } catch {}
    }
    
    function cancelBattle(uint256 battleSeed) external {
        if (allBattles.length == 0) return;
        
        bytes32 battleId = allBattles[battleSeed % allBattles.length];
        BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
        
        if (battle.state != BattleGateV2.BattleState.CREATED) return;
        
        uint256 treasuryBefore = dragonToken.balanceOf(treasury);
        
        vm.prank(battle.host);
        try battleGate.cancelBattle(battleId) {
            uint256 treasuryAfter = dragonToken.balanceOf(treasury);
            
            // Track the cancel fee sent to treasury
            totalFeesCollected += (treasuryAfter - treasuryBefore);
            totalActiveStakes -= battle.stakeAmount;
            terminalBattles.push(battleId);
            recordedTerminalState[battleId] = BattleGateV2.BattleState.EXPIRED;
        } catch {}
    }
    
    function resolveBattle(uint256 battleSeed, bool hostWins) external {
        if (allBattles.length == 0) return;
        
        bytes32 battleId = allBattles[battleSeed % allBattles.length];
        BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
        
        if (battle.state != BattleGateV2.BattleState.MATCHED) return;
        
        address winner = hostWins ? battle.host : battle.guest;
        uint256 timestamp = block.timestamp;
        
        bytes32 messageHash = keccak256(abi.encodePacked(
            battleId, winner, timestamp, block.chainid
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(uint160(backend)), ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        try battleGate.resolveBattle(battleId, winner, timestamp, signature) {
            resolvedBattles.push(battleId);
            usedSignatures.push(keccak256(signature));
        } catch {}
    }
    
    function claimWinnings(uint256 battleSeed) external {
        if (resolvedBattles.length == 0) return;
        
        bytes32 battleId = resolvedBattles[battleSeed % resolvedBattles.length];
        BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
        
        if (battle.state != BattleGateV2.BattleState.RESOLVED) return;
        
        uint256 balanceBefore = dragonToken.balanceOf(battle.winner);
        uint256 treasuryBefore = dragonToken.balanceOf(treasury);
        
        vm.prank(battle.winner);
        try battleGate.claimWinnings(battleId) {
            uint256 balanceAfter = dragonToken.balanceOf(battle.winner);
            uint256 treasuryAfter = dragonToken.balanceOf(treasury);
            
            prizePaid[battleId] = balanceAfter - balanceBefore;
            totalFeesCollected += (treasuryAfter - treasuryBefore);
            claimCount[battleId]++;
            totalActiveStakes -= battle.stakeAmount * 2;
            terminalBattles.push(battleId);
            recordedTerminalState[battleId] = BattleGateV2.BattleState.CLAIMED;
        } catch {}
    }
    
    // ============ ATTACK SCENARIOS ============
    
    /// @notice Try to claim winnings twice (should fail)
    function attackDoubleClaim(uint256 battleSeed) external {
        if (terminalBattles.length == 0) return;
        
        bytes32 battleId = terminalBattles[battleSeed % terminalBattles.length];
        BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
        
        if (battle.state != BattleGateV2.BattleState.CLAIMED) return;
        
        // Try to claim again - should fail
        vm.prank(battle.winner);
        try battleGate.claimWinnings(battleId) {
            // If this succeeds, it's a bug!
            claimCount[battleId]++;
        } catch {
            // Expected behavior
            doubleClaimAttempts++;
        }
    }
    
    /// @notice Try to replay a signature (should fail)
    function attackReplaySignature(uint256 battleSeed) external {
        if (resolvedBattles.length == 0) return;
        if (allBattles.length == 0) return;
        
        // Get a resolved battle's signature components
        bytes32 resolvedBattleId = resolvedBattles[battleSeed % resolvedBattles.length];
        BattleGateV2.Battle memory resolvedBattle = battleGate.getBattle(resolvedBattleId);
        
        // Try to use similar signature on a different MATCHED battle
        for (uint256 i = 0; i < allBattles.length; i++) {
            bytes32 targetBattleId = allBattles[i];
            BattleGateV2.Battle memory targetBattle = battleGate.getBattle(targetBattleId);
            
            if (targetBattle.state == BattleGateV2.BattleState.MATCHED) {
                // Try with old timestamp (should fail due to timestamp check)
                uint256 oldTimestamp = block.timestamp - 10 minutes;
                
                bytes32 messageHash = keccak256(abi.encodePacked(
                    targetBattleId, resolvedBattle.winner, oldTimestamp, block.chainid
                ));
                bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
                (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(uint160(backend)), ethSignedHash);
                bytes memory signature = abi.encodePacked(r, s, v);
                
                try battleGate.resolveBattle(targetBattleId, resolvedBattle.winner, oldTimestamp, signature) {
                    // If this succeeds unexpectedly with wrong winner, it's a bug
                } catch {
                    replayAttempts++;
                }
                break;
            }
        }
    }
    
    /// @notice Try to claim as non-winner (should fail)
    function attackUnauthorizedClaim(uint256 battleSeed, uint256 userSeed) external {
        if (resolvedBattles.length == 0) return;
        
        bytes32 battleId = resolvedBattles[battleSeed % resolvedBattles.length];
        BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
        
        if (battle.state != BattleGateV2.BattleState.RESOLVED) return;
        
        // Pick a user who is NOT the winner
        address attacker = allUsers[userSeed % allUsers.length];
        if (attacker == battle.winner) return;
        
        vm.prank(attacker);
        try battleGate.claimWinnings(battleId) {
            // If this succeeds, it's a critical bug!
            claimCount[battleId]++;
        } catch {
            // Expected behavior
            unauthorizedClaimAttempts++;
        }
    }
    
    /// @notice Try to join an expired battle
    function attackJoinExpiredBattle(uint256 battleSeed, uint256 userSeed) external {
        if (allBattles.length == 0) return;
        
        bytes32 battleId = allBattles[battleSeed % allBattles.length];
        BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
        
        if (battle.state != BattleGateV2.BattleState.CREATED) return;
        
        // Warp past timeout
        uint256 timeToWarp = battleGate.HOST_TIMEOUT() + 1;
        vm.warp(block.timestamp + timeToWarp);
        
        address user = allUsers[userSeed % allUsers.length];
        uint256 creatureId = (userSeed % creatureCount) + 1;
        
        if (user == battle.host) return;
        if (battleGate.walletInBattle(user) != bytes32(0)) return;
        
        vm.prank(user);
        try battleGate.joinBattle(battleId, creatureId) {
            // Should NOT succeed after timeout
            totalActiveStakes += battle.stakeAmount;
        } catch {
            // Expected - battle expired
        }
    }
    
    /// @notice Create battle with boundary stakes
    function createBattleWithBoundaryStake(uint256 userSeed, bool useMin) external {
        address user = allUsers[userSeed % allUsers.length];
        uint256 creatureId = (userSeed % creatureCount) + 1;
        
        if (battleGate.walletInBattle(user) != bytes32(0)) return;
        if (battleGate.creatureInBattle(creatureId) != bytes32(0)) return;
        
        try creature.ownerOf(creatureId) returns (address owner) {
            if (owner != user) return;
        } catch { return; }
        
        // Use exactly min or max stake
        uint256 stake = useMin ? battleGate.minStake() : battleGate.maxStake();
        
        vm.prank(user);
        try battleGate.createBattle(creatureId, stake) returns (bytes32 battleId) {
            allBattles.push(battleId);
            totalActiveStakes += stake;
        } catch {}
    }
    
    function warpTime(uint256 seconds_) external {
        seconds_ = bound(seconds_, 0, 2 days); // Extended time range
        vm.warp(block.timestamp + seconds_);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getAllBattles() external view returns (bytes32[] memory) { return allBattles; }
    function getResolvedBattles() external view returns (bytes32[] memory) { return resolvedBattles; }
    function getTerminalBattles() external view returns (bytes32[] memory) { return terminalBattles; }
    function getAllUsers() external view returns (address[] memory) { return allUsers; }
    function getAllCreatures() external view returns (uint256[] memory) { return allCreatures; }
    function getUsedSignatures() external view returns (bytes32[] memory) { return usedSignatures; }
    function getPrizePaid(bytes32 battleId) external view returns (uint256) { return prizePaid[battleId]; }
    function getClaimCount(bytes32 battleId) external view returns (uint256) { return claimCount[battleId]; }
    function getRecordedTerminalState(bytes32 battleId) external view returns (BattleGateV2.BattleState) { return recordedTerminalState[battleId]; }
}
