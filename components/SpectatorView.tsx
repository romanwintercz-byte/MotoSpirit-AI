
import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActiveGameState, Player } from '../types';
import Avatar from './Avatar';
import { supabase } from '../supabaseClient';

const SpectatorCard: React.FC<{
  playerId: string;
  score: number;
  turnScore: number;
  turns: number;
  inning: number;
  isActive: boolean;
  isWinner: boolean;
  showResults: boolean;
  targetScore: number;
  playerData?: Player;
  handicap?: number;
}> = ({ playerId, score, turnScore, turns, inning, isActive, isWinner, showResults, targetScore, playerData, handicap = 0 }) => {
    const { t } = useTranslation();
    const currentTotalScore = score + turnScore;
    const scorePercentage = targetScore > 0 ? (currentTotalScore / targetScore) * 100 : 0;

    return (
        <div className={`
            rounded-xl flex items-center gap-3 transition-all duration-300 relative shadow-sm overflow-hidden
            ${(isActive && !showResults) || (showResults && isWinner)
                ? 'bg-[--color-surface] ring-1 ring-[--color-accent] p-4 shadow-lg z-10 scale-[1.02]' 
                : 'bg-[--color-surface-light] opacity-60 p-3 scale-100'}
        `}>
            {((isActive && !showResults) || (showResults && isWinner)) && <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${showResults ? 'bg-[--color-green]' : 'bg-[--color-accent]'}`}></div>}
            
            <div className="pl-1 relative">
                <Avatar avatar={playerData?.avatar || ''} className={isActive || isWinner ? "w-16 h-16" : "w-12 h-12"} />
                {showResults && isWinner && (
                    <div className="absolute -top-2 -right-2 bg-yellow-500 rounded-full p-1 shadow-lg">
                        <span className="text-xs">🏆</span>
                    </div>
                )}
            </div>
            
            <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2">
                    <p className={`font-bold truncate text-[--color-text-primary] ${isActive || isWinner ? 'text-xl' : 'text-base'}`}>
                        {playerData?.name || 'Hráč'}
                    </p>
                    {handicap > 0 && <span className="text-[10px] bg-[--color-yellow] text-black px-1 rounded font-bold uppercase">H+{handicap}</span>}
                </div>
                <div className="flex items-center gap-3">
                    <p className={`font-semibold text-[--color-text-secondary] ${isActive || isWinner ? 'text-sm' : 'text-xs'}`}>
                        {t('scoreboard.inning', { count: inning })}
                    </p>
                    <p className={`font-mono font-bold text-[--color-accent] ${isActive || isWinner ? 'text-sm' : 'text-xs'}`}>
                        Náběhů: {turns}
                    </p>
                </div>
            </div>
            
            <div className="flex flex-col items-end flex-shrink-0 pr-1">
                <p className={`font-mono font-extrabold text-[--color-text-primary] leading-none ${isActive || isWinner ? 'text-5xl' : 'text-3xl'}`}>
                    {score}
                </p>
                {isActive && !showResults && turnScore !== 0 && (
                    <p className={`font-mono font-bold text-lg ${turnScore > 0 ? 'text-[--color-green]' : 'text-[--color-red]'}`}>
                        {turnScore > 0 ? `+${turnScore}` : turnScore}
                    </p>
                )}
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
                <div
                    className={`h-full transition-all duration-1000 ease-out ${showResults && isWinner ? 'bg-[--color-green]' : 'bg-[--color-accent]'}`}
                    style={{ width: `${Math.min(100, Math.max(0, scorePercentage))}%` }}
                />
            </div>
        </div>
    );
};

export const SpectatorView: React.FC<{ gameState: ActiveGameState | null }> = ({ gameState }) => {
    const { t } = useTranslation();
    const [lastGameState, setLastGameState] = useState<ActiveGameState | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [showResults, setShowResults] = useState(false);
    const fixedResultsRef = useRef(false);

    useEffect(() => {
        if (gameState) {
            setLastGameState(gameState);
            if (gameState.isFinished) {
                setShowResults(true);
                fixedResultsRef.current = true;
            } else {
                setShowResults(false);
                fixedResultsRef.current = false;
            }
        } else if (lastGameState && !gameState && fixedResultsRef.current) {
            // Zápas dohrál a zmizel z DB, držíme report
        } else if (!gameState && !lastGameState) {
            setShowResults(false);
            fixedResultsRef.current = false;
        }
    }, [gameState]);

    useEffect(() => {
        const ids = gameState?.gameInfo.playerIds || lastGameState?.gameInfo.playerIds;
        if (!ids) return;
        
        const fetchPlayers = async () => {
            const { data } = await supabase.from('players').select('*').in('id', ids);
            if (data) setPlayers(data);
        };
        fetchPlayers();
    }, [gameState?.gameInfo.playerIds]);

    const displayState = gameState || lastGameState;
    if (!displayState) return null;

    const { gameInfo, scores, turnScore, turnsPerPlayer } = displayState;
    const getPlayer = (id: string) => players.find(p => p.id === id);
    
    const maxScore = Math.max(...(Object.values(scores) as number[]));
    const winners = gameInfo.playerIds.filter(pid => scores[pid] === maxScore);

    return (
        <div className="flex flex-col h-full bg-[--color-bg]">
            <div className={`${showResults ? 'bg-blue-600' : 'bg-red-600'} text-white text-center py-1 text-xs font-bold uppercase tracking-widest ${!showResults && 'animate-pulse'}`}>
                {showResults ? 'Zápas ukončen' : t('spectator.live')}
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <div className="text-center mb-2">
                    <h2 className="text-[--color-accent] font-bold text-xl">{t(gameInfo.type as any)}</h2>
                    <p className="text-[--color-text-secondary] text-xs uppercase">{t('gameSetup.targetScore')}: {gameInfo.targetScore}</p>
                </div>

                {gameInfo.playerIds.map((playerId, index) => (
                    <SpectatorCard
                        key={playerId}
                        playerId={playerId}
                        playerData={getPlayer(playerId)}
                        score={scores[playerId] || 0}
                        turnScore={(gameInfo.currentPlayerIndex === index && !showResults) ? turnScore : 0}
                        turns={turnsPerPlayer[playerId] || 0}
                        inning={gameInfo.inning}
                        isActive={!showResults && gameInfo.currentPlayerIndex === index}
                        isWinner={winners.includes(playerId)}
                        showResults={showResults}
                        targetScore={gameInfo.targetScore}
                        handicap={gameInfo.handicap?.playerId === playerId ? gameInfo.handicap.points : 0}
                    />
                ))}
            </div>
            
            <div className="p-4 text-center text-[--color-text-secondary] text-xs opacity-60">
                {showResults ? 'Prohlížíte si konečné výsledky' : t('spectator.watching')}
            </div>
        </div>
    );
};
