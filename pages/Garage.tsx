
import React, { useState, useEffect, useRef } from 'react';
import { Motorcycle, MaintenanceRecord, UserProfile } from '../types';
import { analyzeMaintenance } from '../services/geminiService';

const Garage: React.FC = () => {
  // --- POMOCNÉ FUNKCE PRO IMAGE RESIZING ---
  const resizeImage = (file: File, maxWidth: number = 800): Promise<string> => {
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
            // Uložíme jako JPEG s kvalitou 0.7 pro maximální úsporu místa
            resolve(canvas.toDataURL('image/jpeg', 0.7));
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
    safeParse(safeGetItem('motospirit_user', ''), { name: '', nickname: 'Rider', experienceYears: 0, ridingStyle: 'Road', avatar: '' })
  );

  const [bikes, setBikes] = useState<Motorcycle[]>(() => 
    safeParse(safeGetItem('motospirit_bikes', '[]'), [])
  );

  const [records, setRecords] = useState<MaintenanceRecord[]>(() => 
    safeParse(safeGetItem('motospirit_records', '[]'), [])
  );

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [newBike, setNewBike] = useState<Partial<Motorcycle>>({
    brand: '', model: '', year: new Date().getFullYear(), mileage: 0, image: ''
  });

  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bikeFileInputRef = useRef<HTMLInputElement>(null);

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
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'user' | 'bike') => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      try {
        const compressedBase64 = await resizeImage(file);
        if (target === 'user') {
          setUser(prev => ({ ...prev, avatar: compressedBase64 }));
        } else {
          setNewBike(prev => ({ ...prev, image: compressedBase64 }));
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
            
            <button 
              onClick={() => isProfileEditing ? fileInputRef.current?.click() : setIsProfileEditing(true)}
              className="absolute -bottom-1 -right-1 bg-orange-600 hover:bg-orange-500 w-9 h-9 rounded-xl border-4 border-slate-900 flex items-center justify-center transition-all shadow-lg active:scale-90"
            >
              <i className={`fas ${isProfileEditing ? 'fa-upload' : 'fa-camera'} text-white text-xs`}></i>
            </button>
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
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
                   <h3 className="text-xl font-bold font-brand text-white">{bike.brand} <span className="text-orange-500">{bike.model}</span></h3>
                </div>
                <button 
                  onClick={() => deleteBike(bike.id)}
                  className="absolute top-4 right-4 bg-red-600/80 hover:bg-red-600 w-10 h-10 rounded-xl backdrop-blur-md transition-all sm:opacity-0 group-hover:opacity-100 flex items-center justify-center"
                >
                  <i className="fas fa-trash-can text-white text-sm"></i>
                </button>
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
                <div 
                  onClick={() => !loading && bikeFileInputRef.current?.click()}
                  className={`w-full h-40 bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-orange-500/50 transition-all ${loading ? 'opacity-50' : ''}`}
                >
                  {loading ? (
                    <div className="flex flex-col items-center">
                      <i className="fas fa-sync-alt animate-spin text-2xl text-orange-500 mb-2"></i>
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Zmenšuji fotku...</span>
                    </div>
                  ) : newBike.image ? (
                    <img src={newBike.image} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <i className="fas fa-camera text-3xl text-slate-600 mb-2 group-hover:text-orange-500 transition-colors"></i>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center px-4">Klikni a foť / vyber soubor</span>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={bikeFileInputRef} 
                  className="hidden" 
                  accept="image/*" 
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
    </div>
  );
};

export default Garage;
