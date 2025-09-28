# Hyperlane Warp Routes Tools

This document describes the Warp route deployment tools added to CitraMesh MCP for creating cross-chain token bridges between testnets using Hyperlane.

## Overview

The Warp route tools allow you to:
- Create configuration files for Hyperlane Warp routes between testnets
- Deploy actual Warp route contracts with auto-configuration
- Generate cost estimates for deployment
- List available testnet chains and tokens
- Bridge popular tokens like USDC, USDT, DAI between testnets

## Quick Start

**🚀 Deploy a USDC bridge in one command:**

```bash
deploy-warp-route USDC/sepolia-citreatestnet
```

This will:
1. Auto-detect USDC address on Sepolia (0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8)
2. Create collateral config for Sepolia, synthetic config for Citrea
3. Deploy contracts on both chains
4. Return deployed contract addresses and transaction hashes

**Popular Routes:**
- `USDC/sepolia-arbitrumsepolia` - Bridge USDC between Ethereum and Arbitrum testnets
- `USDC/sepolia-optimismsepolia` - Bridge USDC between Ethereum and Optimism testnets  
- `cBTC/citreatestnet-sepolia` - Bridge native cBTC from Citrea to Ethereum testnet
- `WETH/sepolia-basesepolia` - Bridge WETH between Ethereum and Base testnets

## Available Tools

### Core Tools

#### `list-available-testnets`
Lists all supported testnet chains with their details (RPC URLs, chain IDs, explorers).

**Usage:**
```
list-available-testnets
```

#### `create-warp-route-config`
Creates a Hyperlane Warp route configuration between two testnets.

**Parameters:**
- `originChain`: Origin testnet chain name (e.g., "sepolia")
- `destinationChain`: Destination testnet chain name (e.g., "arbitrumsepolia")
- `tokenSymbol`: Token symbol (e.g., "USDC", "TEST")
- `tokenAddress` (optional): Token contract address on origin chain (auto-fetched for known tokens)
- `isCollateral` (default: true): Whether this is a collateral token (true) or native token (false)

**Usage:**
```
create-warp-route-config sepolia arbitrumsepolia USDC 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8 true
```

#### `deploy-warp-route`
**🚀 NEW: Enhanced with Auto-Configuration!**

Deploy a Warp route for cross-chain token transfers. If configuration doesn't exist, it will be created automatically with token address lookup for known tokens.

**Parameters:**
- `routeId`: Route ID in format TOKEN/ORIGIN-DESTINATION (e.g., "USDC/sepolia-citreatestnet")
- `originChain` (optional): Origin chain name if not in routeId
- `destinationChain` (optional): Destination chain name if not in routeId  
- `tokenSymbol` (optional): Token symbol if not in routeId
- `tokenAddress` (optional): Token contract address (auto-fetched for known tokens)
- `isCollateral` (default: true): Whether to use collateral mode

**Key Features:**
- ✅ **Auto-Configuration**: Creates config automatically if it doesn't exist
- ✅ **Token Address Lookup**: Automatically finds addresses for USDC, USDT, DAI, WETH on supported testnets
- ✅ **Smart Fallbacks**: Uses native mode for Citrea testnet when no valid token found
- ✅ **One-Step Deployment**: Just provide a routeId and deploy!

**Usage:**
```
# Simple usage - just provide routeId (will auto-create config and deploy)
deploy-warp-route USDC/sepolia-citreatestnet

# Bridge USDC from Sepolia to Citrea (auto-detects USDC address on Sepolia)
deploy-warp-route USDC/sepolia-arbitrumsepolia

# Bridge native cBTC from Citrea to Sepolia
deploy-warp-route cBTC/citreatestnet-sepolia
```

#### `transfer-warp-route`
**🚀 NEW: Cross-Chain Token Transfer!**

Transfer tokens across chains using deployed Warp routes. Perfect for bridging cBTC from Citrea to other testnets.

**Parameters:**
- `routeId`: Route ID (e.g., "cBTC/citreatestnet-sepolia")
- `fromChain`: Source chain name (e.g., "citreatestnet")
- `toChain`: Destination chain name (e.g., "sepolia")  
- `recipient`: Recipient address on destination chain
- `amount`: Amount to transfer (e.g., "1.5")

**Usage:**
```bash
# Transfer 1.0 cBTC from Citrea to Sepolia
transfer-warp-route cBTC/citreatestnet-sepolia citreatestnet sepolia 0x742d35Cc6234Bd56E73b69F8Da7A8b9b8Bc35997 1.0

# Transfer 0.5 synthetic cBTC from Sepolia back to Citrea  
transfer-warp-route cBTC/citreatestnet-sepolia sepolia citreatestnet 0x742d35Cc6234Bd56E73b69F8Da7A8b9b8Bc35997 0.5
```

