import axios from 'axios';
import { API_URL, LOCAL_STORAGE_KEY, USE_MOCK_API } from '../constants';
import { AuthResponse, User, UserRole, SchemaAnalysis, TableColumn, TableStats } from '../types';
import { mockAuthService, mockDataService, mockAdminService } from './mockApi';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- WRAPPER TO SWITCH IMPLEMENTATION ---

export const authService = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    if (USE_MOCK_API) return mockAuthService.login(username, password);
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },
  
  verify: async (): Promise<User> => {
    if (USE_MOCK_API) return mockAuthService.verify();
    const response = await api.get('/auth/me');
    return response.data;
  }
};

export const dataService = {
  getDatabases: async (): Promise<string[]> => {
    if (USE_MOCK_API) return mockDataService.getDatabases();
    const response = await api.get('/data/databases');
    return response.data.databases;
  },

  createDatabase: async (databaseName: string): Promise<void> => {
    if (USE_MOCK_API) return; 
    await api.post('/data/create-database', { databaseName });
  },

  getTables: async (dbName: string): Promise<string[]> => {
    if (USE_MOCK_API) return mockDataService.getTables(dbName);
    const response = await api.get(`/data/tables?db=${dbName}`);
    return response.data.tables;
  },

  getTableSchema: async (dbName: string, tableName: string): Promise<TableColumn[]> => {
    if (USE_MOCK_API) return []; 
    const response = await api.get(`/data/table-schema?db=${dbName}&table=${tableName}`);
    return response.data;
  },

  alterTableColumn: async (dbName: string, tableName: string, columnName: string, newType: string): Promise<void> => {
    if (USE_MOCK_API) return;
    await api.post('/data/alter-table', { databaseName: dbName, tableName, columnName, newType });
  },

  getTableStats: async (dbName: string, tableName: string): Promise<TableStats> => {
    if (USE_MOCK_API) return { rows: 0, dataLength: 0, indexLength: 0, createdAt: null, collation: '' };
    const response = await api.get(`/data/table-stats?db=${dbName}&table=${tableName}`);
    return response.data;
  },

  // UPDATED: Support Sorting
  getTableData: async (
    dbName: string, 
    tableName: string, 
    page: number = 1, 
    limit: number = 20,
    sortColumn?: string,
    sortDirection?: 'asc' | 'desc'
  ): Promise<{data: any[], total: number}> => {
    if (USE_MOCK_API) return { data: [], total: 0 };
    
    let url = `/data/preview?db=${dbName}&table=${tableName}&page=${page}&limit=${limit}`;
    if (sortColumn) {
      url += `&sort=${sortColumn}&dir=${sortDirection || 'asc'}`;
    }
    
    const response = await api.get(url);
    return response.data;
  },

  // NEW: Download Excel
  exportTable: async (dbName: string, tableName: string) => {
    if (USE_MOCK_API) return;
    const response = await api.get(`/data/export?db=${dbName}&table=${tableName}`, {
      responseType: 'blob' 
    });
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${tableName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  // NEW: Run Raw SQL Query
  runQuery: async (databaseName: string, query: string): Promise<any[]> => {
    if (USE_MOCK_API) return [];
    const response = await api.post('/data/query', { databaseName, query });
    return response.data;
  },

  analyzeFile: async (file: File): Promise<SchemaAnalysis> => {
    if (USE_MOCK_API) return mockDataService.analyzeFile(file);
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/data/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  createTable: async (databaseName: string, tableName: string, columns: TableColumn[]) => {
    if (USE_MOCK_API) return mockDataService.createTable(databaseName, tableName, columns);
    const response = await api.post('/data/create-table', { databaseName, tableName, columns });
    return response.data;
  },

  uploadFile: async (
    file: File, 
    databaseName: string,
    tableName: string, 
    onUploadProgress: (progressEvent: any) => void
  ) => {
    if (USE_MOCK_API) return mockDataService.uploadFile(file, databaseName, tableName, onUploadProgress);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('databaseName', databaseName);
    formData.append('tableName', tableName);

    const response = await api.post('/data/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
      timeout: 600000 
    });
    return response.data;
  }
};

export const adminService = {
  getUsers: async (): Promise<User[]> => {
    if (USE_MOCK_API) return mockAdminService.getUsers();
    const response = await api.get('/admin/users');
    return response.data;
  },

  createUser: async (username: string, password: string, role: UserRole, allowedDatabases: string[] = []) => {
    if (USE_MOCK_API) return mockAdminService.createUser(username, password, role);
    const response = await api.post('/admin/users', { username, password, role, allowedDatabases });
    return response.data;
  },

  deleteUser: async (id: number) => {
    if (USE_MOCK_API) return mockAdminService.deleteUser(id);
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
  }
};