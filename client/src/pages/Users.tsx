import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Save, Trash2, X, Plus } from 'lucide-react';

export const Users = () => {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('vendedor');

  useEffect(() => {
    fetchUsers();
  }, []);

  const getHeaders = () => {
    const host = window.location.hostname;
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    if (isLocalhost) headers['x-tenant-id'] = 'demo';
    return headers;
  };

  const getApiUrl = (path: string) => {
    const host = window.location.hostname;
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    return isLocalhost ? `http://localhost:3001${path}` : path;
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(getApiUrl('/api/users'), { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(getApiUrl('/api/users'), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email, password, role })
      });
      if (res.ok) {
        setShowForm(false);
        setEmail('');
        setPassword('');
        setRole('vendedor');
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao criar usuário');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateRole = async (id: string, newRole: string) => {
    try {
      const res = await fetch(getApiUrl(`/api/users/${id}/role`), {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente deletar este usuário?')) return;
    try {
      const res = await fetch(getApiUrl(`/api/users/${id}`), {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) fetchUsers();
      else {
        const err = await res.json();
        alert(err.error || 'Erro ao deletar usuário');
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (user?.role !== 'admin') {
    return <div className="p-8 text-center text-red-500">Acesso negado. Apenas administradores podem gerenciar usuários.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuários do Sistema</h1>
          <p className="text-slate-500 text-sm">Gerencie o acesso de gerentes e vendedores</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition"
          >
            <Plus size={20} />
            <span className="font-medium">Novo Usuário</span>
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800">Criar Nova Conta</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <input required type="email" placeholder="email@flashcred.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha Térmica</label>
              <input required type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Papel</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white">
                <option value="vendedor">Vendedor</option>
                <option value="gerente">Gerente</option>
                <option value="admin">Administrador (Admin)</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl hover:bg-emerald-600 font-medium">
              <Save size={18} /> Cadastrar
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-500">
              <th className="py-4 px-6">Email</th>
              <th className="py-4 px-6">Papel</th>
              <th className="py-4 px-6">Criado em</th>
              <th className="py-4 px-6 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="py-4 px-6 font-medium text-slate-800 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    {u.email.charAt(0).toUpperCase()}
                  </div>
                  {u.email}
                </td>
                <td className="py-4 px-6">
                  <select 
                    value={u.role} 
                    onChange={e => handleUpdateRole(u.id, e.target.value)}
                    disabled={u.id === user?.id}
                    className="bg-transparent border-0 font-medium text-slate-700 focus:ring-0 cursor-pointer disabled:opacity-50"
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="gerente">Gerente</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="py-4 px-6 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="py-4 px-6 text-right">
                  {u.id !== user?.id && (
                    <button onClick={() => handleDelete(u.id)} className="text-red-400 hover:text-red-600 transition p-2">
                      <Trash2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && !loading && (
          <div className="p-8 text-center text-slate-500">Nenhum usuário encontrado.</div>
        )}
      </div>
    </div>
  );
};
