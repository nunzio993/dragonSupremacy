import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to pack stats into uint72 (9 x 8 bits)
function packBaseStats(stats: number[]): bigint {
    let packed = 0n;
    for (let i = 0; i < 9; i++) {
        packed |= BigInt(stats[i]) << BigInt(i * 8);
    }
    return packed;
}

// Helper to pack growth rates into uint144 (9 x 16 bits)
function packGrowthRates(rates: number[]): bigint {
    let packed = 0n;
    for (let i = 0; i < 9; i++) {
        packed |= BigInt(rates[i]) << BigInt(i * 16);
    }
    return packed;
}

// Helper to pack aptitudes into uint64 (8 x 8 bits)
function packAptitudes(apts: number[]): bigint {
    let packed = 0n;
    for (let i = 0; i < 8; i++) {
        packed |= BigInt(apts[i]) << BigInt(i * 8);
    }
    return packed;
}

// Move struct: { moveId, moveType, category, power, accuracy, cooldownMax, statusEffect, statusChance }
interface MoveStruct {
    moveId: number;
    moveType: number;    // 0=FIRE, 1=WATER, 2=GRASS, 3=ELECTRIC, 4=ICE, 5=EARTH, 6=DARK, 7=LIGHT
    category: number;    // 0=Physical, 1=Special, 2=Status
    power: number;
    accuracy: number;
    cooldownMax: number;
    statusEffect: number; // 0=None, 1=Burn, 2=Freeze, 3=Poison, 4=Paralyze, 5=Stun, 6=Blind, 7=Fear
    statusChance: number;
}

// Convert to ethers.js format - use array matching struct field order
function moveToSolidity(m: MoveStruct): number[] {
    return [m.moveId, m.moveType, m.category, m.power, m.accuracy, m.cooldownMax, m.statusEffect, m.statusChance];
}

// Empty move for unused slots
function emptyMove(): MoveStruct {
    return { moveId: 0, moveType: 0, category: 0, power: 0, accuracy: 0, cooldownMax: 0, statusEffect: 0, statusChance: 0 };
}

// Move database (subset for testing)
const MOVES: Record<string, MoveStruct> = {
    // Fire moves
    ember: { moveId: 1, moveType: 0, category: 1, power: 50, accuracy: 100, cooldownMax: 0, statusEffect: 1, statusChance: 10 },
    flamethrower: { moveId: 2, moveType: 0, category: 1, power: 90, accuracy: 85, cooldownMax: 1, statusEffect: 1, statusChance: 20 },
    fire_fang: { moveId: 4, moveType: 0, category: 0, power: 65, accuracy: 95, cooldownMax: 0, statusEffect: 1, statusChance: 10 },
    inferno: { moveId: 3, moveType: 0, category: 1, power: 130, accuracy: 60, cooldownMax: 3, statusEffect: 1, statusChance: 50 },
    // Water moves
    water_gun: { moveId: 11, moveType: 1, category: 1, power: 50, accuracy: 100, cooldownMax: 0, statusEffect: 0, statusChance: 0 },
    aqua_jet: { moveId: 12, moveType: 1, category: 0, power: 45, accuracy: 100, cooldownMax: 0, statusEffect: 0, statusChance: 0 },
    hydro_pump: { moveId: 13, moveType: 1, category: 1, power: 120, accuracy: 70, cooldownMax: 3, statusEffect: 0, statusChance: 0 },
    surf: { moveId: 14, moveType: 1, category: 1, power: 85, accuracy: 90, cooldownMax: 1, statusEffect: 0, statusChance: 0 },
    // Neutral
    tackle: { moveId: 101, moveType: 5, category: 0, power: 40, accuracy: 100, cooldownMax: 0, statusEffect: 0, statusChance: 0 },
};

