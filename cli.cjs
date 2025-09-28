#!/usr/bin/env node

/**
 * CitraMesh CLI Launcher
 * 
 * A simple CLI interface for common CitraMesh operations
 * For full MCP integration, use the main index.js server
 */

const { spawn } = require('child_process');
const path = require('path');

const TOOL_MAP = {
  // Cross-chain operations
  'transfer': 'transfer-hyperlane-cross-chain',
  'status': 'check-hyperlane-transfer-status',
  
  // Warp routes
  'deploy': 'deploy-warp-route',
  'create-route': 'create-warp-route-config',
  'list-routes': 'list-warp-deployments',
  'testnets': 'list-available-testnets',
  
  // Citrea utilities
  'balance': 'get_citrea_balance',
  'faucet': 'claim-citrea-faucet',
  'deploy-token': 'deploy-erc20',
  'tokens': 'list-deployed-tokens',
  
  // Explorer
  'explore': 'get-wallet-explorer-summary',
  'tx': 'get-transaction-details'
};

function showHelp() {
  console.log(`
🌉 CitraMesh - Hyperlane Cross-Chain Bridge Tool

USAGE:
  citramesh <command> [options]

CROSS-CHAIN COMMANDS:
  transfer <fromChain> <toChain> <token> <recipient> <amount>
    Transfer tokens across chains using Hyperlane
    Example: citramesh transfer sepolia citreatestnet USDC 0x742d... 0.1

  status <messageHash> <recipient> <destinationChain>  
    Check cross-chain transfer status
    Example: citramesh status 0x07b8a... 0x742d... citreatestnet

WARP ROUTE COMMANDS:
  deploy <routeId>
    Deploy a Warp route with auto-configuration
    Example: citramesh deploy USDC/sepolia-citreatestnet
    
  create-route <origin> <dest> <token> [tokenAddress] [isCollateral]
    Create Warp route configuration
    Example: citramesh create-route sepolia citreatestnet USDC
    
  list-routes
    List all deployed Warp routes
    
  testnets
    Show available testnet chains

CITREA COMMANDS:
  balance <address>
    Check Citrea cBTC balance
    Example: citramesh balance 0x742d...
    
  faucet <address>
    Claim testnet cBTC from faucet
    Example: citramesh faucet 0x742d...
    
  deploy-token <name> <symbol> <supply>
    Deploy ERC20 token on Citrea
    Example: citramesh deploy-token "My Token" "MTK" "1000000"
    
  tokens
    List deployed tokens

EXPLORER COMMANDS:
  explore <address> [limit]
    Get wallet analysis
    Example: citramesh explore 0x742d... 10
    
  tx <hash>
    Get transaction details
    Example: citramesh tx 0x07b8a...

ENVIRONMENT:
  PRIVATE_KEY    Your wallet private key (required)
  CACHE_DIR      Cache directory (optional)

EXAMPLES:
  # Transfer 0.1 USDC from Sepolia to Citrea
  citramesh transfer sepolia citreatestnet USDC 0x742d35Cc6234Bd56E73b69F8Da7A8b9b8Bc35997 0.1
  
  # Deploy USDC bridge automatically
  citramesh deploy USDC/sepolia-citreatestnet
  
  # Check balance on Citrea
  citramesh balance 0x742d35Cc6234Bd56E73b69F8Da7A8b9b8Bc35997
  
  # Claim testnet funds
  citramesh faucet 0x742d35Cc6234Bd56E73b69F8Da7A8b9b8Bc35997

For full MCP integration, run: node build/index.js
Documentation: README.md and WARP_ROUTES.md
`);
}

