
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Garage from './pages/Garage';
import TripPlanner from './pages/TripPlanner';
import Assistant from './pages/Assistant';
import Navbar from './components/Navbar';

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
  const [isActivating, setIsActivating] = useState<boolean>(false);

  useEffect(() => {
    const checkKey = async () => {
      // 1. Pokud je klíč přímo v environmentu (Vercel), hned pouštíme
      const envKey = process.env.API_KEY;
      if (envKey && envKey.length > 10 && envKey !== 'undefined') {
        console.log("MotoSpirit: Klíč nalezen v prostředí.");
        setHasKey(true);
        setChecking(false);
        return;
      }

      // 2. Pokus o detekci aistudio dialogu
      const aiWin = window as any;
      try {
        if (aiWin.aistudio && typeof aiWin.aistudio.hasSelectedApiKey === 'function') {
          const selected = await aiWin.aistudio.hasSelectedApiKey();
          setHasKey(selected);
        } else {
          // Pokud rozhraní neexistuje, nebudeme uživatele blokovat, 
          // ale zkusíme volat API přímo (klíč může být vložen jinak)
          setHasKey(true);
        }
      } catch (e) {
        setHasKey(true);
      }
      setChecking(false);
    };

    checkKey();
  }, []);

  const handleManualActivate = async () => {
    setIsActivating(true);
    const aiWin = window as any;
    try {
      if (aiWin.aistudio?.openSelectKey) {
        await aiWin.aistudio.openSelectKey();
      }
    } catch (e) {
      console.warn("MotoSpirit: Nepodařilo se otevřít systémový dialog, pokračuji v režimu Direct.");
    }
    // Vždy pustíme uživatele dál po kliknutí, abychom předešli "zaseknutí"
    setHasKey(true);
    setIsActivating(false);
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
            <div className="max-w-md bg-slate-800/50 p-10 rounded-[3rem] border-2 border-orange-600/50 shadow-2xl shadow-orange-900/40">
              <div className="w-20 h-20 bg-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                <i className="fas fa-key text-3xl text-orange-500"></i>
              </div>
              <h2 className="text-2xl font-brand font-bold mb-4 uppercase">Aktivace Systému</h2>
              <p className="text-slate-400 mb-8 text-sm leading-relaxed">
                Klíč nebyl automaticky detekován. Pokud jej máte nastavený v Google Cloud Console nebo Vercelu, klikněte na tlačítko níže pro spuštění aplikace.
              </p>
              <button 
                onClick={handleManualActivate}
                disabled={isActivating}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-2xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
              >
                {isActivating ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-bolt"></i>}
                {isActivating ? 'AKTIVUJI...' : 'SPUSTIT MOTO SPIRIT'}
              </button>
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
