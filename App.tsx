
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Garage from './pages/Garage';
import TripPlanner from './pages/TripPlanner';
import Assistant from './pages/Assistant';
import Navbar from './components/Navbar';

// Globální rozhraní pro aistudio dialogy
// Fix: Use the AIStudio type instead of any to resolve conflicts with the environment's property declaration.
declare global {
  interface Window {
    aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [checking, setChecking] = useState<boolean>(true);
  const [isActivating, setIsActivating] = useState<boolean>(false);

  const checkKeyStatus = async () => {
    try {
      // 1. Kontrola environmentální proměnné (Vercel injection)
      const envKey = process.env.API_KEY;
      if (envKey && envKey !== 'undefined' && envKey.length > 10) {
        setHasKey(true);
        setChecking(false);
        return;
      }

      // 2. Kontrola skrze aistudio rozhraní
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        // Pokud není ani klíč ani rozhraní, uvidíme podle API volání později
        setHasKey(!!envKey);
      }
    } catch (e) {
      console.warn("Key check failed, defaulting to blocked state");
      setHasKey(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const handleOpenKeySelector = async () => {
    setIsActivating(true);
    try {
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        await window.aistudio.openSelectKey();
        // Pravidlo: Předpokládat úspěch ihned po otevření pro zamezení race condition
        setHasKey(true);
      } else {
        console.error("Systémové rozhraní aistudio není dostupné.");
        alert("Systémové rozhraní pro klíč se nepodařilo inicializovat. Zkuste prosím stránku obnovit.");
      }
    } catch (err) {
      console.error("Chyba při otevírání výběru klíče:", err);
    } finally {
      setIsActivating(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center font-brand">
        <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-orange-500 animate-pulse tracking-widest uppercase">Zahřívám motor...</div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100 selection:bg-orange-500/30">
        {!hasKey && (
          <div className="fixed inset-0 z-[100] bg-slate-900/98 backdrop-blur-xl flex items-center justify-center p-6 text-center animate-fadeIn">
            <div className="max-w-md bg-slate-800/50 p-10 rounded-[3rem] border-2 border-orange-600/50 shadow-2xl shadow-orange-900/40 transition-all">
              <div className="w-24 h-24 bg-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                <i className="fas fa-key text-4xl text-orange-500"></i>
              </div>
              <h2 className="text-3xl font-brand font-bold mb-4 uppercase tracking-tighter">Systém uzamčen</h2>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Pro aktivaci AI funkcí (plánování tras, diagnostika) je nutné vybrat váš <span className="text-white font-bold">API klíč</span> z projektu s aktivním Billingem.
              </p>
              <button 
                onClick={handleOpenKeySelector}
                disabled={isActivating}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 text-white py-5 rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 group"
              >
                {isActivating ? (
                  <i className="fas fa-circle-notch animate-spin"></i>
                ) : (
                  <i className="fas fa-bolt group-hover:animate-pulse"></i>
                )}
                {isActivating ? 'OTEVÍRÁM...' : 'AKTIVOVAT MOTO SPIRIT'}
              </button>
              <p className="mt-8 text-[10px] text-slate-500 uppercase tracking-widest leading-relaxed">
                Ujistěte se, že máte povolené vyskakovací okno a nastavený Billing na <br/>
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-orange-500 underline hover:text-orange-400">ai.google.dev</a>
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
        
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-md border-t border-slate-700 flex justify-around py-3 z-50">
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
    <Link to={to} className={`flex flex-col items-center transition-all ${isActive ? 'text-orange-500 scale-110' : 'text-slate-500'}`}>
      <i className={`fas ${icon} text-xl mb-1`}></i>
      <span className="text-[10px] uppercase font-bold tracking-tighter">{label}</span>
    </Link>
  );
};

export default App;
