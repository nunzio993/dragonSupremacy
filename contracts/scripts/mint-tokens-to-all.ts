/**
 * Mint tokens to all test accounts - Simple version
 */
import { ethers } from "ethers";
import * as fs from "fs";

const ERC20_ABI = [
    "function mint(address to, uint256 amount) external",
    "function balanceOf(address) view returns (uint256)"
];

async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const accounts = await provider.send("eth_accounts", []);

    const deployer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
    const account1 = accounts[1];

    console.log("Minting tokens to second account:", account1);

    // Load deployed addresses
    const addresses = JSON.parse(fs.readFileSync("deployed-addresses.json", "utf-8"));

    // Get contracts
    const dragonToken = new ethers.Contract(addresses.DragonToken, ERC20_ABI, deployer);
    const mockRMRK = new ethers.Contract(addresses.MockRMRK, ERC20_ABI, deployer);

    // Mint 1000 DGNE to account1
    const tx1 = await dragonToken.mint(account1, ethers.parseEther("1000"));
    await tx1.wait();
    console.log("✅ Minted 1000 DGNE to", account1);

    // Mint 100 RMRK to account1
    const tx2 = await mockRMRK.mint(account1, ethers.parseEther("100"));
    await tx2.wait();
    console.log("✅ Minted 100 RMRK to", account1);

    console.log("\n✅ Second account setup complete!");
}

main().catch(console.error);
