
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Garage from './pages/Garage';
import TripPlanner from './pages/TripPlanner';
import Assistant from './pages/Assistant';
import Navbar from './components/Navbar';

declare global {
  interface Window {
    // Fix: Subsequent property declarations must have the same type. Property 'aistudio' must be of type 'AIStudio'
    aistudio: any;
  }
}

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(true);

  useEffect(() => {
    const checkKey = async () => {
      // Priorita 1: Kontrola přes aistudio API (pokud je k dispozici)
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        // Priorita 2: Environmentální proměnná
        const envKey = process.env.API_KEY;
        setHasKey(!!(envKey && envKey !== 'undefined' && envKey.length > 10));
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      // Guideline: Assume the key selection was successful after triggering openSelectKey()
      setHasKey(true);
    }
  };

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
        {!hasKey && window.aistudio && (
          <div className="bg-orange-600 text-white p-3 text-center text-sm font-bold flex justify-center items-center gap-4 animate-fadeIn">
            <span>⚠️ AI funkce vyžadují nastavení API klíče.</span>
            <button 
              onClick={handleOpenKeySelector}
              className="bg-white text-orange-600 px-3 py-1 rounded-full text-xs uppercase hover:bg-slate-100 transition-colors"
            >
              Nastavit nyní
            </button>
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
