import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { getAllPublicProfiles, updateProfileStatus, deleteProfile, createRideChallenge, fetchRideChallenges, joinRideChallenge, deleteRideChallenge, updateRideChallenge, syncDataToCloud } from '../services/syncService';
import { Motorcycle, UserProfile, POI, RideChallenge, Expedition, ChallengeMessage } from '../types';
import { searchNearbyPOI } from '../services/geminiService';

interface RiderProfile {
  syncCode: string;
  user: UserProfile;
  bikes: Motorcycle[];
}

interface MotoEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  location: string;
  distance: string;
  image: string;
  type: string;
  attendees: number;
  isAttending: boolean;
  description: string;
}

const mockEvents: MotoEvent[] = [
  {
    id: '1',
    title: 'EuroBikeFest 2026',
    date: '2026-05-21',
    endDate: '2026-05-24',
    location: 'Pasohlávky, ATC Merkur',
    distance: '120 km',
    image: 'https://picsum.photos/seed/eurobike/600/300',
    type: 'Sraz',
    attendees: 142,
    isAttending: false,
    description: 'Největší motofestival v ČR. Koncerty, kaskadéři, custom bikes a tisíce motorek.'
  },
  {
    id: '2',
    title: 'Prague Harley Days',
    date: '2026-09-04',
    endDate: '2026-09-06',
    location: 'Výstaviště Holešovice, Praha',
    distance: '15 km',
    image: 'https://picsum.photos/seed/harley/600/300',
    type: 'Výstava',
    attendees: 356,
    isAttending: true,
    description: 'Tradiční setkání majitelů a příznivců značky Harley-Davidson. Spanilá jízda Prahou.'
  },
  {
    id: '3',
    title: 'Zahájení sezóny Poděbrady',
    date: '2026-04-04',
    location: 'Lázeňská kolonáda, Poděbrady',
    distance: '65 km',
    image: 'https://picsum.photos/seed/podebrady/600/300',
    type: 'Sraz',
    attendees: 890,
    isAttending: false,
    description: 'Tradiční první jarní setkání motorkářů na kolonádě v Poděbradech.'
  },
  {
    id: '4',
    title: 'Hořice - 300 zatáček',
    date: '2026-05-16',
    endDate: '2026-05-17',
    location: 'Hořice v Podkrkonoší',
    distance: '105 km',
    image: 'https://picsum.photos/seed/horice/600/300',
    type: 'Závod',
    attendees: 210,
    isAttending: false,
    description: 'Legendární road racingový závod na přírodním okruhu.'
  }
];

