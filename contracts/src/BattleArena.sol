// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./CreatureNFT.sol";

/**
 * @title BattleArena
 * @dev Manages battles between creatures with ETH stakes
 * @notice Handles match creation, stake escrow, and winner payouts
 */
contract BattleArena is Ownable, ReentrancyGuard {
    
    // Platform fee in basis points (200 = 2%)
    uint256 public constant PLATFORM_FEE_BPS = 200;
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // Minimum and maximum stake
    uint256 public minStake = 0.001 ether;
    uint256 public maxStake = 10 ether;
    
    // Match timeout (for disputes)
    uint256 public matchTimeout = 1 hours;
    
    // Creature NFT contract
    CreatureNFT public creatureNFT;
    
    // Server address (authorized to declare winners)
    address public battleServer;
    
    // Match states
    enum MatchState {
        OPEN,           // Waiting for opponent
        READY,          // Both players, waiting for battle
        IN_PROGRESS,    // Battle ongoing
        COMPLETED,      // Winner declared, awaiting claim
        CLAIMED,        // Prize claimed
        CANCELLED,      // Cancelled before battle
        DISPUTED        // Under dispute
    }
    
    // Match data
    struct Match {
        address playerA;
        address playerB;
        uint256 creatureIdA;
        uint256 creatureIdB;
        uint256 stake;
        MatchState state;
        address winner;
        bytes32 battleLogHash;  // Hash of battle log for verification
        uint256 createdAt;
        uint256 completedAt;
    }
    
    // Match ID counter
    uint256 public matchIdCounter;
    
    // Matches
    mapping(uint256 => Match) public matches;
    
    // Player's active match (one at a time)
    mapping(address => uint256) public playerActiveMatch;
    
    // Accumulated platform fees
    uint256 public accumulatedFees;
    
    // Events
    event MatchCreated(
        uint256 indexed matchId,
        address indexed playerA,
        uint256 creatureIdA,
        uint256 stake
    );
    event MatchJoined(
        uint256 indexed matchId,
        address indexed playerB,
        uint256 creatureIdB
    );
    event MatchStarted(uint256 indexed matchId);
    event MatchCompleted(
        uint256 indexed matchId,
        address indexed winner,
        bytes32 battleLogHash
    );
    event PrizeClaimed(
        uint256 indexed matchId,
        address indexed winner,
        uint256 amount
    );
    event MatchCancelled(uint256 indexed matchId);
    event MatchDisputed(uint256 indexed matchId, address indexed disputedBy);
    event ServerUpdated(address indexed newServer);
    event StakeLimitsUpdated(uint256 minStake, uint256 maxStake);
    
    constructor(address _creatureNFT) Ownable(msg.sender) {
        creatureNFT = CreatureNFT(_creatureNFT);
        battleServer = msg.sender;
    }
    
    // Modifiers
    modifier onlyServer() {
        require(msg.sender == battleServer, "Only battle server");
        _;
    }
    
    /**
     * @dev Create a new match with stake
     * @param creatureId ID of the creature to battle with
     */
    function createMatch(uint256 creatureId) external payable nonReentrant returns (uint256) {
        require(msg.value >= minStake && msg.value <= maxStake, "Invalid stake amount");
        require(creatureNFT.ownsCreature(msg.sender, creatureId), "Not creature owner");
        require(playerActiveMatch[msg.sender] == 0, "Already in a match");
        
        matchIdCounter++;
        uint256 matchId = matchIdCounter;
        
        matches[matchId] = Match({
            playerA: msg.sender,
            playerB: address(0),
            creatureIdA: creatureId,
            creatureIdB: 0,
            stake: msg.value,
            state: MatchState.OPEN,
            winner: address(0),
            battleLogHash: bytes32(0),
            createdAt: block.timestamp,
            completedAt: 0
        });
        
        playerActiveMatch[msg.sender] = matchId;
        
        emit MatchCreated(matchId, msg.sender, creatureId, msg.value);
        
        return matchId;
    }
    
    /**
     * @dev Join an existing match
     * @param matchId ID of the match to join
     * @param creatureId ID of the creature to battle with
     */
    function joinMatch(uint256 matchId, uint256 creatureId) external payable nonReentrant {
        Match storage m = matches[matchId];
        
        require(m.state == MatchState.OPEN, "Match not open");
        require(m.playerA != msg.sender, "Cannot join own match");
        require(msg.value == m.stake, "Stake must match");
        require(creatureNFT.ownsCreature(msg.sender, creatureId), "Not creature owner");
        require(playerActiveMatch[msg.sender] == 0, "Already in a match");
        
        m.playerB = msg.sender;
        m.creatureIdB = creatureId;
        m.state = MatchState.READY;
        
        playerActiveMatch[msg.sender] = matchId;
        
        emit MatchJoined(matchId, msg.sender, creatureId);
    }
    
    /**
     * @dev Mark match as started (called by server when battle begins)
     */
    function startMatch(uint256 matchId) external onlyServer {
        Match storage m = matches[matchId];
        require(m.state == MatchState.READY, "Match not ready");
        
        m.state = MatchState.IN_PROGRESS;
        
        emit MatchStarted(matchId);
    }
    
    /**
     * @dev Declare winner (called by server after battle)
     * @param matchId Match ID
     * @param winner Address of the winner
     * @param battleLogHash Hash of the battle log for verification
     */
    function declareWinner(
        uint256 matchId,
        address winner,
        bytes32 battleLogHash
    ) external onlyServer {
        Match storage m = matches[matchId];
        
        require(m.state == MatchState.IN_PROGRESS, "Match not in progress");
        require(
            winner == m.playerA || winner == m.playerB,
            "Winner must be a player"
        );
        
        m.winner = winner;
        m.battleLogHash = battleLogHash;
        m.state = MatchState.COMPLETED;
        m.completedAt = block.timestamp;
        
        emit MatchCompleted(matchId, winner, battleLogHash);
    }
    
    /**
     * @dev Claim prize (winner calls this to receive funds)
     */
    function claimPrize(uint256 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        
        require(m.state == MatchState.COMPLETED, "Match not completed");
        require(m.winner == msg.sender, "Not the winner");
        
        m.state = MatchState.CLAIMED;
        
        // Clear active match for both players
        playerActiveMatch[m.playerA] = 0;
        playerActiveMatch[m.playerB] = 0;
        
        // Calculate payout
        uint256 totalPot = m.stake * 2;
        uint256 fee = (totalPot * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 prize = totalPot - fee;
        
        accumulatedFees += fee;
        
        // Transfer prize
        (bool success, ) = payable(msg.sender).call{value: prize}("");
        require(success, "Transfer failed");
        
        // Add XP to winner's creature
        uint256 winnerCreature = m.playerA == msg.sender ? m.creatureIdA : m.creatureIdB;
        creatureNFT.addXP(winnerCreature, 50); // 50 XP for winning
        
        emit PrizeClaimed(matchId, msg.sender, prize);
    }
    
    /**
     * @dev Cancel match (only before battle starts)
     */
    function cancelMatch(uint256 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        
        require(m.playerA == msg.sender, "Not match creator");
        require(m.state == MatchState.OPEN, "Cannot cancel after opponent joined");
        
        m.state = MatchState.CANCELLED;
        playerActiveMatch[msg.sender] = 0;
        
        // Refund stake
        (bool success, ) = payable(msg.sender).call{value: m.stake}("");
        require(success, "Refund failed");
        
        emit MatchCancelled(matchId);
    }
    
    /**
     * @dev Dispute a match (for stuck matches after timeout)
     */
    function disputeMatch(uint256 matchId) external {
        Match storage m = matches[matchId];
        
        require(
            m.playerA == msg.sender || m.playerB == msg.sender,
            "Not a match participant"
        );
        require(
            m.state == MatchState.IN_PROGRESS,
            "Can only dispute in-progress matches"
        );
        require(
            block.timestamp > m.createdAt + matchTimeout,
            "Timeout not reached"
        );
        
        m.state = MatchState.DISPUTED;
        
        emit MatchDisputed(matchId, msg.sender);
    }
    
    /**
     * @dev Resolve disputed match (owner only)
     */
    function resolveDispute(
        uint256 matchId,
        address winner
    ) external onlyOwner nonReentrant {
        Match storage m = matches[matchId];
        
        require(m.state == MatchState.DISPUTED, "Not a disputed match");
        
        // Refund both if no winner specified
        if (winner == address(0)) {
            m.state = MatchState.CANCELLED;
            playerActiveMatch[m.playerA] = 0;
            playerActiveMatch[m.playerB] = 0;
            
            (bool successA, ) = payable(m.playerA).call{value: m.stake}("");
            (bool successB, ) = payable(m.playerB).call{value: m.stake}("");
            require(successA && successB, "Refund failed");
        } else {
            require(
                winner == m.playerA || winner == m.playerB,
                "Winner must be a participant"
            );
            m.winner = winner;
            m.state = MatchState.COMPLETED;
            m.completedAt = block.timestamp;
        }
    }
    
    // Admin functions
    
    /**
     * @dev Update battle server address
     */
    function setBattleServer(address _server) external onlyOwner {
        battleServer = _server;
        emit ServerUpdated(_server);
    }
    
    /**
     * @dev Update stake limits
     */
    function setStakeLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min < _max, "Invalid limits");
        minStake = _min;
        maxStake = _max;
        emit StakeLimitsUpdated(_min, _max);
    }
    
    /**
     * @dev Withdraw accumulated fees
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @dev Get match details
     */
    function getMatch(uint256 matchId) external view returns (Match memory) {
        return matches[matchId];
    }
    
    /**
     * @dev Get player's active match ID
     */
    function getPlayerMatch(address player) external view returns (uint256) {
        return playerActiveMatch[player];
    }
    
    /**
     * @dev Check if match exists and is open
     */
    function isMatchOpen(uint256 matchId) external view returns (bool) {
        return matches[matchId].state == MatchState.OPEN;
    }
    
    // Receive ETH (for direct transfers)
    receive() external payable {}
}
