
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Garage from './pages/Garage';
import TripPlanner from './pages/TripPlanner';
import Assistant from './pages/Assistant';
import Navbar from './components/Navbar';

// Fix: Define the AIStudio interface to ensure compatibility and type safety.
interface AIStudio {
  hasSelectedApiKey(): Promise<boolean>;
  openSelectKey(): Promise<void>;
}

// Fix: Use the correct type and modifiers for the global aistudio property.
// The error 'identical modifiers' usually requires 'readonly' to match the system declaration.
declare global {
  interface Window {
    readonly aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [checking, setChecking] = useState<boolean>(true);

  const checkKeyStatus = async () => {
    // 1. Zkusíme environmentální proměnnou (pro lokální vývoj nebo SSR)
    const envKey = process.env.API_KEY;
    if (envKey && envKey !== 'undefined' && envKey.length > 10) {
      setHasKey(true);
      setChecking(false);
      return;
    }

    // 2. Zkusíme aistudio API (pro Vercel/Web vyžadující uživatelský klíč)
    if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
      try {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } catch (e) {
        setHasKey(false);
      }
    } else {
      setHasKey(false);
    }
    setChecking(false);
  };

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      // Fix: Assume success and proceed to the app immediately to prevent race conditions.
      // Guideline: "Do not add delay to mitigate the race condition."
      setHasKey(true);
    }
  };

  if (checking) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center font-brand text-orange-500 animate-pulse">NASTAVUJI SYSTÉM...</div>;
  }

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
        {!hasKey && (
          <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-6 text-center">
            <div className="max-w-md bg-slate-800 p-10 rounded-[3rem] border-2 border-orange-600 shadow-2xl shadow-orange-900/20">
              <i className="fas fa-key text-5xl text-orange-500 mb-6"></i>
              <h2 className="text-2xl font-brand font-bold mb-4 uppercase">Klíč nenalezen</h2>
              <p className="text-slate-400 mb-8">
                Pro běh AI v prohlížeči (Vercel) je nutné vybrat váš API klíč z placeného Google projektu.
              </p>
              <button 
                onClick={handleOpenKeySelector}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
              >
                <i className="fas fa-plug"></i> NASTAVIT API KLÍČ
              </button>
              <p className="mt-6 text-[10px] text-slate-500 uppercase tracking-widest leading-relaxed">
                Po kliknutí vyberte projekt s aktivním Billingem na <br/>
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-orange-500 underline">ai.google.dev/gemini-api/docs/billing</a>
              </p>
            </div>
          </div>
        )}
        
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
