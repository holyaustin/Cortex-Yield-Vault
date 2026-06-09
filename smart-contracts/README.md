# Sample Hardhat 3 Beta Project (`mocha` and `ethers`)

This project showcases a Hardhat 3 Beta project using `mocha` for tests and the `ethers` library for Ethereum interactions.

To learn more about the Hardhat 3 Beta, please visit the [Getting Started guide](https://hardhat.org/docs/getting-started#getting-started-with-hardhat-3). To share your feedback, join our [Hardhat 3 Beta](https://hardhat.org/hardhat3-beta-telegram-group) Telegram group or [open an issue](https://github.com/NomicFoundation/hardhat/issues/new) in our GitHub issue tracker.

# 🚀 📋 Deployment Summary:
======================
Network: somniaTestnet
Chain ID: 50312
Block: 401535693

📝 Contract Addresses:
   SimpleYieldStrategy: 0x7f8937232BDc40aa8dc19Fc2B845AfF6C7cf0B4F
   CortexYieldVault:    0xf3B11f845933DB462daf111337AbE7890305Ea51

👤 Owner: 0x2c3b2B2325610a6814f2f822D0bF4DAB8CF16e16

🤖 Somnia Agent Configuration:
   Platform Contract (Testnet): 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776
   LLM Agent ID:                12847293847561029384
   JSON Agent ID:               13174292974160097713
   Required Deposit:            0.24 STT
   - MIN_DEPOSIT_RESERVE:       0.01 STT
   - LLM_PER_AGENT_PRICE:       0.07 STT
   - JSON_PER_AGENT_PRICE:      0.03 STT
   - SUBCOMMITTEE_SIZE:         3

🔗 Explorer URLs:
   Strategy: https://shannon-explorer.somnia.network/address/0x7f8937232BDc40aa8dc19Fc2B845AfF6C7cf0B4F
   Vault:    https://shannon-explorer.somnia.network/address/0xf3B11f845933DB462daf111337AbE7890305Ea51

npx hardhat verify --network somniaTestnet 0x7f8937232BDc40aa8dc19Fc2B845AfF6C7cf0B4F

## Project Overview

This example project includes:

- A simple Hardhat configuration file.
- Foundry-compatible Solidity unit tests.
- TypeScript integration tests using `mocha` and ethers.js
- Examples demonstrating how to connect to different types of networks, including locally simulating OP mainnet.

## Usage

### Running Tests

To run all the tests in the project, execute the following command:

```shell
npx hardhat test
```

You can also selectively run the Solidity or `mocha` tests:

```shell
npx hardhat test solidity
npx hardhat test mocha
```

### Make a deployment to Sepolia

This project includes an example Ignition module to deploy the contract. You can deploy this module to a locally simulated chain or to Sepolia.

To run the deployment to a local chain:

```shell
npx hardhat ignition deploy ignition/modules/Counter.ts
```

To run the deployment to Sepolia, you need an account with funds to send the transaction. The provided Hardhat configuration includes a Configuration Variable called `SEPOLIA_PRIVATE_KEY`, which you can use to set the private key of the account you want to use.

You can set the `SEPOLIA_PRIVATE_KEY` variable using the `hardhat-keystore` plugin or by setting it as an environment variable.

To set the `SEPOLIA_PRIVATE_KEY` config variable using `hardhat-keystore`:

```shell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

After setting the variable, you can run the deployment with the Sepolia network:

```shell
npx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
```



