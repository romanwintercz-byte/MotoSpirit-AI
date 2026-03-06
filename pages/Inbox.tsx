import React, { useState, useEffect } from 'react';
import { fetchInbox, deleteInboxMessage } from '../services/syncService';
import { useNavigate } from 'react-router-dom';

const Inbox: React.FC = () => {
  const [inbox, setInbox] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadInbox = async () => {
      const syncCode = localStorage.getItem('motospirit_sync_code');
      if (syncCode) {
        const msgs = await fetchInbox(syncCode);
        setInbox(msgs);
      }
      setLoading(false);
    };
    loadInbox();
  }, []);

  const handleDelete = async (id: string) => {
    await deleteInboxMessage(id);
    setInbox(prev => prev.filter(m => m.id !== id));
  };

  const handleOpenTrip = (msg: any) => {
    const saved = JSON.parse(localStorage.getItem('spirit_wanderer_trips') || '[]');
    const newTrip = { ...msg.expedition_data, id: Date.now().toString(), sharedBy: msg.from_code };
    localStorage.setItem('spirit_wanderer_trips', JSON.stringify([newTrip, ...saved]));
    handleDelete(msg.id);
    navigate('/planner');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold font-brand uppercase tracking-tighter text-white">MOTO <span className="text-orange-500">POŠTA</span></h1>
      </header>
      
      {loading ? (
        <div className="text-center py-20 text-slate-500">Načítám zprávy...</div>
      ) : inbox.length === 0 ? (
        <div className="text-center py-20 animate-fadeIn px-6">
          <i className="fas fa-envelope-open text-6xl text-slate-800 mb-6"></i>
          <h2 className="text-xl font-bold mb-4 text-white uppercase font-brand">Schránka je prázdná</h2>
          <p className="text-slate-500 mb-8 text-sm">Zatím ti nikdo nic neposlal.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inbox.map(msg => (
            <div key={msg.id} className="bg-slate-800/40 border border-slate-700 p-5 rounded-3xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600/20 flex items-center justify-center text-orange-500 shrink-0">
                  <i className={`fas ${msg.type === 'wave' ? 'fa-hand-peace' : msg.type === 'message' ? 'fa-comment' : 'fa-map-location-dot'}`}></i>
                </div>
                <div className="flex-grow">
                  <p className="text-sm font-bold text-white uppercase tracking-tight">
                    {msg.type === 'wave' ? 'Někdo ti mává!' : msg.type === 'message' ? 'Nová zpráva' : msg.expedition_data?.name}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                    Od: {msg.from_code}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                    {new Date(msg.created_at).toLocaleDateString('cs-CZ')}
                  </span>
                </div>
              </div>
              
              {(msg.type === 'wave' || msg.type === 'message') && (
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
                  <p className="text-sm text-slate-300">{msg.message}</p>
                </div>
              )}

              <div className="flex gap-2">
                {msg.expedition_data && (
                  <button 
                    onClick={() => handleOpenTrip(msg)}
                    className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl shadow-lg transition-all font-bold text-[10px] uppercase tracking-widest flex justify-center items-center gap-2"
                  >
                    <i className="fas fa-download"></i> ULOŽIT TRASU
                  </button>
                )}
                <button 
                  onClick={() => handleDelete(msg.id)}
                  className="flex-1 px-4 py-3 bg-slate-800 hover:bg-red-600/20 text-slate-500 hover:text-red-500 rounded-xl border border-slate-700 transition-all font-bold text-[10px] uppercase tracking-widest flex justify-center items-center gap-2"
                >
                  <i className="fas fa-trash"></i> SMAZAT
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Inbox;
