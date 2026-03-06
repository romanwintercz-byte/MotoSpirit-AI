import React, { useState, useEffect } from 'react';
import { fetchAllFeedback, deleteInboxMessage } from '../services/syncService';

const DevConsole: React.FC = () => {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFeedback = async () => {
      const msgs = await fetchAllFeedback();
      setFeedback(msgs);
      setLoading(false);
    };
    loadFeedback();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('Opravdu smazat tento ticket?')) {
      await deleteInboxMessage(id);
      setFeedback(prev => prev.filter(m => m.id !== id));
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold font-brand uppercase tracking-tighter text-white">DEV <span className="text-orange-500">KONZOLE</span></h1>
        <p className="text-slate-500 text-sm">Zpětná vazba od uživatelů</p>
      </header>
      
      {loading ? (
        <div className="text-center py-20 text-slate-500">Načítám tickety...</div>
      ) : feedback.length === 0 ? (
        <div className="text-center py-20 animate-fadeIn px-6">
          <i className="fas fa-check-circle text-6xl text-emerald-500/50 mb-6"></i>
          <h2 className="text-xl font-bold mb-4 text-white uppercase font-brand">Vše vyřešeno</h2>
          <p className="text-slate-500 mb-8 text-sm">Žádná nová zpětná vazba.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedback.map(msg => {
            const typeLabel = msg.type === 'feedback_bug' ? 'CHYBA' : msg.type === 'feedback_idea' ? 'NÁPAD' : 'VZKAZ';
            const typeColor = msg.type === 'feedback_bug' ? 'text-red-500 bg-red-500/10' : msg.type === 'feedback_idea' ? 'text-emerald-500 bg-emerald-500/10' : 'text-blue-500 bg-blue-500/10';
            const typeIcon = msg.type === 'feedback_bug' ? 'fa-bug' : msg.type === 'feedback_idea' ? 'fa-lightbulb' : 'fa-comment';

            return (
              <div key={msg.id} className="bg-slate-800/40 border border-slate-700 p-5 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeColor}`}>
                      <i className={`fas ${typeIcon}`}></i>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white uppercase tracking-tight">
                        {typeLabel}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                        Od: {msg.from_code}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                      {new Date(msg.created_at).toLocaleString('cs-CZ')}
                    </span>
                  </div>
                </div>
                
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{msg.message}</p>
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={() => handleDelete(msg.id)}
                    className="px-4 py-2 bg-slate-800 hover:bg-red-600/20 text-slate-500 hover:text-red-500 rounded-xl border border-slate-700 transition-all font-bold text-[10px] uppercase tracking-widest flex items-center gap-2"
                  >
                    <i className="fas fa-check"></i> VYŘEŠENO
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DevConsole;
