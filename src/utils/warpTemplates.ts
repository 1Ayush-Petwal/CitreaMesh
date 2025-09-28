import { WarpRouteDeployConfig, TokenType } from "@hyperlane-xyz/sdk";

export interface WarpRouteTemplate {
  name: string;
  description: string;
  config: (params: {
    originChain: string;
    destinationChain: string;
    tokenSymbol: string;
    tokenAddress?: string;
    deployerAddress: string;
    originMailbox: string;
    destMailbox: string;
  }) => WarpRouteDeployConfig;
}

export const WARP_ROUTE_TEMPLATES: WarpRouteTemplate[] = [
  {
    name: "ERC20 Collateral to Synthetic",
    description: "Bridge an existing ERC20 token from one chain to a synthetic version on another chain",
    config: ({ originChain, destinationChain, tokenAddress, deployerAddress, originMailbox, destMailbox }) => ({
      [originChain]: {
        type: TokenType.collateral,
        token: tokenAddress!,
        owner: deployerAddress,
        mailbox: originMailbox,
      },
      [destinationChain]: {
        type: TokenType.synthetic,
        owner: deployerAddress,
        mailbox: destMailbox,
      },
    }),
  },
  {
    name: "Native to Synthetic",
    description: "Bridge native currency from one chain to a synthetic token on another chain",
    config: ({ originChain, destinationChain, deployerAddress, originMailbox, destMailbox }) => ({
      [originChain]: {
        type: TokenType.native,
        owner: deployerAddress,
        mailbox: originMailbox,
      },
      [destinationChain]: {
        type: TokenType.synthetic,
        owner: deployerAddress,
        mailbox: destMailbox,
      },
    }),
  },
  {
    name: "Multi-Collateral (3-Chain)",
    description: "Create a warp route with multiple collateral chains feeding into one synthetic chain",
    config: ({ originChain, destinationChain, tokenAddress, deployerAddress, originMailbox, destMailbox }) => {
      // For demo purposes, we'll add a third chain (this would need to be parameterized)
      const thirdChain = "basesepolia";
      const thirdMailbox = "0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766";
      
      return {
        [originChain]: {
          type: TokenType.collateral,
          token: tokenAddress!,
          owner: deployerAddress,
          mailbox: originMailbox,
        },
        [thirdChain]: {
          type: TokenType.collateral,
          token: tokenAddress!,
          owner: deployerAddress,
          mailbox: thirdMailbox,
        },
        [destinationChain]: {
          type: TokenType.synthetic,
          owner: deployerAddress,
          mailbox: destMailbox,
        },
      };
    },
  },
];

export function getTemplateByName(name: string): WarpRouteTemplate | undefined {
  return WARP_ROUTE_TEMPLATES.find(template => template.name === name);
}

export function listTemplates(): string {
  return WARP_ROUTE_TEMPLATES.map((template, index) => 
    `**${index + 1}. ${template.name}**\n   ${template.description}`
  ).join('\n\n');
}

// Common testnet token addresses for testing
export const TESTNET_TOKENS: Record<string, Record<string, string>> = {
  sepolia: {
    USDC: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
    USDT: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0",
    DAI: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357",
    WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
  },
  arbitrumsepolia: {
    USDC: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    USDT: "0xb1084db8d3c05cebd5fa9335df95ee4b8a0edc30",
    WETH: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
  },
  optimismsepolia: {
    USDC: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    USDT: "0x853eb4bA5D0Ba2B77a0a5329Fd2110d5CE149ECE",
    WETH: "0x4200000000000000000000000000000000000006",
  },
  basesepolia: {
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    WETH: "0x4200000000000000000000000000000000000006",
  },
  citreatestnet: {
    // Note: These would be actual deployed ERC20 tokens on Citrea testnet
    // For now, using placeholder addresses - users should deploy their own tokens
    // or use the deploy-erc20 tool to create test tokens
    USDC: "0x0000000000000000000000000000000000000000", // Placeholder - deploy your own
    TEST: "0x0000000000000000000000000000000000000000", // Placeholder - deploy your own
  },
};

export function getTokenAddress(chain: string, symbol: string): string | undefined {
  return TESTNET_TOKENS[chain]?.[symbol];
}

export function getAvailableTokens(chain: string): string[] {
  return Object.keys(TESTNET_TOKENS[chain] || {});
}

export function getAllTestnetTokens(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [chain, tokens] of Object.entries(TESTNET_TOKENS)) {
    result[chain] = Object.keys(tokens);
  }
  return result;
}