
import React, { useState } from 'react';
import { Motorcycle, MaintenanceRecord } from '../types';
import { analyzeMaintenance } from '../services/geminiService';

const Garage: React.FC = () => {
  const [bikes, setBikes] = useState<Motorcycle[]>([
    { id: '1', brand: 'BMW', model: 'S1000RR', year: 2022, mileage: 15200, image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80' },
    { id: '2', brand: 'KTM', model: '890 Adventure R', year: 2023, mileage: 4500, image: 'https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=800&q=80' }
  ]);

  const [records] = useState<MaintenanceRecord[]>([
    { id: 'r1', bikeId: '1', date: '2024-03-15', type: 'Olej', description: 'Výměna motorového oleje a filtru', mileage: 15150, cost: 3500 },
    { id: 'r2', bikeId: '1', date: '2023-09-10', type: 'Pneu', description: 'Nová sada Pirelli Supercorsa', mileage: 12000, cost: 9800 }
  ]);

  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async (bike: Motorcycle) => {
    setLoading(true);
    try {
      const bikeRecords = records.filter(r => r.bikeId === bike.id);
      const result = await analyzeMaintenance(bike, bikeRecords);
      setAnalysis(result);
    } catch (err) {
      console.error(err);
      setAnalysis("Chyba při analýze údržby.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold font-brand">MOJE <span className="text-orange-500">GARÁŽ</span></h1>
        <button className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-all">
          <i className="fas fa-plus"></i> Přidat stroj
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {bikes.map(bike => (
          <div key={bike.id} className="bg-slate-800 rounded-3xl overflow-hidden border border-slate-700 group shadow-lg">
            <div className="h-56 relative overflow-hidden">
              <img src={bike.image} alt={bike.model} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-sm font-bold">
                {bike.year}
              </div>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold">{bike.brand} {bike.model}</h3>
                  <p className="text-slate-400 font-medium italic">Sport/Adventure</p>
                </div>
                <div className="text-right">
                  <p className="text-orange-500 font-bold text-xl">{bike.mileage.toLocaleString()} km</p>
                  <p className="text-xs text-slate-500">Celkový nájezd</p>
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                <button 
                  onClick={() => handleAnalyze(bike)}
                  disabled={loading}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <i className="fas fa-wand-magic-sparkles text-orange-400"></i>
                  {loading ? 'Analyzuji...' : 'AI Servisní tipy'}
                </button>
                <button className="bg-slate-700 hover:bg-slate-600 p-3 rounded-xl transition-all">
                  <i className="fas fa-cog"></i>
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Historie údržby</p>
                {records.filter(r => r.bikeId === bike.id).map(record => (
                  <div key={record.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                        <i className="fas fa-check text-green-500"></i>
                      </div>
                      <div>
                        <p className="font-semibold">{record.type}</p>
                        <p className="text-xs text-slate-400">{record.date}</p>
                      </div>
                    </div>
                    <p className="font-bold text-slate-300">{record.cost} Kč</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {analysis && (
        <div className="bg-slate-800 p-8 rounded-3xl border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.1)]">
          <div className="flex items-center gap-3 mb-4">
            <i className="fas fa-robot text-2xl text-orange-500"></i>
            <h2 className="text-xl font-bold">AI Servisní doporučení</h2>
          </div>
          <div className="prose prose-invert max-w-none text-slate-300">
             {analysis.split('\n').map((line, i) => <p key={i} className="mb-2">{line}</p>)}
          </div>
          <button 
            onClick={() => setAnalysis(null)}
            className="mt-6 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Zavřít analýzu
          </button>
        </div>
      )}
    </div>
  );
};

export default Garage;
