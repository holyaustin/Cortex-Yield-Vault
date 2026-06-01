import { defineConfig, configVariable } from "hardhat/config";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import * as dotenv from "dotenv";

import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatTypechain from "@nomicfoundation/hardhat-typechain";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const SOMNIA_RPC_URL =
  process.env.SOMNIA_RPC_URL || "https://dream-rpc.somnia.network";
const SOMNIA_API_KEY = process.env.SOMNIA_API_KEY || "";

export default defineConfig({
  plugins: [
    hardhatToolboxMochaEthersPlugin,
    hardhatEthers,
    hardhatTypechain,
    hardhatMocha,
    hardhatEthersChaiMatchers,
    hardhatNetworkHelpers,
  ],

  solidity: {
    profiles: {
      default: {
        version: "0.8.30",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    },
  },

  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    somniaTestnet: {
      type: "http",
      chainType: "l1",
      url: SOMNIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 50312,
      gas: "auto",
      gasPrice: "auto",
    },
  },

  verify: {
    etherscan: {
      apiKey: SOMNIA_API_KEY,
    },
  },

  chainDescriptors: {
    50312: {
      name: "Somnia Testnet",
      blockExplorers: {
        etherscan: {
          name: "Somnia Explorer",
          url: "https://testnet-explorer.somnia.network",
          apiUrl: "https://testnet-explorer.somnia.network/api",
        },
      },
    },
  },
});