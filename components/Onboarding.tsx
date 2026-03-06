import React, { useState } from 'react';
import { UserProfile, Motorcycle } from '../types';
import { checkProfileExists, authenticateProfile, syncDataToCloud } from '../services/syncService';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 2 state
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  
  // Step 3 state
  const [bikeBrand, setBikeBrand] = useState('');
  const [bikeModel, setBikeModel] = useState('');

  const handleNext = () => setStep(s => s + 1);

  const handleSaveProfile = async () => {
    if (!nickname.trim() || !email.trim() || !pin.trim()) {
      alert("Vyplň prosím všechna pole.");
      return;
    }
    
    setLoading(true);
    try {
      const emailLower = email.trim().toLowerCase();
      const exists = await checkProfileExists(emailLower);
      
      let user: UserProfile = {
        name: nickname,
        nickname: nickname,
        email: emailLower,
        pin: pin,
        experienceYears: 0,
        ridingStyle: 'Road',
        isPublic: true,
        publicBikes: true
      };

      if (exists) {
        const authenticated = await authenticateProfile(emailLower, pin);
        if (!authenticated) {
          alert("Tento e-mail už existuje a PIN nesouhlasí.");
          setLoading(false);
          return;
        }
        // If authenticated, we could fetch data, but let's just proceed for simplicity
        // The user can sync later in Garage
      }

      localStorage.setItem('motospirit_user', JSON.stringify(user));
      localStorage.setItem('motospirit_sync_code', emailLower);
      localStorage.setItem('motospirit_auth', 'true');
      
      handleNext();
    } catch (e) {
      console.error(e);
      alert("Něco se pokazilo. Zkus to znovu.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBike = () => {
    if (bikeBrand.trim() && bikeModel.trim()) {
      const newBike: Motorcycle = {
        id: Date.now().toString(),
        brand: bikeBrand,
        model: bikeModel,
        year: new Date().getFullYear(),
        vin: '',
        mileage: 0,
        lastServiceDate: new Date().toISOString().split('T')[0],
        lastServiceMileage: 0,
        serviceIntervalKm: 10000,
        serviceIntervalMonths: 12
      };
      localStorage.setItem('motospirit_bikes', JSON.stringify([newBike]));
    }
    handleNext();
  };

  const handleFinish = () => {
    localStorage.setItem('motospirit_onboarding_completed', 'true');
    window.dispatchEvent(new Event('storage'));
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
      
      {step === 1 && (
        <div className="max-w-md w-full space-y-8 animate-slideUp">
          <div className="bg-orange-600 w-24 h-24 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-orange-900/50">
            <i className="fas fa-helmet-safety text-white text-5xl"></i>
          </div>
          <div>
            <h1 className="text-4xl font-brand font-bold text-white tracking-tighter mb-4">
              MOTO<span className="text-orange-500">SPIRIT</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              Vítej v MotoSpirit. Tvůj digitální parťák na cesty, do garáže i pro setkávání s ostatními střelci.
            </p>
          </div>
          <button 
            onClick={handleNext}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-2xl font-bold text-lg uppercase tracking-widest transition-all shadow-xl shadow-orange-900/20 active:scale-95"
          >
            NASTARTOVAT
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-md w-full space-y-8 animate-slideUp">
          <div className="w-20 h-20 bg-slate-800 rounded-full mx-auto flex items-center justify-center border-2 border-slate-700">
            <i className="fas fa-cloud text-orange-500 text-3xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-brand font-bold text-white mb-2">Karta jezdce</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Nejdřív si vytvoříme profil. Zadej svůj e-mail a vymysli si PIN. Díky tomu se ti data bezpečně uloží na náš cloud a nepřijdeš o ně, ani když utopíš telefon.
            </p>
          </div>
          
          <div className="space-y-4 text-left">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Přezdívka</label>
              <input 
                type="text" 
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 px-4 text-white focus:border-orange-500 outline-none"
                placeholder="Např. Rossi46"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">E-mail (slouží jako přihlašovací jméno)</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 px-4 text-white focus:border-orange-500 outline-none"
                placeholder="tvuj@email.cz"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">PIN (4 čísla)</label>
              <input 
                type="password" 
                value={pin}
                onChange={e => setPin(e.target.value)}
                maxLength={4}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 px-4 text-white focus:border-orange-500 outline-none text-center tracking-[1em] text-xl"
                placeholder="••••"
              />
            </div>
          </div>

          <button 
            onClick={handleSaveProfile}
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all shadow-xl shadow-orange-900/20 active:scale-95 disabled:opacity-50"
          >
            {loading ? <i className="fas fa-spinner fa-spin"></i> : 'ZAPARKOVAT DO CLOUDU'}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-md w-full space-y-8 animate-slideUp">
          <div className="w-20 h-20 bg-slate-800 rounded-full mx-auto flex items-center justify-center border-2 border-slate-700">
            <i className="fas fa-motorcycle text-orange-500 text-3xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-brand font-bold text-white mb-2">První mašina</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Na čem jezdíš? Přidej svou první mašinu, ať ti můžeme hlídat servis a spotřebu. Detaily jako VIN nebo kilometry můžeš doplnit později v Garáži.
            </p>
          </div>
          
          <div className="space-y-4 text-left">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Značka</label>
              <input 
                type="text" 
                value={bikeBrand}
                onChange={e => setBikeBrand(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 px-4 text-white focus:border-orange-500 outline-none"
                placeholder="Např. Honda"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Model</label>
              <input 
                type="text" 
                value={bikeModel}
                onChange={e => setBikeModel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 px-4 text-white focus:border-orange-500 outline-none"
                placeholder="Např. Africa Twin"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={handleNext}
              className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 py-5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
            >
              PŘESKOČIT
            </button>
            <button 
              onClick={handleSaveBike}
              className="w-2/3 bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all shadow-xl shadow-orange-900/20 active:scale-95"
            >
              DO GARÁŽE
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="max-w-md w-full space-y-8 animate-slideUp">
          <div className="w-24 h-24 bg-emerald-500/20 rounded-full mx-auto flex items-center justify-center border-2 border-emerald-500/50">
            <i className="fas fa-flag-checkered text-emerald-500 text-4xl"></i>
          </div>
          <div>
            <h2 className="text-3xl font-brand font-bold text-white mb-4">Všechno je připraveno!</h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Garáž máš založenou, data jsou v bezpečí. Teď už můžeš plánovat trasy, sledovat radar nebo zapisovat tankování.
            </p>
          </div>
          
          <button 
            onClick={handleNext}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-2xl font-bold text-lg uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/20 active:scale-95 mt-8"
          >
            VYJET NA TRAŤ
          </button>
        </div>
      )}

      {step === 5 && (
        <div className="max-w-md w-full space-y-6 animate-slideUp text-left">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full mx-auto flex items-center justify-center border-2 border-blue-500/50 mb-4">
              <i className="fas fa-mobile-screen text-blue-500 text-2xl"></i>
            </div>
            <h2 className="text-2xl font-brand font-bold text-white mb-2">
              🛠️ Tip do garáže: Udělej si z MotoSpirit opravdovou appku!
            </h2>
            <p className="text-slate-400 text-sm">
              Aplikaci nemusíš hledat v prohlížeči. Hoď si ji rovnou na plochu telefonu mezi ostatní aplikace.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 space-y-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <i className="fab fa-apple text-slate-300 text-lg"></i> Pro Jablíčkáře (iPhone)
            </h3>
            <ol className="text-sm text-slate-400 space-y-2 ml-2 list-decimal list-inside">
              <li>Musíš být v prohlížeči <strong>Safari</strong>.</li>
              <li>Dole klikni na <strong>ikonu sdílení</strong> <i className="fas fa-arrow-up-from-bracket mx-1 text-slate-300"></i>.</li>
              <li>Vyber možnost <strong>"Přidat na plochu"</strong> <i className="fas fa-plus-square mx-1 text-slate-300"></i>.</li>
            </ol>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 space-y-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <i className="fab fa-android text-emerald-500 text-lg"></i> Pro Androiďáky
            </h3>
            <ol className="text-sm text-slate-400 space-y-2 ml-2 list-decimal list-inside">
              <li>Musíš být v prohlížeči <strong>Chrome</strong>.</li>
              <li>Nahoře klikni na <strong>tři tečky</strong> <i className="fas fa-ellipsis-vertical mx-1 text-slate-300"></i>.</li>
              <li>Vyber možnost <strong>"Přidat na plochu"</strong>.</li>
            </ol>
          </div>

          <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-4 flex gap-3 items-start">
            <i className="fas fa-triangle-exclamation text-red-500 mt-1"></i>
            <p className="text-xs text-red-200 leading-relaxed">
              <strong>Otevřel jsi odkaz z Facebooku, Messengeru nebo WhatsAppu?</strong> Tam to fungovat nebude! Musíš kliknout na tři tečky vpravo nahoře a vybrat <strong>"Otevřít v systémovém prohlížeči"</strong> (Safari/Chrome). Až pak si můžeš appku přidat na plochu.
            </p>
          </div>

          <button 
            onClick={handleFinish}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all shadow-xl shadow-orange-900/20 active:scale-95 mt-4"
          >
            ROZUMÍM, JDU JEZDIT
          </button>
        </div>
      )}

    </div>
  );
};

export default Onboarding;