async function main() {
    // Connect to local Hardhat node
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

    // Use first account (has 10000 ETH)
    const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const deployer = new ethers.Wallet(privateKey, provider);

    console.log("Deploying contracts with account:", deployer.address);
    console.log("Balance:", ethers.formatEther(await provider.getBalance(deployer.address)), "ETH");

    // Get current nonce
    let nonce = await provider.getTransactionCount(deployer.address);
    console.log("Starting nonce:", nonce);

    // Read compiled contract
    const artifactPath = path.join(__dirname, "../artifacts-hh/src/RMRKCreature.sol/RMRKCreature.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    // Deploy RMRKCreature
    console.log("\n📦 Deploying RMRKCreature...");
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    const creature = await factory.deploy({ nonce: nonce++ });
    await creature.waitForDeployment();
    const creatureAddress = await creature.getAddress();
    console.log("✅ RMRKCreature deployed to:", creatureAddress);

    // Set deployer as contributor
    console.log("\n🔐 Setting deployer as contributor...");
    const tx1 = await (creature as any).manageContributor(deployer.address, true, { nonce: nonce++ });
    await tx1.wait();
    console.log("✅ Deployer can now mint creatures");

    // Mint a test creature with full stats
    console.log("\n🐉 Minting test creature (FIRE)...");
    const genSeed = ethers.encodeBytes32String("test-seed-1234");
    const personality = ethers.encodeBytes32String("BRAVE");
    const elementType = ethers.encodeBytes32String("FIRE");
    const temperament = ethers.encodeBytes32String("CALM");

    // Base stats: STR, AGI, SPD, REF, END, VIT, INT, PRC, RGN
    const baseStats = packBaseStats([55, 50, 48, 45, 52, 60, 40, 47, 35]);

    // Growth rates (x1000): e.g., 1.0 = 1000, 0.8 = 800
    const growthRates = packGrowthRates([1000, 900, 850, 800, 950, 1100, 150, 850, 750]);

    // 4 moves with full data - convert to objects for ethers.js
    const moves1 = [
        moveToSolidity(MOVES.ember),
        moveToSolidity(MOVES.flamethrower),
        moveToSolidity(MOVES.fire_fang),
        moveToSolidity(MOVES.inferno)
    ];
    const moveCount1 = 4;
    const mastery1 = [15, 20, 12, 25]; // 85 + value = actual mastery

    // Aptitudes (90-110 range): FIRE, WATER, GRASS, ELECTRIC, ICE, EARTH, DARK, LIGHT
    const aptitudes = packAptitudes([105, 95, 100, 100, 90, 100, 100, 100]);

    console.log("Debug params:");
    console.log("  moves1:", JSON.stringify(moves1, null, 2));
    console.log("  moveCount1:", moveCount1);
    console.log("  mastery1:", mastery1);
    console.log("  baseStats:", baseStats.toString());
    console.log("  growthRates:", growthRates.toString());
    console.log("  aptitudes:", aptitudes.toString());

    const tx2 = await (creature as any).mintCreature(
        deployer.address,
        genSeed,
        75,  // talent
        personality,
        elementType,
        temperament,
        baseStats,
        growthRates,
        moves1,
        moveCount1,
        mastery1,
        aptitudes,
        { nonce: nonce++ }
    );
    await tx2.wait();
    console.log("✅ Test creature minted with full moves!");

    // Mint a second creature for testing (WATER)
    console.log("\n🐉 Minting second creature (WATER)...");
    const genSeed2 = ethers.encodeBytes32String("test-seed-5678");
    const personality2 = ethers.encodeBytes32String("CALM");
    const elementType2 = ethers.encodeBytes32String("WATER");
    const temperament2 = ethers.encodeBytes32String("NEUTRAL");
    const baseStats2 = packBaseStats([45, 55, 52, 50, 48, 55, 50, 52, 40]);
    const growthRates2 = packGrowthRates([850, 1000, 950, 900, 850, 1000, 150, 900, 800]);

    // 4 water moves - convert to objects for ethers.js
    const moves2 = [
        moveToSolidity(MOVES.water_gun),
        moveToSolidity(MOVES.aqua_jet),
        moveToSolidity(MOVES.hydro_pump),
        moveToSolidity(MOVES.surf)
    ];
    const moveCount2 = 4;
    const mastery2 = [18, 15, 22, 10]; // 85 + value = actual mastery

    const aptitudes2 = packAptitudes([90, 110, 95, 100, 105, 100, 100, 100]);

    const tx3 = await (creature as any).mintCreature(
        deployer.address,
        genSeed2,
        68,
        personality2,
        elementType2,
        temperament2,
        baseStats2,
        growthRates2,
        moves2,
        moveCount2,
        mastery2,
        aptitudes2,
        { nonce: nonce++ }
    );
    await tx3.wait();
    console.log("✅ Second creature minted with full moves!");

    console.log("\n" + "=".repeat(50));
    console.log("Contract Addresses:");
    console.log("  RMRKCreature:", creatureAddress);
    console.log("=".repeat(50));

    // Test getLiveStats
    console.log("\n📊 Testing getLiveStats for creature #1...");
    const stats = await (creature as any).getLiveStats(1);
    console.log("Stats:", stats);

    // Save addresses for frontend
    const addresses = {
        RMRKCreature: creatureAddress,
        chainId: 31337
    };
    fs.writeFileSync(
        path.join(__dirname, "../deployed-addresses.json"),
        JSON.stringify(addresses, null, 2)
    );
    console.log("\n✅ Addresses saved to deployed-addresses.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
