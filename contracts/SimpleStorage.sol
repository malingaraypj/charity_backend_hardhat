// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleStorage {
    uint256 private storedData;
    
    event DataStored(uint256 indexed newValue, address indexed sender);
    
    constructor() {
        storedData = 0;
    }
    
    function set(uint256 x) public {
        storedData = x;
        emit DataStored(x, msg.sender);
    }
    
    function get() public view returns (uint256) {
        return storedData;
    }
    
    function increment() public {
        storedData += 1;
        emit DataStored(storedData, msg.sender);
    }
    
    function decrement() public {
        require(storedData > 0, "Cannot decrement below zero");
        storedData -= 1;
        emit DataStored(storedData, msg.sender);
    }
}