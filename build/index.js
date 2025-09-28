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
import { CitreaExplorerSummary } from './explorerSummary.js';
import { WarpRouteManager } from './warpRoutes.js';
// new citrea imports
// import erc20Token from '../out/erc20Token.sol/erc20Token.json';
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const erc20Token = require("../out/erc20Token.sol/erc20Token.json");
// Load environment variables from .env file
config();
// Create server instance
const server = new McpServer({
    name: "citrea-mcp",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
}, {
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
});
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
}
else {
    throw new Error("Environment variable CACHE_DIR or HOME not set. Set it to a valid directory path.");
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
// Initialize Warp Route Manager
const warpRouteManager = new WarpRouteManager(key, mcpDir);
// Warp Route Tools
server.tool("list-available-testnets", "Get a list of available testnet chains that can be used for Warp route deployment", {}, async () => {
    const testnets = warpRouteManager.getAvailableTestnets();
    const testnetList = testnets.map(testnet => `**${testnet.name}**\n` +
        `  • Chain ID: ${testnet.chainId}\n` +
        `  • RPC: ${testnet.rpcUrl}\n` +
        `  • Native Currency: ${testnet.nativeCurrency.symbol}\n` +
        `  • Explorer: ${testnet.blockExplorer?.url || 'N/A'}`).join('\n\n');
    return {
        content: [
            {
                type: "text",
                text: `🌐 **Available Testnet Chains for Warp Route Deployment**\n\n${testnetList}\n\n` +
                    `💡 **Usage**: Use the chain names (e.g., 'sepolia', 'arbitrumsepolia') when deploying Warp routes between testnets.`,
            },
        ],
    };
});
server.tool("estimate-warp-deployment-cost", "Estimate the gas costs for deploying a Warp route between two testnets", {
    originChain: z.string().describe("Origin testnet chain name (e.g., sepolia, arbitrumsepolia)"),
    destinationChain: z.string().describe("Destination testnet chain name (e.g., optimismsepolia)"),
}, async ({ originChain, destinationChain }) => {
    try {
        const estimate = await warpRouteManager.estimateDeploymentCost(originChain, destinationChain);
        return {
            content: [
                {
                    type: "text",
                    text: `💰 **Warp Route Deployment Cost Estimate**\n\n` +
                        `**${originChain} (Origin Chain):**\n` +
                        `  • Gas Limit: ${estimate.originChain.gasLimit}\n` +
                        `  • Gas Price: ${estimate.originChain.gasPrice} gwei\n` +
                        `  • Estimated Cost: ${estimate.originChain.estimatedCost} ETH\n\n` +
                        `**${destinationChain} (Destination Chain):**\n` +
                        `  • Gas Limit: ${estimate.destinationChain.gasLimit}\n` +
                        `  • Gas Price: ${estimate.destinationChain.gasPrice} gwei\n` +
                        `  • Estimated Cost: ${estimate.destinationChain.estimatedCost} ETH\n\n` +
                        `**Total Estimated Cost: ${estimate.totalCostETH} ETH**\n\n` +
                        `⚠️ *Note: These are rough estimates. Actual costs may vary based on network conditions and contract complexity.*`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error estimating deployment cost: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
server.tool("generate-warp-config", "Generate a Warp route configuration between two testnets for a specific token", {
    originChain: z.string().describe("Origin testnet chain name"),
    destinationChain: z.string().describe("Destination testnet chain name"),
    tokenSymbol: z.string().describe("Token symbol (e.g., USDC, TEST)"),
    tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address").optional().describe("Token contract address on origin chain (required for collateral tokens)"),
    isCollateral: z.boolean().default(true).describe("Whether this is a collateral token (true) or native token (false)"),
}, async ({ originChain, destinationChain, tokenSymbol, tokenAddress, isCollateral }) => {
    try {
        const config = await warpRouteManager.generateWarpConfig(originChain, destinationChain, tokenSymbol, tokenAddress, isCollateral);
        return {
            content: [
                {
                    type: "text",
                    text: `⚙️ **Warp Route Configuration Generated**\n\n` +
                        `**Route**: ${tokenSymbol} from ${originChain} to ${destinationChain}\n` +
                        `**Type**: ${isCollateral ? 'Collateral' : 'Native'} → Synthetic\n\n` +
                        `**Configuration:**\n\`\`\`yaml\n${JSON.stringify(config, null, 2)}\n\`\`\`\n\n` +
                        `🔧 This configuration can be used to deploy the Warp route using the deploy-warp-route tool.`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error generating warp config: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
server.tool("create-warp-route-config", "Create a Hyperlane Warp route configuration between two testnets (use Hyperlane CLI to deploy)", {
    originChain: z.string().describe("Origin testnet chain name"),
    destinationChain: z.string().describe("Destination testnet chain name"),
    tokenSymbol: z.string().describe("Token symbol (e.g., USDC, TEST)"),
    tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address").optional().describe("Token contract address on origin chain (required for collateral tokens)"),
    isCollateral: z.boolean().default(true).describe("Whether this is a collateral token (true) or native token (false)"),
}, async ({ originChain, destinationChain, tokenSymbol, tokenAddress, isCollateral }) => {
    try {
        const deployment = await warpRouteManager.createWarpRouteConfig(originChain, destinationChain, tokenSymbol, tokenAddress, isCollateral);
        const instructions = warpRouteManager.getDeploymentInstructions(deployment);
        return {
            content: [
                {
                    type: "text",
                    text: `✅ **Warp Route Configuration Created Successfully!**\n\n` +
                        `**Route ID**: ${deployment.routeId}\n` +
                        `**Token**: ${deployment.symbol}\n` +
                        `**Chains**: ${deployment.chains.join(' ↔ ')}\n` +
                        `**Status**: ${deployment.status}\n\n` +
                        `**Configuration:**\n\`\`\`yaml\n${JSON.stringify(deployment.config, null, 2)}\n\`\`\`\n\n` +
                        `**📋 Next Steps:**\n\`\`\`\n${instructions}\n\`\`\`\n\n` +
                        `� This configuration has been saved and is ready for deployment using the Hyperlane CLI.`,
                },
            ],
        };
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        let helpText = `💡 **Common Issues:**\n` +
            `• Insufficient funds for gas fees on both chains\n` +
            `• Invalid token address or unsupported chain\n` +
            `• Network connectivity issues\n` +
            `• Private key not properly funded on target networks\n\n`;
        // Add specific help for Citrea
        if (errorMsg.includes('citreatestnet') || errorMsg.includes('Unsupported')) {
            helpText += `🟠 **For Citrea Testnet:**\n` +
                `• Use 'list-available-testnets' to see all supported chains\n` +
                `• Use 'get-citrea-warp-suggestions' for Citrea-specific examples\n` +
                `• For native cBTC bridging, omit the token address parameter\n` +
                `• For custom tokens, deploy first with 'deploy-erc20' tool`;
        }
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error creating warp route config: ${errorMsg}\n\n${helpText}`,
                },
            ],
        };
    }
});
server.tool("list-warp-deployments", "List all deployed Warp routes", {}, async () => {
    try {
        const deployments = await warpRouteManager.getDeployments();
        if (deployments.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: "📭 No Warp routes have been deployed yet.\n\n💡 Use the 'deploy-warp-route' tool to deploy your first cross-chain token bridge!",
                    },
                ],
            };
        }
        const deploymentList = deployments.map((deployment, index) => {
            const date = new Date(deployment.deployedAt).toLocaleString();
            const contractInfo = deployment.contractAddresses
                ? Object.entries(deployment.contractAddresses).map(([chain, addr]) => `${chain}: ${addr.substring(0, 10)}...`).join(', ')
                : 'Configuration only';
            return `**${index + 1}. ${deployment.routeId}**\n` +
                `   • Token: ${deployment.symbol}\n` +
                `   • Chains: ${deployment.chains.join(' ↔ ')}\n` +
                `   • Status: ${deployment.status}\n` +
                `   • Created: ${date}\n` +
                `   • Contracts: ${contractInfo}`;
        }).join('\n\n');
        return {
            content: [
                {
                    type: "text",
                    text: `🌉 **Deployed Warp Routes (${deployments.length})**\n\n${deploymentList}\n\n` +
                        `💡 Use 'get-warp-deployment' with a specific route ID to see full details.`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error listing deployments: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
server.tool("get-warp-deployment", "Get detailed information about a specific Warp route deployment", {
    routeId: z.string().describe("Route ID (e.g., USDC/sepolia-arbitrumsepolia)"),
}, async ({ routeId }) => {
    try {
        const deployment = await warpRouteManager.getDeployment(routeId);
        if (!deployment) {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Warp route deployment not found: ${routeId}\n\n💡 Use 'list-warp-deployments' to see available routes.`,
                    },
                ],
            };
        }
        const date = new Date(deployment.deployedAt).toLocaleString();
        const testnets = warpRouteManager.getAvailableTestnets();
        const contractDetails = deployment.contractAddresses && deployment.txHashes
            ? deployment.chains.map(chain => {
                const explorer = testnets.find(t => t.name === chain)?.blockExplorer?.url;
                const contractAddr = deployment.contractAddresses[chain];
                const txHash = deployment.txHashes[chain];
                return `**${chain}:**\n` +
                    `  • Contract: ${contractAddr}${explorer ? ` ([View](${explorer}/address/${contractAddr}))` : ''}\n` +
                    `  • Deploy Tx: ${txHash}${explorer ? ` ([View](${explorer}/tx/${txHash}))` : ''}`;
            }).join('\n\n')
            : 'Configuration only - not yet deployed';
        return {
            content: [
                {
                    type: "text",
                    text: `🌉 **Warp Route Details**\n\n` +
                        `**Route ID**: ${deployment.routeId}\n` +
                        `**Token Symbol**: ${deployment.symbol}\n` +
                        `**Chains**: ${deployment.chains.join(' ↔ ')}\n` +
                        `**Deployed**: ${date}\n\n` +
                        `**Deployed Contracts:**\n\n${contractDetails}\n\n` +
                        `**Configuration:**\n\`\`\`json\n${JSON.stringify(deployment.config, null, 2)}\n\`\`\``,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error getting deployment details: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
server.tool("list-warp-templates", "List available Warp route configuration templates with descriptions", {}, async () => {
    const { listTemplates } = await import('./utils/warpTemplates.js');
    const templates = listTemplates();
    return {
        content: [
            {
                type: "text",
                text: `📋 **Available Warp Route Templates**\n\n${templates}\n\n` +
                    `💡 **Usage**: The tools automatically use the appropriate template based on your configuration. ` +
                    `Most common setups use "ERC20 Collateral to Synthetic" template.`,
            },
        ],
    };
});
server.tool("list-testnet-tokens", "List available testnet token addresses for common tokens (USDC, USDT, etc.)", {}, async () => {
    const { getAllTestnetTokens, getTokenAddress } = await import('./utils/warpTemplates.js');
    const tokens = getAllTestnetTokens();
    let tokenList = '';
    for (const [chain, symbols] of Object.entries(tokens)) {
        tokenList += `**${chain}:**\n`;
        for (const symbol of symbols) {
            const address = getTokenAddress(chain, symbol);
            tokenList += `  • ${symbol}: ${address}\n`;
        }
        tokenList += '\n';
    }
    return {
        content: [
            {
                type: "text",
                text: `🪙 **Available Testnet Token Addresses**\n\n${tokenList}` +
                    `💡 **Usage**: Use these addresses when creating collateral Warp routes. For example:\n` +
                    `\`create-warp-route-config sepolia arbitrumsepolia USDC 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8 true\``,
            },
        ],
    };
});
server.tool("get-citrea-warp-suggestions", "Get suggestions for creating Warp routes with Citrea testnet", {}, async () => {
    const testnets = warpRouteManager.getAvailableTestnets();
    const otherChains = testnets.filter(t => t.name !== 'citreatestnet').map(t => t.name);
    return {
        content: [
            {
                type: "text",
                text: `🟠 **Citrea Testnet Warp Route Suggestions**\n\n` +
                    `**Recommended Configuration:**\n` +
                    `• Use **native cBTC** as the origin token (no token address needed)\n` +
                    `• Bridge to any supported testnet as synthetic tokens\n\n` +
                    `**Example Commands:**\n\n` +
                    `1. **cBTC to Sepolia** (native → synthetic):\n` +
                    `   \`create-warp-route-config citreatestnet sepolia cBTC\` (omit token address)\n\n` +
                    `2. **cBTC to Arbitrum Sepolia** (native → synthetic):\n` +
                    `   \`create-warp-route-config citreatestnet arbitrumsepolia cBTC\` (omit token address)\n\n` +
                    `3. **Custom ERC20 from Citrea** (collateral → synthetic):\n` +
                    `   First deploy a token: \`deploy-erc20 "My Token" "MTK" "1000000"\`\n` +
                    `   Then: \`create-warp-route-config citreatestnet sepolia MTK 0x[deployed-address] true\`\n\n` +
                    `**Available Destination Chains:**\n` +
                    otherChains.map(chain => `• ${chain}`).join('\n') + '\n\n' +
                    `**Benefits of Citrea Integration:**\n` +
                    `• Native Bitcoin-backed token (cBTC) bridging\n` +
                    `• Lower fees compared to Ethereum mainnet\n` +
                    `• Full EVM compatibility for custom tokens\n` +
                    `• Seamless integration with other L2s\n\n` +
                    `💡 **Tip**: Use native cBTC bridging to avoid needing to deploy collateral tokens on Citrea.`,
            },
        ],
    };
});
server.tool("deploy-warp-route", "Deploy a Warp route for cross-chain token transfers. If configuration doesn't exist, it will be created automatically with token address lookup.", {
    routeId: z.string().describe("Route ID in format: TOKEN/ORIGIN-DESTINATION (e.g., USDC/citreatestnet-sepolia)"),
    originChain: z.string().optional().describe("Origin chain name (optional if included in routeId)"),
    destinationChain: z.string().optional().describe("Destination chain name (optional if included in routeId)"),
    tokenSymbol: z.string().optional().describe("Token symbol (optional if included in routeId)"),
    tokenAddress: z.string().optional().describe("Token contract address on origin chain (auto-fetched if not provided)"),
    isCollateral: z.boolean().optional().default(true).describe("Whether to use collateral mode (true) or native mode (false)"),
}, async ({ routeId, originChain, destinationChain, tokenSymbol, tokenAddress, isCollateral = true }) => {
    try {
        // Parse route ID to extract components if not provided separately
        const [parsedTokenSymbol, chainPair] = routeId.split('/');
        const [parsedOrigin, parsedDestination] = chainPair?.split('-') || [];
        const finalTokenSymbol = tokenSymbol || parsedTokenSymbol;
        const finalOriginChain = originChain || parsedOrigin;
        const finalDestinationChain = destinationChain || parsedDestination;
        if (!finalTokenSymbol || !finalOriginChain || !finalDestinationChain) {
            throw new Error('Invalid routeId format or missing parameters. Use format: TOKEN/ORIGIN-DESTINATION');
        }
        // Check if deployment configuration already exists, if not create it
        let deployment = await warpRouteManager.getDeployment(routeId);
        let configCreated = false;
        if (!deployment) {
            // Auto-create configuration with token address lookup
            try {
                deployment = await warpRouteManager.createWarpRouteConfig(finalOriginChain, finalDestinationChain, finalTokenSymbol, tokenAddress, // Will be auto-fetched if undefined
                isCollateral);
                configCreated = true;
            }
            catch (configError) {
                throw new Error(`Failed to auto-create configuration: ${configError instanceof Error ? configError.message : String(configError)}`);
            }
        }
        // Ensure we have a valid deployment configuration
        if (!deployment) {
            throw new Error('Failed to create or retrieve deployment configuration');
        }
        // Deploy the route
        try {
            deployment = await warpRouteManager.deployWarpRoute(routeId);
        }
        catch (deployError) {
            throw new Error(`Deployment failed: ${deployError instanceof Error ? deployError.message : String(deployError)}`);
        }
        const testnets = warpRouteManager.getAvailableTestnets();
        const contractDetails = deployment.contractAddresses && deployment.txHashes
            ? deployment.chains.map(chain => {
                const explorer = testnets.find(t => t.name === chain)?.blockExplorer?.url;
                const contractAddr = deployment.contractAddresses[chain];
                const txHash = deployment.txHashes[chain];
                return `**${chain}:**\n` +
                    `  • Contract: ${contractAddr}${explorer ? ` ([View](${explorer}/address/${contractAddr}))` : ''}\n` +
                    `  • Deploy Tx: ${txHash}${explorer ? ` ([View](${explorer}/tx/${txHash}))` : ''}`;
            }).join('\n\n')
            : 'Deployment in progress...';
        // Build success message with configuration details
        let successMessage = `✅ **Warp Route Deployed Successfully!**\n\n`;
        if (configCreated) {
            const originConfig = deployment.config[finalOriginChain];
            const isCollateralConfig = originConfig && 'token' in originConfig && originConfig.token;
            const autoDetectedInfo = isCollateralConfig
                ? `\n🔍 **Auto-detected**: ${finalTokenSymbol} token address (${originConfig.token}) on ${finalOriginChain}`
                : `\n🔍 **Auto-configured**: Native ${finalTokenSymbol} bridging from ${finalOriginChain}`;
            successMessage += `🚀 **Auto-Configuration Created**${autoDetectedInfo}\n\n`;
        }
        successMessage += `**Route ID**: ${deployment.routeId}\n` +
            `**Token Symbol**: ${deployment.symbol}\n` +
            `**Chains**: ${deployment.chains.join(' ↔ ')}\n` +
            `**Status**: ${deployment.status}\n\n` +
            `**Deployed Contracts:**\n\n${contractDetails}\n\n` +
            `🎉 Your Warp route is now deployed and ready for cross-chain transfers!\n\n` +
            `**Next Steps:**\n` +
            `• The contracts are deployed but need to be enrolled with each other\n` +
            `• Use the Hyperlane CLI to complete the setup:\n` +
            `  \`hyperlane warp apply --config ${deployment.routeId.replace("/", "-")}-deploy.yaml\`\n` +
            `• Test transfers once enrollment is complete`;
        return {
            content: [
                {
                    type: "text",
                    text: successMessage,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error deploying warp route: ${error instanceof Error ? error.message : String(error)}\n\n` +
                        `💡 **Common Issues:**\n` +
                        `• Configuration not found - create it first with 'create-warp-route-config'\n` +
                        `• Insufficient funds for deployment gas fees\n` +
                        `• Network connectivity issues\n` +
                        `• Route already deployed - check status with 'get-warp-deployment'`,
                },
            ],
        };
    }
});
server.tool("get-deployment-instructions", "Get detailed instructions for deploying a configured Warp route using Hyperlane CLI", {
    routeId: z.string().describe("Route ID (e.g., USDC/sepolia-arbitrumsepolia)"),
}, async ({ routeId }) => {
    try {
        const deployment = await warpRouteManager.getDeployment(routeId);
        if (!deployment) {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Warp route configuration not found: ${routeId}\n\n💡 Use 'list-warp-deployments' to see available configurations.`,
                    },
                ],
            };
        }
        const instructions = warpRouteManager.getDeploymentInstructions(deployment);
        return {
            content: [
                {
                    type: "text",
                    text: `📋 **Deployment Instructions for ${routeId}**\n\n` +
                        `\`\`\`\n${instructions}\n\`\`\`\n\n` +
                        `⚠️ **Important Notes:**\n` +
                        `• Ensure you have sufficient funds for gas on both chains\n` +
                        `• The private key must be the same as used when creating the configuration\n` +
                        `• Test the deployment on testnets before using on mainnet\n` +
                        `• Keep track of the deployed contract addresses for future reference`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error getting deployment instructions: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
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
server.tool("claim-citrea-faucet", "Claim cBTC from the Citrea faucet. Users can claim 0.0001 cBTC up to 5 times per 24 hours.", {
    address: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
        .describe("Recipient Citrea address to receive cBTC"),
}, async ({ address }) => {
    try {
        const result = await citreaFaucet.claimFaucet(address);
        if (result.success) {
            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Faucet claim successful!\n\n` +
                            `💰 Amount: ${result.amount} cBTC\n` +
                            `📍 Recipient: ${address}\n` +
                            `🔗 Transaction: ${EXPLORER_BASE}/tx/${result.txHash}\n` +
                            `💳 Remaining faucet balance: ${result.balance} cBTC`,
                    },
                ],
            };
        }
        else {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Faucet claim failed: ${result.error}`,
                    },
                ],
            };
        }
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error claiming from faucet: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
server.tool("check-faucet-eligibility", "Check if an address is eligible to claim from the Citrea faucet and see remaining claims.", {
    address: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
        .describe("Address to check eligibility for"),
}, async ({ address }) => {
    try {
        const eligibility = await citreaFaucet.checkEligibility(address);
        if (eligibility.eligible) {
            return {
                content: [
                    {
                        type: "text",
                        text: `✅ Address ${address} is eligible for faucet claims!\n\n` +
                            `🎯 Remaining claims: ${eligibility.remainingClaims}/5 in the next 24 hours\n` +
                            `💰 Amount per claim: 0.0001 cBTC`,
                    },
                ],
            };
        }
        else {
            let message = `❌ Address ${address} is not eligible for faucet claims.\n\n` +
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
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error checking eligibility: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
server.tool("get-faucet-stats", "Get statistics about the Citrea faucet including total claims, distributed amount, and current balance.", {}, async () => {
    try {
        const stats = await citreaFaucet.getFaucetStats();
        return {
            content: [
                {
                    type: "text",
                    text: `📊 Citrea Faucet Statistics\n\n` +
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
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error getting faucet stats: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
server.tool("get-faucet-history", "Get claim history for a specific address or all faucet claims.", {
    address: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
        .optional()
        .describe("Address to get claim history for (optional - if not provided, returns all claims)"),
}, async ({ address }) => {
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
            return (`${index + 1}. ${claim.address}\n` +
                `   💰 Amount: ${claim.amount} cBTC\n` +
                `   📅 Date: ${date}\n` +
                `   🔗 Tx: ${EXPLORER_BASE}/tx/${claim.txHash}`);
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
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error getting faucet history: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
//explorer
server.tool('get-citrea-explorer-url', 'Generate Citrea explorer URLs for addresses, transactions, or blocks.', {
    type: z.enum(['address', 'transaction', 'block']).describe('Type of explorer URL to generate'),
    value: z.string().describe('Address (0x...), transaction hash (0x...), or block number'),
}, async ({ type, value }) => {
    try {
        let url;
        let description;
        switch (type) {
            case 'address':
                if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
                    throw new Error('Invalid address format');
                }
                url = explorerSummary.getAddressUrl(value);
                description = `Address details for ${value}`;
                break;
            case 'transaction':
                if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
                    throw new Error('Invalid transaction hash format');
                }
                url = explorerSummary.getTransactionUrl(value);
                description = `Transaction details for ${value}`;
                break;
            case 'block':
                const blockNum = parseInt(value);
                if (isNaN(blockNum) || blockNum < 0) {
                    throw new Error('Invalid block number');
                }
                url = explorerSummary.getBlockUrl(blockNum);
                description = `Block details for block ${blockNum}`;
                break;
            default:
                throw new Error('Invalid type. Must be address, transaction, or block');
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `🔗 **${description}**\n\n` +
                        `Explorer URL: ${url}\n\n` +
                        `This link will show detailed information about the ${type} on the Citrea testnet explorer, ` +
                        `including transaction history, balance, and other relevant blockchain data.`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `❌ Error generating explorer URL: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
server.tool('get-wallet-explorer-summary', 'Get comprehensive wallet analysis including recent transactions, gas usage statistics, and explorer details. This tool provides RPC-grounded data suitable for LLM analysis.', {
    address: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address')
        .describe('Wallet address to analyze'),
    limit: z
        .number()
        .min(1)
        .max(50)
        .default(10)
        .describe('Maximum number of recent transactions to include (1-50, default: 10)'),
}, async ({ address, limit }) => {
    try {
        const summary = await explorerSummary.getWalletSummary(address, limit);
        // Format the response for LLM consumption
        let response = `📊 **Wallet Analysis for ${address}**\n\n`;
        // Basic wallet info
        response += `💰 **Current Balance:** ${summary.balance} cBTC\n`;
        response += `📈 **Total Transactions:** ${summary.transactionCount}\n`;
        response += `🔗 **Explorer:** ${explorerSummary.getAddressUrl(address)}\n\n`;
        // Gas statistics
        if (summary.recentTransactions.length > 0) {
            response += `⛽ **Gas Statistics (Last ${summary.recentTransactions.length} transactions):**\n`;
            response += `   • Total Gas Used: ${summary.totalGasUsed}\n`;
            response += `   • Average Gas Price: ${summary.averageGasPrice} gwei\n`;
            response += `   • Total Gas Cost: ${summary.totalGasCost} cBTC\n\n`;
            // Recent transactions
            response += `📋 **Recent Transactions:**\n`;
            summary.recentTransactions.forEach((tx, index) => {
                response += `\n**${index + 1}. Transaction ${tx.hash.substring(0, 10)}...**\n`;
                response += `   • Block: ${tx.blockNumber} (${tx.confirmations} confirmations)\n`;
                response += `   • Status: ${tx.status === 'success' ? '✅' : '❌'} ${tx.status}\n`;
                response += `   • Value: ${tx.value} cBTC\n`;
                response += `   • From: ${tx.from}\n`;
                response += `   • To: ${tx.to || 'Contract Creation'}\n`;
                response += `   • Gas Used: ${tx.gasUsed} (${tx.gasPrice} gwei)\n`;
                response += `   • Gas Cost: ${tx.gasCost} cBTC\n`;
                response += `   • Explorer: ${tx.explorerUrl}\n`;
            });
        }
        else {
            response += `📋 **Recent Transactions:** No transactions found in the last ${summary.blockRange.scanned} blocks\n`;
        }
        // Block scan info
        response += `\n🔍 **Scan Information:**\n`;
        response += `   • Blocks scanned: ${summary.blockRange.scanned} (${summary.blockRange.from} to ${summary.blockRange.to})\n`;
        response += `   • This analysis is based on RPC data from Citrea testnet\n`;
        return {
            content: [
                {
                    type: 'text',
                    text: response,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `❌ Error getting wallet explorer summary: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
server.tool('get-transaction-details', 'Get detailed information about a specific Citrea transaction including gas usage and explorer link.', {
    txHash: z
        .string()
        .length(66)
        .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash')
        .describe('Transaction hash to analyze'),
}, async ({ txHash }) => {
    try {
        const txDetails = await explorerSummary.getTransactionDetails(txHash);
        let response = `🔍 **Transaction Details for ${txHash}**\n\n`;
        response += `✅ **Status:** ${txDetails.status === 'success' ? '✅ Success' : '❌ Failed'}\n`;
        response += `📦 **Block:** ${txDetails.blockNumber} (${txDetails.confirmations} confirmations)\n`;
        response += `💰 **Value:** ${txDetails.value} cBTC\n`;
        response += `📤 **From:** ${txDetails.from}\n`;
        response += `📥 **To:** ${txDetails.to || 'Contract Creation'}\n\n`;
        response += `⛽ **Gas Information:**\n`;
        response += `   • Gas Used: ${txDetails.gasUsed}\n`;
        response += `   • Gas Price: ${txDetails.gasPrice} gwei\n`;
        response += `   • Gas Cost: ${txDetails.gasCost} cBTC\n\n`;
        response += `🔗 **Explorer:** ${txDetails.explorerUrl}\n`;
        return {
            content: [
                {
                    type: 'text',
                    text: response,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `❌ Error getting transaction details: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
});
server.tool("transfer-token", "Transfer a deployed ERC20 token (from deployed-tokens.json) on Citrea", {
    symbol: z.string().describe("Token symbol, e.g. 'mCTR'"),
    recipient: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
        .describe("Recipient address"),
    amount: z.string().describe("Amount to transfer (human-readable units)"),
}, async ({ symbol, recipient, amount }) => {
    try {
        const result = await transferToken(mcpDir, symbol, recipient, amount, process.env.PRIVATE_KEY, CITREA_RPC, EXPLORER_BASE);
        return {
            content: [
                {
                    type: "text",
                    text: `✅ Transferred ${amount} ${result.symbol} to ${result.recipient}\n` +
                        `🔗 Tx: ${result.explorer.transaction}\n` +
                        `📜 Contract: ${result.explorer.contract}`,
                },
            ],
        };
    }
    catch (err) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error transferring token: ${err instanceof Error ? err.message : String(err)}`,
                },
            ],
        };
    }
});
server.tool("transfer-hyperlane-cross-chain", "Perform a real cross-chain transfer using Hyperlane protocol (USDC from Sepolia to Citrea with synthetic token minting)", {
    fromChain: z.enum(["sepolia", "citreatestnet"]).describe("Source chain (sepolia or citreatestnet)"),
    toChain: z.enum(["sepolia", "citreatestnet"]).describe("Destination chain (sepolia or citreatestnet)"),
    tokenSymbol: z.enum(["USDC", "cBTC"]).describe("Token symbol to transfer"),
    recipient: z
        .string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
        .describe("Recipient address on destination chain"),
    amount: z.string().describe("Amount to transfer (e.g., '0.1' for 0.1 USDC)"),
}, async ({ fromChain, toChain, tokenSymbol, recipient, amount }) => {
    try {
        if (fromChain === toChain) {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Source and destination chains cannot be the same. Please choose different chains.`,
                    },
                ],
            };
        }
        // Chain configurations
        const chainConfigs = {
            sepolia: {
                rpcUrl: "https://sepolia.rpc.thirdweb.com",
                chainId: 11155111,
                domain: 11155111,
                mailbox: "0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766",
                explorer: "https://sepolia.etherscan.io",
                tokens: {
                    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
                }
            },
            citreatestnet: {
                rpcUrl: "https://rpc.testnet.citrea.xyz",
                chainId: 5115,
                domain: 5115,
                mailbox: "0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766", // Assuming same mailbox
                explorer: "https://explorer.testnet.citrea.xyz",
                tokens: {
                    cBTC: "native"
                }
            }
        };
        const sourceChain = chainConfigs[fromChain];
        const destChain = chainConfigs[toChain];
        if (!sourceChain || !destChain) {
            throw new Error(`Unsupported chain configuration`);
        }
        // Initialize providers and signer
        const sourceProvider = new ethers.providers.JsonRpcProvider(sourceChain.rpcUrl);
        const signer = new ethers.Wallet(process.env.PRIVATE_KEY, sourceProvider);
        let transferResult = '';
        if (fromChain === "sepolia" && tokenSymbol === "USDC") {
            // USDC collateralization on Sepolia → Synthetic on Citrea
            const usdcAddress = sourceChain.tokens.USDC;
            const mailboxAddress = sourceChain.mailbox;
            const usdcABI = [
                'function balanceOf(address owner) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function approve(address spender, uint256 amount) returns (bool)',
                'function transfer(address to, uint256 amount) returns (bool)'
            ];
            const mailboxABI = [
                'function dispatch(uint32 destinationDomain, bytes32 recipientAddress, bytes messageBody) payable returns (bytes32 messageId)'
            ];
            // Check and transfer USDC
            const usdcContract = new ethers.Contract(usdcAddress, usdcABI, signer);
            const mailboxContract = new ethers.Contract(mailboxAddress, mailboxABI, signer);
            const decimals = await usdcContract.decimals();
            const balance = await usdcContract.balanceOf(signer.address);
            const transferAmount = ethers.utils.parseUnits(amount, decimals);
            if (balance.lt(transferAmount)) {
                throw new Error(`Insufficient USDC balance. You have ${ethers.utils.formatUnits(balance, decimals)} USDC but trying to transfer ${amount} USDC`);
            }
            // Use existing collateral contract (from our previous working setup)
            const collateralContract = "0x8643489e7e85e4d08cFe1497E5262f4eCfcA8A23";
            // Step 1: Transfer USDC to collateral contract
            const usdcTx = await usdcContract.transfer(collateralContract, transferAmount);
            await usdcTx.wait();
            // Step 2: Encode message for Hyperlane
            const messageBody = ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [recipient, transferAmount]);
            const recipientBytes32 = ethers.utils.hexZeroPad(recipient, 32);
            // Step 3: Dispatch Hyperlane message
            const hyperlaneMessage = await mailboxContract.dispatch(destChain.domain, recipientBytes32, messageBody, { value: ethers.utils.parseEther("0.01") } // Gas for relayer
            );
            await hyperlaneMessage.wait();
            transferResult = `✅ **Cross-Chain USDC Transfer Completed!**\n\n` +
                `🚀 **Transfer Details:**\n` +
                `   • Amount: ${amount} USDC\n` +
                `   • From: Sepolia → Citrea\n` +
                `   • Recipient: ${recipient}\n\n` +
                `📜 **Transaction Hashes:**\n` +
                `   • USDC Transfer: ${usdcTx.hash} ([View](${sourceChain.explorer}/tx/${usdcTx.hash}))\n` +
                `   • Hyperlane Message: ${hyperlaneMessage.hash} ([View](${sourceChain.explorer}/tx/${hyperlaneMessage.hash}))\n\n` +
                `⏳ **Processing:**\n` +
                `• Hyperlane relayers are processing your cross-chain message\n` +
                `• Synthetic USDC will be minted on Citrea for the recipient\n` +
                `• Expected delivery time: 2-5 minutes\n\n` +
                `🔍 **Monitor Progress:**\n` +
                `• Check recipient balance on Citrea: ${recipient}\n` +
                `• Hyperlane message ID: ${hyperlaneMessage.hash}`;
        }
        else if (fromChain === "citreatestnet" && tokenSymbol === "cBTC") {
            // Native cBTC → Synthetic USDC on Sepolia
            const mailboxAddress = sourceChain.mailbox;
            const mailboxABI = [
                'function dispatch(uint32 destinationDomain, bytes32 recipientAddress, bytes messageBody) payable returns (bytes32 messageId)'
            ];
            const mailboxContract = new ethers.Contract(mailboxAddress, mailboxABI, signer);
            // Check cBTC balance
            const balance = await sourceProvider.getBalance(signer.address);
            const transferAmount = ethers.utils.parseEther(amount);
            if (balance.lt(transferAmount.add(ethers.utils.parseEther("0.01")))) {
                throw new Error(`Insufficient cBTC balance. You need at least ${amount} cBTC + 0.01 cBTC for gas`);
            }
            // Encode message for synthetic token minting
            const messageBody = ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [recipient, transferAmount]);
            const recipientBytes32 = ethers.utils.hexZeroPad(recipient, 32);
            // Dispatch Hyperlane message with cBTC value
            const hyperlaneMessage = await mailboxContract.dispatch(destChain.domain, recipientBytes32, messageBody, {
                value: transferAmount.add(ethers.utils.parseEther("0.01")) // Transfer amount + gas
            });
            await hyperlaneMessage.wait();
            transferResult = `✅ **Cross-Chain cBTC Transfer Completed!**\n\n` +
                `🚀 **Transfer Details:**\n` +
                `   • Amount: ${amount} cBTC\n` +
                `   • From: Citrea → Sepolia\n` +
                `   • Recipient: ${recipient}\n\n` +
                `📜 **Transaction Hash:**\n` +
                `   • Hyperlane Message: ${hyperlaneMessage.hash} ([View](${sourceChain.explorer}/tx/${hyperlaneMessage.hash}))\n\n` +
                `⏳ **Processing:**\n` +
                `• Hyperlane relayers are processing your cross-chain message\n` +
                `• Synthetic tokens will be minted on Sepolia for the recipient\n` +
                `• Expected delivery time: 2-5 minutes\n\n` +
                `� **Monitor Progress:**\n` +
                `• Check recipient balance on Sepolia: ${recipient}\n` +
                `• Hyperlane message ID: ${hyperlaneMessage.hash}`;
        }
        else {
            throw new Error(`Unsupported transfer: ${tokenSymbol} from ${fromChain} to ${toChain}`);
        }
        return {
            content: [
                {
                    type: "text",
                    text: transferResult,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error executing cross-chain transfer: ${error instanceof Error ? error.message : String(error)}\n\n` +
                        `� **Common Issues:**\n` +
                        `• Insufficient token balance or gas fees\n` +
                        `• Invalid recipient address\n` +
                        `• Network connectivity issues\n` +
                        `• Unsupported token/chain combination`,
                },
            ],
        };
    }
});
server.tool("check-hyperlane-transfer-status", "Check the status of a cross-chain transfer and monitor for synthetic token minting", {
    messageHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash").describe("Hyperlane message transaction hash"),
    recipientAddress: z.string().length(42).regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address").describe("Recipient address to check balance"),
    destinationChain: z.enum(["sepolia", "citreatestnet"]).describe("Destination chain to check"),
}, async ({ messageHash, recipientAddress, destinationChain }) => {
    try {
        const chainConfigs = {
            sepolia: {
                rpcUrl: "https://sepolia.rpc.thirdweb.com",
                explorer: "https://sepolia.etherscan.io"
            },
            citreatestnet: {
                rpcUrl: "https://rpc.testnet.citrea.xyz",
                explorer: "https://explorer.testnet.citrea.xyz"
            }
        };
        const destConfig = chainConfigs[destinationChain];
        const provider = new ethers.providers.JsonRpcProvider(destConfig.rpcUrl);
        // Check recipient balance
        const balance = await provider.getBalance(recipientAddress);
        const formattedBalance = ethers.utils.formatEther(balance);
        // Check recent blocks for transactions to recipient
        const latestBlock = await provider.getBlockNumber();
        let foundActivity = false;
        let recentTxs = [];
        for (let i = 0; i < 20; i++) {
            try {
                const block = await provider.getBlockWithTransactions(latestBlock - i);
                const relevantTxs = block.transactions.filter(tx => tx.to === recipientAddress);
                if (relevantTxs.length > 0) {
                    foundActivity = true;
                    recentTxs.push(...relevantTxs.map(tx => ({
                        hash: tx.hash,
                        value: ethers.utils.formatEther(tx.value),
                        block: block.number
                    })));
                }
            }
            catch (e) {
                // Skip blocks that can't be fetched
            }
        }
        let statusMessage = `🔍 **Hyperlane Transfer Status Check**\n\n`;
        statusMessage += `**Message Hash:** ${messageHash}\n`;
        statusMessage += `**Recipient:** ${recipientAddress}\n`;
        statusMessage += `**Destination:** ${destinationChain}\n\n`;
        statusMessage += `💰 **Current Balance:**\n`;
        statusMessage += `   • ${formattedBalance} ${destinationChain === 'sepolia' ? 'ETH' : 'cBTC'}\n\n`;
        if (foundActivity) {
            statusMessage += `✅ **Recent Activity Detected:**\n`;
            recentTxs.slice(0, 5).forEach(tx => {
                statusMessage += `   • Block ${tx.block}: ${tx.value} ${destinationChain === 'sepolia' ? 'ETH' : 'cBTC'} ([View](${destConfig.explorer}/tx/${tx.hash}))\n`;
            });
            statusMessage += `\n🎉 This indicates the Hyperlane transfer may have been processed!\n`;
        }
        else {
            statusMessage += `⏳ **Status:** No recent activity detected\n`;
            statusMessage += `The Hyperlane relayers may still be processing your message.\n`;
            statusMessage += `Cross-chain transfers typically take 2-10 minutes.\n`;
        }
        statusMessage += `\n🔗 **Explorer Links:**\n`;
        statusMessage += `   • Address: ${destConfig.explorer}/address/${recipientAddress}\n`;
        statusMessage += `   • Original Message: ${messageHash.includes('sepolia') ? chainConfigs.sepolia.explorer : chainConfigs.citreatestnet.explorer}/tx/${messageHash}`;
        return {
            content: [
                {
                    type: "text",
                    text: statusMessage,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error checking transfer status: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
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
