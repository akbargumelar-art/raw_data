
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { adminService, dataService } from '../services/api';
import { Trash2, UserPlus, Shield, User as UserIcon, Database, CheckSquare, Square } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [availableDbs, setAvailableDbs] = useState<string[]>([]);
  
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '', 
    role: UserRole.OPERATOR 
  });
  const [selectedDbs, setSelectedDbs] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const loadData = async () => {
    try {
      const [uData, dData] = await Promise.all([
        adminService.getUsers(),
        dataService.getDatabases()
      ]);
      setUsers(uData);
      setAvailableDbs(dData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminService.createUser(newUser.username, newUser.password, newUser.role, selectedDbs);
      setMsg('User created successfully');
      setNewUser({ username: '', password: '', role: UserRole.OPERATOR });
      setSelectedDbs([]);
      loadData(); // Refresh list
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
      loadData();
    } catch (e) {
      alert('Failed to delete');
    }
  };

  const toggleDbSelection = (db: string) => {
    if (selectedDbs.includes(db)) {
      setSelectedDbs(selectedDbs.filter(d => d !== db));
    } else {
      setSelectedDbs([...selectedDbs, db]);
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
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Access Rights</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
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
                  <td className="px-6 py-4">
                     {u.role === UserRole.ADMIN ? (
                       <span className="text-xs text-gray-400 italic">Full System Access</span>
                     ) : (
                       <div className="flex flex-wrap gap-1">
                         {u.allowedDatabases && u.allowedDatabases.length > 0 ? (
                            u.allowedDatabases.map(db => (
                              <span key={db} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                                {db}
                              </span>
                            ))
                         ) : (
                            <span className="text-xs text-red-400">No Access</span>
                         )}
                       </div>
                     )}
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
          
          {/* Database Permission Selector (Only for Operators) */}
          {newUser.role === UserRole.OPERATOR && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
                 <Database className="w-3 h-3" /> Allowed Databases
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                 {availableDbs.length > 0 ? (
                    availableDbs.map(db => (
                      <div 
                        key={db} 
                        onClick={() => toggleDbSelection(db)}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer text-sm transition-all ${
                          selectedDbs.includes(db) ? 'bg-white shadow-sm border-gray-200 text-brand-700' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                         {selectedDbs.includes(db) 
                           ? <CheckSquare className="w-4 h-4 text-brand-500" /> 
                           : <Square className="w-4 h-4 text-gray-300" />}
                         <span className="truncate">{db}</span>
                      </div>
                    ))
                 ) : (
                    <div className="text-xs text-gray-400 italic text-center py-2">No databases available</div>
                 )}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 ml-1">
                 {selectedDbs.length === 0 ? 'User will not see any databases.' : `${selectedDbs.length} database(s) selected.`}
              </p>
            </div>
          )}

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
