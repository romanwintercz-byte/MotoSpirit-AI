
import React, { useState, useEffect, useRef } from 'react';
import { Motorcycle, MaintenanceRecord, UserProfile } from '../types';
import { analyzeMaintenance } from '../services/geminiService';

const Garage: React.FC = () => {
  // --- STATE ---
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('motospirit_user');
    return saved ? JSON.parse(saved) : { name: '', nickname: 'Rider', experienceYears: 0, ridingStyle: 'Road', avatar: '' };
  });

  const [bikes, setBikes] = useState<Motorcycle[]>(() => {
    const saved = localStorage.getItem('motospirit_bikes');
    return saved ? JSON.parse(saved) : [];
  });

  const [records, setRecords] = useState<MaintenanceRecord[]>(() => {
    const saved = localStorage.getItem('motospirit_records');
    return saved ? JSON.parse(saved) : [];
  });

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
    localStorage.setItem('motospirit_user', JSON.stringify(user));
    window.dispatchEvent(new Event('storage'));
  }, [user]);

  useEffect(() => localStorage.setItem('motospirit_bikes', JSON.stringify(bikes)), [bikes]);
  useEffect(() => localStorage.setItem('motospirit_records', JSON.stringify(records)), [records]);

  // Listen for storage changes (to sync mileage from Logbook)
  useEffect(() => {
    const sync = () => {
      const savedBikes = localStorage.getItem('motospirit_bikes');
      if (savedBikes) setBikes(JSON.parse(savedBikes));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  // --- HANDLERS ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'user' | 'bike') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (target === 'user') {
          setUser(prev => ({ ...prev, avatar: base64 }));
        } else {
          setNewBike(prev => ({ ...prev, image: base64 }));
        }
      };
      reader.readAsDataURL(file);
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
    if (!newBike.brand || !newBike.model) return;
    const bikeToAdd: Motorcycle = {
      id: Date.now().toString(),
      brand: newBike.brand || '',
      model: newBike.model || '',
      year: Number(newBike.year) || 2024,
      mileage: Number(newBike.mileage) || 0,
      image: newBike.image || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80'
    };
    setBikes([...bikes, bikeToAdd]);
    setNewBike({ brand: '', model: '', year: 2024, mileage: 0, image: '' });
    setIsAddModalOpen(false);
  };

  const deleteBike = (id: string) => {
    if (window.confirm("Opravdu chceš tuhle mašinu vyřadit z garáže?")) {
      const updatedBikes = bikes.filter(b => b.id !== id);
      setBikes(updatedBikes);
      const updatedRecords = records.filter(r => r.bikeId !== id);
      setRecords(updatedRecords);
    }
  };

  const updateMileage = (id: string, newMileage: number) => {
    setBikes(prev => prev.map(b => b.id === id ? { ...b, mileage: newMileage } : b));
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Rider Profile Section */}
      <section className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] border border-slate-700 p-6 shadow-xl">
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
                    <h2 className="text-2xl font-brand font-bold tracking-tight">
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
                  className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-xl font-bold transition-all text-xs"
                >
                  ULOŽIT PROFIL
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Header Section */}
      <div className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-2xl font-bold font-brand uppercase tracking-tighter">MOJE <span className="text-orange-500">MAŠINY</span></h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Garáž hostí {bikes.length} strojů</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="hidden sm:flex bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-xl items-center gap-2 font-bold transition-all shadow-lg active:scale-95"
        >
          <i className="fas fa-plus"></i> PŘIDAT
        </button>
      </div>

      {/* Mobile Floating Action Button */}
      <button 
        onClick={() => setIsAddModalOpen(true)}
        className="sm:hidden fixed bottom-24 right-6 w-14 h-14 bg-orange-600 hover:bg-orange-700 rounded-full shadow-2xl flex items-center justify-center text-white z-[60] active:scale-90 transition-all border-4 border-slate-900"
        aria-label="Přidat motorku"
      >
        <i className="fas fa-plus text-xl"></i>
      </button>

      {/* Bike Grid */}
      {bikes.length === 0 ? (
        <div className="bg-slate-800/30 border-2 border-dashed border-slate-700 rounded-[2rem] py-16 text-center space-y-4 px-6">
          <i className="fas fa-motorcycle text-5xl text-slate-700"></i>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Garáž je zatím prázdná</p>
          <button onClick={() => setIsAddModalOpen(true)} className="bg-slate-800 px-6 py-3 rounded-xl border border-slate-700 text-orange-500 font-bold text-sm">ZAPARKUJ TU PRVNÍ MAŠINU</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bikes.map(bike => (
            <div key={bike.id} className="bg-slate-800 rounded-[2rem] overflow-hidden border border-slate-700 group shadow-lg hover:border-orange-500/50 transition-all">
              <div className="h-48 relative overflow-hidden">
                <img src={bike.image} alt={bike.model} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
                   <h3 className="text-xl font-bold font-brand text-white">{bike.brand} <span className="text-orange-500">{bike.model}</span></h3>
                </div>
                <button 
                  onClick={() => deleteBike(bike.id)}
                  className="absolute top-4 right-4 bg-red-600/80 hover:bg-red-600 p-2.5 rounded-xl backdrop-blur-md transition-all sm:opacity-0 group-hover:opacity-100"
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
                        onChange={(e) => updateMileage(bike.id, parseInt(e.target.value) || 0)}
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
                        <span className="font-bold truncate max-w-[120px]">{record.type}</span>
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

      {/* AI Analysis Overlay */}
      {analysis && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-800 w-full max-w-2xl rounded-[2.5rem] border border-orange-500/50 shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
              <div className="flex items-center gap-3">
                <i className="fas fa-robot text-orange-500"></i>
                <h2 className="text-lg font-brand font-bold uppercase tracking-tight">AI DOPORUČENÍ</h2>
              </div>
              <button onClick={() => setAnalysis(null)} className="text-slate-500 hover:text-white transition-colors">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6 max-h-[50vh] overflow-y-auto text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {analysis}
            </div>
            <div className="p-6 bg-slate-900/50 flex justify-center">
              <button onClick={() => setAnalysis(null)} className="w-full bg-orange-600 hover:bg-orange-700 py-4 rounded-xl font-bold transition-all shadow-lg">ZAVŘÍT</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bike Modal - Mobile Optimized */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-800 w-full max-w-md rounded-[2.5rem] border border-slate-700 shadow-2xl animate-slideUp overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-brand font-bold uppercase tracking-tight">NOVÁ <span className="text-orange-500">MAŠINA</span></h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-500 hover:text-white p-2"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-grow">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Značka</label>
                <input 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 focus:border-orange-500 outline-none text-sm" 
                  placeholder="Yamaha, Honda, BMW..." 
                  value={newBike.brand} 
                  onChange={e => setNewBike({...newBike, brand: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Model</label>
                <input 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 focus:border-orange-500 outline-none text-sm" 
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 focus:border-orange-500 outline-none text-sm" 
                    value={newBike.year} 
                    onChange={e => setNewBike({...newBike, year: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Nájezd (km)</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 focus:border-orange-500 outline-none text-sm" 
                    value={newBike.mileage} 
                    onChange={e => setNewBike({...newBike, mileage: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Fotka stroje</label>
                <div 
                  onClick={() => bikeFileInputRef.current?.click()}
                  className="w-full h-32 bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-orange-500/50 transition-all"
                >
                  {newBike.image ? (
                    <img src={newBike.image} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <i className="fas fa-camera text-2xl text-slate-600 mb-1 group-hover:text-orange-500 transition-colors"></i>
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Klikni a foť / vyber soubor</span>
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
            <div className="p-6 bg-slate-900/50 flex gap-3 shrink-0">
              <button onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-slate-700 py-4 rounded-xl font-bold text-xs uppercase tracking-widest">ZRUŠIT</button>
              <button onClick={handleAddBike} className="flex-1 bg-orange-600 py-4 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-900/20 active:scale-95 transition-all">ULOŽIT MAŠINU</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Garage;
