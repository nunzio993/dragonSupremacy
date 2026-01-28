// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CreatureNFT
 * @dev ERC-721 token representing battle creatures
 * @notice Creatures are minted through auctions on Singular marketplace
 */
contract CreatureNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    
    uint256 private _nextTokenId;

    // Creature core data stored on-chain
    struct CreatureData {
        string definitionId;     // Species type (e.g., "fire_dragon")
        uint8 talent;            // 1-100
        string temperament;      // CALMO, FOCALIZZATO, NEUTRO, NERVOSO, SPERICOLATO
        bytes32 statsHash;       // Hash of full stats (stored off-chain)
        uint256 bornAt;          // Timestamp of minting
        uint256 xp;              // Experience points
    }

    // Token ID => Creature Data
    mapping(uint256 => CreatureData) public creatures;

    // Authorized minters (e.g., auction contract)
    mapping(address => bool) public authorizedMinters;

    // Events
    event CreatureMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string definitionId,
        uint8 talent,
        string temperament
    );
    event CreatureXPUpdated(uint256 indexed tokenId, uint256 newXP);
    event MinterAuthorized(address indexed minter);
    event MinterRevoked(address indexed minter);

    constructor() ERC721("NFT Autobattler Creature", "CREATURE") Ownable(msg.sender) {}

    /**
     * @dev Authorize an address to mint creatures
     */
    function authorizeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
        emit MinterAuthorized(minter);
    }

    /**
     * @dev Revoke minting authorization
     */
    function revokeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterRevoked(minter);
    }

    /**
     * @dev Mint a new creature
     * @param to Address to mint to
     * @param definitionId Species identifier
     * @param talent Creature talent (1-100)
     * @param temperament Creature temperament
     * @param statsHash Hash of full creature stats
     * @param uri Token metadata URI
     */
    function mint(
        address to,
        string calldata definitionId,
        uint8 talent,
        string calldata temperament,
        bytes32 statsHash,
        string calldata uri
    ) external returns (uint256) {
        require(
            authorizedMinters[msg.sender] || msg.sender == owner(),
            "Not authorized to mint"
        );
        require(talent >= 1 && talent <= 100, "Talent must be 1-100");

        uint256 tokenId = _nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        creatures[tokenId] = CreatureData({
            definitionId: definitionId,
            talent: talent,
            temperament: temperament,
            statsHash: statsHash,
            bornAt: block.timestamp,
            xp: 0
        });

        emit CreatureMinted(tokenId, to, definitionId, talent, temperament);

        return tokenId;
    }

    /**
     * @dev Add XP to a creature (called by battle arena after wins)
     */
    function addXP(uint256 tokenId, uint256 amount) external {
        require(
            authorizedMinters[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        creatures[tokenId].xp += amount;
        emit CreatureXPUpdated(tokenId, creatures[tokenId].xp);
    }

    /**
     * @dev Get creature data
     */
    function getCreature(uint256 tokenId) external view returns (CreatureData memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return creatures[tokenId];
    }

    /**
     * @dev Get creature level (derived from XP)
     */
    function getLevel(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return (creatures[tokenId].xp / 100) + 1;
    }

    /**
     * @dev Check if address owns a specific creature
     */
    function ownsCreature(address owner, uint256 tokenId) external view returns (bool) {
        return ownerOf(tokenId) == owner;
    }

    // Required overrides for ERC721 extensions
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
