
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Player, GameRecord, GameMode } from '../types';
import Avatar from './Avatar';
import HandicapModal from './HandicapModal';
import { GAME_TYPE_DEFAULTS_SETUP } from '../constants';
import { triggerHapticFeedback } from '../utils';

const FourBallIcon = () => <svg viewBox="0 0 24 24" className="w-8 h-8 mx-auto mb-2"><path fill="currentColor" d="M12 5.5A1.5 1.5 0 0 1 13.5 7A1.5 1.5 0 0 1 12 8.5A1.5 1.5 0 0 1 10.5 7A1.5 1.5 0 0 1 12 5.5m5.5 5.5A1.5 1.5 0 0 1 19 12A1.5 1.5 0 0 1 17.5 13.5A1.5 1.5 0 0 1 16 12A1.5 1.5 0 0 1 17.5 11m-11 0A1.5 1.5 0 0 1 8 12A1.5 1.5 0 0 1 6.5 13.5A1.5 1.5 0 0 1 5 12A1.5 1.5 0 0 1 6.5 11m5.5 5.5A1.5 1.5 0 0 1 13.5 18A1.5 1.5 0 0 1 12 19.5A1.5 1.5 0 0 1 10.5 18A1.5 1.5 0 0 1 12 16.5Z" /></svg>;
const FreeGameIcon = () => <svg viewBox="0 0 24 24" className="w-8 h-8 mx-auto mb-2"><path fill="currentColor" d="M9 14a2 2 0 1 1-4 0a2 2 0 0 1 4 0 m5 3a2 2 0 1 1-4 0a2 2 0 0 1 4 0 m5-6a2 2 0 1 1-4 0a2 2 0 0 1 4 0" /></svg>;
const OneCushionIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 mx-auto mb-2"><path d="M4 12h16"/><path d="M6 10l-2 2l2 2"/><path d="M18 10l-2-2l-2 2"/><circle cx="12" cy="7" r="1.5" fill="currentColor"/><circle cx="18" cy="14" r="1.5" fill="currentColor"/></svg>;
const ThreeCushionIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 mx-auto mb-2"><path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/><path d="M6 10l-2 2l2 2"/><path d="M18 4l2 2l-2 2"/><path d="M6 16l-2 2l2 2"/><path d="M16 12l2 2-2 2"/><circle cx="10" cy="9" r="1.5" fill="currentColor"/><circle cx="14" cy="15" r="1.5" fill="currentColor"/></svg>;

const CheckmarkIcon = () => (
    <div className="absolute top-1 right-1 w-6 h-6 bg-[--color-accent] rounded-full flex items-center justify-center border-2 border-[--color-surface]">
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    </div>
);

const GAME_TYPE_ICONS: { [key: string]: React.ReactNode } = {
  'gameSetup.fourBall': <FourBallIcon />,
  'gameSetup.freeGame': <FreeGameIcon />,
  'gameSetup.oneCushion': <OneCushionIcon />,
  'gameSetup.threeCushion': <ThreeCushionIcon />,
};

const getPlayerAverage = (playerId: string, gameTypeKey: string, gameLog: GameRecord[]): number => {
    const playerGames = gameLog.filter(g => g.playerId === playerId && g.gameType === gameTypeKey);
    if (playerGames.length === 0) return 0;
    const sourceGames = playerGames.length >= 10 ? playerGames.slice(-10) : playerGames;
    const totalScore = sourceGames.reduce((sum, game) => sum + game.score, 0);
    const totalTurns = sourceGames.reduce((sum, game) => sum + game.turns, 0);
    return totalTurns > 0 ? totalScore / totalTurns : 0;
};

