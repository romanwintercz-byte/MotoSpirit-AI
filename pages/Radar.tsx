import React, { useState, useEffect } from 'react';
import { getAllPublicProfiles, updateProfileStatus } from '../services/syncService';
import { Motorcycle, UserProfile, POI } from '../types';
import { searchNearbyPOI } from '../services/geminiService';

interface RiderProfile {
  syncCode: string;
  user: UserProfile;
  bikes: Motorcycle[];
}

const Radar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'riders' | 'poi'>('riders');
  
  // Rider Radar State
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(true);
  const [currentUserSyncCode] = useState(() => localStorage.getItem('motospirit_sync_code') || '');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('motospirit_user');
    return saved ? JSON.parse(saved) : null;
  });

  // POI Radar State
  const [pois, setPois] = useState<POI[]>([]);
  const [loadingPOI, setLoadingPOI] = useState(false);
  const [searchLocation, setSearchLocation] = useState('');
  const [searchCategory, setSearchCategory] = useState('benzínky a motorkářské hospody');

  useEffect(() => {
    const fetchRiders = async () => {
      setLoadingRiders(true);
      const data = await getAllPublicProfiles();
      const filtered = data.filter(r => {
        if (currentUser?.isAdmin) return true;
        return r.user.isPublic && !r.user.isDeactivated;
      });
      setRiders(filtered);
      setLoadingRiders(false);
    };
    if (activeTab === 'riders') fetchRiders();
  }, [currentUser, activeTab]);

  const handleSearchPOI = async () => {
    setLoadingPOI(true);
    try {
      const results = await searchNearbyPOI(searchCategory, undefined, undefined, searchLocation || 'v mém okolí');
      setPois(results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPOI(false);
    }
  };

  const handleDeactivate = async (rider: RiderProfile) => {
    if (!currentUser?.isAdmin) return;
    if (!window.confirm(`Opravdu chceš deaktivovat uživatele ${rider.user.nickname}?`)) return;

    const updatedUser = { ...rider.user, isDeactivated: !rider.user.isDeactivated };
    const success = await updateProfileStatus(rider.syncCode, updatedUser);
    if (success) {
      setRiders(prev => prev.map(r => r.syncCode === rider.syncCode ? { ...r, user: updatedUser } : r));
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="px-2">
        <h1 className="text-2xl font-bold font-brand uppercase tracking-tighter text-white">MOTO <span className="text-orange-500">RADAR</span></h1>
        <div className="flex gap-4 mt-4 border-b border-slate-700">
          <button 
            onClick={() => setActiveTab('riders')}
            className={`pb-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'riders' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            KOMUNITNÍ RADAR
          </button>
          <button 
            onClick={() => setActiveTab('poi')}
            className={`pb-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'poi' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            MÍSTA V OKOLÍ
          </button>
        </div>
      </header>

      {activeTab === 'riders' ? (
        loadingRiders ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
            <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
            <p className="text-slate-500 font-brand uppercase tracking-widest text-xs">Skenuji okolí...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {riders.map(rider => (
              <div 
                key={rider.syncCode} 
                className={`bg-slate-800 rounded-[2rem] border p-6 transition-all relative overflow-hidden group ${rider.user.isDeactivated ? 'opacity-50 grayscale border-red-900/50' : 'border-slate-700 hover:border-orange-500/50 shadow-xl'}`}
              >
                {rider.user.isAdmin && (
                  <div className="absolute top-4 right-4 bg-orange-600/20 text-orange-500 px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-widest border border-orange-500/30">
                    ADMIN
                  </div>
                )}
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center text-xl font-bold overflow-hidden border border-slate-600">
                    {rider.user.avatar ? (
                      <img src={rider.user.avatar} alt={rider.user.nickname} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-orange-500">{rider.user.nickname[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-brand font-bold text-white leading-tight">
                      {rider.user.nickname}
                      {rider.syncCode === currentUserSyncCode && <span className="text-orange-500 ml-2 text-xs">(TY)</span>}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{rider.user.ridingStyle || 'Road'} Rider</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">Garáž</p>
                  <div className="flex flex-wrap gap-2">
                    {rider.bikes.length === 0 ? (
                      <span className="text-[10px] text-slate-600 italic">Garáž je prázdná</span>
                    ) : (
                      rider.bikes.map((bike, idx) => (
                        <span key={idx} className="bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-700 text-[10px] text-white font-medium">
                          {bike.brand} {bike.model}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {currentUser?.isAdmin && rider.syncCode !== currentUserSyncCode && (
                  <div className="mt-6 pt-6 border-t border-slate-700 flex justify-end">
                    <button 
                      onClick={() => handleDeactivate(rider)}
                      className={`text-[9px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${rider.user.isDeactivated ? 'bg-green-600/20 text-green-500' : 'bg-red-600/20 text-red-500'}`}
                    >
                      <i className={`fas ${rider.user.isDeactivated ? 'fa-user-check' : 'fa-user-slash'} mr-2`}></i>
                      {rider.user.isDeactivated ? 'Aktivovat' : 'Deaktivovat'}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {riders.length === 0 && (
              <div className="col-span-full text-center py-20 space-y-4">
                <i className="fas fa-satellite-dish text-5xl text-slate-700"></i>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">V okolí nikdo není...</p>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Kde hledat?</label>
                <input 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 focus:border-orange-500 outline-none text-sm text-white" 
                  placeholder="Město, region nebo 'moje okolí'..." 
                  value={searchLocation} 
                  onChange={e => setSearchLocation(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Co hledat?</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 focus:border-orange-500 outline-none text-sm text-white appearance-none"
                  value={searchCategory}
                  onChange={e => setSearchCategory(e.target.value)}
                >
                  <option value="benzínky a motorkářské hospody">Benzínky a hospody</option>
                  <option value="zajímavá vyhlídková místa">Vyhlídky a body zájmu</option>
                  <option value="moto servisy a prodejny">Servisy a moto prodejny</option>
                  <option value="motorkářské kempy a ubytování">Kempy a ubytování</option>
                </select>
              </div>
            </div>
            <button 
              onClick={handleSearchPOI}
              disabled={loadingPOI}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50 shadow-lg"
            >
              <i className={`fas ${loadingPOI ? 'fa-sync-alt animate-spin' : 'fa-search'}`}></i>
              {loadingPOI ? 'SKENUJI TERÉN...' : 'AKTIVOVAT RADAR'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pois.map((poi, idx) => (
              <div key={idx} className="bg-slate-800/50 rounded-[2rem] border border-slate-700 p-6 hover:border-orange-500/30 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-orange-600/10 w-10 h-10 rounded-xl flex items-center justify-center text-orange-500">
                    <i className={`fas ${poi.type === 'gas' ? 'fa-gas-pump' : poi.type === 'food' ? 'fa-utensils' : 'fa-map-pin'}`}></i>
                  </div>
                  {poi.rating && (
                    <div className="flex items-center gap-1 text-orange-500 text-xs font-bold">
                      <i className="fas fa-star"></i> {poi.rating}
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-brand font-bold text-white mb-2">{poi.name}</h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">{poi.description}</p>
                {poi.url && (
                  <a 
                    href={poi.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-orange-500 text-[10px] font-bold uppercase tracking-widest hover:underline flex items-center gap-2"
                  >
                    Zobrazit na mapě <i className="fas fa-external-link-alt text-[8px]"></i>
                  </a>
                )}
              </div>
            ))}
            {!loadingPOI && pois.length === 0 && (
              <div className="col-span-full text-center py-10">
                <p className="text-slate-600 text-xs uppercase font-bold tracking-widest">Radar je v pohotovosti. Zadej lokalitu a hledej.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Radar;
