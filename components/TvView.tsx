
import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActiveGameState, Player } from '../types';
import Avatar from './Avatar';

const TvPlayerCard: React.FC<{
    playerMetadata?: { name: string; avatar: string };
    score: number;
    turnScore: number;
    turns: number;
    isActive: boolean;
    isWinner: boolean;
    showResults: boolean;
    targetScore: number;
    handicap?: number;
}> = ({ playerMetadata, score, turnScore, turns, isActive, isWinner, showResults, targetScore, handicap = 0 }) => {
    const currentTotal = score + turnScore;
    const progress = Math.min(100, (currentTotal / targetScore) * 100);

    return (
        <div className={`relative flex flex-col items-center justify-between p-6 rounded-[40px] transition-all duration-700 flex-1 h-full border-4 ${
            isActive && !showResults
            ? 'bg-[--color-surface] border-[--color-accent] shadow-[0_0_60px_rgba(45,212,191,0.2)] scale-[1.01] z-10' 
            : showResults && isWinner
            ? 'bg-[--color-surface] border-[--color-green] shadow-[0_0_60px_rgba(34,197,94,0.3)] scale-[1.01] z-10'
            : 'bg-black/40 border-transparent opacity-30 scale-95'
        }`}>
            {isActive && !showResults && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[--color-accent] text-black font-black px-8 py-1 rounded-full text-2xl uppercase tracking-tighter shadow-[0_0_20px_var(--color-accent)] animate-bounce">
                    Na tahu
                </div>
            )}

            {showResults && isWinner && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[--color-green] text-black font-black px-8 py-1 rounded-full text-3xl uppercase tracking-tighter shadow-[0_0_30px_rgba(34,197,94,0.5)]">
                    VÍTĚZ 🏆
                </div>
            )}
            
            {/* Header: Avatar + Jméno */}
            <div className="flex flex-col items-center gap-2 w-full mt-2">
                <div className={`relative ${(isActive && !showResults) || (showResults && isWinner) ? 'after:absolute after:inset-0 after:rounded-full after:shadow-[0_0_20px_var(--color-accent)] after:animate-pulse' : ''}`}>
                    <Avatar avatar={playerMetadata?.avatar || ''} className="w-28 h-28 border-8 border-white/10 shadow-xl" />
                </div>
                <h2 className="text-4xl font-black text-white text-center uppercase tracking-tight truncate w-full px-2">
                    {playerMetadata?.name || 'Hráč'}
                </h2>
                <div className="flex gap-3">
                    {handicap > 0 && (
                        <span className="text-xl font-bold bg-[--color-yellow] text-black px-4 py-0.5 rounded-lg shadow-lg">
                            +{handicap}
                        </span>
                    )}
                    <span className="text-xl font-bold bg-white/5 text-[--color-text-secondary] px-4 py-0.5 rounded-lg border border-white/10 uppercase tracking-tight">
                        {turns} náb.
                    </span>
                </div>
            </div>

            {/* Main: Skóre */}
            <div className="flex flex-col items-center justify-center flex-1">
                <div className="text-[170px] font-black leading-none font-mono tracking-tighter text-white drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)]">
                    {score}
                </div>
                {isActive && !showResults && turnScore > 0 && (
                    <div className="text-6xl font-black text-[--color-green] animate-score-pop drop-shadow-[0_0_10px_rgba(34,197,94,0.4)] mt-[-15px]">
                        +{turnScore}
                    </div>
                )}
            </div>

            {/* Footer: Progress bar */}
            <div className="w-full space-y-2 mb-2">
                <div className="h-6 w-full bg-black/50 rounded-full overflow-hidden border-2 border-white/5 p-0.5">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                            isActive || (showResults && isWinner) ? 'bg-[--color-accent]' : 'bg-gray-600'
                        }`}
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <div className="flex justify-between text-2xl font-black text-[--color-text-secondary] uppercase tracking-[0.1em] px-1 opacity-70">
                    <span>{Math.round(progress)}%</span>
                    <span>Cíl: {targetScore}</span>
                </div>
            </div>
        </div>
    );
};

export const TvView: React.FC<{ gameState: ActiveGameState | null; communityId: string }> = ({ gameState, communityId }) => {
    const { t } = useTranslation();
    const [lastGameState, setLastGameState] = useState<ActiveGameState | null>(null);
    const [showResults, setShowResults] = useState(false);
    const fixedResultsRef = useRef(false);

    useEffect(() => {
        if (gameState) {
            setLastGameState(gameState);
            if (gameState.isFinished) {
                setShowResults(true);
                fixedResultsRef.current = true; // Zafixujeme, že jsme viděli konec
            } else {
                setShowResults(false);
                fixedResultsRef.current = false;
            }
        } else if (lastGameState && !gameState && fixedResultsRef.current) {
            // Pokud stav zmizel z DB (smazán), ale my už víme, že je dohráno, nic neděláme a necháme zobrazené výsledky.
            // lastGameState zůstává naplněn posledními daty.
        } else if (!gameState && !lastGameState) {
            setShowResults(false);
            fixedResultsRef.current = false;
        }
    }, [gameState]);

    const displayState = gameState || lastGameState;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin + '/?community=' + communityId)}&bgcolor=111827&color=2dd4bf`;

    if (!displayState) {
        return (
            <div className="h-screen w-screen bg-[--color-bg] flex flex-col items-center justify-center p-20 text-center overflow-hidden">
                <div className="absolute top-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                    <span className="text-7xl animate-pulse">🏆</span>
                    <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic">Win3 Carom TV</h1>
                </div>

                <div className="flex items-center gap-12 bg-black/30 p-10 rounded-[50px] border-4 border-white/5 shadow-2xl">
                    <div className="bg-white p-4 rounded-[25px] shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                        <img src={qrUrl} alt="QR Code" className="w-56 h-56" />
                    </div>
                    <div className="text-left space-y-3 max-lg">
                        <h2 className="text-4xl font-black text-[--color-accent] uppercase tracking-tight">Herna: {communityId}</h2>
                        <p className="text-2xl text-[--color-text-secondary] leading-tight font-medium">
                            Naskenujte QR kód a připojte se ke stolu. <br/>
                            <span className="text-white/40 text-xl font-mono block mt-2">Připraveno ke sledování...</span>
                        </p>
                    </div>
                </div>

                <div className="absolute bottom-12 text-white/10 font-mono text-lg tracking-[1em] uppercase">
                    Digital Scoreboard System
                </div>
            </div>
        );
    }

    const { gameInfo, scores, turnScore, turnsPerPlayer, playerMetadata } = displayState;
    const maxScore = Math.max(...(Object.values(scores) as number[]));
    const winners = gameInfo.playerIds.filter(pid => scores[pid] === maxScore);
    const matchHighestRun = gameInfo.highestRuns ? Math.max(...(Object.values(gameInfo.highestRuns) as number[])) : 0;

    return (
        <div className="h-screen w-screen bg-[--color-bg] flex flex-col overflow-hidden p-12 gap-4">
            {/* Top Bar */}
            <div className="flex justify-between items-center px-6">
                <div className="flex items-center gap-4">
                    {showResults ? (
                        <span className="bg-blue-600 text-white px-6 py-1.5 rounded-full font-black text-2xl uppercase shadow-[0_0_20px_rgba(37,99,235,0.4)]">VÝSLEDKY</span>
                    ) : (
                        <span className="bg-red-600 text-white px-6 py-1.5 rounded-full font-black text-2xl uppercase animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.3)]">LIVE</span>
                    )}
                    <h3 className="text-4xl font-black text-white uppercase tracking-tighter opacity-80">{t(gameInfo.type as any)}</h3>
                </div>
                {!showResults ? (
                    <div className="text-3xl font-black text-[--color-accent] bg-white/5 px-8 py-2 rounded-[20px] border border-white/10 shadow-lg">
                        NÁBĚH: {gameInfo.inning}
                    </div>
                ) : (
                    <div className="text-2xl font-black text-[--color-yellow] bg-white/5 px-8 py-2 rounded-[20px] border border-white/10">
                        NEJVYŠŠÍ NÁBĚH HRY: {matchHighestRun}
                    </div>
                )}
            </div>

            {/* Players Grid */}
            <div className="flex-1 flex gap-6 items-stretch py-1">
                {gameInfo.playerIds.map((pid, idx) => (
                    <TvPlayerCard 
                        key={pid}
                        playerMetadata={playerMetadata?.[pid]}
                        score={scores[pid] || 0}
                        turnScore={(gameInfo.currentPlayerIndex === idx && !showResults) ? (turnScore as number) : 0}
                        turns={turnsPerPlayer[pid] || 0}
                        isActive={!showResults && gameInfo.currentPlayerIndex === idx}
                        isWinner={winners.includes(pid)}
                        showResults={showResults}
                        targetScore={gameInfo.targetScore as number}
                        handicap={gameInfo.handicap?.playerId === pid ? gameInfo.handicap.points : 0}
                    />
                ))}
            </div>

            {/* Minimal Footer */}
            <div className="flex justify-between items-center opacity-10 px-6 mb-2">
                 <span className="text-lg font-bold italic">WIN3 CAROM PRO</span>
                 <span className="text-lg font-mono uppercase tracking-widest">Community: {communityId}</span>
            </div>
        </div>
    );
};
