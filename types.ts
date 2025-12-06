
export enum UserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator'
}

export interface User {
  id: number;
  username: string;
  role: UserRole;
  allowedDatabases?: string[]; // List of DB names authorized for this user
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface DatabaseMetadata {
  tables: string[];
}

export interface UploadStatus {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  message?: string;
  processedRows?: number;
}

export interface TableColumn {
  name: string;
  type: string; // e.g., 'VARCHAR(255)', 'INT', 'TEXT'
  isPrimaryKey?: boolean;
}

export interface SchemaAnalysis {
  columns: TableColumn[];
  previewData: any[];
}

export interface TableStats {
  rows: number;
  dataLength: number; // in bytes
  indexLength: number; // in bytes
  createdAt: string | null;
  collation: string;
}
