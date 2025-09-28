// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMailbox {
    function dispatch(
        uint32 destinationDomain,
        bytes32 recipientAddress,
        bytes calldata messageBody
    ) external payable returns (bytes32);
    
    function localDomain() external view returns (uint32);
}

contract HypERC20Collateral {
    IERC20 public immutable wrappedToken;
    IMailbox public immutable mailbox;
    address public owner;
    
    // Domain IDs
    uint32 public constant LOCAL_DOMAIN = 11155111; // Sepolia
    uint32 public constant REMOTE_DOMAIN = 5115;   // Citrea testnet
    
    // Remote router (synthetic contract address on Citrea)
    bytes32 public remoteRouter;
    
    // Events for tracking
    event SentTransferRemote(
        uint32 indexed destination,
        bytes32 indexed recipient,
        uint256 amount,
        bytes32 messageId
    );
    event RemoteRouterSet(bytes32 router);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor(address _token, address _mailbox, address _owner) {
        wrappedToken = IERC20(_token);
        mailbox = IMailbox(_mailbox);
        owner = _owner;
    }
    
    function setRemoteRouter(bytes32 _remoteRouter) external onlyOwner {
        remoteRouter = _remoteRouter;
        emit RemoteRouterSet(_remoteRouter);
    }
    
    function transferRemote(
        uint32 _destination,
        bytes32 _recipient,
        uint256 _amount
    ) external payable returns (bytes32) {
        require(_destination == REMOTE_DOMAIN, "Invalid destination");
        require(remoteRouter != bytes32(0), "Remote router not set");
        require(_amount > 0, "Amount must be > 0");
        
        // Transfer tokens from sender to this contract
        require(
            wrappedToken.transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );
        
        // Prepare message for synthetic contract
        bytes memory message = abi.encode(_recipient, _amount);
        
        // Dispatch cross-chain message via Hyperlane
        bytes32 messageId = mailbox.dispatch{value: msg.value}(
            _destination,
            remoteRouter,
            message
        );
        
        emit SentTransferRemote(_destination, _recipient, _amount, messageId);
        return messageId;
    }
    
    function balanceOf(address _account) external view returns (uint256) {
        return wrappedToken.balanceOf(_account);
    }
    
    function contractBalance() external view returns (uint256) {
        return wrappedToken.balanceOf(address(this));
    }
    
    // Emergency functions
    function withdrawToken(uint256 _amount) external onlyOwner {
        wrappedToken.transfer(owner, _amount);
    }
    
    function withdrawEth() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    receive() external payable {}
}