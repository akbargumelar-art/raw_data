import React, { useState, useEffect } from 'react';
import { dataService } from '../services/api';
import { TableStats } from '../types';
import { Database, Table as TableIcon, Server, Search, ChevronRight, ChevronLeft, HardDrive, Calendar, RefreshCw } from 'lucide-react';

export const DataExplorer: React.FC = () => {
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDB, setSelectedDB] = useState('');
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState('');

  const [stats, setStats] = useState<TableStats | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Load Databases on Mount
  useEffect(() => {
    dataService.getDatabases()
      .then(setDatabases)
      .catch(console.error);
  }, []);

  // Load Tables when DB changes
  useEffect(() => {
    if (selectedDB) {
      setTables([]);
      setSelectedTable('');
      setStats(null);
      setData([]);
      dataService.getTables(selectedDB)
        .then(setTables)
        .catch(console.error);
    }
  }, [selectedDB]);

  // Load Stats & Data when Table changes or Page changes
  useEffect(() => {
    if (selectedDB && selectedTable) {
      setLoading(true);
      
      // Load Stats (Summary)
      dataService.getTableStats(selectedDB, selectedTable)
        .then(setStats)
        .catch(console.error);
      
      // Load Actual Data
      dataService.getTableData(selectedDB, selectedTable, page, 15)
        .then(res => {
          setData(res.data || []);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [selectedDB, selectedTable, page]);

  // Reset page when table changes
  useEffect(() => {
    setPage(1);
  }, [selectedTable]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* 1. SELECTION BAR */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
         <div className="flex-1 w-full">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block pl-1">Database</label>
            <div className="relative">
              <Database className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <select 
                value={selectedDB}
                onChange={e => setSelectedDB(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none transition-all appearance-none cursor-pointer hover:bg-gray-100"
              >
                <option value="">-- Pilih Database --</option>
                {databases.map(db => <option key={db} value={db}>{db}</option>)}
              </select>
            </div>
         </div>
         <div className="flex-1 w-full">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block pl-1">Tabel</label>
            <div className="relative">
              <TableIcon className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <select 
                value={selectedTable}
                onChange={e => setSelectedTable(e.target.value)}
                disabled={!selectedDB}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none transition-all appearance-none cursor-pointer hover:bg-gray-100 disabled:opacity-50"
              >
                <option value="">-- Pilih Tabel --</option>
                {tables.map(tb => <option key={tb} value={tb}>{tb}</option>)}
              </select>
            </div>
         </div>
      </div>

      {selectedDB && selectedTable && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
          
          {/* 2. STATS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {/* Total Rows */}
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                   <Server className="w-6 h-6" />
                </div>
                <div>
                   <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Baris</p>
                   <p className="text-2xl font-bold text-gray-900">{stats ? stats.rows.toLocaleString('id-ID') : '-'}</p>
                </div>
             </div>

             {/* Size */}
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                   <HardDrive className="w-6 h-6" />
                </div>
                <div>
                   <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Ukuran Data</p>
                   <p className="text-2xl font-bold text-gray-900">{stats ? formatBytes(stats.dataLength + stats.indexLength) : '-'}</p>
                </div>
             </div>

             {/* Created At */}
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                   <Calendar className="w-6 h-6" />
                </div>
                <div>
                   <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Dibuat Pada</p>
                   <p className="text-sm font-bold text-gray-900">{stats ? formatDate(stats.createdAt) : '-'}</p>
                </div>
             </div>
          </div>

          {/* 3. DATA TABLE */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[400px]">
             <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                   <Search className="w-4 h-4 text-gray-400" />
                   Preview Data (Hal. {page})
                </h3>
                <div className="flex gap-2">
                   <button 
                     onClick={() => setPage(p => Math.max(1, p - 1))}
                     disabled={page === 1 || loading}
                     className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                   >
                     <ChevronLeft className="w-4 h-4 text-gray-600" />
                   </button>
                   <button 
                     onClick={() => setPage(p => p + 1)}
                     disabled={data.length < 15 || loading}
                     className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                   >
                     <ChevronRight className="w-4 h-4 text-gray-600" />
                   </button>
                </div>
             </div>

             <div className="flex-1 overflow-x-auto custom-scrollbar">
                {loading ? (
                   <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                      <RefreshCw className="w-8 h-8 animate-spin text-brand-200" />
                      <span className="text-xs font-medium">Memuat data...</span>
                   </div>
                ) : data.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-64 text-gray-300">
                      <TableIcon className="w-12 h-12 mb-2 opacity-20" />
                      <p>Tidak ada data</p>
                   </div>
                ) : (
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        {Object.keys(data[0]).map(key => (
                          <th key={key} className="px-6 py-4 border-b border-gray-100">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                          {Object.values(row).map((val: any, i) => (
                            <td key={i} className="px-6 py-3 text-gray-600 max-w-xs truncate">
                               {val === null ? <span className="text-gray-300 italic">null</span> : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
             </div>
          </div>

        </div>
      )}

      {!selectedDB && (
        <div className="flex flex-col items-center justify-center h-[50vh] text-gray-300 gap-4">
           <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
             <Database className="w-10 h-10 opacity-20" />
           </div>
           <p className="text-sm font-medium">Pilih Database untuk melihat data</p>
        </div>
      )}

    </div>
  );
};
