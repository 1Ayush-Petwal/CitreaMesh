# Real Warp Route Deployment

This script performs actual on-chain contract deployments using simplified contracts that implement the Warp route interface.

## Usage

### Environment Setup

Set these environment variables before running:

```bash
# Required: Your private key (keep this secure!)
export PRIVATE_KEY="0x..."

# Optional: Custom RPC endpoints (uses defaults if not set)
export SEPOLIA_RPC="https://your-sepolia-rpc.com"
export CITREA_RPC="https://your-citrea-rpc.com"
```

### Deploy a New Route

```bash
# Deploy the USDC route between Sepolia and Citrea
node scripts/real_deploy_warp.js --routeId "USDC/sepolia-citreatestnet"
```

### Verify Existing Deployment

```bash
# Check if contracts exist on-chain for an existing deployment
node scripts/real_deploy_warp.js --routeId "USDC/sepolia-citreatestnet" --verify-only
```

## What It Does

1. **Validation**: Checks that you have the required private key and sufficient balances
2. **Contract Deployment**: 
   - Deploys a collateral contract on the origin chain (Sepolia)
   - Deploys a synthetic token contract on the destination chain (Citrea)
3. **Verification**: Immediately verifies that contract code exists at the deployed addresses
4. **Cache Update**: Updates your local cache (`~/.citrea-mcp/warp-deployments.json`) with accurate deployment status

## Security Notes

- **Private Key**: Your private key never leaves your machine - the script runs locally
- **Gas Fees**: Ensure you have sufficient ETH on Sepolia and cBTC on Citrea for gas fees
- **Test First**: Consider testing on smaller amounts first

## Integration with MCP Tools

After successful deployment, the MCP tools (`deploy-warp-route`, `get-warp-deployment`, etc.) will see the updated deployment status and contract addresses.

## Troubleshooting

- **"No contract code found"**: The deployment transaction may have failed. Check the transaction hash on the block explorer.
- **"Low balance"**: Add more ETH/cBTC to your wallet for gas fees.
- **RPC errors**: Try using different RPC endpoints with the environment variables above.