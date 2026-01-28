# Production Deployment Checklist

## 🚨 Critical: Mock Contracts to Replace

### MockRMRK Token

**Location:** `contracts/src/mocks/MockRMRK.sol`

The local development environment uses a mock RMRK token. **Before deploying to mainnet:**

| Action | How |
|--------|-----|
| Get real RMRK address | Check [RMRK official docs](https://docs.rmrk.app/) |
| Update GameConfig | Call `gameConfig.setRmrkToken(REAL_RMRK_ADDRESS)` |
| Verify BattleGate | Ensure constructor uses real RMRK |
| Verify RMRKCreature | Uses GameConfig, should work automatically |

**Known RMRK Addresses:**
- Ethereum Mainnet: `0x524B969793a64A602342d89BC2789D43a016B13A`
- Base: Check RMRK docs for bridged address
- Base Sepolia: May need to deploy test token or use bridge

---

## Contract Deployment Order

Deploy contracts in this order to ensure proper initialization:

1. **GameConfig** - Central configuration
2. **DragonToken (DGNE)** - ERC20 reward token
3. **DragonStaking** - Staking mechanism (needs GameConfig, DragonToken, RMRKCreature)
4. **BattleGate** - Battle entry (needs GameConfig, DragonToken, RMRK)
5. **RMRKCreature** - NFT creatures (set GameConfig after deploy)

---

## Post-Deployment Configuration

### 1. DragonToken Minter Authorization
```solidity
dragonToken.setMinter(dragonStakingAddress, true);
```

### 2. GameConfig Contract References
```solidity
gameConfig.setDragonToken(dragonTokenAddress);
gameConfig.setRmrkToken(REAL_RMRK_ADDRESS); // NOT MockRMRK!
gameConfig.setStakingContract(dragonStakingAddress);
gameConfig.setBattleGateContract(battleGateAddress);
```

### 3. RMRKCreature Token Payment
```solidity
rmrkCreature.setGameConfig(gameConfigAddress);
rmrkCreature.setMintingRequiresPayment(true); // Enable when ready
```

---

## Frontend Updates

Update contract addresses in:
- `frontend/src/screens/StakingScreen.tsx`
- `frontend/src/screens/AdminScreen.tsx`
- Any other components using wagmi hooks

---

## Security Checklist

- [ ] All contract ownership transferred to multisig
- [ ] GameConfig paused during initial setup
- [ ] Entry fees set to reasonable values
- [ ] Staking rates balanced for tokenomics
- [ ] MockRMRK replaced with real RMRK
- [ ] Frontend pointing to production contracts
