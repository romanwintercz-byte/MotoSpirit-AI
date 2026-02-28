
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Player, GameRecord, GameSummary, GameInfo } from '../types';
import Avatar from './Avatar';
import ScoreInputPad from './ScoreInputPad';
import RetroScoreboard from './RetroScoreboard';
import CaromEffect from './CaromEffect';
import { supabase } from '../supabaseClient';
import { normalizeCommunityId } from '../hooks';

const CompactPlayerCard: React.FC<{
  player: Player;
  score: number;
  turnScore: number;
  turns: number;
  isActive: boolean;
  targetScore: number;
  handicap?: number;
}> = ({ player, score, turnScore, turns, isActive, targetScore, handicap = 0 }) => {
    const { t } = useTranslation();
    const currentTotalScore = score + turnScore;
    const scorePercentage = targetScore > 0 ? (currentTotalScore / targetScore) * 100 : 0;
    const pointsToTarget = Math.max(0, targetScore - currentTotalScore);

    return (
        <div className={`
            rounded-xl flex items-center gap-3 transition-all duration-300 relative shadow-sm overflow-hidden
            ${isActive 
                ? 'bg-[--color-surface] ring-1 ring-[--color-accent] p-3 shadow-lg z-10 scale-[1.02]' 
                : 'bg-[--color-surface-light] opacity-70 p-2 scale-100'}
        `}>
            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[--color-accent]"></div>}
            
            <div className="pl-1">
                <Avatar avatar={player.avatar} className={isActive ? "w-14 h-14" : "w-10 h-10"} />
            </div>
            
            <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2">
                    <p className={`font-bold truncate text-[--color-text-primary] ${isActive ? 'text-lg' : 'text-sm'}`}>{player.name}</p>
                    {handicap > 0 && <span className="text-[10px] bg-[--color-yellow] text-black px-1 rounded font-bold">H+{handicap}</span>}
                </div>
                <div className="flex items-center gap-3">
                    <p className={`font-mono font-bold text-yellow-500/80 ${isActive ? 'text-sm' : 'text-xs'}`}>
                        {t('scoreboard.pointsToTarget', { points: pointsToTarget })}
                    </p>
                    <p className={`font-mono font-bold text-[--color-accent] ${isActive ? 'text-sm' : 'text-xs'}`}>
                        {turns} náb.
                    </p>
                </div>
            </div>
            
            <div className="flex flex-col items-end flex-shrink-0 pr-1">
                <p className={`font-mono font-extrabold text-[--color-text-primary] leading-none ${isActive ? 'text-4xl' : 'text-2xl'}`}>{score}</p>
                {isActive && turnScore !== 0 && (
                    <p key={turnScore} className={`font-mono font-bold animate-score-pop text-lg ${turnScore > 0 ? 'text-[--color-green]' : 'text-[--color-red]'}`}>
                        {turnScore > 0 ? `+${turnScore}` : turnScore}
                    </p>
                )}
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                <div
                    className="h-full bg-[--color-accent] transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, scorePercentage))}%` }}
                />
            </div>
        </div>
    );
};

