
import React, { useState, useEffect, useRef } from 'react';
import { FuelRecord, MaintenanceRecord, Motorcycle, OtherExpenseRecord } from '../types';
import { processReceiptAI } from '../services/geminiService';
import { syncDataToCloud } from '../services/syncService';
import { useActiveExpedition } from '../hooks/useActiveExpedition';
import { useLocation } from 'react-router-dom';

const Logbook: React.FC = () => {
  const { activeState } = useActiveExpedition();
  const location = useLocation();
  
  // --- POMOCNÉ FUNKCE PRO IMAGE RESIZING ---
  const resizeImage = (file: File, maxWidth: number = 600): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Mb Diet: 600px, 0.5 quality
            resolve(canvas.toDataURL('image/jpeg', 0.5));
          }
        };
      };
    });
  };

  const [bikes, setBikes] = useState<Motorcycle[]>(() => JSON.parse(localStorage.getItem('motospirit_bikes') || '[]'));
  const [selectedBikeId, setSelectedBikeId] = useState<string>(bikes[0]?.id || '');
  
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>(() => JSON.parse(localStorage.getItem('motospirit_fuel') || '[]'));
  const [expenses, setExpenses] = useState<MaintenanceRecord[]>(() => JSON.parse(localStorage.getItem('motospirit_records') || '[]'));
  
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  
  // State pro editaci záznamu před uložením
  const [pendingRecord, setPendingRecord] = useState<any | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronizace s Garáží (pokud se změní motorka jinde)
  useEffect(() => {
    const sync = () => {
      const savedBikes = JSON.parse(localStorage.getItem('motospirit_bikes') || '[]');
      setBikes(savedBikes);
      const savedFuel = JSON.parse(localStorage.getItem('motospirit_fuel') || '[]');
      setFuelRecords(savedFuel);
      const savedExpenses = JSON.parse(localStorage.getItem('motospirit_records') || '[]');
      setExpenses(savedExpenses);
    };
    window.addEventListener('storage', sync);
    window.addEventListener('sync-update', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('sync-update', sync);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('motospirit_fuel', JSON.stringify(fuelRecords));
  }, [fuelRecords]);

  const autoSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem('motospirit_records', JSON.stringify(expenses));
    
    // Auto-sync with debounce
    const syncCode = localStorage.getItem('motospirit_sync_code');
    if (syncCode && !(window as any).__isSyncingFromCloud) {
      if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current);
      autoSyncTimeoutRef.current = setTimeout(() => {
        const user = JSON.parse(localStorage.getItem('motospirit_user') || '{}');
        const expeditions = JSON.parse(localStorage.getItem('spirit_wanderer_trips') || '[]');
        syncDataToCloud(syncCode, {
          user,
          bikes,
          records: expenses,
          fuel: fuelRecords,
          expeditions
        }).catch(console.error);
      }, 2000);
    }
    
    return () => {
      if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current);
    };
  }, [expenses, fuelRecords, bikes]);

  const [filterType, setFilterType] = useState<'all' | 'fuel' | 'service' | 'expedition'>('all');
  const [showManualEntry, setShowManualEntry] = useState(false);

  const currentBikeFuel = fuelRecords.filter(f => f.bikeId === selectedBikeId).sort((a,b) => b.mileage - a.mileage);
  const currentBikeExpenses = expenses.filter(e => e.bikeId === selectedBikeId);

  const calculateConsumption = () => {
    if (currentBikeFuel.length < 2) return '--';
    
    // Long-term average calculation
    // We need at least 2 records to calculate distance.
    // The oldest record provides the starting mileage, but its fuel was consumed BEFORE that mileage.
    // So we sum the liters of all records EXCEPT the oldest one.
    const oldest = currentBikeFuel[currentBikeFuel.length - 1];
    const newest = currentBikeFuel[0];
    
    const totalDistance = newest.mileage - oldest.mileage;
    if (totalDistance <= 0) return '--';

    // Sum liters of all records except the oldest
    const totalLiters = currentBikeFuel.slice(0, currentBikeFuel.length - 1).reduce((sum, record) => sum + record.liters, 0);
    
    return ((totalLiters / totalDistance) * 100).toFixed(2);
  };

  const handleAIInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    
    try {
      const compressedImage = await resizeImage(file);
      const base64ForAI = compressedImage.split(',')[1];
      const data = await processReceiptAI({ base64: base64ForAI, mimeType: 'image/jpeg' });
      if (data) {
        setPendingRecord({ ...data, receiptImage: compressedImage });
      }
    } catch (err) {
      console.error("Receipt processing failed", err);
      alert("Nepodařilo se zpracovat účtenku.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleVoiceInput = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      alert("Hlasové zadávání není v tomto prohlížeči podporováno.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'cs-CZ';
    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setLoading(true);
      try {
        const data = await processReceiptAI({ text });
        if (data) {
          setPendingRecord(data);
        }
      } catch (err) {
        alert("Chyba při zpracování hlasu.");
      } finally {
        setLoading(false);
      }
    };
    recognition.start();
  };

  const saveConfirmedRecord = () => {
    if (!pendingRecord) return;
    
    const id = Date.now().toString();
    const date = pendingRecord.date || new Date().toISOString().split('T')[0];
    const mileage = parseInt(pendingRecord.mileage) || 0;
    const cost = parseFloat(pendingRecord.cost) || 0;
    const expeditionId = activeState ? activeState.expeditionId : undefined;

    if (pendingRecord.type === 'fuel') {
      const newRec: FuelRecord = {
        id, bikeId: selectedBikeId, date,
        mileage, liters: parseFloat(pendingRecord.liters) || 0, cost,
        isFull: true, receiptImage: pendingRecord.receiptImage,
        expeditionId
      };
      const updatedFuel = [newRec, ...fuelRecords];
      setFuelRecords(updatedFuel);
      localStorage.setItem('motospirit_fuel', JSON.stringify(updatedFuel));
      updateBikeMileage(selectedBikeId, mileage);
    } else {
      const newExp: MaintenanceRecord = {
        id, bikeId: selectedBikeId, date,
        type: pendingRecord.type === 'service' ? 'Servis' : (pendingRecord.type === 'toll' ? 'Mýto' : 'Ostatní'),
        description: pendingRecord.description || 'Zadáno AI',
        mileage, cost,
        receiptImage: pendingRecord.receiptImage,
        expeditionId
      };
      const updatedExpenses = [newExp, ...expenses];
      setExpenses(updatedExpenses);
      localStorage.setItem('motospirit_records', JSON.stringify(updatedExpenses));
      if (mileage > 0) updateBikeMileage(selectedBikeId, mileage);
    }
    setPendingRecord(null);
  };

  const updateBikeMileage = (bikeId: string, newMileage: number) => {
    const updatedBikes = bikes.map(b => {
      if (b.id === bikeId && newMileage > b.mileage) {
        return { ...b, mileage: newMileage };
      }
      return b;
    });
    setBikes(updatedBikes);
    localStorage.setItem('motospirit_bikes', JSON.stringify(updatedBikes));
    window.dispatchEvent(new Event('storage'));
  };

  const handleDeleteRecord = (id: string, isFuel: boolean) => {
    if (!window.confirm("Opravdu chceš smazat tento záznam?")) return;
    
    if (isFuel) {
      setFuelRecords(fuelRecords.filter(r => r.id !== id));
    } else {
      setExpenses(expenses.filter(r => r.id !== id));
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('addExpense') === 'true') {
      handleManualEntry();
      // Remove query param without reloading
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location]);

  const handleManualEntry = () => {
    setPendingRecord({
      type: 'fuel',
      date: new Date().toISOString().split('T')[0],
      cost: '',
      liters: '',
      mileage: bikes.find(b => b.id === selectedBikeId)?.mileage || '',
      description: ''
    });
  };

  if (bikes.length === 0) return (
    <div className="text-center py-20 animate-fadeIn px-6">
      <i className="fas fa-motorcycle text-6xl text-slate-800 mb-6"></i>
      <h2 className="text-xl font-bold mb-4 text-white uppercase font-brand">Garáž je prázdná</h2>
      <p className="text-slate-500 mb-8 text-sm">Nejdříve si přidej motorku, abys mohl sledovat spotřebu.</p>
      <a href="#/garage" className="bg-orange-600 px-8 py-4 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-all">PŘIDAT MAŠINU</a>
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      <header className="flex flex-col gap-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold font-brand uppercase tracking-tighter text-white">KNIHA <span className="text-orange-500">JÍZD</span></h1>
            <select 
              value={selectedBikeId} 
              onChange={(e) => setSelectedBikeId(e.target.value)}
              className="bg-transparent text-slate-400 font-bold uppercase text-[10px] focus:outline-none tracking-widest mt-1"
            >
              {bikes.map(b => <option key={b.id} value={b.id} className="bg-slate-800">{b.brand} {b.model}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleVoiceInput}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isRecording ? 'bg-red-500 animate-pulse text-white' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white'}`}
            >
              <i className="fas fa-microphone"></i>
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 bg-orange-600 hover:bg-orange-500 rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-orange-900/20 text-white"
            >
              <i className="fas fa-camera"></i>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAIInput} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-orange-600 to-orange-700 p-5 rounded-[2rem] shadow-xl relative overflow-hidden flex flex-col justify-between h-36">
          <p className="text-orange-200 text-[10px] font-bold uppercase tracking-widest relative z-10">ø Spotřeba</p>
          <div className="relative z-10">
            <h2 className="text-3xl font-brand font-bold text-white">
              {calculateConsumption()} <span className="text-xs">l/100</span>
            </h2>
          </div>
          <i className="fas fa-gas-pump absolute -bottom-2 -right-2 text-6xl text-black/10"></i>
        </div>

        <div className="bg-slate-800 p-5 rounded-[2rem] border border-slate-700 flex flex-col justify-between h-36">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest truncate">Výdaje {bikes.find(b => b.id === selectedBikeId)?.model}</p>
          <div>
            <h2 className="text-2xl font-brand font-bold text-white">
              {(currentBikeFuel.reduce((acc, curr) => acc + curr.cost, 0) + currentBikeExpenses.reduce((acc, curr) => acc + curr.cost, 0)).toLocaleString()} <span className="text-[10px]">Kč</span>
            </h2>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-slate-800/80 border border-orange-500/30 p-5 rounded-2xl flex items-center gap-4 animate-pulse shadow-xl">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center animate-spin">
            <i className="fas fa-sync-alt text-white"></i>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs uppercase tracking-widest text-orange-500">Zpracovávám vstup...</span>
            <span className="text-[9px] text-slate-500 font-bold uppercase">AI analyzuje data k uložení</span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button onClick={() => setFilterType('all')} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${filterType === 'all' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Vše</button>
            <button onClick={() => setFilterType('fuel')} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${filterType === 'fuel' ? 'bg-orange-600/20 text-orange-500' : 'text-slate-500 hover:text-slate-300'}`}>Benzín</button>
            <button onClick={() => setFilterType('service')} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${filterType === 'service' ? 'bg-blue-500/20 text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>Servis</button>
            {activeState && (
              <button onClick={() => setFilterType('expedition')} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1 ${filterType === 'expedition' ? 'bg-emerald-500/20 text-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}>
                <i className="fas fa-motorcycle"></i> Expedice
              </button>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button 
              onClick={() => {
                const csvContent = "data:text/csv;charset=utf-8," 
                  + "Datum,Typ,Cena,Kilometry,Litry,Popis\n"
                  + [...currentBikeFuel, ...currentBikeExpenses]
                    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(r => `${r.date},${'liters' in r ? 'Benzín' : r.type},${r.cost},${r.mileage},${'liters' in r ? r.liters : ''},${'liters' in r ? '' : r.description}`)
                    .join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `logbook_${bikes.find(b => b.id === selectedBikeId)?.model}_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all"
              title="Exportovat do CSV"
            >
              <i className="fas fa-download text-xs"></i>
            </button>
            <button 
              onClick={handleManualEntry}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-orange-600/20 text-orange-500 hover:bg-orange-600 hover:text-white transition-all"
              title="Přidat záznam ručně"
            >
              <i className="fas fa-plus text-xs"></i>
            </button>
          </div>
        </div>
        
        <div className="space-y-3">
          {[...currentBikeFuel, ...currentBikeExpenses]
            .filter(rec => {
              if (filterType === 'all') return true;
              if (filterType === 'fuel') return 'liters' in rec;
              if (filterType === 'service') return !('liters' in rec) && rec.type === 'Servis';
              if (filterType === 'expedition') return activeState && rec.expeditionId === activeState.expeditionId;
              return true;
            })
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((rec: any) => (
              <div 
                key={rec.id} 
                className={`bg-slate-800/40 border border-slate-700 p-4 rounded-3xl flex items-center gap-4 transition-all group ${rec.receiptImage ? 'hover:border-orange-500/30 shadow-md' : ''}`}
              >
                <div 
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${'liters' in rec ? 'bg-orange-500/10 text-orange-500' : (rec.type === 'Mýto' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500')} ${rec.receiptImage ? 'cursor-pointer' : ''}`}
                  onClick={() => rec.receiptImage && setViewingReceipt(rec.receiptImage)}
                >
                  <i className={`fas ${'liters' in rec ? 'fa-gas-pump' : (rec.type === 'Mýto' ? 'fa-ticket' : 'fa-tools')} text-sm`}></i>
                </div>
                <div className="flex-grow min-w-0" onClick={() => rec.receiptImage && setViewingReceipt(rec.receiptImage)}>
                  <h4 className={`font-bold text-sm truncate text-white ${rec.receiptImage ? 'cursor-pointer' : ''}`}>
                    {'liters' in rec ? `${rec.liters} l benzínu` : rec.type}
                  </h4>
                  <div className="flex gap-2 text-[9px] text-slate-500 font-bold uppercase mt-0.5">
                    <span>{rec.date}</span>
                    <span>•</span>
                    <span>{rec.mileage.toLocaleString()} km</span>
                    {rec.expeditionId && <span className="text-emerald-500"><i className="fas fa-mountain-sun"></i> EXPEDICE</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <p className="font-brand font-bold text-base text-white">{rec.cost.toLocaleString()} <span className="text-[9px] font-normal">Kč</span></p>
                  <div className="flex items-center gap-3">
                    {rec.receiptImage && <i className="fas fa-image text-orange-500 text-[10px] cursor-pointer" onClick={() => setViewingReceipt(rec.receiptImage)}></i>}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRecord(rec.id, 'liters' in rec);
                      }}
                      className="text-slate-600 hover:text-red-500 transition-colors"
                      title="Smazat záznam"
                    >
                      <i className="fas fa-trash-can text-[10px]"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
          {[...currentBikeFuel, ...currentBikeExpenses].filter(rec => {
              if (filterType === 'all') return true;
              if (filterType === 'fuel') return 'liters' in rec;
              if (filterType === 'service') return !('liters' in rec) && rec.type === 'Servis';
              if (filterType === 'expedition') return activeState && rec.expeditionId === activeState.expeditionId;
              return true;
            }).length === 0 && (
            <div className="text-center py-10">
              <p className="text-slate-600 text-xs uppercase font-bold tracking-widest">Žádné záznamy</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Review Pending Record */}
      {pendingRecord && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-800 w-full max-w-md rounded-[2.5rem] border border-orange-500/30 shadow-2xl overflow-hidden flex flex-col animate-slideUp">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
               <div>
                  <h2 className="text-lg font-brand font-bold uppercase tracking-tight text-white">KONTROLA <span className="text-orange-500">ZÁZNAMU</span></h2>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Zkontroluj, co AI vyčetla</p>
               </div>
               <button onClick={() => setPendingRecord(null)} className="text-slate-500 hover:text-white p-2">
                 <i className="fas fa-times text-xl"></i>
               </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto bg-slate-800">
              <div className="flex gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Typ</label>
                  <select 
                    value={pendingRecord.type}
                    onChange={e => setPendingRecord({...pendingRecord, type: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 outline-none focus:border-orange-500 text-sm text-white"
                  >
                    <option value="fuel">Benzín</option>
                    <option value="service">Servis</option>
                    <option value="toll">Mýto / Dálnice</option>
                    <option value="other">Ostatní</option>
                  </select>
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Datum</label>
                  <input 
                    type="date"
                    value={pendingRecord.date}
                    onChange={e => setPendingRecord({...pendingRecord, date: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 outline-none focus:border-orange-500 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Cena (Kč)</label>
                  <input 
                    type="number"
                    value={pendingRecord.cost || ''}
                    onChange={e => setPendingRecord({...pendingRecord, cost: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 outline-none focus:border-orange-500 text-sm text-white font-bold"
                  />
                </div>
                {pendingRecord.type === 'fuel' && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Litry</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={pendingRecord.liters || ''}
                      onChange={e => setPendingRecord({...pendingRecord, liters: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 outline-none focus:border-orange-500 text-sm text-white"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className={`text-[9px] font-bold uppercase ml-2 ${!pendingRecord.mileage ? 'text-orange-500 animate-pulse' : 'text-slate-500'}`}>
                  Stav tachometru (KM) {!pendingRecord.mileage && '- DOPLŇTE!'}
                </label>
                <input 
                  type="number"
                  placeholder="Zadej kilometry..."
                  value={pendingRecord.mileage || ''}
                  onChange={e => setPendingRecord({...pendingRecord, mileage: e.target.value})}
                  className={`w-full bg-slate-900 border rounded-xl py-3 px-4 outline-none transition-all text-sm text-white font-bold ${!pendingRecord.mileage ? 'border-orange-500' : 'border-slate-700 focus:border-orange-500'}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Popis</label>
                <textarea 
                  rows={2}
                  value={pendingRecord.description || ''}
                  onChange={e => setPendingRecord({...pendingRecord, description: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 outline-none focus:border-orange-500 text-sm text-white resize-none"
                />
              </div>

              {pendingRecord.receiptImage && (
                <div className="mt-2 rounded-xl overflow-hidden border border-slate-700">
                  <img src={pendingRecord.receiptImage} alt="Receipt Preview" className="w-full h-32 object-cover opacity-50" />
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-900/80 border-t border-slate-700 flex gap-3 pb-10 sm:pb-6">
               <button onClick={() => setPendingRecord(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 py-4 rounded-xl font-bold text-xs uppercase tracking-widest text-white transition-all">ZAHODIT</button>
               <button onClick={saveConfirmedRecord} className="flex-1 bg-orange-600 hover:bg-orange-500 py-4 rounded-xl font-bold text-xs uppercase tracking-widest text-white shadow-lg shadow-orange-900/20 active:scale-95 transition-all">POTVRDIT A ULOŽIT</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: View Receipt Image */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fadeIn" onClick={() => setViewingReceipt(null)}>
          <div className="relative w-full max-w-lg animate-slideUp" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setViewingReceipt(null)} 
              className="absolute -top-12 right-0 text-white p-2 text-xl font-bold flex items-center gap-2"
            >
              <i className="fas fa-times"></i> ZAVŘÍT
            </button>
            <img src={viewingReceipt} alt="Receipt" className="w-full h-auto rounded-2xl shadow-2xl border border-slate-700" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Logbook;
