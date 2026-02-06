
const API_URL = 'http://localhost:3001/api';

const getHeaders = () => {
    return {
        'Content-Type': 'application/json',
        'x-tenant-id': 'tenant-123' // Valor hardcoded para teste, idealmente viria de um contexto de auth
    };
};

export const salesService = {
    getAll: async () => {
        const response = await fetch(`${API_URL}/sales`, { headers: getHeaders() });
        if (!response.ok) throw new Error('Failed to fetch sales');
        return response.json();
    },
    create: async (data: any) => {
        const response = await fetch(`${API_URL}/sales`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to create sale');
        return response.json();
    },
    getStats: async () => {
        const response = await fetch(`${API_URL}/sales/stats`, { headers: getHeaders() });
        if (!response.ok) throw new Error('Failed to fetch stats');
        return response.json();
    },
    getSimulations: async () => {
        const response = await fetch(`${API_URL}/sales/simulations`, { headers: getHeaders() });
        if (!response.ok) throw new Error('Failed to fetch simulations');
        return response.json();
    },
    getOpportunities: async () => {
        const response = await fetch(`${API_URL}/sales/opportunities`, { headers: getHeaders() });
        if (!response.ok) throw new Error('Failed to fetch opportunities');
        return response.json();
    }
};



export const clientService = {
    getAll: async () => {
        const response = await fetch(`${API_URL}/clients`, { headers: getHeaders() });
        if (!response.ok) throw new Error('Failed to fetch clients');
        return response.json();
    },
    create: async (data: any) => {
        const response = await fetch(`${API_URL}/clients`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to create client');
        return response.json();
    }
};

export const vehicleService = {
    getAll: async () => {
        const response = await fetch(`${API_URL}/vehicles`, { headers: getHeaders() });
        if (!response.ok) throw new Error('Failed to fetch vehicles');
        return response.json();
    },
    create: async (data: any) => {
        const response = await fetch(`${API_URL}/vehicles`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to create vehicle');
        return response.json();
    }
};

export const rpaService = {
    simulate: async (data: { client: any; vehicle: any; banks: string[] }) => {
        try {
            const response = await fetch(`${API_URL}/simulate`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('RPA Service Error:', error);
            throw error;
        }
    }
};

export const interactionsService = {
    create: async (data: any) => {
        const response = await fetch(`${API_URL}/interactions`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to log interaction');
        return response.json();
    }
};
