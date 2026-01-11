
import React, { useState, useEffect, useRef } from 'react';
import { FuelRecord, MaintenanceRecord, Motorcycle } from '../types';
import { processReceiptAI } from '../services/geminiService';

const Logbook: React.FC = () => {
  const [bikes] = useState<Motorcycle[]>(() => JSON.parse(localStorage.getItem('motospirit_bikes') || '[]'));
  const [selectedBikeId, setSelectedBikeId] = useState<string>(bikes[0]?.id || '');
  
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>(() => JSON.parse(localStorage.getItem('motospirit_fuel') || '[]'));
  const [expenses, setExpenses] = useState<MaintenanceRecord[]>(() => JSON.parse(localStorage.getItem('motospirit_records') || '[]'));
  
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('motospirit_fuel', JSON.stringify(fuelRecords));
  }, [fuelRecords]);

  useEffect(() => {
    localStorage.setItem('motospirit_records', JSON.stringify(expenses));
  }, [expenses]);

  const currentBikeFuel = fuelRecords.filter(f => f.bikeId === selectedBikeId).sort((a,b) => b.mileage - a.mileage);
  
  const calculateConsumption = () => {
    if (currentBikeFuel.length < 2) return null;
    const latest = currentBikeFuel[0];
    const previous = currentBikeFuel[1];
    const distance = latest.mileage - previous.mileage;
    if (distance <= 0) return null;
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
    if (data.type === 'fuel') {
      const newRec: FuelRecord = {
        id, bikeId: selectedBikeId, date: data.date || new Date().toISOString().split('T')[0],
        mileage: data.mileage || 0, liters: data.liters || 0, cost: data.cost || 0,
        isFull: true, receiptImage: image
      };
      setFuelRecords([newRec, ...fuelRecords]);
    } else {
      const newExp: MaintenanceRecord = {
        id, bikeId: selectedBikeId, date: data.date || new Date().toISOString().split('T')[0],
        type: data.type === 'service' ? 'Servis' : 'Ostatní',
        description: data.description || 'Zadáno AI',
        mileage: data.mileage || 0, cost: data.cost || 0,
        receiptImage: image
      };
      setExpenses([newExp, ...expenses]);
    }
  };

  if (bikes.length === 0) return (
    <div className="text-center py-20">
      <i className="fas fa-motorcycle text-6xl text-slate-700 mb-4"></i>
      <h2 className="text-xl font-bold">Nejdříve si přidej motorku v Garáži</h2>
    </div>
  );

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-brand uppercase tracking-tighter">KNIHA <span className="text-orange-500">JÍZD</span></h1>
          <select 
            value={selectedBikeId} 
            onChange={(e) => setSelectedBikeId(e.target.value)}
            className="bg-transparent text-slate-400 font-bold uppercase text-xs focus:outline-none"
          >
            {bikes.map(b => <option key={b.id} value={b.id} className="bg-slate-800">{b.brand} {b.model}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleVoiceInput}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            <i className="fas fa-microphone"></i>
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center justify-center transition-all"
          >
            <i className="fas fa-camera"></i>
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAIInput} />
        </div>
      </header>

      {/* Consumption Widget */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-orange-600 to-orange-700 p-8 rounded-[2.5rem] shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-orange-200 text-xs font-bold uppercase tracking-widest mb-1">Průměrná spotřeba</p>
            <h2 className="text-5xl font-brand font-bold text-white">
              {calculateConsumption() || '--'} <span className="text-xl">l/100km</span>
            </h2>
            <p className="text-orange-200 text-[10px] mt-4 uppercase font-bold">Vždy tankováno do plné</p>
          </div>
          <i className="fas fa-gas-pump absolute -bottom-4 -right-4 text-9xl text-black/10"></i>
        </div>

        <div className="bg-slate-800 p-8 rounded-[2.5rem] border border-slate-700 flex flex-col justify-center">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Celkové výdaje</p>
              <h2 className="text-3xl font-brand font-bold text-white">
                {(fuelRecords.reduce((acc, curr) => acc + curr.cost, 0) + expenses.reduce((acc, curr) => acc + curr.cost, 0)).toLocaleString()} <span className="text-sm">Kč</span>
              </h2>
            </div>
            <i className="fas fa-wallet text-4xl text-slate-700"></i>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-orange-600/20 border border-orange-500/50 p-4 rounded-2xl flex items-center gap-4 animate-pulse">
          <i className="fas fa-robot animate-bounce"></i>
          <span className="font-bold text-sm">MotoSpirit AI čte účtenku...</span>
        </div>
      )}

      {/* Tabs / List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest ml-4">Poslední záznamy</h3>
        <div className="space-y-3">
          {[...currentBikeFuel, ...expenses.filter(e => e.bikeId === selectedBikeId)]
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((rec: any) => (
              <div key={rec.id} className="bg-slate-800/50 border border-slate-700 p-5 rounded-3xl flex items-center gap-4 hover:border-slate-500 transition-all">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${'liters' in rec ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'}`}>
                  <i className={`fas ${'liters' in rec ? 'fa-gas-pump' : 'fa-tools'}`}></i>
                </div>
                <div className="flex-grow">
                  <h4 className="font-bold">{'liters' in rec ? `Tankování ${rec.liters}l` : rec.type}</h4>
                  <div className="flex gap-3 text-[10px] text-slate-500 font-bold uppercase">
                    <span>{rec.date}</span>
                    <span>{rec.mileage} km</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-brand font-bold text-lg">{rec.cost} <span className="text-[10px]">Kč</span></p>
                  {rec.receiptImage && <i className="fas fa-paperclip text-orange-500 text-xs"></i>}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Logbook;
