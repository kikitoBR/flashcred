
import { Bank, Client, Vehicle, BankCredential } from './types';

export const BANKS: Bank[] = [
  { id: '1', name: 'Banco Itaú', color: 'bg-orange-500', logoInitial: 'I', portalUrl: 'https://www.credlineitau.com.br' },
  { id: '2', name: 'Bradesco Financiamentos', color: 'bg-red-600', logoInitial: 'B', portalUrl: 'https://turbo.bradesco/originacaolojista/login' },
  { id: '3', name: 'Santander', color: 'bg-red-700', logoInitial: 'S', portalUrl: 'https://www.santander.com.br/portal/wps/script/templates/GCMRequest.do?page=5687' },
  { id: '4', name: 'BV Financeira', color: 'bg-blue-500', logoInitial: 'V', portalUrl: 'https://www.bv.com.br/financiamento-de-veiculos' },
  { id: '5', name: 'Banco Pan', color: 'bg-cyan-500', logoInitial: 'P', portalUrl: 'https://veiculos.bancopan.com.br/login' },
  { id: '6', name: 'C6 Bank', color: 'bg-slate-900', logoInitial: 'C', portalUrl: 'https://c6auto.com.br/originacaolojista/login' },
  { id: '7', name: 'Banco Safra', color: 'bg-yellow-600', logoInitial: 'S', portalUrl: 'https://financeira.safra.com.br/veiculos/login' },
  { id: '8', name: 'Daycoval', color: 'bg-indigo-600', logoInitial: 'D', portalUrl: 'https://www.daycoval.com.br/financiamento-de-veiculos' },
  { id: '9', name: 'Omni Financeira', color: 'bg-purple-600', logoInitial: 'OM', portalUrl: 'https://omni-mais.omni.com.br/login' },
];

export const MOCK_CREDENTIALS: BankCredential[] = [
  { bankId: '1', login: 'concessionaria_sp_01', lastUpdated: '2023-10-15' },
  { bankId: '2', login: '99887766', lastUpdated: '2023-09-20' },
  { bankId: '3', login: 'auto_shop_user', lastUpdated: '2023-10-01' },
  { bankId: '4', login: 'partner_bv_55', lastUpdated: '2023-08-15' },
  { bankId: '5', login: '', lastUpdated: '-' },
  { bankId: '6', login: '', lastUpdated: '-' },
  { bankId: '7', login: '', lastUpdated: '-' },
  { bankId: '8', login: '', lastUpdated: '-' },
];

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'Roberto Silva',
    cpf: '123.456.789-00',
    income: 8500,
    email: 'roberto@email.com',
    phone: '(11) 99999-9999',
    score: 850,
    status: 'ACTIVE',
    address: { street: 'Av. Paulista', number: '1000', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP', zipCode: '01310-100' },
    cnh: { hasCnh: true, categories: ['A', 'B'] }
  },
  {
    id: 'c2',
    name: 'Ana Souza',
    cpf: '987.654.321-11',
    income: 4200,
    email: 'ana@email.com',
    phone: '(21) 98888-8888',
    score: 620,
    status: 'ACTIVE',
    address: { street: 'Rua das Flores', number: '230', neighborhood: 'Copacabana', city: 'Rio de Janeiro', state: 'RJ', zipCode: '22000-000' },
    cnh: { hasCnh: true, categories: ['B'] }
  },
  {
    id: 'c3',
    name: 'Carlos Oliveira',
    cpf: '456.789.123-22',
    income: 12000,
    email: 'carlos@email.com',
    phone: '(31) 97777-7777',
    score: 910,
    status: 'ACTIVE',
    address: { street: 'Av. Afonso Pena', number: '500', neighborhood: 'Centro', city: 'Belo Horizonte', state: 'MG', zipCode: '30000-000' },
    cnh: { hasCnh: true, categories: ['A', 'B', 'C'] }
  },
  {
    id: 'c4',
    name: 'Mariana Costa',
    cpf: '789.123.456-33',
    income: 3500,
    email: 'mariana@email.com',
    phone: '(41) 96666-6666',
    score: 450,
    status: 'ACTIVE',
    address: { street: 'Rua XV de Novembro', number: '120', neighborhood: 'Centro', city: 'Curitiba', state: 'PR', zipCode: '80000-000' },
    cnh: { hasCnh: false, categories: [] }
  },
  {
    id: 'c5',
    name: 'Pedro Santos',
    cpf: '321.654.987-44',
    income: 15000,
    email: 'pedro@email.com',
    phone: '(51) 95555-5555',
    score: 780,
    status: 'ARCHIVED',
    address: { street: 'Av. Ipiranga', number: '2000', neighborhood: 'Partenon', city: 'Porto Alegre', state: 'RS', zipCode: '90000-000' },
    cnh: { hasCnh: true, categories: ['B'] }
  },
];

export const MOCK_VEHICLES: Vehicle[] = [
  {
    id: 'v1',
    brand: 'Honda',
    model: 'Civic Touring',
    year: 2022,
    price: 145000,
    plate: 'ABC-1234',
    mileage: 15000,
    images: ['https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?auto=format&fit=crop&q=80&w=800'],
    status: 'AVAILABLE'
  },
  {
    id: 'v2',
    brand: 'Toyota',
    model: 'Corolla Cross',
    year: 2023,
    price: 160000,
    plate: 'XYZ-9876',
    mileage: 8000,
    images: ['https://images.unsplash.com/photo-1621007947382-bb3c3968e398?auto=format&fit=crop&q=80&w=800'],
    status: 'RESERVED'
  },
  {
    id: 'v3',
    brand: 'Jeep',
    model: 'Compass Longitude',
    year: 2021,
    price: 135000,
    plate: 'JEEP-2021',
    mileage: 32000,
    images: ['https://images.unsplash.com/photo-1688647573046-271d447d6a2f?auto=format&fit=crop&q=80&w=800'],
    status: 'AVAILABLE'
  },
  {
    id: 'v4',
    brand: 'Fiat',
    model: 'Pulse Audace',
    year: 2024,
    price: 115000,
    plate: 'NEW-2024',
    mileage: 0,
    images: ['https://images.unsplash.com/photo-1623869675781-804f84b36063?auto=format&fit=crop&q=80&w=800'],
    status: 'AVAILABLE'
  },
  {
    id: 'v5',
    brand: 'Chevrolet',
    model: 'Onix Plus',
    year: 2023,
    price: 95000,
    plate: 'CHV-5566',
    mileage: 12000,
    images: ['https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=800'],
    status: 'SOLD'
  },
  {
    id: 'v6',
    brand: 'Volkswagen',
    model: 'Nivus Highline',
    year: 2022,
    price: 128000,
    plate: 'VWS-9988',
    mileage: 25000,
    images: ['https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&q=80&w=800'],
    status: 'AVAILABLE'
  },
];