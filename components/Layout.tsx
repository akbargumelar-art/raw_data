import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { 
  LogOut, 
  Database, 
  Users, 
  ShieldCheck,
  Activity,
  FilePlus,
  Table,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile state
  const [isCollapsed, setIsCollapsed] = useState(false); // Desktop state

  // Close mobile sidebar on navigate
  const handleNavigate = (page: string) => {
    if (!isLocked) {
      onNavigate(page);
      setIsSidebarOpen(false);
    }
  };

  if (!user) return <>{children}</>;

  const navItemClass = (page: string) => `
    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer text-sm font-medium group relative
    ${currentPage === page 
      ? 'bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100' 
      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
    ${isLocked ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}
    ${isCollapsed ? 'justify-center' : ''}
  `;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed md:relative z-30 h-full bg-white flex flex-col border-r border-gray-200 shadow-xl md:shadow-none
          transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-20' : 'md:w-72'}
          w-72
        `}
      >
        {/* Sidebar Header */}
        <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-brand-500 to-brand-700 p-2.5 rounded-xl shadow-lg shadow-brand-200 shrink-0">
              <Database className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in duration-200">
                <h1 className="font-bold text-gray-900 text-lg tracking-tight leading-none">DataFlow</h1>
                <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded uppercase tracking-wider">Pro</span>
              </div>
            )}
          </div>
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="md:hidden text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar mt-2">
          {!isCollapsed ? (
            <div className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest animate-in fade-in">
              Menu Utama
            </div>
          ) : (
             <div className="h-4 border-b border-gray-100 mx-4 mb-4"></div>
          )}
          
          {user.role === UserRole.ADMIN && (
            <div 
              onClick={() => handleNavigate('schema')}
              className={navItemClass('schema')}
              title={isCollapsed ? "Buat Database & Tabel" : ""}
            >
              <FilePlus className={`w-5 h-5 shrink-0 ${currentPage === 'schema' ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
              {!isCollapsed && <span>Buat Database & Tabel</span>}
            </div>
          )}

          <div 
            onClick={() => handleNavigate('dashboard')}
            className={navItemClass('dashboard')}
            title={isCollapsed ? "Upload Data" : ""}
          >
            <Activity className={`w-5 h-5 shrink-0 ${currentPage === 'dashboard' ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
            {!isCollapsed && <span>Upload Data</span>}
          </div>

          <div 
            onClick={() => handleNavigate('explorer')}
            className={navItemClass('explorer')}
            title={isCollapsed ? "Lihat Data" : ""}
          >
            <Table className={`w-5 h-5 shrink-0 ${currentPage === 'explorer' ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
            {!isCollapsed && <span>Lihat Data</span>}
          </div>

          {user.role === UserRole.ADMIN && (
            <>
              {!isCollapsed ? (
                <div className="px-4 py-3 mt-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest animate-in fade-in">
                  Administrasi
                </div>
              ) : (
                <div className="h-4 border-b border-gray-100 mx-4 my-2"></div>
              )}
              <div 
                onClick={() => handleNavigate('users')}
                className={navItemClass('users')}
                title={isCollapsed ? "Manajemen Pengguna" : ""}
              >
                <Users className={`w-5 h-5 shrink-0 ${currentPage === 'users' ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                {!isCollapsed && <span>Manajemen Pengguna</span>}
              </div>
            </>
          )}
        </nav>

        {/* Desktop Collapse Toggle */}
        <div className="hidden md:flex justify-end px-4 pb-2">
           <button 
             onClick={() => setIsCollapsed(!isCollapsed)}
             className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
           >
              {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
           </button>
        </div>

        {/* User Profile Footer */}
        <div className={`p-4 m-4 bg-gray-50 rounded-2xl border border-gray-100 ${isCollapsed ? 'flex flex-col items-center gap-2 p-2 mx-2' : ''}`}>
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center mb-0' : 'mb-3'}`}>
            <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-sm text-brand-600 shadow-sm shrink-0">
              {user.username.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden animate-in fade-in">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.username}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  {user.role === UserRole.ADMIN && <ShieldCheck className="w-3 h-3 text-brand-500" />}
                  <span className="capitalize">{user.role}</span>
                </p>
              </div>
            )}
          </div>
          <button 
            onClick={onLogout}
            disabled={isLocked}
            className={`flex items-center justify-center gap-2 bg-white hover:bg-red-50 hover:border-red-100 hover:text-red-600 border border-gray-200 text-gray-600 py-2 rounded-xl transition-all text-xs font-semibold shadow-sm ${isLocked ? 'opacity-50 cursor-not-allowed' : ''} ${isCollapsed ? 'w-10 h-10 p-0' : 'w-full'}`}
            title="Keluar"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && "Keluar"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-gray-50 w-full">
        <header className="bg-white/80 backdrop-blur-md h-20 border-b border-gray-200 flex items-center justify-between px-4 md:px-10 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900 truncate max-w-[200px] md:max-w-none">
                {currentPage === 'dashboard' ? 'Upload Data' : 
                 currentPage === 'schema' ? 'Desain Database' :
                 currentPage === 'explorer' ? 'Data Explorer' :
                 'Pengguna Sistem'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 hidden md:block">
                {currentPage === 'dashboard' ? 'Proses upload batch & input data' : 
                 currentPage === 'schema' ? 'Buat dan atur tabel database' :
                 currentPage === 'explorer' ? 'Lihat dan monitoring data tabel' :
                 'Atur akses dan peran pengguna'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0"></span>
                <span className="hidden sm:inline">agrabudi.com:52306</span>
                <span className="sm:hidden">DB On</span>
             </div>
          </div>
        </header>
        <div className="p-4 md:p-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};