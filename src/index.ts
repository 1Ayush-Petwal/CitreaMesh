import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { transferToken } from "./tokenTransfer.js";

import { config } from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

import { z } from "zod";

import cacheToken from "./utils/cacheTokens.js";
import { CitreaFaucet } from "./faucet.js";
import { CitreaExplorerSummary } from "./explorerSummary.js";

import { createRequire } from "module";
import { privateKeyToSigner } from "./utils/privateKeyToSigner.js";
import express, { Request, Response } from "express";
const app = express();
app.use(express.json());
const require = createRequire(import.meta.url);
const erc20Token = require("../src/contracts/erc/erc20Token.sol/erc20Token.json");
// Load environment variables from .env file
config();

// Create server instance

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`MCP Stateless Streamable HTTP Server listening on PORT ${PORT}`);
});

function getServer() {
  const server = new McpServer(
    {
      name: "citrea-mcp",
      version: "1.0.0",
      capabilities: {
        resources: {},
        tools: {},
      },
    },
    {
      capabilities: {
        // logging: {
        //   jsonrpc: "2.0",
        //   id: 1,
        //   method: "logging/setLevel",
        //   params: {
        //     level: "info",
        //   },
        // },
        resources: {
          subscribe: true,
        },
      },
    }
  );

  const CITREA_RPC = "https://rpc.testnet.citrea.xyz";
  const EXPLORER_BASE = "https://explorer.testnet.citrea.xyz";

  // Create directory for hyperlane-mcp if it doesn't exist
  const homeDir = process.env.CACHE_DIR || process.env.HOME;
  let mcpDir: string;
  if (homeDir) {
    mcpDir = path.join(homeDir, ".citrea-mcp");
    if (!fs.existsSync(mcpDir)) {
      fs.mkdirSync(mcpDir, { recursive: true });
    }
  } else {
    throw new Error(
      "Environment variable CACHE_DIR or HOME not set. Set it to a valid directory path."
    );
  }

  // init key
  const key = process.env.PRIVATE_KEY;
  if (!key) {
    throw new Error("No private key provided");
  }

  // Initialize Citrea Faucet
  const citreaFaucet = new CitreaFaucet(key, CITREA_RPC, mcpDir, {
    maxClaimsPerDay: 5,
    maxAmountPerClaim: "0.0001",
    windowHours: 24,
  });

  // Initialize Citrea Explorer Summary
  const explorerSummary = new CitreaExplorerSummary(CITREA_RPC, EXPLORER_BASE);
  const signer = privateKeyToSigner(key);

  server.tool(
    "get_citrea_balance",
    "Get the native  balance of an address on Citrea",
    {
      address: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address"),
    },
    async ({ address }) => {
      const provider = new ethers.providers.JsonRpcProvider(CITREA_RPC);
      const balance = await provider.getBalance(address);
      const formatted = ethers.utils.formatUnits(balance, 18);
      return {
        content: [
          {
            type: "text",
            text: `Balance of ${address} on Citrea: ${formatted} cBTC`,
          },
        ],
      };
    }
  );

  server.tool(
    "deploy-erc20",
    "Deploy a new ERC20 token on Citrea testnet",
    {
      name: z.string(),
      symbol: z.string(),
      initialSupply: z.string(),
    },
    async ({ name, symbol, initialSupply }) => {
      const provider = new ethers.providers.JsonRpcProvider(CITREA_RPC);
      const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

      const factory = new ethers.ContractFactory(
        erc20Token.abi,
        erc20Token.bytecode.object,
        signer
      );

      const units = ethers.utils.parseUnits(initialSupply, 18);

      const contract = await factory.deploy(name, symbol, units);
      await contract.deployTransaction.wait();

      const txHash = contract.deployTransaction.hash;

      const result = {
        address: contract.address,
        txHash,
        explorer: {
          contract: `${EXPLORER_BASE}/address/${contract.address}`,
          transaction: `${EXPLORER_BASE}/tx/${txHash}`,
        },
        name,
        symbol,
        supply: initialSupply,
        network: "Citrea Testnet",
      };
      cacheToken(mcpDir, result);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "list-deployed-tokens",
    "List all deployed ERC20 tokens on Citrea testnet",
    {},
    async () => {
      const file = path.join(mcpDir, "deployed-tokens.json");
      if (!fs.existsSync(file)) {
        return { content: [{ type: "text", text: "No tokens deployed yet." }] };
      }
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "claim-citrea-faucet",
    "Claim cBTC from the Citrea faucet. Users can claim 0.0001 cBTC up to 5 times per 24 hours.",
    {
      address: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
        .describe("Recipient Citrea address to receive cBTC"),
    },
    async ({ address }) => {
      try {
        const result = await citreaFaucet.claimFaucet(address);

        if (result.success) {
          return {
            content: [
              {
                type: "text",
                text:
                  `✅ Faucet claim successful!\n\n` +
                  `💰 Amount: ${result.amount} cBTC\n` +
                  `📍 Recipient: ${address}\n` +
                  `🔗 Transaction: ${EXPLORER_BASE}/tx/${result.txHash}\n` +
                  `💳 Remaining faucet balance: ${result.balance} cBTC`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `❌ Faucet claim failed: ${result.error}`,
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error claiming from faucet: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "check-faucet-eligibility",
    "Check if an address is eligible to claim from the Citrea faucet and see remaining claims.",
    {
      address: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
        .describe("Address to check eligibility for"),
    },
    async ({ address }) => {
      try {
        const eligibility = await citreaFaucet.checkEligibility(address);

        if (eligibility.eligible) {
          return {
            content: [
              {
                type: "text",
                text:
                  `✅ Address ${address} is eligible for faucet claims!\n\n` +
                  `🎯 Remaining claims: ${eligibility.remainingClaims}/5 in the next 24 hours\n` +
                  `💰 Amount per claim: 0.0001 cBTC`,
              },
            ],
          };
        } else {
          let message =
            `❌ Address ${address} is not eligible for faucet claims.\n\n` +
            `📋 Reason: ${eligibility.reason}`;

          if (eligibility.nextClaimTime) {
            const nextClaim = new Date(eligibility.nextClaimTime);
            message += `\n⏰ Next claim available: ${nextClaim.toLocaleString()}`;
          }

          return {
            content: [
              {
                type: "text",
                text: message,
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error checking eligibility: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "get-faucet-stats",
    "Get statistics about the Citrea faucet including total claims, distributed amount, and current balance.",
    {},
    async () => {
      try {
        const stats = await citreaFaucet.getFaucetStats();

        return {
          content: [
            {
              type: "text",
              text:
                `📊 Citrea Faucet Statistics\n\n` +
                `💰 Current faucet balance: ${stats.faucetBalance} cBTC\n` +
                `📈 Total claims made: ${stats.totalClaims}\n` +
                `💸 Total distributed: ${stats.totalDistributed} cBTC\n` +
                `👥 Unique addresses served: ${stats.uniqueAddresses}\n\n` +
                `⚙️ Faucet Limits:\n` +
                `   • Max claims per user: ${stats.limits.maxClaimsPerDay} per ${stats.limits.windowHours} hours\n` +
                `   • Amount per claim: ${stats.limits.maxAmountPerClaim} cBTC`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error getting faucet stats: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "get-faucet-history",
    "Get claim history for a specific address or all faucet claims.",
    {
      address: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
        .optional()
        .describe(
          "Address to get claim history for (optional - if not provided, returns all claims)"
        ),
    },
    async ({ address }) => {
      try {
        const history = await citreaFaucet.getClaimHistory(address);

        if (history.length === 0) {
          const message = address
            ? `No faucet claims found for address ${address}`
            : "No faucet claims have been made yet";

          return {
            content: [
              {
                type: "text",
                text: message,
              },
            ],
          };
        }

        const title = address
          ? `📋 Faucet claim history for ${address}`
          : `📋 All faucet claims (${history.length} total)`;

        const historyText = history
          .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
          .map((claim, index) => {
            const date = new Date(claim.timestamp).toLocaleString();
            return (
              `${index + 1}. ${claim.address}\n` +
              `   💰 Amount: ${claim.amount} cBTC\n` +
              `   📅 Date: ${date}\n` +
              `   🔗 Tx: ${EXPLORER_BASE}/tx/${claim.txHash}`
            );
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `${title}\n\n${historyText}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error getting faucet history: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );

  //explorer
  server.tool(
    "get-citrea-explorer-url",
    "Generate Citrea explorer URLs for addresses, transactions, or blocks.",
    {
      type: z
        .enum(["address", "transaction", "block"])
        .describe("Type of explorer URL to generate"),
      value: z
        .string()
        .describe("Address (0x...), transaction hash (0x...), or block number"),
    },
    async ({ type, value }) => {
      try {
        let url: string;
        let description: string;

        switch (type) {
          case "address":
            if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
              throw new Error("Invalid address format");
            }
            url = explorerSummary.getAddressUrl(value);
            description = `Address details for ${value}`;
            break;

          case "transaction":
            if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
              throw new Error("Invalid transaction hash format");
            }
            url = explorerSummary.getTransactionUrl(value);
            description = `Transaction details for ${value}`;
            break;

          case "block":
            const blockNum = parseInt(value);
            if (isNaN(blockNum) || blockNum < 0) {
              throw new Error("Invalid block number");
            }
            url = explorerSummary.getBlockUrl(blockNum);
            description = `Block details for block ${blockNum}`;
            break;

          default:
            throw new Error(
              "Invalid type. Must be address, transaction, or block"
            );
        }

        return {
          content: [
            {
              type: "text",
              text:
                `🔗 **${description}**\n\n` +
                `Explorer URL: ${url}\n\n` +
                `This link will show detailed information about the ${type} on the Citrea testnet explorer, ` +
                `including transaction history, balance, and other relevant blockchain data.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error generating explorer URL: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "get-wallet-explorer-summary",
    "Get comprehensive wallet analysis including recent transactions, gas usage statistics, and explorer details. This tool provides RPC-grounded data suitable for LLM analysis.",
    {
      address: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
        .describe("Wallet address to analyze"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(10)
        .describe(
          "Maximum number of recent transactions to include (1-50, default: 10)"
        ),
    },
    async ({ address, limit }) => {
      try {
        const summary = await explorerSummary.getWalletSummary(address, limit);

        // Format the response for LLM consumption
        let response = `📊 **Wallet Analysis for ${address}**\n\n`;

        // Basic wallet info
        response += `💰 **Current Balance:** ${summary.balance} cBTC\n`;
        response += `📈 **Total Transactions:** ${summary.transactionCount}\n`;
        response += `🔗 **Explorer:** ${explorerSummary.getAddressUrl(
          address
        )}\n\n`;

        // Gas statistics
        if (summary.recentTransactions.length > 0) {
          response += `⛽ **Gas Statistics (Last ${summary.recentTransactions.length} transactions):**\n`;
          response += `   • Total Gas Used: ${summary.totalGasUsed}\n`;
          response += `   • Average Gas Price: ${summary.averageGasPrice} gwei\n`;
          response += `   • Total Gas Cost: ${summary.totalGasCost} cBTC\n\n`;

          // Recent transactions
          response += `📋 **Recent Transactions:**\n`;
          summary.recentTransactions.forEach((tx, index) => {
            response += `\n**${index + 1}. Transaction ${tx.hash.substring(
              0,
              10
            )}...**\n`;
            response += `   • Block: ${tx.blockNumber} (${tx.confirmations} confirmations)\n`;
            response += `   • Status: ${
              tx.status === "success" ? "✅" : "❌"
            } ${tx.status}\n`;
            response += `   • Value: ${tx.value} cBTC\n`;
            response += `   • From: ${tx.from}\n`;
            response += `   • To: ${tx.to || "Contract Creation"}\n`;
            response += `   • Gas Used: ${tx.gasUsed} (${tx.gasPrice} gwei)\n`;
            response += `   • Gas Cost: ${tx.gasCost} cBTC\n`;
            response += `   • Explorer: ${tx.explorerUrl}\n`;
          });
        } else {
          response += `📋 **Recent Transactions:** No transactions found in the last ${summary.blockRange.scanned} blocks\n`;
        }

        // Block scan info
        response += `\n🔍 **Scan Information:**\n`;
        response += `   • Blocks scanned: ${summary.blockRange.scanned} (${summary.blockRange.from} to ${summary.blockRange.to})\n`;
        response += `   • This analysis is based on RPC data from Citrea testnet\n`;

        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error getting wallet explorer summary: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "get-transaction-details",
    "Get detailed information about a specific Citrea transaction including gas usage and explorer link.",
    {
      txHash: z
        .string()
        .length(66)
        .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash")
        .describe("Transaction hash to analyze"),
    },
    async ({ txHash }) => {
      try {
        const txDetails = await explorerSummary.getTransactionDetails(txHash);

        let response = `🔍 **Transaction Details for ${txHash}**\n\n`;

        response += `✅ **Status:** ${
          txDetails.status === "success" ? "✅ Success" : "❌ Failed"
        }\n`;
        response += `📦 **Block:** ${txDetails.blockNumber} (${txDetails.confirmations} confirmations)\n`;
        response += `💰 **Value:** ${txDetails.value} cBTC\n`;
        response += `📤 **From:** ${txDetails.from}\n`;
        response += `📥 **To:** ${txDetails.to || "Contract Creation"}\n\n`;

        response += `⛽ **Gas Information:**\n`;
        response += `   • Gas Used: ${txDetails.gasUsed}\n`;
        response += `   • Gas Price: ${txDetails.gasPrice} gwei\n`;
        response += `   • Gas Cost: ${txDetails.gasCost} cBTC\n\n`;

        response += `🔗 **Explorer:** ${txDetails.explorerUrl}\n`;

        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error getting transaction details: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );

  // Async function for token transfer with gas estimation
  async function executeTokenTransferWithGasEstimation(symbol: string, recipient: string, amount: string) {
    try {
      // Find the token (same logic as original transfer-token)
      let token: { name: string; symbol: string; address: string } | undefined;
      const targetSymbol = symbol.toLowerCase();

      // 1. mostUsedTokens.json
      const mostUsedFile = path.join(process.cwd(), "mostUsedTokens.json");
      if (fs.existsSync(mostUsedFile)) {
        const mostUsed = JSON.parse(fs.readFileSync(mostUsedFile, "utf-8"));
        token = mostUsed.find(
          (t: any) => t.symbol && t.symbol.toLowerCase() === targetSymbol
        );
      }

      // 2. deployed-tokens.json
      if (!token) {
        const deployedFile = path.join(mcpDir, "deployed-tokens.json");
        if (fs.existsSync(deployedFile)) {
          const deployed = JSON.parse(fs.readFileSync(deployedFile, "utf-8"));
          token = deployed.find(
            (t: any) =>
              t.symbol && t.symbol.toLowerCase() === targetSymbol.toLowerCase()
          );
        }
      }

      if (!token) {
        throw new Error(
          `Token with symbol ${symbol} not found in mostUsedTokens.json or deployed-tokens.json.`
        );
      }

      // Set up provider - try Alchemy first, fallback to Citrea RPC
      const ALCHEMY_RPC = "https://citrea-testnet.g.alchemy.com/v2/jeTbHyricxOeE9tK55txS";
      let provider: ethers.providers.JsonRpcProvider;
      let usingAlchemy = true;

      try {
        provider = new ethers.providers.JsonRpcProvider(ALCHEMY_RPC);
        await provider.getBlockNumber(); // Test connection
      } catch (e) {
        console.warn("Alchemy API unavailable, falling back to Citrea RPC");
        provider = new ethers.providers.JsonRpcProvider(CITREA_RPC);
        usingAlchemy = false;
      }

      const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

      const ERC20_ABI = [
        "function transfer(address to, uint256 amount) public returns (bool)",
        "function decimals() view returns (uint8)",
      ];

      const contract = new ethers.Contract(token.address, ERC20_ABI, signer);
      const decimals = await contract.decimals();
      const amt = ethers.utils.parseUnits(amount, decimals);

      // EIP-1559 Gas estimation
      const gasLimit = await contract.estimateGas.transfer(recipient, amt);

      // Get EIP-1559 fee data
      const feeData = await provider.getFeeData();
      const baseFee = feeData.lastBaseFeePerGas || ethers.BigNumber.from("20000000000"); // 20 gwei fallback
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.BigNumber.from("2000000000"); // 2 gwei fallback
      const maxFeePerGas = feeData.maxFeePerGas || baseFee.add(maxPriorityFeePerGas);

      // Calculate total fee: Gas Limit × (Base Fee + Priority Fee)
      const estimatedTotalFee = gasLimit.mul(baseFee.add(maxPriorityFeePerGas));
      const maxTotalFee = gasLimit.mul(maxFeePerGas);

      // Format values for display
      const baseFeeGwei = ethers.utils.formatUnits(baseFee, "gwei");
      const priorityFeeGwei = ethers.utils.formatUnits(maxPriorityFeePerGas, "gwei");
      const maxFeeGwei = ethers.utils.formatUnits(maxFeePerGas, "gwei");
      const estimatedCostEth = ethers.utils.formatEther(estimatedTotalFee);
      const maxCostEth = ethers.utils.formatEther(maxTotalFee);

      const gasEstimation = {
        gasLimit: gasLimit.toString(),
        baseFeePerGas: baseFeeGwei,
        maxPriorityFeePerGas: priorityFeeGwei,
        maxFeePerGas: maxFeeGwei,
        estimatedCost: estimatedCostEth,
        maxCost: maxCostEth,
        network: usingAlchemy ? 'Alchemy' : 'Citrea RPC'
      };

      // Execute the transfer
      const result = await transferToken(
        mcpDir,
        symbol,
        recipient,
        amount,
        process.env.PRIVATE_KEY!,
        CITREA_RPC,
        EXPLORER_BASE
      );

      console.log("Gas Estimation... Report:: ", gasEstimation);

      return {
        success: true,
        gasEstimation,
        transferResult: result,
        token: {
          name: token.name,
          symbol: token.symbol,
          address: token.address
        }
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  // Simple async function for basic token transfer
  async function executeBasicTokenTransfer(symbol: string, recipient: string, amount: string) {
    try {
      const result = await transferToken(
        mcpDir,
        symbol,
        recipient,
        amount,
        process.env.PRIVATE_KEY!,
        CITREA_RPC,
        EXPLORER_BASE
      );

      return {
        success: true,
        result
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  server.tool(
    "transfer-token-with-gas-estimation",
    "Transfer ERC20 tokens with detailed EIP-1559 gas estimation. Queries JSON-RPC endpoint for baseFee and maxPriorityFeePerGas, then calculates total fee.",
    {
      symbol: z.string().describe("Token symbol, e.g. 'mCTR'"),
      recipient: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
        .describe("Recipient address"),
      amount: z.string().describe("Amount to transfer (human-readable units)"),
    },
    async ({ symbol, recipient, amount }) => {
      const result = await executeTokenTransferWithGasEstimation(symbol, recipient, amount);

      if (result.success) {
        const gasInfo = result.gasEstimation!;
        const transferInfo = result.transferResult!;
        const tokenInfo = result.token!;

        const response =
          `⛽ **EIP-1559 Gas Estimation & Transfer**\n\n` +
          `📊 **Transaction Details:**\n` +
          `   • Token: ${amount} ${tokenInfo.symbol} (${tokenInfo.name})\n` +
          `   • From: ${process.env.PRIVATE_KEY ? new ethers.Wallet(process.env.PRIVATE_KEY).address : 'N/A'}\n` +
          `   • To: ${recipient}\n` +
          `   • Contract: ${tokenInfo.address}\n\n` +
          `💰 **EIP-1559 Gas Breakdown:**\n` +
          `   • Gas Limit: ${gasInfo.gasLimit} units\n` +
          `   • Base Fee: ${gasInfo.baseFeePerGas} gwei\n` +
          `   • Priority Fee: ${gasInfo.maxPriorityFeePerGas} gwei\n` +
          `   • Max Fee Per Gas: ${gasInfo.maxFeePerGas} gwei\n\n` +
          `💸 **Fee Calculation (Gas Limit × (Base Fee + Priority Fee)):**\n` +
          `   • Estimated Cost: ${gasInfo.estimatedCost} cBTC\n` +
          `   • Maximum Cost: ${gasInfo.maxCost} cBTC\n\n` +
          `🔗 **Network:** Citrea Testnet (via ${gasInfo.network})\n\n` +
          `✅ **Transfer Results:**\n` +
          `   • Amount: ${amount} ${transferInfo.symbol}\n` +
          `   • Recipient: ${transferInfo.recipient}\n` +
          `   • Transaction: ${transferInfo.explorer.transaction}\n` +
          `   • Contract: ${transferInfo.explorer.contract}`;

        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error in gas estimation and transfer: ${result.error}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "transfer-token",
    "Transfer a deployed ERC20 token (from deployed-tokens.json) on Citrea",
    {
      symbol: z.string().describe("Token symbol, e.g. 'mCTR'"),
      recipient: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
        .describe("Recipient address"),
      amount: z.string().describe("Amount to transfer (human-readable units)"),
    },
    async ({ symbol, recipient, amount }) => {
      const result = await executeBasicTokenTransfer(symbol, recipient, amount);

      if (result.success) {
        const transferInfo = result.result!;
        return {
          content: [
            {
              type: "text",
              text:
                `✅ Transferred ${amount} ${transferInfo.symbol} to ${transferInfo.recipient}\n` +
                `🔗 Tx: ${transferInfo.explorer.transaction}\n` +
                `📜 Contract: ${transferInfo.explorer.contract}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error transferring token: ${result.error}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "list-all-token-balances",
    "Get all ERC20 token balances owned by an address on Citrea (via explorer API). Supports both tokenlist (balances) and token metadata.",
    {
      address: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
        .describe("Wallet address to fetch balances for"),
    },
    async ({ address }) => {
      try {
        const url = `${EXPLORER_BASE}/api?module=account&action=tokenlist&address=${address}`;
        const res = await fetch(url);
        const data: any = await res.json();

        if (data.status !== "1" || !data.result) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Failed to fetch token list: ${
                  data.message || "Unknown error"
                }`,
              },
            ],
          };
        }

        let output = `📊 Tokens for ${address}\n\n`;

        // Case 1: Explorer returns an ARRAY (balances)
        if (Array.isArray(data.result)) {
          if (data.result.length === 0) {
            output += "No ERC20 tokens found for this address.";
          } else {
            output += data.result
              .map((t: any) => {
                const formatted = ethers.utils.formatUnits(
                  t.balance || "0",
                  parseInt(t.decimal || "18", 10)
                );
                return `• ${t.symbol || "UNKNOWN"} (${
                  t.name || "Unknown Token"
                })\n   Balance: ${formatted}\n   Contract: ${
                  t.contractAddress
                }`;
              })
              .join("\n\n");
          }
        }

        // Case 2: Explorer returns a SINGLE OBJECT (metadata)
        else if (typeof data.result === "object") {
          const t = data.result;
          output +=
            `Token: ${t.symbol} (${t.name})\n` +
            `Decimals: ${t.decimals}\n` +
            `Total Supply: ${t.totalSupply}\n` +
            `Contract: ${t.contractAddress}\n` +
            `Type: ${t.type}`;
        }

        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error fetching token balances: ${
                err instanceof Error ? err.message : String(err)
              }`,
            },
          ],
        };
      }
    }
  );
  return server;
  // async function main() {
  //   const transport = new StdioServerTransport();
  //   await server.connect(transport);
  //   console.error("Citrea MCP server started. Listening for requests...");
  // }

  // main().catch((error) => {
  //   console.error("Fatal error in main():", error);
  //   process.exit(1);
  // });
}

app.post("/mcp", async (req: Request, res: Response) => {
  try {
    const server = getServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      console.log("Request Closed");
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("Error handling MCP request:", e);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});
