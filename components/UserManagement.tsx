import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { adminService } from '../services/api';
import { Trash2, UserPlus, Shield, User as UserIcon } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: UserRole.OPERATOR });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const loadUsers = async () => {
    try {
      const data = await adminService.getUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminService.createUser(newUser.username, newUser.password, newUser.role);
      setMsg('User created successfully');
      setNewUser({ username: '', password: '', role: UserRole.OPERATOR });
      loadUsers();
      setTimeout(() => setMsg(''), 3000);
    } catch (error: any) {
      setMsg(error.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if(!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await adminService.deleteUser(id);
      loadUsers();
    } catch (e) {
      alert('Failed to delete');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
      {/* List Users */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
           <div>
             <h3 className="text-lg font-bold text-gray-900">System Users</h3>
             <p className="text-xs text-gray-400">Manage access control</p>
           </div>
           <span className="bg-white border border-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-mono font-bold shadow-sm">Total: {users.length}</span>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left">
            <thead className="bg-white text-gray-400 text-[10px] uppercase font-bold tracking-wider border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4 text-gray-300 font-mono text-xs group-hover:text-gray-500">#{u.id}</td>
                  <td className="px-6 py-4 font-medium text-gray-700 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold border border-white shadow-sm">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    {u.username}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                      u.role === UserRole.ADMIN 
                        ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                        : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}>
                      {u.role === UserRole.ADMIN ? <Shield className="w-3 h-3"/> : <UserIcon className="w-3 h-3"/>}
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDelete(u.id)}
                      className="text-gray-300 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg"
                      title="Delete User"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 h-fit">
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <div className="bg-gray-100 p-2 rounded-xl">
             <UserPlus className="w-5 h-5 text-gray-700" />
          </div>
          Add User
        </h3>
        
        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">Username</label>
            <input 
              type="text" 
              required
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              value={newUser.username}
              onChange={e => setNewUser({...newUser, username: e.target.value})}
              placeholder="e.g. jdoe"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              value={newUser.password}
              onChange={e => setNewUser({...newUser, password: e.target.value})}
              placeholder="••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">Role</label>
            <select
               className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none transition-all text-gray-700"
               value={newUser.role}
               onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
            >
              <option value={UserRole.OPERATOR}>Operator</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </select>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl mt-2 flex justify-center items-center"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Create Account'}
          </button>
          
          {msg && (
            <div className={`text-xs text-center py-2 rounded-lg font-medium ${msg.includes('success') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
              {msg}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};