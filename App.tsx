
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Garage from './pages/Garage';
import TripPlanner from './pages/TripPlanner';
import Assistant from './pages/Assistant';
import Navbar from './components/Navbar';

const ApiKeyGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      // Priority 1: Check if environment key already exists
      if (process.env.API_KEY) {
        setIsAuthorized(true);
        return;
      }

      // Priority 2: Check AI Studio specific selection status
      // @ts-ignore
      if (window.aistudio) {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsAuthorized(hasKey);
      } else {
        // Local dev or other environments
        setIsAuthorized(true);
      }
    };
    
    checkStatus();
    // Re-check periodically if key might be injected late in PWA mode
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    // @ts-ignore
    if (window.aistudio) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      // Assume success as per instructions to avoid race conditions
      setIsAuthorized(true);
    }
  };

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center space-y-4">
        <i className="fas fa-motorcycle fa-bounce text-orange-500 text-5xl"></i>
        <p className="text-slate-400 font-brand text-sm animate-pulse">NASTARTOVÁVÁM SYSTÉM...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent"></div>
          
          <div className="space-y-4">
            <div className="bg-slate-700 w-24 h-24 rounded-full mx-auto flex items-center justify-center border-4 border-slate-900 shadow-xl">
              <i className="fas fa-plug-circle-bolt text-orange-500 text-4xl"></i>
            </div>
            <h1 className="text-3xl font-bold font-brand">AKTIVACE <span className="text-orange-500">AI</span></h1>
            <p className="text-slate-400">Pro spuštění inteligentního asistenta MotoSpirit je nutné autorizovat přístup k vašemu API klíči.</p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={handleConnect}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-5 rounded-2xl transition-all shadow-lg shadow-orange-600/20 active:scale-95 flex items-center justify-center gap-3"
            >
              <i className="fas fa-key"></i>
              AUTORIZOVAT KLÍČ
            </button>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              Vyžaduje placený GCP projekt s povoleným Gemini API
            </p>
          </div>
          
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            className="block text-xs text-orange-400/70 hover:text-orange-400 underline transition-colors"
          >
            Návod k nastavení plateb
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ApiKeyGuard>
      <HashRouter>
        <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
          <Navbar />
          <main className="flex-grow container mx-auto px-4 py-6 mb-20 md:mb-6">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/garage" element={<Garage />} />
              <Route path="/planner" element={<TripPlanner />} />
              <Route path="/assistant" element={<Assistant />} />
            </Routes>
          </main>
          
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around py-3 z-50">
            <NavLink to="/" icon="fa-home" label="Domů" />
            <NavLink to="/garage" icon="fa-motorcycle" label="Garáž" />
            <NavLink to="/planner" icon="fa-map-location-dot" label="Trasy" />
            <NavLink to="/assistant" icon="fa-robot" label="AI" />
          </div>
        </div>
      </HashRouter>
    </ApiKeyGuard>
  );
};

const NavLink: React.FC<{ to: string, icon: string, label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`flex flex-col items-center transition-colors ${isActive ? 'text-orange-500' : 'text-slate-400'}`}>
      <i className={`fas ${icon} text-xl mb-1`}></i>
      <span className="text-xs">{label}</span>
    </Link>
  );
};

export default App;
