
import React from 'react';
import { View } from '../types';

const HeaderNav: React.FC<{
    currentView: View;
    onNavigate: (view: View) => void;
    onOpenSettings: () => void;
    onOpenHelp: () => void;
    onOpenAbout: () => void;
}> = ({ onOpenSettings, onOpenHelp, onOpenAbout }) => {
    
    return (
        <header className="fixed top-0 left-0 right-0 bg-[--color-surface] bg-opacity-95 backdrop-blur-sm px-4 h-14 flex justify-between items-center z-30 shadow-sm border-b border-[--color-border]/50">
            <button 
                onClick={onOpenAbout}
                className="flex items-center gap-2 hover:opacity-80 active:scale-95 transition-all outline-none"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-8 h-8">
                    <text y=".9em" fontSize="90">🏆</text>
                </svg>
                <h1 className="text-lg font-extrabold text-[--color-text-primary] tracking-tight">Win3 Carom Pro</h1>
            </button>
            
            <div className="flex items-center gap-1">
                <button onClick={onOpenHelp} aria-label="Help" className="p-2 text-[--color-text-secondary] hover:text-[--color-accent] transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>
                <button onClick={onOpenSettings} aria-label="Settings" className="p-2 -mr-2 text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </div>
        </header>
    );
}

export default HeaderNav;
