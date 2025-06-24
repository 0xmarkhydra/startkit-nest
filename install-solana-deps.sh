#!/bin/bash

echo "Installing Solana dependencies..."

# Install Solana Web3.js
npm install @solana/web3.js

# Install Solana SPL Token
npm install @solana/spl-token

# Install Solana Wallet Adapter
npm install @solana/wallet-adapter-base @solana/wallet-adapter-react @solana/wallet-adapter-wallets

echo "Solana dependencies installed successfully!" 