
import React, { useState, useEffect, useRef } from 'react';
import { planExpedition } from '../services/geminiService';
import { Expedition, TransportMode, TripDay } from '../types';

const TripPlanner: React.FC = () => {
  const [origin, setOrigin] = useState('Praha');
  const [days, setDays] = useState(3);
  const [travelers, setTravelers] = useState(2);
  const [mode, setMode] = useState<TransportMode>('moto');
  const [preferences, setPreferences] = useState('Hezké vyhlídky, spaní v přírodě nebo kempech, vyhýbat se dálnicím.');
  
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
    { val: 'cablecar', icon: 'fa-mountain-sun', label: 'Lanovka' },
  ];

  const handlePlan = async () => {
    setLoading(true);
    setViewMode('info');
    try {
      const result = await planExpedition(origin, days, mode, preferences, travelers);
      setExpedition(result);
      setActiveDayIdx(0);
    } catch (err) {
      alert("AI Expedice selhala. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  };

  const exportGPX = () => {
    if (!expedition) return;
    const currentDay = expedition.days[activeDayIdx];
    if (currentDay.waypoints.length === 0) {
      alert("Pro tento den nejsou dostupná GPS data.");
      return;
    }

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SpiritWanderer" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${expedition.name} - Den ${currentDay.dayNumber}</name>
  </metadata>
  <trk>
    <name>Den ${currentDay.dayNumber}</name>
    <trkseg>`;
    
    currentDay.waypoints.forEach(([lat, lon]) => {
      gpx += `\n      <trkpt lat="${lat}" lon="${lon}"></trkpt>`;
    });

    gpx += `\n    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expedice_den_${currentDay.dayNumber}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getDayColor = (dayNum: number) => {
    const colors = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ec4899'];
    return colors[(dayNum - 1) % colors.length];
  };

  useEffect(() => {
    const L = (window as any).L;
    if (!L) return;
    const initMap = () => {
      const mapEl = document.getElementById('exp-map');
      if (!mapEl || mapRef.current) return;
      mapRef.current = L.map('exp-map', { zoomControl: false, attributionControl: false }).setView([50, 15], 6);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
    };
    if (viewMode === 'map') setTimeout(initMap, 100);
  }, [viewMode]);

  useEffect(() => {
    const L = (window as any).L;
    if (!mapRef.current || !L || !expedition) return;
    if (polylineRef.current) mapRef.current.removeLayer(polylineRef.current);
    markersRef.current.forEach(m => mapRef.current.removeLayer(m));
    markersRef.current = [];

    const currentDay = expedition.days[activeDayIdx];
    if (currentDay && currentDay.waypoints.length > 0) {
      const color = getDayColor(currentDay.dayNumber);
      polylineRef.current = L.polyline(currentDay.waypoints, { color, weight: 6, opacity: 0.8 }).addTo(mapRef.current);
      const start = currentDay.waypoints[0];
      const end = currentDay.waypoints[currentDay.waypoints.length - 1];
      markersRef.current.push(L.circleMarker(start, { radius: 8, color: '#fff', weight: 3, fillColor: '#22c55e', fillOpacity: 1 }).addTo(mapRef.current));
      markersRef.current.push(L.circleMarker(end, { radius: 8, color: '#fff', weight: 3, fillColor: '#ef4444', fillOpacity: 1 }).addTo(mapRef.current));
      mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
    }
  }, [activeDayIdx, expedition, viewMode]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-2">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold font-brand uppercase text-white tracking-tighter">SPIRIT <span className="text-orange-500 italic">WANDERER</span></h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">AI Roadtrip Engine v2.0</p>
        </div>
        {expedition && (
          <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700">
            <button onClick={() => setViewMode('info')} className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase ${viewMode === 'info' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500'}`}>ITINERÁŘ</button>
            <button onClick={() => setViewMode('map')} className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase ${viewMode === 'map' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500'}`}>MAPA</button>
          </div>
        )}
      </header>

      {/* Control Panel */}
      <div className="bg-slate-800/80 p-6 md:p-8 rounded-[3rem] border border-slate-700 shadow-2xl space-y-6 backdrop-blur-md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Odjezd z</label>
            <input type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 px-5 text-sm text-white focus:border-orange-500 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Počet dní</label>
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-2xl px-2">
               <button onClick={() => setDays(Math.max(1, days - 1))} className="text-orange-500 p-3"><i className="fas fa-minus"></i></button>
               <span className="flex-grow text-center font-bold">{days}</span>
               <button onClick={() => setDays(Math.min(21, days + 1))} className="text-orange-500 p-3"><i className="fas fa-plus"></i></button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Cestující</label>
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-2xl px-2">
               <button onClick={() => setTravelers(Math.max(1, travelers - 1))} className="text-orange-500 p-3"><i className="fas fa-minus"></i></button>
               <span className="flex-grow text-center font-bold">{travelers} <i className="fas fa-user text-[10px] ml-1 opacity-50"></i></span>
               <button onClick={() => setTravelers(Math.min(10, travelers + 1))} className="text-orange-500 p-3"><i className="fas fa-plus"></i></button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Doprava</label>
            <div className="flex gap-2">
              {modes.map(m => (
                <button 
                  key={m.val} 
                  onClick={() => setMode(m.val)}
                  className={`flex-1 py-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${mode === m.val ? 'bg-orange-600 border-orange-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                >
                  <i className={`fas ${m.icon} text-sm`}></i>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Tvoje představa</label>
          <textarea 
            value={preferences} 
            onChange={(e) => setPreferences(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-5 text-sm text-white focus:border-orange-500 outline-none h-20 resize-none"
            placeholder="Kde chceš spát? Co chceš vidět?"
          />
        </div>

        <button 
          onClick={handlePlan}
          disabled={loading}
          className="w-full bg-orange-600 hover:bg-orange-700 py-5 rounded-2xl font-bold text-white shadow-xl shadow-orange-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
        >
          {loading ? <i className="fas fa-satellite animate-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
          {loading ? 'Hledám trasu a hotely...' : 'NAPLÁNOVAT EXPEDICI'}
        </button>
      </div>

      {/* Expedition Results */}
      {expedition && !loading && (
        <div className="animate-fadeIn space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide snap-x px-2">
             {expedition.days.map((day, idx) => (
               <button 
                key={idx}
                onClick={() => setActiveDayIdx(idx)}
                className={`snap-center shrink-0 px-8 py-5 rounded-[2rem] border transition-all flex flex-col items-center gap-1 min-w-[120px] ${activeDayIdx === idx ? 'bg-orange-600 border-orange-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
               >
                 <span className="text-[10px] font-bold uppercase opacity-60 tracking-widest">Den</span>
                 <span className="text-2xl font-brand font-bold leading-none">{day.dayNumber}</span>
               </button>
             ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`lg:col-span-2 space-y-6 ${viewMode === 'info' ? 'block' : 'hidden lg:block'}`}>
               <div className="bg-slate-800 p-8 rounded-[3rem] border border-slate-700 shadow-xl relative">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-brand font-bold text-white uppercase tracking-tight">Průvodce dnem</h3>
                    <button 
                      onClick={exportGPX}
                      className="bg-slate-900 hover:bg-slate-700 text-orange-500 px-4 py-2 rounded-xl border border-slate-700 text-[10px] font-bold uppercase flex items-center gap-2 transition-all"
                    >
                      <i className="fas fa-download"></i> GPX EXPORT
                    </button>
                  </div>
                  <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {expedition.days[activeDayIdx].description}
                  </div>
               </div>
            </div>

            <div className="space-y-6">
               <div className="bg-slate-800 p-6 rounded-[3rem] border border-slate-700 shadow-xl">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <i className="fas fa-bed text-orange-500"></i> Ubytování na noc
                  </h3>
                  {expedition.days[activeDayIdx].accommodation ? (
                    <div className="space-y-4">
                      <div className="bg-slate-900 p-5 rounded-3xl border border-slate-700 border-l-4 border-l-orange-500">
                        <p className="text-sm font-bold text-white mb-1">{expedition.days[activeDayIdx].accommodation?.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-3">{expedition.days[activeDayIdx].accommodation?.type}</p>
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(expedition.days[activeDayIdx].accommodation?.name || '')}`}
                          target="_blank"
                          className="inline-flex items-center gap-2 text-orange-500 text-[10px] font-bold uppercase hover:underline"
                        >
                          ZOBRAZIT NA MAPĚ <i className="fas fa-arrow-right"></i>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Hledám ubytování...</p>
                  )}
               </div>
               
               <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-[3rem] border border-slate-700 shadow-xl">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Detaily expedice</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 text-center">
                      <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Cestující</p>
                      <p className="text-lg font-brand font-bold text-white">{expedition.travelersCount}</p>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 text-center">
                      <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Doprava</p>
                      <i className={`fas ${modes.find(m => m.val === expedition.transportMode)?.icon} text-orange-500`}></i>
                    </div>
                  </div>
               </div>
            </div>
          </div>

          <div className={`${viewMode === 'map' ? 'block' : 'hidden lg:block'} h-[550px] bg-slate-800 rounded-[3.5rem] border border-slate-700 overflow-hidden relative shadow-2xl group`}>
            <div id="exp-map" className="w-full h-full z-0"></div>
            <div className="absolute top-8 left-8 z-10 bg-slate-900/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-slate-700 shadow-xl">
               <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Trasa - Den {expedition.days[activeDayIdx].dayNumber}</p>
            </div>
            <div className="absolute bottom-8 right-8 z-10 flex gap-2">
               <button onClick={() => mapRef.current?.zoomIn()} className="w-12 h-12 bg-slate-900/90 text-white rounded-xl border border-slate-700 flex items-center justify-center shadow-xl"><i className="fas fa-plus"></i></button>
               <button onClick={() => mapRef.current?.zoomOut()} className="w-12 h-12 bg-slate-900/90 text-white rounded-xl border border-slate-700 flex items-center justify-center shadow-xl"><i className="fas fa-minus"></i></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripPlanner;
