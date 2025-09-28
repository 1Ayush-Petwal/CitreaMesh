#!/usr/bin/env node
// Usage: node scripts/get_tx_info.js <RPC_URL> <TX_HASH> <CONTRACT_ADDRESS>
// Example: node scripts/get_tx_info.js https://sepolia.rpc.thirdweb.com 0x713b4acfac... 0x83b18c26Bf...

import { ethers } from 'ethers';

const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: node scripts/get_tx_info.js <RPC_URL> <TX_HASH> <CONTRACT_ADDRESS>');
  process.exit(1);
}

const [rpcUrl, txHash, contractAddress] = args;
console.log('RPC:', rpcUrl);
console.log('TX:', txHash);
console.log('Contract address (expected):', contractAddress);

const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

try {
  const net = await provider.getNetwork();
  console.log('Network:', net.name || net.chainId, `(chainId=${net.chainId})`);
} catch (e) {
  console.error('Unable to detect network from RPC:', e && e.message);
  process.exit(2);
}

try {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    console.log('No receipt found (tx may be unknown or provider does not index it).');
  } else {
    console.log('Receipt found:');
    console.log('  blockNumber:', receipt.blockNumber);
    console.log('  status:', receipt.status);
    console.log('  to:', receipt.to);
    console.log('  from:', receipt.from);
    console.log('  contractAddress:', receipt.contractAddress);
    console.log('  logs length:', receipt.logs ? receipt.logs.length : 0);
  }

  // Check code at provided contract address
  const code = await provider.getCode(contractAddress);
  if (!code || code === '0x') {
    console.log('No contract code at the expected contract address.');
  } else {
    console.log('Contract code exists (length):', code.length);
  }
} catch (err) {
  console.error('Error querying tx/contract:', err && err.message ? err.message : err);
  process.exit(3);
}
