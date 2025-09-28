#!/usr/bin/env node
// Usage: node scripts/check_token.js <RPC_URL> <TOKEN_ADDRESS> [RECIPIENT_ADDRESS]
// Example: node scripts/check_token.js https://rpc.ankr.com/eth_sepolia 0x83b18c26BFa89821D180D3f362bE763359ee9633 0xYourAddress

import { ethers } from 'ethers';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/check_token.js <RPC_URL> <TOKEN_ADDRESS> [RECIPIENT_ADDRESS]');
  process.exit(1);
}

const [rpcUrl, tokenAddress, recipient = null] = args;
console.log('Using RPC:', rpcUrl);
console.log('Token address:', tokenAddress);
if (recipient) console.log('Recipient (optional):', recipient);

const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

try {
  const net = await provider.getNetwork();
  console.log('Detected network:', net.name || net.chainId, `(chainId=${net.chainId})`);
} catch (err) {
  console.error('\nError: unable to detect network from RPC.');
  console.error('This usually means the RPC URL is unreachable or returned an unexpected response.');
  console.error('Original error:', err && err.message ? err.message : err);
  console.error('\nSuggestions:');
  console.error('- Ensure the RPC URL is correct and reachable from this machine.');
  console.error('- If it is a provider requiring an API key (Infura/Alchemy/Ankr), verify the key and usage limits.');
  console.error('- Try another public RPC (Infura/Alchemy/Ankr) or a provider-specific sepolia endpoint.');
  process.exit(2);
}

try {
  const code = await provider.getCode(tokenAddress);
  if (!code || code === '0x') {
    console.log('\nNo contract code found at this address (EOA or not deployed).');
    process.exit(0);
  }
  console.log('\nContract code found (length:', code.length, ')');

  const abi = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)',
    'event Transfer(address,address,uint256)'
  ];

  const token = new ethers.Contract(tokenAddress, abi, provider);

  const name = await token.name().catch(() => null);
  const symbol = await token.symbol().catch(() => null);
  const decimals = await token.decimals().catch(() => null);

  console.log('\nERC-20 info:');
  console.log('name:', name);
  console.log('symbol:', symbol);
  console.log('decimals:', decimals);

  if (recipient) {
    const bal = await token.balanceOf(recipient).catch(() => null);
    if (bal) {
      const formatted = decimals ? ethers.utils.formatUnits(bal, decimals) : bal.toString();
      console.log(`\nBalance of ${recipient}: ${formatted} (raw: ${bal.toString()})`);
    } else {
      console.log(`\nCould not read balanceOf(${recipient}) — contract may not implement ERC-20 interface or call failed.`);
    }
  }

  console.log('\nSearching for recent Transfer logs to the optional recipient (this may take a while).');
  const transferTopic = ethers.utils.id('Transfer(address,address,uint256)');
  const filter = recipient ? { address: tokenAddress, fromBlock: '0x0', toBlock: 'latest', topics: [transferTopic, null, ethers.utils.hexZeroPad(recipient, 32)] } : { address: tokenAddress, fromBlock: '0x0', toBlock: 'latest', topics: [transferTopic] };

  const logs = await provider.getLogs(filter).catch(e => { console.error('getLogs failed:', e && e.message ? e.message : e); return null; });
  if (!logs) {
    console.log('Could not fetch logs (provider may not support full archive queries).');
  } else {
    console.log('Transfer logs found:', logs.length);
    if (logs.length > 0) {
      const sample = logs.slice(-5);
      console.log('Most recent Transfer logs (up to 5):');
      console.log(sample);
    }
  }

} catch (err) {
  console.error('Error while inspecting token:', err && err.message ? err.message : err);
  process.exit(3);
}
