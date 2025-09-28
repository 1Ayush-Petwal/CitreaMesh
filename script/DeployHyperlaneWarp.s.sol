// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

contract DeployHyperlaneWarp is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying Hyperlane Warp Route contracts...");
        console.log("Deployer:", deployer);
        
        // Contract addresses
        address usdcAddress = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238; // USDC on Sepolia
        address sepoliaMailbox = 0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766;
        address citreaMailbox = 0xfFAEF09B3cd11D9b20d1a19bECca54EEC2884766;
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy on current chain
        if (block.chainid == 11155111) {
            // Sepolia - deploy collateral contract using create2
            console.log("Deploying HypERC20Collateral on Sepolia...");
            
            bytes memory bytecode = abi.encodePacked(
                vm.readFileBinary("out/HypERC20Collateral.sol/HypERC20Collateral.json")
            );
            
            address collateral;
            assembly {
                collateral := create2(0, add(bytecode, 0x20), mload(bytecode), 0)
            }
            
            console.log("HypERC20Collateral deployed at:", collateral);
            
        } else if (block.chainid == 5115) {
            // Citrea - deploy synthetic contract
            console.log("Deploying HypERC20 on Citrea...");
            
            bytes memory bytecode = abi.encodePacked(
                vm.readFileBinary("out/HypERC20.sol/HypERC20.json")
            );
            
            address synthetic;
            assembly {
                synthetic := create2(0, add(bytecode, 0x20), mload(bytecode), 0)
            }
            
            console.log("HypERC20 deployed at:", synthetic);
        }
        
        vm.stopBroadcast();
    }
}