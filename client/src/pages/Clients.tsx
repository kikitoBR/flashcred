
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Search, Plus, MapPin, Mail, Phone, Edit2, PlayCircle, X, MessageCircle
} from 'lucide-react';
import { getWhatsAppLink, generateMessage } from '../utils/whatsapp';
import { interactionsService } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { Client } from '../types';
import { clientService } from '../services/api';

// Reusing UI components from App.tsx (assuming they will be moved to components folder)
// For now, I will assume a shared components file or copy them
// But since I cannot easily extract ALL components right now, 
// I will assume the basic HTML structure is enough or I'll stub them.
// Wait, I should probably create a shared components file first.
// But to save time, I will use standard HTML tailored with Tailwind 
// similar to what's in App.tsx

const Badge = ({ children, variant }: { children: React.ReactNode, variant: string }) => {
    const styles: any = {
        'brand': 'bg-blue-100 text-blue-800',
        'neutral': 'bg-gray-100 text-gray-800',
        'success': 'bg-green-100 text-green-800',
        'warning': 'bg-yellow-100 text-yellow-800',
        'danger': 'bg-red-100 text-red-800',
    };
    return <span className={`px-2 py-1 rounded text-xs font-bold ${styles[variant] || styles.neutral}`}>{children}</span>;
};

const Button = ({ children, onClick, variant = 'primary', icon }: any) => {
    const baseClass = "px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors";
    const variants: any = {
        primary: "bg-emerald-600 text-white hover:bg-emerald-700",
        ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
        outline: "border border-slate-300 text-slate-700 hover:bg-slate-50"
    };
    return (
        <button onClick={onClick} className={`${baseClass} ${variants[variant]}`}>
            {icon} {children}
        </button>
    );
};

const Input = ({ label, ...props }: any) => (
    <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">{label}</label>
        <input className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" {...props} />
    </div>
);

const Modal = ({ isOpen, onClose, title, children }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 sticky top-0 bg-white">
                    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                    <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};

