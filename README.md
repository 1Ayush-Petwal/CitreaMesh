# CitraMesh - Multi-Chain Development Tools

CitraMesh is a comprehensive Model Context Protocol (MCP) server that provides tools for blockchain development and cross-chain operations, with a focus on Citrea Bitcoin L2 and Hyperlane Warp routes.

## Features

### 🌉 Hyperlane Warp Routes (NEW!)
- **Cross-chain token bridges**: Deploy Warp routes between any supported testnets
- **Configuration generation**: Create deployment-ready YAML configs  
- **Cost estimation**: Get gas estimates before deployment
- **Multi-testnet support**: Sepolia, Arbitrum Sepolia, Optimism Sepolia, Base Sepolia, and more
- **CLI integration**: Seamless workflow with Hyperlane CLI

### 🟠 Citrea Bitcoin L2
- **Native balance queries**: Check cBTC balances on Citrea testnet
- **ERC20 token deployment**: Deploy and manage custom tokens
- **Faucet integration**: Claim testnet cBTC with rate limiting
- **Explorer integration**: Generate explorer URLs and wallet summaries
- **Token transfers**: Send ERC20 tokens between addresses

## Quick Start

### Prerequisites
- Node.js 18+ 
- Private key with testnet funds
- Environment variables configured

### Installation
```bash
# Clone and install
git clone <repository>
cd CitraMesh
npm install

# Build the project
npm run build

# Set environment variables
export PRIVATE_KEY="your-private-key"
export CACHE_DIR="./cache"  # optional

# Run the server
npm start
```

## Tool Categories

### 🌉 Hyperlane Warp Routes
Create, deploy, and use cross-chain token bridges between testnets:

- `deploy-warp-route` - **🚀 NEW!** Deploy Warp routes with auto-configuration
- `transfer-warp-route` - **🚀 NEW!** Transfer tokens across chains using deployed routes
- `list-available-testnets` - Show supported testnet chains
- `create-warp-route-config` - Generate Warp route configurations  
- `estimate-warp-deployment-cost` - Calculate gas costs
- `list-warp-deployments` - View created configurations
- `get-warp-deployment` - Get deployment status and details
- `list-testnet-tokens` - Show available token addresses

**✨ Features:**
- Automatic token address lookup for USDC, USDT, DAI, WETH
- Smart fallbacks for Citrea testnet (native cBTC mode)
- One-command deployment: `deploy-warp-route USDC/sepolia-citreatestnet`
- Cross-chain transfers: `transfer-warp-route cBTC/citreatestnet-sepolia citreatestnet sepolia 0x... 1.0`

[📖 Detailed Warp Routes Documentation](./WARP_ROUTES.md)

### 🟠 Citrea Tools
Interact with Citrea Bitcoin L2 testnet:

- `get_citrea_balance` - Check native cBTC balance
- `deploy-erc20` - Deploy custom ERC20 tokens
- `list-deployed-tokens` - View deployed token history
- `transfer-token` - Send ERC20 tokens
- `claim-citrea-faucet` - Get testnet cBTC
- `check-faucet-eligibility` - Check faucet status
- `get-faucet-stats` - View faucet statistics

### 🔍 Explorer Tools
Blockchain data and analytics:

- `get-citrea-explorer-url` - Generate explorer links
- `get-wallet-explorer-summary` - Comprehensive wallet analysis
- `get-transaction-details` - Transaction information

## Supported Networks

### Testnets (Warp Routes)
- **Sepolia** - Ethereum testnet
- **Arbitrum Sepolia** - Arbitrum L2 testnet  
- **Optimism Sepolia** - Optimism L2 testnet
- **Base Sepolia** - Base L2 testnet
- **Polygon Mumbai** - Polygon testnet
- **Avalanche Fuji** - Avalanche testnet
- **BSC Testnet** - Binance Smart Chain testnet

### Main Networks
- **Citrea Testnet** - Bitcoin L2 testnet

## Example Usage

### Deploy a Cross-Chain USDC Bridge (One Command!)
```bash
# 🚀 NEW: One-command deployment with auto-configuration
deploy-warp-route USDC/sepolia-citreatestnet

# This automatically:
# 1. Detects USDC address on Sepolia (0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8)
# 2. Creates collateral config for Sepolia + synthetic config for Citrea  
# 3. Deploys contracts on both chains
# 4. Returns contract addresses and transaction hashes
```

