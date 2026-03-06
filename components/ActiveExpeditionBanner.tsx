import React, { useState } from 'react';
import { useActiveExpedition } from '../hooks/useActiveExpedition';
import { useNavigate } from 'react-router-dom';

export const ActiveExpeditionBanner: React.FC = () => {
  const { activeState, endExpedition } = useActiveExpedition();
  const navigate = useNavigate();

  if (!activeState) return null;

  const handleEnd = () => {
    if (window.confirm('Opravdu chceš ukončit tuto expedici? Všechny nasbírané kilometry a výdaje se uloží.')) {
      endExpedition();
      navigate('/logbook');
    }
  };

  const handleAddExpense = () => {
    // Navigate to logbook with a query param to open the add expense modal
    navigate('/logbook?addExpense=true');
  };

  return (
    <div className="bg-orange-600 border-b border-orange-700 shadow-xl shadow-orange-900/20 animate-slideDown">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-white">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <i className="fas fa-motorcycle text-sm"></i>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-200">Aktivní expedice</p>
            <p className="text-sm font-bold">{activeState.expeditionName}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-200">Ujeto</p>
            <p className="text-sm font-bold text-white">{activeState.currentDistanceKm.toFixed(1)} km</p>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleAddExpense}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <i className="fas fa-plus"></i> VÝDAJ
            </button>
            <button 
              onClick={handleEnd}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
            >
              UKONČIT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
