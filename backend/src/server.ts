import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import config from './config.js';

// Routes
import authRouter from './routes/auth.js';
import rosterRouter from './routes/roster.js';
import matchRouter from './routes/match.js';
import gamedataRouter from './routes/gamedata.js';
import turnBattleRouter from './routes/turn-battle.js';
import economyRouter from './routes/economy.js';
import shopRouter from './routes/shop.js';
import fusionRouter from './routes/fusion.js';
import mintRouter from './routes/mint.js';

// Matchmaking
import { initializeSocketHandlers } from './matchmaking/index.js';

// ============ SECURITY VALIDATION ============
// Validate critical environment variables at startup

// JWT Secret
if (!config.jwtSecret) {
    const message = 'CRITICAL: JWT_SECRET environment variable is required.\n' +
        'For local development, add to backend/.env:\n' +
        'JWT_SECRET=your-secret-key-at-least-32-characters';

    if (config.nodeEnv === 'production') {
        throw new Error(message);
    } else {
        console.warn('\n⚠️  WARNING: ' + message + '\n');
        (config as any).jwtSecret = 'INSECURE-DEV-ONLY-SECRET-DO-NOT-USE-IN-PROD';
    }
}

// Database URL
if (!config.databaseUrl) {
    const message = 'CRITICAL: DATABASE_URL environment variable is required.\n' +
        'For local development, add to backend/.env:\n' +
        'DATABASE_URL=postgresql://game:gamepass@localhost:5434/autobattler';

    if (config.nodeEnv === 'production') {
        throw new Error(message);
    } else {
        console.warn('\n⚠️  WARNING: ' + message + '\n');
        (config as any).databaseUrl = 'postgresql://game:gamepass@localhost:5434/autobattler';
    }
}
// =============================================

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
    cors: {
        origin: config.corsOrigins,
        credentials: true,
    }
});

// Initialize WebSocket handlers
initializeSocketHandlers(io);
console.log('[Server] WebSocket handlers initialized');

// Middleware
app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/roster', rosterRouter);
app.use('/api/v1/match', matchRouter);
app.use('/api/v1/gamedata', gamedataRouter);
app.use('/api/v1/turn-battle', turnBattleRouter);
app.use('/api/v1/economy', economyRouter);
app.use('/api/v1/shop', shopRouter);
app.use('/api/v1/fusion', fusionRouter);
app.use('/api/v1/mint', mintRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server (using httpServer instead of app.listen for Socket.io)
httpServer.listen(config.port, () => {
    console.log(`[Server] NFT Autobattler API running on port ${config.port}`);
    console.log(`[Server] Environment: ${config.nodeEnv}`);
    console.log(`[Server] CORS origins: ${config.corsOrigins.join(', ')}`);
    console.log(`[Server] WebSocket ready for connections`);
});

export default app;
export { io };

