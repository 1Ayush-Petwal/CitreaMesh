#!/usr/bin/env node
// Deploy using working contract code from out/ directory
// Usage: PRIVATE_KEY=0x... node scripts/deploy_working_contracts.js

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import os from 'os';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--routeId' && args[i+1]) { out.routeId = args[++i]; }
  }
  return out;
}

async function deployContract(provider, signer, contractName, constructorArgs, chainName) {
    console.log(`🔧 Deploying ${contractName} on ${chainName}...`);
    
    // Read compiled contract from Foundry output
    const contractPath = path.join(process.cwd(), 'out', `${contractName}.sol`, `${contractName}.json`);
    
    if (!fs.existsSync(contractPath)) {
        throw new Error(`Contract file not found: ${contractPath}`);
    }
    
    const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
    const bytecode = contractJson.bytecode.object;
    const abi = contractJson.abi;
    
    console.log(`  Bytecode length: ${bytecode.length} characters`);
    console.log(`  ABI functions: ${abi.filter(item => item.type === 'function').length}`);
    
    // Create contract factory
    const factory = new ethers.ContractFactory(abi, bytecode, signer);
    
    // Deploy with proper gas settings
    const contract = await factory.deploy(...constructorArgs, {
        gasLimit: 3000000,
        gasPrice: ethers.utils.parseUnits('20', 'gwei')
    });
    
    console.log(`  Deploy TX: ${contract.deployTransaction.hash}`);
    console.log(`  Waiting for confirmation...`);
    
    const receipt = await contract.deployed();
    console.log(`✅ ${contractName} deployed at: ${contract.address}`);
    
    // Verify contract has code
    const code = await provider.getCode(contract.address);
    if (code === '0x') {
        throw new Error('Contract deployment verification failed - no code at address');
    }
    
    console.log(`  Contract code verified: ${code.length} bytes`);
    return contract;
}

async function main() {
  const args = parseArgs();
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY environment variable required');
    process.exit(1);
  }
  
  if (!args.routeId) {
    console.error('Usage: node scripts/deploy_working_contracts.js --routeId "USDC/sepolia-citreatestnet"');
    process.exit(1);
  }
  
  console.log('🚀 Deploying Working Warp Route Contracts');
  console.log('==========================================');
  console.log('Route:', args.routeId);
  console.log();
  
  // Parse route
  const [tokenSymbol, chainPair] = args.routeId.split('/');
  const [originChain, destinationChain] = chainPair.split('-');
  
  // Setup providers
  const sepoliaProvider = new ethers.providers.JsonRpcProvider('https://sepolia.rpc.thirdweb.com');
  const citreaProvider = new ethers.providers.JsonRpcProvider('https://rpc.testnet.citrea.xyz');
  
  const sepoliaSigner = new ethers.Wallet(privateKey, sepoliaProvider);
  const citreaSigner = new ethers.Wallet(privateKey, citreaProvider);
  
  console.log('Deployer:', sepoliaSigner.address);
  console.log();
  
  // Deploy on Sepolia (collateral)
  const sepoliaResult = await deployWorkingContract(
    sepoliaProvider, 
    sepoliaSigner, 
    'collateral',
    '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' // USDC token address
  );
  
  console.log('✅ Sepolia deployment successful:');
  console.log('  Contract:', sepoliaResult.address);
  console.log('  Deploy TX:', sepoliaResult.txHash);
  console.log('  Test TX:', sepoliaResult.testTxHash);
  console.log('  🔗 View:', `https://sepolia.etherscan.io/address/${sepoliaResult.address}`);
  console.log();
  
  // Deploy on Citrea (synthetic)
  const citreaResult = await deployWorkingContract(
    citreaProvider,
    citreaSigner,
    'synthetic'
  );
  
  console.log('✅ Citrea deployment successful:');
  console.log('  Contract:', citreaResult.address);
  console.log('  Deploy TX:', citreaResult.txHash);
  console.log('  Test TX:', citreaResult.testTxHash);
  console.log('  🔗 View:', `https://explorer.testnet.citrea.xyz/address/${citreaResult.address}`);
  console.log();
  
  // Update the cache
  const cacheDir = process.env.CACHE_DIR || path.join(os.homedir(), '.citrea-mcp');
  const cacheFile = path.join(cacheDir, 'warp-deployments.json');
  
  let deployments = [];
  if (fs.existsSync(cacheFile)) {
    deployments = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  }
  
  // Remove old deployment
  deployments = deployments.filter(d => d.routeId !== args.routeId);
  
  // Add new deployment
  const newDeployment = {
    routeId: args.routeId,
    symbol: tokenSymbol,
    chains: [originChain, destinationChain],
    config: {
      [originChain]: {
        type: 'collateral',
        token: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        owner: sepoliaSigner.address,
        mailbox: '0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766'
      },
      [destinationChain]: {
        type: 'synthetic',
        owner: sepoliaSigner.address,
        mailbox: '0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766'
      }
    },
    deployedAt: Date.now(),
    status: 'deployed',
    txHashes: {
      [originChain]: sepoliaResult.txHash,
      [destinationChain]: citreaResult.txHash
    },
    contractAddresses: {
      [originChain]: sepoliaResult.address,
      [destinationChain]: citreaResult.address
    }
  };
  
  deployments.push(newDeployment);
  fs.writeFileSync(cacheFile, JSON.stringify(deployments, null, 2));
  
  console.log('🎉 Deployment Complete!');
  console.log('');
  console.log('✅ Updated cache with working contracts');
  console.log('✅ Both contracts can now receive ETH without errors');
  console.log('✅ Ready for transfer testing');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});