
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Player, GameRecord, GameInfo, GameSummary } from '../types';
import Avatar from './Avatar';
import ScoreInputPad from './ScoreInputPad';
import RetroScoreboard from './RetroScoreboard';
import CaromEffect from './CaromEffect';
import { triggerHapticFeedback } from '../utils';

const CompactTeamPlayerCard: React.FC<{
  player: Player;
  score: number;
  isActive: boolean;
}> = ({ player, score, isActive }) => {
  return (
    <div className={`relative flex items-center gap-2 p-2 rounded-lg transition-colors ${isActive ? 'bg-[--color-primary]/20' : 'bg-[--color-bg]'}`}>
      {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[--color-primary] rounded-l-lg animate-pulse"></div>}
      <Avatar avatar={player.avatar} className="w-8 h-8 flex-shrink-0" />
      <div className="flex-grow min-w-0">
        <p className="font-semibold text-white truncate text-xs">{player.name}</p>
      </div>
      <p className="font-mono font-bold text-sm text-white">{score}</p>
    </div>
  );
};

const CompactTeamScoreCard: React.FC<{
  teamName: string;
  teamPlayers: (Player & { movingAverage: number; lastSixResults: GameRecord['result'][] })[];
  teamScores: { [playerId: string]: number };
  isActive: boolean;
  activePlayerId: string | null;
  turnScore: number;
  targetScore: number;
  inning: number;
}> = ({ teamName, teamPlayers, teamScores, isActive, activePlayerId, turnScore, targetScore, inning }) => {
    const { t } = useTranslation();
    const totalScore = teamPlayers.reduce((sum, p) => sum + (teamScores[p.id] || 0), 0);
    const currentTotalScore = totalScore + turnScore;
    const scorePercentage = targetScore > 0 ? (currentTotalScore / targetScore) * 100 : 0;
    const pointsToTarget = Math.max(0, targetScore - currentTotalScore);
    
    return (
        <div className={`
            p-3 rounded-xl space-y-2 shadow-sm relative overflow-hidden transition-all
            ${isActive ? 'bg-[--color-surface] ring-1 ring-[--color-accent] z-10' : 'bg-[--color-surface-light] opacity-70'}
        `}>
            <div className="flex justify-between items-baseline">
                <h2 className="text-lg font-bold text-[--color-accent]">{teamName}</h2>
                 <p className="text-xs font-semibold text-[--color-text-secondary]">{t('scoreboard.inning', { count: inning })}</p>
            </div>
            
            <div className="flex justify-between items-baseline -mt-1 mb-1">
                 {pointsToTarget > 0 && isActive ? (
                    <p className="text-xs font-mono text-yellow-400">{t('scoreboard.pointsToTarget', { points: pointsToTarget })}</p>
                ) : <div />}
                <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-mono font-extrabold text-[--color-text-primary]">{totalScore}</p>
                     {isActive && turnScore !== 0 && (
                        <p key={turnScore} className={`text-xl font-mono font-bold animate-score-pop ${turnScore > 0 ? 'text-[--color-green]' : 'text-[--color-red]'}`}>
                            {turnScore > 0 ? `+${turnScore}` : turnScore}
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {teamPlayers.map(player => (
                    <CompactTeamPlayerCard 
                        key={player.id}
                        player={player}
                        score={teamScores[player.id] || 0}
                        isActive={player.id === activePlayerId}
                    />
                ))}
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

const TeamScoreboard: React.FC<{
    gameInfo: GameInfo;
    scores: { [playerId: string]: number };
    turnScore: number;
    activePlayersWithStats: (Player & { movingAverage: number, lastSixResults: GameRecord['result'][] })[];
    gameHistory: GameSummary['gameHistory'];
    players: Player[];
    handleAddToTurn: (scoreData: { points: number, type: string }) => void;
    handleEndTurn: () => void;
    handleUndoLastTurn: () => void;
    onRetroToggle: (retro: boolean) => void;
}> = (props) => {
    const { gameInfo, scores, turnScore, activePlayersWithStats, handleAddToTurn, handleEndTurn, handleUndoLastTurn, onRetroToggle } = props;
    const { t } = useTranslation();
    const [animTrigger, setAnimTrigger] = useState(0);

    const currentPlayer = activePlayersWithStats[gameInfo.currentPlayerIndex];
    const team1Players = activePlayersWithStats.filter((_, i) => i % 2 === 0);
    const team2Players = activePlayersWithStats.filter((_, i) => i % 2 !== 0);
    const isTeam1Active = gameInfo.currentPlayerIndex % 2 === 0;

    const activeTeamIds = gameInfo.playerIds.filter((_, i) => i % 2 === (isTeam1Active ? 0 : 1));
    const activeTeamScore = activeTeamIds.reduce((sum, id) => sum + (scores[id] || 0), 0);
    const pointsToTargetForTeam = gameInfo.targetScore - (activeTeamScore + turnScore);

    const handleScoreInput = (scoreData: { points: number; type: string }) => {
        if (scoreData.points > 0) {
            setAnimTrigger(prev => prev + 1);
        }
        handleAddToTurn(scoreData);
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
            
            <div className="absolute top-2 left-2 z-30">
                <button 
                    onClick={() => { triggerHapticFeedback(50); onRetroToggle(true); }} 
                    className="bg-[--color-surface] p-2 rounded-full shadow-md text-[--color-accent] hover:text-white hover:bg-[--color-accent] transition-colors"
                    title={t('scoreboard.retro')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
                <CompactTeamScoreCard
                    teamName={t('gameSetup.team1')}
                    teamPlayers={team1Players}
                    teamScores={scores}
                    isActive={isTeam1Active}
                    activePlayerId={currentPlayer?.id}
                    turnScore={isTeam1Active ? turnScore : 0}
                    targetScore={gameInfo.targetScore}
                    inning={gameInfo.inning}
                />
                <CompactTeamScoreCard
                    teamName={t('gameSetup.team2')}
                    teamPlayers={team2Players}
                    teamScores={scores}
                    isActive={!isTeam1Active}
                    activePlayerId={currentPlayer?.id}
                    turnScore={!isTeam1Active ? turnScore : 0}
                    targetScore={gameInfo.targetScore}
                    inning={gameInfo.inning}
                />
            </div>
             <div className="flex-shrink-0 bg-[--color-bg] px-2 pt-2 pb-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.2)] z-20">
                <ScoreInputPad
                    onScore={handleScoreInput}
                    onEndTurn={handleEndTurn}
                    onUndoTurn={handleUndoLastTurn}
                    isUndoTurnDisabled={props.gameHistory.length <= 1}
                    pointsToTarget={pointsToTargetForTeam}
                    allowOvershooting={gameInfo.allowOvershooting ?? false}
                    gameType={gameInfo.type}
                />
            </div>
        </div>
    );
};

export default TeamScoreboard;
