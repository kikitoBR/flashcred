
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, TrendingUp, Calculator, CheckCircle2, DollarSign, RefreshCw
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Button, Card, Badge } from '../components/ui';
import { salesService } from '../services/api';
import { C6CommunicationModal } from '../components/C6CommunicationModal';

interface DashboardStats {
    todaySimulations: number;
    todayApprovals: number;
    totalFinanced: number;
    weeklyData: Array<{ day_of_week: number; count: number }>;
    recentSimulations: Array<{
        id: string;
        client_name: string;
        vehicle_description: string;
        bank_name: string;
        status: string;
        created_at: string;
    }>;
}

export const Dashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [isC6ModalOpen, setIsC6ModalOpen] = useState(false);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const data = await salesService.getStats();
            setStats(data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    // Transform weekly data for chart
    const dayNames = ['', 'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const chartData = [1, 2, 3, 4, 5, 6, 7].map(day => {
        const found = stats?.weeklyData?.find(d => d.day_of_week === day);
        return {
            name: dayNames[day],
            vendas: found?.count || 0
        };
    });

    // Format currency
    const formatCurrency = (value: number | null | undefined): string => {
        if (value === null || value === undefined) return 'R$ 0';
        const numValue = Number(value);
        if (isNaN(numValue)) return 'R$ 0';
        if (numValue >= 1000000) {
            return `R$ ${(numValue / 1000000).toFixed(1)}M`;
        } else if (numValue >= 1000) {
            return `R$ ${(numValue / 1000).toFixed(0)}K`;
        }
        return `R$ ${numValue.toFixed(0)}`;
    };

    // Calculate conversion rate
    const conversionRate = stats && stats.todaySimulations > 0
        ? Math.round((stats.todayApprovals / stats.todaySimulations) * 100)
        : 0;

    return (
        <div className="space-y-6 animate-fade-in print:hidden p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900">Painel de Controle</h1>
                    <p className="text-slate-500 text-sm">Bem-vindo de volta ao FlashCred.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="hidden lg:flex border-[#FACC15]/50 text-slate-700 hover:bg-[#FACC15]/10 hover:border-[#FACC15]" onClick={() => setIsC6ModalOpen(true)}>
                        Ver Comunicado C6
                    </Button>
                    <Button variant="ghost" icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />} onClick={fetchStats}>
                        Atualizar
                    </Button>
                    <Button className="w-full md:w-auto" variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/clients')}>Novo Cliente</Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <Card className="p-6 border-l-4 border-l-emerald-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 uppercase">Simulações Hoje</p>
                            <h3 className="text-3xl font-bold text-slate-900 mt-1">
                                {loading ? '...' : stats?.todaySimulations || 0}
                            </h3>
                            <p className="text-xs text-emerald-600 mt-1 flex items-center font-medium">
                                <TrendingUp className="w-3 h-3 mr-1" /> Em tempo real
                            </p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
                            <Calculator className="w-6 h-6" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-l-4 border-l-amber-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 uppercase">Aprovações</p>
                            <h3 className="text-3xl font-bold text-slate-900 mt-1">
                                {loading ? '...' : stats?.todayApprovals || 0}
                            </h3>
                            <p className="text-xs text-amber-600 mt-1 flex items-center font-medium">
                                <TrendingUp className="w-3 h-3 mr-1" /> {conversionRate}% Taxa de Conversão
                            </p>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-full text-amber-600">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-l-4 border-l-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 uppercase">Total Financiado</p>
                            <h3 className="text-3xl font-bold text-slate-900 mt-1">
                                {loading ? '...' : formatCurrency(stats?.totalFinanced || 0)}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">Vendas finalizadas</p>
                        </div>
                        <div className="p-3 bg-slate-100 rounded-full text-slate-700">
                            <DollarSign className="w-6 h-6" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Chart & Recent */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="p-6 lg:col-span-2">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Desempenho Semanal</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="vendas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} name="Simulações" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Simulações Recentes</h3>
                    <div className="space-y-4">
                        {stats?.recentSimulations && stats.recentSimulations.length > 0 ? (
                            stats.recentSimulations.map((sim) => (
                                <div key={sim.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${sim.status === 'APPROVED' ? 'bg-emerald-500' :
                                            sim.status === 'REJECTED' ? 'bg-red-500' : 'bg-amber-500'
                                            }`}>
                                            {sim.client_name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">{sim.client_name}</p>
                                            <p className="text-xs text-slate-500">{sim.vehicle_description || sim.bank_name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant={
                                            sim.status === 'APPROVED' ? 'success' :
                                                sim.status === 'REJECTED' ? 'danger' : 'warning'
                                        }>
                                            {sim.status === 'APPROVED' ? 'Aprovado' :
                                                sim.status === 'REJECTED' ? 'Reprovado' : 'Pendente'}
                                        </Badge>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                <Calculator className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Nenhuma simulação ainda</p>
                                <p className="text-xs">Execute uma simulação para ver aqui</p>
                            </div>
                        )}
                    </div>
                    <Button variant="outline" className="w-full mt-4 text-xs" onClick={() => navigate('/statistics')}>Ver Histórico Completo</Button>
                </Card>
            </div>

            <C6CommunicationModal 
                isOpen={isC6ModalOpen} 
                onClose={() => setIsC6ModalOpen(false)} 
            />
        </div>
    );
};
