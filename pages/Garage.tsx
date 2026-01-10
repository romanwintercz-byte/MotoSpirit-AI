
import React, { useState, useEffect } from 'react';
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

  // --- PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem('motospirit_user', JSON.stringify(user));
    // Dispatch custom event to notify Navbar and other components
    window.dispatchEvent(new Event('storage'));
  }, [user]);

  useEffect(() => localStorage.setItem('motospirit_bikes', JSON.stringify(bikes)), [bikes]);
  useEffect(() => localStorage.setItem('motospirit_records', JSON.stringify(records)), [records]);

  // --- HANDLERS ---
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
      setBikes(bikes.filter(b => b.id !== id));
      setRecords(records.filter(r => r.bikeId !== id));
    }
  };

  const updateMileage = (id: string, newMileage: number) => {
    setBikes(prev => prev.map(b => b.id === id ? { ...b, mileage: newMileage } : b));
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Rider Profile Section */}
      <section className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2.5rem] border border-slate-700 p-8 shadow-xl">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative group">
            <div className="w-28 h-28 rounded-3xl bg-slate-700 flex items-center justify-center text-4xl font-bold shadow-lg shadow-black/40 overflow-hidden border-2 border-orange-500/30">
              {user.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-orange-500">{user.name ? user.name[0].toUpperCase() : <i className="fas fa-user"></i>}</span>
              )}
            </div>
            <button 
              onClick={() => setIsProfileEditing(!isProfileEditing)}
              className="absolute -bottom-2 -right-2 bg-orange-600 hover:bg-orange-500 w-10 h-10 rounded-2xl border-4 border-slate-900 flex items-center justify-center transition-all shadow-lg scale-90 hover:scale-100"
            >
              <i className={`fas ${isProfileEditing ? 'fa-check' : 'fa-camera'} text-white text-sm`}></i>
            </button>
          </div>
          
          <div className="flex-grow text-center md:text-left">
            {isProfileEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn max-w-2xl">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Jméno</label>
                  <input 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 outline-none focus:border-orange-500" 
                    placeholder="Tvé jméno" 
                    value={user.name} 
                    onChange={e => setUser({...user, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Přezdívka</label>
                  <input 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 outline-none focus:border-orange-500" 
                    placeholder="Nickname" 
                    value={user.nickname} 
                    onChange={e => setUser({...user, nickname: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">URL Fotky</label>
                  <input 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 outline-none focus:border-orange-500" 
                    placeholder="https://..." 
                    value={user.avatar || ''} 
                    onChange={e => setUser({...user, avatar: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Styl jízdy</label>
                  <input 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 outline-none focus:border-orange-500" 
                    placeholder="Např. Enduro" 
                    value={user.ridingStyle} 
                    onChange={e => setUser({...user, ridingStyle: e.target.value})}
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-brand font-bold tracking-tight">
                  {user.name || 'Neznámý'} <span className="text-orange-500">"{user.nickname || 'Rider'}"</span>
                </h2>
                <div className="flex flex-wrap justify-center md:justify-start gap-6 mt-3 text-sm text-slate-400 font-semibold uppercase tracking-wider">
                  <span className="flex items-center gap-2"><i className="fas fa-helmet-safety text-orange-500"></i>{user.ridingStyle || 'Road Rider'}</span>
                  <span className="flex items-center gap-2"><i className="fas fa-calendar-check text-orange-500"></i>{user.experienceYears} let v sedle</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Header with Add Button */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold font-brand uppercase tracking-tighter">MOJE <span className="text-orange-500">MAŠINY</span></h1>
          <p className="text-slate-500 text-sm">Garáž hostí {bikes.length} strojů</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-2xl flex items-center gap-2 font-bold transition-all shadow-lg active:scale-95"
        >
          <i className="fas fa-plus"></i> PŘIDAT
        </button>
      </div>

      {/* Bike Grid */}
      {bikes.length === 0 ? (
        <div className="bg-slate-800/30 border-2 border-dashed border-slate-700 rounded-[2.5rem] py-20 text-center space-y-4">
          <i className="fas fa-motorcycle text-6xl text-slate-700"></i>
          <p className="text-slate-500 font-bold uppercase tracking-widest">Garáž je zatím prázdná</p>
          <button onClick={() => setIsAddModalOpen(true)} className="text-orange-500 hover:underline font-bold">Zaparkuj tu první mašinu</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {bikes.map(bike => (
            <div key={bike.id} className="bg-slate-800 rounded-[2rem] overflow-hidden border border-slate-700 group shadow-lg hover:border-orange-500/50 transition-all">
              <div className="h-56 relative overflow-hidden">
                <img src={bike.image} alt={bike.model} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <button 
                  onClick={() => deleteBike(bike.id)}
                  className="absolute top-4 right-4 bg-red-600/80 hover:bg-red-600 p-3 rounded-xl backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
                >
                  <i className="fas fa-trash-can text-white"></i>
                </button>
              </div>
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold font-brand">{bike.brand} <span className="text-orange-500">{bike.model}</span></h3>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Ročník {bike.year}</p>
                  </div>
                  <div className="text-right">
                    <input 
                      type="number"
                      value={bike.mileage}
                      onChange={(e) => updateMileage(bike.id, parseInt(e.target.value) || 0)}
                      className="bg-slate-900 border border-slate-700 rounded-lg py-1 px-3 text-orange-500 font-bold text-xl text-right w-32 outline-none focus:border-orange-500"
                    />
                    <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Stav Tachometru</p>
                  </div>
                </div>

                <button 
                  onClick={() => handleAnalyze(bike)}
                  disabled={loading}
                  className="w-full bg-slate-700 hover:bg-orange-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50 mb-6"
                >
                  <i className="fas fa-wand-magic-sparkles"></i>
                  {loading ? 'Hledám v dokumentaci...' : 'AI SERVISNÍ ANALÝZA'}
                </button>

                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Servisní historie</p>
                  {records.filter(r => r.bikeId === bike.id).length === 0 ? (
                    <p className="text-sm text-slate-400 italic bg-slate-900/50 p-4 rounded-xl border border-slate-700">Zatím žádné záznamy o servisu.</p>
                  ) : (
                    records.filter(r => r.bikeId === bike.id).map(record => (
                      <div key={record.id} className="flex justify-between text-sm bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                        <span className="font-bold">{record.type}</span>
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

      {/* Modals are unchanged below */}
      {analysis && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-800 w-full max-w-2xl rounded-[2.5rem] border border-orange-500/50 shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-8 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="bg-orange-600 p-2 rounded-lg"><i className="fas fa-robot text-white"></i></div>
                <h2 className="text-xl font-brand font-bold uppercase tracking-tight">Doporučení mechanika</h2>
              </div>
              <button onClick={() => setAnalysis(null)} className="text-slate-500 hover:text-white transition-colors">
                <i className="fas fa-times text-2xl"></i>
              </button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto text-slate-300 whitespace-pre-wrap leading-relaxed">
              {analysis}
            </div>
            <div className="p-6 bg-slate-900/50 flex justify-center">
              <button onClick={() => setAnalysis(null)} className="bg-orange-600 hover:bg-orange-700 px-10 py-3 rounded-xl font-bold transition-all">ROZUMÍM</button>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-800 w-full max-w-md rounded-[2.5rem] border border-slate-700 shadow-2xl animate-slideUp overflow-hidden">
            <div className="p-8 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-brand font-bold uppercase tracking-tight">Nová mašina</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Značka</label>
                <input 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 focus:border-orange-500 outline-none" 
                  placeholder="Např. Yamaha" 
                  value={newBike.brand} 
                  onChange={e => setNewBike({...newBike, brand: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Model</label>
                <input 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 focus:border-orange-500 outline-none" 
                  placeholder="Např. Ténéré 700" 
                  value={newBike.model} 
                  onChange={e => setNewBike({...newBike, model: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Rok</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 focus:border-orange-500 outline-none" 
                    value={newBike.year} 
                    onChange={e => setNewBike({...newBike, year: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Najeto (km)</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 focus:border-orange-500 outline-none" 
                    value={newBike.mileage} 
                    onChange={e => setNewBike({...newBike, mileage: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">URL Fotky</label>
                <input 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 focus:border-orange-500 outline-none text-xs" 
                  placeholder="https://..." 
                  value={newBike.image} 
                  onChange={e => setNewBike({...newBike, image: e.target.value})}
                />
              </div>
            </div>
            <div className="p-8 bg-slate-900/50 flex gap-4">
              <button onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-slate-700 py-4 rounded-2xl font-bold">ZRUŠIT</button>
              <button onClick={handleAddBike} className="flex-1 bg-orange-600 py-4 rounded-2xl font-bold">ULOŽIT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Garage;
