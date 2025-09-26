import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { config } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { privateKeyToSigner } from './utils.js';
import { ethers } from 'ethers';

import { z } from 'zod';

config();
const server = new McpServer(
    {
        name: 'citrea-mcp',
        version: '1.0.0',
        capabilities: {
            resources: {},
            tools: {},
        },
    },
    {
        capabilities: {
            resources: {
                subscribe: true,
            },
        },
    }
);

const CITREA_RPC = process.env.CITREA_RPC!;
const EXPLORER_BASE = process.env.EXPLORER_BASE!;


const homeDir = process.env.CACHE_DIR || process.env.HOME;
let mcpDir;
if (homeDir) {
    mcpDir = path.join(homeDir, '.citrea-mcp');
    if (!fs.existsSync(mcpDir)) {
        fs.mkdirSync(mcpDir, { recursive: true });
    }
} else {
    throw new Error(
        'Environment variable CACHE_DIR or HOME not set. Set it to a valid directory path.'
    );
}

const key = process.env.PRIVATE_KEY;
if (!key) {
    throw new Error('No private key provided');
}
const signer = privateKeyToSigner(key);


server.tool(
    'get_citrea_balance',
    'Get the native  balance of an address on Citrea',
    {
        address: z
            .string()
            .length(42)
            .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address'),
    },
    async ({ address }) => {
        const provider = new ethers.providers.JsonRpcProvider(CITREA_RPC);
        const balance = await provider.getBalance(address);
        const formatted = ethers.utils.formatUnits(balance, 18);
        return {
            content: [
                {
                    type: 'text',
                    text: `Balance of ${address} on Citrea: ${formatted} cBTC`,
                },
            ],
        };
    }
);
