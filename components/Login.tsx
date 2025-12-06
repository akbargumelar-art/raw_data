import React, { useState, useEffect } from 'react';
import { Lock, User as UserIcon, AlertCircle, Server, Info, WifiOff, ArrowRight } from 'lucide-react';
import { authService } from '../services/api';
import { LOCAL_STORAGE_KEY, USE_MOCK_API } from '../constants';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isDev = (import.meta as any).env?.DEV;

  useEffect(() => {
    if (isDev || USE_MOCK_API) {
      setUsername('admin');
      setPassword('admin123');
    }
  }, [isDev]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { token, user } = await authService.login(username, password);
      localStorage.setItem(LOCAL_STORAGE_KEY, token);
      onLoginSuccess(user);
    } catch (err: any) {
      // Clean error handling without polluting console
      setError(err.response?.data?.error || 'Failed to login. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredential = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[550px]">
        
        {/* Left Side - Brand (Soft Red Gradient) */}
        <div className="md:w-1/2 bg-gradient-to-br from-brand-500 to-brand-700 p-10 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <div className="absolute -top-24 -left-24 w-64 h-64 bg-white rounded-full mix-blend-overlay blur-3xl"></div>
             <div className="absolute bottom-0 right-0 w-80 h-80 bg-brand-300 rounded-full mix-blend-overlay blur-3xl"></div>
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl mb-6 border border-white/10 shadow-lg">
              <Server className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">DataFlow Pro</h1>
            <p className="text-brand-50 text-sm font-light leading-relaxed">The enterprise standard for mass data ingestion and remote database management.</p>
          </div>

          <div className="relative z-10 text-xs text-brand-100/80 font-medium">
             &copy; 2024 Abkciraya Cloud Systems
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="md:w-1/2 p-10 flex flex-col justify-center relative">
          {USE_MOCK_API && (
            <div className="absolute top-0 right-0 left-0 bg-amber-50 text-amber-800 text-[10px] font-bold py-1 text-center uppercase tracking-widest border-b border-amber-100">
              Offline Demo Mode
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome Back</h2>
            <p className="text-sm text-gray-500">Please enter your credentials to access the node.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            {(isDev || USE_MOCK_API) && (
              <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl">
                <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Quick Access
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => fillCredential('admin', 'admin123')} className="flex-1 text-xs bg-white text-brand-600 py-2 rounded-lg border border-brand-100 shadow-sm hover:shadow hover:border-brand-300 transition-all font-medium">
                    Admin
                  </button>
                  <button type="button" onClick={() => fillCredential('operator', 'op123')} className="flex-1 text-xs bg-white text-brand-600 py-2 rounded-lg border border-brand-100 shadow-sm hover:shadow hover:border-brand-300 transition-all font-medium">
                    Operator
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 ml-1">Username</label>
                <div className="relative group">
                  <UserIcon className="w-5 h-5 text-gray-400 absolute left-3.5 top-3 group-focus-within:text-brand-500 transition-colors" />
                  <input
                    type="text"
                    required
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 ml-1">Password</label>
                <div className="relative group">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3.5 top-3 group-focus-within:text-brand-500 transition-colors" />
                  <input
                    type="password"
                    required
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-brand-500/30 flex items-center justify-center gap-2 mt-2 ${loading ? 'opacity-75 cursor-wait' : 'hover:scale-[1.02]'}`}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};