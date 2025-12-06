
import { User, UserRole, AuthResponse, SchemaAnalysis, TableColumn } from '../types';

// --- IN-MEMORY MOCK DATABASE ---
let mockUsers: User[] = [
  { id: 1, username: 'admin', role: UserRole.ADMIN },
  { id: 2, username: 'operator', role: UserRole.OPERATOR }
];

const mockPasswords: Record<string, string> = {
  'admin': 'admin123',
  'operator': 'op123'
};

// Store tables in memory for the session
const mockTables: Record<string, string[]> = {
  'db_raw': ['products', 'orders'],
  'analytics_warehouse': ['daily_sales', 'monthly_reports'],
  'staging_db': ['test_table']
};

// --- HELPER ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockAuthService = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    await delay(800); // Simulate network latency
    
    if (mockPasswords[username] === password) {
      const user = mockUsers.find(u => u.username === username);
      if (user) {
        return {
          token: 'mock-jwt-token-xyz-123',
          user
        };
      }
    }
    throw { response: { data: { error: 'Invalid credentials (Mock)' } } };
  },
  
  verify: async (): Promise<User> => {
    await delay(300);
    // Always assume valid session if token exists in localStorage for demo
    return mockUsers[0]; 
  }
};

export const mockDataService = {
  getDatabases: async (): Promise<string[]> => {
    await delay(500);
    return Object.keys(mockTables);
  },

  getTables: async (dbName: string): Promise<string[]> => {
    await delay(400);
    return mockTables[dbName] || [];
  },

  // Simulate analyzing a CSV file
  analyzeFile: async (file: File): Promise<SchemaAnalysis> => {
    await delay(1000);
    // Return dummy columns based on typical ecommerce data
    return {
      columns: [
        { name: 'sku', type: 'VARCHAR(255)', isPrimaryKey: true },
        { name: 'product_name', type: 'VARCHAR(255)' },
        { name: 'category', type: 'VARCHAR(100)' },
        { name: 'price', type: 'DECIMAL(10,2)' },
        { name: 'stock_qty', type: 'INT' },
        { name: 'created_at', type: 'DATETIME' }
      ],
      previewData: [
        { sku: 'ABC-123', product_name: 'Gaming Mouse', category: 'Electronics', price: 45.99, stock_qty: 150, created_at: '2024-01-01' },
        { sku: 'ABC-124', product_name: 'Keyboard', category: 'Electronics', price: 120.00, stock_qty: 50, created_at: '2024-01-02' }
      ]
    };
  },

  createTable: async (databaseName: string, tableName: string, columns: TableColumn[]) => {
    await delay(1000);
    if (!mockTables[databaseName]) mockTables[databaseName] = [];
    
    if (mockTables[databaseName].includes(tableName)) {
      throw { response: { data: { error: `Table '${tableName}' already exists in ${databaseName}` } } };
    }

    mockTables[databaseName].push(tableName);
    return { success: true };
  },

  uploadFile: async (
    file: File, 
    databaseName: string,
    tableName: string, 
    onUploadProgress: (progressEvent: any) => void
  ) => {
    // SIMULATE UPLOAD STREAMING
    const totalSize = file.size;
    let loaded = 0;
    const chunkSize = totalSize / 20; // Simulate 20 chunks

    for (let i = 0; i <= 20; i++) {
      await delay(200); // Wait 200ms per chunk
      loaded = Math.min(loaded + chunkSize, totalSize);
      
      onUploadProgress({
        loaded: loaded,
        total: totalSize
      });
    }

    // Return dummy success result
    return {
      success: true,
      rowsProcessed: Math.floor(Math.random() * 5000) + 500,
      message: 'Mock upload complete'
    };
  }
};

export const mockAdminService = {
  getUsers: async (): Promise<User[]> => {
    await delay(400);
    return [...mockUsers];
  },

  createUser: async (username: string, password: string, role: UserRole) => {
    await delay(600);
    const newId = Math.max(...mockUsers.map(u => u.id)) + 1;
    const newUser = { id: newId, username, role };
    mockUsers.push(newUser);
    mockPasswords[username] = password;
    return { success: true };
  },

  deleteUser: async (id: number) => {
    await delay(400);
    mockUsers = mockUsers.filter(u => u.id !== id);
    return { success: true };
  }
};
