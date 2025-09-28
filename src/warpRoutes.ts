import { ChainName, WarpRouteDeployConfig, TokenType, HyperlaneCore, EvmHypCollateralAdapter, EvmHypSyntheticAdapter, MultiProvider, ChainMetadata } from "@hyperlane-xyz/sdk";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { stringify } from "yaml";
import { TESTNET_TOKENS } from "./utils/warpTemplates.js";

export interface WarpRouteDeployment {
  routeId: string;
  symbol: string;
  chains: ChainName[];
  config: WarpRouteDeployConfig;
  deployedAt: number;
  status: 'configured' | 'deploying' | 'deployed' | 'failed';
  txHashes?: Record<ChainName, string>;
  contractAddresses?: Record<ChainName, string>;
  error?: string;
}

export interface TestnetChainInfo {
  name: ChainName;
  rpcUrl: string;
  chainId: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer?: {
    name: string;
    url: string;
  };
}

export class WarpRouteManager {
  private cacheDir: string;
  private privateKey: string;
  private multiProvider!: MultiProvider;

  // Common testnet configurations
  private static readonly TESTNET_CHAINS: Record<string, TestnetChainInfo> = {
    sepolia: {
      name: "sepolia",
      rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
      chainId: 11155111,
      nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
      blockExplorer: { name: "Etherscan", url: "https://sepolia.etherscan.io" }
    },
    arbitrumsepolia: {
      name: "arbitrumsepolia", 
      rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      nativeCurrency: { name: "Arbitrum Sepolia Ether", symbol: "ETH", decimals: 18 },
      blockExplorer: { name: "Arbiscan", url: "https://sepolia.arbiscan.io" }
    },
    optimismsepolia: {
      name: "optimismsepolia",
      rpcUrl: "https://sepolia.optimism.io",
      chainId: 11155420,
      nativeCurrency: { name: "Optimism Sepolia Ether", symbol: "ETH", decimals: 18 },
      blockExplorer: { name: "Optimistic Etherscan", url: "https://sepolia-optimism.etherscan.io" }
    },
    basesepolia: {
      name: "basesepolia",
      rpcUrl: "https://sepolia.base.org",
      chainId: 84532,
      nativeCurrency: { name: "Base Sepolia Ether", symbol: "ETH", decimals: 18 },
      blockExplorer: { name: "BaseScan", url: "https://sepolia.basescan.org" }
    },
    polygonmumbai: {
      name: "polygonmumbai",
      rpcUrl: "https://rpc.ankr.com/polygon_mumbai",
      chainId: 80001,
      nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
      blockExplorer: { name: "PolygonScan", url: "https://mumbai.polygonscan.com" }
    },
    avalanchefuji: {
      name: "avalanchefuji",
      rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
      blockExplorer: { name: "SnowTrace", url: "https://testnet.snowtrace.io" }
    },
    bsctestnet: {
      name: "bsctestnet",
      rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      nativeCurrency: { name: "BNB", symbol: "tBNB", decimals: 18 },
      blockExplorer: { name: "BscScan", url: "https://testnet.bscscan.com" }
    },
    citreatestnet: {
      name: "citreatestnet",
      rpcUrl: "https://rpc.testnet.citrea.xyz",
      chainId: 5115,
      nativeCurrency: { name: "Citrea Bitcoin", symbol: "cBTC", decimals: 18 },
      blockExplorer: { name: "Citrea Explorer", url: "https://explorer.testnet.citrea.xyz" }
    }
  };

  constructor(privateKey: string, cacheDir: string) {
    this.privateKey = privateKey;
    this.cacheDir = cacheDir;
    this.initializeMultiProvider();
  }

  private initializeMultiProvider() {
    const chainMetadata: Record<string, ChainMetadata> = {};
    
    // Convert our testnet chains to Hyperlane ChainMetadata format
    for (const [chainName, chainInfo] of Object.entries(WarpRouteManager.TESTNET_CHAINS)) {
      chainMetadata[chainName] = {
        name: chainInfo.name,
        chainId: chainInfo.chainId,
        domainId: chainInfo.chainId,
        protocol: 'ethereum' as any,
        rpcUrls: [{ http: chainInfo.rpcUrl }],
        blockExplorers: chainInfo.blockExplorer ? [{
          name: chainInfo.blockExplorer.name,
          url: chainInfo.blockExplorer.url,
          apiUrl: chainInfo.blockExplorer.url + '/api',
        }] : [],
      };
    }

    this.multiProvider = new MultiProvider(chainMetadata);
    
    // Add signers for each chain
    for (const chainName of Object.keys(chainMetadata)) {
      const chainInfo = WarpRouteManager.TESTNET_CHAINS[chainName];
      const provider = new ethers.providers.JsonRpcProvider(chainInfo.rpcUrl);
      const signer = new ethers.Wallet(this.privateKey, provider);
      this.multiProvider.setSharedSigner(signer);
    }
  }

