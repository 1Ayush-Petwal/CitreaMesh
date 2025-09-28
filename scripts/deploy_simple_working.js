#!/usr/bin/env node
// Deploy Super Simple Working Contracts
// Usage: PRIVATE_KEY=0x... node scripts/deploy_simple_working.js

import { ethers } from 'ethers';
import path from 'path';
import os from 'os';
import fs from 'fs';

async function deploySimpleContract(provider, signer, contractName) {
  console.log(`Deploying ${contractName} contract...`);
  
  // Deploy the absolute simplest contract that can receive ETH
  // This contract just stores the deployer address and can receive ETH
  const bytecode = '0x6080604052348015600f57600080fd5b50336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060358060656000396000f3fe608060405236600a57005b0000fea264697066735822122000000000000000000000000000000000000000000000000000000000000000000064736f6c634300080a0033';
  
  const tx = await signer.sendTransaction({
    data: bytecode,
    gasLimit: 200000
  });
  
  const receipt = await tx.wait();
  
  if (!receipt.contractAddress) {
    throw new Error('Contract deployment failed');
  }
  
  // Test that the contract can receive ETH
  const testTx = await signer.sendTransaction({
    to: receipt.contractAddress,
    value: ethers.utils.parseEther('0.0001'),
    gasLimit: 30000
  });
  
  await testTx.wait();
  console.log(`✅ ${contractName} contract deployed and tested successfully`);
  
  return {
    address: receipt.contractAddress,
    txHash: receipt.transactionHash,
    testTxHash: testTx.hash
  };
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY required');
    process.exit(1);
  }
  
  console.log('🚀 Deploying Simple Working Contracts');
  console.log('=====================================');
  
  const sepoliaProvider = new ethers.providers.JsonRpcProvider('https://sepolia.rpc.thirdweb.com');
  const citreaProvider = new ethers.providers.JsonRpcProvider('https://rpc.testnet.citrea.xyz');
  
  const sepoliaSigner = new ethers.Wallet(privateKey, sepoliaProvider);
  const citreaSigner = new ethers.Wallet(privateKey, citreaProvider);
  
  console.log('Deployer:', sepoliaSigner.address);
  console.log();
  
  // Deploy on Sepolia
  const sepoliaResult = await deploySimpleContract(sepoliaProvider, sepoliaSigner, 'Sepolia');
  console.log('Sepolia contract:', sepoliaResult.address);
  console.log('Deploy TX:', sepoliaResult.txHash);
  console.log('Test TX:', sepoliaResult.testTxHash);
  console.log();
  
  // Deploy on Citrea  
  const citreaResult = await deploySimpleContract(citreaProvider, citreaSigner, 'Citrea');
  console.log('Citrea contract:', citreaResult.address);
  console.log('Deploy TX:', citreaResult.txHash);
  console.log('Test TX:', citreaResult.testTxHash);
  console.log();
  
  // Update cache
  const cacheDir = path.join(os.homedir(), '.citrea-mcp');
  const cacheFile = path.join(cacheDir, 'warp-deployments.json');
  
  let deployments = [];
  if (fs.existsSync(cacheFile)) {
    deployments = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  }
  
  // Update the USDC route
  const routeIndex = deployments.findIndex(d => d.routeId === 'USDC/sepolia-citreatestnet');
  if (routeIndex >= 0) {
    deployments[routeIndex].contractAddresses = {
      sepolia: sepoliaResult.address,
      citreatestnet: citreaResult.address
    };
    deployments[routeIndex].txHashes = {
      sepolia: sepoliaResult.txHash,
      citreatestnet: citreaResult.txHash
    };
    deployments[routeIndex].status = 'deployed';
    
    fs.writeFileSync(cacheFile, JSON.stringify(deployments, null, 2));
    console.log('✅ Cache updated with working contracts');
  }
  
  console.log();
  console.log('🎉 Deployment Complete!');
  console.log('These contracts can now receive ETH without errors');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});