export const Clients = () => {
    const { clients, setClients, refreshData } = useAppContext();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);

    // Form State
    const initialFormState = {
        name: '', cpf: '', email: '', phone: '', income: '', score: '0',
        address: { street: '', number: '', neighborhood: '', city: '', state: '', zipCode: '' },
        cnh: { hasCnh: false, categories: [] as string[] },
        desiredVehicle: { type: '' as const, brand: '', model: '', priceRange: '' }
    };
    const [formData, setFormData] = useState(initialFormState);

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cpf.includes(searchTerm) ||
        (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleEdit = (client: Client) => {
        setEditingClient(client);
        setFormData({
            name: client.name,
            cpf: client.cpf,
            email: client.email,
            phone: client.phone,
            income: client.income ? client.income.toString() : '',
            score: client.score.toString(),
            address: { ...client.address },
            cnh: client.cnh || { hasCnh: false, categories: [] },
            desiredVehicle: client.desiredVehicle || { type: '', brand: '', model: '', priceRange: '' }
        });
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setEditingClient(null);
        setFormData(initialFormState);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const clientData = {
                ...formData,
                income: formData.income ? Number(formData.income) : undefined,
                score: Number(formData.score)
            };

            if (editingClient) {
                await clientService.update(editingClient.id, clientData);
            } else {
                await clientService.create(clientData);
            }

            await refreshData();
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to save client", error);
            alert("Erro ao salvar cliente.");
        }
    };

    const toggleCnhCategory = (cat: string) => {
        setFormData(prev => {
            const currentCats = prev.cnh.categories;
            const newCats = currentCats.includes(cat)
                ? currentCats.filter(c => c !== cat)
                : [...currentCats, cat];
            return { ...prev, cnh: { ...prev.cnh, categories: newCats } };
        });
    };

    const getScoreColor = (score: number) => {
        if (score >= 700) return 'success';
        if (score >= 500) return 'warning';
        return 'danger';
    };

    const handleContact = async (client: Client) => {
        const message = generateMessage('FOLLOWUP', {
            clientName: client.name,
            vehicle: client.desiredVehicle?.model || 'um veículo'
        });

        const link = getWhatsAppLink(client.phone || '', message);

        try {
            await interactionsService.create({
                clientId: client.id,
                type: 'WHATSAPP',
                note: `Contato via lista de clientes`
            });
        } catch (err) {
            console.error('Failed to log interaction', err);
        }

        window.open(link, '_blank');
    };

    return (
        <div className="space-y-6 animate-fade-in p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900">Gestão de Clientes</h1>
                    <p className="text-slate-500 text-sm">Gerencie sua base de contatos e histórico de crédito.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, CPF ou email..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={handleNew}>Novo</Button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg shadow-emerald-500/20">
                    <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Total Clientes</p>
                    <p className="text-3xl font-bold mt-1">{clients.length}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Score 700+</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-1">
                        {clients.filter(c => (c.score || 0) >= 700).length}
                    </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Com CNH</p>
                    <p className="text-3xl font-bold text-slate-800 mt-1">
                        {clients.filter(c => c.cnh?.hasCnh).length}
                    </p>
                </div>
            </div>

            {/* Client Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Contato</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">Renda</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">Score</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">CNH</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-center">Status</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredClients.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-500 font-medium">Nenhum cliente encontrado</p>
                                        <p className="text-slate-400 text-sm">Cadastre seu primeiro cliente clicando em "+ Novo"</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredClients.map((client) => (
                                    <tr key={client.id} className="hover:bg-emerald-50/50 transition-all duration-200 group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                                    {client.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">{client.name}</p>
                                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                                        <MapPin size={10} />
                                                        <span>{client.address?.city || 'N/A'}{client.address?.state ? `, ${client.address.state}` : ''}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <p className="text-sm font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded inline-block">{client.cpf}</p>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <Mail size={10} className="text-emerald-500" />
                                                    <span className="truncate max-w-[150px]">{client.email}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <Phone size={10} className="text-emerald-500" /> {client.phone}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="inline-flex flex-col items-center">
                                                <span className="text-lg font-bold text-slate-800">{client.income ? `R$ ${(client.income / 1000).toFixed(1)}K` : 'N/A'}</span>
                                                <span className="text-xs text-slate-400">mensal</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full font-bold text-lg ${client.score >= 700
                                                ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500/30'
                                                : client.score >= 500
                                                    ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-500/30'
                                                    : 'bg-red-100 text-red-700 ring-2 ring-red-500/30'
                                                }`}>
                                                {client.score}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {client.cnh?.hasCnh ? (
                                                <div className="flex flex-wrap gap-1 justify-center">
                                                    {client.cnh.categories?.map((cat: string) => (
                                                        <span key={cat} className="w-7 h-7 rounded bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                                                            {cat}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge variant={client.status === 'ACTIVE' ? 'success' : 'neutral'}>
                                                {client.status === 'ACTIVE' ? 'Ativo' : 'Arquivado'}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(client)}
                                                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleContact(client)}
                                                    className="p-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-600 hover:text-emerald-800 transition-colors"
                                                    title="Contatar via WhatsApp"
                                                >
                                                    <MessageCircle size={16} />
                                                </button>
                                                <button
                                                    onClick={() => navigate('/simulation', { state: { client } })}
                                                    className="p-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-600 hover:text-emerald-800 transition-colors"
                                                    title="Simular"
                                                >
                                                    <PlayCircle size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer */}
                {filteredClients.length > 0 && (
                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                            Mostrando <span className="font-bold text-slate-700">{filteredClients.length}</span> de <span className="font-bold text-slate-700">{clients.length}</span> clientes
                        </p>
                        <p className="text-xs text-slate-400">
                            Passe o mouse sobre a linha para ver as ações
                        </p>
                    </div>
                )}
            </div>

            {/* Include Modal Logic Here */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingClient ? "Editar Cliente" : "Cadastrar Cliente"}
            >
                <form onSubmit={handleSave} className="space-y-4">
                    {/* Simplified Form Fields */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-3">
                            <Input
                                label="Nome Completo"
                                value={formData.name}
                                onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <Input
                            label="CPF"
                            value={formData.cpf}
                            onChange={(e: any) => setFormData({ ...formData, cpf: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label="Data de Nascimento"
                            type="date"
                            value={formData.birthDate || ''}
                            onChange={(e: any) => setFormData({ ...formData, birthDate: e.target.value })}
                        />
                        <div className="col-span-2">
                            <Input
                                label="Email"
                                value={formData.email}
                                onChange={(e: any) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label="Telefone"
                            value={formData.phone}
                            onChange={(e: any) => setFormData({ ...formData, phone: e.target.value })}
                            required
                        />
                        <Input
                            label="Renda Mensal (R$)"
                            type="number"
                            value={formData.income}
                            onChange={(e: any) => setFormData({ ...formData, income: e.target.value })}
                        />
                        <Input
                            label="Score Aprox."
                            type="number"
                            value={formData.score}
                            onChange={(e: any) => setFormData({ ...formData, score: e.target.value })}
                        />
                    </div>

                    <div className="pt-2">
                        <label className="flex items-center gap-2 mb-2 font-semibold text-slate-700 text-sm">
                            <input
                                type="checkbox"
                                checked={formData.cnh?.hasCnh}
                                onChange={(e) => setFormData({ ...formData, cnh: { ...formData.cnh, hasCnh: e.target.checked } })}
                                className="width-4 height-4 text-emerald-600 rounded focus:ring-emerald-500"
                            />
                            Possui CNH?
                        </label>

                        {formData.cnh?.hasCnh && (
                            <div className="flex gap-2 mt-2">
                                {['A', 'B', 'C', 'D', 'E'].map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => toggleCnhCategory(cat)}
                                        className={`w-10 h-10 rounded font-bold transition-colors ${formData.cnh.categories.includes(cat)
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <h3 className="font-bold text-slate-800 text-sm mb-3 uppercase">Endereço</h3>
                        <div className="grid grid-cols-4 gap-4 mb-3">
                            <div className="col-span-1">
                                <Input
                                    label="CEP"
                                    value={formData.address?.zipCode || ''}
                                    onChange={(e: any) => setFormData({ ...formData, address: { ...formData.address, zipCode: e.target.value } })}
                                />
                            </div>
                            <div className="col-span-2">
                                <Input
                                    label="Rua"
                                    value={formData.address?.street || ''}
                                    onChange={(e: any) => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })}
                                />
                            </div>
                            <Input
                                label="Número"
                                value={formData.address?.number || ''}
                                onChange={(e: any) => setFormData({ ...formData, address: { ...formData.address, number: e.target.value } })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Bairro"
                                value={formData.address?.neighborhood || ''}
                                onChange={(e: any) => setFormData({ ...formData, address: { ...formData.address, neighborhood: e.target.value } })}
                            />
                            <Input
                                label="Cidade"
                                value={formData.address?.city || ''}
                                onChange={(e: any) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" variant="success">{editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}</Button>
                    </div>
                </form>
            </Modal>

        </div>
    );
};
