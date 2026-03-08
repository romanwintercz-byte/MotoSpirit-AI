
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserProfile, FuelRecord, MaintenanceRecord, Motorcycle } from '../types';

const Home: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('motospirit_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [fuel, setFuel] = useState<FuelRecord[]>(() => JSON.parse(localStorage.getItem('motospirit_fuel') || '[]'));
  const [expenses, setExpenses] = useState<MaintenanceRecord[]>(() => JSON.parse(localStorage.getItem('motospirit_records') || '[]'));
  const [bikes, setBikes] = useState<Motorcycle[]>(() => JSON.parse(localStorage.getItem('motospirit_bikes') || '[]'));

  useEffect(() => {
    const handleSyncUpdate = () => {
      const savedUser = localStorage.getItem('motospirit_user');
      setUser(savedUser ? JSON.parse(savedUser) : null);
      setFuel(JSON.parse(localStorage.getItem('motospirit_fuel') || '[]'));
      setExpenses(JSON.parse(localStorage.getItem('motospirit_records') || '[]'));
      setBikes(JSON.parse(localStorage.getItem('motospirit_bikes') || '[]'));
    };
    window.addEventListener('sync-update', handleSyncUpdate);
    return () => window.removeEventListener('sync-update', handleSyncUpdate);
  }, []);

  const totalCost = fuel.reduce((acc, curr) => acc + curr.cost, 0) + expenses.reduce((acc, curr) => acc + curr.cost, 0);
  
  // Výpočet průměrné spotřeby napříč všemi motorkami (jen pro ukázku na dashboardu)
  const calculateGlobalConsumption = () => {
    if (fuel.length < 2) return '--';
    // Seřadíme podle tachometru
    const sorted = [...fuel].sort((a, b) => b.mileage - a.mileage);
    const latest = sorted[0];
    const oldest = sorted[sorted.length - 1];
    const totalDist = latest.mileage - oldest.mileage;
    const totalLiters = fuel.slice(0, -1).reduce((acc, curr) => acc + curr.liters, 0);
    if (totalDist <= 0) return '--';
    return ((totalLiters / totalDist) * 100).toFixed(1);
  };

  const stats = [
    { label: 'Spotřeba ø', value: `${calculateGlobalConsumption()} l`, icon: 'fa-gas-pump', color: 'border-orange-500/50' },
    { label: 'Náklady celkem', value: `${totalCost.toLocaleString()} Kč`, icon: 'fa-coins', color: 'border-green-500/50' },
    { label: 'Počet strojů', value: bikes.length.toString(), icon: 'fa-motorcycle', color: 'border-blue-500/50' },
  ];

  const toCzechVocative = (name: string): string => {
    if (!name) return '';
    const n = name.trim();
    const lastChar = n.slice(-1).toLowerCase();
    const lastTwo = n.slice(-2).toLowerCase();

    // Basic rules for Czech vocative (simplified)
    if (lastChar === 'a') return n.slice(0, -1) + 'o'; // Honza -> Honzo
    if (lastChar === 'e' || lastChar === 'i' || lastChar === 'y') return n; // Lucie, Jiří, Maty
    if (lastChar === 'r') return n.slice(0, -1) + 'ře'; // Petr -> Petře
    if (['k', 'h', 'g'].includes(lastChar) || lastTwo === 'ch') return n + 'u'; // Marek -> Marku, Filip -> Filipu (wait, Filip -> Filipe)
    if (['n', 'l', 'm', 'v', 'b', 'p', 'f', 't', 'd'].includes(lastChar)) return n + 'e'; // Roman -> Romane, Pavel -> Pavle
    if (['s', 'z', 'š', 'ž', 'č', 'ř', 'c', 'j'].includes(lastChar)) return n + 'i'; // Tomáš -> Tomáši

    return n;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Hero Section - Editorial / Magazine Style */}
      <section className="relative h-[400px] md:h-[600px] rounded-[3rem] overflow-hidden shadow-2xl border border-slate-800 group">
        <div className="absolute inset-0 bg-slate-950">
          <img 
            src="https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1600&q=80" 
            alt="Motorcycle lifestyle" 
            className="w-full h-full object-cover opacity-40 mix-blend-luminosity group-hover:scale-105 transition-transform duration-1000 ease-out"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent"></div>
        </div>

        <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-3 mb-6">
              <span className="w-8 h-[2px] bg-orange-500"></span>
              <span className="text-orange-500 text-[10px] font-bold uppercase tracking-[0.3em]">MotoSpirit 2.5</span>
            </div>
            
            <h1 className="font-brand text-5xl md:text-8xl font-black text-white uppercase tracking-tighter leading-[0.85] mb-6">
              {user?.name ? (
                <div className="flex flex-col">
                  <span className="text-slate-400 text-3xl md:text-5xl font-light tracking-tight mb-2">Ahoj,</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                    {toCzechVocative(user.nickname || user.name)}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">ŽIJ SVOJI</span>
                  <span className="text-orange-500 italic pr-4">CESTU.</span>
                </div>
              )}
            </h1>
            
            <p className="text-slate-400 text-sm md:text-lg max-w-xl mb-10 leading-relaxed font-medium">
              Tvůj digitální parťák. Plánuj epické výpravy, sdílej trasy s kámoši, sleduj náklady a měj servis pod kontrolou. Vše bezpečně v cloudu.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Link to="/planner" className="bg-orange-600 hover:bg-orange-500 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-[0_0_30px_rgba(234,88,12,0.3)] hover:shadow-[0_0_40px_rgba(234,88,12,0.5)] text-xs uppercase tracking-widest flex items-center gap-3 group/btn">
                PLÁNOVAT TRASU
                <i className="fas fa-arrow-right group-hover/btn:translate-x-1 transition-transform"></i>
              </Link>
              <Link to="/logbook" className="bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md text-white px-8 py-4 rounded-2xl font-bold transition-all border border-slate-700 text-xs uppercase tracking-widest flex items-center gap-3">
                <i className="fas fa-gas-pump text-orange-500"></i>
                NATANKOVAT
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className={`bg-slate-800/60 p-5 rounded-3xl border-l-4 ${stat.color} backdrop-blur-sm flex flex-col justify-between h-32`}>
            <i className={`fas ${stat.icon} text-slate-500 text-lg`}></i>
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1">{stat.label}</p>
              <p className="text-xl font-brand font-bold text-white truncate">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Cloud Banner */}
      {!localStorage.getItem('motospirit_sync_code') && (
        <Link to="/garage" className="block bg-gradient-to-r from-orange-600 to-orange-500 p-6 rounded-[2rem] shadow-xl shadow-orange-900/20 relative overflow-hidden group hover:scale-[1.02] transition-all active:scale-95">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-sm border border-white/10">
              <i className="fas fa-cloud text-white text-2xl"></i>
            </div>
            <div>
              <h3 className="text-white font-brand font-bold text-xl uppercase tracking-tight mb-1">Připojit ke cloudu</h3>
              <p className="text-orange-100 text-xs leading-relaxed">Zálohuj svá data, sdílej trasy a staň se součástí Moto komunity. Vytvoř si svůj PIN.</p>
            </div>
          </div>
        </Link>
      )}

      {/* AI Assistant Promo */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-[2rem] border border-orange-500/20 flex items-center gap-5">
        <div className="bg-orange-600 w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-900/40">
          <i className="fas fa-robot text-white text-xl"></i>
        </div>
        <div className="flex-grow">
          <h3 className="text-sm font-bold mb-1 uppercase font-brand tracking-tight">Potřebuješ poradit?</h3>
          <p className="text-slate-400 text-[11px] leading-tight mb-2">
            Zeptej se AI na servisní intervaly nebo techniku jízdy.
          </p>
          <Link to="/assistant" className="text-orange-500 text-xs font-bold hover:underline flex items-center gap-2">
            Spustit asistenta <i className="fas fa-arrow-right text-[10px]"></i>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
