
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserProfile, FuelRecord, MaintenanceRecord, Motorcycle } from '../types';

const Home: React.FC = () => {
  const [user] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('motospirit_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [fuel] = useState<FuelRecord[]>(() => JSON.parse(localStorage.getItem('motospirit_fuel') || '[]'));
  const [expenses] = useState<MaintenanceRecord[]>(() => JSON.parse(localStorage.getItem('motospirit_records') || '[]'));
  const [bikes] = useState<Motorcycle[]>(() => JSON.parse(localStorage.getItem('motospirit_bikes') || '[]'));

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

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Hero Section - Mobile Optimized */}
      <section className="relative h-[300px] md:h-[450px] rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-700">
        <img 
          src="https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?auto=format&fit=crop&w=1200&q=80" 
          alt="Motorcycle lifestyle" 
          className="w-full h-full object-cover brightness-[0.3]"
        />
        <div className="absolute inset-0 flex flex-col justify-center px-6 md:px-16">
          <div className="inline-block bg-orange-600 text-white text-[10px] font-bold px-3 py-1 rounded-full mb-3 w-fit tracking-widest uppercase">
            Rider Companion 1.2
          </div>
          <h1 className="font-brand text-3xl md:text-6xl font-bold mb-3 leading-tight uppercase">
            {user?.name ? (
              <>Ahoj <span className="text-orange-500">{user.nickname || user.name}</span>!</>
            ) : (
              <>ŽIJ <span className="text-orange-500 italic">SVOJI</span> CESTU</>
            )}
          </h1>
          <p className="text-slate-400 text-xs md:text-lg max-w-md mb-6 leading-relaxed">
            Tvůj digitální mechanik a deník. Všechna data jsou uložena pouze v tvém prohlížeči.
          </p>
          <div className="flex gap-3">
            <Link to="/logbook" className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg text-sm active:scale-95">
              NATANKOVAT
            </Link>
            <Link to="/planner" className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold transition-all border border-slate-700 text-sm active:scale-95">
              TRASY
            </Link>
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
