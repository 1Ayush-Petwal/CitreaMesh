// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMailbox {
    function dispatch(
        uint32 destinationDomain,
        bytes32 recipientAddress,
        bytes calldata messageBody
    ) external payable returns (bytes32);
    
    function localDomain() external view returns (uint32);
}

contract HypERC20 {
    // ERC20 properties
    string public name = "Hyperlane Wrapped USDC";
    string public symbol = "hUSDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    // Hyperlane properties
    IMailbox public immutable mailbox;
    address public owner;
    
    // Domain IDs
    uint32 public constant LOCAL_DOMAIN = 5115;     // Citrea testnet
    uint32 public constant REMOTE_DOMAIN = 11155111; // Sepolia
    
    // Remote router (collateral contract address on Sepolia)
    bytes32 public remoteRouter;
    
    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event SentTransferRemote(
        uint32 indexed destination,
        bytes32 indexed recipient,
        uint256 amount,
        bytes32 messageId
    );
    event ReceivedTransferRemote(
        uint32 indexed origin,
        bytes32 indexed sender,
        address recipient,
        uint256 amount
    );
    event RemoteRouterSet(bytes32 router);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyMailbox() {
        require(msg.sender == address(mailbox), "Not mailbox");
        _;
    }
    
    constructor(address _mailbox, address _owner) {
        mailbox = IMailbox(_mailbox);
        owner = _owner;
    }
    
    function setRemoteRouter(bytes32 _remoteRouter) external onlyOwner {
        remoteRouter = _remoteRouter;
        emit RemoteRouterSet(_remoteRouter);
    }
    
    // Handle incoming cross-chain messages
    function handle(
        uint32 _origin,
        bytes32 _sender,
        bytes calldata _message
    ) external onlyMailbox {
        require(_origin == REMOTE_DOMAIN, "Invalid origin");
        require(_sender == remoteRouter, "Invalid sender");
        
        // Decode message
        (bytes32 recipientBytes32, uint256 amount) = abi.decode(_message, (bytes32, uint256));
        address recipient = address(uint160(uint256(recipientBytes32)));
        
        // Mint synthetic tokens
        _mint(recipient, amount);
        
        emit ReceivedTransferRemote(_origin, _sender, recipient, amount);
    }
    
    function transferRemote(
        uint32 _destination,
        bytes32 _recipient,
        uint256 _amount
    ) external payable returns (bytes32) {
        require(_destination == REMOTE_DOMAIN, "Invalid destination");
        require(remoteRouter != bytes32(0), "Remote router not set");
        require(_amount > 0, "Amount must be > 0");
        require(balanceOf[msg.sender] >= _amount, "Insufficient balance");
        
        // Burn synthetic tokens
        _burn(msg.sender, _amount);
        
        // Prepare message for collateral contract
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
    
    // ERC20 functions
    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "Insufficient allowance");
        
        allowance[from][msg.sender] = currentAllowance - amount;
        return _transfer(from, to, amount);
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    // Internal functions
    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(balanceOf[from] >= amount, "Insufficient balance");
        
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        
        emit Transfer(from, to, amount);
        return true;
    }
    
    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "Mint to zero address");
        
        totalSupply += amount;
        balanceOf[to] += amount;
        
        emit Transfer(address(0), to, amount);
    }
    
    function _burn(address from, uint256 amount) internal {
        require(from != address(0), "Burn from zero address");
        require(balanceOf[from] >= amount, "Insufficient balance");
        
        balanceOf[from] -= amount;
        totalSupply -= amount;
        
        emit Transfer(from, address(0), amount);
    }
    
    // Owner functions
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
    
    // Emergency functions
    function withdrawEth() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    receive() external payable {}
}