
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AllStats, Player, PlayerStats, GameRecord, GameStats } from '../types';
import Avatar from './Avatar';

type ChartMetric = 'winRate' | 'average' | 'totalWins';

const BarChart: React.FC<{ data: any[], metric: ChartMetric, playersMap: Map<string, Player> }> = ({ data, metric, playersMap }) => {
    const width = 800;
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 90, left: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const sortedData = useMemo(() => [...data].sort((a,b) => b[metric] - a[metric]), [data, metric]);

    const maxValue = Math.max(...sortedData.map(d => d[metric]), 0);
    const xScale = (index: number) => margin.left + (index * (chartWidth / sortedData.length));
    const yScale = (value: number) => chartHeight + margin.top - (value / maxValue) * chartHeight;
    const barWidth = (chartWidth / sortedData.length) * 0.7;

    const yAxisTicks = useMemo(() => {
        if (maxValue === 0) return [];
        const ticks = [];
        for (let i = 0; i <= 5; i++) {
            ticks.push((maxValue / 5) * i);
        }
        return ticks;
    }, [maxValue]);
    
    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-label="Player Comparison Chart">
            {yAxisTicks.map(tick => (
                <g key={tick} transform={`translate(0, ${yScale(tick)})`}>
                    <line x1={margin.left - 5} y1="0" x2={chartWidth + margin.left} y2="0" className="stroke-[--color-border]/50" strokeWidth="1" />
                    <text x={margin.left - 10} y="0" dy="0.3em" textAnchor="end" className="text-xs fill-[--color-text-secondary] font-mono">
                        {metric === 'winRate' ? `${tick.toFixed(0)}%` : metric === 'average' ? tick.toFixed(2) : tick}
                    </text>
                </g>
            ))}
            {sortedData.map((d, i) => {
                const player = playersMap.get(d.playerId);
                return (
                    <g key={d.playerId} transform={`translate(${xScale(i)}, 0)`}>
                        <rect
                            x={barWidth * 0.15}
                            y={yScale(d[metric])}
                            width={barWidth}
                            height={chartHeight + margin.top - yScale(d[metric])}
                            className="fill-[--color-primary] hover:fill-[--color-accent] transition-colors"
                            rx="4"
                        >
                            <title>{player?.name}: {d[metric].toFixed(2)}</title>
                        </rect>
                         <text x={barWidth / 2 + 5} y={chartHeight + margin.top + 15} textAnchor="middle" className="text-xs fill-[--color-text-secondary] font-semibold" transform={`rotate(-45, ${barWidth / 2 + 5}, ${chartHeight + margin.top + 15})`}>
                            {player?.name}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
};

const RecordCard: React.FC<{ title: string; value: number; unit: string; player?: Player; precision?: number }> = ({ title, value, unit, player, precision = 2 }) => (
    <div className="bg-black/20 p-4 rounded-lg text-center flex flex-col justify-between">
        <div>
            <h4 className="text-sm font-semibold text-[--color-text-secondary] uppercase tracking-wider">{title}</h4>
            <p className="text-4xl font-extrabold font-mono text-[--color-accent] my-2">{value.toFixed(precision)}</p>
            <p className="text-sm text-[--color-text-secondary]">{unit}</p>
        </div>
        {player ? (
            <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-[--color-border]/50">
                <Avatar avatar={player.avatar} className="w-8 h-8"/>
                <span className="font-semibold text-[--color-text-primary] truncate">{player.name}</span>
            </div>
        ) : (
            <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-[--color-border]/50 opacity-50">
                <Avatar avatar="" className="w-8 h-8"/>
                <span className="font-semibold text-[--color-text-primary]">---</span>
            </div>
        )}
    </div>
);

type MatchHistoryItem = {
    gameId: string;
    gameType: string;
    date: string;
    turns: number;
    players: {
        playerId: string;
        score: number;
        result: 'win' | 'loss' | 'draw';
    }[];
};

const MatchHistoryCard: React.FC<{ match: MatchHistoryItem, playersMap: Map<string, Player> }> = ({ match, playersMap }) => {
    const { t } = useTranslation();
    const date = new Date(match.date).toLocaleDateString() + ' ' + new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="bg-[--color-surface] rounded-xl p-4 shadow-md border border-[--color-border]/30">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-[--color-border]/20">
                <span className="text-[--color-accent] font-bold text-sm">{t(match.gameType as any)}</span>
                <span className="text-[--color-text-secondary] text-xs">{date}</span>
            </div>
            
            <div className="space-y-3">
                {match.players.map(p => {
                    const player = playersMap.get(p.playerId);
                    const isWinner = p.result === 'win';
                    return (
                        <div key={p.playerId} className={`flex items-center justify-between ${isWinner ? 'font-bold' : ''}`}>
                            <div className="flex items-center gap-3">
                                <Avatar avatar={player?.avatar || ''} className="w-8 h-8" />
                                <span className={`truncate max-w-[120px] ${isWinner ? 'text-[--color-text-primary]' : 'text-[--color-text-secondary]'}`}>
                                    {player?.name || 'Unknown'}
                                </span>
                                {isWinner && <span className="text-xs bg-[--color-green]/20 text-[--color-green] px-2 py-0.5 rounded-full ml-1">Win</span>}
                            </div>
                            <div className="flex items-center gap-4 text-sm font-mono">
                                {p.result === 'draw' && <span className="text-[--color-yellow]">Draw</span>}
                                <span className={`${isWinner ? 'text-[--color-accent] text-xl' : 'text-[--color-text-secondary] text-lg'}`}>{p.score}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="mt-3 pt-2 border-t border-[--color-border]/20 flex justify-end">
                <span className="text-xs text-[--color-text-secondary]">{t('stats.history.turns')}: {match.turns}</span>
            </div>
        </div>
    );
};

const StatsView: React.FC<{ stats: AllStats; players: Player[], completedGamesLog: GameRecord[] }> = ({ stats, players, completedGamesLog }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
    
    const gameTypes = useMemo(() => Object.keys(stats), [stats]);
    
    const [selectedGameType, setSelectedGameType] = useState<string | null>(gameTypes[0] || null);
    const [chartMetric, setChartMetric] = useState<ChartMetric>('winRate');

    const playersMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

    const processedData = useMemo(() => {
        if (!selectedGameType || !stats[selectedGameType]) return [];
        const gameStats = stats[selectedGameType];
        if (typeof gameStats !== 'object' || gameStats === null) return [];

        return Object.entries(gameStats).map(([playerId, playerStats]) => {
            const ps = playerStats as PlayerStats;
            if (!ps || typeof ps !== 'object') return null;
            return {
                playerId,
                winRate: ps.gamesPlayed > 0 ? (ps.wins / ps.gamesPlayed) * 100 : 0,
                average: ps.totalTurns > 0 ? ps.totalScore / ps.totalTurns : 0,
                totalWins: ps.wins,
                gamesPlayed: ps.gamesPlayed,
                losses: ps.losses,
                highestRun: ps.highestRun || 0 
            };
        }).filter((p): p is NonNullable<typeof p> => p !== null);
    }, [selectedGameType, stats]);

    const keyMetrics = useMemo(() => {
        if (!selectedGameType || !stats[selectedGameType]) return { totalGames: 0 };
        const gameStats: GameStats = stats[selectedGameType];
        const totalGames = Object.values(gameStats).reduce((sum, ps) => sum + (ps.gamesPlayed || 0), 0) / 2; 
        return { totalGames: Math.round(totalGames) };
    }, [selectedGameType, stats]);

    const hallOfFame = useMemo(() => {
        if (!selectedGameType || completedGamesLog.length === 0) return {};
        const gameLogForType = completedGamesLog.filter(g => g.gameType === selectedGameType);
        if (gameLogForType.length === 0) return {};

        const findRecord = (extractor: (g: GameRecord) => number, comparator: (a: number, b: number) => boolean) => {
            return gameLogForType.reduce((best, game) => {
                const value = extractor(game);
                if (best === null || comparator(value, best.value)) {
                    return { value, playerId: game.playerId };
                }
                return best;
            }, null as { value: number, playerId: string } | null);
        };
        
        const highestAvg = findRecord(g => g.turns > 0 ? g.score / g.turns : 0, (a, b) => a > b);
        const highestRun = findRecord(g => g.highestRun, (a, b) => a > b);
        
        // UPRAVENO: Rekord náběhů uznáváme pouze pokud hráč neměl handicap (hrál celou partii od 0)
        const fewestInnings = findRecord(
            g => (g.result === 'win' && (!g.handicapApplied || g.handicapApplied === 0)) ? g.turns : Infinity, 
            (a, b) => a < b
        );

        const streaks: { [playerId: string]: number } = {};
        players.forEach(p => {
            const playerGames = gameLogForType
                .filter(g => g.playerId === p.id)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            let max = 0, current = 0;
            playerGames.forEach(g => {
                if (g.result === 'win') current++; else { max = Math.max(max, current); current = 0; }
            });
            streaks[p.id] = Math.max(max, current);
        });

        const longestStreakPlayerId = Object.keys(streaks).reduce((a, b) => streaks[a] > streaks[b] ? a : b, Object.keys(streaks)[0]);

        return {
            highestAvg,
            highestRun,
            fewestInnings: fewestInnings && fewestInnings.value !== Infinity ? fewestInnings : null,
            longestStreak: streaks[longestStreakPlayerId] > 0 ? { value: streaks[longestStreakPlayerId], playerId: longestStreakPlayerId } : null
        };

    }, [selectedGameType, completedGamesLog, players]);

    const matchHistory = useMemo(() => {
        const grouped: { [key: string]: MatchHistoryItem } = {};
        
        const filteredLogs = selectedGameType 
            ? completedGamesLog.filter(g => g.gameType === selectedGameType)
            : completedGamesLog;

        filteredLogs.forEach(log => {
            if (!grouped[log.gameId]) {
                grouped[log.gameId] = {
                    gameId: log.gameId,
                    gameType: log.gameType,
                    date: log.date,
                    turns: log.turns,
                    players: []
                };
            }
            grouped[log.gameId].players.push({
                playerId: log.playerId,
                score: log.score,
                result: log.result
            });
        });

        return Object.values(grouped).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [completedGamesLog, selectedGameType]);
    
    const buttonClasses = (isActive: boolean) => `px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-[--color-primary] text-white' : 'bg-[--color-surface-light] text-[--color-text-secondary] hover:bg-[--color-bg]'}`;
    
    return (
        <div className="w-full max-w-6xl p-4">
            <h1 className="text-4xl font-extrabold text-[--color-text-primary] mb-4 text-center">{t('stats.title')}</h1>

            <div className="flex justify-center mb-6 bg-[--color-surface-light] p-1 rounded-lg w-max mx-auto">
                <button 
                    onClick={() => setActiveTab('overview')} 
                    className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-[--color-surface] text-[--color-text-primary] shadow-sm' : 'text-[--color-text-secondary]'}`}
                >
                    {t('stats.tab.overview')}
                </button>
                <button 
                    onClick={() => setActiveTab('history')} 
                    className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-[--color-surface] text-[--color-text-primary] shadow-sm' : 'text-[--color-text-secondary]'}`}
                >
                    {t('stats.tab.history')}
                </button>
            </div>

            <div className="w-full overflow-x-auto pb-2 mb-6">
                <div className="flex items-center justify-center gap-2">
                    {gameTypes.length > 0 ? (
                        gameTypes.map(typeKey => (
                            <button key={typeKey} onClick={() => setSelectedGameType(typeKey)} className={buttonClasses(selectedGameType === typeKey)}>
                                {t(typeKey as any)}
                            </button>
                        ))
                    ) : ( <p className="text-center text-[--color-text-secondary]">{t('stats.noStatsForGame')}</p> )}
                </div>
            </div>

            {activeTab === 'overview' ? (
                selectedGameType && processedData.length > 0 ? (
                    <div className="space-y-12">
                        <div className="bg-[--color-surface] p-6 rounded-lg shadow-lg">
                            <h2 className="text-2xl font-bold text-[--color-accent] mb-4">{t('stats.keyMetrics')}</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-black/20 p-4 rounded-lg text-center">
                                    <p className="text-4xl font-extrabold font-mono text-[--color-primary]">{keyMetrics.totalGames}</p>
                                    <p className="text-sm font-semibold text-[--color-text-secondary] uppercase tracking-wider">{t('stats.totalGames')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[--color-surface] p-6 rounded-lg shadow-lg">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold text-[--color-accent]">{t('stats.chart.title')}</h2>
                                <div className="flex items-center gap-2 rounded-lg bg-[--color-bg] p-1">
                                    <button onClick={() => setChartMetric('winRate')} className={buttonClasses(chartMetric === 'winRate')}>{t('stats.chart.winPercentage')}</button>
                                    <button onClick={() => setChartMetric('average')} className={buttonClasses(chartMetric === 'average')}>{t('stats.chart.average')}</button>
                                    <button onClick={() => setChartMetric('totalWins')} className={buttonClasses(chartMetric === 'totalWins')}>{t('stats.chart.totalWins')}</button>
                                </div>
                            </div>
                            <BarChart data={processedData} metric={chartMetric} playersMap={playersMap} />
                        </div>

                        <div className="bg-[--color-surface] p-6 rounded-lg shadow-lg">
                            <h2 className="text-2xl font-bold text-[--color-accent] mb-4">{t('stats.hallOfFame')}</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <RecordCard title={t('stats.records.highestAvg')} value={hallOfFame.highestAvg?.value || 0} unit={t('stats.inAGame')} player={playersMap.get(hallOfFame.highestAvg?.playerId || '')} />
                                <RecordCard title={t('stats.records.highestScore')} value={hallOfFame.highestRun?.value || 0} unit={t('stats.inAGame')} player={playersMap.get(hallOfFame.highestRun?.playerId || '')} precision={0} />
                                <RecordCard title={t('stats.records.fewestInnings')} value={hallOfFame.fewestInnings?.value || 0} unit={t('stats.inAGame')} player={playersMap.get(hallOfFame.fewestInnings?.playerId || '')} precision={0} />
                                <RecordCard title={t('stats.records.longestStreak')} value={hallOfFame.longestStreak?.value || 0} unit={t('stats.streakUnit')} player={playersMap.get(hallOfFame.longestStreak?.playerId || '')} precision={0} />
                            </div>
                        </div>

                        <div className="overflow-x-auto bg-[--color-surface] rounded-lg shadow-lg">
                            <table className="w-full text-left">
                                <thead className="bg-black/20">
                                    <tr>
                                        <th className="p-4 font-semibold text-[--color-accent] uppercase tracking-wider text-sm">{t('stats.player')}</th>
                                        <th className="p-4 font-semibold text-[--color-accent] uppercase tracking-wider text-sm text-center">{t('stats.games')}</th>
                                        <th className="p-4 font-semibold text-[--color-accent] uppercase tracking-wider text-sm text-center">{t('stats.wins')}</th>
                                        <th className="p-4 font-semibold text-[--color-accent] uppercase tracking-wider text-sm text-center">{t('stats.losses')}</th>
                                        <th className="p-4 font-semibold text-[--color-accent] uppercase tracking-wider text-sm text-center">{t('stats.winRate')}</th>
                                        <th className="p-4 font-semibold text-[--color-accent] uppercase tracking-wider text-sm text-center">{t('stats.avgScore')}</th>
                                        <th className="p-4 font-semibold text-[--color-accent] uppercase tracking-wider text-sm text-center">HR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...processedData].sort((a,b) => b.winRate - a.winRate).map((playerData, index) => {
                                        const player = playersMap.get(playerData.playerId);
                                        if (!player) return null;
                                        return (
                                        <tr key={player.id} className="border-b border-[--color-border]/50 hover:bg-black/20 transition-colors">
                                            <td className="p-4 flex items-center gap-3">
                                                <span className="font-bold text-[--color-text-secondary] w-6 text-center">{index + 1}.</span>
                                                <Avatar avatar={player.avatar} className="w-10 h-10" />
                                                <span className="font-semibold text-[--color-text-primary]">{player.name}</span>
                                            </td>
                                            <td className="p-4 text-center font-mono">{playerData.gamesPlayed}</td>
                                            <td className="p-4 text-center font-mono font-bold text-[--color-green]">{playerData.totalWins}</td>
                                            <td className="p-4 text-center font-mono font-bold text-[--color-red]">{playerData.losses}</td>
                                            <td className="p-4 text-center font-mono">{playerData.winRate.toFixed(0)}%</td>
                                            <td className="p-4 text-center font-mono">{playerData.average.toFixed(2)}</td>
                                            <td className="p-4 text-center font-mono">{playerData.highestRun}</td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-[--color-text-secondary] mt-16">{selectedGameType ? t('stats.noStatsForGame') : t('stats.selectGameType')}</p>
                )
            ) : (
                <div className="space-y-4">
                    {matchHistory.length > 0 ? (
                        matchHistory.map(match => (
                            <MatchHistoryCard key={match.gameId} match={match} playersMap={playersMap} />
                        ))
                    ) : (
                        <p className="text-center text-[--color-text-secondary] mt-16">{t('stats.noStatsForGame')}</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default StatsView;
