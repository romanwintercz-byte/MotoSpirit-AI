
import React, { useState, useEffect, useRef } from 'react';
import { Motorcycle, MaintenanceRecord, UserProfile } from '../types';
import { analyzeMaintenance } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { syncDataToCloud, fetchDataFromCloud, generateSyncCode, subscribeToCloudChanges } from '../services/syncService';

const Garage: React.FC = () => {
  // --- POMOCNÉ FUNKCE PRO IMAGE RESIZING ---
  const resizeImage = (file: File, maxWidth: number = 600): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Uložíme jako JPEG s kvalitou 0.5 pro maximální úsporu místa (Mb dieta)
            resolve(canvas.toDataURL('image/jpeg', 0.5));
          }
        };
      };
    });
  };

  // --- POMOCNÉ FUNKCE PRO BEZPEČNÝ LOCALSTORAGE ---
  const safeGetItem = (key: string, defaultValue: string) => {
    try {
      return localStorage.getItem(key) || defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };

  const safeParse = (data: string, fallback: any) => {
    try {
      return JSON.parse(data);
    } catch (e) {
      return fallback;
    }
  };

  // --- STATE ---
  const [user, setUser] = useState<UserProfile>(() => 
    safeParse(safeGetItem('motospirit_user', ''), { name: '', nickname: 'Rider', experienceYears: 0, ridingStyle: 'Road', avatar: '', isPublic: true })
  );

  const [bikes, setBikes] = useState<Motorcycle[]>(() => 
    safeParse(safeGetItem('motospirit_bikes', '[]'), [])
  );

  const [records, setRecords] = useState<MaintenanceRecord[]>(() => 
    safeParse(safeGetItem('motospirit_records', '[]'), [])
  );

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBike, setEditingBike] = useState<Motorcycle | null>(null);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [newBike, setNewBike] = useState<Partial<Motorcycle>>({
    brand: '', model: '', year: new Date().getFullYear(), mileage: 0, image: ''
  });

  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncCode, setSyncCode] = useState<string>(() => localStorage.getItem('motospirit_sync_code') || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [communityCode, setCommunityCode] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(() => localStorage.getItem('motospirit_auth') === 'true');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const bikeFileInputRef = useRef<HTMLInputElement>(null);
  const bikeCameraInputRef = useRef<HTMLInputElement>(null);
  const editBikeFileInputRef = useRef<HTMLInputElement>(null);
  const editBikeCameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkDb = async () => {
      try {
        const { error } = await supabase.from('moto_sync_profiles').select('count', { count: 'exact', head: true }).limit(1);
        if (error) throw error;
        setDbStatus('ok');
      } catch (e) {
        console.error("DB Check failed:", e);
        setDbStatus('error');
      }
    };
    if (showSyncModal) checkDb();
  }, [showSyncModal]);

  // --- REALTIME SUBSCRIPTION ---
  useEffect(() => {
    if (!syncCode) return;
    
    const channel = subscribeToCloudChanges(syncCode, (cloudData) => {
      if (!cloudData) return;
      
      // Update local state if cloud data is newer or different
      // To avoid loops, we only update if there's a meaningful change
      if (cloudData.user) {
        setUser(prev => JSON.stringify(prev) !== JSON.stringify(cloudData.user) ? cloudData.user : prev);
      }
      if (cloudData.bikes) {
        setBikes(prev => JSON.stringify(prev) !== JSON.stringify(cloudData.bikes) ? cloudData.bikes : prev);
      }
      if (cloudData.records) {
        setRecords(prev => JSON.stringify(prev) !== JSON.stringify(cloudData.records) ? cloudData.records : prev);
      }
      if (cloudData.fuel) {
        localStorage.setItem('motospirit_fuel', JSON.stringify(cloudData.fuel));
      }
      if (cloudData.expeditions) {
        localStorage.setItem('spirit_wanderer_trips', JSON.stringify(cloudData.expeditions));
      }
      setLastSyncTime(new Date());
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [syncCode]);

  // --- AUTO-SYNC ON CHANGES ---
  const autoSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!syncCode) return;
    
    // Debounce sync to avoid too many requests
    if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current);
    
    autoSyncTimeoutRef.current = setTimeout(async () => {
      try {
        const expeditions = JSON.parse(localStorage.getItem('spirit_wanderer_trips') || '[]');
        const fuel = JSON.parse(localStorage.getItem('motospirit_fuel') || '[]');
        
        await syncDataToCloud(syncCode, {
          user,
          bikes,
          records,
          fuel,
          expeditions
        });
        setLastSyncTime(new Date());
      } catch (e) {
        console.error("Auto-sync failed", e);
      }
    }, 2000); // Sync 2 seconds after last change
    
    return () => {
      if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current);
    };
  }, [user, bikes, records, syncCode]);

  // --- PERSISTENCE ---
  useEffect(() => {
    try {
      localStorage.setItem('motospirit_user', JSON.stringify(user));
      window.dispatchEvent(new Event('storage'));
    } catch (e) { console.error("Storage error", e); }
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem('motospirit_bikes', JSON.stringify(bikes));
    } catch (e) { console.error("Storage error", e); }
  }, [bikes]);

  useEffect(() => {
    try {
      localStorage.setItem('motospirit_records', JSON.stringify(records));
    } catch (e) { console.error("Storage error", e); }
  }, [records]);

  // Synchronizace nájezdu z Logbooku
  useEffect(() => {
    const sync = () => {
      const savedBikes = safeGetItem('motospirit_bikes', '[]');
      setBikes(safeParse(savedBikes, []));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  // --- HANDLERS ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'user' | 'bike' | 'edit') => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      try {
        const compressedBase64 = await resizeImage(file);
        if (target === 'user') {
          setUser(prev => ({ ...prev, avatar: compressedBase64 }));
        } else if (target === 'bike') {
          setNewBike(prev => ({ ...prev, image: compressedBase64 }));
        } else if (target === 'edit' && editingBike) {
          setEditingBike(prev => prev ? ({ ...prev, image: compressedBase64 }) : null);
        }
      } catch (err) {
        console.error("Image processing failed", err);
        alert("Nepodařilo se zpracovat obrázek.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAnalyze = async (bike: Motorcycle) => {
    setLoading(true);
    try {
      const bikeRecords = records.filter(r => r.bikeId === bike.id);
      const result = await analyzeMaintenance(bike, bikeRecords);
      setAnalysis(result);
    } catch (err) {
      setAnalysis("AI teď zrovna ladí motor. Zkuste to za chvíli.");
    } finally {
      setLoading(false);
    }
  };

  // --- SYNC LOGIC ---
  const handleSyncPush = async () => {
    if (!syncCode) return;
    setIsSyncing(true);
    try {
      const expeditions = JSON.parse(localStorage.getItem('spirit_wanderer_trips') || '[]');
      const fuel = JSON.parse(localStorage.getItem('motospirit_fuel') || '[]');
      
      console.log("Pushing data to cloud for code:", syncCode);
      await syncDataToCloud(syncCode, {
        user,
        bikes,
        records,
        fuel,
        expeditions
      });
      alert("Data byla úspěšně odeslána do cloudu.");
    } catch (e: any) {
      console.error("Sync push error:", e);
      alert(`Synchronizace selhala: ${e.message || 'Neznámá chyba'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncPull = async () => {
    if (!syncCode) return;
    if (!window.confirm("Tímto přepíšeš lokální data daty z cloudu. Pokračovat?")) return;
    
    setIsSyncing(true);
    try {
      console.log("Pulling data from cloud for code:", syncCode);
      const cloudData = await fetchDataFromCloud(syncCode);
      if (cloudData) {
        if (cloudData.user) setUser(cloudData.user);
        if (cloudData.bikes) setBikes(cloudData.bikes);
        if (cloudData.records) setRecords(cloudData.records);
        if (cloudData.fuel) localStorage.setItem('motospirit_fuel', JSON.stringify(cloudData.fuel));
        if (cloudData.expeditions) localStorage.setItem('spirit_wanderer_trips', JSON.stringify(cloudData.expeditions));
        
        alert("Data byla úspěšně stažena z cloudu.");
        window.location.reload(); // Reload to refresh all states across pages
      } else {
        alert("Pro tento kód nebyla nalezena žádná data.");
      }
    } catch (e: any) {
      console.error("Sync pull error:", e);
      alert(`Stažení dat selhalo: ${e.message || 'Neznámá chyba'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const initSyncCode = () => {
    if (communityCode.trim().toUpperCase() !== 'MOTOSPIRIT1.0') {
      alert("Nesprávný kód komunity!");
      return;
    }
    const newCode = generateSyncCode();
    setSyncCode(newCode);
    localStorage.setItem('motospirit_sync_code', newCode);
    localStorage.setItem('motospirit_auth', 'true');
    setIsAuthorized(true);
  };

  const handleAddBike = () => {
    if (!newBike.brand?.trim() || !newBike.model?.trim()) {
      alert("Vyplň prosím aspoň značku a model.");
      return;
    }
    
    const yearVal = parseInt(String(newBike.year)) || new Date().getFullYear();
    const mileageVal = parseInt(String(newBike.mileage)) || 0;

    const bikeToAdd: Motorcycle = {
      id: Date.now().toString(),
      brand: newBike.brand.trim(),
      model: newBike.model.trim(),
      year: yearVal,
      mileage: mileageVal,
      image: newBike.image || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80'
    };
    
    setBikes(prev => [...prev, bikeToAdd]);
    setNewBike({ brand: '', model: '', year: 2024, mileage: 0, image: '' });
    setIsAddModalOpen(false);
  };

  const handleUpdateBike = () => {
    if (!editingBike || !editingBike.brand?.trim() || !editingBike.model?.trim()) {
      alert("Vyplň prosím aspoň značku a model.");
      return;
    }

    setBikes(prev => prev.map(b => b.id === editingBike.id ? editingBike : b));
    setEditingBike(null);
  };

  const deleteBike = (id: string) => {
    if (window.confirm("Opravdu chceš tuhle mašinu vyřadit z garáže?")) {
      setBikes(prev => prev.filter(b => b.id !== id));
      setRecords(prev => prev.filter(r => r.bikeId !== id));
    }
  };

  const updateMileage = (id: string, val: string) => {
    const num = parseInt(val) || 0;
    setBikes(prev => prev.map(b => b.id === id ? { ...b, mileage: num } : b));
  };

  return (
    <div className="space-y-6 pb-32 md:pb-12">
      {/* Rider Profile Section */}
      <section className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] border border-slate-700 p-6 shadow-xl relative z-10">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-3xl bg-slate-700 flex items-center justify-center text-3xl font-bold shadow-lg overflow-hidden border-2 border-orange-500/30">
              {user.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-orange-500">{user.name ? user.name[0].toUpperCase() : <i className="fas fa-user"></i>}</span>
              )}
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={(e) => handleFileChange(e, 'user')} 
            />
            <input 
              type="file" 
              ref={cameraInputRef} 
              className="hidden" 
              accept="image/*" 
              capture="user"
              onChange={(e) => handleFileChange(e, 'user')} 
            />
            
            <div className="absolute -bottom-1 -right-1 flex gap-1">
              {isProfileEditing && (
                <button 
                  onClick={() => cameraInputRef.current?.click()}
                  className="bg-orange-600 hover:bg-orange-500 w-9 h-9 rounded-xl border-4 border-slate-900 flex items-center justify-center transition-all shadow-lg active:scale-90"
                  title="Vyfotit"
                >
                  <i className="fas fa-camera text-white text-xs"></i>
                </button>
              )}
              <button 
                onClick={() => isProfileEditing ? fileInputRef.current?.click() : setIsProfileEditing(true)}
                className="bg-slate-700 hover:bg-slate-600 w-9 h-9 rounded-xl border-4 border-slate-900 flex items-center justify-center transition-all shadow-lg active:scale-90"
                title={isProfileEditing ? "Vybrat z galerie" : "Upravit profil"}
              >
                <i className={`fas ${isProfileEditing ? 'fa-image' : 'fa-user-edit'} text-white text-xs`}></i>
              </button>
            </div>
          </div>
          
          <div className="flex-grow text-center sm:text-left">
            <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
              <div className="flex-grow">
                {isProfileEditing ? (
                  <div className="grid grid-cols-1 gap-3 animate-fadeIn max-w-md mx-auto sm:mx-0">
                    <input 
                      className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 outline-none focus:border-orange-500 text-sm" 
                      placeholder="Jméno" 
                      value={user.name} 
                      onChange={e => setUser({...user, name: e.target.value})}
                    />
                    <input 
                      className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 outline-none focus:border-orange-500 text-sm" 
                      placeholder="Přezdívka" 
                      value={user.nickname} 
                      onChange={e => setUser({...user, nickname: e.target.value})}
                    />
                    <input 
                      type="email"
                      className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 outline-none focus:border-orange-500 text-sm" 
                      placeholder="E-mail" 
                      value={user.email || ''} 
                      onChange={e => {
                        const newEmail = e.target.value;
                        const isAdmin = newEmail.toLowerCase() === 'roman.winter.cz@gmail.com' || user.isAdmin;
                        setUser({...user, email: newEmail, isAdmin});
                      }}
                    />
                    <div className="flex items-center gap-3 px-2">
                      <input 
                        type="checkbox" 
                        id="isPublic"
                        checked={user.isPublic} 
                        onChange={e => setUser({...user, isPublic: e.target.checked})}
                        className="w-4 h-4 accent-orange-500"
                      />
                      <label htmlFor="isPublic" className="text-[10px] font-bold text-slate-400 uppercase">Veřejný profil (viditelný v Radaru)</label>
                    </div>
                    {!user.isAdmin && (
                      <button 
                        onClick={() => {
                          const pass = prompt("Zadej administrátorské heslo:");
                          if (pass === "SPIRIT-BOSS-2024") {
                            setUser({...user, isAdmin: true});
                            alert("Nyní jsi administrátor!");
                          }
                        }}
                        className="text-[8px] text-slate-600 uppercase font-bold hover:text-orange-500 transition-colors text-left px-2"
                      >
                        Aktivovat Admin mód
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-brand font-bold tracking-tight text-white">
                      {user.name || 'Neznámý'} <span className="text-orange-500">"{user.nickname || 'Rider'}"</span>
                    </h2>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-2 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700">
                        <i className="fas fa-helmet-safety text-orange-500"></i> {user.ridingStyle || 'Road'}
                      </span>
                      <span className="flex items-center gap-2 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700">
                        <i className="fas fa-calendar-check text-orange-500"></i> {user.experienceYears} let
                      </span>
                      <button 
                        onClick={() => setShowSyncModal(true)}
                        className="flex items-center gap-2 bg-orange-600/10 hover:bg-orange-600/20 px-3 py-1 rounded-full border border-orange-500/30 text-orange-500 transition-all"
                      >
                        <i className={`fas ${lastSyncTime ? 'fa-check-circle' : 'fa-cloud-upload-alt'}`}></i> 
                        {syncCode ? (lastSyncTime ? 'SYNCHRONIZOVÁNO' : 'MOTO CLOUD AKTIVNÍ') : 'AKTIVOVAT CLOUD'}
                      </button>
                    </div>
                  </>
                )}
              </div>
              
              {isProfileEditing && (
                <button 
                  onClick={() => setIsProfileEditing(false)}
                  className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-xl font-bold transition-all text-xs text-white"
                >
                  ULOŽIT PROFIL
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Header Section */}
      <div className="flex justify-between items-center px-2 relative z-10">
        <div>
          <h1 className="text-2xl font-bold font-brand uppercase tracking-tighter text-white">MOJE <span className="text-orange-500">MAŠINY</span></h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Garáž hostí {bikes.length} strojů</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="hidden sm:flex bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-xl items-center gap-2 font-bold transition-all shadow-lg active:scale-95 text-white"
        >
          <i className="fas fa-plus"></i> PŘIDAT
        </button>
      </div>

      {/* Mobile Floating Action Button */}
      <button 
        onClick={() => setIsAddModalOpen(true)}
        className="sm:hidden fixed bottom-28 right-6 w-16 h-16 bg-orange-600 hover:bg-orange-700 rounded-full shadow-[0_10px_30px_rgba(249,115,22,0.4)] flex items-center justify-center text-white z-[99] active:scale-90 transition-all border-4 border-slate-900"
        aria-label="Přidat motorku"
      >
        <i className="fas fa-plus text-2xl"></i>
      </button>

      {/* Bike Grid */}
      {bikes.length === 0 ? (
        <div className="bg-slate-800/30 border-2 border-dashed border-slate-700 rounded-[2rem] py-16 text-center space-y-4 px-6 relative z-10">
          <i className="fas fa-motorcycle text-5xl text-slate-700"></i>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Garáž je zatím prázdná</p>
          <button onClick={() => setIsAddModalOpen(true)} className="bg-slate-800 px-6 py-3 rounded-xl border border-slate-700 text-orange-500 font-bold text-sm">ZAPARKUJ TU PRVNÍ MAŠINU</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          {bikes.map(bike => (
            <div key={bike.id} className="bg-slate-800 rounded-[2rem] overflow-hidden border border-slate-700 group shadow-lg hover:border-orange-500/50 transition-all">
              <div className="h-48 relative overflow-hidden">
                <img src={bike.image} alt={bike.model} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent flex justify-between items-start">
                   <h3 className="text-xl font-bold font-brand text-white">{bike.brand} <span className="text-orange-500">{bike.model}</span></h3>
                   <div className="flex gap-2">
                    <button 
                      onClick={() => setEditingBike(bike)}
                      className="bg-slate-900/80 hover:bg-orange-600 w-10 h-10 rounded-xl backdrop-blur-md transition-all flex items-center justify-center border border-slate-700"
                    >
                      <i className="fas fa-edit text-white text-sm"></i>
                    </button>
                    <button 
                      onClick={() => deleteBike(bike.id)}
                      className="bg-red-600/80 hover:bg-red-600 w-10 h-10 rounded-xl backdrop-blur-md transition-all flex items-center justify-center border border-red-900/30"
                    >
                      <i className="fas fa-trash-can text-white text-sm"></i>
                    </button>
                   </div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-700">
                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Stav tachometru</p>
                    <div className="flex items-center gap-2">
                       <input 
                        type="number"
                        value={bike.mileage}
                        onChange={(e) => updateMileage(bike.id, e.target.value)}
                        className="bg-transparent text-orange-500 font-bold text-lg w-24 outline-none focus:text-white transition-colors"
                      />
                      <span className="text-[10px] text-slate-600">KM</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold bg-slate-700/50 px-3 py-1 rounded-full text-slate-400">ROK {bike.year}</span>
                  </div>
                </div>

                <button 
                  onClick={() => handleAnalyze(bike)}
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-orange-600/10 border border-slate-700 hover:border-orange-500/50 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50 mb-6 text-sm"
                >
                  <i className="fas fa-wand-magic-sparkles text-orange-500"></i>
                  {loading ? 'ANALYZUJI...' : 'AI SERVISNÍ ANALÝZA'}
                </button>

                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">Poslední údržba</p>
                  {records.filter(r => r.bikeId === bike.id).length === 0 ? (
                    <p className="text-[10px] text-slate-600 italic bg-slate-900/30 p-3 rounded-xl">Bez servisní historie.</p>
                  ) : (
                    records.filter(r => r.bikeId === bike.id).slice(0, 2).map(record => (
                      <div key={record.id} className="flex justify-between text-[11px] bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                        <span className="font-bold truncate max-w-[120px] text-white">{record.type}</span>
                        <span className="text-slate-500">{record.date}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals and Overlays */}
      {loading && !isAddModalOpen && (
        <div className="fixed top-20 right-6 z-[100] bg-orange-600 text-white px-6 py-3 rounded-2xl shadow-2xl animate-fadeIn flex items-center gap-3 font-bold text-xs uppercase tracking-widest">
           <i className="fas fa-sync-alt animate-spin"></i> Zpracovávám...
        </div>
      )}

      {/* AI Analysis Overlay */}
      {analysis && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-800 w-full max-w-2xl rounded-[2.5rem] border border-orange-500/50 shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
              <div className="flex items-center gap-3">
                <i className="fas fa-robot text-orange-500"></i>
                <h2 className="text-lg font-brand font-bold uppercase tracking-tight text-white">AI DOPORUČENÍ</h2>
              </div>
              <button onClick={() => setAnalysis(null)} className="text-slate-500 hover:text-white transition-colors p-2">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6 max-h-[50vh] overflow-y-auto text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {analysis}
            </div>
            <div className="p-6 bg-slate-900/50 flex justify-center">
              <button onClick={() => setAnalysis(null)} className="w-full bg-orange-600 hover:bg-orange-700 py-4 rounded-xl font-bold transition-all shadow-lg text-white">ZAVŘÍT</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bike Modal */}
      {editingBike && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-800 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] border-t sm:border border-slate-700 shadow-2xl animate-slideUp overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-brand font-bold uppercase tracking-tight text-white">UPRAVIT <span className="text-orange-500">MAŠINU</span></h2>
              <button onClick={() => setEditingBike(null)} className="text-slate-500 hover:text-white p-2"><i className="fas fa-times text-2xl"></i></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-grow bg-slate-800">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Značka</label>
                <input 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 px-4 focus:border-orange-500 outline-none text-sm text-white" 
                  placeholder="Yamaha, Honda, BMW..." 
                  value={editingBike.brand} 
                  onChange={e => setEditingBike({...editingBike, brand: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Model</label>
                <input 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 px-4 focus:border-orange-500 outline-none text-sm text-white" 
                  placeholder="Ténéré, Africa Twin..." 
                  value={editingBike.model} 
                  onChange={e => setEditingBike({...editingBike, model: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Rok</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 px-4 focus:border-orange-500 outline-none text-sm text-white" 
                    value={editingBike.year} 
                    onChange={e => setEditingBike({...editingBike, year: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Nájezd (km)</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 px-4 focus:border-orange-500 outline-none text-sm text-white" 
                    value={editingBike.mileage} 
                    onChange={e => setEditingBike({...editingBike, mileage: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Fotka stroje</label>
                <div className="flex gap-3">
                  <div 
                    className={`flex-grow h-40 bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center overflow-hidden group transition-all ${loading ? 'opacity-50' : ''}`}
                  >
                    {loading ? (
                      <div className="flex flex-col items-center">
                        <i className="fas fa-sync-alt animate-spin text-2xl text-orange-500 mb-2"></i>
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Zpracovávám...</span>
                      </div>
                    ) : editingBike.image ? (
                      <img src={editingBike.image} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-4">
                        <i className="fas fa-motorcycle text-3xl text-slate-700 mb-2"></i>
                        <p className="text-[9px] text-slate-600 font-bold uppercase">Žádná fotka</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => !loading && editBikeCameraInputRef.current?.click()}
                      className="flex-1 bg-slate-900 border border-slate-700 hover:border-orange-500 rounded-2xl px-4 flex flex-col items-center justify-center gap-1 transition-all group"
                    >
                      <i className="fas fa-camera text-slate-500 group-hover:text-orange-500"></i>
                      <span className="text-[8px] font-bold text-slate-500 uppercase">Foťák</span>
                    </button>
                    <button 
                      onClick={() => !loading && editBikeFileInputRef.current?.click()}
                      className="flex-1 bg-slate-900 border border-slate-700 hover:border-orange-500 rounded-2xl px-4 flex flex-col items-center justify-center gap-1 transition-all group"
                    >
                      <i className="fas fa-image text-slate-500 group-hover:text-orange-500"></i>
                      <span className="text-[8px] font-bold text-slate-500 uppercase">Galerie</span>
                    </button>
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={editBikeFileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={(e) => handleFileChange(e, 'edit')} 
                />
                <input 
                  type="file" 
                  ref={editBikeCameraInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  capture="environment"
                  onChange={(e) => handleFileChange(e, 'edit')} 
                />
              </div>
            </div>
            <div className="p-6 bg-slate-900/80 border-t border-slate-700 flex gap-3 shrink-0 pb-10 sm:pb-6">
              <button onClick={() => setEditingBike(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 py-4 rounded-xl font-bold text-xs uppercase tracking-widest text-white transition-all">ZRUŠIT</button>
              <button onClick={handleUpdateBike} className="flex-1 bg-orange-600 hover:bg-orange-500 py-4 rounded-xl font-bold text-xs uppercase tracking-widest text-white shadow-lg shadow-orange-900/20 active:scale-95 transition-all">ULOŽIT ZMĚNY</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bike Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-800 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] border-t sm:border border-slate-700 shadow-2xl animate-slideUp overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-brand font-bold uppercase tracking-tight text-white">NOVÁ <span className="text-orange-500">MAŠINA</span></h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-500 hover:text-white p-2"><i className="fas fa-times text-2xl"></i></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-grow bg-slate-800">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Značka</label>
                <input 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 px-4 focus:border-orange-500 outline-none text-sm text-white" 
                  placeholder="Yamaha, Honda, BMW..." 
                  value={newBike.brand} 
                  onChange={e => setNewBike({...newBike, brand: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Model</label>
                <input 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 px-4 focus:border-orange-500 outline-none text-sm text-white" 
                  placeholder="Ténéré, Africa Twin..." 
                  value={newBike.model} 
                  onChange={e => setNewBike({...newBike, model: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Rok</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 px-4 focus:border-orange-500 outline-none text-sm text-white" 
                    value={newBike.year} 
                    onChange={e => setNewBike({...newBike, year: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Nájezd (km)</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 px-4 focus:border-orange-500 outline-none text-sm text-white" 
                    value={newBike.mileage} 
                    onChange={e => setNewBike({...newBike, mileage: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Fotka stroje</label>
                <div className="flex gap-3">
                  <div 
                    className={`flex-grow h-40 bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center overflow-hidden group transition-all ${loading ? 'opacity-50' : ''}`}
                  >
                    {loading ? (
                      <div className="flex flex-col items-center">
                        <i className="fas fa-sync-alt animate-spin text-2xl text-orange-500 mb-2"></i>
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Zpracovávám...</span>
                      </div>
                    ) : newBike.image ? (
                      <img src={newBike.image} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-4">
                        <i className="fas fa-motorcycle text-3xl text-slate-700 mb-2"></i>
                        <p className="text-[9px] text-slate-600 font-bold uppercase">Žádná fotka</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => !loading && bikeCameraInputRef.current?.click()}
                      className="flex-1 bg-slate-900 border border-slate-700 hover:border-orange-500 rounded-2xl px-4 flex flex-col items-center justify-center gap-1 transition-all group"
                    >
                      <i className="fas fa-camera text-slate-500 group-hover:text-orange-500"></i>
                      <span className="text-[8px] font-bold text-slate-500 uppercase">Foťák</span>
                    </button>
                    <button 
                      onClick={() => !loading && bikeFileInputRef.current?.click()}
                      className="flex-1 bg-slate-900 border border-slate-700 hover:border-orange-500 rounded-2xl px-4 flex flex-col items-center justify-center gap-1 transition-all group"
                    >
                      <i className="fas fa-image text-slate-500 group-hover:text-orange-500"></i>
                      <span className="text-[8px] font-bold text-slate-500 uppercase">Galerie</span>
                    </button>
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={bikeFileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={(e) => handleFileChange(e, 'bike')} 
                />
                <input 
                  type="file" 
                  ref={bikeCameraInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  capture="environment"
                  onChange={(e) => handleFileChange(e, 'bike')} 
                />
              </div>
            </div>
            <div className="p-6 bg-slate-900/80 border-t border-slate-700 flex gap-3 shrink-0 pb-10 sm:pb-6">
              <button onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 py-4 rounded-xl font-bold text-xs uppercase tracking-widest text-white transition-all">ZRUŠIT</button>
              <button onClick={handleAddBike} className="flex-1 bg-orange-600 hover:bg-orange-500 py-4 rounded-xl font-bold text-xs uppercase tracking-widest text-white shadow-lg shadow-orange-900/20 active:scale-95 transition-all">ULOŽIT MAŠINU</button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-fadeIn">
          <div className="bg-slate-800 w-full max-w-md rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-8 border-b border-slate-700 flex justify-between items-center">
               <div>
                  <h2 className="text-xl font-brand font-bold uppercase tracking-tight text-white">MOTO <span className="text-orange-500">CLOUD</span></h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'ok' ? 'bg-green-500' : dbStatus === 'error' ? 'bg-red-500' : 'bg-slate-500 animate-pulse'}`}></div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                      {dbStatus === 'ok' ? 'PŘIPOJENO KE CLOUDU' : dbStatus === 'error' ? 'CHYBA PŘIPOJENÍ (VITE_ PREFIX?)' : 'OVĚŘOVÁNÍ...'}
                    </p>
                  </div>
               </div>
               <button onClick={() => setShowSyncModal(false)} className="text-slate-500 hover:text-white p-2">
                 <i className="fas fa-times text-xl"></i>
               </button>
            </div>
            
            <div className="p-8 space-y-8">
              {!syncCode ? (
                <div className="space-y-6 text-center">
                  <div className="w-20 h-20 bg-orange-600/10 rounded-3xl flex items-center justify-center mx-auto border border-orange-500/20">
                    <i className="fas fa-shield-halved text-orange-500 text-3xl"></i>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-white font-bold">Vstup do komunity</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">Pro vytvoření Rider ID musíš zadat kód komunity, který jsi dostal od administrátora. (Nápověda: MOTOSPIRIT1.0)</p>
                  </div>
                  <div className="space-y-2">
                    <input 
                      type="text"
                      placeholder="Kód komunity (MOTOSPIRIT1.0)"
                      value={communityCode}
                      onChange={e => setCommunityCode(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 px-4 focus:border-orange-500 outline-none text-sm text-white text-center uppercase tracking-widest"
                    />
                  </div>
                  <button 
                    onClick={initSyncCode}
                    className="w-full bg-orange-600 hover:bg-orange-500 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest text-white shadow-lg active:scale-95 transition-all"
                  >
                    GENEROVAT RIDER ID
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-700 text-center space-y-2">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tvé Rider ID</p>
                    <p className="text-2xl font-brand font-bold text-orange-500 tracking-wider select-all cursor-pointer" title="Klikni pro kopírování">{syncCode}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={handleSyncPush}
                      disabled={isSyncing}
                      className="bg-slate-900 hover:bg-slate-700 border border-slate-700 p-6 rounded-3xl flex flex-col items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <i className={`fas ${isSyncing ? 'fa-sync-alt animate-spin' : 'fa-cloud-arrow-up'} text-orange-500 text-xl`}></i>
                      <span className="text-[9px] font-bold text-white uppercase tracking-widest">Odeslat do cloudu</span>
                    </button>
                    <button 
                      onClick={handleSyncPull}
                      disabled={isSyncing}
                      className="bg-slate-900 hover:bg-slate-700 border border-slate-700 p-6 rounded-3xl flex flex-col items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <i className={`fas ${isSyncing ? 'fa-sync-alt animate-spin' : 'fa-cloud-arrow-down'} text-blue-500 text-xl`}></i>
                      <span className="text-[9px] font-bold text-white uppercase tracking-widest">Stáhnout z cloudu</span>
                    </button>
                  </div>

                  <div className="p-4 bg-orange-600/5 rounded-2xl border border-orange-500/10">
                    <p className="text-[9px] text-orange-500/70 leading-relaxed text-center italic">
                      "Zadej toto ID na svém druhém zařízení a klikni na 'Stáhnout', aby se data propojila."
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Máš kód z jiného zařízení?</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Zadej kód..."
                        className="flex-grow bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-orange-500 uppercase"
                        onChange={(e) => {
                           const val = e.target.value.toUpperCase();
                           if (val.length > 5) {
                             localStorage.setItem('motospirit_sync_code', val);
                             setSyncCode(val);
                           }
                        }}
                      />
                    </div>
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

export default Garage;
