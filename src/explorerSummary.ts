import { ethers } from 'ethers';
import logger from './logger.js';

export interface TransactionSummary {
  hash: string;
  from: string;
  to: string | null;
  value: string; // in ETH/cBTC
  gasUsed: string;
  gasPrice: string; // in gwei
  gasCost: string; // formatted gas cost in ETH/cBTC
  blockNumber: number;
  timestamp: number;
  status: 'success' | 'failed';
  confirmations: number;
  explorerUrl: string;
}

export interface WalletSummary {
  address: string;
  balance: string; // formatted balance
  transactionCount: number;
  recentTransactions: TransactionSummary[];
  totalGasUsed: string;
  averageGasPrice: string;
  totalGasCost: string;
  blockRange: {
    from: number;
    to: number;
    scanned: number;
  };
}

export class CitreaExplorerSummary {
  private provider: ethers.providers.JsonRpcProvider;
  private explorerBaseUrl: string;

  constructor(rpcUrl: string, explorerBaseUrl: string) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.explorerBaseUrl = explorerBaseUrl;
  }

  /**
   * Get comprehensive wallet summary including recent transactions
   */
  async getWalletSummary(address: string, limit: number = 10): Promise<WalletSummary> {
    try {
      // Add overall timeout for the entire operation
      return await this.withTimeout(this.getWalletSummaryInternal(address, limit), 30000); // 30 second timeout
    } catch (error) {
      logger.error(`Error getting wallet summary for ${address}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to get wallet summary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Internal method for wallet summary without timeout wrapper
   */
  private async getWalletSummaryInternal(address: string, limit: number): Promise<WalletSummary> {
    // Get current balance and transaction count
    const [balance, transactionCount, currentBlock] = await Promise.all([
      this.provider.getBalance(address),
      this.provider.getTransactionCount(address),
      this.provider.getBlock('latest')
    ]);

    const formattedBalance = ethers.utils.formatEther(balance);
    
    // Use a smaller, more reasonable block range for scanning
    const maxBlocksToScan = Math.min(100, currentBlock.number);
    const fromBlock = Math.max(0, currentBlock.number - maxBlocksToScan);
    
    // Scan recent blocks for transactions involving this address
    const recentTransactions = await this.scanRecentTransactions(
      address, 
      limit, 
      fromBlock
    );

    // Calculate gas statistics
    const gasStats = this.calculateGasStatistics(recentTransactions);

    return {
      address,
      balance: formattedBalance,
      transactionCount,
      recentTransactions,
      totalGasUsed: gasStats.totalGasUsed,
      averageGasPrice: gasStats.averageGasPrice,
      totalGasCost: gasStats.totalGasCost,
      blockRange: {
        from: fromBlock,
        to: currentBlock.number,
        scanned: maxBlocksToScan
      }
    };
  }

  /**
   * Get details for a specific transaction
   */
  async getTransactionDetails(txHash: string): Promise<TransactionSummary> {
    try {
      const [tx, receipt] = await Promise.all([
        this.provider.getTransaction(txHash),
        this.provider.getTransactionReceipt(txHash)
      ]);

      if (!tx || !receipt) {
        throw new Error('Transaction not found');
      }

      const currentBlock = await this.provider.getBlock('latest');
      const confirmations = Math.max(0, currentBlock.number - receipt.blockNumber);

      return this.formatTransactionSummary(tx, receipt, confirmations);
    } catch (error) {
      logger.error(`Error getting transaction details for ${txHash}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to get transaction details: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Scan recent blocks for transactions involving the specified address
   * Optimized with batching and limited block range to prevent timeouts
   */
  private async scanRecentTransactions(
    address: string, 
    limit: number, 
    fromBlock: number
  ): Promise<TransactionSummary[]> {
    const transactions: TransactionSummary[] = [];
    const currentBlock = await this.provider.getBlock('latest');
    
    // Limit the scan to a reasonable range to prevent timeouts
    const maxBlocksToScan = Math.min(100, currentBlock.number - fromBlock);
    const actualFromBlock = Math.max(fromBlock, currentBlock.number - maxBlocksToScan);
    
    logger.info(`Scanning blocks ${actualFromBlock} to ${currentBlock.number} for address ${address} (max ${maxBlocksToScan} blocks)`);

    // Process blocks in batches to prevent timeouts
    const batchSize = 10;
    const totalBlocks = currentBlock.number - actualFromBlock + 1;
    
    for (let batchStart = currentBlock.number; batchStart >= actualFromBlock && transactions.length < limit; batchStart -= batchSize) {
      const batchEnd = Math.max(actualFromBlock, batchStart - batchSize + 1);
      
      try {
        // Process batch of blocks concurrently but with timeout
        const batchPromises = [];
        for (let blockNum = batchStart; blockNum >= batchEnd && transactions.length < limit; blockNum--) {
          batchPromises.push(this.processBlock(blockNum, address, currentBlock.number));
        }
        
        // Wait for batch with timeout
        const batchResults = await Promise.allSettled(batchPromises.map(p => 
          this.withTimeout(p, 5000) // 5 second timeout per batch
        ));
        
        // Collect successful results
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            transactions.push(...result.value);
            if (transactions.length >= limit) break;
          }
        }
        
      } catch (error) {
        logger.error(`Error processing batch starting at block ${batchStart}: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with next batch
      }
    }

    // Sort by block number (most recent first) and limit results
    return transactions
      .sort((a, b) => b.blockNumber - a.blockNumber)
      .slice(0, limit);
  }

  /**
   * Process a single block for transactions involving the address
   */
  private async processBlock(blockNum: number, address: string, currentBlockNum: number): Promise<TransactionSummary[]> {
    try {
      const block = await this.provider.getBlockWithTransactions(blockNum);
      const blockTransactions: TransactionSummary[] = [];
      
      for (const tx of block.transactions) {
        // Check if transaction involves our address
        if (tx.from?.toLowerCase() === address.toLowerCase() || 
            tx.to?.toLowerCase() === address.toLowerCase()) {
          
          const receipt = await this.provider.getTransactionReceipt(tx.hash);
          if (receipt) {
            const confirmations = Math.max(0, currentBlockNum - receipt.blockNumber);
            const txSummary = this.formatTransactionSummary(tx, receipt, confirmations);
            blockTransactions.push(txSummary);
          }
        }
      }
      
      return blockTransactions;
    } catch (error) {
      logger.error(`Error processing block ${blockNum}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Add timeout to promises to prevent hanging
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Format transaction data into a summary object
   */
  private formatTransactionSummary(
    tx: ethers.providers.TransactionResponse,
    receipt: ethers.providers.TransactionReceipt,
    confirmations: number
  ): TransactionSummary {
    const gasUsed = receipt.gasUsed.toString();
    const gasPrice = tx.gasPrice ? tx.gasPrice.toString() : '0';
    const gasPriceGwei = tx.gasPrice ? ethers.utils.formatUnits(tx.gasPrice, 'gwei') : '0';
    const gasCost = tx.gasPrice ? ethers.utils.formatEther(receipt.gasUsed.mul(tx.gasPrice)) : '0';
    
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to || null,
      value: ethers.utils.formatEther(tx.value || '0'),
      gasUsed,
      gasPrice: gasPriceGwei,
      gasCost,
      blockNumber: receipt.blockNumber,
      timestamp: 0, // Will be set if block timestamp is available
      status: receipt.status === 1 ? 'success' : 'failed',
      confirmations,
      explorerUrl: `${this.explorerBaseUrl}/tx/${tx.hash}`
    };
  }

  /**
   * Calculate gas usage statistics from transactions
   */
  private calculateGasStatistics(transactions: TransactionSummary[]): {
    totalGasUsed: string;
    averageGasPrice: string;
    totalGasCost: string;
  } {
    if (transactions.length === 0) {
      return {
        totalGasUsed: '0',
        averageGasPrice: '0',
        totalGasCost: '0'
      };
    }

    let totalGasUsed = ethers.BigNumber.from(0);
    let totalGasPriceWei = ethers.BigNumber.from(0);
    let totalGasCostWei = ethers.BigNumber.from(0);

    for (const tx of transactions) {
      totalGasUsed = totalGasUsed.add(tx.gasUsed);
      
      // Convert gas price from gwei to wei for calculation
      const gasPriceWei = ethers.utils.parseUnits(tx.gasPrice, 'gwei');
      totalGasPriceWei = totalGasPriceWei.add(gasPriceWei);
      
      // Add gas cost
      totalGasCostWei = totalGasCostWei.add(ethers.utils.parseEther(tx.gasCost));
    }

    const averageGasPriceWei = totalGasPriceWei.div(transactions.length);
    const averageGasPriceGwei = ethers.utils.formatUnits(averageGasPriceWei, 'gwei');

    return {
      totalGasUsed: totalGasUsed.toString(),
      averageGasPrice: averageGasPriceGwei,
      totalGasCost: ethers.utils.formatEther(totalGasCostWei)
    };
  }

  /**
   * Get explorer URL for an address
   */
  getAddressUrl(address: string): string {
    return `${this.explorerBaseUrl}/address/${address}`;
  }

  /**
   * Get explorer URL for a transaction
   */
  getTransactionUrl(txHash: string): string {
    return `${this.explorerBaseUrl}/tx/${txHash}`;
  }

  /**
   * Get explorer URL for a block
   */
  getBlockUrl(blockNumber: number): string {
    return `${this.explorerBaseUrl}/block/${blockNumber}`;
  }
}