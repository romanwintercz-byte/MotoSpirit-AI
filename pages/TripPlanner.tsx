
import React, { useState, useEffect, useRef } from 'react';
import { planTripWithGrounding } from '../services/geminiService';

const TripPlanner: React.FC = () => {
  const [origin, setOrigin] = useState('Teplice');
  const [preferences, setPreferences] = useState('Klínovec a Nechranice, pěkné zatáčky');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'map'>('text');
  const [result, setResult] = useState<{ text: string, links: any[], waypoints: [number, number][] } | null>(null);
  
  const mapRef = useRef<any | null>(null);
  const polylineRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);

  const handlePlan = async (overriddenPreferences?: string) => {
    setLoading(true);
    // Vždy přepneme na text při začátku, abychom viděli loading indikátor
    setViewMode('text'); 
    try {
      const plan = await planTripWithGrounding(origin, overriddenPreferences || preferences);
      setResult(plan);
      if (plan.waypoints && plan.waypoints.length > 1) {
        setViewMode('map');
      }
    } catch (err) {
      console.error(err);
      alert("AI plánování selhalo. Zkuste upřesnit zadání.");
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = () => {
    const Recognition = (window as any).Recognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return alert("Hlasové zadávání není podporováno.");
    const recognition = new Recognition();
    recognition.lang = 'cs-CZ';
    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setPreferences(text);
      handlePlan(text);
    };
    recognition.start();
  };

  const getExternalMapLink = (type: 'google' | 'mapycz') => {
    if (!result || !result.waypoints || result.waypoints.length === 0) {
      if (type === 'google') return `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${encodeURIComponent(preferences)}`;
      return `https://mapy.cz/zakladni?planovani-trasy&start=${encodeURIComponent(origin)}&end=${encodeURIComponent(preferences)}`;
    }
    
    const pts = result.waypoints;
    const maxExternalWaypoints = 10; // Méně bodů = čistší trasa v externí navigaci
    const sampled: [number, number][] = [];
    
    sampled.push(pts[0]);
    if (pts.length > 2) {
      const step = (pts.length - 2) / (maxExternalWaypoints - 2);
      for (let i = 1; i < maxExternalWaypoints - 1; i++) {
        const idx = Math.floor(i * step);
        if (pts[idx]) sampled.push(pts[idx]);
      }
    }
    if (pts.length > 1) sampled.push(pts[pts.length - 1]);

    if (type === 'google') {
      const originStr = `${sampled[0][0]},${sampled[0][1]}`;
      const destinationStr = `${sampled[sampled.length - 1][0]},${sampled[sampled.length - 1][1]}`;
      const waypointsStr = sampled.slice(1, -1).map(p => `${p[0]},${p[1]}`).join('|');
      return `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destinationStr}&waypoints=${waypointsStr}&travelmode=driving`;
    } else {
      const coords = sampled.map(p => `${p[1]}_${p[0]}`).join(';');
      return `https://mapy.cz/zakladni?planovani-trasy&rc=${coords}`;
    }
  };

  // Bezpečná inicializace mapy
  useEffect(() => {
    const initMap = () => {
      const L = (window as any).L;
      const mapEl = document.getElementById('trip-map');
      
      if (!L || !mapEl || mapRef.current) return;

      try {
        const mapInstance = L.map('trip-map', { 
          zoomControl: false, 
          attributionControl: false 
        }).setView([50.08, 14.43], 8);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapInstance);
        L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);
        mapRef.current = mapInstance;
      } catch (e) {
        console.error("Map initialization failed", e);
      }
    };

    // Pokud uživatel přepne na mapu, ujistíme se, že je inicializovaná
    if (viewMode === 'map') {
      setTimeout(initMap, 100);
    }
  }, [viewMode]);

  // Aktualizace trasy na mapě
  useEffect(() => {
    const L = (window as any).L;
    if (!mapRef.current || !L || !result?.waypoints?.length) return;

    try {
      // Vyčistit starou trasu
      if (polylineRef.current) mapRef.current.removeLayer(polylineRef.current);
      markersRef.current.forEach(m => mapRef.current?.removeLayer(m));
      markersRef.current = [];

      // Vykreslit novou trasu
      polylineRef.current = L.polyline(result.waypoints, { 
        color: '#f97316', 
        weight: 5, 
        opacity: 0.8, 
        lineJoin: 'round' 
      }).addTo(mapRef.current);

      // Přidat start a cíl
      const start = result.waypoints[0];
      const end = result.waypoints[result.waypoints.length - 1];
      
      const sMarker = L.circleMarker(start, { radius: 8, fillColor: '#22c55e', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(mapRef.current);
      const eMarker = L.circleMarker(end, { radius: 8, fillColor: '#ef4444', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(mapRef.current);
      
      markersRef.current.push(sMarker, eMarker);

      if (viewMode === 'map') {
        setTimeout(() => {
          mapRef.current.invalidateSize();
          mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
        }, 200);
      }
    } catch (e) {
      console.error("Polyline update failed", e);
    }
  }, [viewMode, result]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12 px-2 md:px-0">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold font-brand uppercase text-white">MOTO <span className="text-orange-500">PLANNER</span></h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest italic opacity-70">Regionálně přesná AI navigace</p>
        </div>
        
        {result && (
          <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700 shadow-xl">
            <button onClick={() => setViewMode('text')} className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'text' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>TEXT</button>
            <button onClick={() => setViewMode('map')} className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>MAPA</button>
          </div>
        )}
      </header>

      {/* Input Panel */}
      <div className="bg-slate-800/80 p-6 md:p-8 rounded-[2.5rem] border border-slate-700 shadow-xl space-y-6 backdrop-blur-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Start</label>
            <input type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-6 focus:border-orange-500 outline-none text-white font-semibold transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Trasa / Cíl</label>
            <input type="text" value={preferences} onChange={(e) => setPreferences(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-6 focus:border-orange-500 outline-none text-white font-semibold transition-all" />
          </div>
        </div>

        <div className="flex gap-4">
           <button onClick={handleVoiceInput} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse text-white' : 'bg-slate-900 border border-slate-700 text-white'}`}><i className="fas fa-microphone text-lg"></i></button>
           <button onClick={() => handlePlan()} disabled={loading} className="flex-grow bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50 uppercase tracking-tight shadow-lg shadow-orange-900/20">
            {loading ? <i className="fas fa-satellite animate-spin"></i> : <i className="fas fa-route"></i>}
            {loading ? 'Hledám čistou trasu...' : 'NAPLÁNOVAT'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-slate-800/80 border border-orange-500/30 p-10 rounded-[2rem] flex flex-col items-center gap-4 text-center animate-pulse">
           <i className="fas fa-motorcycle text-white text-3xl animate-bounce"></i>
           <p className="font-brand font-bold uppercase text-white tracking-tight">AI kalkuluje optimální stopu...</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="bg-slate-800 p-6 rounded-[2.5rem] border border-slate-700 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="text-center md:text-left">
                <h2 className="text-white font-brand font-bold uppercase">Export do navigace</h2>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Otevřete v externí aplikaci pro 100% přesnost</p>
             </div>
             <div className="flex gap-3 w-full md:w-auto">
               <a href={getExternalMapLink('google')} target="_blank" rel="noopener noreferrer" className="flex-1 md:w-40 bg-white text-slate-900 py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs shadow-lg transition-transform active:scale-95">
                 <i className="fab fa-google"></i> GOOGLE
               </a>
               <a href={getExternalMapLink('mapycz')} target="_blank" rel="noopener noreferrer" className="flex-1 md:w-40 bg-red-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs shadow-lg transition-transform active:scale-95">
                 <i className="fas fa-map"></i> MAPY.CZ
               </a>
             </div>
          </div>

          {/* Map Area */}
          <div className={viewMode === 'map' ? 'block' : 'hidden'}>
            <div className="bg-slate-800 p-2 rounded-[2.5rem] border border-slate-700 shadow-2xl relative min-h-[400px]">
              <div id="trip-map" className="w-full h-[500px] z-0 rounded-[2rem] bg-slate-900"></div>
              {!mapRef.current && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-600 font-bold uppercase text-xs">
                  Inicializace mapy...
                </div>
              )}
            </div>
          </div>

          {/* Text Area */}
          <div className={viewMode === 'text' ? 'block' : 'hidden'}>
            <div className="bg-slate-800 p-8 rounded-[2.5rem] border border-slate-700 space-y-6 shadow-2xl">
              <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap bg-slate-950/40 p-6 rounded-[2rem] border border-slate-800 shadow-inner">
                {result.text}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripPlanner;