  /**
   * Get available testnet chains
   */
  getAvailableTestnets(): TestnetChainInfo[] {
    return Object.values(WarpRouteManager.TESTNET_CHAINS);
  }

  /**
   * Automatically lookup token address for a given chain and symbol
   */
  private lookupTokenAddress(chainName: ChainName, tokenSymbol: string): string | undefined {
    const chainTokens = TESTNET_TOKENS[chainName];
    if (!chainTokens) {
      return undefined;
    }
    return chainTokens[tokenSymbol.toUpperCase()];
  }

  /**
   * Generate a Warp route configuration between two testnets
   */
  async generateWarpConfig(
    originChain: ChainName,
    destinationChain: ChainName,
    tokenSymbol: string,
    tokenAddress?: string,
    isCollateral: boolean = true
  ): Promise<WarpRouteDeployConfig> {
    if (!WarpRouteManager.TESTNET_CHAINS[originChain]) {
      throw new Error(`Unsupported origin chain: ${originChain}. Use 'list-available-testnets' to see supported chains.`);
    }
    if (!WarpRouteManager.TESTNET_CHAINS[destinationChain]) {
      throw new Error(`Unsupported destination chain: ${destinationChain}. Use 'list-available-testnets' to see supported chains.`);
    }
    if (originChain === destinationChain) {
      throw new Error("Origin and destination chains must be different");
    }

    const wallet = new ethers.Wallet(this.privateKey);
    const deployerAddress = wallet.address;

    const config: WarpRouteDeployConfig = {};

    // Auto-lookup token address if not provided and collateral mode is requested
    let finalTokenAddress = tokenAddress;
    if (isCollateral && !tokenAddress) {
      finalTokenAddress = this.lookupTokenAddress(originChain, tokenSymbol);
    }

    // Special handling for Citrea testnet - use native cBTC if no valid token found
    if (originChain === "citreatestnet" && isCollateral && (!finalTokenAddress || finalTokenAddress === "0x0000000000000000000000000000000000000000")) {
      // Use native cBTC instead of collateral for Citrea when no valid token address
      config[originChain] = {
        type: TokenType.native,
        owner: deployerAddress,
        mailbox: await this.getMailboxAddress(originChain),
      };
    } else if (isCollateral && finalTokenAddress && finalTokenAddress !== "0x0000000000000000000000000000000000000000") {
      // Use collateral mode with valid token address
      config[originChain] = {
        type: TokenType.collateral,
        token: finalTokenAddress,
        owner: deployerAddress,
        mailbox: await this.getMailboxAddress(originChain),
      };
    } else {
      // Use native mode (bridging native currency)
      config[originChain] = {
        type: TokenType.native,
        owner: deployerAddress,
        mailbox: await this.getMailboxAddress(originChain),
      };
    }

    // Destination chain configuration (synthetic)
    config[destinationChain] = {
      type: TokenType.synthetic,
      owner: deployerAddress,
      mailbox: await this.getMailboxAddress(destinationChain),
    };

    return config;
  }

  /**
   * Create and save a Warp route configuration (deployment will be manual using Hyperlane CLI)
   */
  async createWarpRouteConfig(
    originChain: ChainName,
    destinationChain: ChainName,
    tokenSymbol: string,
    tokenAddress?: string,
    isCollateral: boolean = true
  ): Promise<WarpRouteDeployment> {
    const config = await this.generateWarpConfig(
      originChain,
      destinationChain,
      tokenSymbol,
      tokenAddress,
      isCollateral
    );

    const routeId = `${tokenSymbol}/${originChain}-${destinationChain}`;
    
    const deployment: WarpRouteDeployment = {
      routeId,
      symbol: tokenSymbol,
      chains: [originChain, destinationChain],
      config,
      deployedAt: Date.now(),
      status: 'configured',
    };

    // Cache the deployment configuration
    await this.saveDeployment(deployment);

    return deployment;
  }

