// import { ethers } from "ethers";
// import fs from "fs";
// import path from "path";

// const ERC20_ABI = [
//   "function transfer(address to, uint256 amount) public returns (bool)",
//   "function decimals() view returns (uint8)",
// ];

// export async function transferToken(
//   mcpDir: string,
//   symbol: string,
//   recipient: string,
//   amount: string,
//   privateKey: string,
//   rpcUrl: string,
//   explorerBase: string
// ) {
//   const tokensFile = path.join(mcpDir, "deployed-tokens.json");
//   if (!fs.existsSync(tokensFile)) {
//     throw new Error("No deployed-tokens.json file found.");
//   }
//   const tokens = JSON.parse(fs.readFileSync(tokensFile, "utf-8"));
//   const token = tokens.find((t: any) => t.symbol === symbol);
//   if (!token) {
//     throw new Error(`Token with symbol ${symbol} not found.`);
//   }

//   const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
//   const signer = new ethers.Wallet(privateKey, provider);

//   const contract = new ethers.Contract(token.address, ERC20_ABI, signer);
//   const decimals = await contract.decimals();
//   const amt = ethers.utils.parseUnits(amount, decimals);

//   const tx = await contract.transfer(recipient, amt);
//   await tx.wait();

//   return {
//     token: token.name,
//     symbol: token.symbol,
//     recipient,
//     amount,
//     txHash: tx.hash,
//     explorer: {
//       transaction: `${explorerBase}/tx/${tx.hash}`,
//       contract: `${explorerBase}/address/${token.address}`,
//     },
//   };
// }

import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function decimals() view returns (uint8)",
];

export async function transferToken(
  mcpDir: string,
  symbol: string,
  recipient: string,
  amount: string,
  privateKey: string,
  rpcUrl: string,
  explorerBase: string
) {
  let token: { name: string; symbol: string; address: string } | undefined;

  const targetSymbol = symbol.toLowerCase();

  // 1. mostUsedTokens.json
  const mostUsedFile = path.join(process.cwd(), "mostUsedTokens.json");
  if (fs.existsSync(mostUsedFile)) {
    const mostUsed = JSON.parse(fs.readFileSync(mostUsedFile, "utf-8"));
    token = mostUsed.find(
      (t: any) => t.symbol && t.symbol.toLowerCase() === targetSymbol
    );
  }

  // 2. deployed-tokens.json
  if (!token) {
    const deployedFile = path.join(mcpDir, "deployed-tokens.json");
    if (fs.existsSync(deployedFile)) {
      const deployed = JSON.parse(fs.readFileSync(deployedFile, "utf-8"));
      token = deployed.find(
        (t: any) =>
          t.symbol && t.symbol.toLowerCase() === targetSymbol.toLowerCase()
      );
    }
  }

  if (!token) {
    throw new Error(
      `Token with symbol ${symbol} not found in mostUsedTokens.json or deployed-tokens.json.`
    );
  }

  // Set up signer + contract
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  const contract = new ethers.Contract(token.address, ERC20_ABI, signer);
  const decimals = await contract.decimals();
  const amt = ethers.utils.parseUnits(amount, decimals);

  const tx = await contract.transfer(recipient, amt);
  await tx.wait();

  return {
    token: token.name,
    symbol: token.symbol,
    recipient,
    amount,
    txHash: tx.hash,
    explorer: {
      transaction: `${explorerBase}/tx/${tx.hash}`,
      contract: `${explorerBase}/address/${token.address}`,
    },
  };
}
