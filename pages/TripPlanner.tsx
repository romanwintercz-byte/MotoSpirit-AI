
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

  // Inicializace mapy (ihned po montu komponenty do neviditelného, ale existujícího divu)
  useEffect(() => {
    const L = (window as any).L;
    if (!L || mapRef.current) return;

    const mapInstance = L.map('trip-map', {
      zoomControl: false,
      attributionControl: false
    }).setView([49.8, 15.5], 7); // Vycentrováno na ČR

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(mapInstance);

    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);
    mapRef.current = mapInstance;
    
    // Prvotní oprava velikosti
    setTimeout(() => mapInstance.invalidateSize(), 500);
  }, []);

  // Reakce na změnu dat nebo režimu zobrazení
  useEffect(() => {
    if (!mapRef.current) return;

    if (viewMode === 'map') {
      // Důležité: InvalidateSize musí proběhnout po zobrazení divu
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 50);
    }

    if (result?.waypoints && result.waypoints.length > 0) {
      const L = (window as any).L;
      
      // Vymazat předchozí trasu
      if (polylineRef.current) mapRef.current.removeLayer(polylineRef.current);
      markersRef.current.forEach(m => mapRef.current?.removeLayer(m));
      markersRef.current = [];

      // Vykreslit novou trasu
      polylineRef.current = L.polyline(result.waypoints, {
        color: '#f97316',
        weight: 6,
        opacity: 0.9,
        lineJoin: 'round'
      }).addTo(mapRef.current);

      result.waypoints.forEach((wp, idx) => {
        const marker = L.circleMarker(wp, {
          radius: idx === 0 || idx === result.waypoints.length - 1 ? 7 : 4,
          fillColor: idx === 0 ? '#22c55e' : (idx === result.waypoints.length - 1 ? '#ef4444' : '#f97316'),
          color: '#fff',
          weight: 2,
          fillOpacity: 1
        }).addTo(mapRef.current);
        markersRef.current.push(marker);
      });

      if (viewMode === 'map') {
        mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
      }
    }
  }, [viewMode, result]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 px-2">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold font-brand uppercase text-white">AI <span className="text-orange-500">TRASY</span></h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Plánuj hlasem s využitím Google Maps</p>
        </div>
        
        {result && (
          <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700 shadow-xl">
            <button 
              onClick={() => setViewMode('text')}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'text' ? 'bg-orange-600 text-white' : 'text-slate-500'}`}
            >
              ITINERÁŘ
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-orange-600 text-white' : 'text-slate-500'}`}
            >
              MAPA
            </button>
          </div>
        )}
      </header>

      <div className="bg-slate-800/80 p-6 md:p-8 rounded-[2.5rem] border border-slate-700 shadow-xl space-y-6 backdrop-blur-md relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Start</label>
            <input 
              type="text" 
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-6 focus:border-orange-500 outline-none text-white font-semibold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Kam to bude?</label>
            <input 
              type="text" 
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-6 focus:border-orange-500 outline-none text-white font-semibold"
            />
          </div>
        </div>

        <div className="flex gap-4 relative z-10">
           <button 
            onClick={handleVoiceInput}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-900 border border-slate-700'} text-white`}
          >
            <i className="fas fa-microphone text-xl"></i>
          </button>
          <button 
            onClick={() => handlePlan()}
            disabled={loading}
            className="flex-grow bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg disabled:opacity-50"
          >
            {loading ? <i className="fas fa-sync-alt animate-spin"></i> : <i className="fas fa-map-marked-alt"></i>}
            {loading ? 'HLEDÁM ZATÁČKY...' : 'NAPLÁNOVAT VÝLET'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-slate-800/80 border border-orange-500/30 p-8 rounded-[2rem] flex flex-col items-center gap-4 text-center">
           <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center animate-bounce">
              <i className="fas fa-motorcycle text-white"></i>
           </div>
           <p className="font-brand font-bold uppercase text-white">AI komunikuje s družicemi...</p>
        </div>
      )}

      {/* Map Container - Vždy v DOMu, zobrazen pouze s výsledkem */}
      <div className={`space-y-6 ${(viewMode === 'map' && result) || loading ? '' : 'hidden'}`}>
        <div className="bg-slate-800 p-3 rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden">
          <div id="trip-map" className="w-full h-[450px] md:h-[600px] z-0"></div>
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
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Ověřené body zájmu</h3>
              <div className="flex flex-wrap gap-2">
                {result.links.map((chunk: any, i: number) => {
                  const data = chunk.web || chunk.maps;
                  if (!data) return null;
                  return (
                    <a key={i} href={data.uri} target="_blank" rel="noopener noreferrer" className="bg-slate-900 border border-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 text-[10px] font-bold text-slate-300 hover:border-orange-500 transition-all">
                      <i className="fas fa-map-pin text-orange-500"></i> {data.title}
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
