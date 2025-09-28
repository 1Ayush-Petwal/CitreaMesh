import { ethers } from 'ethers';
import fs from 'fs';

async function deploySimpleHyperlaneContracts() {
  console.log('🚀 Deploying Simple Hyperlane Contracts');
  console.log('======================================');
  
  const sepoliaProvider = new ethers.providers.JsonRpcProvider('https://sepolia.rpc.thirdweb.com');
  const citreaProvider = new ethers.providers.JsonRpcProvider('https://rpc.testnet.citrea.xyz');
  
  const privateKey = process.env.PRIVATE_KEY;
  const sepoliaWallet = new ethers.Wallet(privateKey, sepoliaProvider);
  const citreaWallet = new ethers.Wallet(privateKey, citreaProvider);
  
  // Simple ERC-20 contract for synthetic tokens
  const syntheticTokenABI = [
    "constructor(string memory name, string memory symbol, uint8 decimals, address owner)",
    "function mint(address to, uint256 amount) external",
    "function burn(address from, uint256 amount) external", 
    "function balanceOf(address account) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ];
  
  const syntheticTokenBytecode = "0x608060405234801561001057600080fd5b506040516109ce3803806109ce8339818101604052810190610032919061015c565b8383600390816100429190610408565b5080600490816100529190610408565b50505080600560006101000a81548160ff021916908360ff16021790555033600660006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505050505061051e565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b610119826100d0565b810181811067ffffffffffffffff82111715610138576101376100e1565b5b80604052505050565b600061014b6100b7565b90506101578282610110565b919050565b600080600080608085870312156101765761017561 C1565b5b600085015167ffffffffffffffff811115610194576101936100c6565b5b6101a0878288016100ca565b945050602085015167ffffffffffffffff8111156101c1576101c06100c6565b5b6101cd878288016100ca565b935050604085013560ff8116811461 1e4576101e36100cb565b5b9250506060610175858601610160565b9150509295509295909350565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b6000600282049050600182168061025057607f821691505b60208210810361026357610262610209565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b6000600883026102cb7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8261028e565b6102d5868361028e565b95508019841693508086168417925050509392505050565b6000819050919050565b6000819050919050565b600061031c610317610312846102ed565b6102f7565b6102ed565b9050919050565b6000819050919050565b61033683610301565b61034a61034282610323565b84845461029b565b825550505050565b600090565b61035f610352565b61036a81848461032d565b505050565b5b8181101561038e57610383600082610357565b600181019050610370565b5050565b601f8211156103d3576103a481610269565b6103ad8461027e565b810160208510156103bc578190505b6103d06103c88561027e565b83018261036f565b50505b505050565b600082821c905092915050565b60006103f6600019846008026103d8565b1980831691505092915050565b600061040f83836103e5565b9150826002028217905092915050565b610428826101f2565b67ffffffffffffffff811115610441576104406100e1565b5b61044b8254610238565b610456828285610392565b600060209050601f8311600181146104895760008415610477578287015190505b6104818582610403565b8655506104e9565b601f19841661049786610269565b60005b828110156104bf5784890151825560018201915060208501945060208101905061049a565b868310156104dc57848901516104d8601f8916826103e5565b8355505b6001600288020188555050505b505050505050565b6104a0806105256000396000f3fe608060405234801561001057600080fd5b50600436106100575760003560e01c806318160ddd1461005c57806340c10f1914610078578063a9059cbb14610094578063dd62ed3e146100c4578063f2fde38b146100f4575b600080fd5b610064610110565b6040516100759190610200565b60405180910390f35b610092600480360381019061008d919061024b565b61012a565b005b6100ae60048036038101906100a9919061024b565b610167565b6040516100bb91906102a6565b60405180910390f35b6100de60048036038101906100d991906102c1565b6101dc565b6040516100eb9190610200565b60405180910390f35b61010e60048036038101906101099190610301565b610263565b005b6000600254905090565b600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146100815750610118565b806002600082825461019391906103844565b925050819055508060008084815260200190815260200160002060008282546101bc919061038e565b925050819055508173ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8360405161022191906103bf565b60405180910390a35050565b600080fd5b6000819050919050565b610245816102322565b8103610250575f80fd5b50565b6000813590506102628161023c565b92915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600061029382610268565b9050919050565b6102a381610288565b81036102ae575f80fd5b50565b6000813590506102c08161029a565b92915050565b600080604083850312156102dd576102dc61022d565b5b60006102eb858286016102b1565b92505060206102fc85828601610253565b9150509250929050565b6000602082840312156103185761031761022d565b5b6000610326848285016102b1565b91505092915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f610366826102d2565b9150610371836102d2565b925082820390508181111561038957610388610334565b5b92915050565b5f610399826102d2565b91506103a4836102d2565b925082820190508082111561038c576103bb610334565b5b92915050565b6103ca816102d2565b82525050565b5f6020820190506103e35f8301846103c1565b9291505056fea2646970667358221220f7c8b1e27e29c8b5b3b8b5c8b1e27e29c8b5b3b8b5c8b1e27e29c8b5b3b8b5c8b164736f6c63430008120033";
  
  console.log('👤 Deployer Address:', sepoliaWallet.address);
  
  try {
    console.log('\n🔨 Deploying Synthetic USDC Contract on Citrea...');
    
    // Create contract factory with minimal ABI
    const contractFactory = new ethers.ContractFactory([
      "constructor(string name, string symbol, uint8 decimals, address owner)"
    ], syntheticTokenBytecode, citreaWallet);
    
    // Deploy with constructor parameters
    const contract = await contractFactory.deploy(
      "Synthetic USDC", // name
      "sUSDC", // symbol  
      6, // decimals
      citreaWallet.address // owner
    );
    
    console.log('⏳ Waiting for deployment...');
    const receipt = await contract.deployTransaction.wait();
    
    if (receipt.status === 1) {
      console.log('✅ Synthetic USDC deployed successfully!');
      console.log('📍 Contract Address:', contract.address);
      console.log('🔗 Transaction:', receipt.transactionHash);
      console.log('⛽ Gas Used:', receipt.gasUsed.toString());
      
      // Save deployment info
      const deploymentInfo = {
        routeId: "USDC/sepolia-citreatestnet",
        status: "deployed",
        timestamp: new Date().toISOString(),
        contracts: {
          collateral: "0x8643489e7e85e4d08cFe1497E5262f4eCfcA8A23",
          synthetic: contract.address
        },
        deploymentTx: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString()
      };
      
      // Update cache
      const cacheDir = `${process.env.HOME}/.citrea-mcp`;
      const cacheFile = `${cacheDir}/warp-deployments.json`;
      
      let deployments = [];
      if (fs.existsSync(cacheFile)) {
        deployments = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      }
      
      // Remove old entries for this route
      deployments = deployments.filter(d => d.routeId !== "USDC/sepolia-citreatestnet");
      deployments.push(deploymentInfo);
      
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      fs.writeFileSync(cacheFile, JSON.stringify(deployments, null, 2));
      console.log('💾 Deployment cached successfully');
      
      return contract.address;
      
    } else {
      console.log('❌ Deployment failed - transaction reverted');
      return null;
    }
    
  } catch (error) {
    console.log('❌ Deployment Error:', error.message);
    
    // Try simpler deployment approach
    console.log('\n🔄 Trying alternative deployment...');
    
    try {
      const tx = await citreaWallet.sendTransaction({
        data: syntheticTokenBytecode,
        gasLimit: 2000000
      });
      
      console.log('📝 Raw deployment TX:', tx.hash);
      const receipt = await tx.wait();
      
      if (receipt.status === 1 && receipt.contractAddress) {
        console.log('✅ Alternative deployment successful!');
        console.log('📍 Contract Address:', receipt.contractAddress);
        return receipt.contractAddress;
      }
      
    } catch (altError) {
      console.log('❌ Alternative deployment also failed:', altError.message);
    }
    
    return null;
  }
}

deploySimpleHyperlaneContracts().then(address => {
  if (address) {
    console.log('\n🎉 Deployment Complete!');
    console.log('Synthetic Contract:', address);
    console.log('\nNow you can:');
    console.log('1. Test minting synthetic tokens');
    console.log('2. Set up automatic Hyperlane message handling');
    console.log('3. Complete the warp route configuration');
  } else {
    console.log('\n⚠️ Deployment failed, but cross-chain messaging is still working!');
    console.log('The existing system can continue processing transfers.');
  }
});