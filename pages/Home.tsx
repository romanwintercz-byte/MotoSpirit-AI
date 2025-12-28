
import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  const stats = [
    { label: 'Ujeto letos', value: '3,450 km', icon: 'fa-road', color: 'bg-blue-500' },
    { label: 'Náklady', value: '12,500 Kč', icon: 'fa-coins', color: 'bg-green-500' },
    { label: 'Servis za', value: '1,200 km', icon: 'fa-tools', color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Section */}
      <section className="relative h-64 md:h-96 rounded-3xl overflow-hidden shadow-2xl">
        <img 
          src="https://images.unsplash.com/photo-1558981403-c5f91cbba527?auto=format&fit=crop&w=1200&q=80" 
          alt="Biker on road" 
          className="w-full h-full object-cover brightness-50"
        />
        <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16">
          <h1 className="font-brand text-3xl md:text-5xl font-bold mb-4">
            CESTUJ CHYTŘEJI,<br />JEZDI <span className="text-orange-500">RYCHLEJI</span>
          </h1>
          <p className="text-slate-200 text-lg md:text-xl max-w-xl mb-6">
            Tvůj osobní AI společník pro každou zatáčku. Plánuj trasy, sleduj servis a získej expertní rady.
          </p>
          <div className="flex gap-4">
            <Link to="/planner" className="bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-xl font-bold transition-all transform hover:scale-105">
              Naplánovat jízdu
            </Link>
            <Link to="/garage" className="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-xl font-bold transition-all">
              Moje Garáž
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex items-center gap-4">
            <div className={`${stat.color} p-4 rounded-xl`}>
              <i className={`fas ${stat.icon} text-2xl text-white`}></i>
            </div>
            <div>
              <p className="text-slate-400 text-sm">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Weather & News Mockup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Dnes je ideálně na jízdu</h2>
            <span className="text-orange-500 font-semibold">Praha, 22°C</span>
          </div>
          <div className="flex justify-around py-4">
            {[10, 12, 14, 16, 18].map(hour => (
              <div key={hour} className="text-center">
                <p className="text-slate-400 text-sm">{hour}:00</p>
                <i className="fas fa-sun text-yellow-500 my-2"></i>
                <p className="font-bold">22°</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <h2 className="text-xl font-bold mb-4">Poslední aktivita</h2>
          <div className="space-y-4">
            <div className="flex gap-4 items-center p-3 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer">
              <div className="w-12 h-12 bg-slate-600 rounded-lg flex items-center justify-center">
                <i className="fas fa-route text-orange-500"></i>
              </div>
              <div>
                <p className="font-semibold">Vyjížďka na Křivoklát</p>
                <p className="text-sm text-slate-400">Před 2 dny • 142 km</p>
              </div>
            </div>
            <div className="flex gap-4 items-center p-3 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer">
              <div className="w-12 h-12 bg-slate-600 rounded-lg flex items-center justify-center">
                <i className="fas fa-oil-can text-blue-500"></i>
              </div>
              <div>
                <p className="font-semibold">Výměna oleje - BMW S1000RR</p>
                <p className="text-sm text-slate-400">Před 1 týdnem • 15,200 km</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