const GameSetup: React.FC<{
    allPlayers: Player[];
    lastPlayedPlayerIds: string[];
    gameLog: GameRecord[];
    onGameStart: (
        playerIds: string[], 
        gameTypeKey: string, 
        gameMode: GameMode, 
        targetScore: number,
        endCondition: 'sudden-death' | 'equal-innings',
        allowOvershooting: boolean,
        handicap?: { playerId: string, points: number }
    ) => void;
}> = ({ allPlayers, lastPlayedPlayerIds, gameLog, onGameStart }) => {
    const { t } = useTranslation();

    const [gameTypeKey, setGameTypeKey] = useState<string>('gameSetup.fourBall');
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(() => {
        return lastPlayedPlayerIds.filter(id => allPlayers.some(p => p.id === id));
    });
    const [gameMode, setGameMode] = useState<GameMode>('round-robin');
    const [targetScore, setTargetScore] = useState<number>(GAME_TYPE_DEFAULTS_SETUP[gameTypeKey]);
    const [endCondition, setEndCondition] = useState<'sudden-death' | 'equal-innings'>('sudden-death');
    const [allowOvershooting, setAllowOvershooting] = useState<boolean>(false);
    const [handicapOffer, setHandicapOffer] = useState<{ player: Player, points: number } | null>(null);

    useEffect(() => {
        setTargetScore(GAME_TYPE_DEFAULTS_SETUP[gameTypeKey] || 50);
    }, [gameTypeKey]);

    useEffect(() => {
        setHandicapOffer(null);
    }, [selectedPlayerIds, gameTypeKey]);

    const playersWithAverage = useMemo(() => {
        return allPlayers.map(p => ({
            ...p,
            average: getPlayerAverage(p.id, gameTypeKey, gameLog)
        })).sort((a, b) => b.average - a.average);
    }, [allPlayers, gameTypeKey, gameLog]);

    const handlePlayerToggle = (playerId: string) => {
        setSelectedPlayerIds(prev => {
            if (prev.includes(playerId)) {
                return prev.filter(id => id !== playerId);
            }
            if (prev.length < 4) {
                return [...prev, playerId];
            }
            return prev;
        });
    };

    const handleStartGameClick = () => {
        triggerHapticFeedback(100);
        const selectedPlayers = playersWithAverage.filter(p => selectedPlayerIds.includes(p.id));
        
        if (selectedPlayers.length === 2) {
            const [p1, p2] = selectedPlayers;
            const avgDiff = Math.abs(p1.average - p2.average);
            
            if (p1.average > 0 && p2.average > 0) {
                 const turnsToWin = targetScore / Math.max(p1.average, p2.average);
                 const scoreDiff = avgDiff * turnsToWin;
                 
                if (scoreDiff > targetScore * 0.1) {
                    const weakerPlayer = p1.average < p2.average ? p1 : p2;
                    const handicapPoints = Math.round(scoreDiff / 5) * 5;
                    if (handicapPoints > 0) {
                        setHandicapOffer({ player: weakerPlayer, points: handicapPoints });
                        return;
                    }
                }
            }
        }
        
        onGameStart(selectedPlayerIds, gameTypeKey, gameMode, targetScore, endCondition, allowOvershooting);
    };
    
    const handleAcceptHandicap = () => {
        if (!handicapOffer) return;
        onGameStart(selectedPlayerIds, gameTypeKey, gameMode, targetScore, endCondition, allowOvershooting, {
            playerId: handicapOffer.player.id,
            points: handicapOffer.points
        });
        setHandicapOffer(null);
    };

    const handleDeclineHandicap = () => {
        onGameStart(selectedPlayerIds, gameTypeKey, gameMode, targetScore, endCondition, allowOvershooting);
        setHandicapOffer(null);
    };
    
    const isStartDisabled = selectedPlayerIds.length < 1 || (gameMode === 'team' && selectedPlayerIds.length !== 4 && selectedPlayerIds.length !== 2);

    return (
        <>
            {handicapOffer && (
                <HandicapModal 
                    player={handicapOffer.player}
                    handicapValue={handicapOffer.points}
                    onAccept={handleAcceptHandicap}
                    onDecline={handleDeclineHandicap}
                    onClose={() => setHandicapOffer(null)}
                />
            )}
            <div className="w-full flex flex-col gap-6 pb-20 px-4">
                {/* Step 1: Select Game Type */}
                <section>
                    <h3 className="text-lg font-bold text-[--color-text-primary] mb-3 uppercase tracking-wider opacity-80">{t('gameSetup.selectType')}</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.keys(GAME_TYPE_DEFAULTS_SETUP).map(key => {
                            const isActive = gameTypeKey === key;
                            return (
                                <button key={key} onClick={() => setGameTypeKey(key)} className={`p-4 rounded-xl transition-all duration-200 border-2 flex flex-col items-center justify-center aspect-[4/3] ${isActive ? 'bg-[--color-primary]/20 border-[--color-accent] shadow-md' : 'bg-[--color-surface] border-transparent opacity-70'}`}>
                                    <div className={`text-4xl mb-2 ${isActive ? 'text-[--color-accent]' : 'text-[--color-text-secondary]'}`}>
                                        {GAME_TYPE_ICONS[key]}
                                    </div>
                                    <span className="font-bold text-[--color-text-primary] text-sm text-center leading-tight">{t(key as any)}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Step 2: Select Players */}
                <section>
                    <h3 className="text-lg font-bold text-[--color-text-primary] mb-3 uppercase tracking-wider opacity-80">{t('gameSetup.playersInGame')} ({selectedPlayerIds.length} / 4)</h3>
                    <div className="grid grid-cols-3 gap-3">
                        {playersWithAverage.map(p => {
                            const isSelected = selectedPlayerIds.includes(p.id);
                            return (
                                <button key={p.id} onClick={() => handlePlayerToggle(p.id)} className={`relative p-2 flex flex-col items-center gap-2 rounded-xl transition-all duration-200 border-2 aspect-square justify-center ${isSelected ? 'border-[--color-accent] bg-[--color-surface] shadow-md' : 'border-transparent bg-[--color-surface-light] opacity-70'}`}>
                                    <Avatar avatar={p.avatar} className="w-12 h-12" />
                                    <div className="w-full">
                                        <span className="text-xs font-bold text-center truncate block text-[--color-text-primary]">{p.name}</span>
                                        <span className="text-[10px] font-mono text-[--color-text-secondary] block text-center opacity-80">{p.average.toFixed(2)}</span>
                                    </div>
                                    {isSelected && <CheckmarkIcon />}
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Step 3: Game Settings */}
                <section className="bg-[--color-surface] p-4 rounded-xl shadow-sm">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="font-semibold text-xs text-[--color-text-secondary] mb-1 block uppercase tracking-wider">{t('gameSetup.targetScore')}</label>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setTargetScore(Math.max(1, targetScore - 5))} className="w-12 h-12 rounded-full bg-[--color-surface-light] text-[--color-text-primary] font-bold text-xl">-</button>
                                <input 
                                    type="number" 
                                    value={targetScore} 
                                    onChange={(e) => setTargetScore(Number(e.target.value))} 
                                    className="flex-1 bg-[--color-bg] text-[--color-text-primary] text-center text-3xl font-extrabold rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-[--color-accent]"
                                />
                                <button onClick={() => setTargetScore(targetScore + 5)} className="w-12 h-12 rounded-full bg-[--color-surface-light] text-[--color-text-primary] font-bold text-xl">+</button>
                            </div>
                        </div>
                        <div>
                            <label className="font-semibold text-xs text-[--color-text-secondary] mb-1 block uppercase tracking-wider">{t('gameSetup.gameMode')}</label>
                            <select value={gameMode} onChange={(e) => setGameMode(e.target.value as any)} className="w-full h-12 bg-[--color-bg] text-[--color-text-primary] text-sm font-semibold rounded-lg px-2 focus:outline-none border border-[--color-border]">
                                <option value="round-robin">{t('gameSetup.roundRobin')}</option>
                                <option value="team">{t('gameSetup.teamPlay')}</option>
                            </select>
                        </div>
                        <div>
                             <label className="font-semibold text-xs text-[--color-text-secondary] mb-1 block uppercase tracking-wider">{t('gameSetup.endCondition')}</label>
                             <select value={endCondition} onChange={(e) => setEndCondition(e.target.value as any)} className="w-full h-12 bg-[--color-bg] text-[--color-text-primary] text-sm font-semibold rounded-lg px-2 focus:outline-none border border-[--color-border]">
                                <option value="sudden-death">{t('gameSetup.suddenDeath')}</option>
                                <option value="equal-innings">{t('gameSetup.equalInnings')}</option>
                            </select>
                        </div>
                     </div>
                </section>
                
                {/* Spouštěcí tlačítko - nyní součástí formuláře pro maximální kompatibilitu s Xiaomi/MIUI */}
                <div className="mt-4 mb-12">
                    <button 
                        onClick={handleStartGameClick} 
                        disabled={isStartDisabled} 
                        className="w-full bg-[--color-green] text-white font-bold py-5 rounded-2xl text-2xl shadow-xl transition-all duration-200 enabled:active:scale-95 disabled:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                    >
                        {t('gameSetup.startGame')}
                    </button>
                </div>
            </div>
        </>
    );
};

export default GameSetup;
