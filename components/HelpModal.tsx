
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface HelpCategoryProps {
    id: string;
    title: string;
    icon: string;
    color: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

const HelpCategory: React.FC<HelpCategoryProps> = ({ title, icon, color, isOpen, onToggle, children }) => {
    return (
        <div className="border-b border-[--color-border]/30">
            <button 
                onClick={onToggle}
                className="w-full py-4 flex items-center justify-between text-left focus:outline-none"
            >
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br ${color} shadow-sm`}>
                        {icon}
                    </div>
                    <span className={`font-bold transition-colors ${isOpen ? 'text-[--color-accent]' : 'text-[--color-text-primary]'}`}>
                        {title}
                    </span>
                </div>
                <svg 
                    className={`w-5 h-5 text-[--color-text-secondary] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[1000px] opacity-100 pb-6' : 'max-h-0 opacity-0'}`}>
                <div className="text-[--color-text-secondary] text-sm leading-relaxed space-y-4 px-1">
                    {children}
                </div>
            </div>
        </div>
    );
};

const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { t } = useTranslation();
    const [openCategoryId, setOpenCategoryId] = useState<string | null>('sync');

    const toggleCategory = (id: string) => {
        setOpenCategoryId(openCategoryId === id ? null : id);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div 
                className="bg-[--color-surface] rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col border border-[--color-border]/30 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-[--color-border]/30 flex justify-between items-center bg-black/20">
                    <h2 className="text-2xl font-extrabold text-[--color-text-primary] flex items-center gap-2">
                        <span className="text-xl">❓</span> {t('help.title')}
                    </h2>
                    <button onClick={onClose} className="p-2 text-[--color-text-secondary] hover:text-white">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                    <div className="space-y-2">
                        {/* Synchronizace */}
                        <HelpCategory 
                            id="sync"
                            title={t('help.categories.sync')} 
                            icon="☁️" 
                            color="from-blue-500/20 to-cyan-500/20"
                            isOpen={openCategoryId === 'sync'}
                            onToggle={() => toggleCategory('sync')}
                        >
                            <div className="space-y-4">
                                <p className="font-semibold text-[--color-text-primary] border-l-2 border-[--color-accent] pl-3 italic">
                                    {t('help.sync.intro')}
                                </p>
                                
                                <div className="bg-black/20 p-4 rounded-2xl space-y-3 border border-[--color-border]/20">
                                    <h4 className="font-bold text-[--color-accent] flex items-center gap-2">
                                        <span>🤝</span> {t('help.sync.claiming.title')}
                                    </h4>
                                    <ul className="space-y-3">
                                        <li dangerouslySetInnerHTML={{ __html: t('help.sync.claiming.step1') }} />
                                        <li dangerouslySetInnerHTML={{ __html: t('help.sync.claiming.step2') }} />
                                        <li dangerouslySetInnerHTML={{ __html: t('help.sync.claiming.step3') }} />
                                    </ul>
                                    <p className="text-xs pt-2 border-t border-[--color-border]/30 text-[--color-green]/80">
                                        {t('help.sync.claiming.result')}
                                    </p>
                                </div>
                            </div>
                        </HelpCategory>

                        {/* Pravidla */}
                        <HelpCategory 
                            id="game"
                            title={t('help.categories.game')} 
                            icon="🎱" 
                            color="from-emerald-500/20 to-teal-500/20"
                            isOpen={openCategoryId === 'game'}
                            onToggle={() => toggleCategory('game')}
                        >
                            <div className="space-y-4">
                                <p>{t('help.game.intro')}</p>
                                
                                <div className="space-y-2">
                                    <h4 className="font-bold text-[--color-accent]">{t('help.game.types.title')}</h4>
                                    <ul className="list-disc pl-5 space-y-2" dangerouslySetInnerHTML={{ __html: t('help.game.types.list') }} />
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-bold text-[--color-accent]">{t('help.game.conditions.title')}</h4>
                                    <ul className="list-disc pl-5 space-y-2" dangerouslySetInnerHTML={{ __html: t('help.game.conditions.list') }} />
                                </div>
                            </div>
                        </HelpCategory>

                        {/* Turnaje */}
                        <HelpCategory 
                            id="tournaments"
                            title={t('help.categories.tournaments')} 
                            icon="🏆" 
                            color="from-yellow-500/20 to-orange-500/20"
                            isOpen={openCategoryId === 'tournaments'}
                            onToggle={() => toggleCategory('tournaments')}
                        >
                            <div className="space-y-4">
                                <p>{t('help.tournaments.intro')}</p>
                                
                                <div className="space-y-2">
                                    <h4 className="font-bold text-[--color-accent]">{t('help.tournaments.formats.title')}</h4>
                                    <ul className="list-disc pl-5 space-y-2" dangerouslySetInnerHTML={{ __html: t('help.tournaments.formats.list') }} />
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-bold text-[--color-accent]">{t('help.tournaments.seeding.title')}</h4>
                                    <p>{t('help.tournaments.seeding.desc')}</p>
                                </div>
                            </div>
                        </HelpCategory>

                        {/* Lobby */}
                        <HelpCategory 
                            id="lobby"
                            title={t('help.categories.lobby')} 
                            icon="🏟️" 
                            color="from-purple-500/20 to-pink-500/20"
                            isOpen={openCategoryId === 'lobby'}
                            onToggle={() => toggleCategory('lobby')}
                        >
                            <div className="space-y-4">
                                <p>{t('help.lobby.intro')}</p>
                                
                                <div className="space-y-2">
                                    <h4 className="font-bold text-[--color-accent]">{t('help.lobby.community.title')}</h4>
                                    <p>{t('help.lobby.community.desc')}</p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-bold text-[--color-accent]">{t('help.lobby.challenges.title')}</h4>
                                    <p>{t('help.lobby.challenges.desc')}</p>
                                </div>
                            </div>
                        </HelpCategory>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-black/20 text-center">
                    <button 
                        onClick={onClose}
                        className="w-full py-3 bg-[--color-primary] text-white font-bold rounded-2xl shadow-lg transition-transform active:scale-95"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HelpModal;
