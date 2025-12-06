import React, { useState, useEffect } from 'react';
import { dataService } from '../services/api';
import { TableStats, TableColumn } from '../types';
import { Database, Table as TableIcon, Server, Search, ChevronRight, ChevronLeft, HardDrive, Calendar, RefreshCw, Download, ArrowUpDown, ArrowUp, ArrowDown, Code, Play, Filter, X } from 'lucide-react';

export const DataExplorer: React.FC = () => {
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDB, setSelectedDB] = useState('');
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState('');

  const [stats, setStats] = useState<{
    rows: number;
    dataLength: number;
    indexLength: number;
    createdAt: string | null;
    updatedAt?: string | null;
  } | null>(null);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState(''); // Trigger search only on Enter/Click

  const [schema, setSchema] = useState<TableColumn[]>([]);
  const [dateColumn, setDateColumn] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // SQL Mode State
  const [sqlMode, setSqlMode] = useState(false);
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResult, setSqlResult] = useState<any[] | null>(null);
  const [executingSql, setExecutingSql] = useState(false);
  const [sqlError, setSqlError] = useState('');

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
      setSchema([]);
      dataService.getTables(selectedDB)
        .then(setTables)
        .catch(console.error);
    }
  }, [selectedDB]);

  // Load Schema to find Date Columns
  useEffect(() => {
    if (selectedDB && selectedTable) {
      // Reset filters
      setDateColumn('');
      setStartDate('');
      setEndDate('');
      setSearchQuery('');
      setActiveSearch('');
      setPage(1);

      dataService.getTableSchema(selectedDB, selectedTable)
        .then(cols => {
           setSchema(cols);
           // Auto-select first date column if exists
           const dateCol = cols.find(c => c.type.includes('DATE') || c.type.includes('TIME'));
           if (dateCol) setDateColumn(dateCol.name);
        })
        .catch(console.error);
    }
  }, [selectedTable, selectedDB]);

  // Load Stats & Data
  useEffect(() => {
    if (selectedDB && selectedTable && !sqlMode) {
      fetchData();
    }
  }, [selectedDB, selectedTable, page, sortConfig, activeSearch, sqlMode]); // Trigger fetch on activeSearch change

  // Filter fetch trigger (separate to prevent loop if deps mixed)
  useEffect(() => {
     if(selectedDB && selectedTable && !sqlMode && startDate && endDate && dateColumn) {
        setPage(1); // Reset to page 1 on filter
        fetchData();
     }
  }, [startDate, endDate, dateColumn]);

  const fetchData = () => {
    setLoading(true);
    dataService.getTableStats(selectedDB, selectedTable)
      .then(res => setStats(res as any)) 
      .catch(console.error);
    
    dataService.getTableData(
      selectedDB, 
      selectedTable, 
      page, 
      15, 
      sortConfig?.key, 
      sortConfig?.direction,
      activeSearch,
      (dateColumn && startDate && endDate) ? { column: dateColumn, start: startDate, end: endDate } : undefined
    )
    .then(res => {
      setData(res.data || []);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleDownload = () => {
    if (selectedDB && selectedTable) {
      dataService.exportTable(selectedDB, selectedTable);
    }
  };

  const handleRunQuery = async () => {
    if (!selectedDB || !sqlQuery) return;
    setExecutingSql(true);
    setSqlError('');
    setSqlResult(null);
    try {
      const result = await dataService.runQuery(selectedDB, sqlQuery);
      setSqlResult(Array.isArray(result) ? result : [{ Info: 'Query dijalankan sukses', Result: JSON.stringify(result) }]);
    } catch (err: any) {
      setSqlError(err.response?.data?.error || 'Gagal menjalankan query.');
    } finally {
      setExecutingSql(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActiveSearch('');
    setStartDate('');
    setEndDate('');
    fetchData();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) + ' WIB';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* 1. SELECTION BAR */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
         <div className="flex flex-col md:flex-row gap-4 items-center">
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
            
            {!sqlMode && (
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
            )}

            {/* TOGGLE SQL MODE */}
            <div className="flex items-end h-full pt-6">
                <button 
                  onClick={() => setSqlMode(!sqlMode)}
                  className={`px-4 py-2.5 rounded-xl border font-bold text-sm flex items-center gap-2 transition-all ${
                    sqlMode ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Code className="w-4 h-4" /> {sqlMode ? 'Tutup SQL' : 'SQL Mode'}
                </button>
            </div>
         </div>

         {/* FILTER BAR (Only in Non-SQL Mode) */}
         {selectedTable && !sqlMode && (
           <div className="border-t border-gray-100 pt-4 animate-in fade-in slide-in-from-top-2">
             <div className="flex flex-col md:flex-row gap-4 items-end">
               {/* Search Input */}
               <div className="flex-1 w-full">
                 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block pl-1">Cari Data</label>
                 <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Cari teks di semua kolom..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && setActiveSearch(searchQuery)}
                      className="w-full pl-9 pr-10 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => { setSearchQuery(''); setActiveSearch(''); }}
                        className="absolute right-3 top-2.5 text-gray-300 hover:text-gray-600"
                      >
                         <X className="w-4 h-4" />
                      </button>
                    )}
                 </div>
               </div>
               
               {/* Search Button */}
               <button 
                 onClick={() => setActiveSearch(searchQuery)} 
                 className="bg-brand-600 hover:bg-brand-700 text-white p-2.5 rounded-xl"
               >
                 <Search className="w-4 h-4" />
               </button>

               <div className="w-px h-8 bg-gray-200 mx-2 hidden md:block"></div>

               {/* Toggle Advanced Filter */}
               <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all ${
                    showFilters || (startDate && endDate) ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-600'
                  }`}
               >
                 <Filter className="w-4 h-4" /> Filter Tanggal
               </button>
             </div>

             {/* Expanded Date Filters */}
             {(showFilters || (startDate && endDate)) && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-in fade-in slide-in-from-top-2">
                   <div className="col-span-1 md:col-span-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block pl-1">Kolom Tanggal (Acuan)</label>
                      <select 
                         value={dateColumn} 
                         onChange={e => setDateColumn(e.target.value)}
                         className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"
                      >
                         <option value="">-- Pilih Kolom --</option>
                         {schema.filter(c => c.type.includes('DATE') || c.type.includes('TIME')).map(c => (
                            <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                         ))}
                      </select>
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block pl-1">Mulai</label>
                      <input 
                         type="date" 
                         value={startDate}
                         onChange={e => setStartDate(e.target.value)}
                         className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block pl-1">Sampai</label>
                      <input 
                         type="date" 
                         value={endDate}
                         onChange={e => setEndDate(e.target.value)}
                         className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"
                      />
                   </div>
                </div>
             )}
           </div>
         )}
      </div>

      {/* === SQL MODE INTERFACE === */}
      {sqlMode ? (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
           <div className="bg-gray-900 rounded-2xl p-6 shadow-xl text-white mb-6">
              <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                 <Server className="w-4 h-4" /> SQL Query Runner
              </h3>
              <textarea
                 value={sqlQuery}
                 onChange={e => setSqlQuery(e.target.value)}
                 className="w-full h-32 bg-gray-800 border border-gray-700 rounded-xl p-4 font-mono text-sm focus:ring-2 focus:ring-brand-500/50 outline-none text-green-400"
                 placeholder="SELECT * FROM table WHERE..."
              ></textarea>
              <div className="flex justify-between items-center mt-4">
                 <p className="text-xs text-gray-500 italic">*Hati-hati, query dieksekusi langsung ke database.</p>
                 <button 
                   onClick={handleRunQuery}
                   disabled={executingSql || !selectedDB || !sqlQuery}
                   className="px-6 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                 >
                    {executingSql ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4 fill-current"/>}
                    Jalankan
                 </button>
              </div>
           </div>

           {sqlError && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-xl mb-6 font-mono text-sm">
                 Error: {sqlError}
              </div>
           )}

           {sqlResult && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                 <div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-gray-700 text-sm">
                    Hasil Query ({sqlResult.length} baris)
                 </div>
                 <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                    {sqlResult.length === 0 ? (
                       <div className="p-8 text-center text-gray-400 italic">Tidak ada data</div>
                    ) : (
                       <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-gray-100 text-gray-600 font-bold text-xs uppercase sticky top-0">
                             <tr>
                                {Object.keys(sqlResult[0]).map(key => (
                                   <th key={key} className="px-6 py-3 border-b border-gray-200">{key}</th>
                                ))}
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                             {sqlResult.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                   {Object.values(row).map((val: any, i) => (
                                      <td key={i} className="px-6 py-3 text-gray-700">{val === null ? 'NULL' : String(val)}</td>
                                   ))}
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    )}
                 </div>
              </div>
           )}
        </div>
      ) : (
        /* === NORMAL EXPLORER MODE === */
        selectedDB && selectedTable && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            
            {/* STATS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Server className="w-6 h-6" /></div>
                  <div><p className="text-xs text-gray-400 font-bold">Total Baris</p><p className="text-2xl font-bold">{stats ? stats.rows.toLocaleString('id-ID') : '-'}</p></div>
               </div>
               <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><HardDrive className="w-6 h-6" /></div>
                  <div><p className="text-xs text-gray-400 font-bold">Ukuran Data</p><p className="text-2xl font-bold">{stats ? formatBytes(stats.dataLength + stats.indexLength) : '-'}</p></div>
               </div>
               <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Calendar className="w-6 h-6" /></div>
                  <div><p className="text-xs text-gray-400 font-bold">Dibuat Pada</p><p className="text-sm font-bold">{stats ? formatDate(stats.createdAt) : '-'}</p></div>
               </div>
               <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><RefreshCw className="w-6 h-6" /></div>
                  <div><p className="text-xs text-gray-400 font-bold">Terakhir Update</p><p className="text-sm font-bold">{stats ? formatDate(stats.updatedAt) : '-'}</p></div>
               </div>
            </div>

            {/* DATA TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
               <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                     <Search className="w-4 h-4 text-gray-400" /> Preview Data (Hal. {page})
                  </h3>
                  <div className="flex gap-2">
                     <button onClick={handleDownload} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-xs font-bold flex items-center gap-2 shadow-sm mr-2">
                        <Download className="w-3.5 h-3.5" /> Download Excel
                     </button>
                     <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 bg-white">
                       <ChevronLeft className="w-4 h-4 text-gray-600" />
                     </button>
                     <button onClick={() => setPage(p => p + 1)} disabled={data.length < 15 || loading} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 bg-white">
                       <ChevronRight className="w-4 h-4 text-gray-600" />
                     </button>
                  </div>
               </div>

               <div className="flex-1 overflow-x-auto custom-scrollbar max-h-[500px]">
                  {loading ? (
                     <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin text-brand-200" />
                        <span className="text-xs font-medium">Memuat data...</span>
                     </div>
                  ) : data.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-64 text-gray-300">
                        <TableIcon className="w-12 h-12 mb-2 opacity-20" />
                        <p>{(activeSearch || startDate) ? 'Tidak ada hasil pencarian' : 'Tidak ada data'}</p>
                        {(activeSearch || startDate) && (
                           <button onClick={clearFilters} className="mt-2 text-xs text-brand-600 hover:underline">Reset Filter</button>
                        )}
                     </div>
                  ) : (
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider text-[10px] sticky top-0 shadow-sm z-10">
                        <tr>
                          {Object.keys(data[0]).map(key => (
                            <th key={key} onClick={() => handleSort(key)} className="px-6 py-4 border-b border-gray-100 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none">
                               <div className="flex items-center gap-2">
                                 {key}
                                 {sortConfig?.key === key ? (
                                    sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-500"/> : <ArrowDown className="w-3 h-3 text-brand-500"/>
                                 ) : (<ArrowUpDown className="w-3 h-3 text-gray-300" />)}
                               </div>
                            </th>
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
        )
      )}

      {!selectedDB && !sqlMode && (
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