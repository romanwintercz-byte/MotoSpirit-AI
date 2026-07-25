
import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import { useNavigate, useLocation } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { planExpedition, refineExpedition } from '../services/geminiService';
import { shareExpeditionPublicly, syncDataToCloud, getAllPublicProfiles, fetchRideChallenges, updateRideChallenge } from '../services/syncService';
import { getGoogleMapsUrl } from '../utils/navigation';
import { Expedition, TransportMode, TripDay, ExpeditionPreferences, UserProfile } from '../types';
import { useActiveExpedition } from '../hooks/useActiveExpedition';

const DayMap: React.FC<{ day: TripDay, color: string, onUploadGpx: (e: React.ChangeEvent<HTMLInputElement>) => void, onDeleteGpx: () => void }> = ({ day, color, onUploadGpx, onDeleteGpx }) => {
  const mapRef = useRef<any | null>(null);
  const polylineRef = useRef<any | null>(null);
  const gpxPolylineRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);
  const containerId = `day-map-${day.dayNumber}`;

  useEffect(() => {
    const L = (window as any).L;
    if (!L) return;

    let timeoutId: any;

    const init = () => {
      if (!document.getElementById(containerId)) return;
      if (!mapRef.current) {
        mapRef.current = L.map(containerId, { zoomControl: false, attributionControl: false }).setView([50, 15], 6);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
      }

      if (polylineRef.current) mapRef.current.removeLayer(polylineRef.current);
      if (gpxPolylineRef.current) mapRef.current.removeLayer(gpxPolylineRef.current);
      markersRef.current.forEach(m => mapRef.current.removeLayer(m));
      markersRef.current = [];

      if (day.gpxRoute && day.gpxRoute.length > 0) {
        gpxPolylineRef.current = L.polyline(day.gpxRoute, { color: '#0ea5e9', weight: 4, opacity: 0.8, lineCap: 'round' }).addTo(mapRef.current);
        mapRef.current.fitBounds(gpxPolylineRef.current.getBounds(), { padding: [30, 30] });
      } else if (day.waypoints && day.waypoints.length > 0) {
        polylineRef.current = L.polyline(day.waypoints, { color, weight: 4, opacity: 0.8, lineCap: 'round' }).addTo(mapRef.current);
        const start = day.waypoints[0];
        const end = day.waypoints[day.waypoints.length - 1];
        markersRef.current.push(L.circleMarker(start, { radius: 6, color: '#fff', weight: 2, fillColor: '#22c55e', fillOpacity: 1 }).addTo(mapRef.current));
        markersRef.current.push(L.circleMarker(end, { radius: 6, color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1 }).addTo(mapRef.current));
        mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [30, 30] });
      }
    };

    timeoutId = setTimeout(init, 150);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [day, color, containerId]);

  return (
    <div className="h-64 w-full bg-slate-900 rounded-2xl border border-slate-700/50 mt-6 overflow-hidden relative shadow-lg group">
      <div id={containerId} className="w-full h-full z-0"></div>
      <div className="absolute top-4 right-4 z-10 flex gap-2">
         {day.gpxRoute && day.gpxRoute.length > 0 && (
           <button onClick={onDeleteGpx} className="w-8 h-8 bg-red-500/90 hover:bg-red-600 text-white rounded-lg border border-red-700 flex items-center justify-center shadow-xl transition-all" title="Smazat GPX trasu">
             <i className="fas fa-trash text-xs"></i>
           </button>
         )}
         <label className="w-8 h-8 bg-slate-800/90 hover:bg-orange-600 cursor-pointer text-white rounded-lg border border-slate-600 flex items-center justify-center shadow-xl transition-all" title="Nahrát reálnou trasu v GPX pro tento den">
           <i className="fas fa-file-upload text-xs"></i>
           <input type="file" accept=".gpx" className="hidden" onChange={onUploadGpx} />
         </label>
      </div>
      {(day.gpxRoute && day.gpxRoute.length > 0) && (
        <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-teal-500/50 flex items-center gap-2 shadow-xl">
            <i className="fas fa-route text-teal-400 text-xs"></i>
            <span className="text-[9px] font-bold text-teal-400 uppercase tracking-widest">GPX Záznam</span>
        </div>
      )}
    </div>
  );
};

