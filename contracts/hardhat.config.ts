import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.21",
                settings: {
                    viaIR: true,
                    optimizer: {
                        enabled: true,
                        runs: 1  // Minimal runs for smallest bytecode
                    }
                }
            },
            {
                version: "0.8.24",
                settings: {
                    viaIR: true,  // Enable IR for better optimization
                    optimizer: {
                        enabled: true,
                        runs: 1  // Minimal runs for smallest bytecode
                    }
                }
            }
        ]
    },
    networks: {
        localhost: {
            url: "http://127.0.0.1:8545"
        }
    },
    paths: {
        sources: "./src",
        tests: "./test",
        cache: "./cache-hh",
        artifacts: "./artifacts-hh"
    }
};

export default config;
