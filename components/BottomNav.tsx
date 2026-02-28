
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from '../types';

const BottomNav: React.FC<{
    currentView: View;
    onNavigate: (view: View) => void;
}> = ({ currentView, onNavigate }) => {
    const { t } = useTranslation();

    const NavItem = ({ view, icon, label }: { view: View, icon: React.ReactNode, label: string }) => {
        const isActive = currentView === view;
        return (
            <button 
                onClick={() => onNavigate(view)} 
                className={`flex flex-col items-center justify-center w-full h-full py-1 transition-colors ${
                    isActive ? 'text-[--color-primary]' : 'text-[--color-text-secondary] hover:text-[--color-text-primary]'
                }`}
            >
                <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'}`}>
                    {icon}
                </div>
                <span className="text-[10px] mt-1 font-medium">{label}</span>
            </button>
        );
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[--color-surface] border-t border-[--color-border] flex justify-around items-center z-50 pb-safe">
            <NavItem 
                view="scoreboard" 
                label={t('nav.game')} 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} 
            />
             <NavItem 
                view="lobby" 
                label={t('nav.lobby')} 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} 
            />
            <NavItem 
                view="tournament" 
                label={t('nav.tournaments')} 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>} 
            />
            <NavItem 
                view="playerManager" 
                label={t('nav.players')} 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} 
            />
            <NavItem 
                view="stats" 
                label={t('nav.stats')} 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} 
            />
        </nav>
    );
};

export default BottomNav;
