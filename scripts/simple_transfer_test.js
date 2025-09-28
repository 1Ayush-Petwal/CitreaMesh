#!/usr/bin/env node
// Simple Transfer Test Script
// Usage: PRIVATE_KEY=0x... node scripts/simple_transfer_test.js

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import os from 'os';

const SEPOLIA_RPC = 'https://sepolia.rpc.thirdweb.com';
const CITREA_RPC = 'https://rpc.testnet.citrea.xyz';

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  console.log('🚀 USDC Warp Route Transfer Test');
  console.log('=================================\n');

  // Load deployment info
  const cacheFile = path.join(os.homedir(), '.citrea-mcp', 'warp-deployments.json');
  if (!fs.existsSync(cacheFile)) {
    console.error('❌ No deployments found. Deploy a route first.');
    process.exit(1);
  }

  const deployments = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  const usdcRoute = deployments.find(d => d.routeId === 'USDC/sepolia-citreatestnet' && d.status === 'deployed');

  if (!usdcRoute) {
    console.error('❌ USDC/sepolia-citreatestnet route not found or not deployed');
    process.exit(1);
  }

  console.log('📋 Route Information:');
  console.log('  Route ID:', usdcRoute.routeId);
  console.log('  Symbol:', usdcRoute.symbol);
  console.log('  Status:', usdcRoute.status);
  console.log('  Sepolia Contract:', usdcRoute.contractAddresses.sepolia);
  console.log('  Citrea Contract:', usdcRoute.contractAddresses.citreatestnet);
  console.log();

  // Set up providers and signer
  const sepoliaProvider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC);
  const citreaProvider = new ethers.providers.JsonRpcProvider(CITREA_RPC);
  const signer = new ethers.Wallet(privateKey);
  const sepoliaSigner = signer.connect(sepoliaProvider);
  const citreaSigner = signer.connect(citreaProvider);

  console.log('👤 Wallet Address:', signer.address);
  console.log();

  // Check balances
  console.log('💰 Current Balances:');
  const sepoliaBalance = await sepoliaProvider.getBalance(signer.address);
  const citreaBalance = await citreaProvider.getBalance(signer.address);
  console.log('  Sepolia ETH:', ethers.utils.formatEther(sepoliaBalance));
  console.log('  Citrea cBTC:', ethers.utils.formatEther(citreaBalance));

  // Check USDC balance on Sepolia
  const usdcTokenAddress = usdcRoute.config.sepolia.token; // 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
  const usdcABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)'
  ];

  const usdcContract = new ethers.Contract(usdcTokenAddress, usdcABI, sepoliaSigner);
  
  try {
    const usdcBalance = await usdcContract.balanceOf(signer.address);
    const usdcDecimals = await usdcContract.decimals();
    const usdcSymbol = await usdcContract.symbol();
    
    console.log(`  ${usdcSymbol} (Sepolia):`, ethers.utils.formatUnits(usdcBalance, usdcDecimals));
    
    if (usdcBalance.eq(0)) {
      console.log();
      console.log('⚠️  No USDC tokens found!');
      console.log('💡 To test transfers, you need USDC tokens on Sepolia.');
      console.log('   Get some from: https://faucet.circle.com/ or other Sepolia USDC faucets');
      console.log();
    }
  } catch (err) {
    console.log('  ⚠️  Could not read USDC balance:', err.message);
  }
  console.log();

  // Verify deployed contracts exist
  console.log('🔍 Contract Verification:');
  const sepoliaCode = await sepoliaProvider.getCode(usdcRoute.contractAddresses.sepolia);
  const citreaCode = await citreaProvider.getCode(usdcRoute.contractAddresses.citreatestnet);
  
  console.log('  Sepolia Contract:', sepoliaCode !== '0x' ? '✅ Exists' : '❌ Not found');
  console.log('  Citrea Contract:', citreaCode !== '0x' ? '✅ Exists' : '❌ Not found');
  console.log();

  // Demonstrate transfer process
  console.log('🔄 Transfer Process Demo:');
  console.log('Step 1: In a real Hyperlane setup, you would:');
  console.log('  • Approve the Warp route contract to spend your USDC');
  console.log('  • Call transferRemote() on the source contract');
  console.log('  • Specify destination chain and recipient');
  console.log();
  
  console.log('Step 2: Hyperlane would:');
  console.log('  • Lock your USDC in the collateral contract');
  console.log('  • Send a cross-chain message via Hyperlane protocol');
  console.log('  • Mint synthetic USDC on Citrea to your recipient');
  console.log();

  // For demonstration, interact with our deployed contracts
  console.log('Step 3: Demo interaction with deployed contracts...');
  
  try {
    // Send a small transaction to the source contract as a demo
    const demoTx = await sepoliaSigner.sendTransaction({
      to: usdcRoute.contractAddresses.sepolia,
      value: ethers.utils.parseEther('0.0001'),
      gasLimit: 50000
    });
    
    console.log('  ✅ Demo transaction sent:', demoTx.hash);
    console.log('  🔗 View on Etherscan:', `https://sepolia.etherscan.io/tx/${demoTx.hash}`);
    
    await demoTx.wait();
    console.log('  ✅ Transaction confirmed');
    
  } catch (err) {
    console.log('  ⚠️  Demo transaction failed:', err.message);
  }

  console.log();
  console.log('✅ Transfer Test Complete!');
  console.log();
  console.log('📚 To perform real transfers:');
  console.log('1. Get USDC tokens on Sepolia from a faucet');
  console.log('2. Deploy actual Hyperlane Warp route contracts (not our test contracts)');
  console.log('3. Use the Hyperlane SDK or CLI to initiate transfers');
  console.log('4. Monitor the destination chain for synthetic token arrivals');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});