# 🔧 Errori Comuni e Soluzioni

## 1. "mintCreature reverted - Internal error" / "Not authorized to mint"

**Causa**: Il contratto RMRKCreature ha **DUE** sistemi di autorizzazione:
1. `isContributor` - per funzioni generali (addAsset, ecc.)
2. `authorizedMinters` - per mintare creature

**Soluzione**: Aggiungi l'account ENTRAMBI:
```bash
cd contracts

# Metodo 1: Script automatico (aggiunge contributor)
npx tsx scripts/add-contributor.ts

# Metodo 2: Manuale per entrambi
npx tsx -e "const { ethers } = require('ethers'); const fs = require('fs'); async function main() { const p = new ethers.JsonRpcProvider('http://127.0.0.1:8545'); const w = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', p); const a = JSON.parse(fs.readFileSync('deployed-addresses.json', 'utf-8')); const c = new ethers.Contract(a.RMRKCreature, ['function manageContributor(address,bool)', 'function setMinter(address,bool)'], w); await (await c.manageContributor('0x70997970C51812dc3A010C7d01b50e0d17dc79C8', true)).wait(); await (await c.setMinter('0x70997970C51812dc3A010C7d01b50e0d17dc79C8', true)).wait(); console.log('Done!'); } main();"
```

---

## 2. "Nonce too low" / "nonce has already been used"

**Causa**: Transazioni concorrenti o script che non aspettano il nonce corretto.

**Soluzione**: 
- Aspetta qualche secondo e riprova
- O riavvia il nodo Hardhat:
```bash
# Termina il nodo attuale
npx kill-port 8545

# Riavvia
npm run node

# Re-deploy
npx hardhat run scripts/deploy-local.ts --network localhost
npx hardhat run scripts/deploy-economy-v2.ts --network localhost
```

---

## 3. "net::ERR_CONNECTION_REFUSED port 8545"

**Causa**: Il nodo Hardhat non è attivo.

**Soluzione**:
```bash
cd contracts
npm run node
```

---

## 4. Token/Creature non visibili dopo deploy

**Causa**: Indirizzi contratti nel frontend diversi da quelli deployati.

**Soluzione**:
1. Controlla `contracts/deployed-addresses.json`
2. Aggiorna `frontend/src/contracts/config.ts` con gli stessi indirizzi

---

## 5. Secondo account senza token/draghi

**Causa**: Solo il deployer riceve token/creature automaticamente.

**Soluzione**:
```bash
cd contracts

# Minta token
npx tsx scripts/mint-tokens-to-all.ts

# Aggiungi come contributor per mintare creature
npx tsx scripts/add-contributor.ts
```

---

## 6. Stato perso dopo riavvio nodo

**Causa**: Hardhat node NON persiste lo stato di default.

**Soluzione**: Dopo ogni riavvio del nodo:
```bash
cd contracts
npm run node                                          # In un terminale
npx hardhat run scripts/deploy-local.ts --network localhost
npx hardhat run scripts/deploy-economy-v2.ts --network localhost
npx tsx scripts/add-contributor.ts                    # Per abilitare altri account
npx tsx scripts/mint-tokens-to-all.ts                 # Per dare token ad altri account
```

---

## 📋 Script Utili

| Script | Descrizione |
|--------|-------------|
| `deploy-all-unified.ts` | Deploy tutti i contratti (creature, token, staking, battlegate) |
| `deploy-battle-gate-v2.ts` | Deploy BattleGateV2 (escrow system) |
| `setup-after-deploy.ts` | **ESEGUI SEMPRE DOPO IL DEPLOY** - Aggiunge contributor, minter, minta tokens, aggiorna config |
| `mint-test-tokens.ts` | Minta 1000 DGNE + 1000 RMRK a tutti gli account |
| `emergency-refund.ts` | Sblocca battaglie stuck on-chain |

## 🚀 Procedura Completa Post-Riavvio

```bash
# 1. Avvia hardhat node
cd contracts
npm run node

# 2. In un altro terminale, deploy contratti
npx hardhat run scripts/deploy-all-unified.ts --network localhost
npx hardhat run scripts/deploy-battle-gate-v2.ts --network localhost

# 3. Setup automatico (OBBLIGATORIO!)
npx ts-node scripts/setup-after-deploy.ts

# 4. Avvia backend e frontend
cd ../backend && npm run dev
cd ../frontend && npm run dev
```

---

## ⚠️ Indirizzi Hardhat Test Accounts

| Account | Address | Private Key |
|---------|---------|-------------|
| #0 (Deployer) | 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 | 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 |
| #1 | 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 | 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d |
| #2 | 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC | 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a |
