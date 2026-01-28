// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import {RMRKNestableMultiAssetPreMint} from "../lib/evm/contracts/implementations/premint/RMRKNestableMultiAssetPreMint.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

// ============ Custom Errors (Gas Optimization) ============
error NotAuthorizedMinter();
error InvalidCreatureTalent();
error InvalidMoveCount();
error NotAuthorizedXP();
error TokenDoesNotExist();
error RoyaltyTooHigh();

/**
 * @title RMRKCreature
 * @notice RMRK-based creature NFT with full on-chain stats and dynamic metadata
 * @dev Minting is restricted to authorized minters (MintGate) + owner for security
 */
contract RMRKCreature is RMRKNestableMultiAssetPreMint {
    using Strings for uint256;
    
    // ============ Constants ============
    uint256 constant PEAK_LEVEL = 50;
    uint256 constant MAX_LEVEL = 100;
    uint256 constant PEAK_AGE_DAYS = 365;
    uint256 constant DECAY_START_DAYS = 730;
    uint256 constant STARTING_MULT = 500; // 0.5 * 1000
    uint256 constant SECONDS_PER_CREATURE_DAY = 20160;
    
    // Stat indices
    uint8 constant STR = 0;
    uint8 constant AGI = 1;
    uint8 constant SPD = 2;
    uint8 constant REF = 3;
    uint8 constant END = 4;
    uint8 constant VIT = 5;
    uint8 constant INT = 6;
    uint8 constant PRC = 7;
    uint8 constant RGN = 8;
    
    // ============ Storage ============
    
    /// @notice Core immutable data (set at mint)
    struct CoreData {
        bytes32 genSeed;
        bytes32 personality;
        bytes32 elementType;
        bytes32 temperament;
        uint48 bornAt;
        uint8 talent;
    }
    
    /// @notice Packed stats: [STR, AGI, SPD, REF, END, VIT, INT, PRC, RGN]
    struct PackedStats {
        uint72 baseStats;     // 9 x 8 bits = 72 bits
        uint144 growthRates;  // 9 x 16 bits = 144 bits
    }
    
    /// @notice Single move with full battle data
    /// @dev Packed to 8 bytes per move
    struct Move {
        uint8 moveId;       // Move identifier (0 = empty slot)
        uint8 moveType;     // Element type: 0=FIRE, 1=WATER, 2=GRASS, 3=ELECTRIC, 4=ICE, 5=EARTH, 6=DARK, 7=LIGHT
        uint8 category;     // 0=Physical, 1=Special, 2=Status
        uint8 power;        // 0-200 (0 for status moves)
        uint8 accuracy;     // 0-100
        uint8 cooldownMax;  // 0-10 turns
        uint8 statusEffect; // 0=None, 1=Burn, 2=Freeze, 3=Poison, 4=Paralyze, 5=Stun, etc
        uint8 statusChance; // 0-100 percentage
    }
    
    /// @notice Moves and aptitudes - supports 2-4 moves per creature
    struct MovesData {
        Move move1;
        Move move2;
        Move move3;         // Optional (moveId=0 if empty)
        Move move4;         // Optional (moveId=0 if empty)
        uint8 moveCount;    // 2, 3, or 4
        uint8[4] mastery;   // Move mastery 85-115 stored as 0-30 (actual = 85 + value)
        uint64 aptitudes;   // 8 x 8 bits (FIRE, WATER, GRASS, ELECTRIC, ICE, EARTH, DARK, LIGHT)
    }
    
    mapping(uint256 => CoreData) public coreData;
    mapping(uint256 => PackedStats) public packedStats;
    mapping(uint256 => MovesData) public movesData;
    mapping(uint256 => uint32) public xp;
    mapping(address => bool) public xpUpdaters;
    
    // Minter whitelist (MintGate contract)
    mapping(address => bool) public authorizedMinters;
    
    // ============ Treasury & Royalties (EIP-2981) ============
    address public treasury;
    uint256 public royaltyBps = 500;  // 5% royalty on secondary sales
    
    // ============ Events ============
    event CreatureMinted(uint256 indexed tokenId, address indexed owner, bytes32 genSeed, uint8 talent, bytes32 elementType);
    event XPAdded(uint256 indexed tokenId, uint256 amount, uint256 newTotal);
    event XPUpdaterSet(address indexed updater, bool authorized);
    event MinterSet(address indexed minter, bool authorized);
    
    // ============ Constructor ============
    constructor()
        RMRKNestableMultiAssetPreMint(
            "RMRK Autobattler Creature",
            "CREATURE",
            "ipfs://collection-metadata",
            10000,
            msg.sender,
            500
        )
    {}
    
    // ============ Modifiers ============
    
    modifier onlyMinter() {
        if (!authorizedMinters[msg.sender] && msg.sender != owner()) revert NotAuthorizedMinter();
        _;
    }
    
    // ============ Override base mint to make it public for local dev ============
    function mint(
        address to,
        uint256 numToMint,
        string memory tokenURI
    ) public virtual override returns (uint256 firstTokenId) {
        (uint256 nextToken, uint256 totalSupplyOffset) = _prepareMint(numToMint);

        for (uint256 i = nextToken; i < totalSupplyOffset; ) {
            _setTokenURI(i, tokenURI);
            _safeMint(to, i, "");
            unchecked {
                ++i;
            }
        }

        firstTokenId = nextToken;
    }
    
    // ============ Mint Creature ============
    
    function mintCreature(
        address to,
        bytes32 genSeed,
        uint8 talent,
        bytes32 personality,
        bytes32 elementType,
        bytes32 temperament,
        uint72 baseStats,       // Packed: 9 x 8 bits
        uint144 growthRates,    // Packed: 9 x 16 bits
        Move[4] calldata moves, // Full move data (use moveId=0 for empty slots)
        uint8 moveCount,        // 2, 3, or 4
        uint8[4] calldata mastery, // Move mastery 0-30 (actual = 85 + value)
        uint64 aptitudes        // Packed: 8 x 8 bits
    ) external onlyMinter returns (uint256 tokenId) {
        if (talent < 1 || talent > 100) revert InvalidCreatureTalent();
        if (moveCount < 2 || moveCount > 4) revert InvalidMoveCount();
        
        // NOTE: Token payment moved to MintGate contract for size optimization
        
        tokenId = mint(to, 1, "");
        
        coreData[tokenId] = CoreData({
            genSeed: genSeed,
            personality: personality,
            elementType: elementType,
            temperament: temperament,
            bornAt: uint48(block.timestamp),
            talent: talent
        });
        
        packedStats[tokenId] = PackedStats({
            baseStats: baseStats,
            growthRates: growthRates
        });
        
        movesData[tokenId] = MovesData({
            move1: moves[0],
            move2: moves[1],
            move3: moves[2],
            move4: moves[3],
            moveCount: moveCount,
            mastery: mastery,
            aptitudes: aptitudes
        });
        
        emit CreatureMinted(tokenId, to, genSeed, talent, elementType);
    }
    
    // ============ XP ============
    
    function setXPUpdater(address updater, bool authorized) external onlyOwner {
        xpUpdaters[updater] = authorized;
        emit XPUpdaterSet(updater, authorized);
    }
    
    /// @notice Authorize a contract (MintGate) to mint creatures
    function setMinter(address minter, bool authorized) external onlyOwner {
        authorizedMinters[minter] = authorized;
        emit MinterSet(minter, authorized);
    }
    
    function addXP(uint256 tokenId, uint256 amount) external {
        if (!xpUpdaters[msg.sender] && msg.sender != owner()) revert NotAuthorizedXP();
        if (!_exists(tokenId)) revert TokenDoesNotExist();
        xp[tokenId] += uint32(amount);
        emit XPAdded(tokenId, amount, xp[tokenId]);
    }
    
    // ============ View Functions ============
    
    function getLevel(uint256 tokenId) public view returns (uint256) {
        if (!_exists(tokenId)) revert TokenDoesNotExist();
        uint256 _xp = xp[tokenId];
        if (_xp == 0) return 1;
        
        // level = sqrt(xp / 14) + 1
        uint256 x = _xp / 14;
        uint256 y = x;
        uint256 z = (y + 1) / 2;
        while (z < y) { y = z; z = (x / z + z) / 2; }
        uint256 level = y + 1;
        return level > 100 ? 100 : level;
    }
    
    function getAgeDays(uint256 tokenId) public view returns (uint256) {
        if (!_exists(tokenId)) revert TokenDoesNotExist();
        return (block.timestamp - coreData[tokenId].bornAt) / SECONDS_PER_CREATURE_DAY;
    }
    
    function _getBaseStat(uint72 packed, uint8 index) internal pure returns (uint8) {
        return uint8(packed >> (index * 8));
    }
    
    function _getGrowthRate(uint144 packed, uint8 index) internal pure returns (uint16) {
        return uint16(packed >> (index * 16));
    }
    
    function _calcStat(uint8 baseStat, uint16 growthRate, uint256 level, uint256 ageDays, bool isINT) internal pure returns (uint8) {
        if (isINT) {
            uint256 result = (uint256(baseStat) * (1000 + (ageDays * 300) / 1825)) / 1000;
            return result > 255 ? 255 : uint8(result);
        }
        
        uint256 levelMult;
        if (level <= PEAK_LEVEL) {
            levelMult = STARTING_MULT + (level * growthRate) / PEAK_LEVEL;
        } else {
            uint256 peakMult = STARTING_MULT + growthRate;
            uint256 decay = ((level - PEAK_LEVEL) * 150 * growthRate) / ((MAX_LEVEL - PEAK_LEVEL) * 1000);
            levelMult = peakMult > decay ? peakMult - decay : STARTING_MULT;
        }
        
        uint256 ageMult;
        if (ageDays <= PEAK_AGE_DAYS) {
            ageMult = 900 + (ageDays * 100) / PEAK_AGE_DAYS;
        } else if (ageDays <= DECAY_START_DAYS) {
            ageMult = 1000;
        } else {
            uint256 decay = ((ageDays - DECAY_START_DAYS) * 100) / 365;
            ageMult = decay >= 500 ? 500 : 1000 - decay;
        }
        
        uint256 result = (uint256(baseStat) * levelMult * ageMult) / 1000000;
        return result > 255 ? 255 : uint8(result);
    }
    
    function getLiveStats(uint256 tokenId) public view returns (
        uint8[9] memory stats,
        uint16 level,
        uint16 ageDays
    ) {
        require(_exists(tokenId), "Token does not exist");
        
        PackedStats storage ps = packedStats[tokenId];
        uint256 _level = getLevel(tokenId);
        uint256 _ageDays = getAgeDays(tokenId);
        
        for (uint8 i = 0; i < 9; i++) {
            uint8 base = _getBaseStat(ps.baseStats, i);
            uint16 growth = _getGrowthRate(ps.growthRates, i);
            stats[i] = _calcStat(base, growth, _level, _ageDays, i == INT);
        }
        
        level = uint16(_level);
        ageDays = uint16(_ageDays);
    }
    
    /// @notice Get all moves for a creature
    function getMoves(uint256 tokenId) public view returns (
        Move[4] memory moves,
        uint8 moveCount,
        uint8[4] memory mastery
    ) {
        require(_exists(tokenId), "Token does not exist");
        
        MovesData storage md = movesData[tokenId];
        moves[0] = md.move1;
        moves[1] = md.move2;
        moves[2] = md.move3;
        moves[3] = md.move4;
        moveCount = md.moveCount;
        mastery = md.mastery;
    }
    
    // ============ Dynamic TokenURI ============
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        
        CoreData storage core = coreData[tokenId];
        (uint8[9] memory stats, uint16 level, uint16 ageDays) = getLiveStats(tokenId);
        
        string memory json = string(abi.encodePacked(
            '{"name":"Creature #', tokenId.toString(),
            '","description":"NFT Autobattler Creature",',
            '"attributes":[',
            _buildAttributes(core, stats, level, ageDays),
            ']}'
        ));
        
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }
    
    function _buildAttributes(
        CoreData storage core,
        uint8[9] memory stats,
        uint16 level,
        uint16 ageDays
    ) internal view returns (string memory) {
        string[9] memory statNames = ["STR", "AGI", "SPD", "REF", "END", "VIT", "INT", "PRC", "RGN"];
        
        string memory result = string(abi.encodePacked(
            '{"trait_type":"Element","value":"', _bytes32ToString(core.elementType), '"},',
            '{"trait_type":"Talent","value":', uint256(core.talent).toString(), '},',
            '{"trait_type":"Personality","value":"', _bytes32ToString(core.personality), '"},',
            '{"trait_type":"Level","value":', uint256(level).toString(), '},',
            '{"trait_type":"Age","value":', uint256(ageDays).toString(), '}'
        ));
        
        for (uint8 i = 0; i < 9; i++) {
            result = string(abi.encodePacked(
                result, ',{"trait_type":"', statNames[i], '","value":', uint256(stats[i]).toString(), '}'
            ));
        }
        
        return result;
    }
    
    function _bytes32ToString(bytes32 _bytes) internal pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes[i] != 0) i++;
        bytes memory arr = new bytes(i);
        for (uint8 j = 0; j < i; j++) arr[j] = _bytes[j];
        return string(arr);
    }
    
    function _exists(uint256 tokenId) internal view override returns (bool) {
        try this.ownerOf(tokenId) returns (address o) { return o != address(0); } catch { return false; }
    }
    
    // ============ EIP-2981 Royalties ============
    
    /**
     * @notice EIP-2981 royalty info for marketplaces
     * @param salePrice The sale price of the NFT
     * @return receiver The royalty recipient (treasury)
     * @return royaltyAmount The royalty amount
     */
    function royaltyInfo(uint256, uint256 salePrice) 
        external view override returns (address receiver, uint256 royaltyAmount) 
    {
        return (treasury, (salePrice * royaltyBps) / 10000);
    }
    
    /**
     * @notice EIP-165 interface support
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        // 0x2a55205a is EIP-2981
        return interfaceId == 0x2a55205a || super.supportsInterface(interfaceId);
    }
    
    // ============ Admin Setters ============
    
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }
    
    function setRoyaltyBps(uint256 _bps) external onlyOwner {
        if (_bps > 1000) revert RoyaltyTooHigh();
        royaltyBps = _bps;
    }
}
