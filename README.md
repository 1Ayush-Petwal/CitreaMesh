# CitreaMesh

A Model Context Protocol (MCP) server for seamless interaction with the **Citrea Testnet**. This server empowers LLM assistants to perform on-chain actions, including checking balances, using a testnet faucet, deploying and transferring ERC20 tokens, and analyzing wallet activity.

This project enhances the developer and user experience by abstracting away the complexity of interacting with browsers and wallets, providing a simple interface through a familiar LLM chat application. It aims to help Citrea onboard more developers and users into its ecosystem.

-----

## Table of Contents

  - [Overview](https://www.google.com/search?q=%23overview)
  - [How It Works](https://www.google.com/search?q=%23how-it-works)
  - [Features](https://www.google.com/search?q=%23features)
  - [Requirements](https://www.google.com/search?q=%23requirements)
  - [Installation & Setup](https://www.google.com/search?q=%23installation--setup)
  - [Configuration](https://www.google.com/search?q=%23configuration)
  - [Usage](https://www.google.com/search?q=%23usage)
  - [Available Tools](https://www.google.com/search?q=%23available-tools)
  - [Project Structure](https://www.google.com/search?q=%23project-structure)
  - [Files & Folders Created](https://www.google.com/search?q=%23files--folders-created)
  - [Examples](https://www.google.com/search?q=%23examples)
  - [Troubleshooting](https://www.google.com/search?q=%23troubleshooting)
  - [Contributing](https://www.google.com/search?q=%23contributing)
  - [License](https://www.google.com/search?q=%23license)

-----

## Overview

The Citrea MCP Server acts as a bridge between Large Language Models and the Citrea blockchain ecosystem. It exposes a suite of tools that allow an AI assistant to execute blockchain operations based on natural language commands. This simplifies the developer and user experience, making it easier to build, test, and interact with applications on Citrea.

-----

## How It Works

The server is built using the `@modelcontextprotocol/sdk` and `ethers.js`. It listens for JSON-RPC requests from an MCP client (like a compatible LLM assistant). When a request invokes a registered tool, the server executes the corresponding function—such as calling the Citrea RPC endpoint, managing a local faucet database, or sending a transaction—and returns a formatted, human-readable response.

-----

## Features

  * **Wallet Management**: Check native (cBTC) and ERC20 token balances.
  * **Testnet Faucet**: A built-in faucet to claim testnet cBTC, with eligibility checks, history, and usage stats.
  * **ERC20 Token Utilities**: Deploy new ERC20 tokens, list previously deployed tokens, and transfer them between addresses.
  * **Blockchain Explorer**: Generate explorer URLs and fetch detailed, RPC-grounded summaries for wallets and transactions.

-----

## Requirements

### System

  * Node.js: v18 or higher
  * Package Manager: pnpm (recommended) or npm/yarn
  * OS: Linux, macOS, or Windows

### Blockchain

  * A private key with a small amount of testnet cBTC for gas fees on the Citrea Testnet.

-----

## Installation & Setup

This repository has two primary branches:

  * `main`: Uses a **STDIO transport**, designed for running the server locally.
  * `HTTPStream`: Uses an **HTTP Streamable transport**, designed for deploying as a web service.

For a deployed service, you can configure your client directly:

```json
"mcpServers": {
  "citrea": {
    "url": "https://citramesh.onrender.com/"
  }
}
```

If you deploy your own backend on a service like Render, remember to provide your `PRIVATE_KEY` and `GITHUB_TOKEN` as environment variables.

### Local Setup Steps

1.  **Clone the Repository**

    ```bash
    git clone https://github.com/your-username/citrea-mcp-server.git
    cd citrea-mcp-server
    ```

2.  **Install Dependencies**

    ```bash
    # Install pnpm if you don't have it
    npm install -g pnpm

    # Install project dependencies
    pnpm install
    ```

3.  **Set Up Environment Variables**
    Create a `.env` file by copying the example:

    ```bash
    cp .env.example .env
    ```

    Now, edit the `.env` file with your details:

    ```env
    # Your 64-character hex private key (without the '0x' prefix)
    PRIVATE_KEY=your_private_key_here

    # Required: GitHub Personal Access Token for certain functionalities
    GITHUB_TOKEN=your_github_personal_access_token

    # Optional: Specify a custom directory for caching data (defaults to ~/.citrea-mcp)
    CACHE_DIR=/path/to/custom/cache/directory
    ```

-----

## Configuration

### Environment Variables

| Variable | Required | Description | Default |
| :--- | :--- | :--- | :--- |
| `PRIVATE_KEY` | **Yes** | Private key for signing transactions (deploying tokens, funding faucet claims). | None |
| `GITHUB_TOKEN` | **Yes** | GitHub Personal Access Token, which may be required for registry access. | None |
| `CACHE_DIR` | No | Absolute path to a directory for storing local data like faucet history. | `~/.citrea-mcp` |
| `HOME` | No | Home directory, used as a fallback if `CACHE_DIR` is not set. | System default |

### MCP Client Configuration

To connect this server locally to a client like Claude Desktop, use this configuration:

```json
{
  "mcpServers": {
    "citrea": {
      "command": "node",
      "args": [
        "/path/to/your/project/build/index.js"
      ],
      "env": {
        "PRIVATE_KEY": "your_private_key_here",
        "GITHUB_TOKEN": "your_github_personal_access_token"
      }
    }
  }
}
```

*Note: You can also add `"CACHE_DIR": "/path/to/custom/cache/directory"` inside the `env` object if needed.*

-----

## Usage

### Starting the Server

The server is designed to be run by an MCP client. However, you can run it directly from your terminal for testing if you are on the `HTTPStream` branch.

```bash
# Start the server (it will listen on port 3000 by default)
pnpm start
```

You can then send POST requests to `http://localhost:3000/mcp` with a valid MCP JSON-RPC payload.

-----

## Available Tools

  * `get_citrea_balance`: Get the native cBTC balance of a specific address.
  * `deploy-erc20`: Deploys a new ERC20 token contract to the Citrea testnet.
  * `list-deployed-tokens`: Lists all ERC20 tokens that have been deployed and cached by this server instance.
  * `transfer-token`: Transfer a specified amount of a deployed ERC20 token to a recipient.
  * `list-all-token-balances`: Fetches and lists all ERC20 token balances for a given address using the explorer API.
  * `claim-citrea-faucet`: Request testnet funds from the server's faucet for a given address.
  * `check-faucet-eligibility`: Check if an address can currently claim from the faucet.
  * `get-faucet-stats`: View statistics for the faucet, like total claims and remaining balance.
  * `get-faucet-history`: Retrieve the history of all claims made from the faucet, or filter by a specific address.
  * `get-citrea-explorer-url`: Generate a Citrea testnet explorer link for an address, transaction, or block.
  * `get-wallet-explorer-summary`: Provides a comprehensive analysis of a wallet, including balance, transaction count, and recent activity.
  * `get-transaction-details`: Fetches detailed information for a specific transaction hash.

-----

## Project Structure

```
CitreaMesh/
├── src/
│   ├── contracts/              # Smart contract ABIs and related files
│   │   ├── erc/                # ERC standard contract definitions
│   │   └── mostUsedTokens.json # A list of common tokens
│   ├── utils/                  # General utility functions
│   │   ├── cacheTokens.ts      # Saves deployed token data locally
│   │   └── privateKeyToSigner.ts # Creates an ethers.js signer from a key
│   ├── index.ts                # Main server entry point and tool definitions
│   ├── tokenTransfer.ts        # Handles the logic for transferring ERC20 tokens
│   ├── faucet.ts               # Manages and processes claims for the testnet faucet
│   ├── explorerSummary.ts      # Fetches and formats data from the explorer/RPC
│   ├── configOpts.ts           # Configuration-related options
│   └── file.ts                 # File system utilities
├── .env.example                # Example environment variables file
├── .gitignore                  # Specifies files for Git to ignore
├── package.json                # Project dependencies and scripts
└── README.md                   # This documentation file
```

-----

## Files & Folders Created

When you run the server, it may create the following in your home directory (or `CACHE_DIR` if specified):

```
~/.citrea-mcp/
├── faucet-claims.json      # Stores the history of all faucet claims
└── deployed-tokens.json    # A cache of ERC20 tokens deployed by the `deploy-erc20` tool
```

-----

## Examples

1.  **Check cBTC Balance**

    > "What is the balance of 0x... on Citrea?"

2.  **Use the Faucet**

    > "Claim testnet cBTC from the faucet for my address 0x..."

3.  **Deploy a New Token**

    > "Deploy a new ERC20 token named 'MyCoin' with the symbol 'MYC' and an initial supply of 1,000,000."

4.  **Transfer Tokens**

    > "Send 500 MYC to address 0x..."

5.  **Analyze a Wallet**

    > "Give me a summary of the wallet activity for 0x..."

-----

## Troubleshooting

  * **"Invalid private key" Error**: Ensure your `PRIVATE_KEY` in the `.env` file is 64 hexadecimal characters long and does not have the `0x` prefix.
  * **"Insufficient funds" Error**: The wallet associated with your `PRIVATE_KEY` may not have enough cBTC to pay for transaction gas. Use the faucet tool with a different address to send funds to it, or acquire testnet cBTC from another source.
  * **RPC Errors**: The Citrea testnet RPC might be temporarily down or slow. Check the official Citrea channels for status updates.
  * **File Permissions**: Ensure the application has permission to read/write to the cache directory (`~/.citrea-mcp` or your custom `CACHE_DIR`).

-----

## Contributing

Contributions are welcome\! If you'd like to improve the server or add new tools, please feel free to submit a pull request.

-----

## License

This project is licensed under the MIT License.
