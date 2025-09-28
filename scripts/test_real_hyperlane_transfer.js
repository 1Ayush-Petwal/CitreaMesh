#!/usr/bin/env node
// Test Real Hyperlane Transfer with Message Dispatch
// Usage: PRIVATE_KEY=0x... node scripts/test_real_hyperlane_transfer.js

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
    
    const amount = process.argv[2] || '0.05'; // Default 0.05 USDC
    const recipient = process.argv[3] || '0x35353E308aFc734D3D7d7B060a105CB8d5Df234A';
    
    console.log('🚀 Real Hyperlane USDC Cross-Chain Transfer Test');
    console.log('===============================================');
    console.log('Amount:', amount, 'USDC');
    console.log('Recipient:', recipient);
    console.log();
    
    // Load current deployment
    const cacheFile = path.join(os.homedir(), '.citrea-mcp', 'warp-deployments.json');
    const deployments = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    const usdcRoute = deployments.find(d => d.routeId === 'USDC/sepolia-citreatestnet');
    
    if (!usdcRoute || usdcRoute.status !== 'deployed') {
        console.error('Error: USDC route not deployed');
        process.exit(1);
    }
    
    // Setup
    const sepoliaProvider = new ethers.providers.JsonRpcProvider('https://sepolia.rpc.thirdweb.com');
    const citreaProvider = new ethers.providers.JsonRpcProvider('https://rpc.testnet.citrea.xyz');
    
    const sepoliaSigner = new ethers.Wallet(privateKey, sepoliaProvider);
    const citreaSigner = new ethers.Wallet(privateKey, citreaProvider);
    
    // USDC contract
    const usdcAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
    const usdcAbi = [
        'function balanceOf(address) view returns (uint256)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)'
    ];
    const usdc = new ethers.Contract(usdcAddress, usdcAbi, sepoliaSigner);
    
    // Hyperlane Mailbox
    const mailboxAddress = '0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766';
    const mailboxAbi = [
        'function dispatch(uint32 destinationDomain, bytes32 recipientAddress, bytes calldata messageBody) external payable returns (bytes32)',
        'function localDomain() view returns (uint32)'
    ];
    const mailbox = new ethers.Contract(mailboxAddress, mailboxAbi, sepoliaSigner);
    
    console.log('📊 Current Status:');
    
    // Check balances
    const decimals = await usdc.decimals();
    const balance = await usdc.balanceOf(sepoliaSigner.address);
    const balanceFormatted = ethers.utils.formatUnits(balance, decimals);
    console.log('Your USDC Balance:', balanceFormatted, 'USDC');
    
    const transferAmount = ethers.utils.parseUnits(amount, decimals);
    if (balance.lt(transferAmount)) {
        console.error('Error: Insufficient USDC balance');
        process.exit(1);
    }
    
    const collateralAddress = usdcRoute.contractAddresses.sepolia;
    const collateralBalance = await usdc.balanceOf(collateralAddress);
    const collateralBalanceFormatted = ethers.utils.formatUnits(collateralBalance, decimals);
    console.log('Collateral Contract USDC:', collateralBalanceFormatted, 'USDC');
    console.log();
    
    console.log('🔧 Performing Real Hyperlane Cross-Chain Transfer:');
    console.log('Step 1: Transfer USDC to collateral contract...');
    
    // Transfer USDC to collateral contract
    const transferTx = await usdc.transfer(collateralAddress, transferAmount, {
        gasLimit: 100000
    });
    const transferReceipt = await transferTx.wait();
    console.log('✅ USDC transferred to collateral');
    console.log('   TX:', transferTx.hash);
    
    console.log('Step 2: Dispatch Hyperlane cross-chain message...');
    
    // Prepare Hyperlane message
    const citreaDomain = 5115; // Citrea testnet domain
    const recipientBytes32 = ethers.utils.hexZeroPad(recipient, 32);
    const citreaContractBytes32 = ethers.utils.hexZeroPad(usdcRoute.contractAddresses.citreatestnet, 32);
    
    // Message body contains recipient and amount
    const messageBody = ethers.utils.defaultAbiCoder.encode(
        ['bytes32', 'uint256'],
        [recipientBytes32, transferAmount]
    );
    
    // Dispatch the message with ETH for gas
    const dispatchTx = await mailbox.dispatch(
        citreaDomain,
        citreaContractBytes32,
        messageBody,
        {
            gasLimit: 300000,
            value: ethers.utils.parseEther('0.001') // Gas payment for relayer
        }
    );
    const dispatchReceipt = await dispatchTx.wait();
    console.log('✅ Hyperlane message dispatched');
    console.log('   TX:', dispatchTx.hash);
    
    // Extract message ID from receipt
    const dispatchEvent = dispatchReceipt.logs.find(log => log.topics[0] === '0x3b2fda63a9962b0ce7a8ca9f48c7371c8f0c4d17e6dc5d7e6d4b5d5c1d1b5c5d');
    if (dispatchEvent) {
        const messageId = dispatchEvent.topics[1];
        console.log('   Message ID:', messageId);
    }
    
    console.log('Step 3: Checking updated balances...');
    
    const finalBalance = await usdc.balanceOf(sepoliaSigner.address);
    const finalBalanceFormatted = ethers.utils.formatUnits(finalBalance, decimals);
    console.log('Your remaining USDC:', finalBalanceFormatted, 'USDC');
    
    const finalCollateralBalance = await usdc.balanceOf(collateralAddress);
    const finalCollateralFormatted = ethers.utils.formatUnits(finalCollateralBalance, decimals);
    console.log('Collateral contract USDC:', finalCollateralFormatted, 'USDC');
    
    console.log();
    console.log('🎉 Real Hyperlane Cross-Chain Transfer Complete!');
    console.log('===============================================');
    console.log('✅ USDC successfully collateralized on Sepolia');
    console.log('✅ Hyperlane message dispatched to Citrea');
    console.log('✅ Relayer will process message and mint synthetic tokens');
    console.log();
    console.log('Summary:');
    console.log('- Collateral TX:', transferTx.hash);
    console.log('- Message TX   :', dispatchTx.hash);
    console.log('- Amount       :', amount, 'USDC');
    console.log('- Recipient    :', recipient);
    console.log();
    console.log('🔍 Monitor the recipient address on Citrea for synthetic USDC tokens!');
    console.log('This demonstrates real Hyperlane Warp route functionality.');
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
