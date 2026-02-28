
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Player, AllStats, GameRecord } from '../types';
import Avatar from './Avatar';

const AverageTrendChart: React.FC<{ records: GameRecord[]; title: string }> = ({ records, title }) => {
    const { t } = useTranslation();
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    const chartData = useMemo(() => {
        const sortedRecords = [...records]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-20);

        if (sortedRecords.length < 2) return [];

        let cumulativeScore = 0;
        let cumulativeTurns = 0;

        return sortedRecords.map((record, index) => {
            cumulativeScore += record.score;
            cumulativeTurns += record.turns;
            return {
                game: index + 1,
                average: cumulativeTurns > 0 ? cumulativeScore / cumulativeTurns : 0,
                score: record.score,
                turns: record.turns
            };
        });
    }, [records]);

    useEffect(() => {
        if (chartData.length > 0) {
            setSelectedIndex(chartData.length - 1);
        }
    }, [chartData]);

    if (chartData.length < 2) {
        return (
            <div className="bg-black/20 rounded-lg p-4 w-full h-48 flex items-center justify-center">
                 <p className="text-[--color-text-secondary]">{t('playerStats.noStats')}</p>
            </div>
        );
    }
    
    const width = 300;
    const height = 120;
    const padding = 20;

    const maxAvg = Math.max(...chartData.map(d => d.average), 0);
    const minAvg = Math.min(...chartData.map(d => d.average));
    const range = maxAvg - minAvg;
    const plotMin = Math.max(0, minAvg - (range * 0.1));
    const plotMax = maxAvg + (range * 0.1);

    const getX = (index: number) => padding + (index / (chartData.length - 1)) * (width - padding * 2);
    const getY = (avg: number) => {
        const availableHeight = height - padding * 2;
        const normalized = (avg - plotMin) / (plotMax - plotMin || 1);
        return height - padding - (normalized * availableHeight);
    };

    const pathData = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.average)}`).join(' ');

    const selectedData = selectedIndex !== null ? chartData[selectedIndex] : null;

    return (
        <div className="bg-black/20 rounded-lg p-4 w-full flex flex-col items-center">
            <div className="flex justify-between w-full items-end mb-2 px-2">
                <h3 className="text-md font-bold text-[--color-accent]">{title}</h3>
                {selectedData && (
                    <div className="text-right">
                        <span className="text-[--color-text-secondary] text-xs block">Game {selectedData.game}</span>
                        <span className="text-xl font-mono font-bold text-[--color-primary]">{selectedData.average.toFixed(2)}</span>
                    </div>
                )}
            </div>
            
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto touch-none" aria-label={title}>
                <line x1={padding} y1={padding} x2={width - padding} y2={padding} className="stroke-[--color-border]" strokeWidth="0.5" strokeDasharray="2" />
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="stroke-[--color-border]" strokeWidth="0.5" />
                <text x={padding} y={padding - 6} textAnchor="start" className="text-[10px] fill-[--color-text-secondary] font-mono opacity-70">{plotMax.toFixed(2)}</text>
                <text x={padding} y={height - padding + 12} textAnchor="start" className="text-[10px] fill-[--color-text-secondary] font-mono opacity-70">{plotMin.toFixed(2)}</text>
                <path d={pathData} fill="none" className="stroke-[--color-accent]" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {selectedIndex !== null && (
                    <line x1={getX(selectedIndex)} y1={padding} x2={getX(selectedIndex)} y2={height - padding} className="stroke-[--color-text-primary]" strokeWidth="1" strokeDasharray="2" opacity="0.3" />
                )}
                {chartData.map((d, i) => {
                    const isSelected = selectedIndex === i;
                    const x = getX(i);
                    const y = getY(d.average);
                    return (
                        <g key={i} onClick={() => setSelectedIndex(i)}>
                            <rect x={x - 10} y="0" width="20" height={height} fill="transparent" />
                            <circle cx={x} cy={y} r={isSelected ? 5 : 2.5} className={`transition-all duration-200 ${isSelected ? 'fill-[--color-primary] stroke-white' : 'fill-[--color-accent] stroke-[--color-surface]'}`} strokeWidth={isSelected ? 2 : 1} />
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

const H2HStats: React.FC<{
    currentPlayerId: string;
    activeGameType: string;
    gameLog: GameRecord[];
    players: Player[];
}> = ({ currentPlayerId, activeGameType, gameLog, players }) => {
    const { t } = useTranslation();
    const playersMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

    const h2hData = useMemo(() => {
        const gamesByGameId = new Map<string, GameRecord[]>();
        gameLog.forEach(record => {
            if (!gamesByGameId.has(record.gameId)) {
                gamesByGameId.set(record.gameId, []);
            }
            gamesByGameId.get(record.gameId)!.push(record);
        });

        const opponentData: Record<string, { wins: number; losses: number; draws: number; }> = {};

        for (const gameRecords of gamesByGameId.values()) {
            if (
                gameRecords.length === 2 &&
                gameRecords[0].gameType === activeGameType &&
                gameRecords.some(r => r.playerId === currentPlayerId)
            ) {
                const currentPlayerRecord = gameRecords.find(r => r.playerId === currentPlayerId)!;
                const opponentRecord = gameRecords.find(r => r.playerId !== currentPlayerId)!;
                const opponentId = opponentRecord.playerId;

                if (!opponentData[opponentId]) {
                    opponentData[opponentId] = { wins: 0, losses: 0, draws: 0 };
                }

                if (currentPlayerRecord.result === 'win') opponentData[opponentId].wins++;
                else if (currentPlayerRecord.result === 'loss') opponentData[opponentId].losses++;
                else if (currentPlayerRecord.result === 'draw') opponentData[opponentId].draws++;
            }
        }
        
        return Object.entries(opponentData)
            .map(([opponentId, stats]) => ({
                opponent: playersMap.get(opponentId),
                ...stats,
            }))
            .filter(item => item.opponent)
            .sort((a, b) => (b.wins + b.losses + b.draws) - (a.wins + a.losses + a.draws)); 

    }, [currentPlayerId, activeGameType, gameLog, playersMap]);

    return (
        <div className="bg-black/20 rounded-lg p-4 w-full">
            <h3 className="text-md font-bold text-[--color-accent] mb-2 text-center">{t('playerStats.h2hTitle')}</h3>
            {h2hData.length > 0 ? (
                <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                    {h2hData.map(({ opponent, wins, losses, draws }) => {
                        if (!opponent) return null;
                        const totalGames = wins + losses + draws;
                        const winPercentage = totalGames > 0 ? (wins / totalGames) * 100 : 0;
                        return (
                            <div key={opponent.id} className="text-left">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <Avatar avatar={opponent.avatar} className="w-6 h-6" />
                                        <span className="font-semibold text-sm text-[--color-text-primary] truncate">{opponent.name}</span>
                                    </div>
                                    <div className="font-mono text-sm">
                                        <span className="text-[--color-green]">{wins}</span>
                                        <span className="text-[--color-text-secondary]">-</span>
                                        <span className="text-[--color-yellow]">{draws}</span>
                                        <span className="text-[--color-text-secondary]">-</span>
                                        <span className="text-[--color-red]">{losses}</span>
                                    </div>
                                </div>
                                <div className="h-2 w-full bg-[--color-red]/30 rounded-full">
                                    <div className="h-2 bg-[--color-green] rounded-full" style={{ width: `${winPercentage}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex items-center justify-center h-40">
                     <p className="text-[--color-text-secondary] text-sm">{t('playerStats.noH2hData')}</p>
                </div>
            )}
        </div>
    );
};

