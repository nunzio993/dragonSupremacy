import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const deployer = new ethers.Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider
    );

    const addresses = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../deployed-addresses.json"), "utf8"
    ));

    const dragonTokenAbi = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../artifacts-hh/src/DragonToken.sol/DragonToken.json"), "utf8"
    )).abi;

    const rmrkCreatureAbi = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../artifacts-hh/src/RMRKCreature.sol/RMRKCreature.json"), "utf8"
    )).abi;

    const battleGateAbi = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../artifacts-hh/src/BattleGate.sol/BattleGate.json"), "utf8"
    )).abi;

    const dragonToken = new ethers.Contract(addresses.DragonToken, dragonTokenAbi, deployer);
    const rmrkCreature = new ethers.Contract(addresses.RMRKCreature, rmrkCreatureAbi, deployer);
    const battleGate = new ethers.Contract(addresses.BattleGate, battleGateAbi, deployer);

    let nonce = await provider.getTransactionCount(deployer.address);
    console.log("Starting nonce:", nonce);
    console.log("\n🔧 Post-Deploy Configuration\n");

    // BattleGate as DGNE minter
    console.log("1. Authorizing BattleGate as DGNE minter...");
    await (await dragonToken.setMinter(addresses.BattleGate, true, { nonce: nonce++ })).wait();
    console.log("   ✓ Done");

    // Deployer as operator
    console.log("2. Setting deployer as BattleGate operator...");
    await (await battleGate.setOperator(deployer.address, true, { nonce: nonce++ })).wait();
    console.log("   ✓ Done");

    // Hardhat accounts
    const accounts = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    ];

    console.log("3. Authorizing test accounts...");
    for (const acc of accounts) {
        const isContrib = await rmrkCreature.isContributor(acc);
        if (!isContrib) {
            await (await rmrkCreature.manageContributor(acc, true, { nonce: nonce++ })).wait();
        }
        const isMinter = await rmrkCreature.authorizedMinters(acc);
        if (!isMinter) {
            await (await rmrkCreature.setMinter(acc, true, { nonce: nonce++ })).wait();
        }
    }
    console.log("   ✓ Done");

    console.log("\n✅ Configuration complete!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
