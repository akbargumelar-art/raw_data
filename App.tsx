import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { authService } from './services/api';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Upload } from './components/Upload';
import { UserManagement } from './components/UserManagement';
import { SchemaBuilder } from './components/SchemaBuilder';
import { LOCAL_STORAGE_KEY } from './constants';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (token) {
        try {
          const userData = await authService.verify();
          handleLogin(userData); // Reuse logic to set correct initial page
        } catch (e) {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          setUser(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const handleLogin = (user: User) => {
    setUser(user);
    // Redirect logic: Admin goes to Schema (Builder), Operator goes to Dashboard (Upload)
    if (user.role === UserRole.ADMIN) {
      setCurrentPage('schema');
    } else {
      setCurrentPage('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <span className="text-gray-400 text-sm font-medium">Initializing System...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout} 
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      isLocked={isLocked}
    >
      {/* ACCESS CONTROL LOGIC */}
      {currentPage === 'schema' && user.role === UserRole.ADMIN && <SchemaBuilder />}
      {currentPage === 'schema' && user.role !== UserRole.ADMIN && (
         <div className="flex flex-col items-center justify-center h-[50vh] text-center">
            <h3 className="text-xl font-bold text-gray-800">Access Restricted</h3>
            <p className="text-gray-500">Only Administrators can create new database structures.</p>
         </div>
      )}

      {currentPage === 'dashboard' && <Upload setIsLocked={setIsLocked} />}
      
      {currentPage === 'users' && user.role === UserRole.ADMIN && <UserManagement />}
      {currentPage === 'users' && user.role !== UserRole.ADMIN && (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
          <h3 className="text-xl font-bold text-gray-800">Access Denied</h3>
          <p className="text-gray-500">You do not have permission to view this page.</p>
        </div>
      )}
    </Layout>
  );
};

export default App;