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
 * @title InvariantTests
 * @notice Invariant testing for critical protocol properties
 * @dev Run with: forge test --match-contract InvariantTests -vvv
 * 
 * Invariants tested:
 * 1. Fund Conservation: contract balance >= sum of all pending stakes
 * 2. Prize Correctness: winner receives exactly (2 * stake - fee)
 * 3. No Double Distribution: battle can only be claimed once
 * 4. Terminal State Consistency: resolved battles stay resolved
 */
contract InvariantTests is Test {
    
    // ============ Contracts ============
    BattleGateV2 public battleGate;
    DragonStaking public staking;
    DragonToken public dragonToken;
    GameConfig public gameConfig;
    RMRKCreature public creature;
    
    // ============ Handler ============
    BattleHandler public handler;
    
    // ============ Tracking for invariants ============
    uint256 public totalStakedInBattles;
    mapping(bytes32 => bool) public battlesClaimed;
    
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
        handler = new BattleHandler(
            battleGate,
            dragonToken,
            creature,
            backend
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
    /// @notice Contract balance must always be >= total stakes in active battles
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
    /// @notice Winner prize must be exactly (2 * stake) - platformFee
    function invariant_prizeCorrectness() public view {
        // Check all resolved battles have correct prize calculation
        bytes32[] memory resolvedBattles = handler.getResolvedBattles();
        
        for (uint256 i = 0; i < resolvedBattles.length; i++) {
            bytes32 battleId = resolvedBattles[i];
            BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
            
            if (battle.state == BattleGateV2.BattleState.CLAIMED) {
                uint256 totalPot = battle.stakeAmount * 2;
                uint256 expectedFee = (totalPot * battleGate.PLATFORM_FEE_BPS()) / battleGate.BPS_DENOMINATOR();
                uint256 expectedPrize = totalPot - expectedFee;
                
                // Verify the prize paid was correct
                uint256 actualPrize = handler.getPrizePaid(battleId);
                assertEq(
                    actualPrize,
                    expectedPrize,
                    "INVARIANT VIOLATED: Prize calculation incorrect"
                );
            }
        }
    }
    
    // ============ INVARIANT 3: No Double Distribution ============
    /// @notice A battle can only transition to CLAIMED once
    function invariant_noDoubleDistribution() public view {
        bytes32[] memory allBattles = handler.getAllBattles();
        
        for (uint256 i = 0; i < allBattles.length; i++) {
            bytes32 battleId = allBattles[i];
            uint256 claimCount = handler.getClaimCount(battleId);
            
            assertLe(
                claimCount,
                1,
                "INVARIANT VIOLATED: Battle claimed more than once"
            );
        }
    }
    
    // ============ INVARIANT 4: Terminal State Consistency ============
    /// @notice Once a battle reaches CLAIMED or EXPIRED, it cannot change state
    function invariant_terminalStateConsistency() public view {
        bytes32[] memory terminalBattles = handler.getTerminalBattles();
        
        for (uint256 i = 0; i < terminalBattles.length; i++) {
            bytes32 battleId = terminalBattles[i];
            BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
            BattleGateV2.BattleState recordedState = handler.getRecordedTerminalState(battleId);
            
            assertEq(
                uint256(battle.state),
                uint256(recordedState),
                "INVARIANT VIOLATED: Terminal state changed"
            );
        }
    }
    
    // ============ INVARIANT 5: Wallet Lock Consistency ============
    /// @notice A wallet can only be in one battle at a time
    function invariant_walletLockConsistency() public view {
        address[] memory users = handler.getAllUsers();
        
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            bytes32 userBattle = battleGate.walletInBattle(user);
            
            if (userBattle != bytes32(0)) {
                BattleGateV2.Battle memory battle = battleGate.getBattle(userBattle);
                
                // User must be host or guest of this battle
                assertTrue(
                    battle.host == user || battle.guest == user,
                    "INVARIANT VIOLATED: Wallet locked in battle they're not part of"
                );
                
                // Battle must not be terminal
                assertTrue(
                    battle.state != BattleGateV2.BattleState.CLAIMED &&
                    battle.state != BattleGateV2.BattleState.EXPIRED,
                    "INVARIANT VIOLATED: Wallet locked in terminal battle"
                );
            }
        }
    }
    
    // ============ INVARIANT 6: Creature Lock Consistency ============
    /// @notice A creature can only be in one battle at a time
    function invariant_creatureLockConsistency() public view {
        uint256[] memory creatures = handler.getAllCreatures();
        
        for (uint256 i = 0; i < creatures.length; i++) {
            uint256 creatureId = creatures[i];
            bytes32 creatureBattle = battleGate.creatureInBattle(creatureId);
            
            if (creatureBattle != bytes32(0)) {
                BattleGateV2.Battle memory battle = battleGate.getBattle(creatureBattle);
                
                // Creature must be hostCreature or guestCreature
                assertTrue(
                    battle.hostCreatureId == creatureId || battle.guestCreatureId == creatureId,
                    "INVARIANT VIOLATED: Creature locked in battle it's not part of"
                );
            }
        }
    }
}

/**
 * @title BattleHandler
 * @notice Handler contract for invariant testing - generates random valid actions
 */
