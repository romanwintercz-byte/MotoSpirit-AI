
import React, { useState, useEffect, useRef } from 'react';
import { planTripWithGrounding } from '../services/geminiService';

const TripPlanner: React.FC = () => {
  const [origin, setOrigin] = useState('Praha');
  const [preferences, setPreferences] = useState('Zatáčky, pěkné vyhlídky');
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
    setViewMode('map'); 
    try {
      const plan = await planTripWithGrounding(origin, overriddenPreferences || preferences);
      setResult(plan);
    } catch (err) {
      console.error(err);
      alert("AI plánování selhalo. Zkontrolujte, zda máte v Google AI Studiu povolen Google Search/Maps.");
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      alert("Hlasové zadávání není podporováno.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'cs-CZ';
    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setPreferences(text);
      handlePlan(text);
    };
    recognition.start();
  };

  // Inicializace mapy
  useEffect(() => {
    const L = (window as any).L;
    if (!L || mapRef.current) return;

    const mapInstance = L.map('trip-map', {
      zoomControl: false,
      attributionControl: false
    }).setView([49.8, 15.5], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(mapInstance);

    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);
    mapRef.current = mapInstance;
    
    setTimeout(() => mapInstance.invalidateSize(), 500);
  }, []);

  // Aktualizace trasy
  useEffect(() => {
    if (!mapRef.current) return;

    if (viewMode === 'map') {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 50);
    }

    if (result?.waypoints && result.waypoints.length > 0) {
      const L = (window as any).L;
      
      // Vymazat předchozí vrstvy
      if (polylineRef.current) mapRef.current.removeLayer(polylineRef.current);
      if (polylineGlowRef.current) mapRef.current.removeLayer(polylineGlowRef.current);
      markersRef.current.forEach(m => mapRef.current?.removeLayer(m));
      markersRef.current = [];

      // 1. Spodní "glow" čára pro efekt neonu
      polylineGlowRef.current = L.polyline(result.waypoints, {
        color: '#f97316',
        weight: 12,
        opacity: 0.2,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(mapRef.current);

      // 2. Hlavní trasa
      polylineRef.current = L.polyline(result.waypoints, {
        color: '#f97316',
        weight: 5,
        opacity: 1,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(mapRef.current);

      // Body zastávek - vykreslíme jen Start, Cíl a důležité body
      result.waypoints.forEach((wp, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === result.waypoints.length - 1;
        
        // Vykreslíme body jen pro start, cíl, nebo každých 5 bodů pro přehlednost
        if (isStart || isEnd || (idx % 8 === 0)) {
          const marker = L.circleMarker(wp, {
            radius: isStart || isEnd ? 8 : 3,
            fillColor: isStart ? '#22c55e' : (isEnd ? '#ef4444' : '#f97316'),
            color: '#fff',
            weight: 2,
            fillOpacity: 1
          }).addTo(mapRef.current);
          
          if (isStart) marker.bindTooltip("START", { permanent: true, direction: 'top', className: 'map-label' });
          if (isEnd) marker.bindTooltip("CÍL", { permanent: true, direction: 'top', className: 'map-label' });
          
          markersRef.current.push(marker);
        }
      });

      if (viewMode === 'map') {
        mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [60, 60] });
      }
    }
  }, [viewMode, result]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12 px-2 md:px-0">
      <style>{`
        .map-label {
          background: #0f172a !important;
          border: 1px solid #f97316 !important;
          color: white !important;
          font-weight: bold !important;
          font-size: 10px !important;
          border-radius: 4px !important;
          padding: 2px 6px !important;
          font-family: 'Orbitron', sans-serif;
        }
      `}</style>
      
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold font-brand uppercase text-white">AI <span className="text-orange-500">TRASY</span></h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Detailní plánování s vysokou přesností</p>
        </div>
        
        {result && (
          <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700 shadow-xl">
            <button 
              onClick={() => setViewMode('text')}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'text' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500'}`}
            >
              ITINERÁŘ
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500'}`}
            >
              MAPA
            </button>
          </div>
        )}
      </header>

      <div className="bg-slate-800/80 p-6 md:p-8 rounded-[2.5rem] border border-slate-700 shadow-xl space-y-6 backdrop-blur-md relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Odkud vyrazíš?</label>
            <input 
              type="text" 
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-6 focus:border-orange-500 outline-none text-white font-semibold transition-all"
              placeholder="Např. Praha"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Co chceš zažít?</label>
            <input 
              type="text" 
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-6 focus:border-orange-500 outline-none text-white font-semibold transition-all"
              placeholder="Zatáčky, hory, dobrý kafe..."
            />
          </div>
        </div>

        <div className="flex gap-4 relative z-10">
           <button 
            onClick={handleVoiceInput}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isRecording ? 'bg-red-500 animate-pulse text-white' : 'bg-slate-900 hover:bg-slate-700 border border-slate-700 text-white'}`}
          >
            <i className={`fas ${isRecording ? 'fa-microphone' : 'fa-microphone-lines'} text-xl`}></i>
          </button>
          <button 
            onClick={() => handlePlan()}
            disabled={loading}
            className="flex-grow bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {loading ? <i className="fas fa-sync-alt animate-spin"></i> : <i className="fas fa-map-marked-alt"></i>}
            {loading ? 'GENERUJI PRECIZNÍ TRASU...' : 'VYTVOŘIT VÝLET'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-slate-800/80 border border-orange-500/30 p-8 rounded-[2rem] flex flex-col items-center gap-4 text-center animate-pulse">
           <div className="w-14 h-14 bg-orange-600 rounded-[1.5rem] flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)]">
              <i className="fas fa-motorcycle text-white text-xl animate-bounce"></i>
           </div>
           <div>
              <p className="font-brand font-bold uppercase text-white tracking-tight">AI kreslí trasu zatáčku po zatáčce...</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">To může chvíli trvat, hledám ty nejlepší cesty</p>
           </div>
        </div>
      )}

      {/* Map Container */}
      <div className={`space-y-6 animate-slideUp ${(viewMode === 'map' && result) || loading ? '' : 'hidden'}`}>
        <div className="bg-slate-800 p-2 md:p-4 rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden relative">
          <div id="trip-map" className="w-full h-[500px] md:h-[650px] z-0"></div>
          {result && (
            <div className="absolute top-8 left-8 z-10 hidden sm:block">
              <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-700 shadow-xl">
                 <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Detaily trasy</p>
                 <div className="space-y-2">
                    <p className="text-white font-bold text-xs flex items-center gap-2">
                      <i className="fas fa-map-pin text-green-500"></i> {origin}
                    </p>
                    <p className="text-white font-bold text-xs flex items-center gap-2">
                      <i className="fas fa-route text-orange-500"></i> {result.waypoints.length} navigačních bodů
                    </p>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Textový itinerář */}
      {viewMode === 'text' && result && !loading && (
        <div className="bg-slate-800 p-8 rounded-[2.5rem] border border-orange-500/20 space-y-6 shadow-2xl animate-slideUp">
          <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap bg-slate-900/50 p-6 rounded-2xl border border-slate-700">
            {result.text}
          </div>

          {result.links.length > 0 && (
            <div className="pt-4 border-t border-slate-700">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Zajímavá místa na cestě</h3>
              <div className="flex flex-wrap gap-2">
                {result.links.map((chunk: any, i: number) => {
                  const data = chunk.web || chunk.maps;
                  if (!data) return null;
                  return (
                    <a key={i} href={data.uri} target="_blank" rel="noopener noreferrer" className="bg-slate-900 border border-slate-700 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-bold text-slate-300 hover:border-orange-500 hover:bg-orange-600/10 transition-all">
                      <i className="fas fa-map-location text-orange-500"></i> {data.title}
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