const TripPlanner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeState, startExpedition } = useActiveExpedition();
  
  // --- FORM STATE ---
  const [origin, setOrigin] = useState('Praha');
  const [days, setDays] = useState(3);
  const [travelers, setTravelers] = useState(2);
  const [mode, setMode] = useState<TransportMode>('moto');
  const [tripType, setTripType] = useState<'ride' | 'expedition'>('expedition');
  const [startDate, setStartDate] = useState('');
  const [leftTab, setLeftTab] = useState<'new'|'saved'>('new');

  
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
  const [expandedDayIdx, setExpandedDayIdx] = useState(0);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [showRefine, setShowRefine] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [followedRiders, setFollowedRiders] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showChallengeAudience, setShowChallengeAudience] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [editingCustomAcc, setEditingCustomAcc] = useState<{dayIndex: number | null, name: string, url: string}>({ dayIndex: null, name: '', url: '' });

  const currentUserSyncCode = localStorage.getItem('motospirit_sync_code');

  const sharedTripsFilter = (ex: any) => {
    if (ex.sharedBy) return true;
    if (ex.id?.startsWith('challenge-')) {
      if (ex.challengeCreatorSyncCode && ex.challengeCreatorSyncCode === currentUserSyncCode) return false;
      return true;
    }
    return false;
  };

  // --- REFS ---
  const mapRef = useRef<any | null>(null);
  const polylinesRef = useRef<any[]>([]);
  const gpxPolylineRef = useRef<any | null>(null);
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
      const savedStr = localStorage.getItem('spirit_wanderer_trips');
      if (savedStr) {
        const parsed = JSON.parse(savedStr);
        setSavedExpeditions(parsed);
        setExpedition(currentExp => {
          if (currentExp && currentExp.id) {
            const updatedExp = parsed.find((e: any) => e.id === currentExp.id);
            if (updatedExp && JSON.stringify(currentExp) !== JSON.stringify(updatedExp)) {
               return updatedExp;
            }
          }
          return currentExp;
        });
      }
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
      
      // Auto-update linked challenge routes
      try {
        const challenges = await fetchRideChallenges();
        if (challenges && challenges.length > 0) {
          const existingTripsStr = localStorage.getItem('spirit_wanderer_trips');
          const existingTrips = existingTripsStr ? JSON.parse(existingTripsStr) : [];
          let tripsUpdated = false;
          let newTrips = [...existingTrips];
          
          challenges.forEach(c => {
             if (c.route && c.participants.includes(syncCode)) {
                const tripIndex = newTrips.findIndex((e: any) => e.linkedChallengeId === c.id);
                if (tripIndex >= 0) {
                  const expeditionToSave = { ...c.route, id: newTrips[tripIndex].id, linkedChallengeId: c.id, challengeCreatorSyncCode: c.creatorSyncCode };
                  if (JSON.stringify(newTrips[tripIndex]) !== JSON.stringify(expeditionToSave)) {
                    newTrips[tripIndex] = expeditionToSave;
                    tripsUpdated = true;
                  }
                } else {
                  const expeditionToSave = { ...c.route, id: `challenge-${c.id}-route`, linkedChallengeId: c.id, challengeCreatorSyncCode: c.creatorSyncCode };
                  newTrips = [expeditionToSave, ...newTrips];
                  tripsUpdated = true;
                }
             }
          });
          
          if (tripsUpdated) {
            localStorage.setItem('spirit_wanderer_trips', JSON.stringify(newTrips));
              setSavedExpeditions(newTrips);
              
              setExpedition(currentExp => {
                if (currentExp && currentExp.linkedChallengeId) {
                  const updatedExp = newTrips.find((e: any) => e.linkedChallengeId === currentExp.linkedChallengeId);
                  if (updatedExp && JSON.stringify(currentExp) !== JSON.stringify(updatedExp)) {
                     return updatedExp;
                  }
                }
                return currentExp;
              });
            }
        }
      } catch (err) {
        console.error("Failed to sync challenges in Planner", err);
      }
    };
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // --- HANDLERS ---
  const handlePlan = async () => {
    setLoading(true);
    setShowRefine(false);
    const prefs: ExpeditionPreferences = {
      accommodation: prefAcc,
      experiences: prefExp,
      pace: prefPace,
      budget: prefBudget,
      customNote: waypoints.length > 0 ? `Průjezdní body: ${waypoints.join(', ')}. ${customNote}` : customNote
    };
    try {
      const result = await planExpedition(origin, days, mode, prefs, travelers, tripType, startDate);
      setExpedition(result);
      setActiveDayIdx(0);
      setExpandedDayIdx(0);
      if (window.innerWidth < 1024) {
        setTimeout(() => document.getElementById('expedition-details')?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
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
      setExpandedDayIdx(0);
      if (window.innerWidth < 1024) {
        setTimeout(() => document.getElementById('expedition-details')?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
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

  const handleManualSyncFromCloud = async () => {
    if (!expedition || !expedition.linkedChallengeId) return;
    setIsSyncing(true);
    try {
      const challenges = await fetchRideChallenges();
      const updatedChallenge = challenges.find((c: any) => c.id === expedition.linkedChallengeId);
      
      if (updatedChallenge && updatedChallenge.route) {
        const existingTrips = [...savedExpeditions];
        const tripIndex = existingTrips.findIndex(t => t.id === expedition.id);
        
        let newExpToSave = { 
          ...updatedChallenge.route, 
          id: expedition.id, 
          linkedChallengeId: expedition.linkedChallengeId, 
          challengeCreatorSyncCode: updatedChallenge.creatorSyncCode 
        };
        
        if (tripIndex >= 0) {
          existingTrips[tripIndex] = newExpToSave;
        } else {
          existingTrips.unshift(newExpToSave);
        }
        
        setSavedExpeditions(existingTrips);
        localStorage.setItem('spirit_wanderer_trips', JSON.stringify(existingTrips));
        setExpedition(newExpToSave);
        alert("Trasa byla úspěšně aktualizována z cloudu!");
      } else {
        alert("Na serveru nebyla nalezena žádná novější verze.");
      }
    } catch (e) {
      console.error(e);
      alert("Chyba při stahování změn.");
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleExperience = (id: string) => {
    setPrefExp(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const existingExpedition = expedition ? savedExpeditions.find(ex => ex.id === expedition.id) : null;
  const isModified = existingExpedition ? JSON.stringify(existingExpedition) !== JSON.stringify(expedition) : false;

  const handleSaveClick = () => {
    if (!expedition) return;
    const existing = savedExpeditions.find(ex => ex.id === expedition.id);
    if (existing) {
      setShowSaveModal(true);
    } else {
      saveAsNew();
    }
  };

  const saveAsNew = () => {
    if (!expedition) return;
    const name = window.prompt("Pojmenuj svou expedici:", expedition.name);
    if (name) {
      const newExp = { ...expedition, name, id: Date.now().toString() };
      setSavedExpeditions(prev => [newExp, ...prev]);
      setExpedition(newExp);
      alert("Expedice byla uložena do tvého profilu.");
      setShowSaveModal(false);
    }
  };

  const handleAutoChallengeSync = async (expToSync: Expedition) => {
    if (expToSync.linkedChallengeId) {
      try {
        const challenges = await fetchRideChallenges();
        const challengeToUpdate = challenges.find((c: any) => c.id === expToSync.linkedChallengeId);
        if (challengeToUpdate) {
          const updatedChallenge = { ...challengeToUpdate, route: expToSync };
          await updateRideChallenge(challengeToUpdate.id, updatedChallenge);
        }
      } catch (err) {
        console.error("Failed to auto-sync challenge:", err);
      }
    }
  };

  const overwriteExisting = async () => {
    if (!expedition) return;
    setSavedExpeditions(prev => prev.map(ex => ex.id === expedition.id ? expedition : ex));
    
    // Auto-update linked challenge if present
    await handleAutoChallengeSync(expedition);
    
    alert("Změny byly uloženy.");
    setShowSaveModal(false);
  };

  const handleGpxUpload = (e: React.ChangeEvent<HTMLInputElement>, dayIdx: number) => {
    const file = e.target.files?.[0];
    if (!file || !expedition) return;
    
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const reader = new FileReader();
    reader.onload = (event) => {
      const gpxText = event.target?.result as string;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(gpxText, "text/xml");
      
      let points = Array.from(xmlDoc.getElementsByTagName("trkpt"));
      if (points.length === 0) {
        points = Array.from(xmlDoc.getElementsByTagName("rtept"));
      }
      
      if (points.length > 0) {
        let totalDistance = 0;
        const gpxRoute: [number, number][] = [];
        
        for (let i = 0; i < points.length; i++) {
          const pt = points[i];
          const lat = parseFloat(pt.getAttribute("lat") || "0");
          const lon = parseFloat(pt.getAttribute("lon") || "0");
          gpxRoute.push([lat, lon]);
          
          if (i > 0) {
            const prevPt = gpxRoute[i - 1];
            totalDistance += calculateDistance(prevPt[0], prevPt[1], lat, lon);
          }
        }
        
        const distKm = Math.round(totalDistance);
        
        let durationMins = 0;
        const startTimeStr = points[0].getElementsByTagName("time")?.[0]?.textContent;
        const endTimeStr = points[points.length - 1].getElementsByTagName("time")?.[0]?.textContent;
        if (startTimeStr && endTimeStr) {
           const start = new Date(startTimeStr).getTime();
           const end = new Date(endTimeStr).getTime();
           if (!isNaN(start) && !isNaN(end) && end > start) {
              durationMins = Math.round((end - start) / 60000);
           }
        }
        if (durationMins === 0) {
           durationMins = Math.round(distKm / 60 * 60); // estimate 60km/h average speed
        }
        
        const fuelLiters = parseFloat((distKm * 0.055).toFixed(1)); // estimate 5.5l/100km
        
        const updatedDays = [...expedition.days];
        updatedDays[dayIdx] = { 
          ...updatedDays[dayIdx], 
          gpxRoute,
          distanceKm: distKm,
          distance: `${distKm} km`,
          estimatedTimeMins: durationMins,
          fuelLiters
        };
        
        const newTotalKm = updatedDays.reduce((acc, day) => acc + (day.distanceKm || parseInt(day.distance.replace(/\D/g, '')) || 0), 0);
        
        const updatedExpedition = { 
          ...expedition, 
          days: updatedDays,
          totalDistanceKm: newTotalKm,
          totalDistance: `${newTotalKm} km`
        };
        setExpedition(updatedExpedition);
        
        const existingTrips = [...savedExpeditions];
        const tripIndex = existingTrips.findIndex(t => t.id === updatedExpedition.id);
        if (tripIndex >= 0) {
          existingTrips[tripIndex] = updatedExpedition;
          setSavedExpeditions(existingTrips);
          localStorage.setItem('spirit_wanderer_trips', JSON.stringify(existingTrips));
          window.dispatchEvent(new Event('storage'));
          handleAutoChallengeSync(updatedExpedition);
        }
      } else {
        alert("V GPX souboru nebyly nalezeny žádné body trasy.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset input
  };

  const handleDeleteGpxRoute = (dayIdx: number) => {
    if (!expedition) return;
    const updatedDays = [...expedition.days];
    updatedDays[dayIdx] = { ...updatedDays[dayIdx], gpxRoute: undefined };
    const updatedExpedition = { ...expedition, days: updatedDays };
    setExpedition(updatedExpedition);
    
    const existingTrips = [...savedExpeditions];
    const tripIndex = existingTrips.findIndex(t => t.id === updatedExpedition.id);
    if (tripIndex >= 0) {
      existingTrips[tripIndex] = updatedExpedition;
      setSavedExpeditions(existingTrips);
      localStorage.setItem('spirit_wanderer_trips', JSON.stringify(existingTrips));
      window.dispatchEvent(new Event('storage'));
      handleAutoChallengeSync(updatedExpedition);
    }
  };

  const deleteExpedition = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const exToDelete = savedExpeditions.find(ex => ex.id === id);
    if (exToDelete?.linkedChallengeId) {
       if (!window.confirm("Tato trasa je součástí Výzvy. Smazáním se z výzvy neodhlásíš (to musíš v Radaru). Chceš přesto trasu lokálně smazat? (Při další synchronizaci Radaru se dost možná znovu stáhne).")) return;
    } else {
       if (!window.confirm("Opravdu smazat tuto expedici?")) return;
    }
    
    setSavedExpeditions(prev => prev.filter(ex => ex.id !== id));
    if (expedition?.id === id) setExpedition(null);
  };

  const loadExpedition = (ex: Expedition) => {
    setExpedition(ex);
    setActiveDayIdx(0);
    setExpandedDayIdx(0);
    if (ex.startDate) setStartDate(ex.startDate);
    if (ex.days.length) setDays(ex.days.length);
    if (ex.days[0] && ex.days[0].startLocation) setOrigin(ex.days[0].startLocation);
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        document.getElementById('expedition-details')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (location.state?.editExpeditionId && savedExpeditions.length > 0) {
      const exToLoad = savedExpeditions.find(ex => ex.id === location.state.editExpeditionId);
      if (exToLoad && (!expedition || expedition.id !== exToLoad.id)) {
        loadExpedition(exToLoad);
      }
    }
  }, [location.state?.editExpeditionId, savedExpeditions]);

  const handleCreateChallengeWithExp = (ex: Expedition, audience: 'all' | 'party' | 'selected') => {
    navigate('/radar', { state: { createChallenge: true, expedition: ex, audience } });
  };

  const exportGPX = () => {
    if (!expedition) return;

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SpiritWanderer" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${expedition.name}</name></metadata>`;

    expedition.days.forEach(day => {
      const activePoints = (day.gpxRoute && day.gpxRoute.length > 0) ? day.gpxRoute : day.waypoints;
      if (activePoints && activePoints.length > 0) {
        gpx += `\n  <trk><name>Den ${day.dayNumber}: ${day.startLocation} - ${day.endLocation}</name><trkseg>`;
        activePoints.forEach(([lat, lon]) => {
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

  const handleSaveCustomAcc = () => {
    if (editingCustomAcc.dayIndex === null || !expedition) return;
    const newExpedition = { ...expedition };
    
    // Create Accommodation object if name is provided, else undefined
    const acc = editingCustomAcc.name.trim() ? {
      name: editingCustomAcc.name,
      url: editingCustomAcc.url,
      type: 'vlastní ubytování',
      rating: ''
    } : undefined;
    
    newExpedition.days[editingCustomAcc.dayIndex].customAccommodation = acc;
    setExpedition(newExpedition);
    setEditingCustomAcc({ dayIndex: null, name: '', url: '' });
    
    // Auto-save logic
    const existingTrips = [...savedExpeditions];
    const tripIndex = existingTrips.findIndex(t => t.id === newExpedition.id);
    if (tripIndex >= 0) {
      existingTrips[tripIndex] = newExpedition;
      setSavedExpeditions(existingTrips);
      localStorage.setItem('spirit_wanderer_trips', JSON.stringify(existingTrips));
      window.dispatchEvent(new Event('storage'));
      
      // Auto-update linked challenge if present
      handleAutoChallengeSync(newExpedition);
    }
  };

  const getDayColor = (dayNum: number) => {
    const colors = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ec4899'];
    return colors[(dayNum - 1) % colors.length];
  };

  const getDayDateText = (startDate: string | undefined, dayIndex: number) => {
    if (!startDate) return '';
    const parts = startDate.split('-');
    if (parts.length === 3) {
      const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      dateObj.setDate(dateObj.getDate() + dayIndex);
      return dateObj.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
    }
    return '';
  };

  // --- MAP LOGIC ---
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !expedition) return;
    const initMap = () => {
      const mapEl = document.getElementById('exp-map');
      if (!mapEl || mapRef.current) return;
      mapRef.current = L.map('exp-map', { zoomControl: false, attributionControl: false }).setView([50, 15], 6);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
    };
    setTimeout(initMap, 100);
  }, [expedition]);

  useEffect(() => {
    const L = (window as any).L;
    if (!mapRef.current || !L || !expedition) return;
    polylinesRef.current.forEach(p => mapRef.current.removeLayer(p));
    polylinesRef.current = [];
    markersRef.current.forEach(m => mapRef.current.removeLayer(m));
    markersRef.current = [];

    let allPoints: any[] = [];
    expedition.days.forEach((day, idx) => {
      const activePoints = (day.gpxRoute && day.gpxRoute.length > 0) ? day.gpxRoute : day.waypoints;
      if (activePoints && activePoints.length > 0) {
        const color = getDayColor(day.dayNumber);
        const isActive = idx === activeDayIdx;
        const opacity = isActive ? 1 : 0.6;
        const weight = isActive ? 5 : 3;
        
        const poly = L.polyline(activePoints, { 
          color, 
          weight, 
          opacity, 
          dashArray: (isActive || (day.gpxRoute && day.gpxRoute.length > 0)) ? '' : '10, 15', 
          lineCap: 'round' 
        }).addTo(mapRef.current);
        
        polylinesRef.current.push(poly);
        const start = activePoints[0];
        const end = activePoints[activePoints.length - 1];
        markersRef.current.push(L.circleMarker(start, { radius: isActive ? 6 : 4, color: '#fff', weight: isActive ? 2 : 1, fillColor: '#22c55e', fillOpacity: 1 }).addTo(mapRef.current));
        markersRef.current.push(L.circleMarker(end, { radius: isActive ? 6 : 4, color: '#fff', weight: isActive ? 2 : 1, fillColor: '#ef4444', fillOpacity: 1 }).addTo(mapRef.current));
        allPoints.push(...activePoints);
      }
    });

    if (allPoints.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [50, 50] });
    }
  }, [activeDayIdx, expedition]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 px-4">
      <header className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold font-brand uppercase text-white tracking-tighter">SPIRIT <span className="text-orange-500 italic">WANDERER</span></h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mt-1 opacity-70">AI Roadtrip Engine v2.5</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & Saved List */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700/50">
            <button 
              onClick={() => setLeftTab('new')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${leftTab === 'new' ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20' : 'text-slate-500 hover:text-white'}`}
            >
              <i className="fas fa-plus mr-2"></i> Nová trasa
            </button>
            <button 
              onClick={() => setLeftTab('saved')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${leftTab === 'saved' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
            >
              <i className="fas fa-bookmark mr-2"></i> Moje trasy {savedExpeditions.length > 0 && `(${savedExpeditions.length})`}
            </button>
          </div>

          {leftTab === 'new' && (
            <div className="bg-slate-800/80 p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl backdrop-blur-md">
              <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-700 mb-8">
              <button 
                onClick={() => { setTripType('ride'); setDays(1); }}
                className={`flex-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${tripType === 'ride' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                Vyjížďka
              </button>
              <button 
                onClick={() => setTripType('expedition')}
                className={`flex-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${tripType === 'expedition' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                Expedice
              </button>
            </div>

            <div className="space-y-8">
              {/* Sekce 1: Základní parametry */}
              <div className="space-y-5 relative">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-orange-500">1</div>
                  <h2 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Základní parametry</h2>
                </div>
                
                <div className="pl-3 ml-3 border-l border-slate-700/50 space-y-5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Odkud vyrážíš?</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={origin} 
                        onChange={(e) => setOrigin(e.target.value)} 
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-3 pl-5 pr-12 text-sm text-white focus:border-orange-500 outline-none transition-all focus:bg-slate-900" 
                      />
                      <button 
                        onClick={() => handleVoiceInput('origin')}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isListening === 'origin' ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-slate-500 hover:text-orange-500 hover:bg-slate-800'}`}
                        title="Zadat hlasem"
                      >
                        <i className="fas fa-microphone text-xs"></i>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Kdy vyrážíš? (volitelné)</label>
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setStartDate(newDate);
                        if (expedition) {
                          setExpedition({ ...expedition, startDate: newDate });
                        }
                      }} 
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-3 px-5 text-sm text-white focus:border-orange-500 outline-none transition-all focus:bg-slate-900" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Průjezdní body (volitelné)</label>
                    {waypoints.map((wp, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded-xl p-2 pl-4">
                        <i className="fas fa-location-dot text-orange-500 text-[10px]"></i>
                        <span className="flex-grow text-xs text-slate-300 font-medium">{wp}</span>
                        <button onClick={() => removeWaypoint(idx)} className="w-6 h-6 text-slate-500 hover:text-red-500 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors">
                          <i className="fas fa-times text-[10px]"></i>
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
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-2.5 pl-4 pr-10 text-xs text-white focus:border-orange-500 outline-none transition-all focus:bg-slate-900" 
                        />
                        <button 
                          onClick={() => handleVoiceInput('waypoint')}
                          className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isListening === 'waypoint' ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-slate-500 hover:text-orange-500 hover:bg-slate-800'}`}
                        >
                          <i className="fas fa-microphone text-[10px]"></i>
                        </button>
                      </div>
                      <button 
                        onClick={addWaypoint}
                        disabled={!newWaypoint.trim()}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-3 rounded-xl font-bold text-[9px] transition-all border border-slate-700"
                      >
                        PŘIDAT
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">{tripType === 'ride' ? 'Délka (h)' : 'Dny'}</label>
                      <div className="flex items-center bg-slate-900/50 border border-slate-700 rounded-xl px-1">
                        <button onClick={() => setDays(Math.max(1, days - 1))} className="text-orange-500 p-2 hover:bg-slate-800 rounded-lg transition-colors"><i className="fas fa-minus text-[10px]"></i></button>
                        <span className="flex-grow text-center font-bold text-sm text-white">{days}</span>
                        <button onClick={() => setDays(Math.min(21, days + 1))} className="text-orange-500 p-2 hover:bg-slate-800 rounded-lg transition-colors"><i className="fas fa-plus text-[10px]"></i></button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Lidé</label>
                      <div className="flex items-center bg-slate-900/50 border border-slate-700 rounded-xl px-1">
                        <button onClick={() => setTravelers(Math.max(1, travelers - 1))} className="text-orange-500 p-2 hover:bg-slate-800 rounded-lg transition-colors"><i className="fas fa-minus text-[10px]"></i></button>
                        <span className="flex-grow text-center font-bold text-sm text-white">{travelers}</span>
                        <button onClick={() => setTravelers(Math.min(10, travelers + 1))} className="text-orange-500 p-2 hover:bg-slate-800 rounded-lg transition-colors"><i className="fas fa-plus text-[10px]"></i></button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Mód</label>
                    <div className="grid grid-cols-4 gap-2">
                      {modes.map(m => (
                        <button 
                          key={m.val} 
                          onClick={() => setMode(m.val)}
                          className={`py-2.5 rounded-xl border transition-all flex items-center justify-center ${mode === m.val ? 'bg-orange-600 border-orange-400 text-white shadow-lg shadow-orange-900/40' : 'bg-slate-900/50 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-white'}`}
                          title={m.label}
                        >
                          <i className={`fas ${m.icon} text-xs`}></i>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sekce 2: Styl cesty */}
              <div className="space-y-5 relative">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-orange-500">2</div>
                  <h2 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Styl cesty</h2>
                </div>
                
                <div className="pl-3 ml-3 border-l border-slate-700/50 space-y-5">
                  {tripType === 'ride' && (
                    <div className="flex items-center justify-between bg-slate-900/50 border border-slate-700 rounded-2xl p-4 cursor-pointer hover:border-slate-500 transition-colors" onClick={() => setIsRoundTrip(!isRoundTrip)}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isRoundTrip ? 'bg-orange-600/20 text-orange-500' : 'bg-slate-800 text-slate-500'}`}>
                          <i className="fas fa-rotate text-xs"></i>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-tight">Okruh</p>
                          <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Návrat do místa startu</p>
                        </div>
                      </div>
                      <div className={`w-10 h-5 rounded-full transition-all relative ${isRoundTrip ? 'bg-orange-600' : 'bg-slate-700'}`}>
                        <div className={`w-3 h-3 rounded-full bg-white absolute top-1 transition-all ${isRoundTrip ? 'left-6' : 'left-1'}`}></div>
                      </div>
                    </div>
                  )}

                  {tripType !== 'ride' && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Ubytování</label>
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
                            className={`py-2.5 rounded-xl border transition-all flex flex-col items-center gap-1.5 ${prefAcc === acc.id ? 'bg-orange-600 border-orange-400 text-white shadow-lg shadow-orange-900/40' : 'bg-slate-900/50 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-white'}`}
                          >
                            <i className={`fas ${acc.icon} text-[10px]`}></i>
                            <span className="text-[8px] font-bold uppercase tracking-widest">{acc.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Zážitky</label>
                    <div className="flex flex-wrap gap-2">
                      {experienceOptions.map(opt => (
                        <button 
                          key={opt.id}
                          onClick={() => toggleExperience(opt.id)}
                          className={`px-3 py-2 rounded-xl border text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${prefExp.includes(opt.id) ? 'bg-orange-600 border-orange-400 text-white shadow-md shadow-orange-900/20' : 'bg-slate-900/50 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-white'}`}
                        >
                          <i className={`fas ${opt.icon}`}></i> {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Tempo</label>
                      <select 
                        value={prefPace} 
                        onChange={(e) => setPrefPace(e.target.value as any)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-white outline-none focus:border-orange-500 appearance-none"
                      >
                        <option value="chill">Kochačka</option>
                        <option value="standard">Standard</option>
                        <option value="fast">Rychlé</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Rozpočet</label>
                      <select 
                        value={prefBudget} 
                        onChange={(e) => setPrefBudget(e.target.value as any)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-white outline-none focus:border-orange-500 appearance-none"
                      >
                        <option value="low">Nízký</option>
                        <option value="mid">Střední</option>
                        <option value="high">Vysoký</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sekce 3: AI Instrukce */}
              <div className="space-y-5 relative">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-orange-500">3</div>
                  <h2 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Instrukce pro AI</h2>
                </div>
                
                <div className="pl-3 ml-3 border-l border-slate-700/50 space-y-5">
                  <div className="space-y-1">
                    <textarea 
                      value={customNote} 
                      onChange={(e) => setCustomNote(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-3 px-4 text-xs text-white focus:border-orange-500 outline-none h-24 resize-none transition-all placeholder:text-slate-600 focus:bg-slate-900"
                      placeholder="Např. Chci vidět Grossglockner, vyhnout se dálnicím a spát blízko jezer..."
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={handlePlan}
                  disabled={loading}
                  className="w-full bg-orange-600 hover:bg-orange-500 py-4 rounded-2xl font-bold text-white shadow-[0_0_20px_rgba(234,88,12,0.3)] hover:shadow-[0_0_30px_rgba(234,88,12,0.5)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs group"
                >
                  {loading ? <i className="fas fa-satellite-dish animate-spin"></i> : <i className="fas fa-sparkles group-hover:scale-110 transition-transform"></i>}
                  {loading ? 'Generuji...' : (tripType === 'ride' ? 'PLÁNOVAT VYJÍŽĎKU' : 'PLÁNOVAT EXPEDICI')}
                </button>
              </div>
            </div>
           </div>
          )}

          {/* Saved Expeditions List */}
          {leftTab === 'saved' && (
            <div className="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 space-y-6">
               <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] ml-2">Knihovna tras</h2>
             
             {/* Rides Group */}
             <div className="space-y-3">
               <h3 className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-2">Moje Okruhy</h3>
               {savedExpeditions.filter(ex => ex.tripType === 'ride' && !ex.sharedBy && !ex.id?.startsWith('challenge-')).length === 0 ? (
                 <p className="text-[8px] text-slate-700 italic ml-2 uppercase">Žádné vyjížďky</p>
               ) : (
                 savedExpeditions.filter(ex => ex.tripType === 'ride' && !ex.sharedBy && !ex.id?.startsWith('challenge-')).map(ex => (
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
               {savedExpeditions.filter(ex => ex.tripType !== 'ride' && !ex.sharedBy && !ex.id?.startsWith('challenge-')).length === 0 ? (
                 <p className="text-[8px] text-slate-700 italic ml-2 uppercase">Žádné expedice</p>
               ) : (
                 savedExpeditions.filter(ex => ex.tripType !== 'ride' && !ex.sharedBy && !ex.id?.startsWith('challenge-')).map(ex => (
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
               <h3 className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-2">Výzvy a trasy od kámošů</h3>
               {savedExpeditions.filter(ex => ex.sharedBy || ex.id?.startsWith('challenge-')).length === 0 ? (
                 <p className="text-[8px] text-slate-700 italic ml-2 uppercase">Zatím ti nikdo nic neposlal</p>
               ) : (
                 savedExpeditions.filter(ex => ex.sharedBy || ex.id?.startsWith('challenge-')).map(ex => (
                   <div 
                    key={ex.id}
                    onClick={() => loadExpedition(ex)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between ${expedition?.id === ex.id ? 'bg-orange-600/10 border-orange-500 shadow-lg' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}`}
                   >
                     <div className="flex items-center gap-4">
                       <div className="w-8 h-8 rounded-lg bg-orange-600/20 flex items-center justify-center border border-orange-500/30 group-hover:border-orange-500/50">
                         <i className={`fas ${ex.linkedChallengeId ? 'fa-bolt' : 'fa-share-nodes'} text-orange-500 text-[10px]`}></i>
                       </div>
                       <div>
                         <h4 className="text-[10px] font-bold text-white truncate max-w-[100px] uppercase tracking-tight">{ex.name}</h4>
                         <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                            {ex.linkedChallengeId ? 'Součást výzvy' : `Od: ${ex.sharedBy}`}
                         </p>
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
          )}
        </div>

        {/* Right Column: Content */}
        <div id="expedition-details" className="lg:col-span-8 space-y-8">
          {expedition && !loading ? (
            <div className="animate-fadeIn space-y-8">
              {/* Main Info Card & Timeline */}
              <div className="space-y-8">
                <div className="bg-slate-800 p-8 rounded-[3rem] border border-slate-700 shadow-2xl relative group">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div>
                      <h3 className="text-2xl font-brand font-bold text-white uppercase tracking-tighter italic">{expedition.name}</h3>
                      <p className="text-orange-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">
                        {expedition.startDate ? `${getDayDateText(expedition.startDate, 0)} | ` : ''}Hvězdný deník cestovatele
                      </p>
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
                      {expedition.linkedChallengeId && (
                        <button 
                          onClick={handleManualSyncFromCloud}
                          disabled={isSyncing}
                          className="bg-slate-900 hover:bg-slate-700 text-teal-400 px-4 py-2 rounded-xl border border-slate-700 text-[9px] font-bold uppercase flex items-center gap-2 transition-all active:scale-95"
                          title="Načíst aktualizace z cloudu"
                        >
                          <i className={`fas ${isSyncing ? 'fa-spinner fa-spin' : 'fa-cloud-download-alt'}`}></i> AKTUALIZOVAT
                        </button>
                      )}
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
                      
                      <div className="flex gap-2">
                      {expedition.linkedChallengeId && (
                        <div className="bg-blue-900/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-lg text-[9px] font-bold uppercase flex items-center gap-2">
                          <i className="fas fa-link"></i> SPOJENO S VÝZVOU
                        </div>
                      )}
                      
                      {existingExpedition ? (
                        <div className="flex gap-2">
                          {isModified ? (
                            <button 
                              onClick={handleSaveClick}
                              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl shadow-lg text-[9px] font-bold uppercase flex items-center gap-2 transition-all active:scale-95"
                            >
                              <i className="fas fa-save"></i> ULOŽIT ZMĚNY
                            </button>
                          ) : (
                            <span className="bg-green-600/10 text-green-500 px-4 py-2 rounded-xl border border-green-500/20 text-[9px] font-bold uppercase flex items-center gap-2">
                               <i className="fas fa-check"></i> ULOŽENO
                            </span>
                          )}
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
                          onClick={handleSaveClick}
                          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl shadow-lg text-[9px] font-bold uppercase flex items-center gap-2 transition-all active:scale-95"
                        >
                          <i className="fas fa-save"></i> ULOŽIT TRASU
                        </button>
                      )}
                      </div>
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
                  
                  {/* Discord Integration */}
                  <div className="mt-6 p-4 bg-[#5865F2]/10 border border-[#5865F2]/30 rounded-2xl flex flex-col md:flex-row gap-4 items-center">
                    <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white shrink-0 shadow-[0_0_15px_rgba(88,101,242,0.4)]">
                      <i className="fab fa-discord text-lg"></i>
                    </div>
                    <div className="flex-grow w-full flex flex-col sm:flex-row gap-3">
                      <div className="flex-grow">
                        <label className="text-[10px] font-bold text-[#5865F2] uppercase tracking-widest mb-1 block">Discord Vysílačka (Volitelné)</label>
                        <input 
                          type="text" 
                          value={expedition.discordLink || ''}
                          onChange={(e) => {
                            setExpedition({...expedition, discordLink: e.target.value});
                          }}
                          placeholder="Vlož odkaz na Discord hlasový kanál (např. https://discord.gg/...)"
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-[#5865F2] transition-colors"
                        />
                      </div>
                      {expedition.discordLink && (
                        <div className="flex items-end pb-0.5">
                          <a 
                            href={expedition.discordLink}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2"
                          >
                            PŘIPOJIT SE
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              {/* Map Section (Whole Expedition) */}
              <div className="h-[500px] mb-8 bg-slate-800 rounded-[3.5rem] border border-slate-700 overflow-hidden relative shadow-2xl group">
                <div id="exp-map" className="w-full h-full z-0"></div>
                <div className="absolute top-8 left-8 z-10 bg-slate-950/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-slate-700 shadow-2xl">
                   <p className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.3em]">
                     Trasa celé expedice
                   </p>
                </div>
                <div className="absolute top-8 right-8 z-10 bg-slate-900/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-700/50 flex items-center gap-3 shadow-xl max-w-xs">
                  <i className="fas fa-info-circle text-orange-400 text-lg"></i>
                  <div>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-none mb-1">
                      Schématický náhled
                    </p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider leading-tight">
                      Orientační mapa. Jednotlivé dny jsou barevně odděleny, pokud mají nahraná GPX data, vykreslí se reálná trasa.
                    </p>
                  </div>
                </div>
                <div className="absolute bottom-8 right-8 z-10 flex flex-col gap-2">
                   <button onClick={() => mapRef.current?.zoomIn()} className="w-12 h-12 bg-slate-950/90 text-white rounded-xl border border-slate-700 flex items-center justify-center shadow-xl active:scale-90 transition-all"><i className="fas fa-plus"></i></button>
                   <button onClick={() => mapRef.current?.zoomOut()} className="w-12 h-12 bg-slate-950/90 text-white rounded-xl border border-slate-700 flex items-center justify-center shadow-xl active:scale-90 transition-all"><i className="fas fa-minus"></i></button>
                </div>
              </div>

                {/* Timeline */}
                <div className="relative border-l-2 border-slate-700 ml-4 md:ml-8 space-y-8 py-4">
                  {expedition.days.map((day, idx) => (
                    <div key={idx} className="relative pl-8 md:pl-12">
                      {/* Timeline Dot */}
                      <div className={`absolute -left-[11px] top-6 w-5 h-5 rounded-full border-4 transition-all ${expandedDayIdx === idx ? 'bg-orange-500 border-slate-900 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'bg-slate-700 border-slate-900'}`}></div>
                      
                      {/* Day Header (Clickable) */}
                      <button 
                        onClick={() => {
                          setExpandedDayIdx(expandedDayIdx === idx ? -1 : idx);
                          setActiveDayIdx(idx);
                        }}
                        className={`w-full text-left p-6 rounded-[2rem] border transition-all ${expandedDayIdx === idx ? 'bg-slate-800 border-orange-500/50 shadow-xl' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.3em] mb-1">
                              Den {day.dayNumber} {expedition.startDate ? ` | ${getDayDateText(expedition.startDate, idx)}` : ''}
                            </p>
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
                      {expandedDayIdx === idx && (
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
                            
                            {/* Mapy.cz Integration */}
                            <div className="mb-6 p-4 bg-[#cc0000]/10 border border-[#cc0000]/30 rounded-2xl flex flex-col md:flex-row gap-4 items-center">
                              <div className="w-8 h-8 rounded-full bg-[#cc0000] flex items-center justify-center text-white shrink-0 shadow-[0_0_10px_rgba(204,0,0,0.4)]">
                                <i className="fas fa-map-marked-alt text-sm"></i>
                              </div>
                              <div className="flex-grow w-full flex flex-col sm:flex-row gap-3">
                                <div className="flex-grow">
                                  <label className="text-[10px] font-bold text-[#cc0000] uppercase tracking-widest mb-1 block">Odkaz na Mapy.cz</label>
                                  <input 
                                    type="text" 
                                    value={day.mapyCzUrl || ''}
                                    onChange={(e) => {
                                      const updatedDays = [...expedition.days];
                                      updatedDays[idx] = { ...day, mapyCzUrl: e.target.value };
                                      setExpedition({ ...expedition, days: updatedDays });
                                    }}
                                    placeholder="Vlož odkaz na trasu v Mapy.cz (např. https://mapy.cz/s/...)"
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-[#cc0000] transition-colors"
                                  />
                                </div>
                                {day.mapyCzUrl && (
                                  <div className="flex items-end pb-0.5">
                                    <a 
                                      href={day.mapyCzUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="bg-[#cc0000] hover:bg-[#aa0000] text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2"
                                    >
                                      OTEVŘÍT
                                    </a>
                                  </div>
                                )}
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
                              
                              {day.accommodation && (
                                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-700 border-l-4 border-l-orange-500 mb-4 opacity-80">
                                  <div className="flex justify-between items-start mb-1">
                                    <p className="text-sm font-bold text-white leading-tight">{day.accommodation?.name}</p>
                                    <span className="text-[8px] bg-orange-600/20 text-orange-500 px-2 py-0.5 rounded uppercase tracking-widest border border-orange-500/20 whitespace-nowrap ml-2">AI TIP</span>
                                  </div>
                                  <p className="text-[9px] text-slate-600 uppercase font-bold tracking-widest mb-4">{day.accommodation?.type}</p>
                                  <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.accommodation?.name || '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-xl border border-slate-700 flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-all"
                                  >
                                    MAPA <i className="fas fa-external-link-alt text-[8px] opacity-50"></i>
                                  </a>
                                </div>
                              )}
                              
                              {day.customAccommodation ? (
                                <div className="bg-slate-900 p-5 rounded-2xl border border-blue-500/30 border-l-4 border-l-blue-500 relative">
                                  <div className="flex justify-between items-start mb-1">
                                    <p className="text-sm font-bold text-white leading-tight">{day.customAccommodation.name}</p>
                                    <span className="text-[8px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded uppercase tracking-widest border border-blue-500/20">MOJE</span>
                                  </div>
                                  <div className="flex gap-2 mt-4">
                                    {day.customAccommodation.url ? (
                                      <a 
                                        href={day.customAccommodation.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-xl border border-slate-700 flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-all"
                                      >
                                        ODKAZ <i className="fas fa-external-link-alt text-[8px] opacity-50"></i>
                                      </a>
                                    ) : (
                                       <a 
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.customAccommodation.name)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-xl border border-slate-700 flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-all"
                                      >
                                        MAPA <i className="fas fa-external-link-alt text-[8px] opacity-50"></i>
                                      </a>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newExp = {...expedition};
                                        newExp.days[idx].customAccommodation = undefined;
                                        setExpedition(newExp);
                                        const existingTrips = [...savedExpeditions];
                                        const tripIndex = existingTrips.findIndex(t => t.id === newExp.id);
                                        if (tripIndex >= 0) {
                                          existingTrips[tripIndex] = newExp;
                                          setSavedExpeditions(existingTrips);
                                          localStorage.setItem('spirit_wanderer_trips', JSON.stringify(existingTrips));
                                          handleAutoChallengeSync(newExp);
                                        }
                                      }}
                                      className="w-10 h-8 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center transition-all border border-red-500/20"
                                      title="Smazat ubytování"
                                    >
                                      <i className="fas fa-trash text-[10px]"></i>
                                    </button>
                                  </div>
                                </div>
                              ) : editingCustomAcc.dayIndex === idx ? (
                                <div className="space-y-3 bg-slate-900 border border-slate-700 rounded-2xl p-4">
                                  <input
                                    type="text"
                                    placeholder="Název (např. Penzion u Nováků)"
                                    value={editingCustomAcc.name}
                                    onChange={e => setEditingCustomAcc({...editingCustomAcc, name: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white focus:border-orange-500 outline-none"
                                    autoFocus
                                  />
                                  <input
                                    type="text"
                                    placeholder="Odkaz (volitelné)"
                                    value={editingCustomAcc.url}
                                    onChange={e => setEditingCustomAcc({...editingCustomAcc, url: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white focus:border-orange-500 outline-none"
                                  />
                                  <div className="flex gap-2 pt-2">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleSaveCustomAcc() }}
                                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-widest py-2 rounded-xl transition-all"
                                    >
                                      ULOŽIT
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setEditingCustomAcc({ dayIndex: null, name: '', url: '' }) }}
                                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] uppercase tracking-widest py-2 rounded-xl transition-all border border-slate-700"
                                    >
                                      ZRUŠIT
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCustomAcc({ dayIndex: idx, name: day.customAccommodation?.name || '', url: day.customAccommodation?.url || '' });
                                  }}
                                  className="w-full py-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 border-dashed rounded-2xl text-[10px] text-slate-400 font-bold uppercase tracking-widest transition-all hover:text-white flex items-center justify-center gap-2"
                                >
                                  <i className="fas fa-plus"></i> {expedition.tripType === 'ride' ? 'PŘIDAT VLASTNÍ ZASTÁVKU' : 'PŘIDAT VLASTNÍ UBYTOVÁNÍ'}
                                </button>
                              )}
                            </div>
                          </div>
                          
                          <div className="lg:col-span-3">
                            <DayMap 
                              day={day} 
                              color={getDayColor(day.dayNumber)} 
                              onUploadGpx={(e) => handleGpxUpload(e, idx)}
                              onDeleteGpx={() => handleDeleteGpxRoute(idx)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats Section */}
              {expedition.budget && (
                <div className="bg-slate-800 p-8 rounded-[3rem] border border-slate-700 shadow-2xl animate-fadeIn">
                  <h3 className="text-2xl font-brand font-bold text-white uppercase tracking-tighter italic mb-2">Rozpočet a statistiky</h3>
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-8">Odhadované náklady na 1 osobu</p>
                  
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
                                formatter={(value: any) => [`${value.toLocaleString()} Kč`, '']}
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
                              formatter={(value: any) => [`${value} km`, 'Vzdálenost']}
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
              {expedition.countriesInfo && (
                <div className="space-y-6 animate-fadeIn">
                  <h3 className="text-2xl font-brand font-bold text-white uppercase tracking-tighter italic mb-8">Průvodce zeměmi</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {expedition.countriesInfo.map((country, idx) => (
                      <div key={idx} className="bg-slate-800 rounded-[3rem] border border-slate-700 shadow-2xl overflow-hidden group">
                        {/* Country Header */}
                        <div className="bg-slate-900/80 p-8 border-b border-slate-700 relative overflow-hidden">
                          <div className="absolute -right-4 -top-4 opacity-5 text-9xl">
                            <i className="fas fa-globe-europe"></i>
                          </div>
                          <div className="relative z-10 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-orange-600/20 flex items-center justify-center border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                              <i className="fas fa-flag text-orange-500 text-xl"></i>
                            </div>
                            <h4 className="text-3xl font-brand font-black text-white uppercase tracking-tighter">{country.name}</h4>
                          </div>
                        </div>
                        
                        {/* Bento Grid Content */}
                        <div className="p-6 grid grid-cols-2 gap-4">
                          {/* Speed Limits */}
                          <div className="col-span-2 sm:col-span-1 bg-slate-900/50 p-5 rounded-3xl border border-slate-700/50 hover:border-slate-500 transition-colors">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                <i className="fas fa-gauge-high text-blue-400 text-xs"></i>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rychlost</p>
                            </div>
                            <p className="text-sm text-white font-medium leading-snug">{country.speedLimits}</p>
                          </div>
                          
                          {/* Alcohol */}
                          <div className="col-span-2 sm:col-span-1 bg-slate-900/50 p-5 rounded-3xl border border-slate-700/50 hover:border-slate-500 transition-colors">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                                <i className="fas fa-wine-glass text-red-400 text-xs"></i>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Alkohol</p>
                            </div>
                            <p className="text-sm text-white font-medium leading-snug">{country.alcoholLimit}</p>
                          </div>

                          {/* Tolls */}
                          <div className="col-span-2 bg-slate-900/50 p-5 rounded-3xl border border-slate-700/50 hover:border-slate-500 transition-colors">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                <i className="fas fa-ticket text-purple-400 text-xs"></i>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mýtné a známky</p>
                            </div>
                            <p className="text-sm text-white font-medium leading-snug">{country.tolls}</p>
                          </div>

                          {/* Equipment */}
                          <div className="col-span-2 bg-slate-900/50 p-5 rounded-3xl border border-slate-700/50 hover:border-slate-500 transition-colors">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <i className="fas fa-triangle-exclamation text-emerald-400 text-xs"></i>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Povinná výbava</p>
                            </div>
                            <ul className="space-y-2">
                              {country.mandatoryEquipment.map((eq, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-white font-medium">
                                  <i className="fas fa-check text-emerald-500 text-[10px] mt-1 shrink-0"></i>
                                  <span className="leading-snug">{eq}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Moto Rules */}
                          {country.customRules && country.customRules.length > 0 && (
                            <div className="col-span-2 bg-orange-950/30 p-5 rounded-3xl border border-orange-500/30 hover:border-orange-500/50 transition-colors">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/40">
                                  <i className="fas fa-motorcycle text-orange-500 text-xs"></i>
                                </div>
                                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Motorkářská specifika</p>
                              </div>
                              <ul className="space-y-2">
                                {country.customRules.map((rule, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-orange-100 font-medium">
                                    <i className="fas fa-circle text-orange-500 text-[6px] mt-1.5 shrink-0"></i>
                                    <span className="leading-snug">{rule}</span>
                                  </li>
                                ))}
                              </ul>
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
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-fadeIn">
          <div className="bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-700/50 shadow-2xl overflow-hidden relative animate-slideUp">
            {/* Decorative background */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-orange-600/20 to-transparent pointer-events-none"></div>
            
            <div className="p-8 pb-6 flex justify-between items-start relative z-10">
               <div>
                 <h2 className="text-3xl font-brand font-bold uppercase tracking-tighter text-white leading-none">VYHLÁSIT <br/><span className="text-orange-500">VÝZVU</span></h2>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-3">Komu chceš nabídnout tuhle trasu?</p>
               </div>
               <button onClick={() => setShowChallengeAudience(false)} className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all">
                 <i className="fas fa-times"></i>
               </button>
            </div>
            
            <div className="p-8 pt-2 space-y-3 relative z-10">
              <button 
                onClick={() => { handleCreateChallengeWithExp(expedition, 'all'); setShowChallengeAudience(false); }}
                className="w-full p-5 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-orange-500 hover:bg-slate-800 flex items-center gap-5 transition-all group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-600/0 via-orange-600/0 to-orange-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center text-orange-500 group-hover:scale-110 group-hover:border-orange-500/50 transition-all shadow-inner">
                  <i className="fas fa-globe text-xl"></i>
                </div>
                <div className="text-left flex-grow">
                  <p className="text-sm font-bold text-white uppercase tracking-tight group-hover:text-orange-400 transition-colors">Veřejná výzva</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Uvidí ji každý na Radaru</p>
                </div>
                <i className="fas fa-chevron-right text-slate-600 group-hover:text-orange-500 transition-colors"></i>
              </button>

              <button 
                onClick={() => { handleCreateChallengeWithExp(expedition, 'party'); setShowChallengeAudience(false); }}
                className="w-full p-5 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-blue-500 hover:bg-slate-800 flex items-center gap-5 transition-all group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/0 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center text-blue-500 group-hover:scale-110 group-hover:border-blue-500/50 transition-all shadow-inner">
                  <i className="fas fa-users text-xl"></i>
                </div>
                <div className="text-left flex-grow">
                  <p className="text-sm font-bold text-white uppercase tracking-tight group-hover:text-blue-400 transition-colors">Pro moji partu</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Jen pro tvé sledující</p>
                </div>
                <i className="fas fa-chevron-right text-slate-600 group-hover:text-blue-500 transition-colors"></i>
              </button>

              <button 
                onClick={() => { handleCreateChallengeWithExp(expedition, 'selected'); setShowChallengeAudience(false); }}
                className="w-full p-5 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-emerald-500 hover:bg-slate-800 flex items-center gap-5 transition-all group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/0 via-emerald-600/0 to-emerald-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center text-emerald-500 group-hover:scale-110 group-hover:border-emerald-500/50 transition-all shadow-inner">
                  <i className="fas fa-user-check text-xl"></i>
                </div>
                <div className="text-left flex-grow">
                  <p className="text-sm font-bold text-white uppercase tracking-tight group-hover:text-emerald-400 transition-colors">Pouze vybrané</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Vybreš konkrétní jezdce</p>
                </div>
                <i className="fas fa-chevron-right text-slate-600 group-hover:text-emerald-500 transition-colors"></i>
              </button>

              <div className="flex items-center gap-4 py-2">
                <div className="h-[1px] flex-grow bg-slate-800"></div>
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Nebo</span>
                <div className="h-[1px] flex-grow bg-slate-800"></div>
              </div>

              <button 
                onClick={() => { handleShare(); setShowChallengeAudience(false); }}
                className="w-full p-5 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-purple-500 hover:bg-slate-800 flex items-center gap-5 transition-all group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-purple-600/0 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center text-purple-500 group-hover:scale-110 group-hover:border-purple-500/50 transition-all shadow-inner">
                  <i className="fas fa-link text-xl"></i>
                </div>
                <div className="text-left flex-grow">
                  <p className="text-sm font-bold text-white uppercase tracking-tight group-hover:text-purple-400 transition-colors">Získat odkaz</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Pro WhatsApp, Messenger...</p>
                </div>
                <i className="fas fa-chevron-right text-slate-600 group-hover:text-purple-500 transition-colors"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareUrl && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-fadeIn">
          <div className="bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-700/50 shadow-2xl overflow-hidden relative animate-slideUp">
            {/* Decorative background */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-purple-600/20 to-transparent pointer-events-none"></div>
            
            <div className="p-8 pb-6 flex justify-between items-start relative z-10">
               <div>
                 <h2 className="text-3xl font-brand font-bold uppercase tracking-tighter text-white leading-none">SDÍLET <br/><span className="text-purple-500">EXPEDICI</span></h2>
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-3">Pošli odkaz kamarádům</p>
               </div>
               <button onClick={() => setShareUrl(null)} className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all">
                 <i className="fas fa-times"></i>
               </button>
            </div>
            
            <div className="p-8 pt-2 space-y-6 relative z-10">
              <div className="bg-slate-950 p-1 rounded-2xl border border-slate-700 flex items-center gap-2 shadow-inner">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-slate-500 ml-1">
                  <i className="fas fa-link text-xs"></i>
                </div>
                <input 
                  type="text" 
                  readOnly 
                  value={shareUrl} 
                  className="bg-transparent flex-grow text-[10px] text-slate-300 font-mono outline-none py-3"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    const btn = document.getElementById('copy-btn');
                    if (btn) {
                      btn.innerHTML = '<i class="fas fa-check"></i>';
                      btn.classList.add('bg-green-600', 'text-white', 'border-green-500');
                      setTimeout(() => {
                        btn.innerHTML = '<i class="fas fa-copy"></i>';
                        btn.classList.remove('bg-green-600', 'text-white', 'border-green-500');
                      }, 2000);
                    }
                  }}
                  id="copy-btn"
                  className="w-12 h-10 rounded-xl bg-purple-600/20 text-purple-500 hover:bg-purple-600 hover:text-white border border-purple-500/30 flex items-center justify-center transition-all mr-1"
                  title="Kopírovat odkaz"
                >
                  <i className="fas fa-copy"></i>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a 
                  href={`https://wa.me/?text=${encodeURIComponent(`Koukni na tuhle motorkářskou trasu: ${shareUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 hover:bg-[#25D366] hover:text-white text-[#25D366] flex flex-col items-center justify-center gap-2 transition-all group"
                >
                  <i className="fab fa-whatsapp text-2xl group-hover:scale-110 transition-transform"></i>
                  <span className="text-[9px] font-bold uppercase tracking-widest">WhatsApp</span>
                </a>
                <a 
                  href={`https://www.facebook.com/dialog/send?link=${encodeURIComponent(shareUrl)}&app_id=123456789&redirect_uri=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl bg-[#0084FF]/10 border border-[#0084FF]/30 hover:bg-[#0084FF] hover:text-white text-[#0084FF] flex flex-col items-center justify-center gap-2 transition-all group"
                >
                  <i className="fab fa-facebook-messenger text-2xl group-hover:scale-110 transition-transform"></i>
                  <span className="text-[9px] font-bold uppercase tracking-widest">Messenger</span>
                </a>
              </div>
              
              <button 
                onClick={() => setShareUrl(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest text-white transition-all border border-slate-700"
              >
                HOTOVO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Save Options */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-fadeIn">
          <div className="bg-slate-900 w-full max-w-sm rounded-[2.5rem] border border-orange-500/30 shadow-2xl overflow-hidden flex flex-col animate-slideUp">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
               <div>
                  <h2 className="text-lg font-brand font-bold uppercase tracking-tight text-white">ULOŽIT <span className="text-orange-500">ZMĚNY</span></h2>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Jak chceš trasu uložit?</p>
               </div>
               <button onClick={() => setShowSaveModal(false)} className="text-slate-500 hover:text-white p-2">
                 <i className="fas fa-times text-xl"></i>
               </button>
            </div>
            
            <div className="p-6 space-y-4">
              <button 
                onClick={overwriteExisting}
                className="w-full bg-orange-600 hover:bg-orange-500 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest text-white shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-3"
              >
                <i className="fas fa-save text-lg"></i>
                PŘEPSAT STÁVAJÍCÍ
              </button>
              
              <button 
                onClick={saveAsNew}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest text-white transition-all flex items-center justify-center gap-3"
              >
                <i className="fas fa-copy text-lg"></i>
                ULOŽIT JAKO NOVOU
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TripPlanner;