const PlayerProfileModal: React.FC<{
    player: Player;
    stats: AllStats;
    gameLog: GameRecord[];
    players: Player[];
    onClose: () => void;
}> = ({ player, stats: allPlayersStats, gameLog, players, onClose }) => {
    const { t } = useTranslation();
    
    const playerGameTypes = useMemo(() => 
        Object.keys(allPlayersStats).filter(gameType => allPlayersStats[gameType][player.id]),
    [allPlayersStats, player.id]);

    const [activeGameType, setActiveGameType] = useState<string | null>(() => {
        const fourBallKey = 'gameSetup.fourBall';
        if (playerGameTypes.includes(fourBallKey)) return fourBallKey;
        return playerGameTypes[0] || null;
    });
    
    const { displayedStats, playerGamesForType } = useMemo(() => {
        if (!activeGameType) return { displayedStats: null, playerGamesForType: [] };
        const gameTypeStats = allPlayersStats[activeGameType]?.[player.id];
        if (!gameTypeStats) return { displayedStats: null, playerGamesForType: [] };
        const gamesForType = gameLog
            .filter(g => g.playerId === player.id && g.gameType === activeGameType)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const last10 = gamesForType.slice(-10);
        const movingAvgTurns = last10.reduce((sum, g) => sum + g.turns, 0);
        const movingAvgScore = last10.reduce((sum, g) => sum + g.score, 0);
        const movingAverage = movingAvgTurns > 0 ? movingAvgScore / movingAvgTurns : 0;
        const overallAvgForType = gameTypeStats.totalTurns > 0 ? gameTypeStats.totalScore / gameTypeStats.totalTurns : 0;
        let trend: 'improving' | 'stagnating' | 'worsening' = 'stagnating';
        if (overallAvgForType > 0 && movingAverage > 0) {
            if (movingAverage > overallAvgForType * 1.05) trend = 'improving';
            if (movingAverage < overallAvgForType * 0.95) trend = 'worsening';
        }
        const draws = gameTypeStats.gamesPlayed - gameTypeStats.wins - gameTypeStats.losses;
        return { displayedStats: { ...gameTypeStats, average: overallAvgForType, trend, draws }, playerGamesForType: gamesForType };
    }, [activeGameType, player.id, allPlayersStats, gameLog]);

    const filterButtonClasses = (isActive: boolean) => `px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-[--color-primary] text-white' : 'bg-[--color-surface-light] text-[--color-text-secondary] hover:bg-[--color-surface]'}`;
    
    const TrendIndicator: React.FC<{ trend: 'improving' | 'stagnating' | 'worsening' }> = ({ trend }) => {
        switch (trend) {
            case 'improving': return <svg className="w-6 h-6 text-[--color-green]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>;
            case 'worsening': return <svg className="w-6 h-6 text-[--color-red]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>;
            default: return <svg className="w-6 h-6 text-[--color-text-secondary]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14" /></svg>;
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[--color-surface] rounded-2xl shadow-2xl p-6 w-full max-w-4xl text-center transform transition-transform duration-300 flex flex-col" onClick={e => e.stopPropagation()} style={{ height: 'auto', maxHeight: '90vh' }}>
                <div className="flex flex-col sm:flex-row gap-6 mb-6">
                    <div className="flex-shrink-0 text-center sm:w-1/3">
                        <Avatar avatar={player.avatar} className="w-32 h-32 mx-auto mb-4" />
                        <h2 className="text-3xl font-bold text-[--color-accent] break-words">{player.name}</h2>
                    </div>
                    <div className="flex-grow text-left sm:w-2/3">
                        <div className="w-full overflow-x-auto pb-2 mb-4">
                            <div className="flex items-center gap-2">
                                {playerGameTypes.map(typeKey => (
                                    <button key={typeKey} onClick={() => setActiveGameType(typeKey)} className={filterButtonClasses(activeGameType === typeKey)}>
                                        {t(typeKey as any)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {displayedStats ? (
                            <div className="bg-black/20 rounded-lg p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[--color-text-secondary] text-sm font-semibold">{t('playerStats.generalAverage')}</p>
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl font-mono font-extrabold text-[--color-text-primary]">{displayedStats.average.toFixed(2)}</span>
                                            <TrendIndicator trend={displayedStats.trend} />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[--color-text-secondary] text-sm font-semibold">{t('stats.records.highestScore')}</p>
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl font-mono font-extrabold text-[--color-accent]">{displayedStats.highestRun || 0}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[--color-text-secondary] text-sm font-semibold">{t('stats.games')}: {displayedStats.gamesPlayed}</p>
                                    <div className="flex items-center gap-4 font-mono text-2xl mt-1">
                                        <div title={t('stats.wins') as string}><span className="font-bold text-[--color-green]">V</span>: {displayedStats.wins}</div>
                                        <div title={t('tournament.draws') as string}><span className="font-bold text-[--color-yellow]">R</span>: {displayedStats.draws}</div>
                                        <div title={t('stats.losses') as string}><span className="font-bold text-[--color-red]">P</span>: {displayedStats.losses}</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-48 bg-black/20 rounded-lg">
                                <p className="text-center text-[--color-text-secondary]">{t('playerStats.noStats')}</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto border-t border-[--color-border] pt-4 pr-2 -mr-2 space-y-4">
                    {activeGameType && (
                        <div className="grid md:grid-cols-2 gap-4">
                            <AverageTrendChart records={playerGamesForType} title={t('playerStats.avgTrendTitle')} />
                            <H2HStats currentPlayerId={player.id} activeGameType={activeGameType} gameLog={gameLog} players={players} />
                        </div>
                    )}
                </div>
                <div className="flex gap-4 flex-shrink-0 mt-6">
                    <button onClick={onClose} className="w-full bg-[--color-surface-light] hover:bg-[--color-border] text-[--color-text-primary] font-bold py-3 rounded-lg transition-colors">
                        {t('playerStats.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlayerProfileModal;
