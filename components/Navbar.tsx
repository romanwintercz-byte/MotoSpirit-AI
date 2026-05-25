
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserProfile } from '../types';
import { submitFeedback } from '../services/syncService';

interface NavbarProps {
  hasNewChallenge?: boolean;
}

const CURRENT_VERSION = '1.7.0';
const CHANGELOG = [
  {
    version: '1.7.0',
    date: '25. 5. 2026',
    changes: [
      'Vybraní jezdci pro výzvy: Při vyhlašování výzvy nyní můžeš označit konkrétní jezdce z komunity, kterým chceš vyjížďku nabídnout.',
    ]
  },
  {
    version: '1.6.0',
    date: '25. 5. 2026',
    changes: [
      'Nové statistiky v Knize jízd: přehledné grafy měsíčních i ročních nákladů a sledování vývoje ceny benzínu.',
      'Přesnější rozpočty v Plánovači: rozpočty expedice jsou nyní jasně označeny a vždy počítány striktně pro jednu osobu.',
      'Vylepšené ovládání Plánovače: detaily a mapa u jednotlivých dnů expedice jdou nyní jednoduše schovat opětovným kliknutím.'
    ]
  },
  {
    version: '1.5.0',
    date: '7. 3. 2026',
    changes: [
      'Nové sdílení tras: Nyní můžeš sdílet trasy přímo přes WhatsApp, Messenger nebo SMS pomocí nativního menu telefonu.',
      'Vylepšené plánování vyjížděk: AI nyní správně chápe, že plánuješ vyjížďku na hodiny, nikoliv na dny.',
      'Zjednodušení aplikace: Odstraněna interní Moto Pošta pro rychlejší a spolehlivější chod aplikace.'
    ]
  },
  {
    version: '1.4.0',
    date: '6. 3. 2026',
    changes: [
      'Napsat vývojáři: Nové tlačítko (🐞) pro snadné odesílání nápadů a hlášení chyb.',
      'Sjednocení upozornění: Všechny pozdravy, zprávy a sdílené trasy najdeš na jednom místě.'
    ]
  },
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
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState('idea');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) return;
    setFeedbackSending(true);
    const syncCode = localStorage.getItem('motospirit_sync_code') || 'UNKNOWN';
    const success = await submitFeedback(syncCode, feedbackType, feedbackText);
    setFeedbackSending(false);
    if (success) {
      alert('Díky za zprávu! Vývojář byl informován.');
      setShowFeedback(false);
      setFeedbackText('');
    } else {
      alert('Něco se pokazilo, zkus to prosím znovu.');
    }
  };

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

        <div className="flex items-center gap-3 sm:gap-4">
          {user?.email?.toLowerCase() === 'roman.winter.cz@gmail.com' && (
            <Link 
              to="/dev-console"
              className="hidden lg:flex bg-slate-700 hover:bg-slate-600 p-2 rounded-xl transition-colors items-center justify-center text-slate-300 hover:text-white w-10 h-10"
              title="Vývojářská konzole"
            >
              <i className="fas fa-terminal"></i>
            </Link>
          )}

          <button 
            onClick={() => setShowFeedback(true)}
            className="hidden lg:flex bg-slate-700 hover:bg-slate-600 p-2 rounded-xl transition-colors items-center justify-center text-slate-300 hover:text-white w-10 h-10"
            title="Napsat vývojáři"
          >
            <i className="fas fa-bug"></i>
          </button>

          <button 
            onClick={openChangelog}
            className="hidden lg:flex relative bg-slate-700 hover:bg-slate-600 p-2 rounded-xl transition-colors items-center justify-center text-slate-300 hover:text-white w-10 h-10 shrink-0"
            title="Novinky a úpravy"
          >
            <i className="fas fa-bell"></i>
            {hasNewUpdates && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-slate-800 rounded-full animate-pulse"></span>
            )}
          </button>

          <Link to="/logbook" className="hidden lg:flex bg-slate-700 hover:bg-slate-600 p-2 px-4 rounded-xl transition-colors items-center gap-2 text-xs font-bold shrink-0">
            <i className="fas fa-gas-pump text-orange-500"></i>
            TANKOVAT
          </Link>

          <button 
            onClick={() => setShowMobileMenu(true)}
            className="flex lg:hidden bg-slate-700 hover:bg-slate-600 p-2 rounded-xl transition-colors items-center justify-center text-slate-300 hover:text-white w-10 h-10 relative shrink-0"
          >
            <i className="fas fa-bars"></i>
            {hasNewUpdates && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-slate-800 rounded-full animate-pulse"></span>
            )}
          </button>
          
          <Link to="/garage" className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center font-bold text-white overflow-hidden border-2 border-slate-700 shadow-lg shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} alt="Me" className="w-full h-full object-cover" />
            ) : (
              user?.name ? user.name[0].toUpperCase() : 'R'
            )}
          </Link>
        </div>
      </div>
    </nav>

    {/* Mobile Menu Modal */}
    {showMobileMenu && (
      <div className="fixed inset-0 z-[200] flex lg:hidden bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setShowMobileMenu(false)}>
        <div className="absolute right-0 top-0 bottom-0 w-64 bg-slate-900 border-l border-slate-700 p-6 animate-slideLeft shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-brand font-bold text-white uppercase tracking-tight">
              Menu
            </h2>
            <button onClick={() => setShowMobileMenu(false)} className="text-slate-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full bg-slate-800">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <Link 
              to="/logbook" 
              onClick={() => setShowMobileMenu(false)}
              className="bg-slate-800 hover:bg-slate-700 p-4 rounded-xl transition-colors flex items-center gap-4 text-sm font-bold text-white"
            >
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <i className="fas fa-gas-pump text-orange-500"></i>
              </div>
              TANKOVAT
            </Link>

            <button 
              onClick={() => {
                setShowMobileMenu(false);
                openChangelog();
              }}
              className="bg-slate-800 hover:bg-slate-700 p-4 rounded-xl transition-colors flex items-center gap-4 text-sm font-bold text-white relative"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                <i className="fas fa-bell text-slate-300"></i>
              </div>
              Novinky a úpravy
              {hasNewUpdates && (
                <span className="absolute right-4 w-3 h-3 bg-red-500 border-2 border-slate-800 rounded-full animate-pulse"></span>
              )}
            </button>

            <button 
              onClick={() => {
                setShowMobileMenu(false);
                setShowFeedback(true);
              }}
              className="bg-slate-800 hover:bg-slate-700 p-4 rounded-xl transition-colors flex items-center gap-4 text-sm font-bold text-white"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                <i className="fas fa-bug text-slate-300"></i>
              </div>
              Napsat vývojáři
            </button>

            {user?.email?.toLowerCase() === 'roman.winter.cz@gmail.com' && (
              <Link 
                to="/dev-console"
                onClick={() => setShowMobileMenu(false)}
                className="bg-slate-800 hover:bg-slate-700 p-4 rounded-xl transition-colors flex items-center gap-4 text-sm font-bold text-white"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                  <i className="fas fa-terminal text-slate-300"></i>
                </div>
                Vývojářská konzole
              </Link>
            )}
          </div>
          
          <div className="mt-auto pt-8 border-t border-slate-800">
            <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest font-bold">
              MotoSpirit v{CURRENT_VERSION}
            </p>
          </div>
        </div>
      </div>
    )}

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
    {/* Feedback Modal */}
    {showFeedback && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setShowFeedback(false)}>
        <div className="bg-slate-900 border border-slate-700 rounded-[2rem] p-6 w-full max-w-md animate-slideUp shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-brand font-bold text-white uppercase tracking-tight flex items-center gap-3">
              <i className="fas fa-bug text-orange-500"></i> Napsat vývojáři
            </h2>
            <button onClick={() => setShowFeedback(false)} className="text-slate-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full bg-slate-800">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Typ zprávy</label>
              <select 
                value={feedbackType}
                onChange={e => setFeedbackType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 outline-none focus:border-orange-500 text-sm text-white mt-1"
              >
                <option value="idea">💡 Nápad na zlepšení</option>
                <option value="bug">🐞 Nahlásit chybu</option>
                <option value="other">💬 Jen tak pozdravit</option>
              </select>
            </div>
            
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Tvoje zpráva</label>
              <textarea 
                rows={4}
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                placeholder="Co máš na srdci?"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 outline-none focus:border-orange-500 text-sm text-white mt-1 resize-none"
              ></textarea>
            </div>

            <button 
              onClick={handleSendFeedback}
              disabled={feedbackSending || !feedbackText.trim()}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {feedbackSending ? (
                <><i className="fas fa-spinner fa-spin"></i> ODESÍLÁM...</>
              ) : (
                <><i className="fas fa-paper-plane"></i> ODESLAT ZPRÁVU</>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default Navbar;
