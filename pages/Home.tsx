
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  const [aiStatus, setAiStatus] = useState<'connected' | 'error' | 'checking'>('checking');

  useEffect(() => {
    const check = () => {
      const key = (window as any).process?.env?.API_KEY || (process.env as any).API_KEY;
      setAiStatus(key && key !== 'undefined' ? 'connected' : 'error');
    };
    check();
    const inv = setInterval(check, 5000);
    return () => clearInterval(inv);
  }, []);

  const handleReconnect = async () => {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
    }
  };

  const stats = [
    { label: 'Ujeto letos', value: '3,450 km', icon: 'fa-road', color: 'bg-blue-500' },
    { label: 'Náklady', value: '12,500 Kč', icon: 'fa-coins', color: 'bg-green-500' },
    { label: 'Servis za', value: '1,200 km', icon: 'fa-tools', color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-8 animate-fadeIn pb-10">
      {/* AI Engine Status - Critical for user visibility */}
      <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700 p-3 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${aiStatus === 'connected' ? 'bg-green-500 animate-pulse' : aiStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            AI Engine: {aiStatus === 'connected' ? 'Připojen' : aiStatus === 'error' ? 'Odpojen' : 'Kontrola...'}
          </span>
        </div>
        {aiStatus === 'error' && (
          <button 
            onClick={handleReconnect}
            className="text-[10px] bg-orange-600/20 text-orange-500 border border-orange-500/50 px-3 py-1 rounded-lg font-bold hover:bg-orange-600 hover:text-white transition-all"
          >
            AKTIVOVAT AI
          </button>
        )}
      </div>

      <section className="relative h-64 md:h-80 rounded-3xl overflow-hidden shadow-2xl">
        <img 
          src="https://images.unsplash.com/photo-1558981403-c5f91cbba527?auto=format&fit=crop&w=1200&q=80" 
          alt="Biker" 
          className="w-full h-full object-cover brightness-[0.4]"
        />
        <div className="absolute inset-0 flex flex-col justify-center px-8">
          <h1 className="font-brand text-2xl md:text-4xl font-bold mb-2">
            MOTO<span className="text-orange-500">SPIRIT</span>
          </h1>
          <p className="text-slate-300 text-sm md:text-base max-w-sm mb-6">
            Váš inteligentní parťák na cestách i v garáži. Všechna data zůstávají ve vašem mobilu.
          </p>
          <div className="flex gap-3">
            <Link to="/planner" className="bg-orange-600 hover:bg-orange-700 px-5 py-2.5 rounded-xl font-bold text-sm transition-all">
              Plánovat
            </Link>
            <Link to="/assistant" className="bg-slate-700 hover:bg-slate-600 px-5 py-2.5 rounded-xl font-bold text-sm transition-all">
              AI Chat
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-slate-800 p-5 rounded-2xl border border-slate-700 flex items-center gap-4">
            <div className={`${stat.color} p-3 rounded-xl`}>
              <i className={`fas ${stat.icon} text-lg text-white`}></i>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{stat.label}</p>
              <p className="text-xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <i className="fas fa-map-location-dot text-6xl"></i>
        </div>
        <h2 className="text-lg font-bold mb-4">Lokální data & Soukromí</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Tato aplikace ukládá vaše motorky a servisní historii přímo do paměti tohoto zařízení. 
          AI model Gemini využíváme pouze pro analýzy a plánování, vaše osobní data neopouštějí telefon.
        </p>
      </div>
    </div>
  );
};

export default Home;
