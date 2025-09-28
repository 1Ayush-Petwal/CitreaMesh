# Warp Route Deployment Example

This example shows how to create and deploy a Warp route between Citrea testnet and Sepolia.

## Step 1: Create Configuration

```bash
# Create a USDC bridge from Citrea to Sepolia
create-warp-route-config citreatestnet sepolia USDC 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8 true
```

This creates a configuration where:
- **Origin**: Citrea testnet with USDC as collateral token
- **Destination**: Sepolia with synthetic USDC
- **Token Address**: 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8 (USDC on Citrea)

## Step 2: Review Configuration

```bash
# Check the created configuration
get-warp-deployment USDC/citreatestnet-sepolia
```

You'll see the configuration details and status as "configured".

## Step 3: Deploy Contracts

```bash
# Deploy the actual contracts
deploy-warp-route USDC/citreatestnet-sepolia
```

This will:
1. Deploy the collateral contract on Citrea testnet
2. Deploy the synthetic contract on Sepolia
3. Return contract addresses and transaction hashes
4. Update the status to "deployed"

## Step 4: Verify Deployment

```bash
# Check deployment status
get-warp-deployment USDC/citreatestnet-sepolia
```

You'll now see:
- Contract addresses on both chains
- Transaction hashes for deployments
- Status as "deployed"
- Links to block explorers

## Alternative: Native cBTC Bridge

For a simpler setup using Citrea's native cBTC:

```bash
# Create config for native cBTC (no token address needed)
create-warp-route-config citreatestnet sepolia cBTC

# Deploy the route
deploy-warp-route cBTC/citreatestnet-sepolia
```

## Next Steps

After deployment, the contracts need to be enrolled with each other to enable transfers. Use the Hyperlane CLI for this:

```bash
# Set your private key
export HYP_KEY="your-private-key"

# Apply the configuration to enroll contracts
hyperlane warp apply --config USDC-citreatestnet-sepolia-deploy.yaml
```

## Available Tools

- `list-available-testnets` - See all supported chains
- `get-citrea-warp-suggestions` - Citrea-specific recommendations
- `estimate-warp-deployment-cost` - Gas cost estimates
- `list-warp-deployments` - View all configurations
- `get-deployment-instructions` - Manual deployment steps

## Files Created

The system creates:
- `warp-deployments.json` - All deployments list
- `configs/USDC-citreatestnet-sepolia-deploy.yaml` - Configuration file
- Cached deployment data for easy access

Your Warp route is now ready for cross-chain token transfers between Citrea testnet and Sepolia!