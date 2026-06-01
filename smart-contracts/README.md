# Sample Hardhat 3 Beta Project (`mocha` and `ethers`)

This project showcases a Hardhat 3 Beta project using `mocha` for tests and the `ethers` library for Ethereum interactions.

To learn more about the Hardhat 3 Beta, please visit the [Getting Started guide](https://hardhat.org/docs/getting-started#getting-started-with-hardhat-3). To share your feedback, join our [Hardhat 3 Beta](https://hardhat.org/hardhat3-beta-telegram-group) Telegram group or [open an issue](https://github.com/NomicFoundation/hardhat/issues/new) in our GitHub issue tracker.

# 🚀 Deploying Referral System to Somnia Testnet...
=================================================
📝 Deployer address: 0x2c3b2B2325610a6814f2f822D0bF4DAB8CF16e16
💰 Balance: 34.287835862 STT

📦 Step 1: Deploying UserRegistry...
✅ UserRegistry deployed to: 0x60f79962Ed084E6c41866f2E9C8c7482808064B3

📦 Step 2: Deploying ReferralBadge...
✅ ReferralBadge deployed to: 0x5dd3fec607Ea107aC7AF726fA09f69BBE06a344a

📦 Step 3: Deploying ReferralDynasty...
   Using badge address: 0x5dd3fec607Ea107aC7AF726fA09f69BBE06a344a
✅ ReferralDynasty deployed to: 0xb7395bC4Bc6985Bb2465fBdd8C80A0888d143511

📦 Step 4: Transferring badge ownership to dynasty...
   Before - Badge owner: 0x2c3b2B2325610a6814f2f822D0bF4DAB8CF16e16
   After  - Badge owner: 0xb7395bC4Bc6985Bb2465fBdd8C80A0888d143511
✅ Ownership transferred successfully

📦 Step 5: Setting UserRegistry as trusted emitter...
✅ Registry trusted: true

📦 Step 6: Verifying event topic alignment...
   Expected topic  : 0x2138b9314634f9fdd5e49bee3eaf17ca557b6637524d0db759711c3bfcd3d850
   Computed topic  : 0x2138b9314634f9fdd5e49bee3eaf17ca557b6637524d0db759711c3bfcd3d850
✅ Event topic verified

📋 DEPLOYMENT SUMMARY
====================
UserRegistry     : 0x60f79962Ed084E6c41866f2E9C8c7482808064B3
ReferralBadge    : 0x5dd3fec607Ea107aC7AF726fA09f69BBE06a344a
ReferralDynasty  : 0xb7395bC4Bc6985Bb2465fBdd8C80A0888d143511
Badge owner      : 0xb7395bC4Bc6985Bb2465fBdd8C80A0888d143511
Dynasty owner    : 0x2c3b2B2325610a6814f2f822D0bF4DAB8CF16e16
Trusted emitter  : true
Event topic      : 0x2138b9314634f9fdd5e49bee3eaf17ca557b6637524d0db759711c3bfcd3d850

📄 Deployment info saved to deployment-referral-system.json

📋 NEXT STEPS
============
1. Create a reactivity subscription:
   npx hardhat run scripts/create-subscription-500k.ts --network somniaTestnet

2. Test the flow:
   npx hardhat run scripts/test-referral-flow.ts --network somniaTestnet


# 🚀 Creating Subscription with 2M GAS...
=========================================

📋 Handler  (Dynasty) : 0xb7395bC4Bc6985Bb2465fBdd8C80A0888d143511
📋 Emitter  (Registry): 0x60f79962Ed084E6c41866f2E9C8c7482808064B3
📋 Event topic        : 0x2138b9314634f9fdd5e49bee3eaf17ca557b6637524d0db759711c3bfcd3d850
💰 Balance: 33.97533095 SOM

📦 Creating subscription...
✅ SUBSCRIPTION CREATED!
📝 Transaction Hash: 0x234fe26b22fca78a579f1249dd1614dac02d3f1d1720795e7f8f32ac5b4a31a2
🔗 Explorer: https://shannon-explorer.somnia.network/tx/0x234fe26b22fca78a579f1249dd1614dac02d3f1d1720795e7f8f32ac5b4a31a2
✅ Confirmed in block 334493415
📄 deployment-referral-system.json updated with subscriptionTx

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



