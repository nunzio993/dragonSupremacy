// Update mint costs - ES Module format
import hre from "hardhat";

async function main() {
    const { ethers } = hre;

    // 1000 DGNE = 1000 * 10^18
    const mintCost = BigInt("1000000000000000000000");  // 1000 ether
    const skipCost = BigInt("100000000000000000000");   // 100 ether
    const rmrkCost = BigInt("10000000000000000000");    // 10 ether
    const treasury = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    // Get GameConfig contract
    const gc = await ethers.getContractAt("GameConfig", "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707");

    console.log("Current mint cost:", await gc.mintCostDGNE());

    // Update costs
    console.log("Setting mint costs...");
    const tx1 = await gc.setMintCosts(mintCost, skipCost, rmrkCost);
    await tx1.wait();
    console.log("setMintCosts done");

    // Set treasury
    console.log("Setting mint treasury...");
    const tx2 = await gc.setMintTreasury(treasury);
    await tx2.wait();
    console.log("setMintTreasury done");

    console.log("\n=== Updated successfully! ===");
    console.log("New mint cost:", await gc.mintCostDGNE());
    console.log("Skip cost:", await gc.skipCostDGNE());
    console.log("Treasury:", await gc.mintTreasury());
}

main().catch(console.error);