  /**
   * Deploy the actual Warp route contracts
   */
  async deployWarpRoute(routeId: string): Promise<WarpRouteDeployment> {
    const deployment = await this.getDeployment(routeId);
    if (!deployment) {
      throw new Error(`Deployment configuration not found: ${routeId}. Create it first with 'create-warp-route-config'.`);
    }

    if (deployment.status === 'deployed') {
      throw new Error(`Route ${routeId} is already deployed. Check status with 'get-warp-deployment ${routeId}'.`);
    }

    if (deployment.status === 'deploying') {
      throw new Error(`Route ${routeId} is currently being deployed. Please wait for it to complete.`);
    }

    try {
      // Update status to deploying
      deployment.status = 'deploying';
      await this.saveDeployment(deployment);

      const txHashes: Record<ChainName, string> = {};
      const contractAddresses: Record<ChainName, string> = {};

      // Deploy contracts on each chain sequentially to avoid nonce conflicts
      for (const chainName of deployment.chains) {
        try {
          const chainConfig = deployment.config[chainName];
          
          // Deploy with shorter timeout for MCP compatibility
          const result = await Promise.race([
            this.deployContractOnChain(chainName, chainConfig, deployment.symbol),
            new Promise<{address: string; txHash: string}>((_, reject) => 
              setTimeout(() => reject(new Error(`Deployment timeout on ${chainName} after 30 seconds`)), 30000)
            )
          ]);
          
          txHashes[chainName] = result.txHash;
          // Only set contract address when the deployer returns one (real contract creation)
          if (result.address) {
            contractAddresses[chainName] = result.address;
          }
          
          // Shorter delay between deployments
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          throw new Error(`Failed to deploy on ${chainName}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Update deployment with tx hashes and any discovered contract addresses
      deployment.txHashes = txHashes;
      deployment.contractAddresses = contractAddresses;

      // Post-deploy verification: ensure contract code exists on each chain's recorded address
      for (const chainName of deployment.chains) {
        const addr = contractAddresses[chainName];
        if (!addr) {
          deployment.status = 'failed';
          deployment.error = `No contract address returned for ${chainName} (deployment likely simulated or failed)`;
          await this.saveDeployment(deployment);
          throw new Error(deployment.error);
        }

        const provider = this.multiProvider.getProvider(chainName);
        try {
          const code = await provider.getCode(addr);
          if (!code || code === '0x') {
            deployment.status = 'failed';
            deployment.error = `No contract code found at ${addr} on ${chainName} after deployment`;
            await this.saveDeployment(deployment);
            throw new Error(deployment.error);
          }
        } catch (err) {
          deployment.status = 'failed';
          deployment.error = `Failed to verify contract on ${chainName}: ${err instanceof Error ? err.message : String(err)}`;
          await this.saveDeployment(deployment);
          throw new Error(deployment.error);
        }
      }

      deployment.status = 'deployed';
      await this.saveDeployment(deployment);

      return deployment;
    } catch (error) {
      deployment.status = 'failed';
      deployment.error = error instanceof Error ? error.message : String(error);
      await this.saveDeployment(deployment);
      throw error;
    }
  }

  /**
   * Deploy a contract on a specific chain
   */
  private async deployContractOnChain(
    chainName: ChainName,
    config: any,
    tokenSymbol: string,
    retryCount: number = 0
  ): Promise<{ address: string | null; txHash: string }> {
    try {
      const signer = this.multiProvider.getSigner(chainName);
      
      // Get fresh nonce for each attempt
      const nonce = await signer.getTransactionCount('pending');
      
      // Create a faster simulated transaction to avoid timeouts
      const signerAddress = await signer.getAddress();
      const simulatedTx = await signer.sendTransaction({
        to: signerAddress, // Send to self to avoid null address issues
        value: ethers.utils.parseEther("0.0001"), // Small test amount
        nonce: nonce,
        gasLimit: 21000, // Standard transfer gas limit
        gasPrice: await signer.getGasPrice().then(price => price.mul(2)), // Higher gas price for faster confirmation
      });

      // Wait for confirmation with shorter timeout for MCP
      const receipt = await Promise.race([
        simulatedTx.wait(1),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout after 15 seconds')), 15000)
        )
      ]);

      // Simulated transfer: no real contract was deployed. Return null address and txHash so caller can verify.
      return {
        address: null,
        txHash: receipt.transactionHash,
      };
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('nonce') ||
        error.message.includes('NONCE_EXPIRED') ||
        error.message.includes('nonce too low')
      ) && retryCount < 3) {
        // Use stderr to avoid MCP protocol interference
        process.stderr.write(`[WARN] Nonce error on ${chainName}, retrying... (attempt ${retryCount + 1}/3)\n`);
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.deployContractOnChain(chainName, config, tokenSymbol, retryCount + 1);
      }
      throw new Error(`Failed to deploy on ${chainName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get mailbox address for a chain using hardcoded testnet addresses
   */
  private async getMailboxAddress(chainName: ChainName): Promise<string> {
    // Common testnet mailbox addresses (from Hyperlane deployments)
    const testnetMailboxes: Record<string, string> = {
      sepolia: "0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766",
      arbitrumsepolia: "0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766",
      optimismsepolia: "0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766",
      basesepolia: "0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766",
      polygonmumbai: "0x2d1889fe5B092CD988972261434F7E5f26041115",
      avalanchefuji: "0x5b6CFf85442B851A8e6eaBd2A4E4507B5135B3B0",
      bsctestnet: "0xF90cB82a76492614D07B82a7658917f3aC811Ac1",
      citreatestnet: "0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766", // Using the same as other EVM chains for now
    };

    const mailbox = testnetMailboxes[chainName];
    if (!mailbox) {
      throw new Error(`No mailbox address found for chain: ${chainName}`);
    }

    return mailbox;
  }

  /**
   * Save deployment to cache
   */
  private async saveDeployment(deployment: WarpRouteDeployment): Promise<void> {
    const deploymentFile = path.join(this.cacheDir, "warp-deployments.json");
    
    let deployments: WarpRouteDeployment[] = [];
    if (fs.existsSync(deploymentFile)) {
      const data = fs.readFileSync(deploymentFile, "utf-8");
      deployments = JSON.parse(data);
    }

    // Remove existing deployment with same routeId
    deployments = deployments.filter(d => d.routeId !== deployment.routeId);
    deployments.push(deployment);

    fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));

    // Also save the config file in YAML format
    const configDir = path.join(this.cacheDir, "configs");
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const configFile = path.join(configDir, `${deployment.routeId.replace("/", "-")}-deploy.yaml`);
    const yamlContent = stringify(deployment.config);
    fs.writeFileSync(configFile, yamlContent);
  }

  /**
   * Get all saved deployments
   */
  async getDeployments(): Promise<WarpRouteDeployment[]> {
    const deploymentFile = path.join(this.cacheDir, "warp-deployments.json");
    
    if (!fs.existsSync(deploymentFile)) {
      return [];
    }

    const data = fs.readFileSync(deploymentFile, "utf-8");
    return JSON.parse(data);
  }

  /**
   * Get deployment by route ID
   */
  async getDeployment(routeId: string): Promise<WarpRouteDeployment | null> {
    const deployments = await this.getDeployments();
    return deployments.find(d => d.routeId === routeId) || null;
  }

  /**
   * Estimate gas costs for deployment using simple RPC calls
   */
  async estimateDeploymentCost(
    originChain: ChainName,
    destinationChain: ChainName
  ): Promise<{
    originChain: { gasLimit: string; gasPrice: string; estimatedCost: string };
    destinationChain: { gasLimit: string; gasPrice: string; estimatedCost: string };
    totalCostETH: string;
  }> {
    const originChainInfo = WarpRouteManager.TESTNET_CHAINS[originChain];
    const destChainInfo = WarpRouteManager.TESTNET_CHAINS[destinationChain];

    if (!originChainInfo || !destChainInfo) {
      throw new Error("Unsupported chain");
    }

    const originProvider = new ethers.providers.JsonRpcProvider(originChainInfo.rpcUrl);
    const destProvider = new ethers.providers.JsonRpcProvider(destChainInfo.rpcUrl);

    // Rough estimates for Warp route deployment
    const originGasLimit = "2000000"; // 2M gas
    const destGasLimit = "1500000";   // 1.5M gas

    const originGasPrice = await originProvider.getGasPrice();
    const destGasPrice = await destProvider.getGasPrice();

    const originCost = originGasPrice.mul(originGasLimit);
    const destCost = destGasPrice.mul(destGasLimit);
    const totalCost = originCost.add(destCost);

    return {
      originChain: {
        gasLimit: originGasLimit,
        gasPrice: ethers.utils.formatUnits(originGasPrice, "gwei"),
        estimatedCost: ethers.utils.formatEther(originCost),
      },
      destinationChain: {
        gasLimit: destGasLimit,
        gasPrice: ethers.utils.formatUnits(destGasPrice, "gwei"),
        estimatedCost: ethers.utils.formatEther(destCost),
      },
      totalCostETH: ethers.utils.formatEther(totalCost),
    };
  }

  /**
   * Get deployment instructions for using Hyperlane CLI
   */
  getDeploymentInstructions(deployment: WarpRouteDeployment): string {
    const configFileName = `${deployment.routeId.replace("/", "-")}-deploy.yaml`;
    
    return `To deploy this Warp route using the Hyperlane CLI:

1. Install the Hyperlane CLI:
   npm install -g @hyperlane-xyz/cli

2. Set your private key as an environment variable:
   export HYP_KEY="${this.privateKey}"

3. Use the generated config file: ${configFileName}

4. Deploy the warp route:
   hyperlane warp deploy --config ${configFileName}

5. Test the deployment:
   hyperlane warp send --symbol ${deployment.symbol}

Note: Make sure you have sufficient funds on both ${deployment.chains.join(' and ')} for gas fees.`;
  }
}