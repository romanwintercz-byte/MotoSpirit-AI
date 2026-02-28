
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Player, GameRecord, GameInfo } from '../types';
import Avatar from './Avatar';
import { triggerHapticFeedback } from '../utils';

interface BeadRowProps {
    color: string;
    value: number; // Počet kuliček vpravo (0-10)
    onUpdate: (newValue: number) => void;
}

const BeadRow: React.FC<BeadRowProps> = ({ color, value, onUpdate }) => {
    const totalBeads = 10;
    
    const handleClick = (index: number) => {
        triggerHapticFeedback(20);
        const leftCount = totalBeads - value;
        const isCurrentlyOnLeft = index < leftCount;
        
        if (isCurrentlyOnLeft) {
            onUpdate(totalBeads - index);
        } else {
            onUpdate(totalBeads - index - 1);
        }
    };

    return (
        <div className="relative h-8 sm:h-10 w-full flex items-center group">
            {/* Drát (Rod) */}
            <div className="absolute left-0 right-0 h-1 bg-gradient-to-b from-[#b8860b] via-[#ffd700] to-[#8b4513] rounded-full shadow-inner border border-black/20"></div>
            
            {/* Beads Container */}
            <div className="relative w-full h-full">
                {Array.from({ length: totalBeads }).map((_, i) => {
                    const isOnRight = i >= (totalBeads - value);
                    
                    // Velikost kuličky - na mobilu o něco menší
                    const beadSize = "clamp(22px, 6.5vw, 28px)";
                    
                    const style: React.CSSProperties = isOnRight 
                        ? { right: `calc(${(totalBeads - 1 - i)} * ${beadSize})` }
                        : { left: `calc(${i} * ${beadSize})` };

                    return (
                        <button
                            key={i}
                            onClick={() => handleClick(i)}
                            className="absolute top-1/2 -translate-y-1/2 rounded-full shadow-xl transition-all duration-500 cubic-bezier(0.25, 1, 0.5, 1) border border-black/40 active:scale-90 touch-none"
                            style={{ 
                                ...style,
                                width: beadSize,
                                height: beadSize,
                                backgroundColor: color,
                                backgroundImage: `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.45) 0%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.5) 100%)`,
                                zIndex: 10 + (isOnRight ? (totalBeads - i) : i),
                                boxShadow: 'inset -1px -1px 4px rgba(0,0,0,0.6), 1px 2px 4px rgba(0,0,0,0.5)'
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
};

const AbacusPlayer: React.FC<{
    player: Player;
    score: number;
    turnScore: number;
    isActive: boolean;
    onScoreChange: (totalNewScore: number) => void;
}> = ({ player, score, turnScore, isActive, onScoreChange }) => {
    const totalCurrent = score + turnScore;

    const hundreds = Math.floor(totalCurrent / 100);
    const tens = Math.floor((totalCurrent % 100) / 10);
    const units = totalCurrent % 10;

    const updateScore = (h: number, t: number, u: number) => {
        const newScore = Math.max(0, Math.min(999, h * 100 + t * 10 + u));
        onScoreChange(newScore);
    };

    return (
        <div className={`flex flex-col gap-1 sm:gap-2 p-2.5 sm:p-4 rounded-3xl transition-all duration-500 border-2 ${
            isActive ? 'bg-[#3d2b1f] border-[#ffd700] shadow-[0_0_40px_rgba(0,0,0,0.6)]' : 'bg-[#2a1d15] border-transparent opacity-50 scale-[0.98]'
        }`} style={{ 
            backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-wood.png")',
            boxShadow: isActive ? 'inset 0 0 60px rgba(0,0,0,0.6), 0 10px 25px rgba(0,0,0,0.8)' : 'inset 0 0 50px rgba(0,0,0,0.8)'
        }}>
            {/* Header se jménem a skóre */}
            <div className="flex items-center gap-3 sm:gap-4 mb-0.5 sm:mb-1">
                <Avatar avatar={player.avatar} className={`w-9 h-9 sm:w-14 sm:h-14 border-2 ${isActive ? 'border-[#ffd700] shadow-[0_0_15px_rgba(255,215,0,0.3)]' : 'border-white/10'}`} />
                <div className="flex-grow min-w-0">
                    <h3 className="text-xs sm:text-xl font-black text-white uppercase tracking-tighter truncate leading-tight">{player.name}</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl sm:text-4xl font-mono font-black text-[#ffd700] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-none">{totalCurrent}</span>
                        {isActive && turnScore > 0 && <span className="text-[10px] sm:text-sm font-bold text-green-400 animate-pulse">+{turnScore}</span>}
                    </div>
                </div>
            </div>

            {/* Samotné počitadlo (Abacus) */}
            <div className="space-y-1.5 sm:space-y-5 py-2 sm:py-4 px-2 bg-black/50 rounded-2xl border border-white/5 shadow-inner">
                {/* Jednotky (Žlutá) */}
                <BeadRow color="#facc15" value={units} onUpdate={(v) => updateScore(hundreds, tens, v)} />
                {/* Desítky (Modrá) */}
                <BeadRow color="#2563eb" value={tens} onUpdate={(v) => updateScore(hundreds, v, units)} />
                {/* Stovky (Červená) */}
                <BeadRow color="#dc2626" value={hundreds} onUpdate={(v) => updateScore(v, tens, units)} />
            </div>
        </div>
    );
};

const RetroScoreboard: React.FC<{
    gameInfo: GameInfo;
    scores: { [playerId: string]: number };
    turnScore: number;
    activePlayersWithStats: (Player & { movingAverage: number, lastSixResults: GameRecord['result'][] })[];
    handleAddToTurn: (scoreData: { points: number, type: string }) => void;
    handleEndTurn: () => void;
}> = ({ gameInfo, scores, turnScore, activePlayersWithStats, handleAddToTurn, handleEndTurn }) => {
    const { t } = useTranslation();
    const currentPlayerId = gameInfo.playerIds[gameInfo.currentPlayerIndex];

    const handleRetroScoreChange = (newTotalScore: number) => {
        const baseScore = scores[currentPlayerId] || 0;
        const diff = newTotalScore - (baseScore + turnScore);
        if (diff !== 0) {
            handleAddToTurn({ points: diff, type: 'retro' });
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#120a07] overflow-hidden">
             <div className="flex justify-center py-1.5 sm:py-3 px-4">
                <div className="bg-black/40 px-5 sm:px-8 py-0.5 sm:py-1 rounded-full border border-white/10 shadow-lg">
                    <span className="text-[9px] sm:text-xs font-black uppercase tracking-[0.4em] text-[#ffd700]/80">
                        {t('scoreboard.inning', { count: gameInfo.inning })}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-1 space-y-2 sm:space-y-6 no-scrollbar">
                {activePlayersWithStats.map((player, index) => (
                    <AbacusPlayer
                        key={player.id}
                        player={player}
                        score={scores[player.id] || 0}
                        turnScore={gameInfo.currentPlayerIndex === index ? turnScore : 0}
                        isActive={gameInfo.currentPlayerIndex === index}
                        onScoreChange={handleRetroScoreChange}
                    />
                ))}
            </div>

            <div className="p-2.5 sm:p-4 bg-[#1a110d] border-t border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20">
                <button 
                    onClick={() => { triggerHapticFeedback(80); handleEndTurn(); }} 
                    className="w-full bg-gradient-to-b from-[#ffd700] via-[#daa520] to-[#b8860b] text-black font-extrabold py-3 sm:py-5 rounded-2xl text-base sm:text-2xl uppercase tracking-widest shadow-[0_4px_15px_rgba(0,0,0,0.4)] active:scale-[0.98] active:brightness-90 transition-all border-t border-white/30"
                >
                    {t('scorePad.endTurn')}
                </button>
            </div>
        </div>
    );
};

export default RetroScoreboard;