#### `estimate-warp-deployment-cost`
Estimates gas costs for deploying a Warp route between two testnets.

**Parameters:**
- `originChain`: Origin testnet chain name
- `destinationChain`: Destination testnet chain name

**Usage:**
```
estimate-warp-deployment-cost sepolia arbitrumsepolia
```

### Management Tools

#### `list-warp-deployments`
Lists all created Warp route configurations.

#### `get-warp-deployment`
Gets detailed information about a specific Warp route configuration.

**Parameters:**
- `routeId`: Route ID (e.g., "USDC/sepolia-arbitrumsepolia")

#### `get-deployment-instructions`
Gets detailed deployment instructions for a configured Warp route.

**Parameters:**
- `routeId`: Route ID

### Reference Tools

#### `list-warp-templates`
Lists available Warp route configuration templates.

#### `list-testnet-tokens`
Lists available testnet token addresses for common tokens.

## Supported Testnets

- **Sepolia** (Ethereum testnet)
- **Arbitrum Sepolia**
- **Optimism Sepolia**
- **Base Sepolia**
- **Polygon Mumbai**
- **Avalanche Fuji**
- **BSC Testnet**

## Common Token Addresses

### Sepolia
- USDC: `0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8`
- USDT: `0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0`
- DAI: `0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357`
- WETH: `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`

### Arbitrum Sepolia
- USDC: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
- USDT: `0xb1084db8d3c05cebd5fa9335df95ee4b8a0edc30`
- WETH: `0x980B62Da83eFf3D4576C647993b0c1D7faf17c73`

## Deployment Workflow

1. **Create Configuration**: Use `create-warp-route-config` to generate a Warp route configuration
2. **Estimate Costs**: Use `estimate-warp-deployment-cost` to check gas requirements  
3. **Get Instructions**: Use `get-deployment-instructions` to get CLI commands
4. **Deploy with CLI**: Follow the instructions to deploy using Hyperlane CLI

## Example Workflow

```bash
# 1. List available testnets
list-available-testnets

# 2. List available tokens
list-testnet-tokens

# 3. Estimate deployment cost
estimate-warp-deployment-cost sepolia arbitrumsepolia

# 4. Create configuration for USDC bridge
create-warp-route-config sepolia arbitrumsepolia USDC 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8 true

# 5. Get deployment instructions
get-deployment-instructions USDC/sepolia-arbitrumsepolia

# 6. Deploy using Hyperlane CLI (outside of MCP)
# Follow the instructions from step 5
```

## Configuration Types

### Collateral to Synthetic
- Origin chain holds the actual token (collateral)
- Destination chain mints synthetic representations
- Requires token contract address
- Most common for existing tokens like USDC

### Native to Synthetic  
- Origin chain uses native currency (ETH, MATIC, etc.)
- Destination chain mints synthetic representations
- No token address required
- Used for bridging native currencies

## Files Created

The tools create several files in your cache directory:

- `warp-deployments.json`: List of all configurations
- `configs/{routeId}-deploy.yaml`: Individual YAML config files
- Configuration files are ready for use with Hyperlane CLI

## Prerequisites for Deployment

1. **Hyperlane CLI**: Install with `npm install -g @hyperlane-xyz/cli`
2. **Private Key**: Set as `HYP_KEY` environment variable
3. **Testnet Funds**: Sufficient balance on both chains for gas fees
4. **Token Permissions**: For collateral tokens, ensure proper allowances

## Troubleshooting

### Common Issues

1. **Unsupported Chain**: Only testnet chains listed in `list-available-testnets` are supported
2. **Invalid Token Address**: Use addresses from `list-testnet-tokens` or verify manually
3. **Insufficient Funds**: Check gas estimates and ensure adequate balance
4. **Network Issues**: RPC endpoints may be slow or unavailable

### Getting Help

- Use `list-available-testnets` to see supported chains
- Use `list-testnet-tokens` to see verified token addresses  
- Check gas estimates before deployment
- Refer to [Hyperlane documentation](https://docs.hyperlane.xyz) for CLI usage

## Security Notes

- These tools are for TESTNET use only
- Never use mainnet private keys in testing
- Always verify token addresses before deployment
- Test small amounts before large transfers
- Keep track of deployed contract addresses

## Integration with Hyperlane Ecosystem

The configurations generated by these tools are fully compatible with:
- [Hyperlane CLI](https://docs.hyperlane.xyz/docs/reference/developer-tools/cli)
- [Hyperlane Explorer](https://explorer.hyperlane.xyz)
- [Hyperlane Warp UI](https://github.com/hyperlane-xyz/hyperlane-warp-ui-template)
- [Hyperlane SDK](https://docs.hyperlane.xyz/docs/reference/SDK/introduction)