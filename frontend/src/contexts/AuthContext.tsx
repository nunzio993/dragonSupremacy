import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface AuthContextType {
    isLoading: boolean;
    isAuthenticated: boolean;
    accountId: string | null;
    login: () => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'autobattler_token';
const ACCOUNT_KEY = 'autobattler_account';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [accountId, setAccountId] = useState<string | null>(null);

    useEffect(() => {
        // Check for existing session
        const token = localStorage.getItem(TOKEN_KEY);
        const account = localStorage.getItem(ACCOUNT_KEY);

        if (token && account) {
            api.setToken(token);
            setAccountId(account);
            setIsAuthenticated(true);
            setIsLoading(false);
        } else {
            // Auto-create guest account for new users
            login().finally(() => setIsLoading(false));
        }
    }, []);

    const login = async () => {
        try {
            const { token, accountId: newAccountId } = await api.createGuestAccount();

            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(ACCOUNT_KEY, newAccountId);

            api.setToken(token);
            setAccountId(newAccountId);
            setIsAuthenticated(true);
        } catch (error) {
            console.error('Failed to create guest account:', error);
        }
    };

    const logout = () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(ACCOUNT_KEY);
        api.setToken(null);
        setAccountId(null);
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider
            value={{
                isLoading,
                isAuthenticated,
                accountId,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
