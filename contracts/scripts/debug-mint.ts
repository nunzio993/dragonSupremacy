import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

    // Load addresses
    const addresses = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../deployed-addresses.json"), "utf8"
    ));

    console.log("=== Debugging Mint Configuration ===\n");

    // Check MintGate signer
    const mintGateAbi = ['function signer() view returns (address)', 'function gameConfig() view returns (address)', 'function creatureContract() view returns (address)', 'function airdropVault() view returns (address)'];
    const mintGate = new ethers.Contract(addresses.MintGateV2, mintGateAbi, provider);

    console.log("MintGateV2:", addresses.MintGateV2);
    console.log("  signer:", await mintGate.signer());
    console.log("  gameConfig:", await mintGate.gameConfig());
    console.log("  creatureContract:", await mintGate.creatureContract());
    console.log("  airdropVault:", await mintGate.airdropVault());

    // Check GameConfig
    const gameConfigAbi = ['function mintTreasury() view returns (address)', 'function dragonToken() view returns (address)', 'function mintCostDGNE() view returns (uint256)'];
    const gameConfig = new ethers.Contract(addresses.GameConfig, gameConfigAbi, provider);

    console.log("\nGameConfig:", addresses.GameConfig);
    console.log("  mintTreasury:", await gameConfig.mintTreasury());
    console.log("  dragonToken:", await gameConfig.dragonToken());
    console.log("  mintCostDGNE:", ethers.formatEther(await gameConfig.mintCostDGNE()), "DGNE");

    // Check RMRKCreature minter authorization
    const creatureAbi = ['function authorizedMinters(address) view returns (bool)'];
    const creature = new ethers.Contract(addresses.RMRKCreature, creatureAbi, provider);

    console.log("\nRMRKCreature:", addresses.RMRKCreature);
    console.log("  MintGateV2 authorized:", await creature.authorizedMinters(addresses.MintGateV2));

    // Check user DGNE balance and allowance
    const user = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const dgneAbi = ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)'];
    const dgne = new ethers.Contract(addresses.DragonToken, dgneAbi, provider);

    console.log("\nUser:", user);
    console.log("  DGNE balance:", ethers.formatEther(await dgne.balanceOf(user)), "DGNE");
    console.log("  Allowance to MintGate:", ethers.formatEther(await dgne.allowance(user, addresses.MintGateV2)), "DGNE");
}

main()
    .then(() => process.exit(0))
    .catch(console.error);
