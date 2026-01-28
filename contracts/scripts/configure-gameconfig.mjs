// Configure GameConfig with proper addresses
import { createPublicClient, createWalletClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const GAME_CONFIG = '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512';
const DRAGON_TOKEN = '0x5fbdb2315678afecb367f032d93f642f64180aa3';
const CREATURE_CONTRACT = '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0';
const MINT_GATE = '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9';
const BATTLE_GATE = '0x5fc8d32690cc91d4c39d9d3abcbd16989f875707';

async function main() {
    const account = privateKeyToAccount(DEPLOYER_KEY);
    console.log('Configuring GameConfig with:', account.address);

    const walletClient = createWalletClient({
        account,
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const abi = [
        {
            name: 'setDragonToken',
            type: 'function',
            inputs: [{ name: '_token', type: 'address' }],
            outputs: [],
            stateMutability: 'nonpayable'
        },
        {
            name: 'setCreatureContract',
            type: 'function',
            inputs: [{ name: '_contract', type: 'address' }],
            outputs: [],
            stateMutability: 'nonpayable'
        },
        {
            name: 'setMintTreasury',
            type: 'function',
            inputs: [{ name: '_treasury', type: 'address' }],
            outputs: [],
            stateMutability: 'nonpayable'
        },
        {
            name: 'setBattleGate',
            type: 'function',
            inputs: [{ name: '_gate', type: 'address' }],
            outputs: [],
            stateMutability: 'nonpayable'
        },
        {
            name: 'dragonToken',
            type: 'function',
            inputs: [],
            outputs: [{ type: 'address' }],
            stateMutability: 'view'
        },
        {
            name: 'mintTreasury',
            type: 'function',
            inputs: [],
            outputs: [{ type: 'address' }],
            stateMutability: 'view'
        },
        {
            name: 'setMintCosts',
            type: 'function',
            inputs: [
                { name: '_mintCost', type: 'uint256' },
                { name: '_skipCost', type: 'uint256' },
                { name: '_rmrk', type: 'uint256' }
            ],
            outputs: [],
            stateMutability: 'nonpayable'
        }
    ];

    // Set DragonToken
    console.log('1. Setting DragonToken...');
    let hash = await walletClient.writeContract({
        address: GAME_CONFIG,
        abi,
        functionName: 'setDragonToken',
        args: [DRAGON_TOKEN],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Set CreatureContract
    console.log('2. Setting CreatureContract...');
    hash = await walletClient.writeContract({
        address: GAME_CONFIG,
        abi,
        functionName: 'setCreatureContract',
        args: [CREATURE_CONTRACT],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Set MintTreasury (use deployer as treasury for now)
    console.log('3. Setting MintTreasury...');
    hash = await walletClient.writeContract({
        address: GAME_CONFIG,
        abi,
        functionName: 'setMintTreasury',
        args: [account.address],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Set BattleGate
    console.log('4. Setting BattleGate...');
    hash = await walletClient.writeContract({
        address: GAME_CONFIG,
        abi,
        functionName: 'setBattleGate',
        args: [BATTLE_GATE],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Lower mint cost for testing (10 DGNE instead of 1000)
    console.log('5. Setting mint costs (10 DGNE for testing)...');
    hash = await walletClient.writeContract({
        address: GAME_CONFIG,
        abi,
        functionName: 'setMintCosts',
        args: [10n * 10n ** 18n, 1n * 10n ** 18n, 1n * 10n ** 18n],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Verify
    const dgne = await publicClient.readContract({
        address: GAME_CONFIG,
        abi,
        functionName: 'dragonToken',
    });
    const treasury = await publicClient.readContract({
        address: GAME_CONFIG,
        abi,
        functionName: 'mintTreasury',
    });

    console.log('\\n✅ GameConfig configured!');
    console.log('  DragonToken:', dgne);
    console.log('  MintTreasury:', treasury);
}

main().catch(console.error);
