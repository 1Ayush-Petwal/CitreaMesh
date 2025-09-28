#!/usr/bin/env node
// Deploy Real Hyperlane Contracts using Foundry
// Usage: PRIVATE_KEY=0x... node scripts/deploy_with_foundry.js

import { execSync } from 'child_process';
import { ethers } from 'ethers';
import path from 'path';
import os from 'os';
import fs from 'fs';

async function main() {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error('Error: PRIVATE_KEY required');
        process.exit(1);
    }
    
    console.log('🚀 Deploying Real Hyperlane Contracts with Foundry');
    console.log('==================================================');
    
    const sepoliaRPC = 'https://sepolia.rpc.thirdweb.com';
    const citreaRPC = 'https://rpc.testnet.citrea.xyz';
    
    const usdcAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
    const sepoliaMailbox = '0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766';
    const citreaMailbox = '0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766';
    
    const wallet = new ethers.Wallet(privateKey);
    console.log('Deployer:', wallet.address);
    console.log();
    
    // Step 1: Deploy Collateral Contract on Sepolia
    console.log('🔧 Step 1: Deploying HypERC20Collateral on Sepolia...');
    try {
        const collateralCmd = `forge create src/contracts/HypERC20Collateral.sol:HypERC20Collateral ` +
            `--rpc-url ${sepoliaRPC} ` +
            `--private-key ${privateKey} ` +
            `--constructor-args ${usdcAddress} ${sepoliaMailbox} ${wallet.address} ` +
            `--gas-limit 2000000 ` +
            `--broadcast`;
        
        const collateralOutput = execSync(collateralCmd, { encoding: 'utf-8' });
        console.log('Collateral deployment output:', collateralOutput);
        
        // Extract contract address from output
        const collateralMatch = collateralOutput.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
        if (!collateralMatch) {
            throw new Error('Could not extract collateral contract address');
        }
        const collateralAddress = collateralMatch[1];
        console.log('✅ HypERC20Collateral deployed at:', collateralAddress);
        
        // Store for later use
        global.collateralAddress = collateralAddress;
        
    } catch (error) {
        console.error('❌ Collateral deployment failed:', error.message);
        console.log('Output:', error.stdout?.toString());
        process.exit(1);
    }
    
    console.log();
    
    // Step 2: Deploy Synthetic Contract on Citrea
    console.log('🔧 Step 2: Deploying HypERC20 on Citrea...');
    try {
        const syntheticCmd = `forge create src/contracts/HypERC20.sol:HypERC20 ` +
            `--rpc-url ${citreaRPC} ` +
            `--private-key ${privateKey} ` +
            `--constructor-args ${citreaMailbox} ${wallet.address} ` +
            `--gas-limit 3000000 ` +
            `--broadcast`;
        
        const syntheticOutput = execSync(syntheticCmd, { encoding: 'utf-8' });
        console.log('Synthetic deployment output:', syntheticOutput);
        
        // Extract contract address from output
        const syntheticMatch = syntheticOutput.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
        if (!syntheticMatch) {
            throw new Error('Could not extract synthetic contract address');
        }
        const syntheticAddress = syntheticMatch[1];
        console.log('✅ HypERC20 deployed at:', syntheticAddress);
        
        // Store for later use
        global.syntheticAddress = syntheticAddress;
        
    } catch (error) {
        console.error('❌ Synthetic deployment failed:', error.message);
        console.log('Output:', error.stdout?.toString());
        process.exit(1);
    }
    
    console.log();
    console.log('🎉 Real Hyperlane Contracts Deployed Successfully!');
    console.log('==================================================');
    console.log('Sepolia Collateral:', global.collateralAddress);
    console.log('Citrea Synthetic  :', global.syntheticAddress);
    console.log();
    console.log('Next: Configure cross-chain routing between the contracts');
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});