// Debug minting with CORRECT Move struct
import { createPublicClient, createWalletClient, http, parseEther, parseAbi } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ethers } from 'ethers';

const USER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const SIGNER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const MINT_GATE = '0x3155755b79aa083bd953911c92705b7aa82a18f9';
const DGNE = '0x0165878A594ca255338adfa4d48449f69242Eb8F';

async function main() {
    const userAccount = privateKeyToAccount(USER_KEY);
    const signerWallet = new ethers.Wallet(SIGNER_KEY);

    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const walletClient = createWalletClient({
        account: userAccount,
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    console.log('User:', userAccount.address);
    console.log('Signer:', signerWallet.address);

    // Check nonce
    const nonceAbi = parseAbi(['function nonces(address) view returns (uint256)']);
    const nonce = await publicClient.readContract({
        address: MINT_GATE,
        abi: nonceAbi,
        functionName: 'nonces',
        args: [userAccount.address],
    });
    console.log('User nonce:', nonce);

    // Test data
    const genSeed = '0x' + 'ab'.repeat(32);
    const talent = 50;
    const personality = ethers.encodeBytes32String('BRAVE');
    const elementType = ethers.encodeBytes32String('FIRE');
    const temperament = ethers.encodeBytes32String('CALM');
    const baseStats = '0x' + '32'.repeat(9).padStart(18, '0');
    const growthRates = '0x' + '03e8'.repeat(9).padStart(36, '0');
    const aptitudes = '0x' + '64'.repeat(8).padStart(16, '0');
    const moveCount = 2;
    const deadline = Math.floor(Date.now() / 1000) + 300;

    // EIP-712 signature
    const domain = {
        name: 'MintGateV2',
        version: '1',
        chainId: 31337,
        verifyingContract: MINT_GATE,
    };

    const types = {
        MintCreature: [
            { name: 'to', type: 'address' },
            { name: 'genSeed', type: 'bytes32' },
            { name: 'talent', type: 'uint8' },
            { name: 'personality', type: 'bytes32' },
            { name: 'elementType', type: 'bytes32' },
            { name: 'temperament', type: 'bytes32' },
            { name: 'baseStats', type: 'uint72' },
            { name: 'growthRates', type: 'uint144' },
            { name: 'aptitudes', type: 'uint64' },
            { name: 'moveCount', type: 'uint8' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
        ],
    };

    const message = {
        to: userAccount.address,
        genSeed: genSeed,
        talent: talent,
        personality: personality,
        elementType: elementType,
        temperament: temperament,
        baseStats: BigInt(baseStats),
        growthRates: BigInt(growthRates),
        aptitudes: BigInt(aptitudes),
        moveCount: moveCount,
        nonce: BigInt(nonce),
        deadline: BigInt(deadline),
    };

    const signature = await signerWallet.signTypedData(domain, types, message);
    console.log('Signature generated');

    // CORRECT Move struct: moveId, moveType, category, power, accuracy, cooldownMax, statusEffect, statusChance
    const move = {
        moveId: 1,
        moveType: 0, // FIRE
        category: 0, // PHYSICAL
        power: 80,
        accuracy: 100,
        cooldownMax: 2,
        statusEffect: 1, // BURN
        statusChance: 20,
    };
    const moves = [move, move, { ...move, moveId: 0 }, { ...move, moveId: 0 }];
    const mastery = [15, 15, 0, 0];

    // Approve DGNE
    const approveAbi = parseAbi(['function approve(address, uint256) returns (bool)']);
    await walletClient.writeContract({
        address: DGNE,
        abi: approveAbi,
        functionName: 'approve',
        args: [MINT_GATE, parseEther('10000')],
    });
    console.log('DGNE approved');

    // Mint
    try {
        const mintAbi = parseAbi([
            'function mintCreature(address to, bytes32 genSeed, uint8 talent, bytes32 personality, bytes32 elementType, bytes32 temperament, uint72 baseStats, uint144 growthRates, (uint8 moveId, uint8 moveType, uint8 category, uint8 power, uint8 accuracy, uint8 cooldownMax, uint8 statusEffect, uint8 statusChance)[4] moves, uint8 moveCount, uint8[4] mastery, uint64 aptitudes, uint256 deadline, bytes signature) returns (uint256)',
        ]);

        const tx = await walletClient.writeContract({
            address: MINT_GATE,
            abi: mintAbi,
            functionName: 'mintCreature',
            args: [
                userAccount.address,
                genSeed,
                talent,
                personality,
                elementType,
                temperament,
                BigInt(baseStats),
                BigInt(growthRates),
                moves,
                moveCount,
                mastery,
                BigInt(aptitudes),
                BigInt(deadline),
                signature,
            ],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log('\n✅ MINT SUCCESS!');
        console.log('TX:', tx);
        console.log('Gas used:', receipt.gasUsed);
    } catch (e) {
        console.error('\n❌ MINT FAILED:', e.message?.slice(0, 300));
    }
}

main().catch(console.error);
