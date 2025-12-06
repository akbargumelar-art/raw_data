import React, { useState, useEffect } from 'react';
import { Upload as UploadIcon, FileSpreadsheet, AlertTriangle, CheckCircle, RefreshCw, Database, Table as TableIcon, ArrowRight, Server, ChevronRight, Clock } from 'lucide-react';
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
  const [loadingTables, setLoadingTables] = useState(false);
  const [uploadStats, setUploadStats] = useState<{processed: number, changed: number} | null>(null);
  
  useEffect(() => {
    dataService.getDatabases()
      .then(setDatabases)
      .catch(err => console.error("Gagal memuat database", err));
  }, []);

  useEffect(() => {
    if (selectedDB) {
      setLoadingTables(true);
      setTables([]);
      setSelectedTable('');
      dataService.getTables(selectedDB)
        .then((data) => {
           setTables(data);
           setLoadingTables(false);
        })
        .catch(err => {
           console.error("Gagal memuat tabel", err);
           setLoadingTables(false);
        });
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
        e.returnValue = 'Upload sedang berjalan. Yakin ingin keluar?';
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
      setUploadStats(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedTable || !selectedDB) return;

    setStatus({ status: 'uploading', progress: 0, message: 'Membaca file & menyiapkan batch...' });
    setUploadStats(null);

    try {
      const result = await dataService.uploadFile(file, selectedDB, selectedTable, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || file.size));
        setStatus(prev => ({ 
          ...prev, 
          status: 'uploading', 
          progress: percentCompleted > 90 ? 90 : percentCompleted 
        }));
      });

      setUploadStats({ processed: result.rowsProcessed, changed: result.changes });
      setStatus({ 
        status: 'success', 
        progress: 100, 
        message: 'Upload Selesai'
      });
      setFile(null);
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.error || "Koneksi terputus atau format file salah.";
      setStatus({ 
        status: 'error', 
        progress: 0, 
        message: errorMsg 
      });
    }
  };

  const getCurrentTimeWIB = () => {
    return new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'full',
      timeStyle: 'medium'
    }) + ' WIB';
  };

  return (
    <div className="h-[calc(100vh-140px)] grid grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* COLUMN 1: DATABASE LIST (Span 3) */}
      <div className="col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
             <Database className="w-3.5 h-3.5" /> 1. Database
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
           {databases.length === 0 ? (
             <div className="text-center text-xs text-gray-400 py-4">Memuat...</div>
           ) : (
             databases.map(db => (
               <button
                 key={db}
                 onClick={() => { if(status.status !== 'uploading') setSelectedDB(db); }}
                 className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group ${
                   selectedDB === db 
                     ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200' 
                     : 'hover:bg-gray-50 text-gray-600 border border-transparent'
                 } ${status.status === 'uploading' ? 'opacity-50 cursor-not-allowed' : ''}`}
               >
                 <div className="flex items-center gap-3 overflow-hidden">
                    <Server className={`w-4 h-4 shrink-0 ${selectedDB === db ? 'text-brand-600' : 'text-gray-400'}`} />
                    <span className="truncate text-sm">{db}</span>
                 </div>
                 {selectedDB === db && <ChevronRight className="w-4 h-4 text-brand-400" />}
               </button>
             ))
           )}
        </div>
      </div>

      {/* COLUMN 2: TABLE LIST (Span 3) */}
      <div className="col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
             <TableIcon className="w-3.5 h-3.5" /> 2. Tabel
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
           {!selectedDB ? (
             <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                <Database className="w-8 h-8 opacity-20" />
                <span className="text-xs">Pilih database dulu</span>
             </div>
           ) : loadingTables ? (
             <div className="flex items-center justify-center py-8 text-gray-400 gap-2 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin" /> Memuat tabel...
             </div>
           ) : tables.length === 0 ? (
             <div className="text-center text-xs text-gray-400 py-8 italic">Tidak ada tabel</div>
           ) : (
             tables.map(table => (
               <button
                 key={table}
                 onClick={() => { if(status.status !== 'uploading') setSelectedTable(table); }}
                 className={`w-full text-left px-4 py-2.5 rounded-lg transition-all flex items-center justify-between ${
                   selectedTable === table 
                     ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200 shadow-sm' 
                     : 'hover:bg-gray-50 text-gray-600 border border-transparent'
                 } ${status.status === 'uploading' ? 'opacity-50 cursor-not-allowed' : ''}`}
               >
                 <div className="flex items-center gap-2 overflow-hidden">
                    <TableIcon className={`w-3.5 h-3.5 shrink-0 ${selectedTable === table ? 'text-brand-500' : 'text-gray-300'}`} />
                    <span className="truncate text-sm">{table}</span>
                 </div>
                 {selectedTable === table && <CheckCircle className="w-3.5 h-3.5 text-brand-500" />}
               </button>
             ))
           )}
        </div>
      </div>

      {/* COLUMN 3: UPLOAD AREA (Span 6) */}
      <div className="col-span-6 flex flex-col">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 p-8 flex flex-col">
           <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-1">
                <UploadIcon className="w-3.5 h-3.5" /> 3. Upload File
              </h3>
              <p className="text-xs text-gray-400">Pastikan format kolom Excel sesuai dengan tabel.</p>
           </div>

           {!selectedDB || !selectedTable ? (
             <div className="flex-1 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-300 gap-3">
               <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                 <AlertTriangle className="w-8 h-8 opacity-20" />
               </div>
               <p className="text-sm">Pilih Database & Tabel untuk mulai</p>
             </div>
           ) : (
             <div className="flex-1 flex flex-col justify-center">
                <div className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 ${
                  file ? 'border-brand-400 bg-brand-50/30' : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
                }`}>
                    <input 
                      type="file" 
                      id="fileInput" 
                      className="hidden" 
                      accept=".csv,.xlsx,.xls" 
                      onChange={handleFileChange}
                      disabled={status.status === 'uploading'}
                    />
                    
                    {!file ? (
                      <label htmlFor="fileInput" className="cursor-pointer block group">
                        <div className="w-16 h-16 bg-brand-50 text-brand-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-sm">
                          <UploadIcon className="w-8 h-8" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-800">Upload Excel / CSV</h4>
                        <p className="text-gray-400 mt-2 text-xs">Drag & Drop atau Klik (Max 100MB)</p>
                      </label>
                    ) : (
                      <div className="animate-in zoom-in-95 duration-200">
                        <FileSpreadsheet className="w-12 h-12 text-brand-600 mx-auto mb-3" />
                        <p className="text-lg font-bold text-gray-800 truncate px-4">{file.name}</p>
                        <p className="text-gray-400 mb-6 font-medium text-xs">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                        
                        {status.status === 'idle' || status.status === 'error' ? (
                          <div className="flex justify-center gap-3">
                            <button 
                              onClick={() => setFile(null)}
                              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded-lg transition-colors text-sm"
                            >
                              Ganti
                            </button>
                            <button 
                              onClick={handleUpload}
                              className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-sm"
                            >
                              Mulai Upload <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                </div>

                {/* Status Section */}
                {status.status !== 'idle' && (
                  <div className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between mb-2">
                        <span className={`font-bold text-xs ${
                          status.status === 'error' ? 'text-red-700' : 
                          status.status === 'success' ? 'text-green-600' : 'text-brand-600'
                        }`}>
                          {status.status === 'uploading' ? 'Memproses Data...' : 
                          status.status === 'success' ? 'Upload Selesai' : 'Gagal'}
                        </span>
                        <span className="text-gray-400 text-[10px] font-mono bg-gray-100 px-2 py-0.5 rounded">{status.progress}%</span>
                    </div>
                    
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
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

                    {status.status === 'success' && uploadStats && (
                       <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-xl space-y-2">
                          <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                             <CheckCircle className="w-4 h-4" /> Sukses!
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mt-2">
                             <div className="bg-white p-2 rounded border border-green-100">
                                <span className="block text-[10px] uppercase text-gray-400">Total Data File</span>
                                <span className="font-bold text-gray-900 text-base">{uploadStats.processed}</span>
                             </div>
                             <div className="bg-white p-2 rounded border border-green-100">
                                <span className="block text-[10px] uppercase text-gray-400">Respon Database</span>
                                {/* MySQL affectedRows: 1=Insert, 2=Update. This helps user visualize activity */}
                                <span className="font-bold text-gray-900 text-base">{uploadStats.changed}</span>
                             </div>
                          </div>
                          <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-2 border-t border-green-100 pt-2">
                             <Clock className="w-3 h-3" /> {getCurrentTimeWIB()}
                          </div>
                          <p className="text-[10px] text-gray-500 italic mt-1">
                             *Info: Respon Database menghitung aktifitas Insert (1 poin) dan Update (2 poin). Jika 0, data sudah ada dan sama persis.
                          </p>
                       </div>
                    )}

                    {status.status === 'error' && (
                      <div className="mt-4 p-3 rounded-lg flex items-start gap-2 text-xs border shadow-sm bg-red-50 text-red-700 border-red-200">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span className="leading-relaxed font-medium">{status.message}</span>
                      </div>
                    )}
                  </div>
                )}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};