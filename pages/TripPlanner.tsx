
import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { planExpedition, refineExpedition } from '../services/geminiService';
import { shareExpeditionPublicly, syncDataToCloud, getAllPublicProfiles } from '../services/syncService';
import { getGoogleMapsUrl } from '../utils/navigation';
import { Expedition, TransportMode, TripDay, ExpeditionPreferences, UserProfile } from '../types';
import { useActiveExpedition } from '../hooks/useActiveExpedition';

const TripPlanner: React.FC = () => {
  const navigate = useNavigate();
  const { activeState, startExpedition } = useActiveExpedition();
  
  // --- FORM STATE ---
  const [origin, setOrigin] = useState('Praha');
  const [days, setDays] = useState(3);
  const [travelers, setTravelers] = useState(2);
  const [mode, setMode] = useState<TransportMode>('moto');
  const [tripType, setTripType] = useState<'ride' | 'expedition'>('expedition');
  
  // Enhanced Preferences
  const [prefAcc, setPrefAcc] = useState<ExpeditionPreferences['accommodation']>('camp');
  const [prefExp, setPrefExp] = useState<string[]>(['curves', 'views']);
  const [prefPace, setPrefPace] = useState<ExpeditionPreferences['pace']>('standard');
  const [prefBudget, setPrefBudget] = useState<ExpeditionPreferences['budget']>('mid');
  const [customNote, setCustomNote] = useState('');
  const [isRoundTrip, setIsRoundTrip] = useState(true);
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [newWaypoint, setNewWaypoint] = useState('');
  const [isListening, setIsListening] = useState<'origin' | 'waypoint' | null>(null);

  // --- VOICE INPUT ---
  const handleVoiceInput = (target: 'origin' | 'waypoint') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tvůj prohlížeč nepodporuje hlasové zadávání.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'cs-CZ';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(target);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (target === 'origin') {
        setOrigin(transcript);
      } else if (target === 'waypoint') {
        setNewWaypoint(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(null);
    };

    recognition.onend = () => {
      setIsListening(null);
    };

    recognition.start();
  };

  const addWaypoint = () => {
    if (newWaypoint.trim()) {
      setWaypoints([...waypoints, newWaypoint.trim()]);
      setNewWaypoint('');
    }
  };

  const removeWaypoint = (index: number) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
  };
  
  // --- APP STATE ---
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingSteps = [
    "Studuji mapy a terén...",
    "Hledám ty nejlepší zatáčky...",
    "Počítám spotřebu a rozpočet...",
    "Zjišťuji rychlostní limity...",
    "Balím virtuální kufry..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % loadingSteps.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading]);

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
  const [viewMode, setViewMode] = useState<'info' | 'map' | 'stats' | 'countries'>('info');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [showRefine, setShowRefine] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [followedRiders, setFollowedRiders] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showChallengeAudience, setShowChallengeAudience] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);

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

  const quickRefines = [
    "Zkrať trasu o 20%",
    "Přidej více zatáček",
    "Najdi levnější ubytování",
    "Vyhni se dálnicím",
    "Přidej více vyhlídek"
  ];

  // --- PERSISTENCE ---
  const autoSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem('spirit_wanderer_trips', JSON.stringify(savedExpeditions));
    
    // Auto-sync with debounce
    const syncCode = localStorage.getItem('motospirit_sync_code');
    if (syncCode && !(window as any).__isSyncingFromCloud) {
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

  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem('spirit_wanderer_trips');
      if (saved) setSavedExpeditions(JSON.parse(saved));
    };
    window.addEventListener('storage', sync);
    window.addEventListener('sync-update', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('sync-update', sync);
    };
  }, []);

  // Fetch Followed Riders
  useEffect(() => {
    const syncCode = localStorage.getItem('motospirit_sync_code');
    if (!syncCode) return;

    const loadData = async () => {
      const userStr = localStorage.getItem('motospirit_user');
      if (userStr) {
        const user = JSON.parse(userStr) as UserProfile;
        if (user.following && user.following.length > 0) {
          const allProfiles = await getAllPublicProfiles();
          const followed = allProfiles.filter(p => user.following?.includes(p.syncCode));
          setFollowedRiders(followed);
        }
      }
    };
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

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
      customNote: waypoints.length > 0 ? `Průjezdní body: ${waypoints.join(', ')}. ${customNote}` : customNote
    };
    try {
      const result = await planExpedition(origin, days, mode, prefs, travelers, tripType);
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
        
        if (navigator.share) {
          try {
            await navigator.share({
              title: `MotoSpirit Trasa: ${expedition.name}`,
              text: `Koukni na tuhle super trasu na motorce: ${expedition.name}`,
              url: url
            });
          } catch (err) {
            // User cancelled or share failed, fallback to modal
            setShareUrl(url);
          }
        } else {
          setShareUrl(url);
        }
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

  const handleCreateChallengeWithExp = (ex: Expedition, audience: 'all' | 'party' | 'private') => {
    navigate('/radar', { state: { createChallenge: true, expedition: ex, audience } });
  };

  const exportGPX = () => {
    if (!expedition) return;

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SpiritWanderer" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${expedition.name}</name></metadata>`;

    expedition.days.forEach(day => {
      if (day.waypoints && day.waypoints.length > 0) {
        gpx += `\n  <trk><name>Den ${day.dayNumber}: ${day.startLocation} - ${day.endLocation}</name><trkseg>`;
        day.waypoints.forEach(([lat, lon]) => {
          gpx += `\n      <trkpt lat="${lat}" lon="${lon}"></trkpt>`;
        });
        gpx += `\n    </trkseg></trk>`;
      }
    });

    gpx += `\n</gpx>`;

    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${expedition.name.replace(/\s+/g, '_')}.gpx`;
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
        <div className="flex items-center gap-4">
          {expedition && (
            <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md overflow-x-auto">
              <button onClick={() => setViewMode('info')} className={`px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${viewMode === 'info' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>ITINERÁŘ</button>
              <button onClick={() => setViewMode('map')} className={`px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${viewMode === 'map' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>MAPA</button>
              <button onClick={() => setViewMode('stats')} className={`px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${viewMode === 'stats' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>ROZPOČET</button>
              <button onClick={() => setViewMode('countries')} className={`px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${viewMode === 'countries' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>ZEMĚ</button>
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & Saved List */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-slate-800/80 p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl space-y-6 backdrop-blur-md">
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-700">
              <button 
                onClick={() => { setTripType('ride'); setDays(1); }}
                className={`flex-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${tripType === 'ride' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                Vyjížďka
              </button>
              <button 
                onClick={() => setTripType('expedition')}
                className={`flex-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${tripType === 'expedition' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                Expedice
              </button>
            </div>

            <h2 className="text-xs font-bold text-orange-500 uppercase tracking-[0.3em] ml-2">
              {tripType === 'ride' ? 'Nová vyjížďka' : 'Nové dobrodružství'}
            </h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-3">Start</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={origin} 
                    onChange={(e) => setOrigin(e.target.value)} 
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3 pl-5 pr-12 text-sm text-white focus:border-orange-500 outline-none transition-all" 
                  />
                  <button 
                    onClick={() => handleVoiceInput('origin')}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${isListening === 'origin' ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-slate-500 hover:text-orange-500 hover:bg-slate-800'}`}
                    title="Zadat hlasem"
                  >
                    <i className="fas fa-microphone"></i>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-3">Průjezdní body (volitelné)</label>
                <div className="space-y-2">
                  {waypoints.map((wp, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-2 pl-4">
                      <i className="fas fa-location-dot text-orange-500 text-xs"></i>
                      <span className="flex-grow text-sm text-slate-300">{wp}</span>
                      <button onClick={() => removeWaypoint(idx)} className="w-8 h-8 text-slate-500 hover:text-red-500 flex items-center justify-center rounded-lg hover:bg-slate-800">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))}
                  <div className="relative flex gap-2">
                    <div className="relative flex-grow">
                      <input 
                        type="text" 
                        value={newWaypoint} 
                        onChange={(e) => setNewWaypoint(e.target.value)} 
                        onKeyPress={(e) => e.key === 'Enter' && addWaypoint()}
                        placeholder="Např. Grossglockner"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-4 pr-10 text-sm text-white focus:border-orange-500 outline-none transition-all" 
                      />
                      <button 
                        onClick={() => handleVoiceInput('waypoint')}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${isListening === 'waypoint' ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-slate-500 hover:text-orange-500 hover:bg-slate-800'}`}
                        title="Zadat hlasem"
                      >
                        <i className="fas fa-microphone text-xs"></i>
                      </button>
                    </div>
                    <button 
                      onClick={addWaypoint}
                      disabled={!newWaypoint.trim()}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-4 rounded-xl font-bold text-xs transition-all border border-slate-700"
                    >
                      PŘIDAT
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-3">{tripType === 'ride' ? 'Délka (h)' : 'Dny'}</label>
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
                {tripType === 'ride' && (
                  <div className="flex items-center justify-between bg-slate-950 border border-slate-700 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isRoundTrip ? 'bg-orange-600/20 text-orange-500' : 'bg-slate-800 text-slate-500'}`}>
                        <i className="fas fa-rotate"></i>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white uppercase tracking-tight">Okruh</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Návrat do místa startu</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsRoundTrip(!isRoundTrip)}
                      className={`w-12 h-6 rounded-full transition-all relative ${isRoundTrip ? 'bg-orange-600' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${isRoundTrip ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                )}

                {tripType !== 'ride' && (
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
                )}

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
                  {loading ? 'Generuji...' : (tripType === 'ride' ? 'PLÁNOVAT VYJÍŽĎKU' : 'PLÁNOVAT EXPEDICI')}
                </button>
              </div>
            </div>
          </div>

          {/* Saved Expeditions List */}
          <div className="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 space-y-6">
             <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] ml-2">Knihovna tras</h2>
             
             {/* Rides Group */}
             <div className="space-y-3">
               <h3 className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-2">Moje Okruhy</h3>
               {savedExpeditions.filter(ex => ex.tripType === 'ride' && !ex.sharedBy).length === 0 ? (
                 <p className="text-[8px] text-slate-700 italic ml-2 uppercase">Žádné vyjížďky</p>
               ) : (
                 savedExpeditions.filter(ex => ex.tripType === 'ride' && !ex.sharedBy).map(ex => (
                   <div 
                    key={ex.id}
                    onClick={() => loadExpedition(ex)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between ${expedition?.id === ex.id ? 'bg-orange-600/10 border-orange-500 shadow-lg' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}`}
                   >
                     <div className="flex items-center gap-4">
                       <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700 group-hover:border-orange-500/50">
                         <i className="fas fa-repeat text-orange-500 text-[10px]"></i>
                       </div>
                       <div>
                         <h4 className="text-[10px] font-bold text-white truncate max-w-[100px] uppercase tracking-tight">{ex.name}</h4>
                         <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">{ex.totalDistance}</p>
                       </div>
                     </div>
                     <button onClick={(e) => deleteExpedition(ex.id, e)} className="text-slate-700 hover:text-red-500 p-2 transition-colors">
                       <i className="fas fa-trash-alt text-[9px]"></i>
                     </button>
                   </div>
                 ))
               )}
             </div>

             {/* Expeditions Group */}
             <div className="space-y-3">
               <h3 className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-2">Velké Výpravy</h3>
               {savedExpeditions.filter(ex => ex.tripType !== 'ride' && !ex.sharedBy).length === 0 ? (
                 <p className="text-[8px] text-slate-700 italic ml-2 uppercase">Žádné expedice</p>
               ) : (
                 savedExpeditions.filter(ex => ex.tripType !== 'ride' && !ex.sharedBy).map(ex => (
                   <div 
                    key={ex.id}
                    onClick={() => loadExpedition(ex)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between ${expedition?.id === ex.id ? 'bg-orange-600/10 border-orange-500 shadow-lg' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}`}
                   >
                     <div className="flex items-center gap-4">
                       <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700 group-hover:border-orange-500/50">
                         <i className="fas fa-mountain-sun text-orange-500 text-[10px]"></i>
                       </div>
                       <div>
                         <h4 className="text-[10px] font-bold text-white truncate max-w-[100px] uppercase tracking-tight">{ex.name}</h4>
                         <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">{ex.days.length} DNÍ</p>
                       </div>
                     </div>
                     <button onClick={(e) => deleteExpedition(ex.id, e)} className="text-slate-700 hover:text-red-500 p-2 transition-colors">
                       <i className="fas fa-trash-alt text-[9px]"></i>
                     </button>
                   </div>
                 ))
               )}
             </div>

             {/* Shared Trips Group */}
             <div className="space-y-3">
               <h3 className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-2">Trasy od kámošů</h3>
               {savedExpeditions.filter(ex => ex.sharedBy).length === 0 ? (
                 <p className="text-[8px] text-slate-700 italic ml-2 uppercase">Zatím ti nikdo nic neposlal</p>
               ) : (
                 savedExpeditions.filter(ex => ex.sharedBy).map(ex => (
                   <div 
                    key={ex.id}
                    onClick={() => loadExpedition(ex)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between ${expedition?.id === ex.id ? 'bg-orange-600/10 border-orange-500 shadow-lg' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}`}
                   >
                     <div className="flex items-center gap-4">
                       <div className="w-8 h-8 rounded-lg bg-orange-600/20 flex items-center justify-center border border-orange-500/30 group-hover:border-orange-500/50">
                         <i className="fas fa-share-nodes text-orange-500 text-[10px]"></i>
                       </div>
                       <div>
                         <h4 className="text-[10px] font-bold text-white truncate max-w-[100px] uppercase tracking-tight">{ex.name}</h4>
                         <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Od: {ex.sharedBy}</p>
                       </div>
                     </div>
                     <button onClick={(e) => deleteExpedition(ex.id, e)} className="text-slate-700 hover:text-red-500 p-2 transition-colors">
                       <i className="fas fa-trash-alt text-[9px]"></i>
                     </button>
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>

        {/* Right Column: Content */}
        <div className="lg:col-span-8 space-y-8">
          {expedition && !loading ? (
            <div className="animate-fadeIn space-y-8">
              {/* Main Info Card & Timeline */}
              <div className={`space-y-8 ${viewMode === 'info' ? 'block' : 'hidden md:block'}`}>
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
                        onClick={() => setShowChallengeAudience(true)}
                        className="bg-slate-900 hover:bg-slate-700 text-orange-500 px-4 py-2 rounded-xl border border-slate-700 text-[9px] font-bold uppercase flex items-center gap-2 transition-all active:scale-95"
                      >
                        <i className="fas fa-bullhorn"></i> VYZVAT K JÍZDĚ
                      </button>
                      <button 
                        onClick={handleShare}
                        disabled={isSharing}
                        className="bg-slate-900 hover:bg-slate-700 text-blue-400 px-4 py-2 rounded-xl border border-slate-700 text-[9px] font-bold uppercase flex items-center gap-2 transition-all active:scale-95"
                      >
                        <i className={`fas ${isSharing ? 'fa-sync-alt animate-spin' : 'fa-share-nodes'}`}></i> SDÍLET
                      </button>
                      <div className="relative">
                        <button 
                          onClick={() => setShowNavMenu(!showNavMenu)}
                          className="bg-slate-900 hover:bg-slate-700 text-emerald-500 px-4 py-2 rounded-xl border border-slate-700 text-[9px] font-bold uppercase flex items-center gap-2 transition-all active:scale-95"
                        >
                          <i className="fas fa-location-arrow"></i> NAVIGOVAT
                        </button>
                        {showNavMenu && (
                          <div className="absolute top-full mt-2 right-0 w-48 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-slideUp">
                            <a 
                              href={getGoogleMapsUrl(expedition.days[activeDayIdx])}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => setShowNavMenu(false)}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-white text-xs font-bold transition-colors border-b border-slate-700/50"
                            >
                              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white"><i className="fab fa-google"></i></div>
                              Google Maps
                            </a>
                            <button 
                              onClick={() => { exportGPX(); setShowNavMenu(false); }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 text-white text-xs font-bold transition-colors text-left"
                            >
                              <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-white"><i className="fas fa-download"></i></div>
                              Stáhnout GPX
                            </button>
                          </div>
                        )}
                      </div>
                      {savedExpeditions.some(ex => ex.id === expedition.id) ? (
                        <div className="flex gap-2">
                          <span className="bg-green-600/10 text-green-500 px-4 py-2 rounded-xl border border-green-500/20 text-[9px] font-bold uppercase flex items-center gap-2">
                             <i className="fas fa-check"></i> ULOŽENO
                          </span>
                          {activeState?.expeditionId !== expedition.id && expedition.status !== 'completed' && (
                            <button 
                              onClick={() => startExpedition(expedition)}
                              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl shadow-lg text-[9px] font-bold uppercase flex items-center gap-2 transition-all active:scale-95"
                            >
                              <i className="fas fa-play"></i> ODSTARTOVAT
                            </button>
                          )}
                        </div>
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
                      <div className="flex gap-3 mb-4">
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
                      <div className="flex flex-wrap gap-2">
                        {quickRefines.map((qr, idx) => (
                          <button
                            key={idx}
                            onClick={() => setRefinePrompt(qr)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-slate-700 transition-all"
                          >
                            {qr}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-700/50">
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 text-center">
                      <p className="text-[8px] text-slate-600 font-bold uppercase mb-1 tracking-widest">Cestující</p>
                      <p className="text-xl font-brand font-bold text-white">{expedition.travelersCount}</p>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 text-center">
                      <p className="text-[8px] text-slate-600 font-bold uppercase mb-1 tracking-widest">Doprava</p>
                      <div className="h-7 flex items-center justify-center">
                        <i className={`fas ${modes.find(m => m.val === expedition.transportMode)?.icon} text-orange-500`}></i>
                      </div>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 text-center">
                      <p className="text-[8px] text-slate-600 font-bold uppercase mb-1 tracking-widest">Délka</p>
                      <p className="text-xl font-brand font-bold text-white">{expedition.days.length} dní</p>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 text-center">
                      <p className="text-[8px] text-slate-600 font-bold uppercase mb-1 tracking-widest">Vzdálenost</p>
                      <p className="text-xl font-brand font-bold text-white">{expedition.totalDistanceKm || expedition.totalDistance}</p>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="relative border-l-2 border-slate-700 ml-4 md:ml-8 space-y-8 py-4">
                  {expedition.days.map((day, idx) => (
                    <div key={idx} className="relative pl-8 md:pl-12">
                      {/* Timeline Dot */}
                      <div className={`absolute -left-[11px] top-6 w-5 h-5 rounded-full border-4 transition-all ${activeDayIdx === idx ? 'bg-orange-500 border-slate-900 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'bg-slate-700 border-slate-900'}`}></div>
                      
                      {/* Day Header (Clickable) */}
                      <button 
                        onClick={() => setActiveDayIdx(idx)}
                        className={`w-full text-left p-6 rounded-[2rem] border transition-all ${activeDayIdx === idx ? 'bg-slate-800 border-orange-500/50 shadow-xl' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.3em] mb-1">Den {day.dayNumber}</p>
                            <h4 className="text-xl font-brand font-bold text-white uppercase tracking-tight">{day.startLocation} <i className="fas fa-arrow-right text-slate-600 text-sm mx-2"></i> {day.endLocation}</h4>
                          </div>
                          <div className="flex gap-6">
                            <div className="text-left md:text-right">
                              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Vzdálenost</p>
                              <p className="text-sm font-bold text-white">{day.distanceKm || day.distance} {day.distanceKm ? 'km' : ''}</p>
                            </div>
                            <div className="text-left md:text-right">
                              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Čas</p>
                              <p className="text-sm font-bold text-white">{day.estimatedTimeMins ? `${Math.floor(day.estimatedTimeMins / 60)}h ${day.estimatedTimeMins % 60}m` : '-'}</p>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {activeDayIdx === idx && (
                        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slideDown">
                          <div className="lg:col-span-2 bg-slate-950/50 p-6 rounded-[2rem] border border-slate-700/50">
                            <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-slate-700/50">
                              <div>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Palivo</p>
                                <p className="text-lg font-brand font-bold text-white">{day.fuelLiters ? `${day.fuelLiters} l` : '-'}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Cena paliva</p>
                                <p className="text-lg font-brand font-bold text-white">{day.fuelCost ? `${day.fuelCost} Kč` : '-'}</p>
                              </div>
                            </div>
                            <div className="markdown-body prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed">
                              <Markdown>{day.description}</Markdown>
                            </div>
                          </div>
                          
                          <div className="space-y-6">
                            {/* Accommodation Card */}
                            <div className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 shadow-xl relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-4 opacity-10">
                                <i className={`fas ${expedition.tripType === 'ride' ? 'fa-coffee' : 'fa-hotel'} text-6xl`}></i>
                              </div>
                              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-orange-600/20 flex items-center justify-center">
                                  <i className={`fas ${expedition.tripType === 'ride' ? 'fa-mug-hot' : 'fa-bed'} text-orange-500 text-[10px]`}></i>
                                </span>
                                {expedition.tripType === 'ride' ? 'Tip na zastávku' : 'Ubytování na noc'}
                              </h3>
                              
                              {day.accommodation ? (
                                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-700 border-l-4 border-l-orange-500">
                                  <p className="text-sm font-bold text-white mb-1 leading-tight">{day.accommodation?.name}</p>
                                  <p className="text-[9px] text-slate-600 uppercase font-bold tracking-widest mb-4">{day.accommodation?.type}</p>
                                  <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.accommodation?.name || '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl border border-slate-700 flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-all"
                                  >
                                    MAPA <i className="fas fa-external-link-alt text-[8px] opacity-50"></i>
                                  </a>
                                </div>
                              ) : (
                                <div className="py-8 text-center bg-slate-900 rounded-2xl border border-slate-700 border-dashed">
                                  <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                                    {expedition.tripType === 'ride' ? 'Hledám ideální pauzu...' : 'Hledám základnu...'}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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

              {/* Stats Section */}
              {viewMode === 'stats' && expedition.budget && (
                <div className="bg-slate-800 p-8 rounded-[3rem] border border-slate-700 shadow-2xl animate-fadeIn">
                  <h3 className="text-2xl font-brand font-bold text-white uppercase tracking-tighter italic mb-8">Rozpočet a statistiky</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Budget Section */}
                    <div className="space-y-6">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <i className="fas fa-wallet text-orange-500"></i> Plánované náklady
                      </h4>
                      
                      <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-700 flex flex-col md:flex-row items-center gap-6">
                        <div className="w-48 h-48 shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: 'Palivo', value: expedition.budget.plannedFuel, color: '#f97316' },
                                  { name: 'Ubytování', value: expedition.budget.plannedAccommodation, color: '#3b82f6' },
                                  { name: 'Jídlo', value: expedition.budget.plannedFood, color: '#22c55e' },
                                  { name: 'Mýtné', value: expedition.budget.plannedTolls, color: '#a855f7' }
                                ]}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                              >
                                {[
                                  { color: '#f97316' },
                                  { color: '#3b82f6' },
                                  { color: '#22c55e' },
                                  { color: '#a855f7' }
                                ].map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value: number) => [`${value.toLocaleString()} Kč`, '']}
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '1rem', color: '#fff' }}
                                itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        
                        <div className="flex-grow space-y-3 w-full">
                          {[
                            { label: 'Palivo', value: expedition.budget.plannedFuel, color: 'text-orange-500', bg: 'bg-orange-500/20' },
                            { label: 'Ubytování', value: expedition.budget.plannedAccommodation, color: 'text-blue-500', bg: 'bg-blue-500/20' },
                            { label: 'Jídlo', value: expedition.budget.plannedFood, color: 'text-green-500', bg: 'bg-green-500/20' },
                            { label: 'Mýtné', value: expedition.budget.plannedTolls, color: 'text-purple-500', bg: 'bg-purple-500/20' }
                          ].map((item, i) => (
                            <div key={i} className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${item.bg} flex items-center justify-center`}>
                                  <div className={`w-1.5 h-1.5 rounded-full ${item.color.replace('text-', 'bg-')}`}></div>
                                </div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{item.label}</span>
                              </div>
                              <span className="font-brand font-bold text-sm text-white">{item.value.toLocaleString()} Kč</span>
                            </div>
                          ))}
                          <div className="pt-3 mt-3 border-t border-slate-700 flex justify-between items-center">
                            <span className="text-xs font-bold text-white uppercase tracking-widest">Celkem</span>
                            <span className="font-brand font-bold text-xl text-orange-500">
                              {(expedition.budget.plannedFuel + expedition.budget.plannedAccommodation + expedition.budget.plannedFood + expedition.budget.plannedTolls).toLocaleString()} Kč
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Distance Stats Section */}
                    <div className="space-y-6">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <i className="fas fa-route text-orange-500"></i> Denní nájezd (km)
                      </h4>
                      
                      <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-700 h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={expedition.days.map(d => ({
                            name: `D${d.dayNumber}`,
                            km: d.distanceKm || parseInt(d.distance.replace(/\D/g, '')) || 0
                          }))}>
                            <XAxis 
                              dataKey="name" 
                              stroke="#64748b" 
                              fontSize={10} 
                              tickLine={false} 
                              axisLine={false} 
                            />
                            <Tooltip 
                              cursor={{ fill: '#1e293b' }}
                              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '1rem', color: '#fff' }}
                              formatter={(value: number) => [`${value} km`, 'Vzdálenost']}
                              labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}
                            />
                            <Bar 
                              dataKey="km" 
                              fill="#f97316" 
                              radius={[4, 4, 0, 0]} 
                              maxBarSize={40}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 text-center">
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Celkem km</p>
                          <p className="text-xl font-brand font-bold text-white">{expedition.totalDistanceKm || expedition.totalDistance}</p>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 text-center">
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Průměrně denně</p>
                          <p className="text-xl font-brand font-bold text-white">
                            {Math.round((expedition.totalDistanceKm || parseInt(expedition.totalDistance.replace(/\D/g, '')) || 0) / expedition.days.length)} km
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Countries Section */}
              {viewMode === 'countries' && expedition.countriesInfo && (
                <div className="space-y-6 animate-fadeIn">
                  <h3 className="text-2xl font-brand font-bold text-white uppercase tracking-tighter italic mb-8">Průvodce zeměmi</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {expedition.countriesInfo.map((country, idx) => (
                      <div key={idx} className="bg-slate-800 p-6 rounded-[2.5rem] border border-slate-700 shadow-xl">
                        <h4 className="text-xl font-brand font-bold text-white uppercase tracking-tight mb-6 flex items-center gap-3">
                          <i className="fas fa-flag text-orange-500"></i>
                          {country.name}
                        </h4>
                        
                        <div className="space-y-4">
                          <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 border border-slate-700">
                              <i className="fas fa-gauge-high text-slate-400 text-xs"></i>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rychlostní limity</p>
                              <p className="text-sm text-white font-medium">{country.speedLimits}</p>
                            </div>
                          </div>
                          
                          <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 border border-slate-700">
                              <i className="fas fa-wine-glass text-slate-400 text-xs"></i>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tolerance alkoholu</p>
                              <p className="text-sm text-white font-medium">{country.alcoholLimit}</p>
                            </div>
                          </div>

                          <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 border border-slate-700">
                              <i className="fas fa-ticket text-slate-400 text-xs"></i>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mýtné a známky</p>
                              <p className="text-sm text-white font-medium">{country.tolls}</p>
                            </div>
                          </div>

                          <div className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 border border-slate-700">
                              <i className="fas fa-triangle-exclamation text-slate-400 text-xs"></i>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Povinná výbava</p>
                              <ul className="list-disc list-inside text-sm text-white font-medium">
                                {country.mandatoryEquipment.map((eq, i) => <li key={i}>{eq}</li>)}
                              </ul>
                            </div>
                          </div>

                          {country.customRules && country.customRules.length > 0 && (
                            <div className="flex gap-4 items-start">
                              <div className="w-8 h-8 rounded-xl bg-orange-600/20 flex items-center justify-center shrink-0 border border-orange-500/30">
                                <i className="fas fa-motorcycle text-orange-500 text-xs"></i>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Motorkářská specifika</p>
                                <ul className="list-disc list-inside text-sm text-white font-medium">
                                  {country.customRules.map((rule, i) => <li key={i}>{rule}</li>)}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[500px] bg-slate-800/30 border-2 border-dashed border-slate-700 rounded-[3rem] flex flex-col items-center justify-center p-12 text-center space-y-6">
              {loading ? (
                <div className="space-y-8 animate-pulse flex flex-col items-center">
                  <div className="relative mx-auto">
                    <div className="w-32 h-32 border-4 border-slate-700 border-t-orange-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <i className="fas fa-motorcycle text-orange-500 text-4xl animate-bounce"></i>
                    </div>
                  </div>
                  <div className="space-y-3 text-center">
                    <h3 className="text-2xl font-brand font-bold text-white uppercase tracking-tight">AI Spirit pracuje</h3>
                    <div className="h-6 overflow-hidden relative w-64 mx-auto">
                      <p 
                        key={loadingStep}
                        className="text-xs text-orange-400 font-bold uppercase tracking-widest absolute inset-0 animate-slideUp"
                      >
                        {loadingSteps[loadingStep]}
                      </p>
                    </div>
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
      
      {/* Challenge Audience Modal */}
      {showChallengeAudience && expedition && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-fadeIn">
          <div className="bg-slate-800 w-full max-w-md rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-8 border-b border-slate-700 flex justify-between items-center">
               <h2 className="text-xl font-brand font-bold uppercase tracking-tight text-white">VYHLÁSIT <span className="text-orange-500">VÝZVU</span></h2>
               <button onClick={() => setShowChallengeAudience(false)} className="text-slate-500 hover:text-white p-2">
                 <i className="fas fa-times text-xl"></i>
               </button>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-xs text-slate-400 leading-relaxed text-center">Komu chceš nabídnout tuhle trasu?</p>
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => { handleCreateChallengeWithExp(expedition, 'all'); setShowChallengeAudience(false); }}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-700 hover:border-orange-500 flex items-center gap-4 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-orange-600/10 flex items-center justify-center text-orange-500 group-hover:bg-orange-600 group-hover:text-white transition-all">
                    <i className="fas fa-globe"></i>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white uppercase tracking-tight">VEŘEJNÁ VÝZVA</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Uvidí ji úplně každý na Radaru</p>
                  </div>
                </button>

                <button 
                  onClick={() => { handleCreateChallengeWithExp(expedition, 'party'); setShowChallengeAudience(false); }}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-700 hover:border-orange-500 flex items-center gap-4 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <i className="fas fa-users"></i>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white uppercase tracking-tight">PRO MOJI PARTU</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Uvidí ji jen tvoji sledovaní jezdci</p>
                  </div>
                </button>

                <button 
                  onClick={() => { handleShare(); setShowChallengeAudience(false); }}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-700 hover:border-orange-500 flex items-center gap-4 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-600/10 flex items-center justify-center text-purple-500 group-hover:bg-purple-600 group-hover:text-white transition-all">
                    <i className="fas fa-share-nodes"></i>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white uppercase tracking-tight">SDÍLET ODKAZ</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Pošli odkaz přes WhatsApp, Messenger atd.</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
