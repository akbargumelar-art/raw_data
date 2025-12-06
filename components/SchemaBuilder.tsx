
import React, { useState, useEffect } from 'react';
import { dataService } from '../services/api';
import { TableColumn } from '../types';
import { FileSearch, Database, ArrowRight, Table, Check, AlertCircle, RefreshCw, Plus, X, Pencil, Save, List, Info, Trash2, Layers, MoveUp, MoveDown } from 'lucide-react';

export const SchemaBuilder: React.FC = () => {
  // Tabs
  const [activeTab, setActiveTab] = useState<'create' | 'edit'>('create');

  // Common State
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDB, setSelectedDB] = useState('');
  
  // Create Tab State
  const [file, setFile] = useState<File | null>(null);
  const [newTableName, setNewTableName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [createColumns, setCreateColumns] = useState<TableColumn[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  
  // Edit Tab State
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTableToEdit, setSelectedTableToEdit] = useState('');
  const [editColumns, setEditColumns] = useState<TableColumn[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [savingColumn, setSavingColumn] = useState<string | null>(null);

  // New DB Popup
  const [showCreateDb, setShowCreateDb] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [creatingDb, setCreatingDb] = useState(false);

  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    loadDatabases();
  }, []);

  useEffect(() => {
    // When switching tabs or DBs, reset relevant selections
    setTables([]);
    setSelectedTableToEdit('');
    setEditColumns([]);
    
    if (activeTab === 'edit' && selectedDB) {
      dataService.getTables(selectedDB).then(setTables).catch(console.error);
    }
  }, [selectedDB, activeTab]);

  useEffect(() => {
    if (activeTab === 'edit' && selectedDB && selectedTableToEdit) {
      setLoadingSchema(true);
      dataService.getTableSchema(selectedDB, selectedTableToEdit)
        .then(cols => {
           setEditColumns(cols);
           setLoadingSchema(false);
        })
        .catch(err => {
           console.error(err);
           setLoadingSchema(false);
        });
    }
  }, [selectedTableToEdit]);

  const loadDatabases = () => {
    dataService.getDatabases()
      .then(setDatabases)
      .catch(console.error);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setCreateColumns([]);
      setPreviewData([]);
      setMessage(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setMessage(null);
    try {
      const result = await dataService.analyzeFile(file);
      setCreateColumns(result.columns);
      setPreviewData(result.previewData);
      
      const suggestedName = file.name.split('.')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
      setNewTableName(suggestedName);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Gagal menganalisa file' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStartManual = () => {
    setFile(null);
    setPreviewData([]);
    setMessage(null);
    setNewTableName('new_table');
    setCreateColumns([
      { name: 'id', type: 'INT', isPrimaryKey: true },
      { name: 'created_at', type: 'DATETIME', isPrimaryKey: false }
    ]);
  };

  const handleAddColumn = () => {
    setCreateColumns([
      ...createColumns,
      { name: `col_${createColumns.length + 1}`, type: 'VARCHAR(255)', isPrimaryKey: false }
    ]);
  };

  const handleRemoveColumn = (index: number) => {
    const newCols = [...createColumns];
    newCols.splice(index, 1);
    setCreateColumns(newCols);
  };

  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    const newCols = [...createColumns];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < newCols.length) {
      [newCols[index], newCols[targetIndex]] = [newCols[targetIndex], newCols[index]];
      setCreateColumns(newCols);
    }
  };

  const handleColumnChange = (index: number, field: keyof TableColumn, value: any) => {
    const newCols = [...createColumns];
    (newCols[index] as any)[field] = value;
    setCreateColumns(newCols);
  };

  const handleEditColumnChange = (index: number, value: string) => {
    const newCols = [...editColumns];
    newCols[index].type = value;
    setEditColumns(newCols);
  };

  const handleSaveColumnType = async (columnName: string, newType: string) => {
    if (!selectedDB || !selectedTableToEdit) return;
    setSavingColumn(columnName);
    try {
      await dataService.alterTableColumn(selectedDB, selectedTableToEdit, columnName, newType);
      setMessage({ type: 'success', text: `Kolom '${columnName}' berhasil diubah ke ${newType}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Gagal mengubah kolom' });
    } finally {
      setSavingColumn(null);
    }
  };

  const handleCreateDatabase = async () => {
    if (!newDbName) return;
    setCreatingDb(true);
    try {
      await dataService.createDatabase(newDbName);
      loadDatabases();
      setSelectedDB(newDbName);
      setNewDbName('');
      setShowCreateDb(false);
    } catch (err: any) {
      alert(err.response?.data?.error || "Gagal membuat database");
    } finally {
      setCreatingDb(false);
    }
  };

  const handleCreateTable = async () => {
    if (!selectedDB || !newTableName || createColumns.length === 0) return;
    setCreating(true);
    setMessage(null);
    try {
      await dataService.createTable(selectedDB, newTableName, createColumns);
      setMessage({ type: 'success', text: `Tabel '${newTableName}' berhasil dibuat di ${selectedDB}!` });
      setTimeout(() => {
         setFile(null);
         setCreateColumns([]);
         setNewTableName('');
         setMessage(null);
      }, 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Gagal membuat tabel' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      
      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('create')}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'create' 
              ? 'bg-white text-brand-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileSearch className="w-4 h-4" /> Buat Baru
        </button>
        <button
          onClick={() => setActiveTab('edit')}
          className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === 'edit' 
              ? 'bg-white text-brand-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Pencil className="w-4 h-4" /> Edit Struktur Tabel
        </button>
      </div>

      {/* Global Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* ============== CREATE TAB ============== */}
      {activeTab === 'create' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="bg-brand-50 p-2.5 rounded-xl text-brand-600">
                 <FileSearch className="w-5 h-5" />
              </div>
              <span className="flex-1">Sumber Struktur Tabel</span>
            </h3>
            
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1 w-full space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Opsi A: Upload Excel/CSV (Otomatis)</label>
                  <input 
                    type="file" 
                    accept=".csv,.xlsx"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-3 file:px-6
                      file:rounded-xl file:border-0
                      file:text-sm file:font-semibold
                      file:bg-brand-50 file:text-brand-700
                      hover:file:bg-brand-100
                      border border-gray-200 rounded-xl cursor-pointer bg-gray-50 focus:outline-none"
                  />
                </div>
                {file && (
                   <button 
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="w-full px-6 py-2.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Analisa & Buat
                  </button>
                )}
              </div>

              <div className="hidden md:flex items-center justify-center h-24">
                 <div className="h-full w-px bg-gray-200"></div>
                 <span className="bg-white px-2 text-gray-400 text-xs font-bold absolute">ATAU</span>
              </div>

              <div className="flex-1 w-full">
                 <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Opsi B: Manual</label>
                 <button 
                   onClick={handleStartManual}
                   className="w-full py-3.5 bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                 >
                    <Layers className="w-4 h-4" /> Buat Manual / Kosong
                 </button>
              </div>
            </div>
          </section>

          {createColumns.length > 0 && (
            <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
                   <Table className="w-5 h-5" />
                </div>
                <span className="flex-1">Konfigurasi Target</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Database Tujuan</label>
                  {!showCreateDb ? (
                    <div className="flex gap-2">
                      <select 
                        value={selectedDB}
                        onChange={e => setSelectedDB(e.target.value)}
                        className="flex-1 p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 text-gray-700"
                      >
                        <option value="">-- Pilih Database --</option>
                        {databases.map(db => <option key={db} value={db}>{db}</option>)}
                      </select>
                      <button onClick={() => setShowCreateDb(true)} className="bg-white border border-gray-200 hover:text-brand-600 p-3 rounded-xl">
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newDbName}
                        onChange={e => setNewDbName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                        placeholder="Nama DB Baru..."
                        className="flex-1 p-3 bg-white border border-brand-300 ring-2 ring-brand-500/10 rounded-xl outline-none"
                      />
                      <button onClick={handleCreateDatabase} disabled={!newDbName || creatingDb} className="bg-brand-600 text-white p-3 rounded-xl">
                        {creatingDb ? <RefreshCw className="w-5 h-5 animate-spin"/> : 'OK'}
                      </button>
                      <button onClick={() => setShowCreateDb(false)} className="bg-white border border-gray-200 text-gray-500 p-3 rounded-xl">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Nama Tabel Baru</label>
                  <input 
                    type="text" 
                    value={newTableName}
                    onChange={e => setNewTableName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 text-gray-700 font-mono text-sm"
                  />
                </div>
              </div>

              {/* INFO BOX FOR COMPOSITE KEYS */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex gap-3 text-sm text-blue-700">
                 <Info className="w-5 h-5 shrink-0" />
                 <div>
                    <span className="font-bold">Tips Kunci Unik (Primary Key):</span>
                    <p className="mt-1 text-xs leading-relaxed opacity-90">
                       Anda bisa mencentang lebih dari satu kolom sebagai Primary Key (Composite Key). 
                       Ini berguna jika data unik ditentukan oleh kombinasi beberapa kolom.
                       Kolom Primary Key <b>WAJIB NOT NULL</b>.
                    </p>
                 </div>
              </div>

              <div className="rounded-2xl border border-gray-200 overflow-hidden mb-4">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-6 py-4">Nama Kolom</th>
                      <th className="px-6 py-4">Tipe Data</th>
                      <th className="px-6 py-4 text-center">Primary Key</th>
                      <th className="px-6 py-4 text-gray-400 font-normal italic">Contoh Data</th>
                      <th className="px-4 py-4 w-28 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {createColumns.map((col, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <input 
                            type="text" 
                            value={col.name}
                            onChange={e => handleColumnChange(idx, 'name', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent focus:border-brand-500 outline-none font-mono text-sm py-1"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <select 
                            value={col.type}
                            onChange={e => handleColumnChange(idx, 'type', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent focus:border-brand-500 outline-none text-sm py-1"
                          >
                            <option value="VARCHAR(255)">VARCHAR(255)</option>
                            <option value="VARCHAR(50)">VARCHAR(50)</option>
                            <option value="TEXT">TEXT</option>
                            <option value="INT">INT</option>
                            <option value="BIGINT">BIGINT</option>
                            <option value="DECIMAL(10,2)">DECIMAL(10,2)</option>
                            <option value="DATE">DATE</option>
                            <option value="DATETIME">DATETIME</option>
                            <option value="TIMESTAMP">TIMESTAMP</option>
                          </select>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={col.isPrimaryKey || false}
                            onChange={e => {
                              // Allow multiple check for composite key
                              const newCols = [...createColumns];
                              newCols[idx].isPrimaryKey = e.target.checked;
                              setCreateColumns(newCols);
                            }}
                            className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-3 text-gray-400 italic text-xs">
                          {previewData[0] ? (previewData[0][col.name] || '-') : '-'}
                        </td>
                        <td className="px-4 py-3 text-center flex items-center justify-center gap-1">
                           <button 
                             onClick={() => handleMoveColumn(idx, 'up')}
                             disabled={idx === 0}
                             className="p-1 text-gray-400 hover:text-brand-600 disabled:opacity-20 transition-colors"
                             title="Geser Atas"
                           >
                             <MoveUp className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={() => handleMoveColumn(idx, 'down')}
                             disabled={idx === createColumns.length - 1}
                             className="p-1 text-gray-400 hover:text-brand-600 disabled:opacity-20 transition-colors"
                             title="Geser Bawah"
                           >
                             <MoveDown className="w-4 h-4" />
                           </button>
                           <div className="w-px h-4 bg-gray-200 mx-1"></div>
                           <button 
                             onClick={() => handleRemoveColumn(idx)}
                             className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                             title="Hapus Kolom"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center">
                 <button
                   onClick={handleAddColumn}
                   className="px-4 py-2 bg-white border border-dashed border-gray-300 hover:border-brand-300 hover:text-brand-600 text-gray-500 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                 >
                   <Plus className="w-4 h-4" /> Tambah Kolom
                 </button>

                 <button
                   onClick={handleCreateTable}
                   disabled={creating || !selectedDB || !newTableName}
                   className="px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                 >
                   {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                   Deploy Tabel
                 </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ============== EDIT TAB ============== */}
      {activeTab === 'edit' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
           <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
                   <List className="w-5 h-5" />
                </div>
                <span className="flex-1">Pilih Tabel untuk Diedit</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Database</label>
                    <select 
                        value={selectedDB}
                        onChange={e => setSelectedDB(e.target.value)}
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 text-gray-700"
                      >
                        <option value="">-- Pilih Database --</option>
                        {databases.map(db => <option key={db} value={db}>{db}</option>)}
                      </select>
                 </div>
                 <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tabel</label>
                    <select 
                        value={selectedTableToEdit}
                        onChange={e => setSelectedTableToEdit(e.target.value)}
                        disabled={!selectedDB}
                        className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 text-gray-700 disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">-- Pilih Tabel --</option>
                        {tables.map(tb => <option key={tb} value={tb}>{tb}</option>)}
                      </select>
                 </div>
              </div>
           </section>

           {selectedDB && selectedTableToEdit && (
              <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2">
                 <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Table className="w-5 h-5 text-gray-400" />
                    Struktur Tabel: <span className="text-brand-600 font-mono">{selectedTableToEdit}</span>
                 </h3>

                 {loadingSchema ? (
                    <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-3">
                       <RefreshCw className="w-8 h-8 animate-spin text-gray-300" />
                       Memuat struktur tabel...
                    </div>
                 ) : (
                    <div className="overflow-hidden rounded-2xl border border-gray-200">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider text-xs">
                          <tr>
                            <th className="px-6 py-4">Nama Kolom</th>
                            <th className="px-6 py-4">Tipe Data Saat Ini</th>
                            <th className="px-6 py-4 w-40 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {editColumns.map((col, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-4 font-mono font-medium text-gray-700">{col.name}</td>
                              <td className="px-6 py-3">
                                <select 
                                  value={col.type}
                                  onChange={e => handleEditColumnChange(idx, e.target.value)}
                                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:border-brand-500 outline-none"
                                >
                                  <option value="VARCHAR(255)">VARCHAR(255)</option>
                                  <option value="VARCHAR(100)">VARCHAR(100)</option>
                                  <option value="VARCHAR(50)">VARCHAR(50)</option>
                                  <option value="TEXT">TEXT</option>
                                  <option value="INT">INT</option>
                                  <option value="BIGINT">BIGINT</option>
                                  <option value="DECIMAL(10,2)">DECIMAL(10,2)</option>
                                  <option value="DATE">DATE</option>
                                  <option value="DATETIME">DATETIME</option>
                                </select>
                              </td>
                              <td className="px-6 py-3 text-center">
                                <button
                                   onClick={() => handleSaveColumnType(col.name, col.type)}
                                   disabled={savingColumn === col.name}
                                   className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-1 mx-auto disabled:opacity-50"
                                >
                                   {savingColumn === col.name ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3" />}
                                   Ubah
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                 )}
              </section>
           )}
        </div>
      )}

    </div>
  );
};
