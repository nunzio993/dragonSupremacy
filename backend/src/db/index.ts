import pg from 'pg';
import config from '../config.js';

const { Pool } = pg;

export const pool = new Pool({
    connectionString: config.databaseUrl,
});

// Test connection on startup
pool.on('connect', () => {
    console.log('[DB] Connected to PostgreSQL');
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client', err);
    process.exit(-1);
});

/**
 * Execute a query with parameters
 */
export async function query<T extends pg.QueryResultRow = any>(
    text: string,
    params?: any[]
): Promise<pg.QueryResult<T>> {
    const start = Date.now();
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (config.nodeEnv === 'development') {
        console.log('[DB] Query executed', {
            text: text.substring(0, 100),
            duration: `${duration}ms`,
            rows: result.rowCount,
        });
    }

    return result;
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<pg.PoolClient> {
    return pool.connect();
}
