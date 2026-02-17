
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Garage from './pages/Garage';
import TripPlanner from './pages/TripPlanner';
import Assistant from './pages/Assistant';
import Logbook from './pages/Logbook';
import Radar from './pages/Radar';
import Navbar from './components/Navbar';

const App: React.FC = () => {
  const [checking, setChecking] = useState<boolean>(true);

  useEffect(() => {
    // API key is obtained exclusively from process.env.API_KEY per guidelines.
    // The application must not ask the user for it or provide UI for it unless using Veo/Pro Image models.
    setChecking(false);
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
            <Route path="/radar" element={<Radar />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/logbook" element={<Logbook />} />
          </Routes>
        </main>
        
        {/* Mobile Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-md border-t border-slate-700 flex justify-around py-3 z-50">
          <NavLink to="/" icon="fa-home" label="Domů" />
          <NavLink to="/radar" icon="fa-satellite-dish" label="Radar" />
          <NavLink to="/logbook" icon="fa-book" label="Kniha" />
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
