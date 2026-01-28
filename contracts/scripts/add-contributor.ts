import { Wallet, Contract, JsonRpcProvider } from "ethers";
import * as fs from "fs";

async function main() {
    const provider = new JsonRpcProvider("http://127.0.0.1:8545");

    // Use Account #0 (deployer) to add contributors
    const deployer = new Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider
    );

    // Read contract address from deployed-addresses.json
    const addresses = JSON.parse(fs.readFileSync("deployed-addresses.json", "utf-8"));
    const contractAddress = addresses.RMRKCreature;
    console.log("Using RMRKCreature at:", contractAddress);

    // Minimal ABI for manageContributor
    const abi = [
        "function manageContributor(address contributor, bool grantRole) external"
    ];

    const contract = new Contract(contractAddress, abi, deployer);

    // Hardhat Account #1 and #2
    const account1 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const account2 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

    console.log("Adding Account #1 as contributor...");
    const tx1 = await contract.manageContributor(account1, true);
    await tx1.wait();
    console.log("✅ Account #1 added:", account1);

    console.log("Adding Account #2 as contributor...");
    const tx2 = await contract.manageContributor(account2, true);
    await tx2.wait();
    console.log("✅ Account #2 added:", account2);

    console.log("\n🎉 Both accounts can now mint creatures!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
