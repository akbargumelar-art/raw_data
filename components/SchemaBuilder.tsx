import React, { useState, useEffect } from 'react';
import { dataService } from '../services/api';
import { TableColumn } from '../types';
import { FileSearch, Database, ArrowRight, Table, Check, AlertCircle, RefreshCw, Plus, X } from 'lucide-react';

export const SchemaBuilder: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDB, setSelectedDB] = useState('');
  const [newTableName, setNewTableName] = useState('');
  
  const [analyzing, setAnalyzing] = useState(false);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // New DB State
  const [showCreateDb, setShowCreateDb] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [creatingDb, setCreatingDb] = useState(false);

  useEffect(() => {
    loadDatabases();
  }, []);

  const loadDatabases = () => {
    dataService.getDatabases()
      .then(setDatabases)
      .catch(console.error);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setColumns([]);
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
      setColumns(result.columns);
      setPreviewData(result.previewData);
      
      const suggestedName = file.name.split('.')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
      setNewTableName(suggestedName);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to analyze file' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleColumnChange = (index: number, field: keyof TableColumn, value: any) => {
    const newCols = [...columns];
    (newCols[index] as any)[field] = value;
    setColumns(newCols);
  };

  const handleCreateDatabase = async () => {
    if (!newDbName) return;
    setCreatingDb(true);
    try {
      await dataService.createDatabase(newDbName);
      loadDatabases(); // Refresh list
      setSelectedDB(newDbName); // Auto select new db
      setNewDbName('');
      setShowCreateDb(false);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create database");
    } finally {
      setCreatingDb(false);
    }
  };

  const handleCreateTable = async () => {
    if (!selectedDB || !newTableName || columns.length === 0) return;
    setCreating(true);
    setMessage(null);
    try {
      await dataService.createTable(selectedDB, newTableName, columns);
      setMessage({ type: 'success', text: `Table '${newTableName}' created successfully in ${selectedDB}!` });
      setTimeout(() => {
         setFile(null);
         setColumns([]);
         setNewTableName('');
         setMessage(null);
      }, 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create table' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* 1. Upload & Analyze Section */}
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
          <div className="bg-brand-50 p-2.5 rounded-xl text-brand-600">
             <FileSearch className="w-5 h-5" />
          </div>
          <span className="flex-1">1. Analyze Source File</span>
          <span className="text-xs font-normal text-gray-400 bg-gray-50 px-2 py-1 rounded">Step 1 of 2</span>
        </h3>
        
        <div className="flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Source CSV / Excel</label>
            <div className="relative">
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
                  border border-gray-200 rounded-xl cursor-pointer bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>
          <button 
            onClick={handleAnalyze}
            disabled={!file || analyzing}
            className="w-full md:w-auto px-8 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-brand-200 transition-all"
          >
            {analyzing ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Processing</>
            ) : (
              <>Analyze Structure <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </section>

      {/* 2. Schema Editor Section */}
      {columns.length > 0 && (
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
               <Table className="w-5 h-5" />
            </div>
            <span className="flex-1">2. Configure Schema</span>
            <span className="text-xs font-normal text-gray-400 bg-gray-50 px-2 py-1 rounded">Step 2 of 2</span>
          </h3>

          {/* Table Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-100/50">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Target Database</label>
              
              {!showCreateDb ? (
                <div className="flex gap-2">
                  <select 
                    value={selectedDB}
                    onChange={e => setSelectedDB(e.target.value)}
                    className="flex-1 p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 text-gray-700"
                  >
                    <option value="">-- Select Database --</option>
                    {databases.map(db => <option key={db} value={db}>{db}</option>)}
                  </select>
                  <button 
                    onClick={() => setShowCreateDb(true)}
                    className="bg-white border border-gray-200 hover:border-brand-300 text-gray-600 hover:text-brand-600 p-3 rounded-xl transition-all"
                    title="Create New Database"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 animate-in fade-in zoom-in-95 duration-200">
                  <input 
                    type="text" 
                    value={newDbName}
                    onChange={e => setNewDbName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="New DB Name..."
                    autoFocus
                    className="flex-1 p-3 bg-white border border-brand-300 ring-2 ring-brand-500/10 rounded-xl outline-none text-gray-700"
                  />
                  <button 
                    onClick={handleCreateDatabase}
                    disabled={!newDbName || creatingDb}
                    className="bg-brand-600 hover:bg-brand-700 text-white p-3 rounded-xl transition-all font-medium"
                  >
                    {creatingDb ? <RefreshCw className="w-5 h-5 animate-spin"/> : 'Create'}
                  </button>
                  <button 
                    onClick={() => setShowCreateDb(false)}
                    className="bg-white border border-gray-200 text-gray-500 hover:text-gray-800 p-3 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">New Table Name</label>
              <div className="flex items-center">
                 <input 
                  type="text" 
                  value={newTableName}
                  onChange={e => setNewTableName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 text-gray-700 font-mono text-sm"
                  placeholder="e.g. raw_transactions_2024"
                />
              </div>
            </div>
          </div>

          {/* Columns Editor */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden mb-8 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4">Column Name</th>
                  <th className="px-6 py-4">Data Type</th>
                  <th className="px-6 py-4 text-center">Primary Key</th>
                  <th className="px-6 py-4 text-gray-400 font-normal normal-case italic">Sample Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {columns.map((col, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3">
                      <input 
                        type="text" 
                        value={col.name}
                        onChange={e => handleColumnChange(idx, 'name', e.target.value)}
                        className="w-full bg-transparent border-b border-transparent focus:border-brand-500 outline-none font-mono text-gray-700 text-sm py-1"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <select 
                        value={col.type}
                        onChange={e => handleColumnChange(idx, 'type', e.target.value)}
                        className="w-full bg-transparent border-b border-transparent focus:border-brand-500 outline-none text-gray-600 text-sm py-1 cursor-pointer"
                      >
                        <option value="VARCHAR(255)">VARCHAR(255)</option>
                        <option value="TEXT">TEXT</option>
                        <option value="INT">INT</option>
                        <option value="DECIMAL(10,2)">DECIMAL(10,2)</option>
                        <option value="DATE">DATE</option>
                        <option value="DATETIME">DATETIME</option>
                        <option value="BOOLEAN">BOOLEAN</option>
                      </select>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={col.isPrimaryKey || false}
                        onChange={e => {
                          if(e.target.checked) {
                            const newCols = columns.map((c, i) => ({...c, isPrimaryKey: i === idx}));
                            setColumns(newCols);
                          } else {
                            handleColumnChange(idx, 'isPrimaryKey', false);
                          }
                        }}
                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 border-gray-300 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-3 text-gray-400 italic truncate max-w-[150px] text-xs">
                      {previewData[0] ? previewData[0][col.name] : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
             <div className="flex-1">
                {message && (
                  <div className={`py-2 px-4 rounded-xl text-sm flex items-center gap-2 w-fit ${
                    message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {message.text}
                  </div>
                )}
             </div>
             <button
               onClick={handleCreateTable}
               disabled={creating || !selectedDB || !newTableName}
               className="px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
             >
               {creating ? (
                 <>
                   <Database className="w-4 h-4 animate-bounce" /> Creating Table...
                 </>
               ) : (
                 <>
                   <Database className="w-4 h-4" /> Deploy Table
                 </>
               )}
             </button>
          </div>
        </section>
      )}
    </div>
  );
};