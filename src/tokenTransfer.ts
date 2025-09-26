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
  const tokensFile = path.join(mcpDir, "deployed-tokens.json");
  if (!fs.existsSync(tokensFile)) {
    throw new Error("No deployed-tokens.json file found.");
  }
  const tokens = JSON.parse(fs.readFileSync(tokensFile, "utf-8"));
  const token = tokens.find((t: any) => t.symbol === symbol);
  if (!token) {
    throw new Error(`Token with symbol ${symbol} not found.`);
  }

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
