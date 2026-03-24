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
        zipCode?: string; // NOVO CAMPO
    };
    vehicle: {
        plate: string;
        brand: string;
        model: string;
        version?: string; // NOVO: usado para encontrar a versão exata nos bancos
        year: number;
        price: number;
        uf: string;
        condition?: 'NOVO' | 'SEMINOVO' | 'USADO';
    };
    paymentMethod?: 'FINANCING' | 'CASH';
    downPayment?: number;
    installments?: number;
    options?: {
        safraCoefficient?: string;
        safraReturn?: string;
        dealerReturn?: 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6'; // Retorno Lojista C6
        bradescoReturn?: string;
        omniReturn?: string;
        itauReturn?: string;
        panReturn?: string;
    };
}

export interface SimulationOffer {
    bankId: string;
    installments: number;
    monthlyPayment: number;
    interestRate: number;
    totalValue: number;
    description?: string;
    hasHighChance?: boolean;
}

export interface SimulationResult {
    bankId: string;
    status: 'SUCCESS' | 'ERROR' | 'LOGIN_FAILED' | 'BLOCKED' | 'REJECTED';
    message?: string;
    warning?: string;
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
