
import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  const stats = [
    { label: 'Ujeto letos', value: '3,450 km', icon: 'fa-road', color: 'border-blue-500/50' },
    { label: 'Náklady', value: '12,500 Kč', icon: 'fa-coins', color: 'border-green-500/50' },
    { label: 'Příští servis', value: '1,200 km', icon: 'fa-tools', color: 'border-orange-500/50' },
  ];

  return (
    <div className="space-y-10 animate-fadeIn pb-10">
      {/* Hero Section */}
      <section className="relative h-[400px] rounded-[3rem] overflow-hidden shadow-2xl border border-slate-700">
        <img 
          src="https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?auto=format&fit=crop&w=1200&q=80" 
          alt="Motorcycle lifestyle" 
          className="w-full h-full object-cover brightness-[0.3]"
        />
        <div className="absolute inset-0 flex flex-col justify-center px-10 md:px-16">
          <div className="inline-block bg-orange-600 text-white text-[10px] font-bold px-3 py-1 rounded-full mb-4 w-fit tracking-widest uppercase">
            Rider Companion 1.0
          </div>
          <h1 className="font-brand text-4xl md:text-6xl font-bold mb-4 leading-tight">
            ŽIJ <span className="text-orange-500 italic">SVOJI</span><br/>CESTU
          </h1>
          <p className="text-slate-400 text-sm md:text-lg max-w-md mb-8 leading-relaxed">
            MotoSpirit je tvůj inteligentní deník a mechanik v kapse. Všechna data o tvých strojích máš bezpečně u sebe.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/planner" className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-orange-900/20 active:scale-95">
              PLÁNOVAT TRASU
            </Link>
            <Link to="/garage" className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-2xl font-bold transition-all border border-slate-700 active:scale-95">
              MOJE GARÁŽ
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className={`bg-slate-800/40 p-8 rounded-[2rem] border-l-4 ${stat.color} backdrop-blur-sm hover:bg-slate-800/60 transition-all`}>
            <div className="flex justify-between items-start mb-4">
              <i className={`fas ${stat.icon} text-slate-500 text-xl`}></i>
            </div>
            <p className="text-slate-500 text-xs uppercase font-bold tracking-widest mb-1">{stat.label}</p>
            <p className="text-3xl font-brand font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-8 rounded-[2.5rem] border border-slate-700 flex flex-col md:flex-row items-center gap-8">
        <div className="bg-orange-600/10 w-20 h-20 rounded-3xl flex items-center justify-center shrink-0">
          <i className="fas fa-shield-halved text-orange-500 text-3xl"></i>
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">Soukromí na prvním místě</h3>
          <p className="text-slate-400 text-sm">
            MotoSpirit neukládá tvé trasy ani data o motorce na žádný server. Vše zůstává v tvém prohlížeči. AI slouží pouze jako tvůj rádce v reálném čase.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
