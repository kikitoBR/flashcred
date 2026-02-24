
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Car, Search, Plus, Upload, X, ChevronLeft, ChevronRight, Edit2, Trash2
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Vehicle } from '../types';
import { Badge, Button, Card, Input, Modal } from '../components/ui';
import { VehicleDetailsModal } from '../components/VehicleDetailsModal';
import { SaleRegistrationModal } from '../components/SaleRegistrationModal';
import { vehicleService } from '../services/api';

export const Vehicles = () => {
    const navigate = useNavigate();
    const { vehicles, setVehicles, clients } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'AVAILABLE' | 'SOLD' | 'RESERVED'>('ALL');

    // Modals State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null);
    const [sellingVehicle, setSellingVehicle] = useState<Vehicle | null>(null);

    // Form Initial State
    const initialFormState = {
        brand: '', model: '', year: '', price: '' as string | number, plate: '', mileage: '',
        images: [] as string[], status: 'AVAILABLE' as 'AVAILABLE' | 'SOLD' | 'RESERVED',
        uf: '', condition: 'SEMINOVO' as 'NOVO' | 'SEMINOVO' | 'USADO'
    };
    const [formData, setFormData] = useState(initialFormState);

    // Carousel State for each card
    const [currentImageIndices, setCurrentImageIndices] = useState<Record<string, number>>({});

    const toggleImage = (vehicleId: string, direction: 'prev' | 'next', total: number) => {
        setCurrentImageIndices(prev => {
            const current = prev[vehicleId] || 0;
            let nextIndex = direction === 'next' ? current + 1 : current - 1;
            if (nextIndex >= total) nextIndex = 0;
            if (nextIndex < 0) nextIndex = total - 1;
            return { ...prev, [vehicleId]: nextIndex };
        });
    };

    const filteredVehicles = vehicles.filter(v => {
        const matchesSearch = v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.plate.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'ALL' || v.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const handleEdit = (e: React.MouseEvent, vehicle: Vehicle) => {
        e.stopPropagation();
        setEditingVehicle(vehicle);
        setFormData({
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year.toString(),
            price: vehicle.price,
            plate: vehicle.plate,
            mileage: vehicle.mileage?.toString() || '',
            images: vehicle.images,
            status: vehicle.status || 'AVAILABLE',
            uf: vehicle.uf || '',
            condition: vehicle.condition || 'SEMINOVO'
        });
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setEditingVehicle(null);
        setFormData(initialFormState);
        setIsModalOpen(true);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const newImages: string[] = [];
            let processed = 0;

            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        newImages.push(reader.result);
                    }
                    processed++;
                    if (processed === files.length) {
                        setFormData(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
                    }
                };
                reader.readAsDataURL(file as Blob);
            });
        }
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const vehicleData = {
            brand: formData.brand,
            model: formData.model,
            year: Number(formData.year),
            price: Number(formData.price),
            plate: formData.plate,
            mileage: Number(formData.mileage),
            images: formData.images,
            status: formData.status,
            uf: formData.uf,
            condition: formData.condition
        };

        try {
            if (editingVehicle) {
                const result = await vehicleService.update(editingVehicle.id, vehicleData);
                console.log('Vehicle updated:', result);

                // Refresh vehicles list from database
                const updatedVehicles = await vehicleService.getAll();
                setVehicles(updatedVehicles);
            } else {
                // Create new vehicle via API
                const result = await vehicleService.create(vehicleData);
                console.log('Vehicle created:', result);

                // Refresh vehicles list from database
                const updatedVehicles = await vehicleService.getAll();
                setVehicles(updatedVehicles);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving vehicle:', error);
            alert('Erro ao salvar veículo. Verifique o console.');
        }
    };

    const handleDelete = (id: string) => {
        if (confirm('Tem certeza que deseja remover este veículo?')) {
            setVehicles(prev => prev.filter(v => v.id !== id));
        }
    };

    // --- New Handlers for Details & Actions ---
    const handleSimulate = (vehicle: Vehicle) => {
        navigate('/simulation', {
            state: { preSelectedVehicle: vehicle }
        });
    };

    const handleRegisterSale = (vehicle: Vehicle) => {
        setSellingVehicle(vehicle);
        setViewingVehicle(null);
    };

    const handleConfirmSale = (saleData: any) => {
        setVehicles(prev => prev.map(v => v.id === sellingVehicle?.id ? { ...v, status: 'SOLD' } as Vehicle : v));
        setSellingVehicle(null);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'AVAILABLE': return <Badge variant="success">Disponível</Badge>;
            case 'RESERVED': return <Badge variant="warning">Reservado</Badge>;
            case 'SOLD': return <Badge variant="neutral">Vendido</Badge>;
            default: return null;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900">Gestão de Veículos</h1>
                    <p className="text-slate-500 text-sm">Controle total do seu estoque.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar marca, modelo ou placa..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={handleNew}>Novo Veículo</Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 pb-2 overflow-x-auto">
                {(['ALL', 'AVAILABLE', 'RESERVED', 'SOLD'] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${filterStatus === status
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                            }`}
                    >
                        {status === 'ALL' && 'Todos'}
                        {status === 'AVAILABLE' && 'Disponíveis'}
                        {status === 'RESERVED' && 'Reservados'}
                        {status === 'SOLD' && 'Vendidos'}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredVehicles.map((vehicle) => {
                    const currentImgIndex = currentImageIndices[vehicle.id] || 0;
                    const displayImage = vehicle.images[currentImgIndex];

                    return (
                        <Card
                            key={vehicle.id}
                            className="overflow-hidden group hover:shadow-lg transition-all cursor-pointer"
                            onClick={() => setViewingVehicle(vehicle)}
                        >
                            <div className="relative h-48 bg-slate-200 overflow-hidden flex items-center justify-center">
                                {vehicle.images && vehicle.images.length > 0 ? (
                                    <>
                                        <img src={displayImage} alt={`${vehicle.brand} ${vehicle.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        {/* Image Navigation Overlay */}
                                        {vehicle.images.length > 1 && (
                                            <>
                                                <div className="absolute inset-0 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                    <button onClick={(e) => { e.stopPropagation(); toggleImage(vehicle.id, 'prev', vehicle.images.length) }} className="p-1 bg-black/50 text-white rounded-full hover:bg-black/70 pointer-events-auto"><ChevronLeft size={16} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); toggleImage(vehicle.id, 'next', vehicle.images.length) }} className="p-1 bg-black/50 text-white rounded-full hover:bg-black/70 pointer-events-auto"><ChevronRight size={16} /></button>
                                                </div>
                                                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full z-10">
                                                    {currentImgIndex + 1}/{vehicle.images.length}
                                                </div>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <Car className="w-20 h-20 text-slate-300" strokeWidth={1.5} />
                                )}
                                <div className="absolute top-2 right-2 z-10">
                                    {getStatusBadge(vehicle.status)}
                                </div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-slate-900 text-lg truncate">{vehicle.brand} {vehicle.model}</h3>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 mb-3">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded">{vehicle.year}</span>
                                    <span>•</span>
                                    <span>{vehicle.mileage?.toLocaleString() || 0} km</span>
                                    <span>•</span>
                                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">{vehicle.condition === 'NOVO' ? '0km' : vehicle.condition === 'USADO' ? 'Usado' : 'Seminovo'}</span>
                                </div>

                                <div className="flex items-end justify-between mb-4">
                                    <div>
                                        <p className="text-xs text-slate-400">Preço à vista</p>
                                        <p className="text-xl font-bold text-emerald-600">R$ {vehicle.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <div className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                        {vehicle.plate}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); handleEdit(e, vehicle); }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"><Edit2 size={16} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(vehicle.id); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {filteredVehicles.length === 0 && (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                    <Car className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Nenhum veículo encontrado com os filtros selecionados.</p>
                </div>
            )}

            {/* Modal New/Edit Vehicle */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingVehicle ? "Editar Veículo" : "Adicionar Veículo"}
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Marca" value={formData.brand} onChange={(e: any) => setFormData({ ...formData, brand: e.target.value })} required placeholder="Ex: Honda" />
                        <Input label="Modelo" value={formData.model} onChange={(e: any) => setFormData({ ...formData, model: e.target.value })} required placeholder="Ex: Civic Touring" />

                        <Input label="Ano" type="number" value={formData.year} onChange={(e: any) => setFormData({ ...formData, year: e.target.value })} required />
                        <Input label="Placa" value={formData.plate} onChange={(e: any) => setFormData({ ...formData, plate: e.target.value })} required className="uppercase" />

                        <Input label="Quilometragem" type="number" value={formData.mileage} onChange={(e: any) => setFormData({ ...formData, mileage: e.target.value })} required />
                        <Input label="Preço (R$)"
                            value={typeof formData.price === 'number'
                                ? formData.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                                : formData.price}
                            onChange={(e: any) => {
                                // Currency Mask Logic
                                let value = e.target.value.replace(/\D/g, "");
                                if (!value) {
                                    setFormData({ ...formData, price: 0 });
                                    return;
                                }
                                const floatValue = Number(value) / 100;
                                setFormData({ ...formData, price: floatValue });
                            }}
                            required
                        />

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">UF Licenciamento</label>
                            <select
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                value={formData.uf}
                                onChange={(e) => setFormData({ ...formData, uf: e.target.value })}
                            >
                                <option value="">Selecione a UF...</option>
                                <option value="AC">Acre</option>
                                <option value="AL">Alagoas</option>
                                <option value="AP">Amapá</option>
                                <option value="AM">Amazonas</option>
                                <option value="BA">Bahia</option>
                                <option value="CE">Ceará</option>
                                <option value="DF">Distrito Federal</option>
                                <option value="ES">Espírito Santo</option>
                                <option value="GO">Goiás</option>
                                <option value="MA">Maranhão</option>
                                <option value="MT">Mato Grosso</option>
                                <option value="MS">Mato Grosso do Sul</option>
                                <option value="MG">Minas Gerais</option>
                                <option value="PA">Pará</option>
                                <option value="PB">Paraíba</option>
                                <option value="PR">Paraná</option>
                                <option value="PE">Pernambuco</option>
                                <option value="PI">Piauí</option>
                                <option value="RJ">Rio de Janeiro</option>
                                <option value="RN">Rio Grande do Norte</option>
                                <option value="RS">Rio Grande do Sul</option>
                                <option value="RO">Rondônia</option>
                                <option value="RR">Roraima</option>
                                <option value="SC">Santa Catarina</option>
                                <option value="SP">São Paulo</option>
                                <option value="SE">Sergipe</option>
                                <option value="TO">Tocantins</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Condição</label>
                            <select
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                value={formData.condition}
                                onChange={(e) => setFormData({ ...formData, condition: e.target.value as any })}
                            >
                                <option value="NOVO">Novo (0km)</option>
                                <option value="SEMINOVO">Seminovo</option>
                                <option value="USADO">Usado</option>
                            </select>
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Fotos do Veículo</label>
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors relative cursor-pointer">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="text-center pointer-events-none">
                                <div className="bg-emerald-100 p-3 rounded-full inline-flex mb-3">
                                    <Upload className="w-6 h-6 text-emerald-600" />
                                </div>
                                <p className="text-sm font-medium text-slate-900">Clique para enviar fotos</p>
                                <p className="text-xs text-slate-500 mt-1">PNG, JPG (Multiplos arquivos permitidos)</p>
                            </div>
                        </div>

                        {/* Thumbnail Grid */}
                        {formData.images.length > 0 && (
                            <div className="mt-4 grid grid-cols-4 gap-2">
                                {formData.images.map((img, idx) => (
                                    <div key={idx} className="relative aspect-video rounded-md overflow-hidden group border border-slate-200">
                                        <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(idx)}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                        <select
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        >
                            <option value="AVAILABLE">Disponível</option>
                            <option value="RESERVED">Reservado</option>
                            <option value="SOLD">Vendido</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">{editingVehicle ? 'Salvar' : 'Adicionar'}</Button>
                    </div>
                </form>
            </Modal>

            {/* Details Modal */}
            <VehicleDetailsModal
                isOpen={!!viewingVehicle}
                onClose={() => setViewingVehicle(null)}
                vehicle={viewingVehicle}
                onSimulate={handleSimulate}
                onRegisterSale={handleRegisterSale}
            />

            {/* Sale Registration Modal */}
            <SaleRegistrationModal
                isOpen={!!sellingVehicle}
                onClose={() => setSellingVehicle(null)}
                vehicle={sellingVehicle}
                clients={clients}
                onConfirm={handleConfirmSale}
            />
        </div>
    );
};
