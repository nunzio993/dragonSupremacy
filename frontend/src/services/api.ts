const API_BASE = '/api/v1';

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

class ApiClient {
    private token: string | null = null;

    setToken(token: string | null) {
        this.token = token;
    }

    private async request<T>(
        method: string,
        path: string,
        body?: unknown
    ): Promise<T> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(`${API_BASE}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        const data: ApiResponse<T> = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Request failed');
        }

        return data.data as T;
    }

    // Auth
    async createGuestAccount() {
        return this.request<{
            accountId: string;
            token: string;
            starterUnits: string[];
            starterEquipment: string[];
        }>('POST', '/auth/guest');
    }

    // Game Data
    async getGameData() {
        return this.request<{
            units: any[];
            equipment: any[];
        }>('GET', '/gamedata/all');
    }

    // Roster
    async getRoster() {
        return this.request<{
            units: any[];
            equipment: any[];
            loadout: string[];
        }>('GET', '/roster');
    }

    async saveLoadout(unitInstanceIds: string[]) {
        return this.request<{ loadout: string[] }>('POST', '/roster/loadout', {
            unitInstanceIds,
        });
    }

    async equipItem(unitInstanceId: string, equipmentInstanceId: string) {
        return this.request<any>('POST', '/roster/equip', {
            unitInstanceId,
            equipmentInstanceId,
        });
    }

    async unequipItem(equipmentInstanceId: string) {
        return this.request<any>('POST', '/roster/unequip', {
            equipmentInstanceId,
        });
    }

    // Match
    async simulateMatch() {
        return this.request<{
            matchId: string;
            result: 'teamA' | 'teamB' | 'draw';
            events: any[];
            totalTurns: number;
            finalState: any;
            xpGained: number;
            newLevel?: number;
        }>('POST', '/match/simulate');
    }

    async getMatchHistory(limit = 20) {
        return this.request<any[]>('GET', `/match/history?limit=${limit}`);
    }

    async getMatchReplay(matchId: string) {
        return this.request<any>('GET', `/match/${matchId}/replay`);
    }
}

export const api = new ApiClient();
export default api;
