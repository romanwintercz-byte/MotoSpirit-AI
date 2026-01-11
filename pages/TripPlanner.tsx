
import React, { useState, useEffect, useRef } from 'react';
import { planTripWithGrounding } from '../services/geminiService';

const TripPlanner: React.FC = () => {
  const [origin, setOrigin] = useState('Praha');
  const [preferences, setPreferences] = useState('Zatáčky, pěkné vyhlídky, málo provozu');
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
      alert("AI plánování selhalo.");
    } finally {
      setLoading(false);
    }
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
      setPreferences(text);
      handlePlan(text);
    };
    recognition.start();
  };

  // Inicializace mapy (pouze jednou)
  useEffect(() => {
    const L = (window as any).L;
    if (!L || mapRef.current) return;

    const mapInstance = L.map('trip-map', {
      zoomControl: false,
      attributionControl: false
    }).setView([50.0755, 14.4378], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(mapInstance);

    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);
    mapRef.current = mapInstance;
  }, []);

  // Aktualizace trasy a oprava velikosti při přepnutí
  useEffect(() => {
    if (!mapRef.current) return;

    // Fix pro Leaflet: přepočítat velikost, když se div zviditelní
    if (viewMode === 'map') {
      setTimeout(() => {
        mapRef.current.invalidateSize();
        if (polylineRef.current) {
          mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
        }
      }, 100);
    }

    if (result?.waypoints && result.waypoints.length > 0) {
      const L = (window as any).L;
      
      // Vyčistit starou trasu
      if (polylineRef.current) mapRef.current.removeLayer(polylineRef.current);
      markersRef.current.forEach(m => mapRef.current?.removeLayer(m));
      markersRef.current = [];

      // Nová linie
      polylineRef.current = L.polyline(result.waypoints, {
        color: '#f97316',
        weight: 5,
        opacity: 0.8,
        lineJoin: 'round'
      }).addTo(mapRef.current);

      // Body zastávek
      result.waypoints.forEach((wp, idx) => {
        const marker = L.circleMarker(wp, {
          radius: idx === 0 || idx === result.waypoints.length - 1 ? 8 : 4,
          fillColor: idx === 0 ? '#22c55e' : (idx === result.waypoints.length - 1 ? '#ef4444' : '#f97316'),
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        }).addTo(mapRef.current!);
        markersRef.current.push(marker);
      });

      if (viewMode === 'map') {
        mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
      }
    }
  }, [viewMode, result]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-2">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold font-brand uppercase tracking-tighter text-white">AI <span className="text-orange-500">PLÁNOVAČ</span></h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Hlasem nebo textem navrhni trasu</p>
        </div>
        
        {result && (
          <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700">
            <button 
              onClick={() => setViewMode('text')}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'text' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <i className="fas fa-align-left mr-2"></i> Itinerář
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <i className="fas fa-map mr-2"></i> Mapa trasy
            </button>
          </div>
        )}
      </div>

      <div className="bg-slate-800/80 p-6 md:p-8 rounded-[2.5rem] border border-slate-700 shadow-xl space-y-6 backdrop-blur-md relative overflow-hidden">
        <i className="fas fa-route absolute -bottom-10 -right-10 text-[12rem] text-white/[0.03] rotate-12 pointer-events-none"></i>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Startovací bod</label>
            <div className="relative">
              <i className="fas fa-location-dot absolute left-5 top-1/2 -translate-y-1/2 text-orange-500"></i>
              <input 
                type="text" 
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 pl-12 pr-6 focus:border-orange-500 outline-none transition-all text-sm font-semibold text-white"
                placeholder="Odkud vyjíždíš?"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Tvoje preference / Cíl</label>
            <div className="relative">
              <i className="fas fa-sparkles absolute left-5 top-1/2 -translate-y-1/2 text-orange-500"></i>
              <input 
                type="text" 
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 pl-12 pr-6 focus:border-orange-500 outline-none transition-all text-sm font-semibold text-white"
                placeholder="Kam to bude? Nebo jaký styl jízdy?"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 relative z-10">
           <button 
            onClick={handleVoiceInput}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-lg shrink-0 ${isRecording ? 'bg-red-500 animate-pulse text-white' : 'bg-slate-900 hover:bg-slate-700 border border-slate-700 text-white'}`}
            title="Diktovat hlasem"
          >
            <i className={`fas ${isRecording ? 'fa-microphone' : 'fa-microphone-lines'} text-xl`}></i>
          </button>
          
          <button 
            onClick={() => handlePlan()}
            disabled={loading}
            className="flex-grow bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? <i className="fas fa-sync-alt animate-spin"></i> : <i className="fas fa-map-marked-alt"></i>}
            {loading ? 'AI KRESLÍ TRASU...' : 'VYGENEROVAT VÝLET'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-slate-800/80 border border-orange-500/30 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-4 animate-pulse shadow-xl text-center">
           <div className="w-16 h-16 bg-orange-600 rounded-[2rem] flex items-center justify-center animate-bounce shadow-[0_0_30px_rgba(249,115,22,0.4)]">
              <i className="fas fa-motorcycle text-white text-2xl"></i>
           </div>
           <div>
              <p className="font-brand font-bold uppercase tracking-tight text-white">AI hledá ty nejlepší zatáčky...</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Stahuji živá data z Google Maps</p>
           </div>
        </div>
      )}

      {/* Map Container - Vždy v DOMu, jen schovaný */}
      <div className={`space-y-6 animate-slideUp ${viewMode === 'map' && result ? '' : 'hidden'}`}>
        <div className="bg-slate-800 p-4 rounded-[2.5rem] border border-slate-700 shadow-2xl relative overflow-hidden">
          <div id="trip-map" className="w-full h-[500px] z-0"></div>
          {result?.waypoints && result.waypoints.length > 0 && (
            <div className="absolute top-8 left-8 z-10 bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-700 shadow-xl max-w-[200px] hidden sm:block">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Statistika trasy</p>
              <p className="text-white font-bold text-xs flex items-center gap-2">
                <i className="fas fa-route text-orange-500"></i> {result.waypoints.length} bodů trasy
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Text Itinerary - Zobrazí se jen když není mapa */}
      {viewMode === 'text' && result && (
        <div className="bg-slate-800 p-8 rounded-[2.5rem] border border-orange-500/20 space-y-6 shadow-2xl animate-slideUp">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold font-brand text-white flex items-center gap-3 uppercase">
              <i className="fas fa-route text-orange-500"></i> Itinerář výletu
            </h2>
          </div>
          <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap bg-slate-900/50 p-6 rounded-2xl border border-slate-700">
            {result.text}
          </div>

          {result.links.length > 0 && (
            <div className="pt-4 border-t border-slate-700">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Ověřené zdroje a místa</h3>
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
                      className="bg-slate-900 hover:bg-orange-600/20 border border-slate-700 hover:border-orange-500/50 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-bold transition-all text-slate-300"
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
