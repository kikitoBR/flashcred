
export interface Client {
  id: string;
  name: string;
  cpf: string;
  income: number;
  email: string;
  phone: string;
  birthDate?: string; // Data de nascimento (DD/MM/AAAA) - opcional para compatibilidade
  score: number;
  status: 'ACTIVE' | 'ARCHIVED';
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  cnh?: {
    hasCnh: boolean;
    categories: string[]; // Ex: ['A', 'B']
  };
  desiredVehicle?: {
    type: 'NOVO' | 'SEMINOVO' | 'USADO' | '';
    brand: string;
    model: string;
    priceRange: string; // Ex: 'Até R$ 50.000' ou 'R$ 80.000 - R$ 120.000'
  };
}

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  plate: string;
  mileage: number;
  images: string[]; // Changed from image: string to images: string[]
  status: 'AVAILABLE' | 'SOLD' | 'RESERVED';
}

export interface Bank {
  id: string;
  name: string;
  color: string;
  logoInitial: string;
  portalUrl?: string;
}

export interface BankCredential {
  bankId: string;
  login: string;
  password?: string; // Optional because we might not simulate returning the actual password in a real app
  lastUpdated: string;
}

export interface SimulationOffer {
  bankId: string;
  status: 'APPROVED' | 'REJECTED' | 'ANALYSIS';
  interestRate: number; // Monthly percentage
  maxInstallments: number;
  downPayment: number;
  installments: {
    months: number;
    value: number;
  }[];
  reason?: string;
}

export interface SimulationResult {
  id: string;
  date: string;
  client: Client;
  vehicle: Vehicle;
  offers: SimulationOffer[];
  aiSummary?: string;
}

export interface Sale {
  id: string;
  vehicleId: string;
  clientId: string;
  date: string;
  value: number;
  paymentMethod: 'FINANCING' | 'CASH' | 'CONSORTIUM';
  notes?: string;
}