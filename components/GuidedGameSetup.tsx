
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Player, GameRecord, GameMode } from '../types';
import Avatar from './Avatar';
import { GAME_TYPE_DEFAULTS_SETUP } from '../constants';
import { triggerHapticFeedback, getPlayerAverage } from '../utils';

interface WizardState {
    step: number;
    ballCount: 3 | 4 | null;
    gameMode: GameMode;
    variant: string;
    endCondition: 'sudden-death' | 'equal-innings';
    selectedPlayerIds: string[];
    targetScore: number;
}

const GuidedGameSetup: React.FC<{
    allPlayers: Player[];
    lastPlayedPlayerIds: string[];
    gameLog: GameRecord[];
    onGameStart: (
        playerIds: string[], 
        gameTypeKey: string, 
        gameMode: GameMode, 
        targetScore: number,
        endCondition: 'sudden-death' | 'equal-innings',
        allowOvershooting: boolean
    ) => void;
    onGoToMenu: () => void;
    onAddNewPlayer: () => void;
    onTogglePlayerWithAuth: (pid: string, current: string[], updateFn: (ids: string[]) => void) => void;
}> = ({ allPlayers, lastPlayedPlayerIds, gameLog, onGameStart, onGoToMenu, onAddNewPlayer, onTogglePlayerWithAuth }) => {
    const { t } = useTranslation();
    const [state, setState] = useState<WizardState>({
        step: 0,
        ballCount: null,
        gameMode: 'round-robin',
        variant: 'gameSetup.threeCushion',
        endCondition: 'sudden-death',
        selectedPlayerIds: lastPlayedPlayerIds.filter(id => allPlayers.some(p => p.id === id)),
        targetScore: 50
    });

    const getAvg = (pid: string) => {
        const type = state.ballCount === 4 ? 'gameSetup.fourBall' : state.variant;
        return getPlayerAverage(pid, type, gameLog);
    };

    const nextStep = () => {
        triggerHapticFeedback(30);
        setState(prev => ({ ...prev, step: prev.step + 1 }));
    };

    const prevStep = () => {
        triggerHapticFeedback(20);
        setState(prev => ({ ...prev, step: Math.max(0, prev.step - 1) }));
    };

    const selectBalls = (count: 3 | 4) => {
        const variant = count === 4 ? 'gameSetup.fourBall' : 'gameSetup.threeCushion';
        setState(prev => ({ 
            ...prev, 
            ballCount: count, 
            variant,
            targetScore: GAME_TYPE_DEFAULTS_SETUP[variant],
            step: 2 
        }));
        triggerHapticFeedback(40);
    };

    const selectMode = (mode: GameMode) => {
        setState(prev => ({ ...prev, gameMode: mode, step: prev.ballCount === 4 ? 4 : 3 }));
        triggerHapticFeedback(40);
    };

    const selectVariant = (v: string) => {
        setState(prev => ({ ...prev, variant: v, targetScore: GAME_TYPE_DEFAULTS_SETUP[v], step: 4 }));
        triggerHapticFeedback(40);
    };

    const selectEnding = (cond: 'sudden-death' | 'equal-innings') => {
        setState(prev => ({ ...prev, endCondition: cond, step: 5 }));
        triggerHapticFeedback(40);
    };

    const handlePlayerClick = (id: string) => {
        onTogglePlayerWithAuth(id, state.selectedPlayerIds, (newIds) => {
            setState(prev => ({ ...prev, selectedPlayerIds: newIds }));
        });
    };

    const handleFinalStart = () => {
        triggerHapticFeedback(100);
        onGameStart(
            state.selectedPlayerIds,
            state.ballCount === 4 ? 'gameSetup.fourBall' : state.variant,
            state.gameMode,
            state.targetScore,
            state.endCondition,
            false
        );
    };

    const progress = (state.step / 6) * 100;

    const OptionButton: React.FC<{ label: string; icon: string; onClick: () => void; color?: string }> = ({ label, icon, onClick, color = 'bg-[--color-surface-light]' }) => (
        <button 
            onClick={onClick}
            className={`w-full p-6 rounded-2xl flex items-center gap-6 text-left transition-all active:scale-95 border-2 border-transparent hover:border-[--color-accent] ${color}`}
        >
            <span className="text-4xl">{icon}</span>
            <span className="text-xl font-bold text-[--color-text-primary] leading-tight">{label}</span>
        </button>
    );

    return (
        <div className="flex flex-col min-h-full bg-[--color-bg] px-4 pb-12">
            {state.step > 0 && (
                <div className="pt-4 mb-8 flex items-center gap-4">
                    <button onClick={prevStep} className="p-2 text-[--color-text-secondary] hover:text-[--color-text-primary]">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[--color-accent] transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            )}

            <div className="flex-grow flex flex-col items-center justify-center max-w-md mx-auto w-full text-center">
                
                {state.step === 0 && (
                    <div className="space-y-6 w-full py-8">
                        <div className="text-6xl mb-4 animate-bounce">🎱</div>
                        <h2 className="text-3xl font-black text-white leading-tight mb-8">{t('guided.welcome')}</h2>
                        <OptionButton label={t('guided.play')} icon="🚀" onClick={() => setState(prev => ({ ...prev, step: 1 }))} color="bg-[--color-primary]/20 border-[--color-primary]/30" />
                        <OptionButton label={t('guided.manage')} icon="⚙️" onClick={onGoToMenu} />
                    </div>
                )}

                {state.step === 1 && (
                    <div className="space-y-4 w-full">
                        <h2 className="text-2xl font-bold text-[--color-accent] mb-8">{t('guided.step.balls')}</h2>
                        <OptionButton label={t('guided.balls4')} icon="4️⃣" onClick={() => selectBalls(4)} />
                        <OptionButton label={t('guided.balls3')} icon="3️⃣" onClick={() => selectBalls(3)} />
                    </div>
                )}

                {state.step === 2 && (
                    <div className="space-y-4 w-full">
                        <h2 className="text-2xl font-bold text-[--color-accent] mb-8">{t('guided.step.mode')}</h2>
                        <OptionButton label={t('guided.modeIndividual')} icon="👤" onClick={() => selectMode('round-robin')} />
                        <OptionButton label={t('guided.modeTeams')} icon="👥" onClick={() => selectMode('team')} />
                    </div>
                )}

                {state.step === 3 && (
                    <div className="space-y-4 w-full">
                        <h2 className="text-2xl font-bold text-[--color-accent] mb-8">{t('guided.step.variant')}</h2>
                        <OptionButton label={t('gameSetup.freeGame')} icon="⚪" onClick={() => selectVariant('gameSetup.freeGame')} />
                        <OptionButton label={t('gameSetup.oneCushion')} icon="🟥" onClick={() => selectVariant('gameSetup.oneCushion')} />
                        <OptionButton label={t('gameSetup.threeCushion')} icon="⬛" onClick={() => selectVariant('gameSetup.threeCushion')} />
                    </div>
                )}

                {state.step === 4 && (
                    <div className="space-y-4 w-full">
                        <h2 className="text-2xl font-bold text-[--color-accent] mb-8">{t('guided.step.ending')}</h2>
                        <OptionButton label={t('guided.endingEqual')} icon="⏱️" onClick={() => selectEnding('equal-innings')} />
                        <OptionButton label={t('guided.endingSudden')} icon="💀" onClick={() => selectEnding('sudden-death')} />
                    </div>
                )}

                {state.step === 5 && (
                    <div className="w-full flex flex-col h-full py-4">
                        <h2 className="text-2xl font-bold text-[--color-accent] mb-6">{t('guided.step.players')}</h2>
                        <div className="grid grid-cols-3 gap-3 overflow-y-auto max-h-[50vh] p-2 no-scrollbar">
                            <button 
                                onClick={onAddNewPlayer}
                                className="flex flex-col items-center justify-center gap-2 p-2 rounded-xl bg-white/5 border-2 border-dashed border-white/20 aspect-square"
                            >
                                <span className="text-3xl">➕</span>
                                <span className="text-[10px] font-bold uppercase">{t('guided.addPlayer')}</span>
                            </button>

                            {allPlayers.map(p => {
                                const isSelected = state.selectedPlayerIds.includes(p.id);
                                return (
                                    <button 
                                        key={p.id} 
                                        onClick={() => handlePlayerClick(p.id)}
                                        className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-all border-2 aspect-square ${isSelected ? 'border-[--color-accent] bg-[--color-accent]/10' : 'border-transparent bg-[--color-surface-light]'}`}
                                    >
                                        <Avatar avatar={p.avatar} className="w-10 h-10 mb-1" />
                                        <span className="text-[10px] font-bold truncate w-full text-center">{p.name}</span>
                                        <span className="text-[8px] opacity-60 font-mono">Avg: {getAvg(p.id).toFixed(2)}</span>
                                        {p.pin && <span className="absolute top-1 left-1 text-[8px] opacity-50">🔒</span>}
                                        {isSelected && <div className="absolute top-1 right-1 bg-[--color-accent] rounded-full p-0.5"><svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div>}
                                    </button>
                                );
                            })}
                        </div>
                        <button 
                            disabled={state.selectedPlayerIds.length < 1}
                            onClick={nextStep}
                            className="mt-8 w-full bg-[--color-primary] text-white font-bold py-4 rounded-2xl shadow-xl disabled:opacity-30 disabled:grayscale transition-all"
                        >
                            {t('common.continue')} ({state.selectedPlayerIds.length})
                        </button>
                    </div>
                )}

                {state.step === 6 && (
                    <div className="space-y-8 w-full py-4">
                        <h2 className="text-2xl font-bold text-[--color-accent]">{t('guided.step.target')}</h2>
                        <div className="bg-black/30 p-8 rounded-[40px] border border-white/10 shadow-2xl">
                             <div className="flex items-center justify-center gap-8">
                                <button onClick={() => setState(prev => ({...prev, targetScore: Math.max(1, prev.targetScore - 5)}))} className="w-16 h-16 rounded-full bg-white/5 text-4xl font-black text-white hover:bg-white/10 active:scale-90 transition-all">-</button>
                                <span className="text-7xl font-black text-white font-mono min-w-[120px]">{state.targetScore}</span>
                                <button onClick={() => setState(prev => ({...prev, targetScore: prev.targetScore + 5}))} className="w-16 h-16 rounded-full bg-white/5 text-4xl font-black text-white hover:bg-white/10 active:scale-90 transition-all">+</button>
                             </div>
                        </div>
                        <div className="bg-[--color-surface] p-4 rounded-2xl text-left border border-white/5 space-y-2 opacity-80">
                            <p className="text-xs uppercase font-bold tracking-widest text-[--color-text-secondary] mb-2">{t('guided.review')}</p>
                            <div className="flex justify-between text-sm">
                                <span>{t('gameSetup.selectType')}:</span>
                                <span className="font-bold text-white">{t(state.ballCount === 4 ? 'gameSetup.fourBall' : state.variant as any)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>{t('gameSetup.gameMode')}:</span>
                                <span className="font-bold text-white">{t(state.gameMode === 'team' ? 'gameSetup.teamPlay' : 'gameSetup.roundRobin')}</span>
                            </div>
                        </div>
                        <button 
                            onClick={handleFinalStart}
                            className="w-full bg-[--color-green] text-white font-black py-6 rounded-3xl text-2xl shadow-[0_10px_40px_rgba(34,197,94,0.3)] hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-tighter"
                        >
                            {t('guided.start')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GuidedGameSetup;
