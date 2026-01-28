// Contract addresses and ABI for RMRKCreature
// Updated for new contract with full on-chain move data

// Stat names array used for creature stats display
export const STAT_NAMES = ['STR', 'AGI', 'SPD', 'REF', 'END', 'VIT'] as const;
export const CONTRACTS = {
    RMRKCreature: {
        address: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as `0x${string}`,
        chainId: 31337,
    },
    // Token and economy contracts - Updated from deployed-addresses.json
    BATTLE_GATE: '0x0165878A594ca255338adfa4d48449f69242Eb8F' as `0x${string}`,  // Old BattleGate
    BATTLE_GATE_V2: '0x0165878A594ca255338adfa4d48449f69242Eb8F' as `0x${string}`,  // Same as above now
    DRAGON_TOKEN: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as `0x${string}`,
    MOCK_RMRK: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' as `0x${string}`,
    GAME_CONFIG: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as `0x${string}`,
    MINT_GATE: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9' as `0x${string}`,
    MINT_GATE_V2: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9' as `0x${string}`,  // Alias for MintScreen compatibility
    DRAGON_STAKING: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707' as `0x${string}`,
    HP_MANAGER: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853' as `0x${string}`,
    AIRDROP_VAULT: '0xc6e7DF5E7b4f2A278906862b61205850344D4e7d' as `0x${string}`,
} as const;

// Hardhat local network config
export const HARDHAT_NETWORK = {
    id: 31337,
    name: 'Hardhat Local',
    network: 'hardhat',
    nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
    },
    rpcUrls: {
        default: { http: ['http://127.0.0.1:8545'] },
    },
} as const;

// ABI for RMRKCreature with full Move struct
export const RMRK_CREATURE_ABI = [
    // Core data view
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'coreData',
        outputs: [
            { name: 'genSeed', type: 'bytes32' },
            { name: 'personality', type: 'bytes32' },
            { name: 'elementType', type: 'bytes32' },
            { name: 'temperament', type: 'bytes32' },
            { name: 'bornAt', type: 'uint48' },
            { name: 'talent', type: 'uint8' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    // Live stats (dynamic)
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'getLiveStats',
        outputs: [
            { name: 'stats', type: 'uint8[9]' },
            { name: 'level', type: 'uint16' },
            { name: 'currentHP', type: 'uint16' },
            { name: 'maxHP', type: 'uint16' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    // Moves with full struct data
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'moves',
        outputs: [
            {
                components: [
                    { name: 'moveId', type: 'uint8' },
                    { name: 'moveType', type: 'uint8' },
                    { name: 'category', type: 'uint8' },
                    { name: 'power', type: 'uint8' },
                    { name: 'accuracy', type: 'uint8' },
                    { name: 'cooldownMax', type: 'uint8' },
                    { name: 'statusEffect', type: 'uint8' },
                    { name: 'statusChance', type: 'uint8' },
                ],
                name: 'moveData',
                type: 'tuple[4]',
            },
            { name: 'moveCount', type: 'uint8' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    // balanceOf
    {
        inputs: [{ name: 'owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    // tokenOfOwnerByIndex
    {
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'index', type: 'uint256' },
        ],
        name: 'tokenOfOwnerByIndex',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    // ownerOf
    {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'ownerOf',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    // MintCreature (new signature with Move struct)
    {
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'genSeed', type: 'bytes32' },
            { name: 'elementType', type: 'string' },
        ],
        name: 'mintCreature',
        outputs: [{ name: 'tokenId', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    // Transfer event
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: true, name: 'tokenId', type: 'uint256' },
        ],
        name: 'Transfer',
        type: 'event',
    },
] as const;
