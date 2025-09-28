#!/usr/bin/env node
// Usage:
//   node scripts/deploy_warp_route.js --routeId "USDC/sepolia-citreatestnet" --tokenAddress 0x... [--exec]
// If --exec is passed the script will attempt to run the Hyperlane CLI to deploy the generated config.

import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { WarpRouteManager } from '../build/warpRoutes.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--routeId' && args[i+1]) { out.routeId = args[++i]; }
    else if (a === '--origin' && args[i+1]) { out.origin = args[++i]; }
    else if (a === '--destination' && args[i+1]) { out.destination = args[++i]; }
    else if (a === '--tokenSymbol' && args[i+1]) { out.tokenSymbol = args[++i]; }
    else if (a === '--tokenAddress' && args[i+1]) { out.tokenAddress = args[++i]; }
    else if (a === '--isCollateral') { out.isCollateral = true; }
    else if (a === '--exec') { out.exec = true; }
  }
  return out;
}

async function main() {
  const args = parseArgs();

  // Determine cache dir
  const cacheDir = process.env.CACHE_DIR || path.join(os.homedir(), '.citrea-mcp');

  const privateKey = process.env.PRIVATE_KEY || process.env.HYP_KEY;
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY or HYP_KEY environment variable is required to create the config owner.');
    console.error('Set it locally (do not share): export PRIVATE_KEY="0x..."');
    process.exit(2);
  }

  const manager = new WarpRouteManager(privateKey, cacheDir);

  // Route parsing
  let routeId = args.routeId;
  let origin, destination, tokenSymbol;
  if (!routeId) {
    if (!args.origin || !args.destination || !args.tokenSymbol) {
      console.error('Either --routeId or --origin/--destination/--tokenSymbol must be provided.');
      process.exit(1);
    }
    origin = args.origin;
    destination = args.destination;
    tokenSymbol = args.tokenSymbol;
    routeId = `${tokenSymbol}/${origin}-${destination}`;
  } else {
    // routeId like SYMBOL/origin-destination
    const [sym, rest] = routeId.split('/');
    tokenSymbol = sym;
    const [o, d] = rest.split('-');
    origin = o;
    destination = d;
  }

  // Create config if missing
  const existing = await manager.getDeployment(routeId).catch(() => null);
  if (existing) {
    console.log('Found existing deployment record:', routeId, 'status=', existing.status);
  } else {
    console.log('Creating warp route config for', routeId);
    const deploy = await manager.createWarpRouteConfig(origin, destination, tokenSymbol, args.tokenAddress, !!args.isCollateral);
    console.log('Config created and cached at:', path.join(cacheDir, 'configs', `${deploy.routeId.replace('/', '-')}-deploy.yaml`));
  }

  const deployment = await manager.getDeployment(routeId);
  console.log('\nDeployment summary:');
  console.log(' routeId:', deployment.routeId);
  console.log(' chains:', deployment.chains.join(', '));
  console.log(' status:', deployment.status);
  console.log('\nInstructions to deploy using Hyperlane CLI:');
  console.log(manager.getDeploymentInstructions(deployment));

  if (args.exec) {
    // Attempt to run Hyperlane CLI (requires it to be installed and HYP_KEY env set)
    const configFile = path.join(cacheDir, 'configs', `${deployment.routeId.replace('/', '-')}-deploy.yaml`);
    console.log('\nAttempting to run Hyperlane CLI:');
    console.log(`npx @hyperlane-xyz/cli warp deploy --config ${configFile}`);

    const proc = spawn('npx', ['@hyperlane-xyz/cli', 'warp', 'deploy', '--config', configFile], { stdio: 'inherit', env: process.env });
    proc.on('exit', (code) => {
      if (code === 0) console.log('Hyperlane CLI finished');
      else console.error('Hyperlane CLI exited with code', code);
    });
  }
}

main().catch(err => { console.error('Error:', err && err.message ? err.message : err); process.exit(1); });
