
export interface Client {
    id: string;
    name: string;
    cpf: string;
    birthDate?: string;
    email?: string;
    phone?: string;
    status?: string | 'ACTIVE';
    income?: number;
    score?: number;
    address?: {
        street: string;
        number: string;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
    };
    cnh?: {
        hasCnh: boolean;
        categories: string[];
    };
    desiredVehicle?: {
        type: string;
        brand: string;
        model: string;
        priceRange: string;
    };
    simulationCount?: number;
}

export interface Vehicle {
    id: string;
    brand: string;
    model: string;
    year: number;
    price: number;
    plate: string;
    mileage?: number;
    images: string[];
    status?: string;
}

export interface Sale {
    id: string;
    client_name: string;
    client_cpf: string;
    vehicle_description: string;
    bank_name: string;
    financed_value: number;
    down_payment: number;
    installments: number;
    monthly_payment: number;
    interest_rate: number;
    status: string;
    sale_date: string;
    created_at?: string;
}

export interface SimulationOffer {
    bankId: string;
    status: 'APPROVED' | 'REJECTED' | 'ANALYSIS' | 'ERROR';
    interestRate: number;
    maxInstallments: number;
    downPayment: number;
    installments: { months: number; value: number }[];
    reason?: string;
}
