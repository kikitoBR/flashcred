
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    CheckSquare, Square, PlayCircle, Zap, Loader2, TrendingUp, AlertCircle, CheckCircle2, PartyPopper, ChevronDown, Unplug, Info
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Client, SimulationOffer, Vehicle, Bank } from '../types';
import { rpaService, salesService } from '../services/api';
import { BANKS } from '../../constants';
import { Badge, Button, Card, Input, Modal } from '../components/ui';

// Helper hook for syncing states to global context
const useGlobalState = <T,>(key: string, initialValue: T, globalState: any, setGlobalState: any): [T, (valOrFunc: any) => void] => {
    const stateValue = globalState && globalState[key] !== undefined ? globalState[key] : initialValue;
    const setter = (valOrFunc: any) => {
        setGlobalState((prev: any) => {
            const current = (prev || {});
            const oldVal = current[key] !== undefined ? current[key] : initialValue;
            const newVal = typeof valOrFunc === 'function' ? valOrFunc(oldVal) : valOrFunc;
            return { ...current, [key]: newVal };
        });
    };
    return [stateValue, setter];
};

export const NewSimulation = () => {
    const { clients, vehicles, updateClientScore, setVehicles, bankCredentials, simulationState, setSimulationState } = useAppContext();
    const navigate = useNavigate();
    const location = useLocation();

    // Steps: 1-Selection, 2-Banks, 3-Loading, 4-Results
    const [step, setStep] = useGlobalState('step', 1, simulationState, setSimulationState);

    // Selection State
    const [simulationType, setSimulationType] = useGlobalState<'registered' | 'guest'>('simulationType', 'registered', simulationState, setSimulationState);
    const [selectedClient, setSelectedClient] = useGlobalState<string>('selectedClient', '', simulationState, setSimulationState);
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const [clientSearchTerm, setClientSearchTerm] = useGlobalState('clientSearchTerm', '', simulationState, setSimulationState);

    // Guest State
    const [guestData, setGuestData] = useGlobalState('guestData', {
        name: '',
        cpf: '',
        phone: '',
        birthDate: '',
        hasCnh: false,
        categories: [] as string[],
        score: '500'
    }, simulationState, setSimulationState);

    // Vehicle Selection
    const [selectedVehicle, setSelectedVehicle] = useGlobalState<string>('selectedVehicle', '', simulationState, setSimulationState);
    const [vehicleSearchTerm, setVehicleSearchTerm] = useGlobalState('vehicleSearchTerm', '', simulationState, setSimulationState);
    const [isVehicleDropdownOpen, setIsVehicleDropdownOpen] = useState(false);

    // Financials
    const [downPayment, setDownPayment] = useGlobalState<number>('downPayment', 0, simulationState, setSimulationState);
    const [dealerReturn, setDealerReturn] = useGlobalState<string>('dealerReturn', 'R0', simulationState, setSimulationState);

    const [activeBanks, setActiveBanks] = useState<Bank[]>([]);
    const [selectedBanks, setSelectedBanks] = useGlobalState<string[]>('selectedBanks', [], simulationState, setSimulationState);
    const [safraCoefficient, setSafraCoefficient] = useGlobalState<string>('safraCoefficient', 'R5', simulationState, setSimulationState);
    const [bradescoReturn, setBradescoReturn] = useGlobalState<string>('bradescoReturn', '0', simulationState, setSimulationState);
    const [omniReturn, setOmniReturn] = useGlobalState<string>('omniReturn', '0', simulationState, setSimulationState);
    const [itauReturn, setItauReturn] = useGlobalState<string>('itauReturn', '0', simulationState, setSimulationState);

    useEffect(() => {
        const filtered = BANKS.filter(bank => {
            const cred = bankCredentials.find(c => c.bankId === bank.id);
            return cred?.status === 'ACTIVE' || !cred?.status;
        });
        setActiveBanks(filtered);
    }, [bankCredentials]);

    useEffect(() => {
        // Initialize or update selected banks to only include active ones
        setSelectedBanks(prev => {
            if (prev.length === 0) return activeBanks.map(b => b.id);
            return prev.filter(id => activeBanks.some(b => b.id === id));
        });
    }, [activeBanks]);
    const [simulationResults, setSimulationResults] = useGlobalState<SimulationOffer[]>('simulationResults', [], simulationState, setSimulationState);

    // Sale Success State
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [finalizedOffer, setFinalizedOffer] = useState<SimulationOffer | null>(null);

    // Update down payment default when vehicle changes
    useEffect(() => {
        if (selectedVehicle) {
            const v = vehicles.find(veh => veh.id === selectedVehicle);
            if (v) setDownPayment(v.price * 0.2); // Default 20%
        }
    }, [selectedVehicle, vehicles]);

    // Handle Pre-selection from Retry/Remarketing
    useEffect(() => {
        if (location.state) {
            const { preSelectedClient, preSelectedVehicleModel, preSelectedVehicle } = location.state;

            // 1. Try to match Client
            if (preSelectedClient) {
                const foundClient = clients.find(c =>
                    c.name.toLowerCase() === preSelectedClient.name.toLowerCase() ||
                    c.cpf === preSelectedClient.cpf
                );

                if (foundClient) {
                    setSimulationType('registered');
                    setSelectedClient(foundClient.id);
                } else {
                    // If not found in DB, use Guest Mode and pre-fill data
                    setSimulationType('guest');
                    setGuestData({
                        name: preSelectedClient.name || '',
                        cpf: preSelectedClient.cpf || '',
                        phone: preSelectedClient.phone || '',
                        score: preSelectedClient.score ? preSelectedClient.score.toString() : '500',
                        hasCnh: false,
                        categories: [],
                        birthDate: ''
                    });
                }
            }

            // 2. Try to match Vehicle
            if (preSelectedVehicle) {
                setSelectedVehicle(preSelectedVehicle.id);
            } else if (preSelectedVehicleModel) {
                // Fuzzy match: check if model string contains the state string or vice versa
                const foundVehicle = vehicles.find(v => {
                    const fullVehicleName = `${v.brand} ${v.model}`.toLowerCase();
                    const target = preSelectedVehicleModel.toLowerCase();
                    return fullVehicleName.includes(target) || target.includes(v.model.toLowerCase());
                });

                if (foundVehicle) {
                    setSelectedVehicle(foundVehicle.id);
                }
            }
        }
    }, [location.state, clients, vehicles]);

    // Resolved Client Object (Either from DB or Temporary Guest)
    const getClientForSimulation = (): Client | undefined => {
        if (simulationType === 'registered') {
            return clients.find(c => c.id === selectedClient);
        } else {
            // Create temporary guest client object
            if (!guestData.name || !guestData.cpf) return undefined;
            return {
                id: `guest-${Date.now()}`,
                name: guestData.name,
                cpf: guestData.cpf,
                income: 5000,
                score: Number(guestData.score),
                status: 'ACTIVE',
                email: 'nao_cadastrado@simulacao.com',
                phone: guestData.phone,
                birthDate: guestData.birthDate,
                address: { street: '', number: '', neighborhood: '', city: '', state: '', zipCode: '' },
                cnh: { hasCnh: guestData.hasCnh, categories: guestData.categories }
            };
        }
    };

    const client = getClientForSimulation();
    const vehicle = vehicles.find(v => v.id === selectedVehicle);

    const filteredClientsForDropdown = clients.filter(c =>
        c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
        c.cpf.includes(clientSearchTerm)
    );

    const filteredVehiclesForDropdown = vehicles.filter(v =>
        v.brand.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
        v.model.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
        v.plate.toLowerCase().includes(vehicleSearchTerm.toLowerCase())
    );

    const toggleBank = (id: string) => {
        if (selectedBanks.includes(id)) {
            setSelectedBanks(selectedBanks.filter(b => b !== id));
        } else {
            setSelectedBanks([...selectedBanks, id]);
        }
    };

    const toggleGuestCnhCategory = (cat: string) => {
        setGuestData(prev => {
            const currentCats = prev.categories;
            const newCats = currentCats.includes(cat)
                ? currentCats.filter(c => c !== cat)
                : [...currentCats, cat];
            return { ...prev, categories: newCats };
        });
    };

    const getScoreColor = (score: number) => {
        if (score >= 700) return 'success';
        if (score >= 500) return 'warning';
        return 'danger';
    };

    const startSimulation = async () => {
        if (!client || !vehicle) return;

        setStep(3); // Loading state

        // Split banks
        const rpaBankIds = ['6', '1', '2', '4', '5', '7', '9']; // C6 Bank(6), Itau(1), Bradesco(2), BV(4), Pan(5), Safra(7), Omni(9)
        const selectedRpaBanks = selectedBanks.filter(id => rpaBankIds.includes(id));
        const selectedMockBanks = selectedBanks.filter(id => !rpaBankIds.includes(id));

        // RPA Promise
        const rpaPromise = (async () => {
            if (selectedRpaBanks.length === 0) return [];
            try {
                console.log("Calling RPA Service for:", selectedRpaBanks);
                const rpaResults = await rpaService.simulate({
                    client,
                    vehicle: { ...vehicle, downPayment },
                    banks: selectedRpaBanks,
                    options: {
                        safraCoefficient,
                        dealerReturn: dealerReturn || 0,
                        bradescoReturn,
                        omniReturn,
                        itauReturn
                    }
                });
                // Map RPA results to SimulationOffer schema
                if (rpaResults && rpaResults.offers) {
                    return rpaResults.offers;
                }
                return [];
            } catch (error) {
                console.error("RPA Error:", error);
                return [];
            }
        })();

        // Mock Promise (Mock API Delay)
        const mockPromise = new Promise<SimulationOffer[]>(resolve => {
            setTimeout(() => {
                const results: SimulationOffer[] = selectedMockBanks.map(bankId => {
                    // Mock logic same as before
                    const isApproved = Math.random() < (client.score / 1000) + 0.2;
                    if (!isApproved) {
                        return {
                            bankId,
                            status: 'REJECTED',
                            reason: 'Política interna de crédito',
                            interestRate: 0,
                            maxInstallments: 0,
                            downPayment: 0,
                            installments: []
                        } as SimulationOffer; // Add assertion 
                    }
                    const rate = 1.5 + Math.random() * 2.5;
                    const financedAmount = vehicle.price - downPayment;
                    const calculatePMT = (months: number) => {
                        const i = rate / 100;
                        return (financedAmount * i * Math.pow(1 + i, months)) / (Math.pow(1 + i, months) - 1);
                    };
                    return {
                        bankId,
                        status: 'APPROVED',
                        interestRate: Number(rate.toFixed(2)),
                        maxInstallments: 60,
                        downPayment,
                        installments: [
                            { months: 24, value: calculatePMT(24) },
                            { months: 36, value: calculatePMT(36) },
                            { months: 48, value: calculatePMT(48) },
                            { months: 60, value: calculatePMT(60) },
                        ]
                    } as SimulationOffer; // Add assertion
                });
                resolve(results);
            }, 2500);
        });

        // Wait for both
        const [rpaOffers, mockOffers] = await Promise.all([rpaPromise, mockPromise]);
        const results = [...(mockOffers as SimulationOffer[]), ...(rpaOffers as SimulationOffer[])];

        setSimulationResults(results);

        // Update Client Score only if registered
        if (simulationType === 'registered') {
            const approvedCount = results.filter(r => r.status === 'APPROVED').length;
            const totalSimulated = results.length;
            if (totalSimulated > 0) {
                const newScore = Math.round((approvedCount / totalSimulated) * 1000);
                updateClientScore(client.id, newScore);
            }
        }

        // Save simulation to history
        try {
            await salesService.logSimulation({
                clientId: simulationType === 'registered' ? client.id : undefined,
                clientName: client.name,
                clientCpf: client.cpf,
                vehicleId: vehicle.id,
                vehicleDescription: `${vehicle.brand} ${vehicle.model} - ${vehicle.plate}`.trim(),
                bankId: 'MULTIBANK',
                bankName: 'Múltiplos Bancos',
                status: results.some(r => r.status === 'APPROVED') ? 'APPROVED' : 'REJECTED',
                resultData: { offers: results }
            });
        } catch (error) {
            console.error("Failed to log simulation", error);
        }

        setStep(4); // Show Results
    };

    const handleFinalizeSale = (offer: SimulationOffer) => {
        if (!vehicle) return;
        setFinalizedOffer(offer);
        setVehicles(prev => prev.map(v =>
            v.id === vehicle.id ? { ...v, status: 'SOLD' } : v
        ));
        setShowSuccessModal(true);
    };

    const getBestOffer = () => {
        const approved = simulationResults.filter(r => r.status === 'APPROVED');
        if (approved.length === 0) return null;

        // Função auxiliar para encontrar o valor da menor parcela dentro de uma oferta
        const getLowestInstallment = (offer: SimulationOffer) => {
            if (!offer.installments || offer.installments.length === 0) return Infinity;
            return Math.min(...offer.installments.map(i => i.value));
        };

        // Compara qual banco tem a parcela com o menor valor absoluto
        return approved.reduce((prev, curr) => {
            const minPrev = getLowestInstallment(prev);
            const minCurr = getLowestInstallment(curr);
            return minCurr < minPrev ? curr : prev;
        });
    };

    const bestOffer = getBestOffer();

    // Simplified JSX Structure for Readability 
    // Copied most logic from App.tsx but cleaned up inline styles where possible to use standard Tailwind classes
    return (
        <div className="space-y-6 animate-fade-in pb-20 p-6">
            <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900">Nova Simulação Multibanco</h1>
                <p className="text-slate-500 text-sm">Encontre a melhor taxa para o seu cliente em segundos.</p>
            </div>

            {/* Progress Steps */}
            <div className="overflow-x-auto pb-2">
                <div className="flex items-center justify-between px-4 md:px-10 py-4 bg-white rounded-xl border border-slate-100 mb-4 md:mb-8 min-w-[500px]">
                    {[
                        { id: 1, label: 'Dados' },
                        { id: 2, label: 'Bancos' },
                        { id: 3, label: 'Análise' },
                        { id: 4, label: 'Ofertas' }
                    ].map((s, idx) => (
                        <div key={s.id} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= s.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {s.id}
                            </div>
                            <span className={`ml-2 text-sm font-medium ${step >= s.id ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</span>
                            {idx < 3 && <div className="w-8 md:w-12 h-0.5 mx-2 md:mx-4 bg-slate-100"></div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Step 1: Selection */}
            {step === 1 && (
                <Card className="p-4 md:p-8 max-w-4xl mx-auto">
                    <h2 className="text-lg font-bold text-slate-900 mb-6">Selecione Cliente e Veículo</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center h-8 mb-1">
                                <label className="block text-sm font-semibold text-slate-700">Cliente</label>
                                <div className="flex p-1 bg-slate-100 rounded-lg">
                                    <button
                                        className={`text-[10px] px-2 py-1 rounded font-bold transition-all ${simulationType === 'registered' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                                        onClick={() => setSimulationType('registered')}
                                    >
                                        Cadastrado
                                    </button>
                                    <button
                                        className={`text-[10px] px-2 py-1 rounded font-bold transition-all ${simulationType === 'guest' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500'}`}
                                        onClick={() => setSimulationType('guest')}
                                    >
                                        Rápido
                                    </button>
                                </div>
                            </div>

                            {simulationType === 'registered' ? (
                                <div className="space-y-2 relative">
                                    <div
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center cursor-pointer hover:border-emerald-400 transition-colors h-[46px]"
                                        onClick={() => {
                                            setIsClientDropdownOpen(!isClientDropdownOpen);
                                            if (!isClientDropdownOpen) setClientSearchTerm('');
                                        }}
                                    >
                                        {selectedClient ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                                                    {clients.find(c => c.id === selectedClient)?.name?.charAt(0)}
                                                </div>
                                                <span className="text-sm font-medium text-slate-900">{clients.find(c => c.id === selectedClient)?.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-slate-500">Selecione um cliente...</span>
                                        )}
                                        <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
                                    </div>
                                    {isClientDropdownOpen && (
                                        <div className="absolute z-20 top-full left-0 w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 overflow-hidden animate-fade-in">
                                            <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                                                <input
                                                    autoFocus
                                                    className="w-full pl-3 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                                    placeholder="🔍 Buscar por nome ou CPF..."
                                                    value={clientSearchTerm}
                                                    onChange={e => setClientSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <div className="max-h-72 overflow-y-auto">
                                                {filteredClientsForDropdown.length === 0 ? (
                                                    <div className="p-6 text-center text-slate-400">
                                                        <p className="text-sm">Nenhum cliente encontrado</p>
                                                    </div>
                                                ) : (
                                                    filteredClientsForDropdown.map(c => (
                                                        <div
                                                            key={c.id}
                                                            className={`p-3 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 flex items-center gap-3 transition-colors ${selectedClient === c.id ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : ''}`}
                                                            onClick={() => {
                                                                setSelectedClient(c.id);
                                                                setIsClientDropdownOpen(false);
                                                            }}
                                                        >
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-sm font-bold shadow-md">
                                                                {c.name?.charAt(0)}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                                                                <p className="text-xs text-slate-400 font-mono">{c.cpf}</p>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1">
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(c.score || 0) >= 700 ? 'bg-emerald-100 text-emerald-700' :
                                                                    (c.score || 0) >= 500 ? 'bg-amber-100 text-amber-700' :
                                                                        'bg-red-100 text-red-700'
                                                                    }`}>
                                                                    {c.score || 0}
                                                                </span>
                                                                {c.cnh?.hasCnh && (
                                                                    <span className="text-[10px] text-slate-400">CNH ✓</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                            <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                                                <span className="text-xs text-slate-400">{filteredClientsForDropdown.length} cliente(s)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-100">
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input label="Nome" value={guestData.name} onChange={(e: any) => setGuestData({ ...guestData, name: e.target.value })} required />
                                        <Input label="CPF" value={guestData.cpf} onChange={(e: any) => setGuestData({ ...guestData, cpf: e.target.value })} required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input label="Data de Nascimento" type="date" value={guestData.birthDate} onChange={(e: any) => setGuestData({ ...guestData, birthDate: e.target.value })} />
                                        <Input label="Telefone" value={guestData.phone} onChange={(e: any) => setGuestData({ ...guestData, phone: e.target.value })} />
                                    </div>
                                    <div className="pt-1">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={guestData.hasCnh}
                                                onChange={e => setGuestData({ ...guestData, hasCnh: e.target.checked, categories: e.target.checked ? guestData.categories : [] })}
                                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                            />
                                            <span className="text-sm font-medium text-slate-700">Possui CNH?</span>
                                        </label>

                                        {guestData.hasCnh && (
                                            <div className="flex gap-2 mt-2">
                                                {['A', 'B', 'C', 'D', 'E'].map(cat => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => {
                                                            const currentCats = guestData.categories;
                                                            const newCats = currentCats.includes(cat)
                                                                ? currentCats.filter(c => c !== cat)
                                                                : [...currentCats, cat];
                                                            setGuestData({ ...guestData, categories: newCats });
                                                        }}
                                                        className={`w-9 h-9 rounded font-bold text-sm transition-colors ${guestData.categories.includes(cat)
                                                            ? 'bg-emerald-500 text-white shadow-md'
                                                            : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="h-8 mb-1 flex items-center">
                                <label className="block text-sm font-semibold text-slate-700">Veículo da Loja</label>
                            </div>
                            <div className="space-y-2 relative">
                                <div
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center cursor-pointer hover:border-emerald-400 transition-colors h-[46px]"
                                    onClick={() => {
                                        setIsVehicleDropdownOpen(!isVehicleDropdownOpen);
                                        if (!isVehicleDropdownOpen) setVehicleSearchTerm('');
                                    }}
                                >
                                    {selectedVehicle ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded bg-slate-200 overflow-hidden flex-shrink-0">
                                                <img src={vehicles.find(v => v.id === selectedVehicle)?.images?.[0]} className="w-full h-full object-cover" alt="" />
                                            </div>
                                            <span className="text-sm font-medium text-slate-900">{vehicles.find(v => v.id === selectedVehicle)?.brand} {vehicles.find(v => v.id === selectedVehicle)?.model}</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-slate-500">Selecione um veículo...</span>
                                    )}
                                    <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
                                </div>
                                {isVehicleDropdownOpen && (
                                    <div className="absolute z-20 top-full left-0 w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 overflow-hidden animate-fade-in">
                                        <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                                            <input
                                                autoFocus
                                                className="w-full pl-3 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                                placeholder="🔍 Buscar marca, modelo ou placa..."
                                                value={vehicleSearchTerm}
                                                onChange={e => setVehicleSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <div className="max-h-72 overflow-y-auto">
                                            {filteredVehiclesForDropdown.length === 0 ? (
                                                <div className="p-6 text-center text-slate-400">
                                                    <p className="text-sm">Nenhum veículo encontrado</p>
                                                </div>
                                            ) : (
                                                filteredVehiclesForDropdown.map(v => (
                                                    <div
                                                        key={v.id}
                                                        className={`p-3 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 flex items-center gap-3 transition-colors ${selectedVehicle === v.id ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : ''}`}
                                                        onClick={() => {
                                                            setSelectedVehicle(v.id);
                                                            setIsVehicleDropdownOpen(false);
                                                        }}
                                                    >
                                                        <div className="w-14 h-10 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 shadow-sm">
                                                            <img src={v.images?.[0] || 'https://via.placeholder.com/100'} className="w-full h-full object-cover" alt="" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-slate-800 truncate">{v.brand} {v.model}</p>
                                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded">{v.year}</span>
                                                                <span>•</span>
                                                                <span>{v.mileage?.toLocaleString()} km</span>
                                                                <span>•</span>
                                                                <span className="font-mono text-slate-500">{v.plate}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-sm font-bold text-emerald-600">
                                                                R$ {v.price?.toLocaleString('pt-BR')}
                                                            </span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${v.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700' :
                                                                v.status === 'RESERVED' ? 'bg-amber-100 text-amber-700' :
                                                                    'bg-slate-100 text-slate-500'
                                                                }`}>
                                                                {v.status === 'AVAILABLE' ? 'Disponível' : v.status === 'RESERVED' ? 'Reservado' : 'Vendido'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                                            <span className="text-xs text-slate-400">{filteredVehiclesForDropdown.length} veículo(s) disponível(is)</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {vehicle && (
                        <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                            <div className="flex gap-4">
                                <div className="w-24 h-20 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                                    <img src={vehicle.images[0]} className="w-full h-full object-cover" alt="" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{vehicle.brand} {vehicle.model}</h3>
                                    <p className="text-xs text-slate-500 mb-1">{vehicle.year} • {vehicle.mileage.toLocaleString()} km</p>
                                    <Badge variant="neutral">{vehicle.plate}</Badge>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center">
                                <label className="text-xs font-semibold text-slate-500 uppercase mb-1">Entrada Sugerida</label>
                                <div className="flex gap-2 items-center">
                                    <span className="text-xs font-bold text-slate-400">R$</span>
                                    <input
                                        type="number"
                                        className="bg-white border border-slate-300 rounded px-2 py-1 w-32 font-bold text-slate-900"
                                        value={downPayment}
                                        onChange={(e) => setDownPayment(Number(e.target.value))}
                                    />
                                    <span className="text-xs text-slate-400 ml-2">
                                        ({Math.round((downPayment / vehicle.price) * 100)}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 flex justify-end">
                        <Button
                            disabled={!client || !vehicle}
                            onClick={() => setStep(2)}
                            icon={<ChevronDown className="rotate-[-90deg] w-4 h-4" />}
                        >
                            Continuar
                        </Button>
                    </div>
                </Card>
            )}

            {/* Step 2: Banks */}
            {step === 2 && (
                <Card className="p-4 md:p-8 max-w-4xl mx-auto">
                    <h2 className="text-lg font-bold text-slate-900 mb-6">Selecione os Bancos</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {activeBanks.map(bank => (
                            <div
                                key={bank.id}
                                onClick={() => toggleBank(bank.id)}
                                className={`cursor-pointer p-4 rounded-xl border-2 flex flex-col items-center gap-3 relative transition-all ${selectedBanks.includes(bank.id) ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 hover:border-slate-200'}`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${bank.color}`}>
                                    {bank.logoInitial}
                                </div>
                                <span className="font-medium text-slate-900 text-sm text-center">{bank.name}</span>

                                {bank.id === '6' && selectedBanks.includes('6') && (
                                    <div className="animate-fade-in mt-1 w-full" onClick={(e) => e.stopPropagation()}>
                                        <select
                                            className="w-full text-xs p-1.5 border border-emerald-200 rounded text-emerald-800 bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                                            value={dealerReturn}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                setDealerReturn(e.target.value);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <option value="R0">R0 (0%)</option>
                                            <option value="R1">R1 (1%)</option>
                                            <option value="R2">R2 (2%)</option>
                                            <option value="R3">R3 (3%)</option>
                                            <option value="R4">R4 (4%)</option>
                                            <option value="R5">R5 (5%)</option>
                                            <option value="R6">R6 (6%)</option>
                                        </select>
                                    </div>
                                )}

                                {bank.id === '7' && selectedBanks.includes('7') && (
                                    <div className="animate-fade-in mt-1 w-full" onClick={(e) => e.stopPropagation()}>
                                        <select
                                            className="w-full text-xs p-1.5 border border-emerald-200 rounded text-emerald-800 bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                                            value={safraCoefficient}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                setSafraCoefficient(e.target.value);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <option value="R0">R0</option>
                                            <option value="R1">R1</option>
                                            <option value="R2">R2</option>
                                            <option value="R3">R3</option>
                                            <option value="R4">R4</option>
                                            <option value="R5">R5</option>
                                        </select>
                                    </div>
                                )}

                                {bank.id === '2' && selectedBanks.includes('2') && (
                                    <div className="animate-fade-in mt-1 w-full" onClick={(e) => e.stopPropagation()}>
                                        <select
                                            className="w-full text-xs p-1.5 border border-emerald-200 rounded text-emerald-800 bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                                            value={bradescoReturn}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                setBradescoReturn(e.target.value);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <option value="0">R0 (0%)</option>
                                            <option value="1">R1 (1%)</option>
                                            <option value="2">R2 (2%)</option>
                                            <option value="3">R3 (3%)</option>
                                            <option value="4">R4 (4%)</option>
                                            <option value="5">R5 (5%)</option>
                                            <option value="6">R6 (6%)</option>
                                        </select>
                                    </div>
                                )}

                                {bank.id === '9' && selectedBanks.includes('9') && (
                                    <div className="animate-fade-in mt-1 w-full" onClick={(e) => e.stopPropagation()}>
                                        <select
                                            className="w-full text-xs p-1.5 border border-emerald-200 rounded text-emerald-800 bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                                            value={omniReturn}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                setOmniReturn(e.target.value);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <option value="0">R0 (0%)</option>
                                            <option value="1">R1 (1%)</option>
                                            <option value="2">R2 (2%)</option>
                                            <option value="3">R3 (3%)</option>
                                            <option value="4">R4 (4%)</option>
                                            <option value="5">R5 (5%)</option>
                                        </select>
                                    </div>
                                )}

                                {bank.id === '1' && selectedBanks.includes('1') && (
                                    <div className="animate-fade-in mt-1 w-full" onClick={(e) => e.stopPropagation()}>
                                        <select
                                            className="w-full text-xs p-1.5 border border-emerald-200 rounded text-emerald-800 bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                                            value={itauReturn}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                setItauReturn(e.target.value);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <option value="0">R0 (0%)</option>
                                            <option value="1">R1 (1%)</option>
                                            <option value="2">R2 (2%)</option>
                                            <option value="3">R3 (3%)</option>
                                            <option value="4">R4 (4%)</option>
                                        </select>
                                    </div>
                                )}

                                <div className="absolute top-3 right-3">
                                    {selectedBanks.includes(bank.id)
                                        ? <CheckSquare className="text-emerald-500 w-5 h-5" />
                                        : <Square className="text-slate-300 w-5 h-5" />
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-8 flex justify-between">
                        <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
                        <Button
                            disabled={selectedBanks.length === 0}
                            onClick={startSimulation}
                            icon={<PlayCircle className="w-4 h-4" />}
                        >
                            Iniciar Simulação
                        </Button>
                    </div>
                </Card>
            )}

            {/* Step 3: Loading */}
            {step === 3 && (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full border-4 border-slate-100 border-t-emerald-500 animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap className="text-emerald-500 w-8 h-8 animate-pulse" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mt-6">Analisando Perfil...</h2>
                    <p className="text-slate-500 mt-2 max-w-md">Conectando com as instituições financeiras e buscando as melhores taxas.</p>
                </div>
            )}

            {/* Step 4: Results */}
            {step === 4 && (
                <div className="space-y-8 animate-fade-in">

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Details Card */}
                        <div className="space-y-6">
                            <Card className="p-6">
                                <h3 className="font-bold text-slate-900 mb-4">Detalhes</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between border-b border-slate-100 pb-2">
                                        <span className="text-slate-500 text-sm">Cliente</span>
                                        <span className="font-medium text-slate-900 text-sm">{client?.name}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 pb-2">
                                        <span className="text-slate-500 text-sm">Score</span>
                                        <Badge variant={getScoreColor(client!.score)}>{client?.score}</Badge>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 pb-2">
                                        <span className="text-slate-500 text-sm">Veículo</span>
                                        <span className="font-medium text-slate-900 text-sm">{vehicle?.brand} {vehicle?.model}</span>
                                    </div>
                                </div>
                                <Button variant="outline" className="w-full mt-6" onClick={() => setSimulationState(null)}>Nova Simulação</Button>
                            </Card>
                        </div>

                        {/* Offers */}
                        <div className="lg:col-span-2 space-y-4">
                            {simulationResults.sort((a, b) => {
                                if (a.status === 'APPROVED' && b.status !== 'APPROVED') return -1;
                                if (a.status !== 'APPROVED' && b.status === 'APPROVED') return 1;
                                return a.interestRate - b.interestRate;
                            }).map(offer => {
                                const bank = BANKS.find(b => b.id === offer.bankId)!;
                                const isBest = bestOffer?.bankId === offer.bankId;

                                return (
                                    <Card key={offer.bankId} className={`relative overflow-hidden transition-all ${offer.status === 'APPROVED' ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-red-500 opacity-80'}`}>
                                        {isBest && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">Melhor Oferta</div>}
                                        <div className="p-6">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${bank.color}`}>{bank.logoInitial}</div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900">{bank.name}</h4>
                                                        <p className="text-xs text-slate-500">{offer.status === 'APPROVED' ? 'Crédito Pré-Aprovado' : 'Proposta Recusada'}</p>
                                                    </div>
                                                </div>
                                                <Badge variant={offer.status === 'APPROVED' ? 'success' : 'danger'}>{offer.status === 'APPROVED' ? 'Aprovado' : 'Reprovado'}</Badge>
                                            </div>

                                            {offer.status === 'APPROVED' ? (
                                                <div className="col-span-2 md:col-span-4 mt-4">
                                                    <p className="text-xs font-bold text-slate-500 uppercase mb-3">Opções de Parcelamento</p>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                        {offer.installments.sort((a, b) => b.months - a.months).map((inst) => (
                                                            <div
                                                                key={inst.months}
                                                                onClick={() => handleFinalizeSale(offer)}
                                                                className={`p-3 rounded-lg border cursor-pointer hover:border-emerald-500 transition-all relative overflow-hidden group ${inst.hasHighChance ? 'bg-emerald-50/50 border-emerald-200 ring-1 ring-emerald-100' : 'bg-white border-slate-100'}`}
                                                            >
                                                                {inst.hasHighChance && (
                                                                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg z-10">
                                                                        Alta Chance
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-baseline gap-1">
                                                                        <span className="text-lg font-bold text-slate-900">{inst.months}x</span>
                                                                        <span className="text-sm font-bold text-emerald-600">R$ {inst.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                    {inst.interestRate ? (
                                                                        <p className="text-[10px] text-slate-400 font-medium">{inst.interestRate.toFixed(2)}% a.m.</p>
                                                                    ) : (
                                                                        <p className="text-[10px] text-slate-300">-</p>
                                                                    )}
                                                                </div>
                                                                <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-2 right-2">
                                                                    <div className="bg-emerald-500 text-white p-1 rounded-full shadow-sm">
                                                                        <CheckCircle2 size={12} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-red-50 p-3 rounded-lg text-red-700 text-sm flex items-center gap-2">
                                                    <AlertCircle size={16} /> Motivo: {offer.reason}
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            <Modal isOpen={showSuccessModal} onClose={() => { }} title="">
                <div className="flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
                        <PartyPopper className="text-emerald-600 w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Venda Confirmada!</h2>
                    <p className="text-slate-500 mb-8 max-w-sm">Parabéns! O veículo foi marcado como vendido.</p>
                    <div className="flex gap-3 w-full">
                        <Button variant="outline" className="flex-1" onClick={() => { setShowSuccessModal(false); navigate('/vehicles'); }}>Ver Estoque</Button>
                        <Button variant="primary" className="flex-1" onClick={() => { setShowSuccessModal(false); navigate('/'); }}>Dashboard</Button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};
