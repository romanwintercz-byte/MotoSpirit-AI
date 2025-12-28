
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
      let location = undefined;
      if ("geolocation" in navigator) {
        const pos = await new Promise<GeolocationPosition>((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej)
        ).catch(() => null);
        
        if (pos) {
          location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }
      }

      const plan = await planTripWithGrounding(origin, preferences, location);
      setResult(plan);
      
      // Auto-save to history
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
      alert("AI plánování selhalo. Zkontrolujte připojení na úvodní stránce.");
    } finally {
      setLoading(false);
    }
  };

  const loadSaved = (route: any) => {
    setResult({ text: route.text, links: route.links });
    setOrigin(route.origin);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-12">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold font-brand">AI <span className="text-orange-500">TRASY</span></h1>
        <p className="text-slate-400 text-sm">Chytré plánování s využitím živých dat Google Maps.</p>
      </div>

      <div className="bg-slate-800/80 p-6 md:p-8 rounded-[2rem] border border-slate-700 shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Kde začít</label>
            <div className="relative">
              <i className="fas fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/50"></i>
              <input 
                type="text" 
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Na co máš chuť</label>
            <div className="relative">
              <i className="fas fa-motorcycle absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/50"></i>
              <input 
                type="text" 
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm"
              />
            </div>
          </div>
        </div>

        <button 
          onClick={handlePlan}
          disabled={loading}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 disabled:opacity-50"
        >
          {loading ? <i className="fas fa-cog fa-spin"></i> : <i className="fas fa-map-marked-alt"></i>}
          {loading ? 'Hledám nejlepší asfalt...' : 'VYGENEROVAT TRASU'}
        </button>
      </div>

      {result && (
        <div className="bg-slate-800 p-8 rounded-[2rem] border border-orange-500/20 space-y-6 animate-slideUp shadow-2xl">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold flex items-center gap-3">
              <i className="fas fa-route text-orange-500"></i> Návrh výletu
            </h2>
            <button onClick={() => setResult(null)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
          </div>
          <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap bg-slate-900/50 p-6 rounded-2xl border border-slate-700">
            {result.text}
          </div>

          {result.links.length > 0 && (
            <div className="pt-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Zastávky na mapě</h3>
              <div className="flex flex-wrap gap-2">
                {result.links.map((chunk: any, i: number) => {
                  const place = chunk.googleSearchRetrievalMetadata || chunk.maps;
                  if (!place) return null;
                  return (
                    <a 
                      key={i} 
                      href={place.uri} 
                      target="_blank" 
                      className="bg-slate-900 hover:bg-orange-600/10 border border-slate-700 hover:border-orange-500/50 px-4 py-2 rounded-xl flex items-center gap-2 text-xs transition-all"
                    >
                      <i className="fas fa-map-pin text-orange-500"></i>
                      {place.title || 'Místo'}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {savedRoutes.length > 0 && !result && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold px-2">Poslední hledání v mobilu</h2>
          <div className="grid grid-cols-1 gap-3">
            {savedRoutes.map((route) => (
              <div 
                key={route.id} 
                onClick={() => loadSaved(route)}
                className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex justify-between items-center cursor-pointer hover:border-slate-500 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-slate-700 w-10 h-10 rounded-full flex items-center justify-center">
                    <i className="fas fa-history text-slate-400 text-sm"></i>
                  </div>
                  <div>
                    <p className="font-bold text-sm">Z {route.origin}</p>
                    <p className="text-[10px] text-slate-500">{route.date}</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-slate-600 text-xs"></i>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TripPlanner;
