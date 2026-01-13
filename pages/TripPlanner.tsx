
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
  const polylineGlowRef = useRef<any | null>(null);
  const polylineRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);

  const handlePlan = async (overriddenPreferences?: string) => {
    setLoading(true);
    setViewMode('text'); 
    try {
      const plan = await planTripWithGrounding(origin, overriddenPreferences || preferences);
      setResult(plan);
      // Pokud máme aspoň pár bodů, ukážeme mapu jako náhled
      if (plan.waypoints.length > 2) {
        setViewMode('map');
      } else {
        setViewMode('text');
      }
    } catch (err) {
      console.error(err);
      alert("AI plánování selhalo. Zkuste to znovu za chvíli.");
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
    if (!result || result.waypoints.length === 0) {
      if (type === 'google') return `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${encodeURIComponent(preferences)}`;
      return `https://mapy.cz/zakladni?planovani-trasy&start=${encodeURIComponent(origin)}&end=${encodeURIComponent(preferences)}`;
    }
    
    const pts = result.waypoints;
    // Omezíme počet bodů pro URL (max 15), aby Mapy.cz/Google Maps nehlásily chybu
    const maxExternalWaypoints = 12;
    const sampled: [number, number][] = [];
    
    sampled.push(pts[0]);
    if (pts.length > 2) {
      const step = (pts.length - 2) / (maxExternalWaypoints - 2);
      for (let i = 1; i < Math.min(pts.length - 1, maxExternalWaypoints - 1); i++) {
        sampled.push(pts[Math.floor(i * step)]);
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

  useEffect(() => {
    const L = (window as any).L;
    if (!L || mapRef.current) return;
    const mapInstance = L.map('trip-map', { zoomControl: false, attributionControl: false }).setView([50.08, 14.43], 8);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapInstance);
    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);
    mapRef.current = mapInstance;
  }, []);

  useEffect(() => {
    if (!mapRef.current || !result?.waypoints.length) return;
    const L = (window as any).L;
    
    if (polylineRef.current) mapRef.current.removeLayer(polylineRef.current);
    if (polylineGlowRef.current) mapRef.current.removeLayer(polylineGlowRef.current);
    markersRef.current.forEach(m => mapRef.current?.removeLayer(m));
    markersRef.current = [];

    polylineGlowRef.current = L.polyline(result.waypoints, { color: '#f97316', weight: 10, opacity: 0.2, lineJoin: 'round' }).addTo(mapRef.current);
    polylineRef.current = L.polyline(result.waypoints, { color: '#f97316', weight: 4, opacity: 0.9, lineJoin: 'round' }).addTo(mapRef.current);

    result.waypoints.forEach((wp, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === result.waypoints.length - 1;
      if (isStart || isEnd || result.waypoints.length < 15) {
        const marker = L.circleMarker(wp, { radius: isStart || isEnd ? 7 : 4, fillColor: isStart ? '#22c55e' : (isEnd ? '#ef4444' : '#f97316'), color: '#fff', weight: 2, fillOpacity: 1 }).addTo(mapRef.current);
        markersRef.current.push(marker);
      }
    });

    if (viewMode === 'map') {
      setTimeout(() => {
        mapRef.current.invalidateSize();
        mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
      }, 200);
    }
  }, [viewMode, result]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12 px-2 md:px-0">
      <style>{`.map-label { background: #0f172a !important; border: 1px solid #f97316 !important; color: white !important; font-weight: bold !important; font-size: 9px !important; border-radius: 4px !important; padding: 2px 5px !important; font-family: 'Orbitron', sans-serif; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }`}</style>
      
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold font-brand uppercase text-white">RIDER <span className="text-orange-500">PLANNER</span></h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest italic opacity-70">Optimalizováno pro české silnice</p>
        </div>
        
        {result && (
          <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700 shadow-xl">
            <button onClick={() => setViewMode('text')} className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'text' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>ITINERÁŘ</button>
            <button onClick={() => setViewMode('map')} className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>AI NÁHLED</button>
          </div>
        )}
      </header>

      {/* Input Panel */}
      <div className="bg-slate-800/80 p-6 md:p-8 rounded-[2.5rem] border border-slate-700 shadow-xl space-y-6 backdrop-blur-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Místo startu</label>
            <input type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-6 focus:border-orange-500 outline-none text-white font-semibold transition-all shadow-inner" placeholder="Např. Teplice" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Kam to bude?</label>
            <input type="text" value={preferences} onChange={(e) => setPreferences(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-6 focus:border-orange-500 outline-none text-white font-semibold transition-all shadow-inner" placeholder="Např. Klínovec a Nechranice" />
          </div>
        </div>

        <div className="flex gap-4">
           <button onClick={handleVoiceInput} className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isRecording ? 'bg-red-500 animate-pulse text-white' : 'bg-slate-900 hover:bg-slate-700 border border-slate-700 text-white'}`}><i className={`fas ${isRecording ? 'fa-microphone' : 'fa-microphone-lines'} text-xl`}></i></button>
           <button onClick={() => handlePlan()} disabled={loading} className="flex-grow bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] disabled:opacity-50 transition-all uppercase tracking-tight">
            {loading ? <i className="fas fa-satellite animate-spin"></i> : <i className="fas fa-route"></i>}
            {loading ? 'Hledám skutečné silnice...' : 'VYGENEROVAT VÝLET'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-slate-800/80 border border-orange-500/30 p-10 rounded-[2rem] flex flex-col items-center gap-6 text-center animate-pulse">
           <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg"><i className="fas fa-motorcycle text-white text-2xl animate-bounce"></i></div>
           <div className="space-y-1">
              <p className="font-brand font-bold uppercase text-white text-lg tracking-tight">Prověřuji souřadnice bodů...</p>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Ověřuji regionální integritu přes Google Grounding</p>
           </div>
        </div>
      )}

      {/* Main Content Area */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Action Bar - Nejdůležitější část */}
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-6 rounded-[2.5rem] shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-6 border-b-4 border-orange-700">
             <div className="text-center lg:text-left">
                <h2 className="text-white font-brand font-bold text-xl uppercase tracking-tight">Ostrá navigace</h2>
                <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">Exportujte body do profesionální aplikace</p>
             </div>
             <div className="flex gap-4 w-full lg:w-auto">
               <a href={getExternalMapLink('google')} target="_blank" rel="noopener noreferrer" className="flex-1 lg:w-48 bg-white text-slate-900 py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-xs shadow-xl hover:scale-105 active:scale-95 transition-all">
                 <img src="https://upload.wikimedia.org/wikipedia/commons/3/39/Google_Maps_icon_%282015-2020%29.svg" alt="G" className="w-5 h-5" /> GOOGLE MAPS
               </a>
               <a href={getExternalMapLink('mapycz')} target="_blank" rel="noopener noreferrer" className="flex-1 lg:w-48 bg-red-600 text-white py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-xs shadow-xl border border-red-400 hover:scale-105 active:scale-95 transition-all">
                 <i className="fas fa-map text-sm"></i> MAPY.CZ
               </a>
             </div>
          </div>

          {/* AI Internal Map Preview */}
          <div className={`${viewMode === 'map' ? 'block' : 'hidden'} animate-fadeIn`}>
            <div className="bg-slate-800 p-2 rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden relative">
              <div id="trip-map" className="w-full h-[450px] md:h-[600px] z-0 rounded-[2rem]"></div>
              <div className="absolute top-6 left-6 z-10">
                <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-orange-500/30">
                   <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest">⚠️ AI NÁHLED</p>
                   <p className="text-[8px] text-slate-500 font-bold uppercase">Trasa může být nepřesná</p>
                </div>
              </div>
            </div>
          </div>

          {/* Text Itinerary */}
          <div className={`${viewMode === 'text' ? 'block' : 'hidden'} animate-fadeIn`}>
            <div className="bg-slate-800 p-8 rounded-[2.5rem] border border-slate-700 space-y-6 shadow-2xl">
              <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap bg-slate-950/40 p-8 rounded-[2rem] border border-slate-800 shadow-inner font-medium">
                {result.text}
              </div>

              {result.links.length > 0 && (
                <div className="pt-4 space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Ověřené body zájmu</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {result.links.map((chunk: any, i: number) => {
                      const data = chunk.web || chunk.maps;
                      if (!data) return null;
                      return (
                        <a key={i} href={data.uri} target="_blank" rel="noopener noreferrer" className="bg-slate-900/60 border border-slate-700 p-4 rounded-2xl flex items-center justify-between group hover:border-orange-500/50 transition-all">
                          <div className="flex items-center gap-3 overflow-hidden">
                             <i className="fas fa-location-dot text-orange-500 text-sm"></i>
                             <span className="text-xs font-bold text-slate-400 truncate group-hover:text-white">{data.title}</span>
                          </div>
                          <i className="fas fa-external-link-alt text-slate-700 text-[10px]"></i>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripPlanner;
