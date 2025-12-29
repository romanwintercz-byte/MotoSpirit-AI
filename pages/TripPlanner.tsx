
import React, { useState, useEffect } from 'react';
import { planTripWithGrounding } from '../services/geminiService';

const TripPlanner: React.FC = () => {
  const [origin, setOrigin] = useState('Praha');
  const [preferences, setPreferences] = useState('Zatáčky, pěkné vyhlídky, málo provozu');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ text: string, links: any[] } | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<any[]>(() => {
    const saved = localStorage.getItem('motospirit_routes');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('motospirit_routes', JSON.stringify(savedRoutes));
  }, [savedRoutes]);

  const handlePlan = async () => {
    setLoading(true);
    try {
      const plan = await planTripWithGrounding(origin, preferences);
      setResult(plan);
      
      const newRoute = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        origin,
        text: plan.text,
        links: plan.links
      };
      setSavedRoutes(prev => [newRoute, ...prev].slice(0, 5));
    } catch (err) {
      console.error(err);
      alert("AI plánování selhalo. Ujistěte se, že máte ve Vercelu nastavený API_KEY.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-12">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold font-brand uppercase tracking-tighter">AI <span className="text-orange-500">Trasy</span></h1>
        <p className="text-slate-400 text-sm italic">Naplánuj si cestu pomocí živých dat z Google Search.</p>
      </div>

      <div className="bg-slate-800/80 p-6 md:p-8 rounded-[2.5rem] border border-slate-700 shadow-xl space-y-6 backdrop-blur-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Startovací bod</label>
            <input 
              type="text" 
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm font-semibold"
              placeholder="Např. Praha"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Tvoje preference</label>
            <input 
              type="text" 
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm font-semibold"
              placeholder="Např. Alpy, hodně zatáček"
            />
          </div>
        </div>

        <button 
          onClick={handlePlan}
          disabled={loading}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 disabled:opacity-50"
        >
          {loading ? <i className="fas fa-motorcycle animate-bounce"></i> : <i className="fas fa-map-marked-alt"></i>}
          {loading ? 'Hledám trasu...' : 'GENEROVAT VÝLET'}
        </button>
      </div>

      {result && (
        <div className="bg-slate-800 p-8 rounded-[2.5rem] border border-orange-500/20 space-y-6 animate-slideUp shadow-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-3">
              <i className="fas fa-route text-orange-500"></i> Návrh trasy
            </h2>
            <button onClick={() => setResult(null)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
          </div>
          <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap bg-slate-900/50 p-6 rounded-2xl border border-slate-700">
            {result.text}
          </div>

          {result.links.length > 0 && (
            <div className="pt-4 border-t border-slate-700">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Zajímavá místa na trase</h3>
              <div className="flex flex-wrap gap-2">
                {result.links.map((chunk: any, i: number) => {
                  const data = chunk.web || chunk.maps;
                  if (!data) return null;
                  return (
                    <a 
                      key={i} 
                      href={data.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-slate-900 hover:bg-orange-600/20 border border-slate-700 hover:border-orange-500/50 px-4 py-2 rounded-xl flex items-center gap-2 text-xs transition-all"
                    >
                      <i className="fas fa-external-link-alt text-orange-500 text-[10px]"></i>
                      {data.title || 'Místo'}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TripPlanner;
