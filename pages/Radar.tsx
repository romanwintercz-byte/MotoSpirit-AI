
import React, { useState, useEffect, useRef } from 'react';
import { searchNearbyPOI } from '../services/geminiService';
import { POI } from '../types';

const Radar: React.FC = () => {
  const [locationName, setLocationName] = useState('');
  const [gpsLocation, setGpsLocation] = useState<{ lat: number, lon: number } | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('zajímavá místa');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  
  const mapRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);

  const categories = [
    { label: 'Body zájmu', val: 'zajímavá místa', icon: 'fa-star', color: 'text-orange-500' },
    { label: 'Jídlo', val: 'restaurace s terasou a parkovištěm', icon: 'fa-utensils', color: 'text-green-500' },
    { label: 'Servis', val: 'moto servis a opravna', icon: 'fa-screwdriver-wrench', color: 'text-blue-500' },
    { label: 'Benzín', val: 'čerpací stanice s kávou a kompresorem', icon: 'fa-gas-pump', color: 'text-yellow-500' },
    { label: 'Výhledy', val: 'vyhlídky a panoramata', icon: 'fa-mountain', color: 'text-purple-500' },
  ];

  const handleSearch = async (overriddenCat?: string) => {
    setLoading(true);
    const cat = overriddenCat || activeCategory;
    try {
      let results: POI[] = [];
      if (locationName.trim()) {
        results = await searchNearbyPOI(cat, undefined, undefined, locationName);
      } else {
        if (!gpsLocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
              setGpsLocation(coords);
              const res = await searchNearbyPOI(cat, coords.lat, coords.lon);
              setPois(res);
              setLoading(false);
            },
            () => {
              setLoading(false);
              alert("Zadejte prosím místo manuálně nebo povolte GPS.");
            }
          );
          return;
        }
        results = await searchNearbyPOI(cat, gpsLocation.lat, gpsLocation.lon);
      }
      setPois(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateCategory = (cat: string) => {
    setActiveCategory(cat);
    handleSearch(cat);
  };

  // Map Initialization
  useEffect(() => {
    const L = (window as any).L;
    const mapEl = document.getElementById('radar-map');
    if (!L || !mapEl || mapRef.current || viewMode !== 'map') return;

    const mapInstance = L.map('radar-map', { zoomControl: false, attributionControl: false })
      .setView([gpsLocation?.lat || 50.08, gpsLocation?.lon || 14.43], 13);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapInstance);
    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);
    mapRef.current = mapInstance;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [viewMode]);

  // Markers Update
  useEffect(() => {
    const L = (window as any).L;
    if (!mapRef.current || !L) return;

    markersRef.current.forEach(m => mapRef.current?.removeLayer(m));
    markersRef.current = [];

    pois.forEach(poi => {
      const getPoiColor = (type: string) => {
        if (type === 'gas') return 'bg-yellow-500';
        if (type === 'food') return 'bg-green-500';
        if (type === 'service') return 'bg-blue-600';
        if (type === 'view') return 'bg-purple-600';
        return 'bg-orange-600';
      };

      const iconHtml = `
        <div class="${getPoiColor(poi.type)} w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shadow-lg transform -translate-x-1/2 -translate-y-1/2 scale-110">
          <i class="fas ${poi.type === 'gas' ? 'fa-gas-pump' : poi.type === 'food' ? 'fa-utensils' : poi.type === 'service' ? 'fa-screwdriver-wrench' : 'fa-location-dot'} text-white text-[10px]"></i>
        </div>
      `;
      const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [0, 0] });
      const marker = L.marker([poi.lat, poi.lon], { icon }).addTo(mapRef.current);
      marker.bindPopup(`
        <div class="p-2 text-slate-900 min-w-[150px]">
          <b class="text-sm font-bold uppercase font-brand">${poi.name}</b>
          <p class="text-[10px] mt-1 text-slate-600 leading-tight">${poi.description}</p>
          <div class="mt-2 flex flex-col gap-1">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lon}" target="_blank" class="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase text-center">Navigovat</a>
          </div>
        </div>
      `);
      markersRef.current.push(marker);
    });

    if (pois.length > 0) {
      const group = L.featureGroup(markersRef.current);
      mapRef.current.fitBounds(group.getBounds().pad(0.2));
    }
  }, [pois, viewMode]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12 px-2 md:px-0">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold font-brand uppercase text-white">SPIRIT <span className="text-orange-500">RADAR</span></h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest italic opacity-70">Skenuj okolí nebo cílové město</p>
        </div>
        
        <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700 shadow-xl">
          <button onClick={() => setViewMode('list')} className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>SEZNAM</button>
          <button onClick={() => setViewMode('map')} className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>MAPA</button>
        </div>
      </header>

      {/* Location Search Input */}
      <div className="bg-slate-800/80 p-4 rounded-3xl border border-slate-700 shadow-xl flex gap-3">
        <div className="flex-grow relative">
           <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
           <input 
            type="text" 
            placeholder="Kde mám hledat? (např. Jičín, cílová rovinka...)" 
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 pl-10 pr-4 outline-none focus:border-orange-500 text-sm text-white font-semibold transition-all"
           />
        </div>
        <button 
          onClick={() => handleSearch()}
          disabled={loading}
          className="bg-orange-600 hover:bg-orange-700 w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90 disabled:opacity-50"
        >
          {loading ? <i className="fas fa-sync animate-spin text-white"></i> : <i className="fas fa-satellite-dish text-white"></i>}
        </button>
      </div>

      {/* Radar Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
        {categories.map((cat) => (
          <button
            key={cat.val}
            onClick={() => updateCategory(cat.val)}
            className={`snap-center shrink-0 px-6 py-4 rounded-2xl border transition-all flex items-center gap-3 font-bold text-xs uppercase tracking-tighter shadow-lg ${
              activeCategory === cat.val 
                ? 'bg-orange-600 border-orange-400 text-white scale-105 z-10' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            <i className={`fas ${cat.icon} ${activeCategory === cat.val ? 'text-white' : cat.color}`}></i>
            {cat.label}
          </button>
        ))}
      </div>

      {loading && pois.length === 0 && (
        <div className="bg-slate-800/80 p-10 rounded-[2rem] border border-orange-500/30 flex flex-col items-center gap-6 text-center animate-pulse">
           <div className="relative">
             <div className="w-20 h-20 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
             <i className="fas fa-radar absolute inset-0 flex items-center justify-center text-white text-xl"></i>
           </div>
           <div>
              <p className="font-brand font-bold uppercase text-white">Analyzuji mapy...</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Hledám nejlepší místa pro vaši jízdu</p>
           </div>
        </div>
      )}

      {pois.length === 0 && !loading && (
        <div className="bg-slate-800/80 p-12 rounded-[2.5rem] border border-slate-700 shadow-xl text-center space-y-6">
          <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto border-2 border-orange-500/30 opacity-50">
            <i className="fas fa-map-pin text-slate-600 text-3xl"></i>
          </div>
          <div className="max-w-xs mx-auto space-y-2">
            <h3 className="font-brand font-bold uppercase text-white opacity-70">Radar připraven</h3>
            <p className="text-slate-500 text-xs">Zadejte lokalitu nahoře nebo klikněte na kategorii pro skenování okolí přes GPS.</p>
          </div>
        </div>
      )}

      {/* Results View */}
      {pois.length > 0 && (
        <div className="space-y-6">
          {viewMode === 'map' ? (
            <div className="bg-slate-800 p-2 rounded-[2.5rem] border border-slate-700 shadow-2xl relative min-h-[450px]">
              <div id="radar-map" className="w-full h-[550px] z-0 rounded-[2rem] bg-slate-900"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pois.map((poi, idx) => (
                <div key={idx} className="bg-slate-800 border border-slate-700 rounded-[2rem] overflow-hidden group hover:border-orange-500/50 transition-all shadow-xl animate-slideUp" style={{ animationDelay: `${idx * 0.1}s` }}>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-lg font-brand font-bold text-white uppercase leading-tight group-hover:text-orange-500 transition-colors">{poi.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-orange-500 font-bold text-[10px] uppercase tracking-widest">{poi.rating || '⭐⭐⭐⭐'}</span>
                          <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">• {poi.type === 'gas' ? 'Benzín' : poi.type === 'food' ? 'Gastronomie' : poi.type === 'service' ? 'Moto Servis' : 'Zastávka'}</span>
                        </div>
                      </div>
                      <div className="bg-slate-900 w-10 h-10 rounded-xl flex items-center justify-center border border-slate-700">
                        <i className={`fas ${poi.type === 'gas' ? 'fa-gas-pump text-yellow-500' : poi.type === 'food' ? 'fa-utensils text-green-500' : poi.type === 'service' ? 'fa-screwdriver-wrench text-blue-500' : 'fa-camera text-purple-500'} text-sm`}></i>
                      </div>
                    </div>

                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{poi.description}</p>

                    {poi.bikerTip && (
                      <div className="bg-slate-900/50 border border-slate-700/50 p-3 rounded-xl flex gap-3">
                        <i className="fas fa-helmet-safety text-orange-500 text-xs mt-0.5"></i>
                        <p className="text-[10px] text-slate-300 font-medium italic">{poi.bikerTip}</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                       <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lon}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold text-[10px] uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-orange-900/20"
                       >
                         <i className="fas fa-location-arrow"></i> NAVIGOVAT
                       </a>
                       {poi.url && (
                         <a 
                          href={poi.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex-1 bg-slate-900 border border-slate-700 hover:border-orange-500/50 text-white py-3 rounded-xl font-bold text-[10px] uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
                         >
                           <i className="fas fa-info-circle text-blue-500"></i> DETAIL
                         </a>
                       )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Radar;
