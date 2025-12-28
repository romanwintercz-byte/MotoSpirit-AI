
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Garage from './pages/Garage';
import TripPlanner from './pages/TripPlanner';
import Assistant from './pages/Assistant';
import Navbar from './components/Navbar';

const ApiKeyGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<'checking' | 'authorized' | 'unauthorized'>('checking');

  const checkStatus = async () => {
    // If key exists in process.env, we are good
    if (process.env.API_KEY && process.env.API_KEY !== 'undefined') {
      setStatus('authorized');
      return;
    }

    // @ts-ignore
    if (window.aistudio) {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setStatus(hasKey ? 'authorized' : 'unauthorized');
    } else {
      setStatus('authorized'); // Dev mode
    }
  };

  useEffect(() => {
    checkStatus();
    // Re-check more frequently for PWA state changes
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    // @ts-ignore
    if (window.aistudio) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setStatus('authorized');
    }
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center space-y-4">
        <i className="fas fa-motorcycle fa-bounce text-orange-500 text-5xl"></i>
        <p className="text-slate-400 font-brand text-sm">NAČÍTÁNÍ...</p>
      </div>
    );
  }

  if (status === 'unauthorized') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl space-y-8">
          <div className="bg-slate-700 w-24 h-24 rounded-full mx-auto flex items-center justify-center border-4 border-slate-900">
            <i className="fas fa-plug-circle-xmark text-orange-500 text-4xl"></i>
          </div>
          <h1 className="text-3xl font-bold font-brand uppercase">AI <span className="text-orange-500">Offline</span></h1>
          <p className="text-slate-400">V režimu na ploše (PWA) je nutné manuálně aktivovat spojení s AI studiem.</p>
          <button 
            onClick={handleConnect}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-5 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
          >
            AKTIVOVAT AI
          </button>
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
