import React, { useState, useEffect } from 'react';
import { Upload as UploadIcon, FileSpreadsheet, AlertTriangle, CheckCircle, RefreshCw, Database, Table as TableIcon, ArrowRight, Server, ChevronRight } from 'lucide-react';
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
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedTable || !selectedDB) return;

    setStatus({ status: 'uploading', progress: 0, message: 'Membaca file & menyiapkan batch...' });

    try {
      const result = await dataService.uploadFile(file, selectedDB, selectedTable, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || file.size));
        // Cap visual progress at 90% until backend confirms completion
        setStatus(prev => ({ 
          ...prev, 
          status: 'uploading', 
          progress: percentCompleted > 90 ? 90 : percentCompleted 
        }));
      });

      setStatus({ 
        status: 'success', 
        progress: 100, 
        message: `Sukses! Berhasil memproses ${result.rowsProcessed} baris data.` 
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

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. Database Selection (CARDS) */}
      <section>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
           <Database className="w-4 h-4" /> 1. Pilih Database Tujuan
        </h3>
        
        {databases.length === 0 ? (
           <div className="p-8 text-center bg-gray-50 border border-gray-200 rounded-2xl text-gray-400">
              Memuat Database...
           </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {databases.map(db => (
              <button
                key={db}
                onClick={() => {
                   if(status.status !== 'uploading') setSelectedDB(db);
                }}
                className={`relative group p-4 rounded-2xl border text-left transition-all duration-200 shadow-sm hover:shadow-md flex flex-col gap-3 ${
                  selectedDB === db 
                    ? 'bg-brand-600 border-brand-600 text-white ring-4 ring-brand-100' 
                    : 'bg-white border-gray-200 text-gray-600 hover:border-brand-300 hover:bg-gray-50'
                } ${status.status === 'uploading' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`p-2 rounded-xl w-fit ${selectedDB === db ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-brand-50'}`}>
                  <Server className={`w-5 h-5 ${selectedDB === db ? 'text-white' : 'text-gray-500 group-hover:text-brand-600'}`} />
                </div>
                <div>
                   <span className="text-xs font-semibold opacity-70 block mb-0.5">Database</span>
                   <span className="font-bold text-sm truncate block" title={db}>{db}</span>
                </div>
                {selectedDB === db && (
                  <div className="absolute top-4 right-4">
                     <CheckCircle className="w-5 h-5 text-white/90" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 2. Table Selection (PILLS) */}
      {selectedDB && (
        <section className="animate-in fade-in slide-in-from-left-2 duration-300">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TableIcon className="w-4 h-4" /> 2. Pilih Tabel Tujuan
          </h3>
          
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
             {loadingTables ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                   <RefreshCw className="w-4 h-4 animate-spin" /> Mengambil tabel dari <strong>{selectedDB}</strong>...
                </div>
             ) : tables.length === 0 ? (
                <div className="text-gray-400 text-sm italic">
                   Tidak ada tabel ditemukan di database ini.
                </div>
             ) : (
                <div className="flex flex-wrap gap-2">
                   {tables.map(table => (
                      <button
                        key={table}
                        onClick={() => {
                           if(status.status !== 'uploading') setSelectedTable(table);
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border flex items-center gap-2 ${
                           selectedTable === table
                             ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-sm ring-1 ring-brand-200'
                             : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        } ${status.status === 'uploading' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                         <TableIcon className="w-3.5 h-3.5 opacity-70" />
                         {table}
                         {selectedTable === table && <CheckCircle className="w-3.5 h-3.5 text-brand-600" />}
                      </button>
                   ))}
                </div>
             )}
          </div>
        </section>
      )}

      {/* 3. File Upload Area */}
      {selectedDB && selectedTable && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
             <UploadIcon className="w-4 h-4" /> 3. Upload File Data
           </h3>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
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
                    <div className="w-20 h-20 bg-brand-50 text-brand-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-sm">
                      <UploadIcon className="w-10 h-10" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-800">Tarik file Excel atau CSV ke sini</h4>
                    <p className="text-gray-400 mt-2 text-sm">Mendukung .xlsx, .xls, .csv (Maks 100MB)</p>
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
                          Ganti File
                        </button>
                        <button 
                          onClick={handleUpload}
                          disabled={!selectedTable || !selectedDB}
                          className="px-8 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-200 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
                        >
                          Mulai Upload <ArrowRight className="w-4 h-4" />
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
                      {status.status === 'uploading' ? 'Sedang Memproses Data...' : 
                      status.status === 'success' ? 'Upload Selesai' : 
                      status.status === 'error' ? 'Upload Gagal' : ''}
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
        </section>
      )}
    </div>
  );
};