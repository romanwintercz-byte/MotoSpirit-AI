
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Garage from './pages/Garage';
import TripPlanner from './pages/TripPlanner';
import Assistant from './pages/Assistant';
import Navbar from './components/Navbar';

const ApiKeyGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<'checking' | 'authorized' | 'unauthorized'>('checking');

  useEffect(() => {
    const init = async () => {
      // Pokud jsme na Vercelu a klíč je v env, rovnou pustíme
      if (process.env.API_KEY && process.env.API_KEY !== 'undefined' && process.env.API_KEY.length > 5) {
        setStatus('authorized');
        return;
      }

      // V PWA režimu zkontrolujeme bridge
      try {
        // @ts-ignore
        if (window.aistudio) {
          // @ts-ignore
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (hasKey) {
            setStatus('authorized');
            return;
          }
        }
      } catch (e) {
        console.warn("AI Bridge check failed, showing auth button.");
      }
      setStatus('unauthorized');
    };
    init();
  }, []);

  const handleConnect = async () => {
    console.log("Triggering AI Authorization...");
    try {
      // @ts-ignore
      if (window.aistudio && window.aistudio.openSelectKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      } else {
        console.error("Bridge 'window.aistudio' not found!");
        alert("Chyba: AI Studio Bridge nebyl nalezen. Zkuste aplikaci otevřít v prohlížeči, ne z plochy.");
      }
    } catch (err) {
      console.error("Auth error:", err);
    } finally {
      // Kritické: Vždy pustíme uživatele dál, abychom předešli zaseknutí (race condition)
      setStatus('authorized');
    }
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center space-y-4">
        <i className="fas fa-motorcycle fa-bounce text-orange-500 text-5xl"></i>
        <p className="text-slate-400 font-brand text-sm">PŘÍPRAVA STROJE...</p>
      </div>
    );
  }

  if (status === 'unauthorized') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl space-y-8 animate-fadeIn">
          <div className="bg-slate-700/50 w-24 h-24 rounded-full mx-auto flex items-center justify-center border-4 border-slate-900">
            <i className="fas fa-key text-orange-500 text-4xl"></i>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold font-brand uppercase">AUTORIZACE</h1>
            <p className="text-slate-400 text-sm">Pro běh AI na Vercelu/ploše je nutné vybrat váš API klíč.</p>
          </div>
          <button 
            onClick={handleConnect}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-5 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
          >
            NASTAVIT API KLÍČ
          </button>
          <p className="text-[10px] text-slate-500 italic">Poznámka: Pokud se po kliknutí nic nestane, otevřete aplikaci v Safari/Chrome a nikoliv jako PWA.</p>
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
