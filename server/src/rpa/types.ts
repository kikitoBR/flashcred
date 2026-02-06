import { Page, BrowserContext } from 'playwright';

export interface Credential {
    login: string;
    password?: string;
    codAgente?: string;
    codOperador?: string;
    certPath?: string; // For digital certificates if needed
}

export interface SimulationInput {
    client: {
        cpf: string;
        name: string;
        birthDate: string;
        phone?: string;
        email?: string;
    };
    vehicle: {
        plate: string;
        brand: string;
        model: string;
        year: number;
        price: number;
        uf: string;
    };
    paymentMethod?: 'FINANCING' | 'CASH';
    downPayment?: number;
    installments?: number;
}

export interface SimulationOffer {
    bankId: string;
    installments: number;
    monthlyPayment: number;
    interestRate: number;
    totalValue: number;
    description?: string;
}

export interface SimulationResult {
    bankId: string;
    status: 'SUCCESS' | 'ERROR' | 'LOGIN_FAILED' | 'BLOCKED';
    message?: string;
    offers: SimulationOffer[];
    screenshot?: string; // Base64 or path
    htmlDump?: string; // For debugging
}

export interface BankAdapter {
    id: string;
    name: string;

    login(page: Page, credentials: Credential): Promise<boolean>;
    simulate(page: Page, input: SimulationInput): Promise<SimulationResult>;
    logout?(page: Page): Promise<void>;
}
