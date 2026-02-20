import React, { useState, useEffect } from 'react';
import { getAllPublicProfiles, updateProfileStatus } from '../services/syncService';
import { Motorcycle, UserProfile } from '../types';

interface RiderProfile {
  syncCode: string;
  user: UserProfile;
  bikes: Motorcycle[];
}

const Radar: React.FC = () => {
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserSyncCode] = useState(() => localStorage.getItem('motospirit_sync_code') || '');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('motospirit_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const fetchRiders = async () => {
      setLoading(true);
      const data = await getAllPublicProfiles();
      // Filter: only public profiles, unless current user is admin
      const filtered = data.filter(r => {
        if (currentUser?.isAdmin) return true;
        return r.user.isPublic && !r.user.isDeactivated;
      });
      setRiders(filtered);
      setLoading(false);
    };
    fetchRiders();
  }, [currentUser]);

  const handleDeactivate = async (rider: RiderProfile) => {
    if (!currentUser?.isAdmin) return;
    if (!window.confirm(`Opravdu chceš deaktivovat uživatele ${rider.user.nickname}?`)) return;

    const updatedUser = { ...rider.user, isDeactivated: !rider.user.isDeactivated };
    const success = await updateProfileStatus(rider.syncCode, updatedUser);
    if (success) {
      setRiders(prev => prev.map(r => r.syncCode === rider.syncCode ? { ...r, user: updatedUser } : r));
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
      <p className="text-slate-500 font-brand uppercase tracking-widest text-xs">Skenuji okolí...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <header className="px-2">
        <h1 className="text-2xl font-bold font-brand uppercase tracking-tighter text-white">RIDER <span className="text-orange-500">RADAR</span></h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Komunita MotoSpirit ({riders.length} jezdců)</p>
      </header>

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
      </div>

      {riders.length === 0 && (
        <div className="text-center py-20 space-y-4">
          <i className="fas fa-satellite-dish text-5xl text-slate-700"></i>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">V okolí nikdo není...</p>
        </div>
      )}
    </div>
  );
};

export default Radar;
