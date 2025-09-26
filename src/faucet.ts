import { ethers } from "ethers";
import fs from "fs";
import path from "path";

export interface FaucetClaim {
  address: string;
  timestamp: number;
  amount: string;
  txHash: string;
}

export interface FaucetLimits {
  maxClaimsPerDay: number;
  maxAmountPerClaim: string;
  windowHours: number;
}

export class CitreaFaucet {
  private provider: ethers.providers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private claimsFile: string;
  private limits: FaucetLimits;

  constructor(
    privateKey: string,
    rpcUrl: string,
    mcpDir: string,
    limits?: Partial<FaucetLimits>
  ) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.claimsFile = path.join(mcpDir, "faucet-claims.json");
    this.limits = {
      maxClaimsPerDay: limits?.maxClaimsPerDay || 5,
      maxAmountPerClaim: limits?.maxAmountPerClaim || "0.0001", // 0.0001 cBTC
      windowHours: limits?.windowHours || 24,
    };

    // Ensure the claims file exists
    this.initializeClaimsFile();
  }

  private initializeClaimsFile(): void {
    if (!fs.existsSync(this.claimsFile)) {
      fs.writeFileSync(this.claimsFile, JSON.stringify([], null, 2));
    }
  }

  private loadClaims(): FaucetClaim[] {
    try {
      const data = fs.readFileSync(this.claimsFile, "utf-8");
      return JSON.parse(data) as FaucetClaim[];
    } catch (error) {
      return [];
    }
  }

  private saveClaims(claims: FaucetClaim[]): void {
    fs.writeFileSync(this.claimsFile, JSON.stringify(claims, null, 2));
  }

  private isValidAddress(address: string): boolean {
    return ethers.utils.isAddress(address);
  }

  private getRecentClaims(address: string): FaucetClaim[] {
    const claims = this.loadClaims();
    const windowMs = this.limits.windowHours * 60 * 60 * 1000;
    const cutoffTime = Date.now() - windowMs;

    return claims.filter(
      (claim) =>
        claim.address.toLowerCase() === address.toLowerCase() &&
        claim.timestamp > cutoffTime
    );
  }

  async checkEligibility(address: string): Promise<{
    eligible: boolean;
    reason?: string;
    remainingClaims?: number;
    nextClaimTime?: number;
  }> {
    if (!this.isValidAddress(address)) {
      return {
        eligible: false,
        reason: "Invalid Ethereum address format",
      };
    }

    const recentClaims = this.getRecentClaims(address);

    if (recentClaims.length >= this.limits.maxClaimsPerDay) {
      const oldestClaim = recentClaims.sort(
        (a, b) => a.timestamp - b.timestamp
      )[0];
      const nextClaimTime =
        oldestClaim.timestamp + this.limits.windowHours * 60 * 60 * 1000;

      return {
        eligible: false,
        reason: `Maximum ${this.limits.maxClaimsPerDay} claims per ${this.limits.windowHours} hours reached`,
        remainingClaims: 0,
        nextClaimTime,
      };
    }

    return {
      eligible: true,
      remainingClaims: this.limits.maxClaimsPerDay - recentClaims.length,
    };
  }

  async getFaucetBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.signer.address);
    return ethers.utils.formatEther(balance);
  }

  async claimFaucet(recipientAddress: string): Promise<{
    success: boolean;
    txHash?: string;
    amount?: string;
    balance?: string;
    error?: string;
  }> {
    try {
      // Check eligibility first
      const eligibility = await this.checkEligibility(recipientAddress);
      if (!eligibility.eligible) {
        return {
          success: false,
          error: eligibility.reason,
        };
      }

      // Check faucet balance
      const faucetBalance = await this.provider.getBalance(this.signer.address);
      const claimAmount = ethers.utils.parseEther(
        this.limits.maxAmountPerClaim
      );

      if (faucetBalance.lt(claimAmount)) {
        return {
          success: false,
          error: `Insufficient faucet balance. Available: ${ethers.utils.formatEther(
            faucetBalance
          )} cBTC`,
        };
      }

      // Estimate gas
      const gasEstimate = await this.provider.estimateGas({
        to: recipientAddress,
        value: claimAmount,
      });

      const gasPrice = await this.provider.getGasPrice();
      const totalCost = claimAmount.add(gasEstimate.mul(gasPrice));

      if (faucetBalance.lt(totalCost)) {
        return {
          success: false,
          error: `Insufficient balance for transaction fees. Required: ${ethers.utils.formatEther(
            totalCost
          )} cBTC`,
        };
      }

      // Send transaction
      const tx = await this.signer.sendTransaction({
        to: recipientAddress,
        value: claimAmount,
        gasLimit: gasEstimate.mul(120).div(100), // Add 20% buffer
      });

      // Wait for confirmation
      const receipt = await tx.wait();

      // Record the claim
      const claim: FaucetClaim = {
        address: recipientAddress,
        timestamp: Date.now(),
        amount: this.limits.maxAmountPerClaim,
        txHash: receipt.transactionHash,
      };

      const claims = this.loadClaims();
      claims.push(claim);
      this.saveClaims(claims);

      // Get updated balance
      const newBalance = await this.getFaucetBalance();

      return {
        success: true,
        txHash: receipt.transactionHash,
        amount: this.limits.maxAmountPerClaim,
        balance: newBalance,
      };
    } catch (error) {
      return {
        success: false,
        error: `Transaction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async getClaimHistory(address?: string): Promise<FaucetClaim[]> {
    const claims = this.loadClaims();

    if (address) {
      return claims.filter(
        (claim) => claim.address.toLowerCase() === address.toLowerCase()
      );
    }

    return claims;
  }

  async getFaucetStats(): Promise<{
    totalClaims: number;
    totalDistributed: string;
    uniqueAddresses: number;
    faucetBalance: string;
    limits: FaucetLimits;
  }> {
    const claims = this.loadClaims();
    const uniqueAddresses = new Set(claims.map((c) => c.address.toLowerCase()))
      .size;
    const totalDistributed = claims.reduce(
      (sum, claim) => sum.add(ethers.utils.parseEther(claim.amount)),
      ethers.BigNumber.from(0)
    );

    const faucetBalance = await this.getFaucetBalance();

    return {
      totalClaims: claims.length,
      totalDistributed: ethers.utils.formatEther(totalDistributed),
      uniqueAddresses,
      faucetBalance,
      limits: this.limits,
    };
  }
}
