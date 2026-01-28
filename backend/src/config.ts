/**
 * Backend Configuration
 * 
 * All environment variables with sensible defaults for development.
 */
export const config = {
    // Server
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database - SECURITY: Must be set via environment variable
    databaseUrl: process.env.DATABASE_URL || '',

    // JWT - SECURITY: Must be set via environment variable
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

    // CORS
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),

    // Game settings
    startingSoftCurrency: 100,
    xpPerWin: 20,
    xpPerLoss: 5,
    xpPerDraw: 10,
    maxLoadoutSize: 3,
    maxEquipPerUnit: 2,
};

export default config;
