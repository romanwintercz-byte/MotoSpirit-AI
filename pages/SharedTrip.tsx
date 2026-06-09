import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import { supabase } from '../services/supabaseClient';
import { Expedition } from '../types';

const SharedTrip: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [expedition, setExpedition] = useState<Expedition | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'info' | 'map'>('info');

  const mapRef = useRef<any | null>(null);
  const polylineRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);

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
    markersRef.current.forEach(m => mapRef.current.removeLayer(m));
    markersRef.current = [];

    const currentDay = expedition.days[activeDayIdx];
    if (currentDay && currentDay.waypoints.length > 0) {
      polylineRef.current = L.polyline(currentDay.waypoints, { color: '#f97316', weight: 4, opacity: 0.6, dashArray: '10, 15', lineCap: 'round' }).addTo(mapRef.current);
      const start = currentDay.waypoints[0];
      const end = currentDay.waypoints[currentDay.waypoints.length - 1];
      markersRef.current.push(L.circleMarker(start, { radius: 8, color: '#fff', weight: 3, fillColor: '#22c55e', fillOpacity: 1 }).addTo(mapRef.current));
      markersRef.current.push(L.circleMarker(end, { radius: 8, color: '#fff', weight: 3, fillColor: '#ef4444', fillOpacity: 1 }).addTo(mapRef.current));
      mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto pb-4 lg:pb-0 scrollbar-hide">
          {expedition.days.map((day, idx) => (
            <button 
              key={idx}
              onClick={() => setActiveDayIdx(idx)}
              className={`shrink-0 lg:w-full p-6 rounded-[2rem] border transition-all flex flex-col items-center lg:items-start gap-1 ${activeDayIdx === idx ? 'bg-orange-600 border-orange-400 text-white shadow-xl' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
            >
              <span className="text-[10px] font-bold uppercase opacity-50">Den</span>
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
                <div className="markdown-body prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed">
                  <Markdown>{expedition.days[activeDayIdx].description}</Markdown>
                </div>
              </div>
              
              {expedition.days[activeDayIdx].accommodation && (
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-700">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Ubytování</h4>
                  <p className="text-sm font-bold text-white">{expedition.days[activeDayIdx].accommodation?.name}</p>
                  <p className="text-[9px] text-slate-600 uppercase font-bold mt-1">{expedition.days[activeDayIdx].accommodation?.type}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[500px] bg-slate-800 rounded-[3rem] border border-slate-700 overflow-hidden relative shadow-2xl relative">
              <div id="shared-map" className="w-full h-full z-0"></div>
              <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/50 flex items-center gap-2 shadow-xl max-w-[200px] sm:max-w-xs">
                <i className="fas fa-info-circle text-orange-400 text-sm"></i>
                <div className="text-left">
                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest leading-none mb-0.5">Schématický náhled</p>
                  <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider leading-tight">Nejedná se o přesnou trasu pro navigaci, pouze orientační.</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="text-center">
            <Link to="/" className="text-orange-500 text-[10px] font-bold uppercase tracking-widest hover:underline">Vytvoř si vlastní expedici v MotoSpirit AI</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedTrip;
