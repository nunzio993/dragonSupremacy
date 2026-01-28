// Update mint costs - ES Module format per Hardhat
import hre from "hardhat";

async function main() {
    const { ethers } = hre;

    // Get GameConfig contract
    const gc = await ethers.getContractAt("GameConfig", "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707");

    console.log("Current mint cost:", await gc.mintCostDGNE());

    // 1000 DGNE = 1000 * 10^18
    const mintCost = 1000n * 10n ** 18n;
    const skipCost = 100n * 10n ** 18n;
    const rmrkCost = 10n * 10n ** 18n;

    // Update costs: mint=1000, skip=100, rmrk=10
    const tx1 = await gc.setMintCosts(mintCost, skipCost, rmrkCost);
    await tx1.wait();
    console.log("setMintCosts done");

    // Set treasury (first deployer account)
    const tx2 = await gc.setMintTreasury("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    await tx2.wait();
    console.log("setMintTreasury done");

    console.log("Updated successfully!");
    console.log("New mint cost:", await gc.mintCostDGNE());
    console.log("Skip cost:", await gc.skipCostDGNE());
    console.log("Treasury:", await gc.mintTreasury());
}

main().catch(console.error);