### Other Popular Bridge Routes
```bash
# Bridge USDC between Ethereum and Arbitrum testnets
deploy-warp-route USDC/sepolia-arbitrumsepolia

# Bridge native cBTC from Citrea to Ethereum testnet
deploy-warp-route cBTC/citreatestnet-sepolia

# Bridge WETH between Ethereum and Base testnets
deploy-warp-route WETH/sepolia-basesepolia
```

### Manual Configuration (Advanced)
```bash
# If you prefer manual configuration:
# 1. Check available testnets
list-available-testnets

# 2. Create custom configuration
create-warp-route-config sepolia arbitrumsepolia USDC 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8 true

# 3. Deploy from existing config
deploy-warp-route USDC/sepolia-arbitrumsepolia
```

### Deploy ERC20 Token on Citrea
```bash
# Deploy a custom token
deploy-erc20 "My Token" "MTK" "1000000"

# Check deployment history
list-deployed-tokens

# Transfer tokens
transfer-token MTK 0x742d35Cc6234Bd56E73b69F8Da7A8b9b8Bc35997 100
```

### Transfer cBTC Across Chains
```bash
# First, ensure the Warp route is deployed (if not already)
deploy-warp-route cBTC/citreatestnet-sepolia

# Transfer 1.0 cBTC from Citrea testnet to Sepolia
transfer-warp-route cBTC/citreatestnet-sepolia citreatestnet sepolia 0x742d35Cc6234Bd56E73b69F8Da7A8b9b8Bc35997 1.0

# Transfer 0.5 synthetic cBTC back from Sepolia to Citrea
transfer-warp-route cBTC/citreatestnet-sepolia sepolia citreatestnet 0x742d35Cc6234Bd56E73b69F8Da7A8b9b8Bc35997 0.5
```

## Configuration

### Environment Variables
```bash
# Required
PRIVATE_KEY="0x..."           # Private key for transactions

# Optional  
CACHE_DIR="./cache"           # Cache directory (default: ~/.citrea-mcp)
HYP_KEY="0x..."              # Same as PRIVATE_KEY, for Hyperlane CLI
```

### Network Configuration
The server automatically configures supported networks. No additional setup required.

## File Structure
```
CitraMesh/
├── src/
│   ├── index.ts              # Main MCP server
│   ├── warpRoutes.ts         # Hyperlane Warp route tools
│   ├── faucet.ts             # Citrea faucet integration
│   ├── explorerSummary.ts    # Blockchain explorer tools
│   └── utils/
│       ├── warpTemplates.ts  # Warp route templates
│       └── cacheTokens.ts    # Token caching utilities
├── contracts/
│   └── erc20Token.sol        # ERC20 token contract
├── WARP_ROUTES.md            # Detailed Warp routes guide
└── README.md                 # This file
```

## Integration

### With Hyperlane Ecosystem
- Compatible with [Hyperlane CLI](https://docs.hyperlane.xyz/docs/reference/developer-tools/cli)
- Works with [Hyperlane Explorer](https://explorer.hyperlane.xyz)  
- Supports [Hyperlane Warp UI](https://github.com/hyperlane-xyz/hyperlane-warp-ui-template)

### With Development Tools
- MCP protocol compatible
- JSON-RPC interface
- CLI and programmatic access
- TypeScript/JavaScript SDK integration

## Security

⚠️ **Important Security Notes:**
- Use TESTNET private keys only
- Never use mainnet keys for testing
- Verify all token addresses before deployment
- Test with small amounts first
- Keep deployed contract addresses secure

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Support

- **Documentation**: [Hyperlane Docs](https://docs.hyperlane.xyz)
- **Issues**: GitHub Issues
- **Community**: [Hyperlane Discord](https://discord.com/invite/hyperlane)

## License

MIT License - see LICENSE file for details.

---

**Built with:**
- [Hyperlane SDK](https://github.com/hyperlane-xyz/hyperlane-monorepo) - Cross-chain infrastructure
- [Model Context Protocol](https://github.com/modelcontextprotocol) - AI integration framework  
- [Ethers.js](https://docs.ethers.io/) - Ethereum interactions
- [TypeScript](https://www.typescriptlang.org/) - Type-safe development

