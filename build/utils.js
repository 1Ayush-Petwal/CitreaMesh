import { AgentConfigSchema, } from "@hyperlane-xyz/sdk";
import { ensure0x, objMap, promiseObjAll, ProtocolType, } from "@hyperlane-xyz/utils";
import { ethers } from "ethers";
import fs from "fs";
import logger from "./logger.js";
export function privateKeyToSigner(key) {
    if (!key)
        throw new Error("No private key provided");
    const formattedKey = key.trim().toLowerCase();
    if (ethers.utils.isHexString(ensure0x(formattedKey)))
        return new ethers.Wallet(ensure0x(formattedKey));
    else if (formattedKey.split(" ").length >= 6)
        return ethers.Wallet.fromMnemonic(formattedKey);
    else
        throw new Error("Invalid private key format");
}
export function callWithConfigCreationLogs(fn, type) {
    return async (...args) => {
        // console.log(`Creating ${type}...`);
        try {
            const result = await fn(...args);
            return result;
        }
        finally {
            // console.log(`Created ${type}!`);
        }
    };
}
export async function requestAndSaveApiKeys(chains, chainMetadata, registry) {
    const apiKeys = {};
    for (const chain of chains) {
        if (chainMetadata[chain]?.blockExplorers?.[0]?.apiKey) {
            apiKeys[chain] = chainMetadata[chain].blockExplorers[0].apiKey;
            continue;
        }
        chainMetadata[chain].blockExplorers[0].apiKey = apiKeys[chain];
        // await registry.updateChain({
        //     chainName: chain,
        //     metadata: chainMetadata[chain],
        // });
    }
    return apiKeys;
}
export function transformChainMetadataForDisplay(chainMetadata) {
    return {
        Name: chainMetadata.name,
        "Display Name": chainMetadata.displayName,
        "Chain ID": chainMetadata.chainId,
        "Domain ID": chainMetadata.domainId,
        Protocol: chainMetadata.protocol,
        "JSON RPC URL": chainMetadata.rpcUrls[0].http,
        "Native Token: Symbol": chainMetadata.nativeToken?.symbol,
        "Native Token: Name": chainMetadata.nativeToken?.name,
        "Native Token: Decimals": chainMetadata.nativeToken?.decimals,
    };
}
export async function confirmExistingMailbox(registry, chain) {
    const addresses = await registry.getChainAddresses(chain);
    logger.info(`Mailbox address for ${chain} is ${addresses}`);
    if (addresses?.mailbox) {
        logger.error("Mailbox already exists at address " + addresses.mailbox);
    }
}
export async function nativeBalancesAreSufficient(multiProvider, chains, minGas) {
    const sufficientBalances = [];
    for (const chain of chains) {
        // Only Ethereum chains are supported
        if (multiProvider.getProtocol(chain) !== ProtocolType.Ethereum) {
            // logGray(`Skipping balance check for non-EVM chain: ${chain}`);
            continue;
        }
        const address = multiProvider.getSigner(chain).getAddress();
        const provider = multiProvider.getProvider(chain);
        const gasPrice = await provider.getGasPrice();
        const minBalanceWei = gasPrice.mul(minGas).toString();
        const minBalance = ethers.utils.formatEther(minBalanceWei.toString());
        const balanceWei = await multiProvider
            .getProvider(chain)
            .getBalance(address);
        const balance = ethers.utils.formatEther(balanceWei.toString());
        if (balanceWei.lt(minBalanceWei)) {
            const symbol = multiProvider.getChainMetadata(chain).nativeToken?.symbol ?? "ETH";
            sufficientBalances.push(false);
        }
    }
    const allSufficient = sufficientBalances.every((sufficient) => sufficient);
    if (allSufficient) {
        //   logGreen('✅ Balances are sufficient');
        return true;
    }
    else {
        return false;
    }
}
export function assertSigner(signer) {
    if (!signer || !ethers.Signer.isSigner(signer))
        throw new Error("Signer is invalid");
}
export function filterAddresses(addresses, chains) {
    if (!chains) {
        return addresses;
    }
    const filteredAddresses = {};
    for (const chain in addresses) {
        if (chains.includes(chain)) {
            filteredAddresses[chain] = addresses[chain];
        }
    }
    return filteredAddresses;
}
export async function getStartBlocks(chainAddresses, core, chainMetadata) {
    return promiseObjAll(objMap(chainAddresses, async (chain, _) => {
        const indexFrom = chainMetadata[chain].index?.from;
        logger.info(`Index from for ${chain}: ${indexFrom}, chain metadata: ${JSON.stringify(chainMetadata[chain])}`);
        if (indexFrom !== undefined) {
            return indexFrom;
        }
        const mailbox = core.getContracts(chain).mailbox;
        try {
            const deployedBlock = await mailbox.deployedBlock();
            return deployedBlock.toNumber();
        }
        catch {
            // console.log(
            //   `❌ Failed to get deployed block to set an index for ${chain}, this is potentially an issue with rpc provider or a misconfiguration`
            // );
            return undefined;
        }
    }));
}
export async function handleMissingInterchainGasPaymaster(chainAddresses) {
    for (const [chain, addressRecord] of Object.entries(chainAddresses)) {
        if (!addressRecord.interchainGasPaymaster) {
            console.warn(`Interchain gas paymaster not found for chain ${chain}`);
        }
        chainAddresses[chain].interchainGasPaymaster = ethers.constants.AddressZero;
    }
}
export function validateAgentConfig(agentConfig) {
    const result = AgentConfigSchema.safeParse(agentConfig);
    if (!result.success) {
        const errorMessage = result.error.toString();
        console.warn(`\nAgent config is invalid, this is possibly due to required contracts not being deployed. See details below:\n${errorMessage}`);
    }
    // else {
    // console.log('✅ Agent config successfully created');
    // }
}
// Utility to create directories if they don't exist
export const createDirectory = (directoryPath) => {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
        logger.info(`Created directory: ${directoryPath}`);
    }
};
