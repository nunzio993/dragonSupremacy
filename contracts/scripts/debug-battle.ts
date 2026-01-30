import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

    const addresses = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../deployed-addresses.json"), "utf8"
    ));

    const user = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const creatureId = 2;

    console.log("=== Debug Battle Creation ===\n");

    // Check DGNE balance and allowance
    const dgneAbi = ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)'];
    const dgne = new ethers.Contract(addresses.DragonToken, dgneAbi, provider);

    console.log("User:", user);
    console.log("  DGNE balance:", ethers.formatEther(await dgne.balanceOf(user)), "DGNE");
    console.log("  Allowance to BattleGate:", ethers.formatEther(await dgne.allowance(user, addresses.BattleGateV2)), "DGNE");

    // Check creature ownership
    const creatureAbi = ['function ownerOf(uint256) view returns (address)'];
    const creature = new ethers.Contract(addresses.RMRKCreature, creatureAbi, provider);

    try {
        const owner = await creature.ownerOf(creatureId);
        console.log("\nCreature #" + creatureId + " owner:", owner);
        console.log("  Owned by user:", owner.toLowerCase() === user.toLowerCase());
    } catch (e) {
        console.log("\nCreature #" + creatureId + " does not exist!");
    }

    // Check if user is already in battle
    const battleAbi = ['function isInBattle(address) view returns (bool)', 'function getPlayerBattle(address) view returns (bytes32)'];
    const battle = new ethers.Contract(addresses.BattleGateV2, battleAbi, provider);

    console.log("\nBattle status:");
    console.log("  isInBattle:", await battle.isInBattle(user));
    console.log("  playerBattle:", await battle.getPlayerBattle(user));

    // Check AirdropVault locked balance
    const vaultAbi = ['function getLockedBalance(address) view returns (uint256)'];
    const vault = new ethers.Contract(addresses.AirdropVault, vaultAbi, provider);
    console.log("\nAirdrop locked balance:", ethers.formatEther(await vault.getLockedBalance(user)), "DGNE");
}

main().catch(console.error);
