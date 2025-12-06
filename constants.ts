
// Set to TRUE to force "Offline/Demo Mode" without backend connection
// Useful for previewing UI/UX without running the Node.js server
export const USE_MOCK_API = true;

// Use relative path for API. 
// In Development: Vite proxy sends '/api' -> 'http://localhost:6002/api'
// In Production: Nginx or Express serves static files and handles '/api' on the same port.
export const API_URL = '/api';

export const LOCAL_STORAGE_KEY = 'dataflow_token';
