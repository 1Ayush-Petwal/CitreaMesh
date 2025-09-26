import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { transferToken } from "./tokenTransfer.js";

import { config } from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

import { z } from "zod";

import cacheToken from "./utils/cacheTokens.js";
import { CitreaFaucet } from "./faucet.js";
// new citrea imports
// import erc20Token from '../out/erc20Token.sol/erc20Token.json';
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const erc20Token = require("../out/erc20Token.sol/erc20Token.json");

// Load environment variables from .env file
config();

// Create server instance
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
      //   jsonrpc: '2.0',
      //   id: 1,
      //   method: 'logging/setLevel',
      //   params: {
      //     level: 'info',
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
let mcpDir;
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
        content: [
          {
            type: "text",
            text:
              `✅ Transferred ${amount} ${result.symbol} to ${result.recipient}\n` +
              `🔗 Tx: ${result.explorer.transaction}\n` +
              `📜 Contract: ${result.explorer.contract}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error transferring token: ${
              err instanceof Error ? err.message : String(err)
            }`,
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Citrea MCP server started. Listening for requests...");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
