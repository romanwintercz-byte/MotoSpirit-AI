
import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import { planExpedition, refineExpedition } from '../services/geminiService';
import { shareExpeditionPublicly, syncDataToCloud } from '../services/syncService';
import { Expedition, TransportMode, TripDay, ExpeditionPreferences } from '../types';

const TripPlanner: React.FC = () => {
  // --- FORM STATE ---
  const [origin, setOrigin] = useState('Praha');
  const [days, setDays] = useState(3);
  const [travelers, setTravelers] = useState(2);
  const [mode, setMode] = useState<TransportMode>('moto');
  
  // Enhanced Preferences
  const [prefAcc, setPrefAcc] = useState<ExpeditionPreferences['accommodation']>('camp');
  const [prefExp, setPrefExp] = useState<string[]>(['curves', 'views']);
  const [prefPace, setPrefPace] = useState<ExpeditionPreferences['pace']>('standard');
  const [prefBudget, setPrefBudget] = useState<ExpeditionPreferences['budget']>('mid');
  const [customNote, setCustomNote] = useState('');
  
  // --- APP STATE ---
  const [loading, setLoading] = useState(false);
  const [expedition, setExpedition] = useState<Expedition | null>(null);
  const [savedExpeditions, setSavedExpeditions] = useState<Expedition[]>(() => {
    const saved = localStorage.getItem('spirit_wanderer_trips');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch (e) {
      return [];
    }
  });
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'info' | 'map'>('info');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [showRefine, setShowRefine] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // --- REFS ---
  const mapRef = useRef<any | null>(null);
  const polylineRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);

  const modes: { val: TransportMode, icon: string, label: string }[] = [
    { val: 'moto', icon: 'fa-motorcycle', label: 'Motorka' },
    { val: 'car', icon: 'fa-car', label: 'Auto' },
    { val: 'walk', icon: 'fa-person-hiking', label: 'Pěšky' },
    { val: 'cablecar', icon: 'fa-mountain-sun', label: 'Lanovka' },
  ];

  const experienceOptions = [
    { id: 'curves', label: 'Zatáčky', icon: 'fa-road' },
    { id: 'history', label: 'Historie', icon: 'fa-fort-awesome' },
    { id: 'food', label: 'Gastro', icon: 'fa-utensils' },
    { id: 'offroad', label: 'Off-road', icon: 'fa-mound' },
    { id: 'views', label: 'Vyhlídky', icon: 'fa-mountain' },
  ];

  // --- PERSISTENCE ---
  const autoSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem('spirit_wanderer_trips', JSON.stringify(savedExpeditions));
    
    // Auto-sync with debounce
    const syncCode = localStorage.getItem('motospirit_sync_code');
    if (syncCode) {
      if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current);
      autoSyncTimeoutRef.current = setTimeout(() => {
        const user = JSON.parse(localStorage.getItem('motospirit_user') || '{}');
        const bikes = JSON.parse(localStorage.getItem('motospirit_bikes') || '[]');
        const records = JSON.parse(localStorage.getItem('motospirit_records') || '[]');
        const fuel = JSON.parse(localStorage.getItem('motospirit_fuel') || '[]');
        
        syncDataToCloud(syncCode, {
          user,
          bikes,
          records,
          fuel,
          expeditions: savedExpeditions
        }).catch(console.error);
      }, 2000);
    }

    return () => {
      if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current);
    };
  }, [savedExpeditions]);

  // --- HANDLERS ---
  const handlePlan = async () => {
    setLoading(true);
    setViewMode('info');
    setShowRefine(false);
    const prefs: ExpeditionPreferences = {
      accommodation: prefAcc,
      experiences: prefExp,
      pace: prefPace,
      budget: prefBudget,
      customNote
    };
    try {
      const result = await planExpedition(origin, days, mode, prefs, travelers);
      setExpedition(result);
      setActiveDayIdx(0);
    } catch (err) {
      alert("AI Expedice selhala. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!expedition || !refinePrompt.trim()) return;
    setLoading(true);
    try {
      const result = await refineExpedition(expedition, refinePrompt);
      setExpedition(result);
      setRefinePrompt('');
      setShowRefine(false);
      setActiveDayIdx(0);
    } catch (err) {
      alert("Ladění selhalo. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!expedition) return;
    const syncCode = localStorage.getItem('motospirit_sync_code');
    if (!syncCode) {
      alert("Pro sdílení musíš mít aktivovaný Moto Cloud v sekci Garáž.");
      return;
    }
    
    setIsSharing(true);
    try {
      const slug = await shareExpeditionPublicly(syncCode, expedition);
      if (slug) {
        const url = `${window.location.origin}/#/share/${slug}`;
        setShareUrl(url);
      }
    } catch (e) {
      alert("Sdílení selhalo.");
    } finally {
      setIsSharing(false);
    }
  };

  const toggleExperience = (id: string) => {
    setPrefExp(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const saveExpedition = () => {
    if (!expedition) return;
    const name = window.prompt("Pojmenuj svou expedici:", expedition.name);
    if (name) {
      const newExp = { ...expedition, name, id: Date.now().toString() };
      setSavedExpeditions(prev => {
        const filtered = prev.filter(ex => ex.id !== newExp.id);
        return [newExp, ...filtered];
      });
      setExpedition(newExp);
      alert("Expedice byla uložena do tvého profilu.");
    }
  };

  const deleteExpedition = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Opravdu smazat tuto expedici?")) {
      setSavedExpeditions(prev => prev.filter(ex => ex.id !== id));
      if (expedition?.id === id) setExpedition(null);
    }
  };

  const loadExpedition = (ex: Expedition) => {
    setExpedition(ex);
    setActiveDayIdx(0);
    setViewMode('info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
  <metadata><name>${expedition.name} - Den ${currentDay.dayNumber}</name></metadata>
  <trk><name>Den ${currentDay.dayNumber}</name><trkseg>`;
    currentDay.waypoints.forEach(([lat, lon]) => {
      gpx += `\n      <trkpt lat="${lat}" lon="${lon}"></trkpt>`;
    });
    gpx += `\n    </trkseg></trk></gpx>`;

    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${expedition.name.replace(/\s+/g, '_')}_den_${currentDay.dayNumber}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getDayColor = (dayNum: number) => {
    const colors = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ec4899'];
    return colors[(dayNum - 1) % colors.length];
  };

  // --- MAP LOGIC ---
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
    <div className="max-w-6xl mx-auto space-y-8 pb-32 px-4">
      <header className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold font-brand uppercase text-white tracking-tighter">SPIRIT <span className="text-orange-500 italic">WANDERER</span></h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mt-1 opacity-70">AI Roadtrip Engine v2.5</p>
        </div>
        {expedition && (
          <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md">
            <button onClick={() => setViewMode('info')} className={`px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'info' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>ITINERÁŘ</button>
            <button onClick={() => setViewMode('map')} className={`px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>MAPA</button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & Saved List */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-slate-800/80 p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-6 backdrop-blur-md">
            <h2 className="text-xs font-bold text-orange-500 uppercase tracking-[0.3em] ml-2">Nové dobrodružství</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-3">Start</label>
                <input type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3 px-5 text-sm text-white focus:border-orange-500 outline-none transition-all" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-3">Dny</label>
                  <div className="flex items-center bg-slate-950 border border-slate-700 rounded-2xl px-2">
                    <button onClick={() => setDays(Math.max(1, days - 1))} className="text-orange-500 p-2"><i className="fas fa-minus text-xs"></i></button>
                    <span className="flex-grow text-center font-bold text-sm">{days}</span>
                    <button onClick={() => setDays(Math.min(21, days + 1))} className="text-orange-500 p-2"><i className="fas fa-plus text-xs"></i></button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-3">Lidé</label>
                  <div className="flex items-center bg-slate-950 border border-slate-700 rounded-2xl px-2">
                    <button onClick={() => setTravelers(Math.max(1, travelers - 1))} className="text-orange-500 p-2"><i className="fas fa-minus text-xs"></i></button>
                    <span className="flex-grow text-center font-bold text-sm">{travelers}</span>
                    <button onClick={() => setTravelers(Math.min(10, travelers + 1))} className="text-orange-500 p-2"><i className="fas fa-plus text-xs"></i></button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-3">Mód</label>
                <div className="grid grid-cols-4 gap-2">
                  {modes.map(m => (
                    <button 
                      key={m.val} 
                      onClick={() => setMode(m.val)}
                      className={`py-3 rounded-xl border transition-all flex items-center justify-center ${mode === m.val ? 'bg-orange-600 border-orange-400 text-white shadow-lg shadow-orange-900/40' : 'bg-slate-950 border-slate-700 text-slate-600 hover:border-slate-500'}`}
                      title={m.label}
                    >
                      <i className={`fas ${m.icon} text-xs`}></i>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-3">Ubytování</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'wild', icon: 'fa-tents', label: 'Wild' },
                      { id: 'camp', icon: 'fa-campground', label: 'Kemp' },
                      { id: 'pension', icon: 'fa-house-user', label: 'Penzion' },
                      { id: 'hotel', icon: 'fa-hotel', label: 'Hotel' }
                    ].map(acc => (
                      <button 
                        key={acc.id}
                        onClick={() => setPrefAcc(acc.id as any)}
                        className={`py-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${prefAcc === acc.id ? 'bg-orange-600 border-orange-400 text-white' : 'bg-slate-950 border-slate-700 text-slate-600'}`}
                      >
                        <i className={`fas ${acc.icon} text-[10px]`}></i>
                        <span className="text-[8px] font-bold uppercase">{acc.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-3">Zážitky</label>
                  <div className="flex flex-wrap gap-2">
                    {experienceOptions.map(opt => (
                      <button 
                        key={opt.id}
                        onClick={() => toggleExperience(opt.id)}
                        className={`px-3 py-2 rounded-xl border text-[9px] font-bold uppercase transition-all flex items-center gap-2 ${prefExp.includes(opt.id) ? 'bg-orange-600 border-orange-400 text-white' : 'bg-slate-950 border-slate-700 text-slate-600'}`}
                      >
                        <i className={`fas ${opt.icon}`}></i> {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-3">Tempo</label>
                    <select 
                      value={prefPace} 
                      onChange={(e) => setPrefPace(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3 px-4 text-[10px] font-bold uppercase text-white outline-none focus:border-orange-500"
                    >
                      <option value="chill">Kochačka</option>
                      <option value="standard">Standard</option>
                      <option value="fast">Rychlé</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-3">Rozpočet</label>
                    <select 
                      value={prefBudget} 
                      onChange={(e) => setPrefBudget(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3 px-4 text-[10px] font-bold uppercase text-white outline-none focus:border-orange-500"
                    >
                      <option value="low">Nízký</option>
                      <option value="mid">Střední</option>
                      <option value="high">Vysoký</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-3">Vlastní poznámka</label>
                  <textarea 
                    value={customNote} 
                    onChange={(e) => setCustomNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3 px-5 text-xs text-white focus:border-orange-500 outline-none h-20 resize-none transition-all"
                    placeholder="Např. Chci vidět Grossglockner..."
                  />
                </div>

                <button 
                  onClick={handlePlan}
                  disabled={loading}
                  className="w-full bg-orange-600 hover:bg-orange-700 py-4 rounded-2xl font-bold text-white shadow-xl shadow-orange-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                >
                  {loading ? <i className="fas fa-satellite-dish animate-spin"></i> : <i className="fas fa-sparkles"></i>}
                  {loading ? 'Generuji...' : 'PLÁNOVAT EXPEDICI'}
                </button>
              </div>
            </div>
          </div>

          {/* Saved Expeditions List */}
          <div className="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 space-y-4">
             <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] ml-2">Moje Expedice</h2>
             {savedExpeditions.length === 0 ? (
               <div className="py-8 text-center border-2 border-dashed border-slate-700 rounded-3xl">
                 <i className="fas fa-map-marked-alt text-slate-700 text-2xl mb-2"></i>
                 <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Zatím žádné plány</p>
               </div>
             ) : (
               <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                 {savedExpeditions.map(ex => (
                   <div 
                    key={ex.id}
                    onClick={() => loadExpedition(ex)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between ${expedition?.id === ex.id ? 'bg-orange-600/10 border-orange-500 shadow-lg' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}`}
                   >
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 group-hover:border-orange-500/50">
                         <i className={`fas ${modes.find(m => m.val === ex.transportMode)?.icon} text-orange-500 text-xs`}></i>
                       </div>
                       <div>
                         <h4 className="text-xs font-bold text-white truncate max-w-[120px] uppercase tracking-tight">{ex.name}</h4>
                         <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{ex.days.length} DNÍ • {ex.travelersCount} LIDÉ</p>
                       </div>
                     </div>
                     <button onClick={(e) => deleteExpedition(ex.id, e)} className="text-slate-700 hover:text-red-500 p-2 transition-colors">
                       <i className="fas fa-trash-alt text-[10px]"></i>
                     </button>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>

        {/* Right Column: Content */}
        <div className="lg:col-span-8 space-y-8">
          {expedition && !loading ? (
            <div className="animate-fadeIn space-y-8">
              {/* Day Tabs */}
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x px-2">
                {expedition.days.map((day, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setActiveDayIdx(idx)}
                    className={`snap-center shrink-0 px-8 py-6 rounded-[2rem] border transition-all flex flex-col items-center gap-1 min-w-[120px] ${activeDayIdx === idx ? 'bg-orange-600 border-orange-400 text-white shadow-xl -translate-y-1' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                  >
                    <span className="text-[10px] font-bold uppercase opacity-50 tracking-widest leading-none">Den</span>
                    <span className="text-3xl font-brand font-bold leading-none">{day.dayNumber}</span>
                  </button>
                ))}
              </div>

              {/* Main Info Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`md:col-span-2 space-y-6 ${viewMode === 'info' ? 'block' : 'hidden md:block'}`}>
                  <div className="bg-slate-800 p-8 rounded-[3rem] border border-slate-700 shadow-2xl relative group">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                      <div>
                        <h3 className="text-2xl font-brand font-bold text-white uppercase tracking-tighter italic">{expedition.name}</h3>
                        <p className="text-orange-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Hvězdný deník cestovatele</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => setShowRefine(!showRefine)}
                          className={`px-4 py-2 rounded-xl text-[9px] font-bold uppercase flex items-center gap-2 transition-all ${showRefine ? 'bg-slate-700 text-white' : 'bg-slate-900 text-orange-500 border border-slate-700'}`}
                        >
                          <i className="fas fa-wand-magic-sparkles"></i> LADIT S AI
                        </button>
                        <button 
                          onClick={handleShare}
                          disabled={isSharing}
                          className="bg-slate-900 hover:bg-slate-700 text-blue-400 px-4 py-2 rounded-xl border border-slate-700 text-[9px] font-bold uppercase flex items-center gap-2 transition-all active:scale-95"
                        >
                          <i className={`fas ${isSharing ? 'fa-sync-alt animate-spin' : 'fa-share-nodes'}`}></i> SDÍLET
                        </button>
                        {savedExpeditions.some(ex => ex.id === expedition.id) ? (
                          <span className="bg-green-600/10 text-green-500 px-4 py-2 rounded-xl border border-green-500/20 text-[9px] font-bold uppercase flex items-center gap-2">
                             <i className="fas fa-check"></i> ULOŽENO
                          </span>
                        ) : (
                          <button 
                            onClick={saveExpedition}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl shadow-lg text-[9px] font-bold uppercase flex items-center gap-2 transition-all active:scale-95"
                          >
                            <i className="fas fa-save"></i> ULOŽIT TRASU
                          </button>
                        )}
                      </div>
                    </div>

                    {showRefine && (
                      <div className="mb-8 p-6 bg-slate-950/80 rounded-[2rem] border border-orange-500/30 animate-slideUp">
                        <label className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2 block">Co chceš na expedici změnit?</label>
                        <div className="flex gap-3">
                          <input 
                            type="text" 
                            value={refinePrompt}
                            onChange={(e) => setRefinePrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                            placeholder="Např. 'Přidej víc zatáček ve 2. dni' nebo 'Změň ubytování na kempy'..."
                            className="flex-grow bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-xs text-white outline-none focus:border-orange-500"
                          />
                          <button 
                            onClick={handleRefine}
                            disabled={loading || !refinePrompt.trim()}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl text-[10px] font-bold uppercase transition-all disabled:opacity-50"
                          >
                            UPRAVIT
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="bg-slate-950/50 p-6 rounded-[2rem] border border-slate-700/50">
                      <div className="markdown-body prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed">
                        <Markdown>{expedition.days[activeDayIdx].description}</Markdown>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Accommodation Card */}
                  <div className="bg-slate-800 p-6 rounded-[2.5rem] border border-slate-700 shadow-xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <i className="fas fa-hotel text-6xl"></i>
                    </div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-orange-600/20 flex items-center justify-center">
                        <i className="fas fa-bed text-orange-500 text-[10px]"></i>
                      </span>
                      Ubytování na noc
                    </h3>
                    
                    {expedition.days[activeDayIdx].accommodation ? (
                      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-700 border-l-4 border-l-orange-500 shadow-inner">
                        <p className="text-sm font-bold text-white mb-1 leading-tight">{expedition.days[activeDayIdx].accommodation?.name}</p>
                        <p className="text-[9px] text-slate-600 uppercase font-bold tracking-widest mb-4">{expedition.days[activeDayIdx].accommodation?.type}</p>
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(expedition.days[activeDayIdx].accommodation?.name || '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl border border-slate-700 flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-all"
                        >
                          MAPA <i className="fas fa-external-link-alt text-[8px] opacity-50"></i>
                        </a>
                      </div>
                    ) : (
                      <div className="py-8 text-center bg-slate-900 rounded-3xl border border-slate-700 border-dashed">
                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Hledám základnu...</p>
                      </div>
                    )}
                  </div>

                  {/* Expedition Summary Card */}
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-[2.5rem] border border-slate-700 shadow-xl">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Parametry výpravy</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-700/50 text-center">
                        <p className="text-[8px] text-slate-600 font-bold uppercase mb-1 tracking-widest">Cestující</p>
                        <p className="text-xl font-brand font-bold text-white">{expedition.travelersCount}</p>
                      </div>
                      <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-700/50 text-center">
                        <p className="text-[8px] text-slate-600 font-bold uppercase mb-1 tracking-widest">Doprava</p>
                        <div className="h-7 flex items-center justify-center">
                          <i className={`fas ${modes.find(m => m.val === expedition.transportMode)?.icon} text-orange-500`}></i>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map Section */}
              <div className={`${viewMode === 'map' ? 'block' : 'hidden md:block'} h-[600px] bg-slate-800 rounded-[3.5rem] border border-slate-700 overflow-hidden relative shadow-2xl group`}>
                <div id="exp-map" className="w-full h-full z-0"></div>
                <div className="absolute top-8 left-8 z-10 bg-slate-950/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-slate-700 shadow-2xl">
                   <p className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.3em]">Trasa dne {expedition.days[activeDayIdx].dayNumber}</p>
                </div>
                <div className="absolute bottom-8 right-8 z-10 flex flex-col gap-2">
                   <button onClick={() => mapRef.current?.zoomIn()} className="w-12 h-12 bg-slate-950/90 text-white rounded-xl border border-slate-700 flex items-center justify-center shadow-xl active:scale-90 transition-all"><i className="fas fa-plus"></i></button>
                   <button onClick={() => mapRef.current?.zoomOut()} className="w-12 h-12 bg-slate-950/90 text-white rounded-xl border border-slate-700 flex items-center justify-center shadow-xl active:scale-90 transition-all"><i className="fas fa-minus"></i></button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[500px] bg-slate-800/30 border-2 border-dashed border-slate-700 rounded-[3rem] flex flex-col items-center justify-center p-12 text-center space-y-6">
              {loading ? (
                <div className="space-y-6 animate-pulse">
                  <div className="relative mx-auto">
                    <div className="w-24 h-24 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                    <i className="fas fa-robot absolute inset-0 flex items-center justify-center text-orange-500 text-3xl"></i>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-brand font-bold text-white uppercase tracking-tight">AI Spirit pracuje...</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest max-w-[250px]">Skenuji mapy, hledám kempy a nejlepší zatáčky pro tvůj výlet.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto border border-slate-700 shadow-2xl">
                    <i className="fas fa-compass text-slate-700 text-4xl"></i>
                  </div>
                  <div className="max-w-xs mx-auto space-y-3">
                    <h3 className="text-xl font-brand font-bold text-white uppercase tracking-tighter opacity-50">Expediční Hub</h3>
                    <p className="text-slate-500 text-xs font-medium leading-relaxed">
                      Zadej parametry vlevo a nech AI vytvořit nezapomenutelnou trasu, nebo si vyber jednu ze svých uložených expedic.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Share Modal */}
      {shareUrl && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-fadeIn">
          <div className="bg-slate-800 w-full max-w-md rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-8 border-b border-slate-700 flex justify-between items-center">
               <h2 className="text-xl font-brand font-bold uppercase tracking-tight text-white">SDÍLET <span className="text-orange-500">EXPEDICI</span></h2>
               <button onClick={() => setShareUrl(null)} className="text-slate-500 hover:text-white p-2">
                 <i className="fas fa-times text-xl"></i>
               </button>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-xs text-slate-400 leading-relaxed">Tvoje expedice je nyní veřejně dostupná. Pošli tento odkaz kamarádům:</p>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-700 flex items-center gap-3">
                <input 
                  type="text" 
                  readOnly 
                  value={shareUrl} 
                  className="bg-transparent flex-grow text-[10px] text-orange-500 font-mono outline-none"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    alert("Odkaz zkopírován!");
                  }}
                  className="text-slate-500 hover:text-white"
                >
                  <i className="fas fa-copy"></i>
                </button>
              </div>
              <button 
                onClick={() => setShareUrl(null)}
                className="w-full bg-orange-600 hover:bg-orange-500 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest text-white transition-all"
              >
                HOTOVO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripPlanner;
