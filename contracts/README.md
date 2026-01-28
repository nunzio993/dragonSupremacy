# NFT Autobattler Smart Contracts

Smart contracts for the NFT Autobattler game deployed on Base (Ethereum L2).

## Contracts

### CreatureNFT.sol
ERC-721 token representing battle creatures.

**Features:**
- Core creature data stored on-chain (definitionId, talent, temperament)
- Full stats stored off-chain (hash on-chain for verification)
- XP system for leveling up
- Authorized minter system for controlled minting

### BattleArena.sol
Manages battles between creatures with ETH stakes.

**Features:**
- Match creation with customizable stake
- Stake escrow until battle completion
- Server-side battle resolution with on-chain settlement
- 2% platform fee on winnings
- Dispute resolution system
- XP rewards for winners

## Setup

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Base Sepolia ETH (get from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-sepolia-faucet))

### Install Dependencies
```bash
cd contracts

# Install Foundry dependencies
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit
```

### Configure Environment
```bash
cp .env.example .env
# Edit .env with your values:
# - PRIVATE_KEY: Your deployer wallet private key
# - BASESCAN_API_KEY: For contract verification (optional)
```

### Build
```bash
forge build
```

### Test
```bash
forge test
```

### Deploy to Base Sepolia
```bash
# Load environment variables
source .env

# Deploy
forge script script/Deploy.s.sol:DeployScript \
    --rpc-url $BASE_SEPOLIA_RPC_URL \
    --broadcast \
    --verify
```

## Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| CreatureNFT | `0xa97cc4df48b66Ad448dF1cb768B09391c467f9c8` |
| BattleArena | `0x46Cb0D2cD0671Aa742C728D696144E58A7605eA7` |

## Architecture

```
Player A                    Backend                 Smart Contracts
    |                          |                          |
    |-- Create Match --------->|                          |
    |                          |-- createMatch() -------->| (stake deposited)
    |                          |                          |
    |                          |<-- MatchCreated event ---|
    |<-- Room Created ---------|                          |
    |                          |                          |
Player B                       |                          |
    |-- Join Match ----------->|                          |
    |                          |-- joinMatch() ---------->| (stake deposited)
    |                          |                          |
    |                          |<-- MatchJoined event ----|
    |<-- Battle Start ---------|                          |
    |                          |                          |
    |                   [Battle Executes Off-chain]       |
    |                          |                          |
    |                          |-- declareWinner() ------>|
    |                          |                          |
    |<-- You Won! -------------|                          |
    |-- Claim Prize ---------->|-- claimPrize() --------->| (ETH sent)
    |<-- ETH Received ---------|                          |
```

## Security Considerations

1. **Battle Server Trust**: The battle server can declare winners. Use commit-reveal for trustless battles.
2. **Reentrancy**: Protected with OpenZeppelin's ReentrancyGuard.
3. **Stake Limits**: Min/max stake enforced to prevent abuse.
4. **Match Timeout**: Disputes can be opened if matches get stuck.

## License

MIT
