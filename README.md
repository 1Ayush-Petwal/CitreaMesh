# CitreaMesh

A powerful Model Context Protocol (MCP) server enabling seamless integration with the CitreaMesh protocol, allowing LLM assistants to interact with cross-chain messaging and smart contracts across multiple blockchains.
Making Developer and User experience better and make onboarding easy for them
---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Features](#features)
- [Requirements](#requirements)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Usage](#usage)
- [Available Tools](#available-tools)
- [Project Structure](#project-structure)
- [Files & Folders Created](#files--folders-created)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The CitreaMesh MCP Server bridges LLM assistants and the CitreaMesh cross-chain infrastructure. It provides a standardized interface for deploying chains, managing validators and relayers, sending cross-chain messages, and deploying asset transfer routes.

---

## How It Works

### Architecture

The server operates as an MCP (Model Context Protocol) server that:

- **Connects to Multiple Blockchains**: Uses CitreaMesh's MultiProvider to manage connections to various blockchain networks.
- **Manages Local Registry**: Maintains a local cache of chain metadata, deployed contracts, and route configurations.
- **Deploys Infrastructure**: Handles deployment of CitreaMesh core contracts, validators, and relayers.
- **Facilitates Cross-Chain Operations**: Enables message passing and asset transfers between chains.
- **Docker Integration**: Runs validators and relayers in Docker containers for isolation.

#### Core Components

- **LocalRegistry**: Extends CitreaMesh registry system with local storage capabilities
- **CitreaMeshDeployer**: Handles deployment of core CitreaMesh contracts
- **ValidatorRunner**: Manages validator Docker containers
- **RelayerRunner**: Manages relayer Docker containers
- **RouteManager**: Handles deployment and management of cross-chain asset routes

---

## Features

- **Cross-Chain Messaging**: Send/monitor messages across blockchain networks
- **Contract Deployment & Management**: Deploy CitreaMesh core contracts and asset routes
- **Infrastructure Management**: Run validators, relayers, and monitor their health
- **Asset Transfers**: Deploy and execute multi-hop asset transfers, supporting various token types

---

## Requirements

### System

- Node.js: v18 or higher
- Package Manager: pnpm (recommended)
- Docker: For validators and relayers
- OS: Linux, macOS, or Windows with WSL2

### Network

- Access to RPC endpoints for target blockchains
- Stable internet connection
- Sufficient bandwidth for Docker image downloads

### Blockchain

- Private key with sufficient native tokens for gas fees
- Access to blockchain RPC endpoints
- Understanding of target chain configurations

---

## Installation & Setup

1. **Clone the Repository**
    ```bash
    git clone https://github.com/Bansalayush247/CitreaMesh.git
    cd CitreaMesh
    ```

2. **Install Dependencies**
    ```bash
    # Install pnpm if needed
    npm install -g pnpm

    # Install project dependencies
    pnpm install
    ```

3. **Build the Project**
    ```bash
    pnpm build
    ```

4. **Set Up Environment Variables**
    ```bash
    cp .env.example .env
    # Edit `.env` with your configuration:
    PRIVATE_KEY=your_private_key_here
    GITHUB_TOKEN=your_github_personal_access_token
    CACHE_DIR=/path/to/custom/cache/directory # optional
    ```

5. **Verify Docker Installation**
    ```bash
    docker --version
    docker ps
    ```

---

## Configuration

### Environment Variables

| Variable      | Required | Description                                     | Default                |
|---------------|----------|-------------------------------------------------|------------------------|
| PRIVATE_KEY   | Yes      | Private key for transaction signing (no 0x)     | None                   |
| GITHUB_TOKEN  | Yes      | GitHub PAT for accessing registry               | None                   |
| CACHE_DIR     | No       | Directory for local data                        | ~/.citreamesh-mcp      |
| HOME          | No       | Home directory (fallback for CACHE_DIR)         | System default         |

### MCP Client Configuration

For Claude Desktop or other MCP clients, use:
```json
{
  "mcpServers": {
    "citreamesh": {
      "command": "node",
      "args": [
        "/path/to/CitreaMesh/build/index.js"
      ],
      "env": {
        "PRIVATE_KEY": "your_private_key",
        "GITHUB_TOKEN": "your_github_token",
        "CACHE_DIR": "your_cache_dir"
      }
    }
  }
}
```

---

## Usage

### Starting the Server

```bash
# Development mode
pnpm start

# Production mode
node build/index.js

# With MCP Inspector (for debugging)
pnpm inspect
```

### Basic Workflow

- Deploy a New Chain: Use `deploy-chain` tool to add a blockchain
- Run Validator: Use `run-validator` to start validation
- Run Relayer: Use `run-relayer` for message delivery
- Deploy Asset Route: Use `deploy-route` for asset transfers
- Send Messages/Assets: Use transfer tools for cross-chain operations

---

## Available Tools

> **Note:** Please add your actual tool names below as implemented in `/src`.  
> You can search for files in the `/src` directory ending in `tool.ts` or containing tool logic.

- `deploy-chain`
- `run-validator`
- `run-relayer`
- `cross-chain-message-transfer`
- `cross-chain-asset-transfer`
- `deploy-route`
- (Add any other implemented tools here…)

---

## Project Structure

```
CitreaMesh/
├── src/
│   ├── index.ts                  # Main MCP server entry point
│   ├── localRegistry.ts          # Local registry implementation
│   ├── citreaMeshDeployer.ts     # Core contract deployment
│   ├── RunValidator.ts           # Validator Docker management
│   ├── RunRelayer.ts             # Relayer Docker management
│   ├── routeManager.ts           # Asset route deployment
│   ├── msgTransfer.ts            # Message transfer logic
│   ├── assetTransfer.ts          # Asset transfer logic
│   ├── config.ts                 # Configuration utilities
│   ├── utils.ts                  # Utility functions
│   ├── types.ts                  # Type definitions
│   ├── logger.ts                 # Logging configuration
│   ├── gcr.ts                    # Container Registry utilities
│   ├── file.ts                   # File system utilities
│   ├── configOpts.ts             # Configuration options
│   └── consts.ts                 # Constants
├── build/
├── node_modules/
├── package.json
├── tsconfig.json
├── .env
└── README.md
```

---

## Files & Folders Created

### Cache Directory Structure

```
~/.citreamesh-mcp/
├── chains/
│   ├── {chainName}.yaml
│   ├── {chainName}.deploy.yaml
│   └── {chainName}-core-config.yaml
├── routes/
│   └── {symbol}-{hash}.yaml
├── agents/
│   └── {chainName}-agent-config.json
└── logs/
    ├── citreamesh_db_validator_{chain}/
    ├── citreamesh_db_relayer/
    └── citreamesh-validator-signatures-{chain}/
```

### File Types Created

- **Chain Configuration Files**
  - `{chainName}.yaml`: Chain metadata (RPC, chain ID, token info)
  - `{chainName}.deploy.yaml`: Deployed contract addresses
  - `{chainName}-core-config.yaml`: Core deployment config
- **Route Files**
  - `{symbol}-{hash}.yaml`: Asset route configuration
- **Agent Configuration Files**
  - `{chainName}-agent-config.json`: Validator & relayer configs
- **Docker Volumes**
  - Validator databases, relayer databases, signature storage
- **Temporary Files**
  - Docker containers (managed automatically)
  - Log files

---

## Examples

1. **Deploy a New Chain**  
   Deploy CitreaMesh core contracts to a new blockchain "mytestnet" (chain ID 12345, RPC "https://rpc.mytestnet.com", symbol "MTN", name "MyTestNet Token", marked as testnet).

2. **Send Cross-Chain Message**  
   Send a message from Ethereum to Polygon. Recipient: `0x742d35Cc6634C0532925a3b8D4C9db96c4b4d8b6`, message: "Hello from Ethereum!"

3. **Deploy Asset Route**  
   Deploy asset route between Ethereum and Arbitrum. Collateral token for Ethereum, synthetic for Arbitrum.

4. **Transfer Assets**  
   Transfer 100 USDC from Ethereum to Arbitrum to `0x742d35Cc6634C0532925a3b8D4C9db96c4b4d8b6`. Fetch route config for USDC.

5. **Run Infrastructure**  
   Start validator for "mytestnet".  
   Start relayer for Ethereum and "mytestnet" (validator chain name: "mytestnet").

6. **Multi-Chain Asset Transfer**  
   Transfer 50 USDC from Ethereum → Polygon → Arbitrum using existing USDC routes. Recipient: `0x742d35Cc6634C0532925a3b8D4C9db96c4b4d8b6`.

7. **Check Route Resources**  
   Show available route configs for USDC across Ethereum and Polygon.

8. **Deploy Custom Token Route**  
   Deploy asset route for custom token "MyToken" (symbol: MTK) between Ethereum (collateral), Polygon (synthetic), Arbitrum (synthetic).

---

## Troubleshooting

### Common Issues

1. **Docker Permission Errors**
    ```bash
    sudo usermod -aG docker $USER
    # Restart your shell
    ```

2. **Insufficient Gas Fees**
   - Ensure wallet has sufficient funds
   - Check current gas prices

3. **RPC Connection Issues**
   - Verify RPC URLs
   - Check for rate limiting
   - Use multiple endpoints if needed

4. **Container Startup Failures**
    ```bash
    docker logs <container_id>
    docker pull gcr.io/abacus-labs-dev/citreamesh-agent:latest
    ```

### Debug Mode

Run with MCP Inspector for detailed debugging:
```bash
pnpm inspect
```

### Log Files

Check logs in the cache directory:
```bash
tail -f ~/.citreamesh-mcp/logs/validator-{chain}.log
tail -f ~/.citreamesh-mcp/logs/relayer.log
```

---

## Contributing

Contributions are welcome! Please submit a Pull Request.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style

- Use TypeScript
- Follow existing formatting (Prettier)
- Use JSDoc for APIs
- Include error handling

---

## Authors

- Ayush Bansal
- Abhinav Chauhan
- Ayush Petwal

---

## License

This project is licensed under the MIT License.

---

## Disclaimer

The software is provided as is. No guarantee, representation, or warranty is made, express or implied, as to the safety or correctness. It has not been audited and may not work as intended. Users may experience delays, failures, errors, loss of information or funds. The creators are not liable for any of the foregoing. Use at your own risk.
