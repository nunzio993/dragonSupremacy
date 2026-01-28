// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockRMRK
 * @author NFT Autobattler Team
 * @notice Mock ERC20 token for local development and testing ONLY.
 * 
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  WARNING: DO NOT USE IN PRODUCTION!                                  ║
 * ║                                                                           ║
 * ║  This contract is a placeholder for the real RMRK token.                 ║
 * ║                                                                           ║
 * ║  BEFORE DEPLOYING TO MAINNET:                                            ║
 * ║  1. Replace this address with the real RMRK token address                ║
 * ║  2. Update GameConfig.sol via setRmrkToken()                             ║
 * ║  3. Verify BattleGate uses the correct RMRK address                      ║
 * ║                                                                           ║
 * ║  RMRK Token Addresses:                                                   ║
 * ║  - Ethereum Mainnet: 0x524B969793a64A602342d89BC2789D43a016B13A           ║
 * ║  - Base: Check RMRK official docs for bridged address                    ║
 * ║  - Base Sepolia: Deploy official RMRK mock or use bridge                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */
contract MockRMRK is ERC20 {
    constructor() ERC20("Mock RMRK Token", "RMRK") {
        // Mint initial supply to deployer for testing
        _mint(msg.sender, 1_000_000 * 10**18);
    }

    /**
     * @notice Public mint function for testing purposes
     * @dev In production, RMRK tokens must be acquired through exchanges or bridges
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens (matches DragonToken interface for consistency)
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
