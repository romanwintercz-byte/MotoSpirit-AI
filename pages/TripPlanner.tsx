
import React, { useState } from 'react';
import { planTripWithGrounding } from '../services/geminiService';

const TripPlanner: React.FC = () => {
  const [origin, setOrigin] = useState('Praha');
  const [preferences, setPreferences] = useState('Zatáčky, pěkné vyhlídky, málo provozu');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ text: string, links: any[] } | null>(null);

  const handlePlan = async () => {
    setLoading(true);
    try {
      let location = undefined;
      if ("geolocation" in navigator) {
        const pos = await new Promise<GeolocationPosition>((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej)
        ).catch(() => null);
        
        if (pos) {
          location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }
      }

      const plan = await planTripWithGrounding(origin, preferences, location);
      setResult(plan);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold font-brand">AI <span className="text-orange-500">PLÁNOVAČ</span> TRAS</h1>
        <p className="text-slate-400">Nech si navrhnout trasu snů s využitím živých dat z Google Maps.</p>
      </div>

      <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400 uppercase">Startovní bod</label>
            <div className="relative">
              <i className="fas fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
              <input 
                type="text" 
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Město nebo adresa..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400 uppercase">Preference</label>
            <div className="relative">
              <i className="fas fa-sliders absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
              <input 
                type="text" 
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                placeholder="Zatáčky, vyhlídky, kavárny..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <button 
          onClick={handlePlan}
          disabled={loading}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all disabled:opacity-50"
        >
          {loading ? (
            <i className="fas fa-spinner fa-spin"></i>
          ) : (
            <i className="fas fa-map-marked-alt"></i>
          )}
          {loading ? 'Generuji trasu...' : 'Vygenerovat AI trasu'}
        </button>
      </div>

      {result && (
        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 space-y-6 animate-slideUp">
          <div className="prose prose-invert max-w-none">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <i className="fas fa-flag-checkered text-orange-500"></i> Tvůj itinerář
            </h2>
            <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
              {result.text}
            </div>
          </div>

          {result.links.length > 0 && (
            <div className="pt-6 border-t border-slate-700">
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Zdroje a místa na mapě</h3>
              <div className="flex flex-wrap gap-3">
                {result.links.map((chunk: any, i: number) => {
                  const place = chunk.googleSearchRetrievalMetadata || chunk.maps;
                  if (!place) return null;
                  return (
                    <a 
                      key={i} 
                      href={place.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-slate-900 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors"
                    >
                      <i className="fas fa-external-link-alt text-xs text-orange-500"></i>
                      {place.title || 'Zobrazit na mapě'}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommended Routes Cards (Mockup) */}
      {!result && !loading && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Populární trasy v okolí</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex gap-4 cursor-pointer hover:border-orange-500 transition-all">
              <img src="https://picsum.photos/seed/moto1/100/100" className="rounded-xl object-cover w-20 h-20" alt="Route" />
              <div>
                <p className="font-bold">Šumavské serpentiny</p>
                <p className="text-xs text-slate-400">180 km • Střední náročnost</p>
                <div className="flex gap-1 mt-1">
                  {[1,2,3,4,5].map(s => <i key={s} className="fas fa-star text-orange-500 text-[10px]"></i>)}
                </div>
              </div>
            </div>
            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex gap-4 cursor-pointer hover:border-orange-500 transition-all">
              <img src="https://picsum.photos/seed/moto2/100/100" className="rounded-xl object-cover w-20 h-20" alt="Route" />
              <div>
                <p className="font-bold">Kolem Sázavy</p>
                <p className="text-xs text-slate-400">120 km • Snadná vyjížďka</p>
                <div className="flex gap-1 mt-1">
                  {[1,2,3,4].map(s => <i key={s} className="fas fa-star text-orange-500 text-[10px]"></i>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripPlanner;
