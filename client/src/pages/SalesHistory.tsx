
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    History, Search, Filter, RefreshCw, DollarSign, Calendar, User, Car, Building2, TrendingUp, Download, Plus
} from 'lucide-react';
import { Button, Card, Badge } from '../components/ui';
import { SaleRegistrationModal } from '../components/SaleRegistrationModal';
import { salesService, clientService, vehicleService } from '../services/api';
import { Sale, Client, Vehicle } from '../types';

export const SalesHistory = () => {
    const navigate = useNavigate();
    const [sales, setSales] = useState<Sale[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [salesData, clientsData, vehiclesData] = await Promise.all([
                salesService.getAll(),
                clientService.getAll(),
                vehicleService.getAll()
            ]);
            setSales(salesData);
            setClients(clientsData);
            setVehicles(vehiclesData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateSale = async (saleData: any) => {
        try {
            await salesService.create(saleData);
            setIsModalOpen(false);
            fetchData(); // Refresh list
        } catch (error) {
            console.error('Error creating sale:', error);
            alert('Erro ao registrar venda');
        }
    };

    // Filter sales
    const filteredSales = sales.filter(sale => {
        const matchesSearch = sale.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sale.client_cpf?.includes(searchTerm) ||
            sale.vehicle_description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Calculate totals
    const totalFinanced = filteredSales.reduce((acc, sale) => acc + (sale.financed_value || 0), 0);
    const totalCount = filteredSales.length;

    // Simplificando o filtro de aprovados para evitar erro de tipos/dados ausentes
    const approvedCount = filteredSales.filter(s => s.status === 'FINALIZED' || s.status === 'APPROVED').length;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (date: string) => {
        if (!date) return 'N/A';
        // Ajuste para evitar problemas com timezones se vier só a data YYYY-MM-DD
        const d = new Date(date);
        return d.toLocaleDateString('pt-BR');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'FINALIZED':
                return <Badge variant="success">Finalizado</Badge>;
            case 'APPROVED':
                return <Badge variant="brand">Aprovado</Badge>;
            case 'PENDING':
                return <Badge variant="warning">Pendente</Badge>;
            case 'REJECTED':
                return <Badge variant="danger">Rejeitado</Badge>;
            default:
                return <Badge variant="neutral">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <History className="w-6 h-6 text-emerald-600" />
                        Histórico de Vendas
                    </h1>
                    <p className="text-slate-500 text-sm">Acompanhe todas as vendas realizadas</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />} onClick={fetchData}>
                        Atualizar
                    </Button>
                    <Button
                        variant="brand"
                        icon={<Plus className="w-4 h-4" />}
                        onClick={() => setIsModalOpen(true)}
                    >
                        Nova Venda
                    </Button>
                </div>
            </div>

            {/* KPI Card */}
            <div className="flex">
                <Card className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-emerald-100 text-xs uppercase font-medium">Total de Vendas</p>
                            <p className="text-2xl font-bold">{totalCount}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por cliente, CPF ou veículo..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                        className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Todos os Status</option>
                        <option value="FINALIZED">Finalizado</option>
                        <option value="APPROVED">Aprovado</option>
                        <option value="PENDING">Pendente</option>
                        <option value="REJECTED">Rejeitado</option>
                    </select>
                </div>
            </div>

            {/* Sales Table */}
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">Cliente</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">Veículo</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">Banco</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase text-right">Valor</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase text-center">Parcelas</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase text-center">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">Data</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <RefreshCw className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-spin" />
                                        <p className="text-slate-500">Carregando vendas...</p>
                                    </td>
                                </tr>
                            ) : filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-500 font-medium">Nenhuma venda encontrada</p>
                                        <p className="text-slate-400 text-sm">Registre uma nova venda manualmente ou via simulação.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredSales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white font-bold text-xs">
                                                    {sale.client_name?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900 text-sm">{sale.client_name}</p>
                                                    <p className="text-xs text-slate-500 font-mono">{sale.client_cpf}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Car className="w-4 h-4 text-slate-400" />
                                                <span className="text-sm text-slate-700">{sale.vehicle_description}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-slate-400" />
                                                <span className="text-sm text-slate-700">{sale.bank_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <p className="font-bold text-slate-900">{formatCurrency(sale.financed_value)}</p>
                                            {sale.monthly_payment > 0 && (
                                                <p className="text-xs text-slate-500">{formatCurrency(sale.monthly_payment)}/mês</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 font-bold text-slate-700">
                                                {sale.installments}x
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {getStatusBadge(sale.status)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                                                <Calendar className="w-4 h-4" />
                                                {formatDate(sale.sale_date || sale.created_at || '')}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredSales.length > 0 && (
                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                        Mostrando {filteredSales.length} venda(s)
                    </div>
                )}
            </Card>

            <SaleRegistrationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                clients={clients}
                vehicles={vehicles} // Passando a lista completa
                onConfirm={handleCreateSale}
            />
        </div>
    );
};
