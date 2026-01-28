// Update mint costs using viem directly
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// First Hardhat account private key
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const GAME_CONFIG_ADDRESS = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';

const gameConfigAbi = parseAbi([
    'function mintCostDGNE() view returns (uint256)',
    'function skipCostDGNE() view returns (uint256)',
    'function mintTreasury() view returns (address)',
    'function setMintCosts(uint256 _mintCost, uint256 _skipCost, uint256 _rmrk)',
    'function setMintTreasury(address _treasury)',
]);

async function main() {
    const account = privateKeyToAccount(PRIVATE_KEY);

    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const walletClient = createWalletClient({
        account,
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    console.log('Account:', account.address);

    // Read current values
    const currentMint = await publicClient.readContract({
        address: GAME_CONFIG_ADDRESS,
        abi: gameConfigAbi,
        functionName: 'mintCostDGNE',
    });
    console.log('Current mint cost:', currentMint);

    // Set new costs: 1000 DGNE mint, 100 DGNE skip, 10 RMRK
    const mintCost = BigInt("1000000000000000000000");  // 1000 ether
    const skipCost = BigInt("100000000000000000000");   // 100 ether  
    const rmrkCost = BigInt("10000000000000000000");    // 10 ether
    const treasury = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    console.log('Setting mint costs...');
    const hash1 = await walletClient.writeContract({
        address: GAME_CONFIG_ADDRESS,
        abi: gameConfigAbi,
        functionName: 'setMintCosts',
        args: [mintCost, skipCost, rmrkCost],
    });
    await publicClient.waitForTransactionReceipt({ hash: hash1 });
    console.log('setMintCosts done:', hash1);

    console.log('Setting treasury...');
    const hash2 = await walletClient.writeContract({
        address: GAME_CONFIG_ADDRESS,
        abi: gameConfigAbi,
        functionName: 'setMintTreasury',
        args: [treasury],
    });
    await publicClient.waitForTransactionReceipt({ hash: hash2 });
    console.log('setMintTreasury done:', hash2);

    // Verify
    const newMint = await publicClient.readContract({
        address: GAME_CONFIG_ADDRESS,
        abi: gameConfigAbi,
        functionName: 'mintCostDGNE',
    });
    const newSkip = await publicClient.readContract({
        address: GAME_CONFIG_ADDRESS,
        abi: gameConfigAbi,
        functionName: 'skipCostDGNE',
    });
    const newTreasury = await publicClient.readContract({
        address: GAME_CONFIG_ADDRESS,
        abi: gameConfigAbi,
        functionName: 'mintTreasury',
    });

    console.log('\n=== Updated! ===');
    console.log('Mint cost:', newMint);
    console.log('Skip cost:', newSkip);
    console.log('Treasury:', newTreasury);
}

main().catch(console.error);
