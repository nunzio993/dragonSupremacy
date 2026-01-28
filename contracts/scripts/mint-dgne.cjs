const hre = require('hardhat');

async function main() {
    const DragonToken = await hre.ethers.getContractAt(
        "DragonToken",
        "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
    );

    // Mint 1000 DGNE to deployer
    const tx = await DragonToken.mint(
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        hre.ethers.parseEther("1000")
    );
    await tx.wait();
    console.log("✅ Minted 1000 DGNE");

    const balance = await DragonToken.balanceOf("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    console.log("Balance:", hre.ethers.formatEther(balance), "DGNE");
}

main().catch(console.error);
