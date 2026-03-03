
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Garage from './pages/Garage';
import TripPlanner from './pages/TripPlanner';
import Assistant from './pages/Assistant';
import Logbook from './pages/Logbook';
import Radar from './pages/Radar';
import SharedTrip from './pages/SharedTrip';
import Navbar from './components/Navbar';
import Onboarding from './components/Onboarding';
import { subscribeToCloudChanges, subscribeToNewChallenges } from './services/syncService';
import { supabase } from './services/supabaseClient';

const App: React.FC = () => {
  const [checking, setChecking] = useState<boolean>(true);
  const [hasNewChallenge, setHasNewChallenge] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  useEffect(() => {
    // Check onboarding status
    const onboardingCompleted = localStorage.getItem('motospirit_onboarding_completed') === 'true';
    if (!onboardingCompleted) {
      setShowOnboarding(true);
    }

    // API key is obtained exclusively from process.env.API_KEY per guidelines.
    // The application must not ask the user for it or provide UI for it unless using Veo/Pro Image models.
    setChecking(false);

    const checkNewChallenges = async () => {
      const lastView = parseInt(localStorage.getItem('motospirit_last_challenge_view') || '0');
      
      try {
        const { data } = await supabase
          .from('moto_shared_trips')
          .select('expedition_data')
          .like('slug', 'challenge-%')
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (data && data.length > 0) {
          const latestChallenge = data[0].expedition_data;
          if (latestChallenge && latestChallenge.createdAt) {
            const challengeTime = new Date(latestChallenge.createdAt).getTime();
            localStorage.setItem('motospirit_latest_challenge_time', challengeTime.toString());
            
            // Don't show notification if the user created it themselves
            const syncCode = localStorage.getItem('motospirit_sync_code');
            if (challengeTime > lastView && latestChallenge.creatorSyncCode !== syncCode) {
              setHasNewChallenge(true);
            } else {
              setHasNewChallenge(false);
            }
          }
        }
      } catch (e) {
        console.error("Error checking challenges:", e);
        // Fallback to local storage
        const latestChallenge = parseInt(localStorage.getItem('motospirit_latest_challenge_time') || '0');
        setHasNewChallenge(latestChallenge > lastView);
      }
    };

    checkNewChallenges();
    window.addEventListener('challenge-viewed', checkNewChallenges);

    const syncCode = localStorage.getItem('motospirit_sync_code');
    const isAuth = localStorage.getItem('motospirit_auth') === 'true';
    
    let channel: any;
    let challengeChannel: any;

    if (syncCode && isAuth) {
      channel = subscribeToCloudChanges(syncCode, (cloudData) => {
        if (cloudData) {
          if (cloudData.user) localStorage.setItem('motospirit_user', JSON.stringify(cloudData.user));
          if (cloudData.bikes) localStorage.setItem('motospirit_bikes', JSON.stringify(cloudData.bikes));
          if (cloudData.records) localStorage.setItem('motospirit_records', JSON.stringify(cloudData.records));
          if (cloudData.fuel) localStorage.setItem('motospirit_fuel', JSON.stringify(cloudData.fuel));
          if (cloudData.expeditions) localStorage.setItem('spirit_wanderer_trips', JSON.stringify(cloudData.expeditions));
          
          // Dispatch event so all pages can re-render
          (window as any).__isSyncingFromCloud = true;
          window.dispatchEvent(new Event('sync-update'));
          setTimeout(() => {
            (window as any).__isSyncingFromCloud = false;
          }, 100);
        }
      });

      challengeChannel = subscribeToNewChallenges((challenge) => {
        if (challenge && challenge.createdAt) {
          const challengeTime = new Date(challenge.createdAt).getTime();
          const lastView = parseInt(localStorage.getItem('motospirit_last_challenge_view') || '0');
          
          if (challengeTime > lastView && challenge.creatorSyncCode !== syncCode) {
            localStorage.setItem('motospirit_latest_challenge_time', challengeTime.toString());
            setHasNewChallenge(true);
            window.dispatchEvent(new Event('new-challenge-alert'));
          }
        }
      });
    }

    return () => {
      if (channel) channel.unsubscribe();
      if (challengeChannel) challengeChannel.unsubscribe();
      window.removeEventListener('challenge-viewed', checkNewChallenges);
    };
  }, []);

  if (checking) return null;

  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
        <Navbar hasNewChallenge={hasNewChallenge} />
        <main className="flex-grow container mx-auto px-4 py-6 mb-20 md:mb-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/garage" element={<Garage />} />
            <Route path="/planner" element={<TripPlanner />} />
            <Route path="/radar" element={<Radar />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/logbook" element={<Logbook />} />
            <Route path="/share/:slug" element={<SharedTrip />} />
          </Routes>
        </main>
        
        {/* Mobile Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-md border-t border-slate-700 flex justify-around py-3 z-50">
          <NavLink to="/" icon="fa-home" label="Domů" />
          <NavLink to="/radar" icon="fa-satellite-dish" label="Radar" hasNotification={hasNewChallenge} />
          <NavLink to="/logbook" icon="fa-book" label="Kniha" />
          <NavLink to="/planner" icon="fa-map-location-dot" label="Trasy" />
          <NavLink to="/assistant" icon="fa-robot" label="AI" />
        </div>
      </div>
    </HashRouter>
  );
};

const NavLink: React.FC<{ to: string, icon: string, label: string, hasNotification?: boolean }> = ({ to, icon, label, hasNotification }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`flex flex-col items-center relative ${isActive ? 'text-orange-500' : 'text-slate-500'}`}>
      <div className="relative">
        <i className={`fas ${icon} text-lg mb-1`}></i>
        {hasNotification && (
          <span className="absolute -top-1 -right-2 w-3 h-3 bg-red-500 border-2 border-slate-800 rounded-full animate-pulse"></span>
        )}
      </div>
      <span className="text-[10px] uppercase font-bold">{label}</span>
    </Link>
  );
};

export default App;
