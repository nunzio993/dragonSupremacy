import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config.js';

export interface AuthPayload {
    accountId: string;
}

declare global {
    namespace Express {
        interface Request {
            auth?: AuthPayload;
        }
    }
}

/**
 * Authentication middleware
 * Validates JWT token and attaches auth payload to request
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
    }

    const token = authHeader.substring(7);

    try {
        const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
        req.auth = payload;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/**
 * Generate a JWT token for an account
 */
export function generateToken(accountId: string): string {
    return jwt.sign({ accountId }, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });
}
