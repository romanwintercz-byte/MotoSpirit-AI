
import React, { useState, useEffect } from 'react';
import { Motorcycle, MaintenanceRecord } from '../types';
import { analyzeMaintenance } from '../services/geminiService';

const Garage: React.FC = () => {
  const [bikes, setBikes] = useState<Motorcycle[]>(() => {
    const saved = localStorage.getItem('motospirit_bikes');
    return saved ? JSON.parse(saved) : [
      { id: '1', brand: 'BMW', model: 'S1000RR', year: 2022, mileage: 15200, image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80' }
    ];
  });

  const [records, setRecords] = useState<MaintenanceRecord[]>(() => {
    const saved = localStorage.getItem('motospirit_records');
    return saved ? JSON.parse(saved) : [];
  });

  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Persistence effects
  useEffect(() => {
    localStorage.setItem('motospirit_bikes', JSON.stringify(bikes));
  }, [bikes]);

  useEffect(() => {
    localStorage.setItem('motospirit_records', JSON.stringify(records));
  }, [records]);

  const handleAnalyze = async (bike: Motorcycle) => {
    setLoading(true);
    try {
      const bikeRecords = records.filter(r => r.bikeId === bike.id);
      const result = await analyzeMaintenance(bike, bikeRecords);
      setAnalysis(result);
    } catch (err) {
      console.error(err);
      setAnalysis("AI momentálně neodpovídá. Zkuste obnovit připojení klíče v nastavení.");
    } finally {
      setLoading(false);
    }
  };

  const updateMileage = (id: string, newMileage: number) => {
    setBikes(prev => prev.map(b => b.id === id ? { ...b, mileage: newMileage } : b));
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold font-brand">MOJE <span className="text-orange-500">GARÁŽ</span></h1>
        <button className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-all">
          <i className="fas fa-plus"></i> Přidat
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {bikes.map(bike => (
          <div key={bike.id} className="bg-slate-800 rounded-3xl overflow-hidden border border-slate-700 group shadow-lg">
            <div className="h-56 relative overflow-hidden">
              <img src={bike.image} alt={bike.model} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold">{bike.brand} {bike.model}</h3>
                  <p className="text-slate-500">{bike.year}</p>
                </div>
                <div className="text-right">
                  <input 
                    type="number"
                    value={bike.mileage}
                    onChange={(e) => updateMileage(bike.id, parseInt(e.target.value) || 0)}
                    className="bg-transparent text-orange-500 font-bold text-xl text-right w-24 outline-none border-b border-transparent focus:border-orange-500"
                  />
                  <p className="text-xs text-slate-500">Km (Upravit)</p>
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                <button 
                  onClick={() => handleAnalyze(bike)}
                  disabled={loading}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <i className="fas fa-wand-magic-sparkles text-orange-400"></i>
                  {loading ? 'Analyzuji...' : 'Servisní rady'}
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Poslední údržba</p>
                {records.filter(r => r.bikeId === bike.id).length === 0 && (
                  <p className="text-sm text-slate-400 italic">Žádné záznamy v mobilu.</p>
                )}
                {records.filter(r => r.bikeId === bike.id).map(record => (
                  <div key={record.id} className="flex justify-between text-sm bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                    <span>{record.type}</span>
                    <span className="text-slate-500">{record.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {analysis && (
        <div className="bg-slate-800 p-8 rounded-3xl border border-orange-500/30 shadow-2xl animate-slideUp">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <i className="fas fa-robot text-orange-500"></i>
              <h2 className="text-xl font-bold">Doporučení</h2>
            </div>
            <button onClick={() => setAnalysis(null)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
          </div>
          <div className="text-slate-300 whitespace-pre-wrap">{analysis}</div>
        </div>
      )}
    </div>
  );
};

export default Garage;
