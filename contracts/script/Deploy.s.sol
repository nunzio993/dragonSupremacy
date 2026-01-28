// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CreatureNFT.sol";
import "../src/BattleArena.sol";

/**
 * @title Deploy Script
 * @dev Deploys CreatureNFT and BattleArena to Base Sepolia
 */
contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy CreatureNFT
        CreatureNFT creatureNFT = new CreatureNFT();
        console.log("CreatureNFT deployed at:", address(creatureNFT));
        
        // Deploy BattleArena
        BattleArena battleArena = new BattleArena(address(creatureNFT));
        console.log("BattleArena deployed at:", address(battleArena));
        
        // Authorize BattleArena to add XP to creatures
        creatureNFT.authorizeMinter(address(battleArena));
        console.log("BattleArena authorized as minter");
        
        vm.stopBroadcast();
        
        // Log deployment info
        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("Network: Base Sepolia");
        console.log("CreatureNFT:", address(creatureNFT));
        console.log("BattleArena:", address(battleArena));
    }
}
