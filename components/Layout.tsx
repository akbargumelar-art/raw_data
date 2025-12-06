import React from 'react';
import { User, UserRole } from '../types';
import { 
  LogOut, 
  Database, 
  Users, 
  ShieldCheck,
  Activity,
  FilePlus,
  Menu
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  isLocked: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  user, 
  onLogout, 
  currentPage, 
  onNavigate,
  isLocked
}) => {
  if (!user) return <>{children}</>;

  const navItemClass = (page: string) => `
    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer text-sm font-medium group
    ${currentPage === page 
      ? 'bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100' 
      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
    ${isLocked ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}
  `;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar - Modern White Theme */}
      <aside className="w-72 bg-white flex flex-col border-r border-gray-200 z-20">
        <div className="p-8 pb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-brand-500 to-brand-700 p-2.5 rounded-xl shadow-lg shadow-brand-200">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg tracking-tight leading-none">DataFlow</h1>
              <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded uppercase tracking-wider">Pro</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            Menu Utama
          </div>
          
          {/* Create Table - ADMIN ONLY */}
          {user.role === UserRole.ADMIN && (
            <div 
              onClick={() => !isLocked && onNavigate('schema')}
              className={navItemClass('schema')}
            >
              <FilePlus className={`w-5 h-5 ${currentPage === 'schema' ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
              <span>Buat Database & Tabel</span>
            </div>
          )}

          <div 
            onClick={() => !isLocked && onNavigate('dashboard')}
            className={navItemClass('dashboard')}
          >
            <Activity className={`w-5 h-5 ${currentPage === 'dashboard' ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
            <span>Upload Data</span>
          </div>

          {user.role === UserRole.ADMIN && (
            <>
              <div className="px-4 py-3 mt-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Administrasi
              </div>
              <div 
                onClick={() => !isLocked && onNavigate('users')}
                className={navItemClass('users')}
              >
                <Users className={`w-5 h-5 ${currentPage === 'users' ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                <span>Manajemen Pengguna</span>
              </div>
            </>
          )}
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 m-4 bg-gray-50 rounded-2xl border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-sm text-brand-600 shadow-sm">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.username}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                {user.role === UserRole.ADMIN && <ShieldCheck className="w-3 h-3 text-brand-500" />}
                <span className="capitalize">{user.role}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            disabled={isLocked}
            className={`w-full flex items-center justify-center gap-2 bg-white hover:bg-red-50 hover:border-red-100 hover:text-red-600 border border-gray-200 text-gray-600 py-2 rounded-xl transition-all text-xs font-semibold shadow-sm ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <LogOut className="w-3 h-3" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-gray-50">
        <header className="bg-white/80 backdrop-blur-md h-20 border-b border-gray-200 flex items-center justify-between px-10 sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {currentPage === 'dashboard' ? 'Upload Data' : 
               currentPage === 'schema' ? 'Desain Database' :
               'Pengguna Sistem'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {currentPage === 'dashboard' ? 'Proses upload batch & input data' : 
               currentPage === 'schema' ? 'Buat dan atur tabel database' :
               'Atur akses dan peran pengguna'}
            </p>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                agrabudi.com:52306
             </div>
          </div>
        </header>
        <div className="p-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};