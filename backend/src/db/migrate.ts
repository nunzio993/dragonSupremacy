import { query } from './index.js';

/**
 * Database Migration Script
 * 
 * Run with: npm run db:migrate
 * 
 * ============================================
 * DATABASE SCHEMA OVERVIEW
 * ============================================
 * 
 * CORE TABLES:
 *   accounts         - Player accounts with XP and currency
 *   player_units     - Player-owned units (legacy autobattler)
 *   player_equipment - Equipment items (legacy autobattler)
 *   loadouts         - Active battle loadout configuration
 * 
 * BATTLE TABLES:
 *   matches          - [LEGACY] Auto-battle match history (instant simulation)
 *   turn_battles     - [NEW] Interactive turn-based battle state (Pokémon-style)
 * 
 * ============================================
 */

async function migrate() {
  console.log('[Migration] Starting database migration...');

  // --------------------------------------------------------
  // CORE: accounts
  // Player accounts with progression data
  // Fields:
  //   xp    - Total experience points earned
  //   level - Player level (kept in sync with XP)
  //   coins - Soft currency for in-game purchases
  // --------------------------------------------------------
  await query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      coins INTEGER DEFAULT 100
    )
  `);
  console.log('[Migration] Created accounts table');

  // Add coins column if migrating from old schema (had soft_currency)
  await query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 100`);

  // --------------------------------------------------------
  // LEGACY: player_units
  // Player-owned units for the autobattler system
  // Will be replaced by RMRK NFT ownership in the future
  // --------------------------------------------------------
  await query(`
    CREATE TABLE IF NOT EXISTS player_units (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
      unit_definition_id VARCHAR(50) NOT NULL,
      rmrk_nft_id VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[Migration] Created player_units table');

  // --------------------------------------------------------
  // LEGACY: player_equipment
  // Equipment items that can be attached to units
  // Will be replaced by RMRK NFT nesting in the future
  // --------------------------------------------------------
  await query(`
    CREATE TABLE IF NOT EXISTS player_equipment (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
      equipment_definition_id VARCHAR(50) NOT NULL,
      equipped_on_unit_id UUID REFERENCES player_units(id) ON DELETE SET NULL,
      rmrk_nft_id VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[Migration] Created player_equipment table');

  // --------------------------------------------------------
  // NEW: player_moves
  // Move NFTs owned by players (for Pokémon-style system)
  // Can be attached to creatures via RMRK nesting
  // --------------------------------------------------------
  await query(`
    CREATE TABLE IF NOT EXISTS player_moves (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
      move_definition_id VARCHAR(50) NOT NULL,
      attached_to_creature_id UUID REFERENCES player_units(id) ON DELETE SET NULL,
      rmrk_nft_id VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[Migration] Created player_moves table');

  // --------------------------------------------------------
  // CORE: loadouts
  // Active battle loadout (which units to use)
  // --------------------------------------------------------
  await query(`
    CREATE TABLE IF NOT EXISTS loadouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID REFERENCES accounts(id) ON DELETE CASCADE UNIQUE,
      unit_ids UUID[] DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[Migration] Created loadouts table');

  // --------------------------------------------------------
  // LEGACY: matches (auto-battle history)
  // Stores completed auto-battle results
  // Battles are simulated instantly, events stored for replay
  // Used by: /api/v1/match/* routes
  // --------------------------------------------------------
  await query(`
    CREATE TABLE IF NOT EXISTS matches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
      seed BIGINT NOT NULL,
      result VARCHAR(10) NOT NULL,
      opponent_type VARCHAR(20) DEFAULT 'ai',
      team_a JSONB NOT NULL,
      team_b JSONB NOT NULL,
      events JSONB NOT NULL,
      total_turns INTEGER NOT NULL,
      xp_gained INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[Migration] Created matches table (legacy auto-battles)');

  // --------------------------------------------------------
  // NEW: turn_battles (interactive Pokémon-style battles)
  // Stores ongoing turn-based battle state
  // Players submit actions each turn, AI responds
  // state_json contains full BattleState object
  // Used by: /api/v1/turn-battle/* routes
  // --------------------------------------------------------
  await query(`
    CREATE TABLE IF NOT EXISTS turn_battles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
      state_json JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[Migration] Created turn_battles table (new turn-based)');

  // --------------------------------------------------------
  // NEW: creature_hp (Dragon Token Economy)
  // Off-chain HP tracking for creatures after battles
  // HP regenerates over time based on RGN stat
  // --------------------------------------------------------
  await query(`
    CREATE TABLE IF NOT EXISTS creature_hp (
      token_id BIGINT PRIMARY KEY,
      current_hp INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      last_damage_time TIMESTAMPTZ,
      last_heal_time TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[Migration] Created creature_hp table');

  // --------------------------------------------------------
  // INDEXES
  // --------------------------------------------------------
  await query(`CREATE INDEX IF NOT EXISTS idx_player_units_account ON player_units(account_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_player_equipment_account ON player_equipment(account_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_player_equipment_unit ON player_equipment(equipped_on_unit_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_matches_account ON matches(account_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_matches_created ON matches(created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_turn_battles_player ON turn_battles(player_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_turn_battles_updated ON turn_battles(updated_at DESC)`);
  console.log('[Migration] Created indexes');

  console.log('[Migration] Database migration complete!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('[Migration] Error:', err);
  process.exit(1);
});