async function runTool(toolName, params) {
  console.log(`🚀 Running ${toolName}...`);
  
  // Create a simple tool invocation
  const toolCall = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: toolName,
      arguments: params
    }
  };
  
  const mcpServer = spawn('node', [path.join(__dirname, 'build/index.js')], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  mcpServer.stdin.write(JSON.stringify(toolCall) + '\n');
  mcpServer.stdin.end();
  
  let output = '';
  mcpServer.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  mcpServer.stderr.on('data', (data) => {
    console.error(data.toString());
  });
  
  mcpServer.on('close', (code) => {
    if (output) {
      try {
        const response = JSON.parse(output.trim());
        if (response.result && response.result.content) {
          console.log(response.result.content[0].text);
        } else {
          console.log(output);
        }
      } catch (e) {
        console.log(output);
      }
    }
  });
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
  showHelp();
  process.exit(0);
}

const command = args[0];
const params = args.slice(1);

// Map CLI commands to MCP tools
switch (command) {
  case 'transfer':
    if (params.length !== 5) {
      console.error('❌ Usage: citramesh transfer <fromChain> <toChain> <token> <recipient> <amount>');
      process.exit(1);
    }
    runTool('transfer-hyperlane-cross-chain', {
      fromChain: params[0],
      toChain: params[1], 
      tokenSymbol: params[2],
      recipient: params[3],
      amount: params[4]
    });
    break;
    
  case 'status':
    if (params.length !== 3) {
      console.error('❌ Usage: citramesh status <messageHash> <recipient> <destinationChain>');
      process.exit(1);
    }
    runTool('check-hyperlane-transfer-status', {
      messageHash: params[0],
      recipientAddress: params[1],
      destinationChain: params[2]
    });
    break;
    
  case 'deploy':
    if (params.length !== 1) {
      console.error('❌ Usage: citramesh deploy <routeId>');
      process.exit(1);
    }
    runTool('deploy-warp-route', {
      routeId: params[0]
    });
    break;
    
  case 'balance':
    if (params.length !== 1) {
      console.error('❌ Usage: citramesh balance <address>');
      process.exit(1);
    }
    runTool('get_citrea_balance', {
      address: params[0]
    });
    break;
    
  case 'faucet':
    if (params.length !== 1) {
      console.error('❌ Usage: citramesh faucet <address>');
      process.exit(1);
    }
    runTool('claim-citrea-faucet', {
      address: params[0]
    });
    break;
    
  case 'deploy-token':
    if (params.length !== 3) {
      console.error('❌ Usage: citramesh deploy-token <name> <symbol> <supply>');
      process.exit(1);
    }
    runTool('deploy-erc20', {
      name: params[0],
      symbol: params[1],
      initialSupply: params[2]
    });
    break;
    
  case 'explore':
    if (params.length < 1 || params.length > 2) {
      console.error('❌ Usage: citramesh explore <address> [limit]');
      process.exit(1);
    }
    runTool('get-wallet-explorer-summary', {
      address: params[0],
      limit: params[1] ? parseInt(params[1]) : 10
    });
    break;
    
  case 'tx':
    if (params.length !== 1) {
      console.error('❌ Usage: citramesh tx <hash>');
      process.exit(1);
    }
    runTool('get-transaction-details', {
      txHash: params[0]
    });
    break;
    
  case 'list-routes':
    runTool('list-warp-deployments', {});
    break;
    
  case 'testnets':
    runTool('list-available-testnets', {});
    break;
    
  case 'tokens':
    runTool('list-deployed-tokens', {});
    break;
    
  case 'create-route':
    if (params.length < 3) {
      console.error('❌ Usage: citramesh create-route <origin> <dest> <token> [tokenAddress] [isCollateral]');
      process.exit(1);
    }
    runTool('create-warp-route-config', {
      originChain: params[0],
      destinationChain: params[1],
      tokenSymbol: params[2],
      tokenAddress: params[3] || undefined,
      isCollateral: params[4] !== 'false'
    });
    break;
    
  default:
    console.error(`❌ Unknown command: ${command}`);
    console.log('Run "citramesh help" for usage information');
    process.exit(1);
}