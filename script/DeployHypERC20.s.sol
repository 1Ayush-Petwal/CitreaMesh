// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/contracts/HypERC20.sol";

contract DeployHypERC20Script is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Hyperlane Mailbox on Citrea (same as Sepolia testnet)
        address mailbox = 0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766;
        
        // Deploy HypERC20 (synthetic token) on Citrea
        address deployer = vm.addr(deployerPrivateKey);
        HypERC20 syntheticToken = new HypERC20(
            mailbox, // Hyperlane mailbox
            deployer // owner
        );
        
        console.log("Synthetic HypERC20 deployed at:", address(syntheticToken));
        console.log("Mailbox:", mailbox);
        console.log("Owner:", deployer);
        
        vm.stopBroadcast();
    }
}