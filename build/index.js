import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "node:path";
import fs from "node:fs";
import { privateKeyToSigner } from "./utils.js";
import { ethers } from "ethers";
import dotenv from "dotenv";
import { z } from "zod";
import cacheToken from "./utils/cacheTokens.js";
dotenv.config();
import { createRequire } from "module";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
const require = createRequire(import.meta.url);
const erc20Token = require("../out/erc20Token.sol/erc20Token.json");
const server = new McpServer({
    name: "citrea-mcp",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
}, {
    capabilities: {
        resources: {
            subscribe: true,
        },
    },
});
const CITREA_RPC = process.env.CITREA_RPC;
const EXPLORER_BASE = process.env.EXPLORER_BASE;
const homeDir = process.env.CACHE_DIR || process.env.HOME;
let mcpDir;
if (homeDir) {
    mcpDir = path.join(homeDir, ".citrea-mcp");
    if (!fs.existsSync(mcpDir)) {
        fs.mkdirSync(mcpDir, { recursive: true });
    }
}
else {
    throw new Error("Environment variable CACHE_DIR or HOME not set. Set it to a valid directory path.");
}
const key = process.env.PRIVATE_KEY;
if (!key) {
    throw new Error("No private key provided");
}
const signer = privateKeyToSigner(key);
server.tool("get_citrea_balance", "Get the native  balance of an address on Citrea", {
    address: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address"),
}, async ({ address }) => {
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
});
server.tool("deploy-erc20", "Deploy a new ERC20 token on Citrea testnet", {
    name: z.string(),
    symbol: z.string(),
    initialSupply: z.string(),
}, async ({ name, symbol, initialSupply }) => {
    const provider = new ethers.providers.JsonRpcProvider(CITREA_RPC);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const factory = new ethers.ContractFactory(erc20Token.abi, erc20Token.bytecode.object, signer);
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
});
server.tool("list-deployed-tokens", "List all deployed ERC20 tokens on Citrea testnet", {}, async () => {
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
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Citrea MCP server started. Listening for requests...");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
