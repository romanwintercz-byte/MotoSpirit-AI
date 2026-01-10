
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

  useEffect(() => {
    const checkKey = () => {
      const apiKey = process.env.API_KEY;
      if (apiKey && apiKey !== 'undefined' && apiKey.length > 10) {
        setHasKey(true);
      } else {
        // Kontrola systémového dialogu
        const aiWin = window as any;
        if (aiWin.aistudio?.hasSelectedApiKey) {
          aiWin.aistudio.hasSelectedApiKey().then((val: boolean) => setHasKey(val));
        } else {
          // Pokud jsme na Vercelu a není nastavená proměnná, zatím pustíme dál
          // aby mohl uživatel vidět chyby v konzoli
          setHasKey(true); 
        }
      }
      setChecking(false);
    };
    checkKey();
  }, []);

  if (checking) return null;

  return (
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
        
        {/* Mobile Navigation */}
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
    <Link to={to} className={`flex flex-col items-center ${isActive ? 'text-orange-500' : 'text-slate-500'}`}>
      <i className={`fas ${icon} text-lg mb-1`}></i>
      <span className="text-[10px] uppercase font-bold">{label}</span>
    </Link>
  );
};

export default App;
