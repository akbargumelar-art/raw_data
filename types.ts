
export enum UserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator'
}

export interface User {
  id: number;
  username: string;
  role: UserRole;
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
