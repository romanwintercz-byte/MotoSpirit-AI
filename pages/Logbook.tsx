
import React, { useState, useEffect, useRef } from 'react';
import { FuelRecord, MaintenanceRecord, Motorcycle } from '../types';
import { processReceiptAI } from '../services/geminiService';

const Logbook: React.FC = () => {
  const [bikes, setBikes] = useState<Motorcycle[]>(() => JSON.parse(localStorage.getItem('motospirit_bikes') || '[]'));
  const [selectedBikeId, setSelectedBikeId] = useState<string>(bikes[0]?.id || '');
  
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>(() => JSON.parse(localStorage.getItem('motospirit_fuel') || '[]'));
  const [expenses, setExpenses] = useState<MaintenanceRecord[]>(() => JSON.parse(localStorage.getItem('motospirit_records') || '[]'));
  
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('motospirit_fuel', JSON.stringify(fuelRecords));
  }, [fuelRecords]);

  useEffect(() => {
    localStorage.setItem('motospirit_records', JSON.stringify(expenses));
  }, [expenses]);

  const currentBikeFuel = fuelRecords.filter(f => f.bikeId === selectedBikeId).sort((a,b) => b.mileage - a.mileage);
  const currentBikeExpenses = expenses.filter(e => e.bikeId === selectedBikeId);

  const calculateConsumption = () => {
    if (currentBikeFuel.length < 2) return '--';
    const latest = currentBikeFuel[0];
    const previous = currentBikeFuel[1];
    const distance = latest.mileage - previous.mileage;
    if (distance <= 0) return '--';
    // Předpokládáme tankování do plné, takže spotřebované palivo je to, co jsme právě dotankovali
    return ((latest.liters / distance) * 100).toFixed(2);
  };

  const handleAIInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const data = await processReceiptAI({ base64, mimeType: file.type });
      if (data) applyAIData(data, reader.result as string);
      setLoading(false);
    };
    reader.readAsDataURL(file);
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
      const data = await processReceiptAI({ text });
      if (data) applyAIData(data);
      setLoading(false);
    };
    recognition.start();
  };

  const applyAIData = (data: any, image?: string) => {
    const id = Date.now().toString();
    const date = data.date || new Date().toISOString().split('T')[0];
    const mileage = data.mileage || 0;

    if (data.type === 'fuel') {
      const newRec: FuelRecord = {
        id, bikeId: selectedBikeId, date,
        mileage, liters: data.liters || 0, cost: data.cost || 0,
        isFull: true, receiptImage: image
      };
      setFuelRecords([newRec, ...fuelRecords]);
      updateBikeMileage(selectedBikeId, mileage);
    } else {
      const newExp: MaintenanceRecord = {
        id, bikeId: selectedBikeId, date,
        type: data.type === 'service' ? 'Servis' : 'Ostatní',
        description: data.description || 'Zadáno AI',
        mileage, cost: data.cost || 0,
        receiptImage: image
      };
      setExpenses([newExp, ...expenses]);
      if (mileage > 0) updateBikeMileage(selectedBikeId, mileage);
    }
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
    window.dispatchEvent(new Event('storage')); // Notify Garage.tsx
  };

  if (bikes.length === 0) return (
    <div className="text-center py-20 animate-fadeIn">
      <i className="fas fa-motorcycle text-6xl text-slate-800 mb-6"></i>
      <h2 className="text-xl font-bold mb-4">Garáž je prázdná</h2>
      <p className="text-slate-500 mb-8">Nejdříve si přidej motorku, abys mohl sledovat spotřebu.</p>
      <a href="#/garage" className="bg-orange-600 px-8 py-3 rounded-xl font-bold">PŘIDAT MAŠINU</a>
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <header className="flex flex-col gap-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold font-brand uppercase tracking-tighter">KNIHA <span className="text-orange-500">JÍZD</span></h1>
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
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'}`}
            >
              <i className="fas fa-microphone"></i>
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 bg-orange-600 hover:bg-orange-500 rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-orange-900/20"
            >
              <i className="fas fa-camera"></i>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAIInput} />
          </div>
        </div>
      </header>

      {/* Stats Cards - Mobile Scrollable or Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-orange-600 to-orange-700 p-5 rounded-[2rem] shadow-xl relative overflow-hidden flex flex-col justify-between h-36">
          <p className="text-orange-200 text-[10px] font-bold uppercase tracking-widest relative z-10">ø Spotřeba</p>
          <div className="relative z-10">
            <h2 className="text-3xl font-brand font-bold text-white">
              {calculateConsumption()} <span className="text-xs">l/100</span>
            </h2>
            <p className="text-orange-200 text-[8px] mt-1 uppercase font-bold">Tankováno do plné</p>
          </div>
          <i className="fas fa-gas-pump absolute -bottom-2 -right-2 text-6xl text-black/10"></i>
        </div>

        <div className="bg-slate-800 p-5 rounded-[2rem] border border-slate-700 flex flex-col justify-between h-36">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Výdaje {bikes.find(b => b.id === selectedBikeId)?.model}</p>
          <div>
            <h2 className="text-2xl font-brand font-bold text-white">
              {(currentBikeFuel.reduce((acc, curr) => acc + curr.cost, 0) + currentBikeExpenses.reduce((acc, curr) => acc + curr.cost, 0)).toLocaleString()} <span className="text-[10px]">Kč</span>
            </h2>
            <p className="text-slate-500 text-[8px] mt-1 uppercase font-bold">Celkem za tento stroj</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-slate-800/80 border border-orange-500/30 p-4 rounded-2xl flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center animate-spin">
            <i className="fas fa-sync-alt text-white"></i>
          </div>
          <span className="font-bold text-xs uppercase tracking-widest text-orange-500">AI analyzuje účtenku...</span>
        </div>
      )}

      {/* History List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Historie záznamů</h3>
          <span className="text-[10px] text-slate-600">{[...currentBikeFuel, ...currentBikeExpenses].length} položek</span>
        </div>
        
        <div className="space-y-3">
          {[...currentBikeFuel, ...currentBikeExpenses]
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((rec: any) => (
              <div 
                key={rec.id} 
                onClick={() => rec.receiptImage && setViewingReceipt(rec.receiptImage)}
                className={`bg-slate-800/40 border border-slate-700 p-4 rounded-3xl flex items-center gap-4 transition-all active:scale-[0.98] ${rec.receiptImage ? 'cursor-pointer hover:border-orange-500/30' : ''}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${'liters' in rec ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'}`}>
                  <i className={`fas ${'liters' in rec ? 'fa-gas-pump' : 'fa-tools'} text-sm`}></i>
                </div>
                <div className="flex-grow min-w-0">
                  <h4 className="font-bold text-sm truncate">
                    {'liters' in rec ? `${rec.liters} litrů paliva` : rec.type}
                  </h4>
                  <div className="flex gap-2 text-[9px] text-slate-500 font-bold uppercase mt-0.5">
                    <span>{rec.date}</span>
                    <span>•</span>
                    <span>{rec.mileage.toLocaleString()} km</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-brand font-bold text-base text-white">{rec.cost.toLocaleString()} <span className="text-[9px] font-normal">Kč</span></p>
                  {rec.receiptImage && <i className="fas fa-image text-orange-500 text-[10px] mt-1"></i>}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Receipt Viewer Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg animate-slideUp">
            <button 
              onClick={() => setViewingReceipt(null)} 
              className="absolute -top-12 right-0 text-white p-2 text-xl"
            >
              <i className="fas fa-times"></i> ZAVŘÍT
            </button>
            <img src={viewingReceipt} alt="Receipt" className="w-full h-auto rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Logbook;
