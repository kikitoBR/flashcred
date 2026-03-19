
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    History, Search, ArrowUpDown, ArrowUp, ArrowDown, Zap, PhoneCall, RefreshCw,
    User, Phone, Mail, Car, PlayCircle, Printer, TrendingUp, FileText, MessageCircle, Eye
} from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip,
    BarChart, Bar, Legend
} from 'recharts';
import { Button, Card, Badge, Input, Modal } from '../components/ui';
import { salesService, interactionsService } from '../services/api';
import { getWhatsAppLink, generateMessage } from '../utils/whatsapp';
import { BANKS } from '../../constants';

export const Statistics = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'remarketing' | 'retry'>('remarketing');
    const [loading, setLoading] = useState(true);

    // Modal for Client Details
    const [isOppModalOpen, setIsOppModalOpen] = useState(false);
    const [selectedOppClient, setSelectedOppClient] = useState<any>(null);

    // Modal for Simulation Details
    const [isSimModalOpen, setIsSimModalOpen] = useState(false);
    const [selectedSimulation, setSelectedSimulation] = useState<any>(null);

    // State for History Table
    const [historySearch, setHistorySearch] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // State for Opportunities (Remarketing/Retry) Table
    const [oppSearch, setOppSearch] = useState('');
    const [oppSortConfig, setOppSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // Export PDF State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportStartDate, setExportStartDate] = useState('2023-01-01');
    const [exportEndDate, setExportEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Data State
    const [salesData, setSalesData] = useState<any[]>([]);
    const [bankPerformanceData, setBankPerformanceData] = useState<any[]>([]);
    const [remarketingList, setRemarketingList] = useState<any[]>([]);
    const [retryList, setRetryList] = useState<any[]>([]);
    const [simulationHistory, setSimulationHistory] = useState<any[]>([]);
    const [kpiData, setKpiData] = useState({ totalSims: 0, todaySims: 0, todayApprovals: 0, totalFinanced: 0 });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [stats, simulations, opportunities] = await Promise.all([
                salesService.getStats(),
                salesService.getSimulations(),
                salesService.getOpportunities()
            ]);

            setSalesData(stats.monthlyPerformance || []);
            setBankPerformanceData(stats.bankPerformance || []);
            setKpiData({
                totalSims: stats.totalSimulations || 0,
                todaySims: stats.todaySimulations,
                todayApprovals: stats.todayApprovals,
                totalFinanced: stats.totalFinanced
            });

            // Map and format simulation history
            if (Array.isArray(simulations)) {
                setSimulationHistory(simulations.map((s: any) => {
                    let parsedResult = s.result_data;
                    if (typeof parsedResult === 'string') {
                        try { parsedResult = JSON.parse(parsedResult); } catch (e) { parsedResult = {}; }
                    }
                    return {
                        id: s.id,
                        client: s.client_name,
                        vehicle: s.vehicle_description,
                        date: s.created_at || '',
                        status: s.status,
                        bank: (() => {
                            const b = s.bank_name || '';
                            if (b.includes(',')) {
                                const banks = b.split(',').map((x: string) => x.trim()).filter(Boolean);
                                if (banks.length > 2) return 'Múltiplos Bancos';
                                return banks.join(', ');
                            }
                            return b;
                        })(),
                        resultData: parsedResult
                    };
                }));
            }

            if (opportunities) {
                setRemarketingList(opportunities.remarketing || []);
                setRetryList(opportunities.retry || []);
            }

        } catch (error) {
            console.error("Error fetching statistics:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenClientDetails = (client: any) => {
        setSelectedOppClient(client);
        setIsOppModalOpen(true);
    };

    const handleSimulateAgain = (clientData: any) => {
        navigate('/simulation', {
            state: {
                preSelectedClient: {
                    name: clientData.name,
                    cpf: clientData.cpf,
                    phone: clientData.phone,
                    score: clientData.newScore || clientData.score || 500
                },
                preSelectedVehicleModel: clientData.car
            }
        });
    };

    const handleContact = async (clientData: any, type: 'remarketing' | 'retry') => {
        const message = generateMessage('FOLLOWUP', {
            clientName: clientData.name,
            vehicle: clientData.car
        });

        const link = getWhatsAppLink(clientData.phone || '00000000000', message);

        // Log interaction in background
        try {
            await interactionsService.create({
                clientId: clientData.id, // Ensure ID allows this, might need to fix if ID is simulation ID vs Client ID
                type: 'WHATSAPP',
                note: `Enviou mensagem de ${type}: ${message}`
            });
        } catch (err) {
            console.error('Failed to log interaction', err);
        }

        window.open(link, '_blank');
    };

    const handleExportClick = () => {
        setIsExportModalOpen(true);
    };

    const handleConfirmExport = () => {
        setIsExportModalOpen(false);
        setTimeout(() => {
            window.print();
        }, 300);
    };

    // --- History Logic ---
    const filteredHistory = simulationHistory
        .filter(item => {
            const matchesSearch =
                (item.client || '').toLowerCase().includes(historySearch.toLowerCase()) ||
                (item.vehicle || '').toLowerCase().includes(historySearch.toLowerCase()) ||
                (item.bank || '').toLowerCase().includes(historySearch.toLowerCase());

            const matchesStatus = historyStatusFilter === 'ALL' || item.status === historyStatusFilter;

            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            // @ts-ignore
            const aValue = a[key] || '';
            // @ts-ignore
            const bValue = b[key] || '';
            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <ArrowUpDown size={14} className="text-slate-300 ml-1 inline" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} className="text-emerald-600 ml-1 inline" />
            : <ArrowDown size={14} className="text-emerald-600 ml-1 inline" />;
    };

    // --- Opportunities Logic ---
    const currentOppList = activeTab === 'remarketing' ? remarketingList : retryList;

    const filteredOppList = currentOppList
        .filter((item: any) => {
            return (item.name || '').toLowerCase().includes(oppSearch.toLowerCase()) ||
                (item.car || '').toLowerCase().includes(oppSearch.toLowerCase());
        })
        .sort((a: any, b: any) => {
            if (!oppSortConfig) return 0;
            const { key, direction } = oppSortConfig;
            const aValue = a[key] || '';
            const bValue = b[key] || '';
            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const requestOppSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (oppSortConfig && oppSortConfig.key === key && oppSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setOppSortConfig({ key, direction });
    };

    const OppSortIcon = ({ columnKey }: { columnKey: string }) => {
        if (oppSortConfig?.key !== columnKey) return <ArrowUpDown size={14} className="text-slate-300 ml-1 inline" />;
        return oppSortConfig.direction === 'asc'
            ? <ArrowUp size={14} className="text-emerald-600 ml-1 inline" />
            : <ArrowDown size={14} className="text-emerald-600 ml-1 inline" />;
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        let res = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        if (dateString.includes('T') && !dateString.endsWith('T00:00:00.000Z')) {
            res += ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        return res;
    };

    // --- PDF REPORT DATA GENERATION ---
    const reportHistory = useMemo(() => {
        return simulationHistory.filter(item => {
            return item.date >= exportStartDate && item.date <= exportEndDate;
        });
    }, [simulationHistory, exportStartDate, exportEndDate]);

    const reportSummary = useMemo(() => {
        const total = reportHistory.length;
        const approved = reportHistory.filter(i => i.status === 'APPROVED' || i.status === 'Aprovado').length;
        const rejected = reportHistory.filter(i => i.status?.includes('REJECT') || i.status === 'Reprovado').length;
        const approvalRate = total > 0 ? (approved / total) * 100 : 0;
        return { total, approved, rejected, approvalRate };
    }, [reportHistory]);

    return (
        <div className="pb-20 p-6">
            {/* NORMAL SCREEN VIEW */}
            <div className="space-y-8 animate-fade-in print:hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Estatísticas & Oportunidades</h1>
                        <p className="text-slate-500 text-sm">Inteligência de dados e histórico de operações.</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button className="w-full md:w-auto" variant="primary" icon={<FileText className="w-4 h-4" />} onClick={handleExportClick}>Exportar PDF</Button>
                    </div>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                            <History size={14} className="text-blue-500"/> Total Simulações
                        </p>
                        <p className="text-3xl font-bold text-slate-800 mt-2">{kpiData.totalSims}</p>
                        <p className="text-xs text-slate-400 mt-1">Histórico completo</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                            <Zap size={14} className="text-emerald-500"/> Simulações Hoje
                        </p>
                        <p className="text-3xl font-bold text-slate-800 mt-2">{kpiData.todaySims}</p>
                        <p className="text-xs text-slate-400 mt-1">Nas últimas 24h</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                            <TrendingUp size={14} className="text-emerald-600"/> Aprovações Hoje
                        </p>
                        <p className="text-3xl font-bold text-emerald-600 mt-2">{kpiData.todayApprovals}</p>
                        <p className="text-xs text-slate-400 mt-1">Taxa de sucesso diária</p>
                    </div>
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-white shadow-lg flex flex-col justify-between">
                        <p className="text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                             Financiado Hoje
                        </p>
                        <p className="text-2xl font-bold mt-2">R$ {(kpiData.totalFinanced / 1000).toFixed(1)}k</p>
                        <p className="text-xs text-slate-400 mt-1 text-emerald-400 font-medium">Ticket de aprovação</p>
                    </div>
                </div>

                {/* Top Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-4 md:p-6">
                        <h3 className="text-lg font-bold text-slate-900 mb-6">Desempenho Mensal (Vendas)</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={salesData.length > 0 ? salesData : [{ name: 'Sem dados', value: 0 }]}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `R$${value / 1000}k`} />
                                    <Tooltip
                                        formatter={(value: any) => [`R$ ${value.toLocaleString()}`, 'Faturado']}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card className="p-4 md:p-6">
                        <h3 className="text-lg font-bold text-slate-900 mb-6">Aprovação por Banco (Total)</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={bankPerformanceData.length > 0 ? bankPerformanceData : [{ name: 'Sem dados', aprovados: 0, reprovados: 0 }]} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={70} />
                                    <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Legend />
                                    <Bar dataKey="aprovados" name="Aprovados" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                                    <Bar dataKey="reprovados" name="Reprovados" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                {/* Simulation History with Filters */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <History className="text-slate-600" size={24} /> Histórico de Simulações
                    </h2>

                    <div className="flex flex-col md:flex-row gap-4 mb-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Pesquisar por cliente, veículo ou banco..."
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <select
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                value={historyStatusFilter}
                                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                            >
                                <option value="ALL">Todos os Status</option>
                                <option value="APPROVED">Aprovados</option>
                                <option value="REJECTED">Reprovados</option>
                                <option value="PENDING">Em Análise</option>
                            </select>
                        </div>
                    </div>

                    <Card className="overflow-hidden">
                        <div className="max-h-[500px] overflow-auto custom-scrollbar">
                            <table className="w-full text-left relative min-w-[600px]">
                                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th
                                            className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 select-none"
                                            onClick={() => requestSort('date')}
                                        >
                                            Data <SortIcon columnKey="date" />
                                        </th>
                                        <th
                                            className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 select-none"
                                            onClick={() => requestSort('client')}
                                        >
                                            Cliente <SortIcon columnKey="client" />
                                        </th>
                                        <th
                                            className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 select-none"
                                            onClick={() => requestSort('vehicle')}
                                        >
                                            Veículo <SortIcon columnKey="vehicle" />
                                        </th>
                                        <th
                                            className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 select-none"
                                            onClick={() => requestSort('status')}
                                        >
                                            Status <SortIcon columnKey="status" />
                                        </th>
                                        <th
                                            className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 select-none"
                                            onClick={() => requestSort('bank')}
                                        >
                                            Banco <SortIcon columnKey="bank" />
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">
                                            Ações
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr><td colSpan={5} className="p-4 text-center">Carregando...</td></tr>
                                    ) : filteredHistory.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 text-slate-500 text-sm whitespace-nowrap">{formatDate(item.date)}</td>
                                            <td className="px-6 py-4 font-medium text-slate-900">{item.client}</td>
                                            <td className="px-6 py-4 text-slate-600">{item.vehicle}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant={item.status === 'APPROVED' ? 'success' : item.status.includes('REJECT') ? 'danger' : 'warning'}>
                                                    {item.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{item.bank}</td>
                                            <td className="px-6 py-4">
                                                <button
                                                    title="Ver Detalhes"
                                                    onClick={() => {
                                                        setSelectedSimulation(item);
                                                        setIsSimModalOpen(true);
                                                    }}
                                                    className="p-2 flex items-center justify-center bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-all duration-200 border border-emerald-500 shadow-sm"
                                                >
                                                    <Search className="w-4 h-4 stroke-[2.5]" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredHistory.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                Nenhuma simulação encontrada com os filtros atuais.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                {/* Intelligence Module */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Zap className="text-[#CD7F32]" size={24} /> Oportunidades Recuperáveis
                    </h2>

                    <Card className="overflow-hidden flex flex-col h-full">
                        {/* Tabs */}
                        <div className="flex border-b border-slate-200">
                            <button
                                onClick={() => { setActiveTab('remarketing'); setOppSearch(''); }}
                                className={`flex-1 py-4 text-xs md:text-sm font-semibold text-center transition-colors border-b-2 ${activeTab === 'remarketing' ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                            >
                                <div className="flex flex-col md:flex-row items-center justify-center gap-2">
                                    <div className="flex items-center gap-1">
                                        <PhoneCall size={16} />
                                        Remarketing
                                    </div>
                                    <Badge variant="brand">{remarketingList.length}</Badge>
                                </div>
                            </button>
                            <button
                                onClick={() => { setActiveTab('retry'); setOppSearch(''); }}
                                className={`flex-1 py-4 text-xs md:text-sm font-semibold text-center transition-colors border-b-2 ${activeTab === 'retry' ? 'border-amber-500 text-amber-600 bg-amber-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                            >
                                <div className="flex flex-col md:flex-row items-center justify-center gap-2">
                                    <div className="flex items-center gap-1">
                                        <RefreshCw size={16} />
                                        Repescagem
                                    </div>
                                    <Badge variant="warning">{retryList.length}</Badge>
                                </div>
                            </button>
                        </div>

                        {/* Search Bar for Opportunities */}
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={`Pesquisar na lista de ${activeTab === 'remarketing' ? 'Remarketing' : 'Repescagem'}...`}
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    value={oppSearch}
                                    onChange={(e) => setOppSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="p-0">
                            <div className="max-h-[400px] overflow-auto custom-scrollbar">
                                <table className="w-full text-left relative min-w-[600px]">
                                    <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Cliente</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Veículo</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Data</th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredOppList.map((item: any) => (
                                            <tr key={item.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => handleOpenClientDetails(item)}
                                                        className="font-medium text-emerald-600 hover:underline text-left focus:outline-none"
                                                    >
                                                        {item.name}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">{item.car}</td>
                                                <td className="px-6 py-4 text-slate-500">{formatDate(item.date)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="brand"
                                                        className="mr-2"
                                                        icon={<MessageCircle size={14} />}
                                                        onClick={() => handleContact(item, activeTab)}
                                                    >
                                                        Contatar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        icon={<PlayCircle size={14} />}
                                                        onClick={() => handleSimulateAgain(item)}
                                                    >
                                                        Simular
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredOppList.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                                    Nenhum cliente encontrado nesta lista.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Opp Client Details Modal */}
                <Modal
                    isOpen={isOppModalOpen}
                    onClose={() => setIsOppModalOpen(false)}
                    title="Detalhes do Cliente"
                >
                    {selectedOppClient && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                                    <User size={32} className="text-slate-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">{selectedOppClient.name}</h3>
                                    <p className="text-slate-500 text-sm">Cliente em Potencial</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-lg">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Dados Pessoais</p>
                                    <p className="text-sm text-slate-700">CPF: {selectedOppClient.cpf}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-lg">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Status Anterior</p>
                                    <p className="text-sm text-slate-700">{selectedOppClient.status}</p>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <h4 className="font-bold text-slate-900 mb-2">Veículo de Interesse</h4>
                                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Car className="text-slate-400" />
                                        <span className="font-medium text-slate-700">{selectedOppClient.car}</span>
                                    </div>
                                    <Badge variant={activeTab === 'remarketing' ? 'success' : 'warning'}>
                                        {activeTab === 'remarketing' ? 'Aprovado' : 'Recusado'}
                                    </Badge>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button onClick={() => setIsOppModalOpen(false)} variant="outline">Fechar</Button>
                                <Button
                                    className="ml-2"
                                    icon={<PlayCircle size={14} />}
                                    onClick={() => {
                                        setIsOppModalOpen(false);
                                        handleSimulateAgain(selectedOppClient);
                                    }}
                                >
                                    Simular Novamente
                                </Button>
                            </div>
                        </div>
                    )}
                </Modal>

                {/* Export Date Selection Modal */}
                <Modal
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    title="Exportar Relatório PDF"
                >
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">Selecione o período que deseja incluir no relatório:</p>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Data Início"
                                type="date"
                                value={exportStartDate}
                                onChange={(e: any) => setExportStartDate(e.target.value)}
                            />
                            <Input
                                label="Data Fim"
                                type="date"
                                value={exportEndDate}
                                onChange={(e: any) => setExportEndDate(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <Button variant="ghost" onClick={() => setIsExportModalOpen(false)}>Cancelar</Button>
                            <Button variant="primary" icon={<Printer size={16} />} onClick={handleConfirmExport}>Gerar Relatório</Button>
                        </div>
                    </div>
                </Modal>
            </div>

            {/* HIDDEN PRINT VIEW */}
            <div className="hidden print:block font-sans p-8 bg-white text-slate-900">
                {/* Print Header */}
                <div className="flex justify-between items-center border-b-2 border-slate-800 pb-6 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-500 p-2 rounded-lg print:bg-emerald-500">
                            <Zap className="text-white w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">FlashCred <span className="text-[#CD7F32]">Relatórios</span></h1>
                            <p className="text-sm text-slate-500">Automação de Crédito</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-slate-900 text-lg">Relatório Geral de Operações</p>
                        <p className="text-sm text-slate-500">Período: {formatDate(exportStartDate)} a {formatDate(exportEndDate)}</p>
                        <p className="text-xs text-slate-400 mt-1">Gerado em: {new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                {/* Executive Summary */}
                <div className="mb-8">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2">Resumo Executivo</h2>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                            <p className="text-xs uppercase font-bold text-slate-500">Total Simulações</p>
                            <p className="text-2xl font-bold text-slate-900">{reportSummary.total}</p>
                        </div>
                        <div className="p-4 border border-slate-200 rounded-lg bg-emerald-50 border-emerald-100">
                            <p className="text-xs uppercase font-bold text-emerald-700">Aprovados</p>
                            <p className="text-2xl font-bold text-emerald-700">{reportSummary.approved}</p>
                        </div>
                        <div className="p-4 border border-slate-200 rounded-lg bg-red-50 border-red-100">
                            <p className="text-xs uppercase font-bold text-red-700">Reprovados</p>
                            <p className="text-2xl font-bold text-red-700">{reportSummary.rejected}</p>
                        </div>
                        <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                            <p className="text-xs uppercase font-bold text-slate-500">Taxa de Aprovação</p>
                            <p className="text-2xl font-bold text-slate-900">{reportSummary.approvalRate.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>

                {/* Full History Table */}
                <div className="mb-8 break-inside-avoid">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2">Histórico de Simulações</h2>
                    <table className="w-full text-left text-sm border border-slate-200">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="px-3 py-2 border-b border-slate-200 font-semibold">Data</th>
                                <th className="px-3 py-2 border-b border-slate-200 font-semibold">Cliente</th>
                                <th className="px-3 py-2 border-b border-slate-200 font-semibold">Veículo</th>
                                <th className="px-3 py-2 border-b border-slate-200 font-semibold">Banco</th>
                                <th className="px-3 py-2 border-b border-slate-200 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportHistory.map(item => (
                                <tr key={item.id} className="border-b border-slate-100">
                                    <td className="px-3 py-2">{formatDate(item.date)}</td>
                                    <td className="px-3 py-2">{item.client}</td>
                                    <td className="px-3 py-2">{item.vehicle}</td>
                                    <td className="px-3 py-2">{item.bank}</td>
                                    <td className="px-3 py-2 font-medium">
                                        {item.status}
                                    </td>
                                </tr>
                            ))}
                            {reportHistory.length === 0 && (
                                <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">Nenhum registro neste período.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Simulation Details Modal */}
            <Modal isOpen={isSimModalOpen} onClose={() => setIsSimModalOpen(false)} title="Detalhes da Simulação">
                {selectedSimulation?.resultData?.offers && selectedSimulation.resultData.offers.length > 0 ? (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 break-inside-avoid">
                        {selectedSimulation.resultData.offers.map((offer: any, idx: number) => {
                            const bank = BANKS.find((b: any) => b.id === offer.bankId);
                            return (
                                <div key={idx} className={`p-4 rounded-xl border border-slate-200 border-l-4 ${offer.status === 'APPROVED' ? 'border-l-emerald-500 bg-emerald-50/10' : 'border-l-red-500 bg-red-50/10'}`}>
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${bank?.color || 'bg-slate-400'}`}>
                                                {bank?.logoInitial || '?'}
                                            </div>
                                            <h4 className="font-bold text-slate-900">{bank?.name || offer.bankName || offer.bankId}</h4>
                                        </div>
                                        <Badge variant={offer.status === 'APPROVED' ? 'success' : 'danger'}>{offer.status === 'APPROVED' ? 'Pré-Aprovado' : 'Proposta Recusada'}</Badge>
                                    </div>
                                    {offer.status === 'APPROVED' && offer.installments && (
                                        <div className="grid grid-cols-2 gap-2 mt-3">
                                            {offer.installments.map((inst: any, i: number) => (
                                                <div key={i} className="bg-white p-2 rounded border border-slate-100 flex justify-between items-center shadow-sm">
                                                    <span className="font-bold text-slate-700">{inst.months}x</span>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-emerald-600 font-bold text-sm">R$ {inst.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                        {inst.interestRate ? <span className="text-[10px] text-slate-400">{inst.interestRate.toFixed(2)}% a.m.</span> : null}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {offer.status !== 'APPROVED' && offer.reason && (
                                        <div className="mt-2 bg-red-50 p-2 rounded text-red-700 text-xs flex items-center gap-1 border border-red-100">
                                            <span>Motivo: {offer.reason}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-8 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <History className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Sem detalhes no Histórico</h3>
                        <p className="text-sm text-slate-500 max-w-xs">
                            Os resultados desta simulação não foram armazenados no banco de dados, ou falharam durante o cálculo.
                        </p>
                    </div>
                )}
            </Modal>
        </div>
    );
};
