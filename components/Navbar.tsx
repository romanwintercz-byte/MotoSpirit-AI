
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserProfile } from '../types';

interface NavbarProps {
  hasNewChallenge?: boolean;
}

const CURRENT_VERSION = '1.3.0';
const CHANGELOG = [
  {
    version: '1.3.0',
    date: '6. 3. 2026',
    changes: [
      'Možnost ODSTARTOVAT uloženou expedici z Plánovače.',
      'Sledování aktivní expedice a ujeté vzdálenosti pomocí GPS.',
      'Rychlé zadávání výdajů přímo z banneru aktivní expedice.',
      'Propojení výdajů a tankování s probíhající expedicí v Knize jízd.',
      'Nová kategorie výdajů: Mýto / Dálnice.'
    ]
  },
  {
    version: '1.2.0',
    date: '6. 3. 2026',
    changes: [
      'Přidán Uvítací průvodce pro nové jezdce (rychlé založení profilu a motorky).',
      'Návod na přidání aplikace na plochu telefonu (Add to Home Screen).',
      'Plánovač tras nyní podporuje přidávání průjezdních bodů.',
      'Hlasové zadávání cílů a průjezdních bodů v Plánovači (ikonka mikrofonu).'
    ]
  },
  {
    version: '1.1.0',
    date: '28. 2. 2026',
    changes: [
      'Zobrazení fotek motorek v Radaru (pokud to uživatel povolí v Garáži).',
      'Přidán seznam posledních úprav (tento panel).',
      'Vylepšené generování tras v Plánovači (AI nyní lépe chápe geografii a nedělá nesmyslné zajížďky).',
      'Export celé expedice do jednoho GPX souboru.',
      'Rychlá tlačítka pro ladění trasy s AI.'
    ]
  },
  {
    version: '1.0.0',
    date: '25. 2. 2026',
    changes: [
      'Spuštění aplikace MotoSpirit.',
      'Základní funkce: Garáž, Kniha jízd, Radar, Plánovač tras.',
      'AI Asistent pro motorkáře.'
    ]
  }
];

const Navbar: React.FC<NavbarProps> = ({ hasNewChallenge }) => {
  const location = useLocation();
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('motospirit_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [showChangelog, setShowChangelog] = useState(false);
  const [hasNewUpdates, setHasNewUpdates] = useState(() => {
    const lastSeen = localStorage.getItem('motospirit_last_changelog');
    return lastSeen !== CURRENT_VERSION;
  });

  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem('motospirit_user');
      if (saved) setUser(JSON.parse(saved));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  
  const openChangelog = () => {
    setShowChangelog(true);
    setHasNewUpdates(false);
    localStorage.setItem('motospirit_last_changelog', CURRENT_VERSION);
  };

  const navItems = [
    { path: '/', label: 'Domů', icon: 'fa-home' },
    { path: '/garage', label: 'Garáž', icon: 'fa-motorcycle' },
    { path: '/radar', label: 'Radar', icon: 'fa-satellite-dish', hasNotification: hasNewChallenge },
    { path: '/logbook', label: 'Kniha jízd', icon: 'fa-book' },
    { path: '/planner', label: 'Plánovač', icon: 'fa-map-location-dot' },
    { path: '/assistant', label: 'AI Asistent', icon: 'fa-robot' },
  ];

  return (
    <>
    <nav className="bg-slate-800 border-b border-slate-700 py-4 px-6 sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center gap-3">
          <div className="bg-orange-600 p-2 rounded-lg">
            <i className="fas fa-helmet-safety text-white text-xl"></i>
          </div>
          <span className="font-brand text-2xl font-bold tracking-tighter text-white">
            MOTO<span className="text-orange-500">SPIRIT</span>
          </span>
        </Link>
        
        <div className="hidden lg:flex gap-6">
          {navItems.map(item => (
            <Link 
              key={item.path}
              to={item.path} 
              className={`flex items-center gap-2 font-semibold transition-colors text-sm relative ${
                location.pathname === item.path ? 'text-orange-500' : 'text-slate-300 hover:text-white'
              }`}
            >
              <div className="relative">
                <i className={`fas ${item.icon}`}></i>
                {item.hasNotification && (
                  <span className="absolute -top-1 -right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </div>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={openChangelog}
            className="relative bg-slate-700 hover:bg-slate-600 p-2 rounded-xl transition-colors flex items-center justify-center text-slate-300 hover:text-white w-10 h-10"
            title="Novinky a úpravy"
          >
            <i className="fas fa-bell"></i>
            {hasNewUpdates && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-slate-800 rounded-full animate-pulse"></span>
            )}
          </button>

          <Link to="/logbook" className="hidden sm:flex bg-slate-700 hover:bg-slate-600 p-2 px-4 rounded-xl transition-colors items-center gap-2 text-xs font-bold">
            <i className="fas fa-gas-pump text-orange-500"></i>
            TANKOVAT
          </Link>
          <Link to="/garage" className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center font-bold text-white overflow-hidden border-2 border-slate-700 shadow-lg">
            {user?.avatar ? (
              <img src={user.avatar} alt="Me" className="w-full h-full object-cover" />
            ) : (
              user?.name ? user.name[0].toUpperCase() : 'R'
            )}
          </Link>
        </div>
      </div>
    </nav>

    {/* Changelog Modal */}
    {showChangelog && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setShowChangelog(false)}>
        <div className="bg-slate-900 border border-slate-700 rounded-[2rem] p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto animate-slideUp shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-brand font-bold text-white uppercase tracking-tight flex items-center gap-3">
              <i className="fas fa-bullhorn text-orange-500"></i> Novinky a úpravy
            </h2>
            <button onClick={() => setShowChangelog(false)} className="text-slate-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full bg-slate-800">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="space-y-8">
            {CHANGELOG.map((log, idx) => (
              <div key={idx} className="relative pl-6 border-l-2 border-slate-800">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-900 border-2 border-orange-500"></div>
                <div className="flex items-baseline gap-3 mb-3">
                  <h3 className="text-lg font-bold text-white">Verze {log.version}</h3>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{log.date}</span>
                </div>
                <ul className="space-y-3">
                  {log.changes.map((change, cIdx) => (
                    <li key={cIdx} className="text-sm text-slate-300 flex items-start gap-3 leading-relaxed">
                      <i className="fas fa-check text-emerald-500 mt-1 text-[10px]"></i>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default Navbar;