const Scoreboard: React.FC<{
    gameInfo: GameInfo;
    scores: { [playerId: string]: number };
    turnScore: number;
    activePlayersWithStats: (Player & { movingAverage: number, lastSixResults: GameRecord['result'][] })[];
    turnsPerPlayer: { [playerId: string]: number };
    gameHistory: GameSummary['gameHistory'];
    handleAddToTurn: (scoreData: { points: number, type: string }) => void;
    handleEndTurn: () => void;
    handleUndoLastTurn: () => void;
    onRetroToggle: (retro: boolean) => void;
}> = (props) => {
    const { gameInfo, scores, turnScore, activePlayersWithStats, turnsPerPlayer, handleAddToTurn, handleEndTurn, handleUndoLastTurn, onRetroToggle } = props;
    const { t } = useTranslation();
    const [animTrigger, setAnimTrigger] = useState(0);
    const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [communityId, setCommunityId] = useState('default');

    useEffect(() => {
        // Fix: Cast supabase.auth to any to bypass type check errors
        (supabase.auth as any).getUser().then(({ data: { user } }: any) => {
            if (user) setCurrentUserId(user.id);
        });
        const storedComm = localStorage.getItem('scoreCounter:communityId');
        if (storedComm) setCommunityId(JSON.parse(storedComm));
    }, []);

    const currentPlayer = activePlayersWithStats[gameInfo.currentPlayerIndex];

    if (!currentPlayer) {
        return <p className="text-center text-gray-500">Načítám...</p>;
    }

    const pointsToTarget = gameInfo.targetScore - ((scores[currentPlayer.id] || 0) + turnScore);

    const handleScoreInput = (scoreData: { points: number; type: string }) => {
        if (scoreData.points > 0) {
            setAnimTrigger(prev => prev + 1);
        }
        handleAddToTurn(scoreData);
    };

    const tvUrl = `${window.location.origin}/?tv=${normalizeCommunityId(communityId)}`;
    const watchUrl = currentUserId ? `${window.location.origin}/?watch=${currentUserId}` : '';

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            alert(t('common.copied'));
        });
    };

    const handleNativeShare = (url: string) => {
        if (navigator.share) {
            navigator.share({ title: 'Sleduj můj zápas! 🎱', url }).catch(console.error);
        } else {
            copyToClipboard(url);
        }
    };

    if (gameInfo.isRetro) {
        return (
            <div className="h-full flex flex-col relative">
                <div className="absolute top-2 left-2 z-30">
                    <button 
                        onClick={() => onRetroToggle(false)} 
                        className="bg-black/50 p-2 rounded-full shadow-md text-white hover:bg-black transition-colors"
                        title={t('scoreboard.digital')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                    </button>
                </div>
                <RetroScoreboard 
                    gameInfo={gameInfo}
                    scores={scores}
                    turnScore={turnScore}
                    activePlayersWithStats={activePlayersWithStats}
                    handleAddToTurn={handleAddToTurn}
                    handleEndTurn={handleEndTurn}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative">
            <CaromEffect trigger={animTrigger} />

            <div className="absolute top-2 right-2 z-30">
                <button onClick={() => setIsBroadcastModalOpen(true)} className="bg-[--color-surface] p-2 rounded-full shadow-md text-[--color-accent] hover:text-white hover:bg-[--color-accent] transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a10 10 0 0114.142 0M1.414 1.414l21.172 21.172" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 12h.01M8.464 8.464a5 5 0 010 7.072" />
                    </svg>
                </button>
            </div>

            <div className="absolute top-2 left-2 z-30">
                <button 
                    onClick={() => onRetroToggle(true)} 
                    className="bg-[--color-surface] p-2 rounded-full shadow-md text-[--color-accent] hover:text-white hover:bg-[--color-accent] transition-colors"
                    title={t('scoreboard.retro')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                </button>
            </div>

            {/* Broadcast Modal */}
            {isBroadcastModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setIsBroadcastModalOpen(false)}>
                    <div className="bg-[--color-surface] rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-white/10" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">{t('broadcast.title')}</h2>
                            <button onClick={() => setIsBroadcastModalOpen(false)} className="text-white/40 hover:text-white">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Personal Stream */}
                            <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                                <h3 className="text-[--color-accent] font-bold text-sm uppercase mb-1">{t('broadcast.personal')}</h3>
                                <p className="text-xs text-[--color-text-secondary] mb-3 leading-relaxed">{t('broadcast.personalDesc')}</p>
                                <button 
                                    onClick={() => handleNativeShare(watchUrl)}
                                    className="w-full bg-[--color-primary] text-white font-bold py-2 rounded-lg text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                    {t('common.copy')}
                                </button>
                            </div>

                            {/* TV Mode */}
                            <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-[--color-yellow] font-bold text-sm uppercase">{t('broadcast.tv')}</h3>
                                    <span className="text-[8px] bg-[--color-yellow] text-black px-1 rounded font-black">HERNA</span>
                                </div>
                                <p className="text-xs text-[--color-text-secondary] mb-3 leading-relaxed">{t('broadcast.tvDesc')}</p>
                                
                                <div className="bg-black/40 p-3 rounded-lg mb-3 border border-white/10 break-all">
                                    <p className="text-[10px] text-white/40 uppercase font-bold mb-1">{t('broadcast.tvUrl')}</p>
                                    <p className="text-xs font-mono text-[--color-yellow] select-all">{tvUrl}</p>
                                </div>

                                <button 
                                    onClick={() => copyToClipboard(tvUrl)}
                                    className="w-full bg-[--color-surface-light] text-white font-bold py-2 rounded-lg text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                    {t('common.copy')}
                                </button>
                            </div>
                        </div>

                        <button 
                            onClick={() => setIsBroadcastModalOpen(false)}
                            className="mt-6 w-full py-3 text-[--color-text-secondary] font-bold text-sm uppercase tracking-widest"
                        >
                            {t('common.close')}
                        </button>
                    </div>
                </div>
            )}

            {/* Inning indicator above cards */}
            <div className="flex justify-center mt-2 px-4">
                <div className="bg-black/30 px-6 py-1.5 rounded-full border border-white/10">
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-[--color-accent]">
                        {t('scoreboard.inning', { count: gameInfo.inning })}
                    </span>
                </div>
            </div>

            {/* Player List (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 mt-2">
                 {activePlayersWithStats.map((player, index) => (
                    <CompactPlayerCard
                        key={player.id}
                        player={player}
                        score={scores[player.id] || 0}
                        turnScore={gameInfo.currentPlayerIndex === index ? turnScore : 0}
                        turns={turnsPerPlayer[player.id] || 0}
                        isActive={gameInfo.currentPlayerIndex === index}
                        targetScore={gameInfo.targetScore}
                        handicap={gameInfo.handicap?.playerId === player.id ? gameInfo.handicap.points : 0}
                    />
                ))}
            </div>

            {/* Controls (Fixed at bottom) */}
            <div className="flex-shrink-0 bg-[--color-bg] px-2 pt-2 pb-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.2)] z-20">
                <ScoreInputPad
                    onScore={handleScoreInput}
                    onEndTurn={handleEndTurn}
                    onUndoTurn={handleUndoLastTurn}
                    isUndoTurnDisabled={props.gameHistory.length <= 1}
                    pointsToTarget={pointsToTarget}
                    allowOvershooting={gameInfo.allowOvershooting ?? false}
                    gameType={gameInfo.type}
                />
            </div>
        </div>
    );
}

export default Scoreboard;
