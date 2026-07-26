import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis } from 'recharts';
import { supabase } from '../services/supabaseClient';
import { Expedition } from '../types';

const SharedTrip: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [expedition, setExpedition] = useState<Expedition | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'info' | 'map' | 'checklist'>('info');
  const [checklist, setChecklist] = useState<any[]>([]);

  useEffect(() => {
    if (expedition && expedition.checklist) {
      setChecklist(expedition.checklist);
    }
  }, [expedition]);

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
    // In a real app, you would also save this to local storage or backend
  };

  const mapRef = useRef<any | null>(null);
  const polylineRef = useRef<any | null>(null);
  const gpxPolylineRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);

  const getDayDateText = (startDate: string | undefined, dayIndex: number) => {
    if (!startDate) return '';
    const parts = startDate.split('-');
    if (parts.length === 3) {
      const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      dateObj.setDate(dateObj.getDate() + dayIndex);
      return dateObj.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
    }
    return '';
  };

  useEffect(() => {
    const fetchSharedTrip = async () => {
      if (!slug) return;
      try {
        const { data, error } = await supabase
          .from('moto_shared_trips')
          .select('expedition_data')
          .eq('slug', slug)
          .single();

        if (error) throw error;
        if (data && data.expedition_data) {
           const expData = data.expedition_data;
           if (slug.startsWith('challenge-') && expData.route) {
             setExpedition(expData.route);
           } else {
             setExpedition(expData);
           }
        }
      } catch (e) {
        console.error("Error fetching shared trip:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchSharedTrip();
  }, [slug]);

  // Map Logic (similar to TripPlanner)
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !expedition || viewMode !== 'map') return;

    const initMap = () => {
      const mapEl = document.getElementById('shared-map');
      if (!mapEl || mapRef.current) return;
      mapRef.current = L.map('shared-map', { zoomControl: false, attributionControl: false }).setView([50, 15], 6);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
    };

    setTimeout(initMap, 100);
  }, [viewMode, expedition]);

  useEffect(() => {
    const L = (window as any).L;
    if (!mapRef.current || !L || !expedition) return;
    if (polylineRef.current) mapRef.current.removeLayer(polylineRef.current);
    if (gpxPolylineRef.current) mapRef.current.removeLayer(gpxPolylineRef.current);
    markersRef.current.forEach(m => mapRef.current.removeLayer(m));
    markersRef.current = [];

    const currentDay = expedition.days[activeDayIdx];
    if (currentDay) {
      const points = (currentDay.gpxRoute && currentDay.gpxRoute.length > 0) ? currentDay.gpxRoute : currentDay.waypoints;
      if (points && points.length > 0) {
        polylineRef.current = L.polyline(points, { 
          color: (currentDay.gpxRoute && currentDay.gpxRoute.length > 0) ? '#0ea5e9' : '#f97316', 
          weight: 4, 
          opacity: 0.8, 
          dashArray: (currentDay.gpxRoute && currentDay.gpxRoute.length > 0) ? '' : '10, 15',
          lineCap: 'round' 
        }).addTo(mapRef.current);
        const start = points[0];
        const end = points[points.length - 1];
        markersRef.current.push(L.circleMarker(start, { radius: 8, color: '#fff', weight: 3, fillColor: '#22c55e', fillOpacity: 1 }).addTo(mapRef.current));
        markersRef.current.push(L.circleMarker(end, { radius: 8, color: '#fff', weight: 3, fillColor: '#ef4444', fillOpacity: 1 }).addTo(mapRef.current));
        mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
      }
    }
  }, [activeDayIdx, expedition, viewMode]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
      <p className="text-slate-500 font-brand uppercase tracking-widest text-xs">Načítám expedici...</p>
    </div>
  );

  if (!expedition) return (
    <div className="text-center py-20 space-y-6">
      <i className="fas fa-ghost text-6xl text-slate-800"></i>
      <h2 className="text-xl font-brand font-bold text-white uppercase">Expedice nenalezena</h2>
      <p className="text-slate-500 text-sm">Tento odkaz již neexistuje nebo je neplatný.</p>
      <Link to="/" className="inline-block bg-orange-600 px-8 py-3 rounded-xl font-bold text-white">ZPĚT DOMŮ</Link>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <header className="text-center space-y-4">
        <div>
          <h1 className="text-3xl font-brand font-bold text-white uppercase tracking-tighter italic">{expedition.name}</h1>
          <div className="flex justify-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">
            {expedition.startDate && (
              <>
                <span className="text-orange-500">{new Date(expedition.startDate).toLocaleDateString('cs-CZ')}</span>
                <span>•</span>
              </>
            )}
            <span>{expedition.days.length} DNÍ</span>
            <span>•</span>
            <span>{expedition.travelersCount} LIDÉ</span>
          </div>
        </div>
        
        {expedition.discordLink && (
          <div className="flex justify-center">
            <a 
              href={expedition.discordLink}
              target="_blank"
              rel="noreferrer"
              className="bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/30 text-white px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-3 shadow-[0_0_15px_rgba(88,101,242,0.2)]"
            >
              <i className="fab fa-discord text-lg text-[#5865F2]"></i> PŘIPOJIT SE K VYSÍLAČCE
            </a>
          </div>
        )}
      </header>

      <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-slate-700 w-fit mx-auto">
        <button onClick={() => setViewMode('info')} className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'info' ? 'bg-orange-600 text-white' : 'text-slate-500'}`}>ITINERÁŘ</button>
        <button onClick={() => setViewMode('map')} className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-orange-600 text-white' : 'text-slate-500'}`}>MAPA</button>
        <button onClick={() => setViewMode('checklist')} className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === 'checklist' ? 'bg-orange-600 text-white' : 'text-slate-500'}`}>CHECKLIST</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto pb-4 lg:pb-0 scrollbar-hide">
          {expedition.days.map((day, idx) => (
            <button 
              key={idx}
              onClick={() => setActiveDayIdx(idx)}
              className={`shrink-0 lg:w-full p-6 rounded-[2rem] border transition-all flex flex-col items-center lg:items-start gap-1 ${activeDayIdx === idx ? 'bg-orange-600 border-orange-400 text-white shadow-xl' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'}`}
            >
              <span className="text-[10px] font-bold uppercase opacity-50">
                Den {expedition.startDate ? ` | ${getDayDateText(expedition.startDate, idx)}` : ''}
              </span>
              <span className="text-2xl font-brand font-bold leading-none">{day.dayNumber}</span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-8 space-y-6">
          {viewMode === 'info' ? (
            <div className="bg-slate-800 p-8 rounded-[3rem] border border-slate-700 shadow-2xl space-y-6">
              <div className="bg-slate-950/50 p-6 rounded-[2rem] border border-slate-700/50">
                {expedition.days[activeDayIdx].mapyCzUrl && (
                  <div className="mb-6 pb-6 border-b border-slate-700/50 flex justify-center">
                    <a 
                      href={expedition.days[activeDayIdx].mapyCzUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#cc0000]/10 hover:bg-[#cc0000]/20 border border-[#cc0000]/30 text-white px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-3 shadow-[0_0_15px_rgba(204,0,0,0.2)]"
                    >
                      <i className="fas fa-map-marked-alt text-[#cc0000] text-lg"></i> OTEVŘÍT TRASU V MAPY.CZ
                    </a>
                  </div>
                )}
                
                {expedition.days[activeDayIdx].elevationProfile && expedition.days[activeDayIdx].elevationProfile!.length > 0 && (
                  <div className="mb-6 pb-6 border-b border-slate-700/50">
                    <div className="flex flex-wrap justify-between gap-4 mb-4">
                      {expedition.days[activeDayIdx].startElevation !== undefined && (
                        <div>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Start</p>
                          <p className="text-sm font-bold text-slate-300">{expedition.days[activeDayIdx].startElevation} m</p>
                        </div>
                      )}
                      {expedition.days[activeDayIdx].maxElevation !== undefined && (
                        <div>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1 text-center">Nejvyšší bod</p>
                          <p className="text-sm font-bold text-sky-400 text-center"><i className="fas fa-mountain text-xs"></i> {expedition.days[activeDayIdx].maxElevation} m</p>
                        </div>
                      )}
                      {expedition.days[activeDayIdx].minElevation !== undefined && (
                        <div>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1 text-center">Nejnižší bod</p>
                          <p className="text-sm font-bold text-emerald-400 text-center"><i className="fas fa-water text-xs"></i> {expedition.days[activeDayIdx].minElevation} m</p>
                        </div>
                      )}
                      {expedition.days[activeDayIdx].endElevation !== undefined && (
                        <div className="text-right">
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Cíl</p>
                          <p className="text-sm font-bold text-slate-300">{expedition.days[activeDayIdx].endElevation} m</p>
                        </div>
                      )}
                    </div>
                    <div className="h-40 w-full mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={expedition.days[activeDayIdx].elevationProfile} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorElevationShared" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="dist" hide />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '12px' }}
                            labelStyle={{ color: '#94a3b8' }}
                            itemStyle={{ color: '#f97316', fontWeight: 'bold' }}
                            formatter={(value: number) => [`${value} m`, 'Výška']}
                            labelFormatter={(label) => `${label} km`}
                          />
                          <Area type="monotone" dataKey="ele" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorElevationShared)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                
                <div className="markdown-body prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed">
                  <Markdown>{expedition.days[activeDayIdx].description}</Markdown>
                </div>
              </div>
              
              {expedition.days[activeDayIdx].customAccommodation ? (
                <div className="bg-slate-900 p-6 rounded-3xl border border-blue-500/30 border-l-4 border-l-blue-500">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">Ubytování <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-[8px]">MOJE</span></h4>
                  <p className="text-sm font-bold text-white">{expedition.days[activeDayIdx].customAccommodation?.name}</p>
                  <p className="text-[9px] text-slate-600 uppercase font-bold mt-1">{expedition.days[activeDayIdx].customAccommodation?.type}</p>
                  {expedition.days[activeDayIdx].customAccommodation?.url && (
                    <a href={expedition.days[activeDayIdx].customAccommodation.url} target="_blank" rel="noreferrer" className="inline-block mt-3 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg border border-slate-700 text-[10px] font-bold uppercase transition-all">
                      ODKAZ <i className="fas fa-external-link-alt opacity-50 ml-1"></i>
                    </a>
                  )}
                </div>
              ) : expedition.days[activeDayIdx].accommodation ? (
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-700">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Plánované Ubytování</h4>
                  <p className="text-sm font-bold text-white">{expedition.days[activeDayIdx].accommodation?.name}</p>
                  <p className="text-[9px] text-slate-600 uppercase font-bold mt-1">{expedition.days[activeDayIdx].accommodation?.type}</p>
                </div>
              ) : null}
            </div>
          ) : viewMode === 'map' ? (
            <div className="h-[500px] bg-slate-800 rounded-[3rem] border border-slate-700 overflow-hidden relative shadow-2xl relative">
              <div id="shared-map" className="w-full h-full z-0"></div>
              <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/50 flex items-center gap-2 shadow-xl max-w-[200px] sm:max-w-xs">
                <i className={`fas ${(expedition.days[activeDayIdx]?.gpxRoute && expedition.days[activeDayIdx].gpxRoute.length > 0) ? 'fa-route text-teal-400' : 'fa-info-circle text-orange-400'} text-sm`}></i>
                <div className="text-left">
                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest leading-none mb-0.5">
                    {expedition.days[activeDayIdx]?.gpxRoute && expedition.days[activeDayIdx].gpxRoute.length > 0 ? "Přesná GPX trasa" : "Schématický náhled"}
                  </p>
                  <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider leading-tight">
                    {expedition.days[activeDayIdx]?.gpxRoute && expedition.days[activeDayIdx].gpxRoute.length > 0 ? "Vykreslena reálná data ze synchronizovaného GPX souboru." : "Nejedná se o přesnou trasu pro navigaci, pouze orientační."}
                  </p>
                </div>
              </div>
            </div>
          ) : viewMode === 'checklist' ? (
            <div className="bg-slate-800 p-8 rounded-[3rem] border border-slate-700 shadow-2xl space-y-8 animate-fadeIn">
              <div>
                <h3 className="text-2xl font-brand font-bold text-white uppercase tracking-tighter italic">Vybavení na cestu</h3>
                <p className="text-slate-400 text-sm mt-2">Personalizovaný seznam věcí vygenerovaný na základě destinace, trasy a preferencí tvé výpravy.</p>
              </div>
              
              {checklist && checklist.length > 0 ? (
                <div className="space-y-6">
                  {Array.from(new Set(checklist.map(item => item.category))).map(category => (
                    <div key={category} className="space-y-3">
                      <h4 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest pl-1">{category}</h4>
                      <div className="space-y-2">
                        {checklist.filter(i => i.category === category).map(item => (
                          <div 
                            key={item.id} 
                            onClick={() => toggleChecklistItem(item.id)}
                            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${item.checked ? 'bg-slate-900/50 border-slate-800 text-slate-500' : 'bg-slate-700/30 border-slate-600 hover:border-slate-500 text-slate-200'}`}
                          >
                            <div className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 transition-all ${item.checked ? 'bg-orange-500 border-orange-500' : 'border-slate-500'}`}>
                              {item.checked && <i className="fas fa-check text-white text-xs"></i>}
                            </div>
                            <span className={`font-bold text-sm ${item.checked ? 'line-through opacity-50' : ''}`}>{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-900/50 rounded-2xl p-6 text-center border border-slate-700/50">
                  <i className="fas fa-box-open text-3xl text-slate-600 mb-3"></i>
                  <p className="text-slate-400 text-sm font-bold">Pro tuto expedici nebyl checklist vygenerován.</p>
                </div>
              )}
            </div>
          ) : null}
          
          <div className="text-center">
            <Link to="/" className="text-orange-500 text-[10px] font-bold uppercase tracking-widest hover:underline">Vytvoř si vlastní expedici v MotoSpirit AI</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedTrip;
