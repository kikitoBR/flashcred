
import React, { useState, useEffect } from 'react';
import { CheckCircle2, Car, Calendar, User, Building2, Wallet } from 'lucide-react';
import { Vehicle, Client } from '../types';
import { Button, Input, Modal } from './ui';

interface SaleRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle?: Vehicle | null; // Pode ser opcional agora
    vehicles?: Vehicle[]; // Lista de veículos para seleção
    clients: Client[];
    onConfirm: (saleData: any) => void;
}

export const SaleRegistrationModal: React.FC<SaleRegistrationModalProps> = ({
    isOpen,
    onClose,
    vehicle: preSelectedVehicle,
    vehicles = [],
    clients,
    onConfirm
}) => {
    // Form States
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [clientId, setClientId] = useState('');
    const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState<'FINANCING' | 'CASH' | 'CONSORTIUM'>('FINANCING');

    // Financial Details
    const [totalValue, setTotalValue] = useState('');
    const [downPayment, setDownPayment] = useState('');
    const [financedValue, setFinancedValue] = useState('');
    const [installments, setInstallments] = useState('48');
    const [bankName, setBankName] = useState('C6 Bank');
    const [monthlyPayment, setMonthlyPayment] = useState('');

    // Update form when modal opens or vehicle changes
    useEffect(() => {
        if (isOpen) {
            if (preSelectedVehicle) {
                setSelectedVehicleId(preSelectedVehicle.id);
                setTotalValue(preSelectedVehicle.price.toString());
            } else {
                setSelectedVehicleId('');
                setTotalValue('');
            }
            setClientId('');
            setSaleDate(new Date().toISOString().split('T')[0]);
            setPaymentMethod('FINANCING');
            setDownPayment('');
            setFinancedValue('');
            setInstallments('48');
            setBankName('C6 Bank');
            setMonthlyPayment('');
        }
    }, [isOpen, preSelectedVehicle]);

    // Calcular financiado automaticamente
    useEffect(() => {
        const total = Number(totalValue) || 0;
        const entry = Number(downPayment) || 0;
        if (paymentMethod === 'FINANCING') {
            setFinancedValue((total - entry).toString());
        } else {
            setFinancedValue('0');
        }
    }, [totalValue, downPayment, paymentMethod]);

    const getSelectedVehicle = () => {
        if (preSelectedVehicle) return preSelectedVehicle;
        return vehicles.find(v => v.id === selectedVehicleId);
    };

    const currentVehicle = getSelectedVehicle();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const selectedClient = clients.find(c => c.id === clientId);
        if (!selectedClient || !currentVehicle) return;

        const saleData = {
            clientId: selectedClient.id,
            clientName: selectedClient.name,
            clientCpf: selectedClient.cpf,
            vehicleId: currentVehicle.id,
            vehicleDescription: `${currentVehicle.brand} ${currentVehicle.model}`,
            bankId: paymentMethod === 'FINANCING' ? bankName.toLowerCase().replace(/\s/g, '-') : 'proprio',
            bankName: paymentMethod === 'FINANCING' ? bankName : 'Próprio',
            financedValue: Number(financedValue),
            downPayment: Number(downPayment),
            installments: paymentMethod === 'FINANCING' ? Number(installments) : 1,
            monthlyPayment: Number(monthlyPayment),
            interestRate: 0, // Não estamos capturando isso ainda
            status: 'FINALIZED',
            saleDate: saleDate
        };

        onConfirm(saleData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Registrar Venda Manualmente" className="max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Seção 1: Veículo e Cliente */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Veículo</label>
                        {preSelectedVehicle ? (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3">
                                <Car className="w-5 h-5 text-slate-400" />
                                <div>
                                    <p className="text-sm font-medium text-slate-900">{preSelectedVehicle.brand} {preSelectedVehicle.model}</p>
                                    <p className="text-xs text-slate-500">{preSelectedVehicle.plate}</p>
                                </div>
                            </div>
                        ) : (
                            <select
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                value={selectedVehicleId}
                                onChange={(e) => {
                                    setSelectedVehicleId(e.target.value);
                                    const v = vehicles.find(veh => veh.id === e.target.value);
                                    if (v) setTotalValue(v.price.toString());
                                }}
                                required
                            >
                                <option value="">Selecione o veículo...</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.brand} {v.model} - {v.plate}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Cliente</label>
                        <select
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            required
                        >
                            <option value="">Selecione o cliente...</option>
                            {clients.filter(c => c.status === 'ACTIVE').map(client => (
                                <option key={client.id} value={client.id}>{client.name} - {client.cpf}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Seção 2: Detalhes da Venda */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-emerald-600" />
                        Detalhes do Pagamento
                    </h3>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-3">
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Forma de Pagamento</label>
                            <div className="flex gap-2">
                                {[
                                    { id: 'FINANCING', label: 'Financiamento' },
                                    { id: 'CASH', label: 'À Vista' },
                                    { id: 'CONSORTIUM', label: 'Consórcio' },
                                ].map((method) => (
                                    <button
                                        key={method.id}
                                        type="button"
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${paymentMethod === method.id
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200'
                                            }`}
                                        onClick={() => setPaymentMethod(method.id as any)}
                                    >
                                        {method.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Input
                            label="Valor Total (R$)"
                            type="number"
                            value={totalValue}
                            onChange={(e: any) => setTotalValue(e.target.value)}
                            required
                        />

                        <Input
                            label="Valor de Entrada (R$)"
                            type="number"
                            value={downPayment}
                            onChange={(e: any) => setDownPayment(e.target.value)}
                        />

                        <Input
                            label="Data da Venda"
                            type="date"
                            value={saleDate}
                            onChange={(e: any) => setSaleDate(e.target.value)}
                            required
                        />
                    </div>

                    {paymentMethod === 'FINANCING' && (
                        <div className="pt-4 border-t border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Banco</label>
                                <select
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                >
                                    <option>C6 Bank</option>
                                    <option>Banco Pan</option>
                                    <option>Santander</option>
                                    <option>Bradesco Financiamentos</option>
                                    <option>BV Financeira</option>
                                    <option>Itaú</option>
                                    <option>Outro</option>
                                </select>
                            </div>

                            <Input
                                label="Parcelas"
                                type="number"
                                value={installments}
                                onChange={(e: any) => setInstallments(e.target.value)}
                            />

                            <Input
                                label="Valor Parcela"
                                type="number"
                                value={monthlyPayment}
                                onChange={(e: any) => setMonthlyPayment(e.target.value)}
                                placeholder="0,00"
                            />
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" variant="success" icon={<CheckCircle2 className="w-4 h-4" />}>
                        Confirmar Venda
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
