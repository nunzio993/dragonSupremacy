# Security Guidelines

> **🔒 SECURITY FIRST** - La sicurezza è SEMPRE la priorità #1.

## Core Principles

1. **Defense in Depth** - Multiple layers of security
2. **Least Privilege** - Contracts only have permissions they need
3. **Fail Secure** - On error, default to secure state (deny)
4. **No Trust Assumptions** - Validate all inputs, even from "trusted" sources

---

## Smart Contract Security Checklist

### Access Control
- [ ] All admin functions have `onlyOwner` modifier
- [ ] Minting restricted to authorized contracts (whitelist)
- [ ] Critical operations are `Pausable`
- [ ] Ownership transfer is 2-step (accept pattern)

### Reentrancy
- [ ] Use `ReentrancyGuard` on all state-changing external calls
- [ ] Follow Check-Effects-Interactions pattern
- [ ] No callbacks before state updates

### Token Safety
- [ ] Use `SafeERC20` for token transfers
- [ ] Check return values of `transfer`/`transferFrom`
- [ ] Handle tokens with non-standard decimals

### Input Validation
- [ ] Validate all function parameters
- [ ] Use `require` with descriptive error messages
- [ ] Check for zero addresses
- [ ] Validate array bounds

### Economic Security
- [ ] No flash loan vulnerabilities
- [ ] Rate limiting on expensive operations
- [ ] Configurable parameters have sane bounds

---

## Pre-Deployment Checklist

1. [ ] All tests passing
2. [ ] Slither/Mythril static analysis clean
3. [ ] Contract sizes under 24KB
4. [ ] Gas optimization review
5. [ ] External audit (for mainnet)
6. [ ] Timelock on admin functions (for mainnet)
7. [ ] Emergency pause mechanism tested

---

## Known Attack Vectors to Prevent

| Attack | Mitigation |
|--------|------------|
| Reentrancy | `ReentrancyGuard`, CEI pattern |
| Flash Loans | Block same-tx operations where needed |
| Front-running | Commit-reveal or private mempools |
| Integer Overflow | Solidity 0.8+ (built-in checks) |
| Signature Replay | Nonce tracking per user |
| Denial of Service | Gas limits, no unbounded loops |

---

## Incident Response

If a vulnerability is discovered:
1. **PAUSE** all contracts immediately
2. **ASSESS** scope of damage
3. **COMMUNICATE** with users transparently
4. **FIX** and deploy patched contracts
5. **POST-MORTEM** document lessons learned

---

## Battle System Security

### Current Architecture: Nonce-Based Entry Fee Verification

```
Player → payEntryFee(nonce) → BattleGate → marks nonce USED
     ↓
Backend saves nonce in room → Battle happens off-chain
     ↓
Winner determined → Backend calls rewardWinner(winner, winnerNonce)
     ↓
BattleGate verifies nonce exists → Mints DGNE to winner
```

### Security Properties

| Property | Status | Notes |
|----------|--------|-------|
| Replay prevention | ✅ | Each nonce usable once |
| Entry fee verified | ✅ | BattleGate tracks paid entries |
| Authorized payout | ✅ | Only operator can trigger rewards |
| Trustless outcome | ❌ | Server determines winner |

### Trust Model

**Trusted Components:**
- Server backend (determines battle outcome)
- Operator wallet (calls rewardWinner)

**Trustless Components:**
- Entry fee collection (on-chain)
- Reward distribution (on-chain, but triggered by server)

### Alternative: Fully On-Chain Battles (Trade-offs)

| Approach | Pros | Cons |
|----------|------|------|
| **Tx per move** | Verifiable | Snervante (conferma ogni mossa), costoso in gas, lento (attendere blocco) |
| **Commit-Reveal** | Tamper-proof | 2 tx per mossa, ancora lento |
| **ZK Proofs** | Privato + verificabile | Complessità altissima, proving time |
| **State Channels** | Veloce, economico | Setup complesso, require cooperative close |
| **Optimistic Rollups** | Economico, verificabile | 7 giorni challenge period |

### Raccomandazione

Per un gioco casual/competitivo, il sistema attuale **nonce + server arbitro** offre il miglior compromesso tra:
- ✅ UX fluida (nessuna conferma per mossa)
- ✅ Basso costo (solo 2 tx: entry + reward)
- ✅ Velocità (battaglie real-time)
- ⚠️ Trust nel server (mitigabile con logging pubblico)

**Mitigazioni per aumentare trust:**
1. Log immutabili delle battaglie (IPFS o on-chain hash)
2. Multi-sig per operator wallet
3. Dispute mechanism: player può contestare entro X ore
4. Public leaderboard con replay verificabili

