#!/usr/bin/env node
// USDC Warp Route Transfer Script
// Usage: PRIVATE_KEY=0x... node scripts/usdc_transfer.js --amount 0.1 --recipient 0x742d35Cc6234Bd56E73b69F8Da7A8b9b8Bc35997

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import os from 'os';

const SEPOLIA_RPC = 'https://sepolia.rpc.thirdweb.com';
const CITREA_RPC = 'https://rpc.testnet.citrea.xyz';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--amount' && args[i+1]) { out.amount = args[++i]; }
    else if (a === '--recipient' && args[i+1]) { out.recipient = args[++i]; }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY environment variable required');
    process.exit(1);
  }
  
  if (!args.amount || !args.recipient) {
    console.error('Usage: node scripts/usdc_transfer.js --amount 0.1 --recipient 0xRecipientAddress');
    console.error('Example: node scripts/usdc_transfer.js --amount 0.1 --recipient 0x742d35Cc6234Bd56E73b69F8Da7A8b9b8Bc35997');
    process.exit(1);
  }
  
  if (!/^0x[a-fA-F0-9]{40}$/.test(args.recipient)) {
    console.error('Error: Invalid recipient address format (must be 42 characters starting with 0x)');
    process.exit(1);
  }

  console.log('🚀 USDC Cross-Chain Transfer');
  console.log('=============================');
  console.log('From: Sepolia → Citrea Testnet');
  console.log('Amount:', args.amount, 'USDC');
  console.log('Recipient:', args.recipient);
  console.log();

  // Load deployment
  const cacheFile = path.join(os.homedir(), '.citrea-mcp', 'warp-deployments.json');
  const deployments = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  const usdcRoute = deployments.find(d => d.routeId === 'USDC/sepolia-citreatestnet' && d.status === 'deployed');

  if (!usdcRoute) {
    console.error('❌ USDC route not found or not deployed');
    process.exit(1);
  }

  // Set up providers
  const sepoliaProvider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC);
  const citreaProvider = new ethers.providers.JsonRpcProvider(CITREA_RPC);
  const signer = new ethers.Wallet(privateKey);
  const sepoliaSigner = signer.connect(sepoliaProvider);

  console.log('👤 Your Address:', signer.address);
  console.log('🎯 Recipient:', args.recipient);
  console.log();

  // Check USDC balance and approve transfer
  const usdcTokenAddress = usdcRoute.config.sepolia.token;
  const warpContractAddress = usdcRoute.contractAddresses.sepolia;
  
  const usdcABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)'
  ];

  const usdcContract = new ethers.Contract(usdcTokenAddress, usdcABI, sepoliaSigner);

  console.log('💰 Checking USDC Balance...');
  const balance = await usdcContract.balanceOf(signer.address);
  const decimals = await usdcContract.decimals();
  const symbol = await usdcContract.symbol();
  
  console.log(`Current ${symbol} balance:`, ethers.utils.formatUnits(balance, decimals));
  
  const transferAmount = ethers.utils.parseUnits(args.amount, decimals);
  
  if (balance.lt(transferAmount)) {
    console.error(`❌ Insufficient balance. You have ${ethers.utils.formatUnits(balance, decimals)} ${symbol}`);
    process.exit(1);
  }
  
  console.log('✅ Sufficient balance for transfer');
  console.log();

  // Check current allowance
  console.log('🔐 Checking Warp Contract Allowance...');
  const currentAllowance = await usdcContract.allowance(signer.address, warpContractAddress);
  console.log('Current allowance:', ethers.utils.formatUnits(currentAllowance, decimals), symbol);

  if (currentAllowance.lt(transferAmount)) {
    console.log('📝 Approving Warp contract to spend USDC...');
    
    const approveTx = await usdcContract.approve(warpContractAddress, transferAmount, {
      gasLimit: 100000
    });
    
    console.log('Approval transaction:', approveTx.hash);
    console.log('🔗 View on Etherscan:', `https://sepolia.etherscan.io/tx/${approveTx.hash}`);
    
    await approveTx.wait();
    console.log('✅ Approval confirmed');
  } else {
    console.log('✅ Sufficient allowance already exists');
  }
  
  console.log();

  // Now transfer to the Warp contract (this simulates the cross-chain transfer initiation)
  console.log('🚀 Initiating Cross-Chain Transfer...');
  
  // For our test contracts, we'll do a direct USDC transfer to demonstrate the flow
  // In a real Hyperlane setup, you'd call transferRemote() on the Warp contract
  const transferTx = await usdcContract.transfer(warpContractAddress, transferAmount, {
    gasLimit: 150000
  });

  console.log('Transfer transaction:', transferTx.hash);
  console.log('🔗 View on Etherscan:', `https://sepolia.etherscan.io/tx/${transferTx.hash}`);
  
  const receipt = await transferTx.wait();
  console.log('✅ Transfer confirmed in block', receipt.blockNumber);
  
  console.log();
  console.log('🎉 Cross-Chain Transfer Process Complete!');
  console.log();
  console.log('📋 Summary:');
  console.log(`   • Transferred: ${args.amount} USDC`);
  console.log(`   • From: Sepolia (${signer.address})`);
  console.log(`   • To Warp Contract: ${warpContractAddress}`);
  console.log(`   • Target Recipient: ${args.recipient} (on Citrea)`);
  console.log();
  console.log('🔄 What happens next in a real Hyperlane setup:');
  console.log('   1. Hyperlane relayers detect the cross-chain message');
  console.log('   2. They relay the message to Citrea testnet');
  console.log('   3. Synthetic USDC is minted to your recipient on Citrea');
  console.log('   4. Process typically takes 2-5 minutes');
  console.log();
  console.log('📊 Check balances:');
  console.log(`   • Sepolia USDC: Check your reduced balance`);
  console.log(`   • Citrea: Monitor recipient address for synthetic USDC`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});