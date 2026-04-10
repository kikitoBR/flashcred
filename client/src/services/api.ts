
const getApiUrl = () => {
    const isLocalhost = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
    return isLocalhost ? 'http://localhost:3001/api' : '/api';
};

const API_URL = getApiUrl();

const getHeaders = () => {
    const isLocalhost = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
    const token = localStorage.getItem('token');
    const headers: any = {
        'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (isLocalhost) headers['x-tenant-id'] = 'demo';
    
    return headers;
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
    },
    logSimulation: async (data: any) => {
        const response = await fetch(`${API_URL}/sales/simulation`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to log simulation');
        return response.json();
    },
    createFromSimulation: async (data: any) => {
        const response = await fetch(`${API_URL}/sales/from-simulation`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to create sale from simulation');
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
    },
    update: async (id: string, data: any) => {
        const response = await fetch(`${API_URL}/clients/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update client');
        return response.json();
    },
    remove: async (id: string) => {
        const response = await fetch(`${API_URL}/clients/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Failed to delete client');
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
    },
    update: async (id: string, data: any) => {
        const response = await fetch(`${API_URL}/vehicles/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update vehicle');
        return response.json();
    }
};

export const rpaService = {
    simulate: async (data: { client: any; vehicle: any; banks: string[]; options?: any }) => {
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

export const credentialsService = {
    getAll: async () => {
        const response = await fetch(`${API_URL}/credentials`, { headers: getHeaders() });
        if (!response.ok) throw new Error('Failed to fetch credentials');
        return response.json();
    },
    save: async (bankId: string, login: string, password?: string) => {
        const response = await fetch(`${API_URL}/credentials/${bankId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ login, password })
        });
        if (!response.ok) throw new Error('Failed to save credentials');
        return response.json();
    },
    updateStatus: async (bankId: string, status: 'ACTIVE' | 'INACTIVE') => {
        const response = await fetch(`${API_URL}/credentials/${bankId}/status`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status })
        });
        if (!response.ok) throw new Error('Failed to update status');
        return response.json();
    }
};