const Radar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'riders' | 'poi' | 'challenges' | 'events'>('riders');
  
  // Events State
  const [events, setEvents] = useState<MotoEvent[]>([...mockEvents]);
  const [eventFilterTime, setEventFilterTime] = useState('all');
  const [eventFilterType, setEventFilterType] = useState('all');
  const [eventSearchLocation, setEventSearchLocation] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<MotoEvent | null>(null);

  const toggleEventAttendance = (eventId: string) => {
    setEvents(prev => prev.map(e => {
      if (e.id === eventId) {
        const newIsAttending = !e.isAttending;
        return { ...e, isAttending: newIsAttending, attendees: e.attendees + (newIsAttending ? 1 : -1) };
      }
      return e;
    }));
    if (selectedEvent?.id === eventId) {
      setSelectedEvent(prev => prev ? { ...prev, isAttending: !prev.isAttending, attendees: prev.attendees + (!prev.isAttending ? 1 : -1) } : null);
    }
  };

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
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [newMessageText, setNewMessageText] = useState((() => {
    const text: Record<string, string> = {};
    return text;
  })());

  useEffect(() => {
    if (location.state?.createChallenge && location.state?.expedition) {
      setActiveTab('challenges');
      setShowCreateChallenge(true);
      setNewChallenge({
        title: location.state.expedition.name,
        description: `Přidej se na expedici: ${location.state.expedition.name}\n\nTrasa: ${location.state.expedition.totalDistance}\nDní: ${location.state.expedition.days.length}`,
        dateTime: location.state.expedition.startDate ? (location.state.expedition.startDate.includes('T') ? location.state.expedition.startDate : `${location.state.expedition.startDate}T10:00`) : '',
        meetingPoint: location.state.expedition.days[0].startLocation,
        style: location.state.expedition.tripType === 'ride' ? 'Road' : 'Adventure',
        audience: location.state.audience || 'all',
        invitedSyncCodes: []
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
        const isAdmin = currentUser?.isAdmin || currentUser?.email?.toLowerCase() === 'roman.winter.cz@gmail.com';
        if (isAdmin) return true;
        return r.user.isPublic && !r.user.isDeactivated;
      });
      setRiders(filtered);
      setLoadingRiders(false);
    };
    if (activeTab === 'riders' || (showCreateChallenge && newChallenge.audience === 'selected')) {
      if (riders.length === 0) fetchRiders();
    }
  }, [currentUser, activeTab, showCreateChallenge, newChallenge.audience]);

  useEffect(() => {
    const handleStorageChange = () => {
      setSavedExpeditions(JSON.parse(localStorage.getItem('spirit_wanderer_trips') || '[]'));
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sync-update', handleStorageChange);
    
    // Initial fetch on mount
    handleStorageChange();

    const loadChallenges = async () => {
      setLoadingChallenges(true);
      const data = await fetchRideChallenges();
      setChallenges(data);
      setLoadingChallenges(false);
      
      const mySyncCode = localStorage.getItem('motospirit_sync_code');
      if (mySyncCode) {
        const existingTrips = JSON.parse(localStorage.getItem('spirit_wanderer_trips') || '[]');
        let tripsUpdated = false;
        let newTrips = [...existingTrips];
        
        data.forEach((c: RideChallenge) => {
          if (c.route && c.participants.includes(mySyncCode)) {
            const expeditionToSave: Expedition = { ...c.route, id: `challenge-${c.id}-route`, linkedChallengeId: c.id };
            const tripIndex = newTrips.findIndex((e: Expedition) => e.linkedChallengeId === c.id);
            if (tripIndex >= 0) {
              if (JSON.stringify(newTrips[tripIndex]) !== JSON.stringify(expeditionToSave)) {
                newTrips[tripIndex] = expeditionToSave;
                tripsUpdated = true;
              }
            } else {
              newTrips = [expeditionToSave, ...newTrips];
              tripsUpdated = true;
            }
          }
        });
        
        if (tripsUpdated) {
          localStorage.setItem('spirit_wanderer_trips', JSON.stringify(newTrips));
          window.dispatchEvent(new Event('storage'));
        }
      }
      
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
    return () => {
      window.removeEventListener('new-challenge-alert', handleNewChallenge);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sync-update', handleStorageChange);
    };
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
      
      if (challenge.route) {
        const existingTrips = JSON.parse(localStorage.getItem('spirit_wanderer_trips') || '[]');
        if (isJoining) {
          const expeditionToSave: Expedition = { ...challenge.route, id: `challenge-${challenge.id}-route`, linkedChallengeId: challenge.id };
          const tripIndex = existingTrips.findIndex((e: Expedition) => e.linkedChallengeId === challenge.id);
          if (tripIndex >= 0) {
            existingTrips[tripIndex] = expeditionToSave;
            localStorage.setItem('spirit_wanderer_trips', JSON.stringify(existingTrips));
          } else {
            localStorage.setItem('spirit_wanderer_trips', JSON.stringify([expeditionToSave, ...existingTrips]));
          }
          // Force cloud sync to ensure TripPlanner and App.tsx are aligned instantly
          window.dispatchEvent(new Event('storage'));
          syncDataToCloud(currentUserSyncCode, { 
             user: JSON.parse(localStorage.getItem('motospirit_user') || '{}'),
             bikes: JSON.parse(localStorage.getItem('motospirit_bikes') || '[]'),
             records: JSON.parse(localStorage.getItem('motospirit_records') || '[]'),
             fuel: JSON.parse(localStorage.getItem('motospirit_fuel') || '[]'),
             expeditions: JSON.parse(localStorage.getItem('spirit_wanderer_trips') || '[]')
          });
        } else {
          const filteredTrips = existingTrips.filter((e: Expedition) => e.linkedChallengeId !== challenge.id);
          localStorage.setItem('spirit_wanderer_trips', JSON.stringify(filteredTrips));
          window.dispatchEvent(new Event('storage'));
          syncDataToCloud(currentUserSyncCode, { 
             user: JSON.parse(localStorage.getItem('motospirit_user') || '{}'),
             bikes: JSON.parse(localStorage.getItem('motospirit_bikes') || '[]'),
             records: JSON.parse(localStorage.getItem('motospirit_records') || '[]'),
             fuel: JSON.parse(localStorage.getItem('motospirit_fuel') || '[]'),
             expeditions: JSON.parse(localStorage.getItem('spirit_wanderer_trips') || '[]')
          });
        }
      }
    }
  };

  const handleDeleteChallenge = async (challenge: RideChallenge) => {
    if (challenge.creatorSyncCode !== currentUserSyncCode) {
      if (!window.confirm(`[ADMIN] Opravdu chceš smazat výzvu "${challenge.title}" i všem ostatním uživatelům? Globální smazání!`)) return;
    } else {
      if (!window.confirm(`Opravdu chceš smazat výzvu "${challenge.title}"?`)) return;
    }
    
    const success = await deleteRideChallenge(challenge.id);
    if (success) {
      setChallenges(prev => prev.filter(c => c.id !== challenge.id));
      
      const existingTrips = JSON.parse(localStorage.getItem('spirit_wanderer_trips') || '[]');
      const filteredTrips = existingTrips.filter((e: Expedition) => e.linkedChallengeId !== challenge.id);
      localStorage.setItem('spirit_wanderer_trips', JSON.stringify(filteredTrips));
    } else {
      alert("Nepodařilo se smazat výzvu.");
    }
  };

  const handleSendMessage = async (challengeId: string) => {
    const text = newMessageText[challengeId]?.trim();
    if (!text || !currentUserSyncCode) return;

    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) return;

    const msg: ChallengeMessage = {
      id: Date.now().toString(),
      syncCode: currentUserSyncCode,
      nickname: currentUser?.nickname || 'Neznámý',
      text,
      createdAt: new Date().toISOString()
    };

    const updatedChallenge = {
      ...challenge,
      messages: [...(challenge.messages || []), msg]
    };

    const success = await updateRideChallenge(challengeId, updatedChallenge);
    if (success) {
      setChallenges(prev => prev.map(c => c.id === challengeId ? updatedChallenge : c));
      setNewMessageText(prev => ({ ...prev, [challengeId]: '' }));
    }
  };

  const handleEditChallengeRoute = (challenge: RideChallenge) => {
    if (!challenge.route || !currentUserSyncCode) return;
    if (challenge.creatorSyncCode !== currentUserSyncCode && !(challenge.editors || []).includes(currentUserSyncCode)) {
      alert("Nemáš práva na editaci trasy této výzvy.");
      return;
    }

    const expeditionToEdit: Expedition = {
      ...challenge.route,
      linkedChallengeId: challenge.id
    };

    const existing = JSON.parse(localStorage.getItem('spirit_wanderer_trips') || '[]');
    localStorage.setItem('spirit_wanderer_trips', JSON.stringify([expeditionToEdit, ...existing.filter((e: Expedition) => e.id !== expeditionToEdit.id)]));
    
    navigate('/trip-planner', { state: { editExpeditionId: expeditionToEdit.id } });
  };

  const handleRejectChallenge = (challengeId: string) => {
    const updated = [...rejectedChallenges, challengeId];
    setRejectedChallenges(updated);
    localStorage.setItem('motospirit_rejected_challenges', JSON.stringify(updated));
  };

  const handleDeactivate = async (rider: RiderProfile) => {
    const isAdmin = currentUser?.isAdmin || currentUser?.email?.toLowerCase() === 'roman.winter.cz@gmail.com';
    if (!isAdmin) return;
    if (!window.confirm(`Opravdu chceš deaktivovat uživatele ${rider.user.nickname}?`)) return;

    const updatedUser = { ...rider.user, isDeactivated: !rider.user.isDeactivated };
    const success = await updateProfileStatus(rider.syncCode, updatedUser);
    if (success) {
      setRiders(prev => prev.map(r => r.syncCode === rider.syncCode ? { ...r, user: updatedUser } : r));
    }
  };

  const handleDelete = async (rider: RiderProfile) => {
    const isAdmin = currentUser?.isAdmin || currentUser?.email?.toLowerCase() === 'roman.winter.cz@gmail.com';
    if (!isAdmin) return;
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
          <button 
            onClick={() => setActiveTab('events')}
            className={`pb-2 text-[10px] font-bold uppercase tracking-widest transition-all shrink-0 ${activeTab === 'events' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            AKCE A SRAZY
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
                        {rider.syncCode === currentUserSyncCode && <span className="text-orange-500 ml-2 text-xs">(TY - AKTIVNÍ)</span>}
                        {rider.syncCode !== currentUserSyncCode && currentUser?.email && rider.user.email === currentUser.email && (
                          <span className="text-slate-500 ml-2 text-xs">(JINÉ ZAŘÍZENÍ)</span>
                        )}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{rider.user.ridingStyle || 'Road'} Rider</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-6">
                    {rider.syncCode !== currentUserSyncCode && (
                      <button 
                        onClick={() => toggleFollow(rider.syncCode)}
                        className={`w-full py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                          currentUser?.following?.includes(rider.syncCode)
                            ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20'
                            : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-orange-500/50'
                        }`}
                      >
                        <i className={`fas ${currentUser?.following?.includes(rider.syncCode) ? 'fa-check' : 'fa-plus'}`}></i>
                        {currentUser?.following?.includes(rider.syncCode) ? 'V PARTĚ' : 'PŘIDAT DO PARTY'}
                      </button>
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

                  {currentUser && (currentUser.isAdmin || currentUser.email?.toLowerCase() === 'roman.winter.cz@gmail.com') && rider.syncCode !== currentUserSyncCode && (
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
                .filter(c => new Date(c.dateTime).getTime() > Date.now() - 24 * 60 * 60 * 1000)
                .filter(c => {
                  if (c.creatorSyncCode === currentUserSyncCode) return true;
                  if (c.audience === 'selected' && !(c.invitedSyncCodes || []).includes(currentUserSyncCode || '')) return false;
                  return true;
                })
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
                      {challenge.creatorSyncCode === currentUserSyncCode && (
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

                  {/* Route & Chat row */}
                  <div className="flex justify-between items-center gap-2 pt-2">
                    <div className="flex gap-2">
                      {challenge.route && (
                        <Link 
                          to={`/share/challenge-${challenge.id}`}
                          className="px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300"
                        >
                          <i className="fas fa-map text-orange-500 mr-2"></i> Trasa
                        </Link>
                      )}
                      {challenge.route && (challenge.creatorSyncCode === currentUserSyncCode || (challenge.editors || []).includes(currentUserSyncCode || '')) && (
                        <button 
                          onClick={() => handleEditChallengeRoute(challenge)}
                          className="px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all bg-blue-900/20 border border-blue-500/30 hover:border-blue-500 text-blue-400"
                          title="Otevřít v Plánovači a upravit mapu"
                        >
                          <i className="fas fa-pen text-blue-500 mr-2"></i> Upravit trasu
                        </button>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => setOpenChatId(openChatId === challenge.id ? null : challenge.id)}
                      className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all border ${
                        openChatId === challenge.id 
                          ? 'bg-slate-700 text-white border-slate-600' 
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <i className="fas fa-comments mr-2"></i> 
                      Diskuze {(challenge.messages?.length || 0) > 0 && <span className="bg-orange-500 text-white rounded-full px-1.5 py-0.5 text-[8px] ml-1">{challenge.messages?.length}</span>}
                    </button>
                  </div>

                  {/* Chat Section */}
                  {openChatId === challenge.id && (
                    <div className="pt-4 border-t border-slate-700 space-y-4 animate-fadeIn">
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {(challenge.messages || []).length === 0 ? (
                          <p className="text-xs text-slate-500 italic text-center py-4">Zatím žádné zprávy. Napiš jako první!</p>
                        ) : (
                          (challenge.messages || []).map(msg => (
                            <div key={msg.id} className={`flex flex-col ${msg.syncCode === currentUserSyncCode ? 'items-end' : 'items-start'}`}>
                              <span className="text-[8px] text-slate-500 font-bold uppercase mb-0.5 px-1">{msg.nickname}</span>
                              <div className={`px-3 py-2 rounded-xl text-xs ${
                                msg.syncCode === currentUserSyncCode 
                                  ? 'bg-orange-600 text-white rounded-tr-sm' 
                                  : 'bg-slate-700 text-slate-200 rounded-tl-sm'
                              }`}>
                                {msg.text}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={newMessageText[challenge.id] || ''}
                          onChange={e => setNewMessageText(prev => ({...prev, [challenge.id]: e.target.value}))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSendMessage(challenge.id);
                          }}
                          placeholder="Napiš zprávu k výzvě..."
                          className="flex-grow bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-orange-500 outline-none"
                        />
                        <button 
                          onClick={() => handleSendMessage(challenge.id)}
                          disabled={!newMessageText[challenge.id]?.trim()}
                          className="bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 disabled:text-slate-500 text-white w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                        >
                          <i className="fas fa-paper-plane"></i>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )})}
              {challenges
                .filter(c => new Date(c.dateTime).getTime() > Date.now() - 24 * 60 * 60 * 1000)
                .filter(c => {
                  if (c.creatorSyncCode === currentUserSyncCode) return true;
                  if (c.audience === 'selected' && !(c.invitedSyncCodes || []).includes(currentUserSyncCode || '')) return false;
                  return true;
                }).length === 0 && (
                <div className="col-span-full text-center py-20">
                  <p className="text-slate-600 text-xs uppercase font-bold tracking-widest">Zatím žádné výzvy. Buď první!</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeTab === 'events' ? (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 px-2">
            <div className="relative flex-grow">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
              <input 
                type="text"
                placeholder="Hledat podle místa nebo názvu..."
                value={eventSearchLocation}
                onChange={e => setEventSearchLocation(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-orange-500 outline-none"
              />
            </div>
            <div className="flex gap-3 shrink-0">
              <select 
                value={eventFilterType}
                onChange={e => setEventFilterType(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-[10px] font-bold uppercase text-white outline-none focus:border-orange-500"
              >
                <option value="all">Všechny typy</option>
                <option value="Sraz">Sraz</option>
                <option value="Výstava">Výstava</option>
                <option value="Závod">Závod</option>
                <option value="Vyjížďka">Vyjížďka</option>
              </select>
              <select 
                value={eventFilterTime}
                onChange={e => setEventFilterTime(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-[10px] font-bold uppercase text-white outline-none focus:border-orange-500"
              >
                <option value="all">Kdykoliv</option>
                <option value="this_weekend">Tento víkend</option>
                <option value="this_month">Tento měsíc</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {events
              .filter(e => {
                if (!eventSearchLocation.trim()) return true;
                const query = eventSearchLocation.toLowerCase();
                return e.location.toLowerCase().includes(query) || e.title.toLowerCase().includes(query);
              })
              .filter(e => eventFilterType === 'all' || e.type === eventFilterType)
              .filter(e => {
                if (eventFilterTime === 'all') return true;
                const eventDate = new Date(e.date);
                const now = new Date();
                if (eventFilterTime === 'this_month') {
                  return eventDate.getMonth() === now.getMonth() && eventDate.getFullYear() === now.getFullYear();
                }
                if (eventFilterTime === 'this_weekend') {
                  const diffTime = eventDate.getTime() - now.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  return diffDays <= 7 && diffDays >= 0 && (eventDate.getDay() === 0 || eventDate.getDay() === 6);
                }
                return true;
              })
              .map(event => (
              <div key={event.id} className="bg-slate-800 rounded-[2rem] border border-slate-700 p-6 space-y-4 hover:border-orange-500/50 transition-all group overflow-hidden">
                {event.image && (
                  <div className="h-40 -mx-6 -mt-6 mb-4 overflow-hidden relative">
                    <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-800 to-transparent"></div>
                    <div className="absolute bottom-4 left-6 bg-orange-600 text-white px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest shadow-lg">
                      {event.type}
                    </div>
                  </div>
                )}
                
                {!event.image && (
                  <div className="flex justify-between items-start">
                    <div className="bg-orange-600/10 text-orange-500 px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-orange-500/20">
                      {event.type}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-brand font-bold text-white uppercase tracking-tight mb-2">{event.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{event.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-700/50">
                    <p className="text-[8px] text-slate-500 font-bold uppercase mb-1">Kdy</p>
                    <p className="text-xs font-bold text-white">{new Date(event.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-700/50">
                    <p className="text-[8px] text-slate-500 font-bold uppercase mb-1">Kde</p>
                    <p className="text-xs font-bold text-white truncate">{event.location}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-users text-slate-500"></i>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{event.attendees} účastníků</span>
                  </div>
                  <button 
                    onClick={() => setSelectedEvent(event)}
                    className="px-6 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all bg-slate-900 text-slate-400 border border-slate-700 hover:border-orange-500 hover:text-white"
                  >
                    ZOBRAZIT DETAIL
                  </button>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="col-span-full text-center py-20">
                <p className="text-slate-600 text-xs uppercase font-bold tracking-widest">Zatím žádné akce v okolí.</p>
              </div>
            )}
          </div>
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
                  <div className="flex flex-col items-end gap-1">
                    {poi.rating && (
                      <div className="flex items-center gap-1 text-orange-500 text-xs font-bold">
                        <i className="fas fa-star"></i> {poi.rating}
                      </div>
                    )}
                    {poi.distance && (
                      <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold uppercase tracking-widest bg-slate-900 px-2 py-1 rounded-lg border border-slate-700">
                        <i className="fas fa-route"></i> {poi.distance}
                      </div>
                    )}
                  </div>
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
                  value={newChallenge.route?.id || ''}
                >
                  <option value="">Žádná trasa</option>
                  {savedExpeditions.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Kdo výzvu uvidí?</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:border-orange-500 outline-none"
                  value={newChallenge.audience || 'all'}
                  onChange={e => setNewChallenge({...newChallenge, audience: e.target.value as 'all'|'party'|'selected'})}
                >
                  <option value="all">Všichni na Radaru (Veřejná výzva)</option>
                  <option value="party">Jen pro mou partu</option>
                  <option value="selected">Pouze vybraní jezdci</option>
                </select>
              </div>

              {newChallenge.audience === 'selected' && (
                <div className="space-y-2 pt-2 border-t border-slate-700">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Vybrat jezdce</label>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {riders.filter(r => r.syncCode !== currentUserSyncCode).length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-2 text-center">Zatím neznáš žádné další jezdce.</p>
                    ) : riders.filter(r => r.syncCode !== currentUserSyncCode).map(rider => (
                      <div 
                        key={rider.syncCode} 
                        onClick={() => {
                          const currentInvites = newChallenge.invitedSyncCodes || [];
                          const isInvited = currentInvites.includes(rider.syncCode);
                          setNewChallenge({
                            ...newChallenge,
                            invitedSyncCodes: isInvited 
                              ? currentInvites.filter(c => c !== rider.syncCode)
                              : [...currentInvites, rider.syncCode]
                          });
                        }}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          (newChallenge.invitedSyncCodes || []).includes(rider.syncCode) 
                            ? 'bg-orange-600/20 border-orange-500' 
                            : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0 overflow-hidden">
                          {rider.user.avatar ? (
                            <img src={rider.user.avatar} alt={rider.user.nickname} className="w-full h-full object-cover" />
                          ) : (
                            <i className="fas fa-user text-slate-400 text-xs"></i>
                          )}
                        </div>
                        <div className="flex-grow">
                          <p className="text-sm font-bold text-white">{rider.user.nickname}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest">{rider.bikes?.[0]?.brand || 'Jezdec'}</p>
                        </div>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                          (newChallenge.invitedSyncCodes || []).includes(rider.syncCode)
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'bg-slate-800 border-slate-600 text-transparent'
                        }`}>
                          <i className="fas fa-check text-[10px]"></i>
                        </div>
                        
                        {(newChallenge.invitedSyncCodes || []).includes(rider.syncCode) && (
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentEditors = newChallenge.editors || [];
                              const isEditor = currentEditors.includes(rider.syncCode);
                              setNewChallenge({
                                ...newChallenge,
                                editors: isEditor
                                  ? currentEditors.filter(c => c !== rider.syncCode)
                                  : [...currentEditors, rider.syncCode]
                              });
                            }}
                            className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-lg border flex items-center gap-1.5 shrink-0 transition-colors ${
                              (newChallenge.editors || []).includes(rider.syncCode)
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
                            }`}
                          >
                            <i className="fas fa-pen"></i> Editovat
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
      {/* MODAL: Event Detail */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-fadeIn">
          <div className="bg-slate-800 w-full max-w-lg rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[90vh]">
            {selectedEvent.image ? (
              <div className="relative h-64 shrink-0">
                <img src={selectedEvent.image} alt={selectedEvent.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-800 via-slate-800/50 to-transparent"></div>
                <button onClick={() => setSelectedEvent(null)} className="absolute top-4 right-4 w-10 h-10 bg-slate-900/50 backdrop-blur-md rounded-full text-white hover:bg-orange-500 transition-colors flex items-center justify-center">
                  <i className="fas fa-times"></i>
                </button>
                <div className="absolute bottom-6 left-8 right-8">
                  <div className="bg-orange-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-block mb-3 shadow-lg">
                    {selectedEvent.type}
                  </div>
                  <h2 className="text-3xl font-brand font-bold uppercase tracking-tight text-white leading-tight">{selectedEvent.title}</h2>
                </div>
              </div>
            ) : (
              <div className="p-8 border-b border-slate-700 flex justify-between items-start shrink-0 bg-slate-800">
                <div>
                  <div className="bg-orange-600/20 text-orange-500 border border-orange-500/30 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-block mb-3">
                    {selectedEvent.type}
                  </div>
                  <h2 className="text-2xl font-brand font-bold uppercase tracking-tight text-white">{selectedEvent.title}</h2>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="text-slate-500 hover:text-white p-2 bg-slate-900 rounded-full w-10 h-10 flex items-center justify-center transition-colors">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}
            
            <div className="p-8 space-y-8 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-orange-500 shrink-0">
                    <i className="fas fa-calendar-alt"></i>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Datum</p>
                    <p className="text-sm font-bold text-white">
                      {new Date(selectedEvent.date).toLocaleDateString('cs-CZ')}
                      {selectedEvent.endDate && ` - ${new Date(selectedEvent.endDate).toLocaleDateString('cs-CZ')}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-blue-500 shrink-0">
                    <i className="fas fa-map-marker-alt"></i>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Místo</p>
                    <p className="text-sm font-bold text-white">{selectedEvent.location}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-emerald-500 shrink-0">
                    <i className="fas fa-users"></i>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Účast</p>
                    <p className="text-sm font-bold text-white">{selectedEvent.attendees} motorkářů</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-purple-500 shrink-0">
                    <i className="fas fa-route"></i>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vzdálenost</p>
                    <p className="text-sm font-bold text-white">{selectedEvent.distance}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">O akci</h3>
                <p className="text-slate-300 text-sm leading-relaxed">{selectedEvent.description}</p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 bg-slate-900/50 shrink-0 flex gap-4">
              <button 
                onClick={() => toggleEventAttendance(selectedEvent.id)}
                className={`flex-1 py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
                  selectedEvent.isAttending 
                    ? 'bg-slate-800 text-orange-500 border border-orange-500/50 hover:bg-slate-700' 
                    : 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-900/20'
                }`}
              >
                <i className={`fas ${selectedEvent.isAttending ? 'fa-check' : 'fa-motorcycle'}`}></i>
                {selectedEvent.isAttending ? 'ZÚČASTNÍM SE' : 'CHCI SE ZÚČASTNIT'}
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
    </div>
  );
};

export default Radar;
