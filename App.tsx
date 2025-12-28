
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Garage from './pages/Garage';
import TripPlanner from './pages/TripPlanner';
import Assistant from './pages/Assistant';
import Navbar from './components/Navbar';

// No custom window declaration needed as aistudio is provided globally by the environment.

const ApiKeyGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore - window.aistudio is globally defined in the runtime environment
      if (window.aistudio) {
        // @ts-ignore
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        // Fallback for local development or standard environments where aistudio is not present
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleConnect = async () => {
    // @ts-ignore
    if (window.aistudio) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      // Assume success as per instructions to avoid race conditions between selection and state check
      setHasKey(true);
    }
  };

  if (hasKey === null) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><i className="fas fa-circle-notch fa-spin text-orange-500 text-4xl"></i></div>;

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6 animate-fadeIn">
          <div className="bg-orange-600 w-20 h-20 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-orange-500/20">
            <i className="fas fa-key text-white text-3xl"></i>
          </div>
          <h1 className="text-3xl font-bold font-brand">PŘIPOJIT <span className="text-orange-500">AI</span></h1>
          <p className="text-slate-400">Pro fungování aplikace MotoSpirit je nutné vybrat váš API klíč z AI Studia (placený GCP projekt).</p>
          <button 
            onClick={handleConnect}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl transition-all transform hover:scale-105"
          >
            Vybrat API klíč
          </button>
          <p className="text-xs text-slate-500">
            Více informací o nastavení plateb naleznete v <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline text-orange-400">dokumentaci Google</a>.
          </p>
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
