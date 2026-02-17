
import React, { useState, useEffect, useRef } from 'react';
import { planExpedition } from '../services/geminiService';
import { Expedition, TransportMode, TripDay } from '../types';

const TripPlanner: React.FC = () => {
  const [origin, setOrigin] = useState('Praha');
  const [days, setDays] = useState(3);
  const [mode, setMode] = useState<TransportMode>('moto');
  const [preferences, setPreferences] = useState('Zajímavé průsmyky, ubytování v kempech, obědy v lokálních hospůdkách.');
  
  const [loading, setLoading] = useState(false);
  const [expedition, setExpedition] = useState<Expedition | null>(null);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'info' | 'map'>('info');

  const mapRef = useRef<any | null>(null);
  const polylineRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);

  const modes: { val: TransportMode, icon: string, label: string }[] = [
    { val: 'moto', icon: 'fa-motorcycle', label: 'Motorka' },
    { val: 'car', icon: 'fa-car', label: 'Auto' },
    { val: 'walk', icon: 'fa-person-hiking', label: 'Pěšky' },
    { val: 'cablecar', icon: 'fa-mountain-sun', label: 'Kombinované' },
  ];

  const handlePlan = async () => {
    setLoading(true);
    setViewMode('info');
    try {
      const result = await planExpedition(origin, days, mode, preferences);
      setExpedition(result);
      setActiveDayIdx(0);
    } catch (err) {
      alert("AI Expedice selhala. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  };

  const getDayColor = (dayNum: number) => {
    const colors = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ec4899'];
    return colors[(dayNum - 1) % colors.length];
  };

  // Map Init & Update
  useEffect(() => {
    const L = (window as any).L;
    if (!L) return;

    const initMap = () => {
      const mapEl = document.getElementById('exp-map');
      if (!mapEl || mapRef.current) return;
      mapRef.current = L.map('exp-map', { zoomControl: false, attributionControl: false }).setView([50, 15], 6);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
    };

    if (viewMode === 'map') {
      setTimeout(initMap, 100);
    }
  }, [viewMode]);

  useEffect(() => {
    const L = (window as any).L;
    if (!mapRef.current || !L || !expedition) return;

    // Clear old
    if (polylineRef.current) mapRef.current.removeLayer(polylineRef.current);
    markersRef.current.forEach(m => mapRef.current.removeLayer(m));
    markersRef.current = [];

    const currentDay = expedition.days[activeDayIdx];
    if (currentDay && currentDay.waypoints.length > 0) {
      const color = getDayColor(currentDay.dayNumber);
      polylineRef.current = L.polyline(currentDay.waypoints, { color, weight: 6, opacity: 0.8 }).addTo(mapRef.current);
      
      const start = currentDay.waypoints[0];
      const end = currentDay.waypoints[currentDay.waypoints.length - 1];
      
      markersRef.current.push(L.circleMarker(start, { radius: 6, color: '#fff', fillColor: '#22c55e', fillOpacity: 1 }).addTo(mapRef.current));
      markersRef.current.push(L.circleMarker(end, { radius: 6, color: '#fff', fillColor: '#ef4444', fillOpacity: 1 }).addTo(mapRef.current));
      
      mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
    }
  }, [activeDayIdx, expedition, viewMode]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-2">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold font-brand uppercase text-white">SPIRIT <span className="text-orange-500">WANDERER</span></h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">AI Expediční Plánovač</p>
        </div>
        {expedition && (
          <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700">
            <button onClick={() => setViewMode('info')} className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase ${viewMode === 'info' ? 'bg-orange-600 text-white' : 'text-slate-500'}`}>ITINERÁŘ</button>
            <button onClick={() => setViewMode('map')} className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase ${viewMode === 'map' ? 'bg-orange-600 text-white' : 'text-slate-500'}`}>MAPA</button>
          </div>
        )}
      </header>

      {/* Setup Panel */}
      <div className="bg-slate-800/80 p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Místo odjezdu</label>
            <input type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 px-5 text-sm text-white focus:border-orange-500 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Počet dní</label>
            <div className="flex items-center gap-4 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-2">
               <button onClick={() => setDays(Math.max(1, days - 1))} className="text-orange-500 p-2"><i className="fas fa-minus"></i></button>
               <span className="flex-grow text-center font-bold">{days}</span>
               <button onClick={() => setDays(Math.min(14, days + 1))} className="text-orange-500 p-2"><i className="fas fa-plus"></i></button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Dopravní prostředek</label>
            <div className="flex gap-2">
              {modes.map(m => (
                <button 
                  key={m.val} 
                  onClick={() => setMode(m.val)}
                  className={`flex-1 py-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${mode === m.val ? 'bg-orange-600 border-orange-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                  title={m.label}
                >
                  <i className={`fas ${m.icon} text-sm`}></i>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Detaily a preference</label>
          <textarea 
            value={preferences} 
            onChange={(e) => setPreferences(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-5 text-sm text-white focus:border-orange-500 outline-none h-24 resize-none"
            placeholder="Popiš svou představu o výletu..."
          />
        </div>

        <button 
          onClick={handlePlan}
          disabled={loading}
          className="w-full bg-orange-600 hover:bg-orange-500 py-4 rounded-2xl font-bold text-white shadow-lg shadow-orange-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-wider"
        >
          {loading ? <i className="fas fa-compass animate-spin"></i> : <i className="fas fa-map-location-dot"></i>}
          {loading ? 'Sestavuji expedici...' : 'VYGENEROVAT EXPEDICI'}
        </button>
      </div>

      {/* Result View */}
      {expedition && !loading && (
        <div className="animate-fadeIn space-y-6">
          {/* Day Selector Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
             {expedition.days.map((day, idx) => (
               <button 
                key={idx}
                onClick={() => setActiveDayIdx(idx)}
                className={`snap-center shrink-0 px-6 py-4 rounded-2xl border transition-all flex flex-col items-center gap-1 min-w-[100px] ${activeDayIdx === idx ? 'bg-slate-700 border-orange-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
               >
                 <span className="text-[10px] font-bold uppercase opacity-50">DEN</span>
                 <span className="text-xl font-brand font-bold">{day.dayNumber}</span>
               </button>
             ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Timeline / Itinerary */}
            <div className={`lg:col-span-2 space-y-6 ${viewMode === 'info' ? 'block' : 'hidden lg:block'}`}>
               <div className="bg-slate-800 p-8 rounded-[2.5rem] border border-slate-700 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6">
                    <span className="bg-orange-600/20 text-orange-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase border border-orange-500/20">
                      DEN {expedition.days[activeDayIdx].dayNumber}
                    </span>
                  </div>
                  <h3 className="text-xl font-brand font-bold text-white mb-6 uppercase">Program dne</h3>
                  <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {expedition.days[activeDayIdx].description}
                  </div>
               </div>
            </div>

            {/* Sidebar Stats & Accom */}
            <div className="space-y-6">
               <div className="bg-slate-800 p-6 rounded-[2.5rem] border border-slate-700 shadow-xl">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Detaily cesty</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
                      <i className="fas fa-route text-orange-500"></i>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Celkem dní</p>
                        <p className="text-sm font-bold text-white">{expedition.days.length}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
                      <i className="fas fa-gas-pump text-orange-500"></i>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Doprava</p>
                        <p className="text-sm font-bold text-white uppercase">{expedition.transportMode}</p>
                      </div>
                    </div>
                  </div>
               </div>
               
               <div className="bg-gradient-to-br from-orange-600/20 to-slate-800 p-6 rounded-[2.5rem] border border-orange-500/20 shadow-xl">
                  <h3 className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-4">Ubytování</h3>
                  <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-700 space-y-2">
                    <p className="text-xs text-slate-300 font-bold">Hledám nejlepší základnu...</p>
                    <p className="text-[10px] text-slate-500 leading-tight">AI doporučení ubytování pro tento den najdeš v itineráři nebo na mapě.</p>
                  </div>
               </div>
            </div>
          </div>

          {/* Map Full Width */}
          <div className={`${viewMode === 'map' ? 'block' : 'hidden lg:block'} h-[500px] bg-slate-800 rounded-[2.5rem] border border-slate-700 overflow-hidden relative shadow-2xl`}>
            <div id="exp-map" className="w-full h-full z-0"></div>
            <div className="absolute top-6 left-6 z-10 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700 shadow-xl">
               <p className="text-[10px] font-bold text-orange-500 uppercase">Trasa dne {expedition.days[activeDayIdx].dayNumber}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripPlanner;