contract BattleHandler is Test {
    BattleGateV2 public battleGate;
    DragonToken public dragonToken;
    RMRKCreature public creature;
    address public backend;
    
    // Tracking state for invariant verification
    bytes32[] public allBattles;
    bytes32[] public resolvedBattles;
    bytes32[] public terminalBattles;
    address[] public allUsers;
    uint256[] public allCreatures;
    
    mapping(bytes32 => uint256) public prizePaid;
    mapping(bytes32 => uint256) public claimCount;
    mapping(bytes32 => BattleGateV2.BattleState) public recordedTerminalState;
    
    uint256 public totalActiveStakes;
    uint256 public userCount;
    uint256 public creatureCount;
    
    bool public initialized;
    
    constructor(
        BattleGateV2 _battleGate,
        DragonToken _dragonToken,
        RMRKCreature _creature,
        address _backend
    ) {
        battleGate = _battleGate;
        dragonToken = _dragonToken;
        creature = _creature;
        backend = _backend;
    }
    
    function initialize() external {
        require(!initialized, "Already initialized");
        initialized = true;
        _setupTestActors();
    }
    
    function _setupTestActors() internal {
        // Create 5 users with creatures and tokens
        for (uint256 i = 1; i <= 5; i++) {
            address user = address(uint160(0x1000 + i));
            allUsers.push(user);
            
            // Mint tokens
            dragonToken.mint(user, 100000 ether);
            
            // Mint creature
            _mintCreature(user, i);
            allCreatures.push(i);
            
            // Approve battleGate
            vm.prank(user);
            dragonToken.approve(address(battleGate), type(uint256).max);
        }
        userCount = 5;
        creatureCount = 5;
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
    
    // ============ Handler Actions ============
    
    /// @notice Create a battle with random valid parameters
    function createBattle(uint256 userSeed, uint256 stakeSeed) external {
        address user = allUsers[userSeed % allUsers.length];
        uint256 creatureId = (userSeed % creatureCount) + 1;
        
        // Skip if user already in battle
        if (battleGate.walletInBattle(user) != bytes32(0)) return;
        if (battleGate.creatureInBattle(creatureId) != bytes32(0)) return;
        
        // Skip if user doesn't own creature
        try creature.ownerOf(creatureId) returns (address owner) {
            if (owner != user) return;
        } catch {
            return;
        }
        
        uint256 stake = bound(stakeSeed, battleGate.minStake(), battleGate.maxStake());
        
        vm.prank(user);
        try battleGate.createBattle(creatureId, stake) returns (bytes32 battleId) {
            allBattles.push(battleId);
            totalActiveStakes += stake;
        } catch {}
    }
    
    /// @notice Join an existing battle
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
        } catch {
            return;
        }
        
        vm.prank(user);
        try battleGate.joinBattle(battleId, creatureId) {
            totalActiveStakes += battle.stakeAmount;
        } catch {}
    }
    
    /// @notice Cancel a battle
    function cancelBattle(uint256 battleSeed) external {
        if (allBattles.length == 0) return;
        
        bytes32 battleId = allBattles[battleSeed % allBattles.length];
        BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
        
        if (battle.state != BattleGateV2.BattleState.CREATED) return;
        
        vm.prank(battle.host);
        try battleGate.cancelBattle(battleId) {
            totalActiveStakes -= battle.stakeAmount;
            terminalBattles.push(battleId);
            recordedTerminalState[battleId] = BattleGateV2.BattleState.EXPIRED;
        } catch {}
    }
    
    /// @notice Resolve a battle (simulates backend signature)
    function resolveBattle(uint256 battleSeed, bool hostWins) external {
        if (allBattles.length == 0) return;
        
        bytes32 battleId = allBattles[battleSeed % allBattles.length];
        BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
        
        if (battle.state != BattleGateV2.BattleState.MATCHED) return;
        
        address winner = hostWins ? battle.host : battle.guest;
        uint256 timestamp = block.timestamp;
        
        // Create valid signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            battleId,
            winner,
            timestamp,
            block.chainid
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(uint160(backend)), ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        try battleGate.resolveBattle(battleId, winner, timestamp, signature) {
            resolvedBattles.push(battleId);
        } catch {}
    }
    
    /// @notice Claim winnings
    function claimWinnings(uint256 battleSeed) external {
        if (resolvedBattles.length == 0) return;
        
        bytes32 battleId = resolvedBattles[battleSeed % resolvedBattles.length];
        BattleGateV2.Battle memory battle = battleGate.getBattle(battleId);
        
        if (battle.state != BattleGateV2.BattleState.RESOLVED) return;
        
        uint256 balanceBefore = dragonToken.balanceOf(battle.winner);
        
        vm.prank(battle.winner);
        try battleGate.claimWinnings(battleId) {
            uint256 balanceAfter = dragonToken.balanceOf(battle.winner);
            prizePaid[battleId] = balanceAfter - balanceBefore;
            claimCount[battleId]++;
            totalActiveStakes -= battle.stakeAmount * 2;
            terminalBattles.push(battleId);
            recordedTerminalState[battleId] = BattleGateV2.BattleState.CLAIMED;
        } catch {}
    }
    
    /// @notice Warp time forward
    function warpTime(uint256 seconds_) external {
        seconds_ = bound(seconds_, 0, 1 days);
        vm.warp(block.timestamp + seconds_);
    }
    
    // ============ View functions for invariant checks ============
    
    function getAllBattles() external view returns (bytes32[] memory) {
        return allBattles;
    }
    
    function getResolvedBattles() external view returns (bytes32[] memory) {
        return resolvedBattles;
    }
    
    function getTerminalBattles() external view returns (bytes32[] memory) {
        return terminalBattles;
    }
    
    function getAllUsers() external view returns (address[] memory) {
        return allUsers;
    }
    
    function getAllCreatures() external view returns (uint256[] memory) {
        return allCreatures;
    }
    
    function getPrizePaid(bytes32 battleId) external view returns (uint256) {
        return prizePaid[battleId];
    }
    
    function getClaimCount(bytes32 battleId) external view returns (uint256) {
        return claimCount[battleId];
    }
    
    function getRecordedTerminalState(bytes32 battleId) external view returns (BattleGateV2.BattleState) {
        return recordedTerminalState[battleId];
    }
}
