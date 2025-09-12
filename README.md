# Blockchain Backend with Express.js and Hardhat

A complete backend setup for blockchain development using Express.js and Hardhat for local Ethereum development.

## Features

- 🚀 Express.js REST API server
- ⛓️ Hardhat local blockchain network
- 📝 Smart contract development environment
- 🧪 Comprehensive testing setup
- 🔧 Development tools and scripts

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Express Server
```bash
npm run dev
```

### 3. Start Hardhat Local Network (in a new terminal)
```bash
npm run hardhat:node
```

### 4. Compile Smart Contracts
```bash
npm run hardhat:compile
```

### 5. Run Tests
```bash
npm run hardhat:test
```

### 6. Deploy Contracts to Local Network
```bash
npm run hardhat:deploy
```

## Project Structure

```
├── contracts/          # Smart contracts
│   └── SimpleStorage.sol
├── scripts/            # Deployment scripts
│   └── deploy.js
├── test/              # Contract tests
│   └── SimpleStorage.test.js
├── routes/            # Express routes
│   └── blockchain.js
├── server.js          # Main server file
├── hardhat.config.js  # Hardhat configuration
└── package.json
```

## API Endpoints

- `GET /` - Server status
- `GET /api/blockchain/status` - Blockchain network status
- `GET /health` - Health check

## Smart Contract

The included `SimpleStorage` contract demonstrates:
- Basic storage operations
- Event emission
- Error handling
- Gas optimization

## Development Workflow

1. **Write Smart Contracts**: Add your Solidity contracts in the `contracts/` directory
2. **Test Contracts**: Write tests in the `test/` directory
3. **Deploy Locally**: Use the deployment scripts to deploy to local Hardhat network
4. **Integrate with API**: Connect your contracts to Express.js endpoints
5. **Build Frontend**: Create a frontend to interact with your blockchain backend

## Environment Variables

Copy `.env` and configure:
- `PORT`: Server port (default: 3000)
- `PRIVATE_KEY`: Your wallet private key for deployments
- `NODE_ENV`: Environment (development/production)

## Next Steps

- Add more complex smart contracts
- Implement contract interaction endpoints
- Add authentication and authorization
- Deploy to testnets (Goerli, Sepolia)
- Add frontend integration
- Implement event listening and indexing

## Useful Commands

```bash
# Development
npm run dev                    # Start server with nodemon
npm start                     # Start server in production

# Hardhat
npm run hardhat:compile      # Compile contracts
npm run hardhat:test         # Run contract tests
npm run hardhat:node         # Start local blockchain
npm run hardhat:deploy       # Deploy to local network
```

Happy blockchain development! 🚀⛓️