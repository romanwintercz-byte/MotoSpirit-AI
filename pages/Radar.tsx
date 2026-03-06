import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getAllPublicProfiles, updateProfileStatus, deleteProfile, sendWave, sendMessageToRider, createRideChallenge, fetchRideChallenges, joinRideChallenge, deleteRideChallenge } from '../services/syncService';
import { Motorcycle, UserProfile, POI, RideChallenge, Expedition } from '../types';
import { searchNearbyPOI } from '../services/geminiService';

interface RiderProfile {
  syncCode: string;
  user: UserProfile;
  bikes: Motorcycle[];
}

const Radar: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'riders' | 'poi' | 'challenges'>('riders');
  
  // Rider Radar State
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(true);
  const [filterStyle, setFilterStyle] = useState<string>('all');
  const [filterParty, setFilterParty] = useState(false);
  const [currentUserSyncCode] = useState(() => localStorage.getItem('motospirit_sync_code') || '');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('motospirit_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [messageModal, setMessageModal] = useState<{ isOpen: boolean, rider: RiderProfile | null, text: string }>({ isOpen: false, rider: null, text: '' });

  // Ride Challenges State
  const [challenges, setChallenges] = useState<RideChallenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [newChallenge, setNewChallenge] = useState<Partial<RideChallenge>>({
    title: '', dateTime: '', meetingPoint: '', style: 'Road', description: ''
  });
  const [savedExpeditions, setSavedExpeditions] = useState<Expedition[]>(() => JSON.parse(localStorage.getItem('spirit_wanderer_trips') || '[]'));
  const [rejectedChallenges, setRejectedChallenges] = useState<string[]>(() => JSON.parse(localStorage.getItem('motospirit_rejected_challenges') || '[]'));
  const [sessionLastView] = useState(() => parseInt(localStorage.getItem('motospirit_last_challenge_view') || '0'));
  const [hasNewChallengesTab, setHasNewChallengesTab] = useState(false);
  const [selectedBikeImage, setSelectedBikeImage] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.createChallenge && location.state?.expedition) {
      setActiveTab('challenges');
      setShowCreateChallenge(true);
      setNewChallenge({
        title: location.state.expedition.name,
        description: `Přidej se na expedici: ${location.state.expedition.name}\n\nTrasa: ${location.state.expedition.totalDistance}\nDní: ${location.state.expedition.days.length}`,
        dateTime: location.state.expedition.startDate,
        meetingPoint: location.state.expedition.days[0].startLocation,
        style: location.state.expedition.tripType === 'ride' ? 'Road' : 'Adventure'
      });
      // Clear state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    const checkNew = () => {
      const lastView = parseInt(localStorage.getItem('motospirit_last_challenge_view') || '0');
      const latest = parseInt(localStorage.getItem('motospirit_latest_challenge_time') || '0');
      setHasNewChallengesTab(latest > lastView);
    };
    checkNew();
    window.addEventListener('new-challenge-alert', checkNew);
    window.addEventListener('challenge-viewed', checkNew);
    return () => {
      window.removeEventListener('new-challenge-alert', checkNew);
      window.removeEventListener('challenge-viewed', checkNew);
    };
  }, []);

  useEffect(() => {
    const handleSyncUpdate = () => {
      const savedUser = localStorage.getItem('motospirit_user');
      setCurrentUser(savedUser ? JSON.parse(savedUser) : null);
      setSavedExpeditions(JSON.parse(localStorage.getItem('spirit_wanderer_trips') || '[]'));
    };
    window.addEventListener('sync-update', handleSyncUpdate);
    return () => window.removeEventListener('sync-update', handleSyncUpdate);
  }, []);

  const toggleFollow = (syncCode: string) => {
    if (!currentUser) return;
    const following = currentUser.following || [];
    const isFollowing = following.includes(syncCode);
    
    const newFollowing = isFollowing 
      ? following.filter(id => id !== syncCode)
      : [...following, syncCode];
      
    const updatedUser = { ...currentUser, following: newFollowing };
    setCurrentUser(updatedUser);
    localStorage.setItem('motospirit_user', JSON.stringify(updatedUser));
    // Trigger storage event for other components and sync
    window.dispatchEvent(new Event('storage'));
  };

  // POI Radar State
  const [pois, setPois] = useState<POI[]>([]);
  const [loadingPOI, setLoadingPOI] = useState(false);
  const [searchLocation, setSearchLocation] = useState('');
  const [searchCategory, setSearchCategory] = useState('benzínky');

  const categories = [
    { id: 'benzínky', label: 'Benzínky', icon: 'fa-gas-pump', color: 'text-orange-500' },
    { id: 'motorkářské hospody', label: 'Hospody', icon: 'fa-utensils', color: 'text-yellow-500' },
    { id: 'moto servisy', label: 'Servisy', icon: 'fa-wrench', color: 'text-blue-500' },
    { id: 'vyhlídky', label: 'Vyhlídky', icon: 'fa-mountain', color: 'text-green-500' },
    { id: 'historické památky', label: 'Památky', icon: 'fa-castle', color: 'text-purple-500' },
  ];

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

  useEffect(() => {
    const loadChallenges = async () => {
      setLoadingChallenges(true);
      const data = await fetchRideChallenges();
      setChallenges(data);
      setLoadingChallenges(false);
      
      if (activeTab === 'challenges') {
        localStorage.setItem('motospirit_last_challenge_view', Date.now().toString());
        window.dispatchEvent(new Event('challenge-viewed'));
      }
    };
    if (activeTab === 'challenges') loadChallenges();

    const handleNewChallenge = () => {
      if (activeTab === 'challenges') {
        loadChallenges();
      }
    };
    window.addEventListener('new-challenge-alert', handleNewChallenge);
    return () => window.removeEventListener('new-challenge-alert', handleNewChallenge);
  }, [activeTab]);

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

  const handleWave = async (rider: RiderProfile) => {
    if (!currentUserSyncCode || !currentUser) return;
    const success = await sendWave(currentUserSyncCode, rider.syncCode, currentUser.nickname);
    if (success) {
      alert(`Pozdrav odeslán jezdci ${rider.user.nickname}! ✌️`);
    }
  };

  const handleSendMessage = async () => {
    if (!currentUserSyncCode || !currentUser || !messageModal.rider || !messageModal.text.trim()) return;
    const success = await sendMessageToRider(currentUserSyncCode, messageModal.rider.syncCode, messageModal.text);
    if (success) {
      alert(`Zpráva odeslána jezdci ${messageModal.rider.user.nickname}! ✉️`);
      setMessageModal({ isOpen: false, rider: null, text: '' });
    } else {
      alert('Něco se pokazilo, zkus to prosím znovu.');
    }
  };

  const handleCreateChallenge = async () => {
    if (!newChallenge.title || !newChallenge.dateTime || !newChallenge.meetingPoint) {
      alert("Vyplň prosím základní údaje výzvy.");
      return;
    }
    const challenge = {
      ...newChallenge,
      id: Date.now().toString(),
      creatorSyncCode: currentUserSyncCode,
      creatorNickname: currentUser?.nickname || 'Jezdec',
      participants: [currentUserSyncCode],
      createdAt: new Date().toISOString()
    };
    const success = await createRideChallenge(challenge);
    if (success) {
      setChallenges([challenge as RideChallenge, ...challenges]);
      setShowCreateChallenge(false);
      setNewChallenge({ title: '', dateTime: '', meetingPoint: '', style: 'Road', description: '' });
    }
  };

  const handleJoinChallenge = async (challenge: RideChallenge) => {
    if (!currentUserSyncCode) return;
    const isJoining = !challenge.participants.includes(currentUserSyncCode);
    const newParticipants = isJoining 
      ? [...challenge.participants, currentUserSyncCode]
      : challenge.participants.filter(p => p !== currentUserSyncCode);
    
    const success = await joinRideChallenge(challenge.id, newParticipants);
    if (success) {
      setChallenges(prev => prev.map(c => c.id === challenge.id ? { ...c, participants: newParticipants } : c));
    }
  };

  const handleDeleteChallenge = async (challenge: RideChallenge) => {
    if (!window.confirm(`Opravdu chceš smazat výzvu "${challenge.title}"?`)) return;
    
    const success = await deleteRideChallenge(challenge.id);
    if (success) {
      setChallenges(prev => prev.filter(c => c.id !== challenge.id));
    } else {
      alert("Nepodařilo se smazat výzvu.");
    }
  };

  const handleRejectChallenge = (challengeId: string) => {
    const updated = [...rejectedChallenges, challengeId];
    setRejectedChallenges(updated);
    localStorage.setItem('motospirit_rejected_challenges', JSON.stringify(updated));
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

  const handleDelete = async (rider: RiderProfile) => {
    if (!currentUser?.isAdmin) return;
    if (!window.confirm(`VAROVÁNÍ: Opravdu chceš trvale vymazat uživatele ${rider.user.nickname} a všechna jeho data? Tato akce je nevratná!`)) return;

    const success = await deleteProfile(rider.syncCode);
    if (success) {
      setRiders(prev => prev.filter(r => r.syncCode !== rider.syncCode));
    } else {
      alert("Nepodařilo se smazat uživatele.");
    }
  };

  const filteredRiders = riders.filter(r => {
    if (filterStyle !== 'all' && r.user.ridingStyle !== filterStyle) return false;
    if (filterParty && !currentUser?.following?.includes(r.syncCode)) return false;
    return true;
  });

  return (
    <div className="space-y-8 pb-20">
      <header className="px-2">
        <h1 className="text-2xl font-bold font-brand uppercase tracking-tighter text-white">MOTO <span className="text-orange-500">RADAR</span></h1>
        <div className="flex gap-4 mt-4 border-b border-slate-700 overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setActiveTab('riders')}
            className={`pb-2 text-[10px] font-bold uppercase tracking-widest transition-all shrink-0 ${activeTab === 'riders' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            KOMUNITNÍ RADAR
          </button>
          <button 
            onClick={() => setActiveTab('challenges')}
            className={`pb-2 text-[10px] font-bold uppercase tracking-widest transition-all shrink-0 relative ${activeTab === 'challenges' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            VÝZVY K JÍZDĚ
            {hasNewChallengesTab && activeTab !== 'challenges' && (
              <span className="absolute top-0 -right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('poi')}
            className={`pb-2 text-[10px] font-bold uppercase tracking-widest transition-all shrink-0 ${activeTab === 'poi' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            MÍSTA V OKOLÍ
          </button>
        </div>
      </header>

      {activeTab === 'riders' ? (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 px-2">
            <select 
              value={filterStyle}
              onChange={e => setFilterStyle(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-[10px] font-bold uppercase text-white outline-none focus:border-orange-500"
            >
              <option value="all">Všechny styly</option>
              <option value="Road">Road</option>
              <option value="Off-road">Off-road</option>
              <option value="Enduro">Enduro</option>
              <option value="Chopper">Chopper</option>
            </select>
            <button 
              onClick={() => setFilterParty(!filterParty)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase border transition-all ${filterParty ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
            >
              {filterParty ? 'MOJE PARTA' : 'VŠICHNI'}
            </button>
          </div>

          {loadingRiders ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
              <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
              <p className="text-slate-500 font-brand uppercase tracking-widest text-xs">Skenuji okolí...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRiders.map(rider => (
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

                  <div className="flex gap-2 mb-6">
                    {rider.syncCode !== currentUserSyncCode && (
                      <>
                        <button 
                          onClick={() => toggleFollow(rider.syncCode)}
                          className={`flex-1 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                            currentUser?.following?.includes(rider.syncCode)
                              ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20'
                              : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-orange-500/50'
                          }`}
                        >
                          <i className={`fas ${currentUser?.following?.includes(rider.syncCode) ? 'fa-check' : 'fa-plus'}`}></i>
                          {currentUser?.following?.includes(rider.syncCode) ? 'V PARTĚ' : 'PŘIDAT'}
                        </button>
                        <button 
                          onClick={() => handleWave(rider)}
                          className="w-10 h-10 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center text-orange-500 hover:border-orange-500 transition-all"
                          title="Pozdravit"
                        >
                          <i className="fas fa-hand-peace"></i>
                        </button>
                        <button 
                          onClick={() => setMessageModal({ isOpen: true, rider, text: '' })}
                          className="w-10 h-10 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center text-blue-500 hover:border-blue-500 transition-all"
                          title="Napsat zprávu"
                        >
                          <i className="fas fa-envelope"></i>
                        </button>
                      </>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">Garáž</p>
                    <div className="flex flex-wrap gap-2">
                      {rider.bikes.length === 0 ? (
                        <span className="text-[10px] text-slate-600 italic">Garáž je prázdná</span>
                      ) : (
                        rider.bikes.map((bike, idx) => (
                          <span 
                            key={idx} 
                            onClick={() => {
                              if (rider.user.publicBikes && bike.image) {
                                setSelectedBikeImage(bike.image);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl border border-slate-700 text-[10px] text-white font-medium flex items-center gap-1 ${rider.user.publicBikes && bike.image ? 'bg-slate-800 hover:bg-slate-700 hover:border-orange-500 cursor-pointer transition-all' : 'bg-slate-900/50'}`}
                          >
                            {bike.brand} {bike.model}
                            {rider.user.publicBikes && bike.image && <i className="fas fa-camera text-orange-500 ml-1"></i>}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {currentUser?.isAdmin && rider.syncCode !== currentUserSyncCode && (
                    <div className="mt-6 pt-6 border-t border-slate-700 flex justify-end gap-2">
                      <button 
                        onClick={() => handleDeactivate(rider)}
                        className={`text-[9px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${rider.user.isDeactivated ? 'bg-green-600/20 text-green-500 hover:bg-green-600/30' : 'bg-orange-600/20 text-orange-500 hover:bg-orange-600/30'}`}
                      >
                        <i className={`fas ${rider.user.isDeactivated ? 'fa-user-check' : 'fa-user-slash'} mr-2`}></i>
                        {rider.user.isDeactivated ? 'Aktivovat' : 'Deaktivovat'}
                      </button>
                      <button 
                        onClick={() => handleDelete(rider)}
                        className="text-[9px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl transition-all bg-red-600/20 text-red-500 hover:bg-red-600/30"
                      >
                        <i className="fas fa-trash-can mr-2"></i>
                        Smazat
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {filteredRiders.length === 0 && (
                <div className="col-span-full text-center py-20 space-y-4">
                  <i className="fas fa-satellite-dish text-5xl text-slate-700"></i>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">V okolí nikdo není...</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeTab === 'challenges' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Aktivní výzvy</h2>
            <button 
              onClick={() => setShowCreateChallenge(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-orange-900/20"
            >
              <i className="fas fa-plus mr-2"></i> NOVÁ VÝZVA
            </button>
          </div>

          {loadingChallenges ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
              <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
              <p className="text-slate-500 font-brand uppercase tracking-widest text-xs">Načítám výzvy...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {challenges
                .filter(c => new Date(c.dateTime).getTime() > Date.now())
                .map(challenge => {
                const isNew = new Date(challenge.createdAt).getTime() > sessionLastView && challenge.creatorSyncCode !== currentUserSyncCode;
                const isRejected = rejectedChallenges.includes(challenge.id);
                const isJoined = challenge.participants.includes(currentUserSyncCode);

                return (
                <div key={challenge.id} className={`bg-slate-800 rounded-[2rem] border p-6 space-y-4 relative overflow-hidden transition-all ${isRejected ? 'opacity-50 grayscale border-slate-700' : 'border-slate-700 hover:border-orange-500/50 group'}`}>
                  {isNew && !isRejected && (
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest animate-pulse">Nová</span>
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-brand font-bold text-white uppercase tracking-tight pr-16">{challenge.title}</h3>
                      <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Od: {challenge.creatorNickname}</p>
                    </div>
                    <div className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-700 text-[9px] font-bold text-slate-400 uppercase">
                      {challenge.style}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-700/50">
                      <p className="text-[8px] text-slate-500 font-bold uppercase mb-1">Kdy</p>
                      <p className="text-xs font-bold text-white">{new Date(challenge.dateTime).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-700/50">
                      <p className="text-[8px] text-slate-500 font-bold uppercase mb-1">Sraz</p>
                      <p className="text-xs font-bold text-white truncate">{challenge.meetingPoint}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{challenge.description}</p>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                    <div className="flex -space-x-2 overflow-hidden">
                      {challenge.participants.map((p, idx) => (
                        <div key={idx} className="inline-block h-8 w-8 rounded-full ring-2 ring-slate-800 bg-slate-700 flex items-center justify-center text-[10px] font-bold text-orange-500 border border-slate-600">
                          {p.slice(0, 1).toUpperCase()}
                        </div>
                      ))}
                      <span className="pl-4 text-[10px] font-bold text-slate-500 uppercase self-center">{challenge.participants.length} JEDE</span>
                    </div>
                    <div className="flex gap-2">
                      {(challenge.creatorSyncCode === currentUserSyncCode || currentUser?.isAdmin) && (
                        <button 
                          onClick={() => handleDeleteChallenge(challenge)}
                          className="px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all bg-red-900/30 text-red-500 hover:bg-red-900/50 border border-red-500/20"
                          title="Smazat výzvu"
                        >
                          <i className="fas fa-trash-can"></i>
                        </button>
                      )}
                      
                      {!isRejected && !isJoined && challenge.creatorSyncCode !== currentUserSyncCode && (
                        <button 
                          onClick={() => handleRejectChallenge(challenge.id)}
                          className="px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all bg-slate-700 text-slate-400 hover:bg-slate-600"
                        >
                          ODMÍTNOUT
                        </button>
                      )}

                      {!isRejected && (
                        <button 
                          onClick={() => handleJoinChallenge(challenge)}
                          className={`px-6 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${
                            isJoined
                              ? 'bg-slate-700 text-slate-400'
                              : 'bg-orange-600 text-white shadow-lg'
                          }`}
                        >
                          {isJoined ? 'ODHLÁSIT' : 'PŘIDAT SE'}
                        </button>
                      )}

                      {isRejected && (
                        <button 
                          onClick={() => {
                            const updated = rejectedChallenges.filter(id => id !== challenge.id);
                            setRejectedChallenges(updated);
                            localStorage.setItem('motospirit_rejected_challenges', JSON.stringify(updated));
                          }}
                          className="px-6 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all bg-slate-700 text-white"
                        >
                          ZRUŠIT ODMÍTNUTÍ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )})}
              {challenges.filter(c => new Date(c.dateTime).getTime() > Date.now()).length === 0 && (
                <div className="col-span-full text-center py-20">
                  <p className="text-slate-600 text-xs uppercase font-bold tracking-widest">Zatím žádné výzvy. Buď první!</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Kde hledat?</label>
              <div className="relative">
                <i className="fas fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 pl-12 pr-4 focus:border-orange-500 outline-none text-sm text-white" 
                  placeholder="Město, region nebo 'moje okolí'..." 
                  value={searchLocation} 
                  onChange={e => setSearchLocation(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Co hledat?</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSearchCategory(cat.id)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
                      searchCategory === cat.id 
                        ? 'bg-orange-600/10 border-orange-500 shadow-lg shadow-orange-900/20' 
                        : 'bg-slate-950 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <i className={`fas ${cat.icon} text-lg ${searchCategory === cat.id ? 'text-orange-500' : 'text-slate-500'}`}></i>
                    <span className={`text-[9px] font-bold uppercase tracking-tight ${searchCategory === cat.id ? 'text-white' : 'text-slate-500'}`}>
                      {cat.label}
                    </span>
                  </button>
                ))}
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
                
                {poi.bikerTip && (
                  <div className="bg-orange-600/10 border border-orange-500/20 p-3 rounded-xl mb-4">
                    <p className="text-[8px] font-bold text-orange-500 uppercase mb-1 flex items-center gap-2">
                      <i className="fas fa-helmet-safety"></i> Biker Tip od AI
                    </p>
                    <p className="text-[10px] text-slate-300 italic leading-tight">{poi.bikerTip}</p>
                  </div>
                )}

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

      {/* Create Challenge Modal */}
      {showCreateChallenge && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-fadeIn">
          <div className="bg-slate-800 w-full max-w-md rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-8 border-b border-slate-700 flex justify-between items-center">
               <h2 className="text-xl font-brand font-bold uppercase tracking-tight text-white">VYTVOŘIT <span className="text-orange-500">VÝZVU</span></h2>
               <button onClick={() => setShowCreateChallenge(false)} className="text-slate-500 hover:text-white p-2">
                 <i className="fas fa-times text-xl"></i>
               </button>
            </div>
            <div className="p-8 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Název vyjížďky</label>
                <input 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:border-orange-500 outline-none"
                  placeholder="Např. Odpolední kafe na Šumavě"
                  value={newChallenge.title}
                  onChange={e => setNewChallenge({...newChallenge, title: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Kdy (Datum a čas)</label>
                  <div className="relative">
                    <input 
                      type="datetime-local"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:border-orange-500 outline-none [&::-webkit-calendar-picker-indicator]:filter-[invert(1)] [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      value={newChallenge.dateTime}
                      onChange={e => setNewChallenge({...newChallenge, dateTime: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Styl</label>
                  <select 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:border-orange-500 outline-none"
                    value={newChallenge.style}
                    onChange={e => setNewChallenge({...newChallenge, style: e.target.value})}
                  >
                    <option value="Road">Road</option>
                    <option value="Off-road">Off-road</option>
                    <option value="Chill">Chill</option>
                    <option value="Fast">Fast</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Místo srazu</label>
                <input 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:border-orange-500 outline-none"
                  placeholder="Např. Benzina Strakonická"
                  value={newChallenge.meetingPoint}
                  onChange={e => setNewChallenge({...newChallenge, meetingPoint: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Popis</label>
                <textarea 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:border-orange-500 outline-none h-24 resize-none"
                  placeholder="Detaily trasy, tempo, atd..."
                  value={newChallenge.description}
                  onChange={e => setNewChallenge({...newChallenge, description: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Připojit trasu (volitelné)</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:border-orange-500 outline-none"
                  onChange={e => {
                    const ex = savedExpeditions.find(x => x.id === e.target.value);
                    setNewChallenge({...newChallenge, route: ex});
                  }}
                >
                  <option value="">Žádná trasa</option>
                  {savedExpeditions.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
              </div>
              <button 
                onClick={handleCreateChallenge}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl shadow-orange-900/20 mt-4"
              >
                VYHLÁSIT VÝZVU
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: Bike Image */}
      {selectedBikeImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fadeIn" onClick={() => setSelectedBikeImage(null)}>
          <div className="relative w-full max-w-lg animate-slideUp" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedBikeImage(null)} 
              className="absolute -top-12 right-0 text-white p-2 text-xl font-bold flex items-center gap-2"
            >
              <i className="fas fa-times"></i> ZAVŘÍT
            </button>
            <img src={selectedBikeImage} alt="Bike" className="w-full h-auto rounded-2xl shadow-2xl border border-slate-700" />
          </div>
        </div>
      )}

      {/* MODAL: Send Message */}
      {messageModal.isOpen && messageModal.rider && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setMessageModal({ isOpen: false, rider: null, text: '' })}>
          <div className="bg-slate-900 border border-slate-700 rounded-[2rem] p-6 w-full max-w-md animate-slideUp shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-brand font-bold text-white uppercase tracking-tight flex items-center gap-3">
                <i className="fas fa-envelope text-blue-500"></i> Nová zpráva
              </h2>
              <button onClick={() => setMessageModal({ isOpen: false, rider: null, text: '' })} className="text-slate-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full bg-slate-800">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Komu</label>
                <div className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white mt-1 font-bold">
                  {messageModal.rider.user.nickname}
                </div>
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Zpráva</label>
                <textarea 
                  rows={4}
                  value={messageModal.text}
                  onChange={e => setMessageModal({ ...messageModal, text: e.target.value })}
                  placeholder="Napiš zprávu..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 outline-none focus:border-blue-500 text-sm text-white mt-1 resize-none"
                ></textarea>
              </div>

              <button 
                onClick={handleSendMessage}
                disabled={!messageModal.text.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                <i className="fas fa-paper-plane"></i> ODESLAT ZPRÁVU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Radar;
