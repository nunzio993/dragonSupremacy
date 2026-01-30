// Contract addresses and ABI for RMRKCreature
// Updated for new contract with full on-chain move data

// Stat names array used for creature stats display
export const STAT_NAMES = ['STR', 'AGI', 'SPD', 'REF', 'END', 'VIT'] as const;
export const CONTRACTS = {
    RMRKCreature: {
        address: '0x4631BCAbD6dF18D94796344963cB60d44a4136b6' as `0x${string}`,
        chainId: 31337,
    },
    // Token and economy contracts - Updated from deployed-addresses.json
    BATTLE_GATE: '0x720472c8ce72c2A2D711333e064ABD3E6BbEAdd3' as `0x${string}`,  // BattleGateV2
    BATTLE_GATE_V2: '0x720472c8ce72c2A2D711333e064ABD3E6BbEAdd3' as `0x${string}`,
    DRAGON_TOKEN: '0xA4899D35897033b927acFCf422bc745916139776' as `0x${string}`,
    MOCK_RMRK: '0xf953b3A269d80e3eB0F2947630Da976B896A8C5b' as `0x${string}`,
    GAME_CONFIG: '0x86A2EE8FAf9A840F7a2c64CA3d51209F9A02081D' as `0x${string}`,
    MINT_GATE: '0xAA292E8611aDF267e563f334Ee42320aC96D0463' as `0x${string}`,
    MINT_GATE_V2: '0xAA292E8611aDF267e563f334Ee42320aC96D0463' as `0x${string}`,
    DRAGON_STAKING: '0x5c74c94173F05dA1720953407cbb920F3DF9f887' as `0x${string}`,
    HP_MANAGER: '0xe8D2A1E88c91DCd5433208d4152Cc4F399a7e91d' as `0x${string}`,
    AIRDROP_VAULT: '0xA7c59f010700930003b33aB25a7a0679C860f29c' as `0x${string}`,
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
