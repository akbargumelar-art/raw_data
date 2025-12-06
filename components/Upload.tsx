import React, { useState, useEffect } from 'react';
import { Upload as UploadIcon, FileSpreadsheet, AlertTriangle, CheckCircle, RefreshCw, Database } from 'lucide-react';
import { dataService } from '../services/api';
import { UploadStatus } from '../types';

interface UploadProps {
  setIsLocked: (locked: boolean) => void;
}

export const Upload: React.FC<UploadProps> = ({ setIsLocked }) => {
  const [file, setFile] = useState<File | null>(null);
  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  
  const [selectedDB, setSelectedDB] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [status, setStatus] = useState<UploadStatus>({ status: 'idle', progress: 0 });
  
  useEffect(() => {
    dataService.getDatabases()
      .then(setDatabases)
      .catch(err => console.error("Failed to fetch databases", err));
  }, []);

  useEffect(() => {
    if (selectedDB) {
      setTables([]);
      setSelectedTable('');
      dataService.getTables(selectedDB)
        .then(setTables)
        .catch(err => console.error("Failed to fetch tables", err));
    } else {
      setTables([]);
    }
  }, [selectedDB]);

  useEffect(() => {
    const isWorking = status.status === 'uploading' || status.status === 'processing';
    setIsLocked(isWorking);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isWorking) {
        e.preventDefault();
        e.returnValue = 'Upload in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status.status, setIsLocked]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus({ status: 'idle', progress: 0 });
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedTable || !selectedDB) return;

    setStatus({ status: 'uploading', progress: 0, message: 'Uploading file stream...' });

    try {
      const result = await dataService.uploadFile(file, selectedDB, selectedTable, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || file.size));
        setStatus(prev => ({ 
          ...prev, 
          status: 'uploading', 
          progress: percentCompleted > 90 ? 90 : percentCompleted 
        }));
      });

      setStatus({ 
        status: 'success', 
        progress: 100, 
        message: `Successfully processed ${result.rowsProcessed} rows.` 
      });
      setFile(null);
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.error || "Connection lost or format invalid.";
      setStatus({ 
        status: 'error', 
        progress: 0, 
        message: errorMsg 
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Configuration Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
          <div className="bg-brand-50 p-2.5 rounded-xl text-brand-600">
            <Database className="w-5 h-5" />
          </div>
          Target Configuration
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Target Database</label>
            <select
              value={selectedDB}
              onChange={(e) => setSelectedDB(e.target.value)}
              disabled={status.status === 'uploading'}
              className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none bg-gray-50 text-gray-700 text-sm"
            >
              <option value="">-- Select Database --</option>
              {databases.map(db => (
                <option key={db} value={db}>{db}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Target Table</label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              disabled={!selectedDB || status.status === 'uploading'}
              className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none bg-gray-50 disabled:opacity-50 text-gray-700 text-sm"
            >
              <option value="">-- Select Target Table --</option>
              {tables.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mt-6 px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-blue-700 flex justify-between items-center">
             <span><span className="font-bold">Strategy:</span> UPSERT (Insert new, Update existing)</span>
             <span className="opacity-70">* Headers must match columns</span>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
         <div className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
           file ? 'border-brand-400 bg-brand-50/30' : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
         }`}>
            <input 
              type="file" 
              id="fileInput" 
              className="hidden" 
              accept=".csv,.xlsx" 
              onChange={handleFileChange}
              disabled={status.status === 'uploading'}
            />
            
            {!file ? (
              <label htmlFor="fileInput" className="cursor-pointer block group">
                <div className="w-20 h-20 bg-brand-50 text-brand-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-sm">
                  <UploadIcon className="w-10 h-10" />
                </div>
                <h4 className="text-xl font-bold text-gray-800">Drop file or click to upload</h4>
                <p className="text-gray-400 mt-2 text-sm">Supports CSV & Excel (Max 100MB)</p>
              </label>
            ) : (
              <div className="animate-in zoom-in-95 duration-200">
                <FileSpreadsheet className="w-16 h-16 text-brand-600 mx-auto mb-4 drop-shadow-lg" />
                <p className="text-xl font-bold text-gray-800">{file.name}</p>
                <p className="text-gray-400 mb-8 font-medium">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                
                {status.status === 'idle' || status.status === 'error' ? (
                   <div className="flex justify-center gap-4">
                     <button 
                      onClick={() => setFile(null)}
                      className="px-6 py-2.5 text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                     >
                       Change File
                     </button>
                     <button 
                      onClick={handleUpload}
                      disabled={!selectedTable || !selectedDB}
                      className="px-8 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-200 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                     >
                       Start Processing
                     </button>
                   </div>
                ) : null}
              </div>
            )}
         </div>

         {/* Status Display */}
         {status.status !== 'idle' && (
           <div className="mt-8">
             <div className="flex items-center justify-between mb-2">
                <span className={`font-bold text-sm ${
                  status.status === 'error' ? 'text-red-700' : 
                  status.status === 'success' ? 'text-green-600' : 'text-brand-600'
                }`}>
                  {status.status === 'uploading' ? 'Uploading & Processing...' : 
                   status.status === 'success' ? 'Complete' : 
                   status.status === 'error' ? 'Failed' : ''}
                </span>
                <span className="text-gray-400 text-xs font-mono bg-gray-100 px-2 py-1 rounded">{status.progress}%</span>
             </div>
             
             <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
               <div 
                 className={`h-full transition-all duration-500 ease-out rounded-full ${
                    status.status === 'error' ? 'bg-red-600' : 
                    status.status === 'success' ? 'bg-green-500' : 'bg-brand-500 relative'
                 }`}
                 style={{ width: `${status.progress}%` }}
               >
                 {status.status === 'uploading' && (
                   <div className="absolute inset-0 bg-white/30 animate-[shimmer_1.5s_infinite]"></div>
                 )}
               </div>
             </div>

             {status.message && (
               <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 text-sm border shadow-sm ${
                 status.status === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 
                 status.status === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 
                 'bg-brand-50 text-brand-700 border-brand-100'
               }`}>
                  {status.status === 'error' && <AlertTriangle className="w-5 h-5 shrink-0" />}
                  {status.status === 'success' && <CheckCircle className="w-5 h-5 shrink-0" />}
                  {status.status === 'uploading' && <RefreshCw className="w-5 h-5 shrink-0 animate-spin" />}
                  <span className="leading-relaxed font-medium">{status.message}</span>
               </div>
             )}
           </div>
         )}
      </div>
    </div>
  );
};