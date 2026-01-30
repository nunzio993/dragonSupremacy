// Quick script to configure BattleGateV2 with AirdropVault
import hre from "hardhat";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const battleGateV2Addr = "0x0E801D84Fa97b50751Dbf25036d067dCf18858bF";
    const airdropVaultAddr = "0x7bc06c482DEAd17c0e297aFbC32f6e63d3846650";

    // Get BattleGateV2 contract
    const BattleGateV2 = await hre.ethers.getContractAt("BattleGateV2", battleGateV2Addr);

    // Check current airdropVault
    const currentVault = await BattleGateV2.airdropVault();
    console.log("Current airdropVault:", currentVault);

    if (currentVault === "0x0000000000000000000000000000000000000000") {
        console.log("Setting airdropVault...");
        const tx = await BattleGateV2.setAirdropVault(airdropVaultAddr);
        await tx.wait();
        console.log("✓ AirdropVault set!");
    } else {
        console.log("AirdropVault already set");
    }

    // Verify
    const newVault = await BattleGateV2.airdropVault();
    console.log("AirdropVault:", newVault);
}

main().catch(console.error);
