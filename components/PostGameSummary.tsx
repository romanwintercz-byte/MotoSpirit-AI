
import React, { useState, useMemo, useRef, useEffect, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GameSummary, Player } from '../types';
import Avatar from './Avatar';
import { FALLBACK_AVATAR_PATH } from '../constants';
import { dataURLtoFile } from '../utils';

type ThemeColors = {
    bg: string;
    surface: string;
    surfaceLight: string;
    primary: string;
    accent: string;
    textPrimary: string;
    textSecondary: string;
    green: string;
    yellow: string;
};

const ShareImageSVGGame = forwardRef<SVGSVGElement, { summary: GameSummary, players: Player[], themeColors: ThemeColors }>(({ summary, players, themeColors }, ref) => {
    const { t } = useTranslation();
    const { gameInfo, finalScores, turnsPerPlayer } = summary;
    const playersMap = new Map<string, Player>(players.map(p => [p.id, p]));
    const width = 1200;
    const height = 630;

    const PlayerCard: React.FC<{ playerId: string, y: number, isWinner: boolean }> = ({ playerId, y, isWinner }) => {
        const player = playersMap.get(playerId);
        if (!player) return null;
        
        const handicap = gameInfo.handicap?.playerId === playerId ? gameInfo.handicap.points : 0;
        const turns = turnsPerPlayer[playerId] || 0;
        const average = turns > 0 ? ((finalScores[playerId] - handicap) / turns) : 0;

        const avatar = player.avatar || FALLBACK_AVATAR_PATH;
        const isDataUrl = avatar.startsWith('data:image');
        
        return (
            <g transform={`translate(0, ${y})`}>
                <rect x="60" y="0" width={width-120} height="120" rx="20" fill={themeColors.surfaceLight} />
                {isWinner && <rect x="56" y="-4" width={width-112} height="128" rx="24" fill="none" stroke={themeColors.green} strokeWidth="4" />}

                {isDataUrl ? (
                    <image href={avatar} x="85" y="20" height="80" width="80" clipPath="url(#avatarClip)" />
                ) : (
                    <g transform="translate(85, 20)">
                        <circle cx="40" cy="40" r="40" fill={themeColors.primary} />
                        <path d={avatar} fill="#fff" transform="translate(16, 16) scale(2.5)" />
                    </g>
                )}

                <text x="190" y="45" fill={themeColors.textPrimary} fontSize="36" fontWeight="bold" fontFamily="sans-serif">{player.name}</text>
                {handicap > 0 && <text x="190" y="85" fill={themeColors.yellow} fontSize="20" fontFamily="sans-serif">{t('postGame.handicapApplied', { points: handicap })}</text>}
                
                <text x={width - 90} y="75" fill={themeColors.accent} fontSize="70" fontWeight="bold" textAnchor="end" fontFamily="sans-serif">{finalScores[playerId]}</text>
                
                <text x="750" y="70" textAnchor="end" fill={themeColors.textSecondary} fontSize="24" fontFamily="sans-serif">{t('postGame.average')}</text>
                <text x="750" y="70" textAnchor="start" fill={themeColors.textPrimary} fontSize="28" fontWeight="bold" fontFamily="sans-serif" dx="10">{average.toFixed(2)}</text>
            </g>
        );
    };

    return (
        <svg ref={ref} width={width} height={height} viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink">
            <defs><clipPath id="avatarClip"><circle cx="40" cy="40" r="40" /></clipPath></defs>
            <rect width="100%" height="100%" fill={themeColors.bg} />
            <text x={width / 2} y="70" textAnchor="middle" fill={themeColors.accent} fontSize="52" fontWeight="bold" fontFamily="sans-serif">
                {t('postGame.title')}
            </text>
            <text x={width / 2} y="120" textAnchor="middle" fill={themeColors.textSecondary} fontSize="28" fontFamily="sans-serif">
                {t(gameInfo.type as any)}
            </text>

            <g transform="translate(0, 160)">
                {gameInfo.playerIds.map((pid, index) => (
                    <PlayerCard key={pid} playerId={pid} y={index * 140} isWinner={summary.winnerIds.includes(pid)} />
                ))}
            </g>

            <text x={width - 40} y={height - 30} textAnchor="end" fill={themeColors.textSecondary} opacity="0.7" fontSize="20" fontFamily="sans-serif">
                {t('share.generatedBy')}
            </text>
        </svg>
    );
});

const ShareModal = ({ summary, players, onClose }: { summary: GameSummary, players: Player[], onClose: () => void }) => {
    const { t } = useTranslation();
    const svgRef = useRef<SVGSVGElement>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [themeColors, setThemeColors] = useState<ThemeColors | null>(null);

    useEffect(() => {
        const rootStyles = getComputedStyle(document.documentElement);
        setThemeColors({
            bg: rootStyles.getPropertyValue('--color-bg').trim(),
            surface: rootStyles.getPropertyValue('--color-surface').trim(),
            surfaceLight: rootStyles.getPropertyValue('--color-surface-light').trim(),
            primary: rootStyles.getPropertyValue('--color-primary').trim(),
            accent: rootStyles.getPropertyValue('--color-accent').trim(),
            textPrimary: rootStyles.getPropertyValue('--color-text-primary').trim(),
            textSecondary: rootStyles.getPropertyValue('--color-text-secondary').trim(),
            green: rootStyles.getPropertyValue('--color-green').trim(),
            yellow: rootStyles.getPropertyValue('--color-yellow').trim(),
        });
    }, []);

    useEffect(() => {
        if (!svgRef.current || !themeColors) return;
        const generate = async () => {
            try {
                const svgNode = svgRef.current!;
                const svgString = new XMLSerializer().serializeToString(svgNode);
                const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
                const img = new Image();
                const canvas = document.createElement('canvas');
                canvas.width = svgNode.width.baseVal.value;
                canvas.height = svgNode.height.baseVal.value;
                const ctx = canvas.getContext('2d');
                img.onload = () => {
                    ctx?.drawImage(img, 0, 0);
                    const pngUrl = canvas.toDataURL('image/png');
                    setImageUrl(pngUrl);
                    setIsLoading(false);
                };
                img.onerror = () => { setError(t('share.error')); setIsLoading(false); };
                img.src = svgDataUrl;
            } catch (e) {
                setError(t('share.error')); setIsLoading(false);
            }
        };
        setTimeout(generate, 100);
    }, [themeColors, t]);

    const handleShare = async () => {
        if (!imageUrl) return;
        const file = dataURLtoFile(imageUrl, `game-summary-${Date.now()}.png`);
        if (file && navigator.share) {
            try {
                await navigator.share({
                    title: t('postGame.title'),
                    text: `${t(summary.gameInfo.type as any)} - ${t('postGame.title')}`,
                    files: [file],
                });
            } catch (error) {
                console.error('Sharing failed', error);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[--color-surface] rounded-2xl shadow-2xl p-6 w-full max-w-2xl text-center" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-[--color-accent] mb-4">{t('share.title')}</h2>
                <div className="w-full aspect-[1.9/1] bg-black/20 rounded-lg flex items-center justify-center my-4">
                    {isLoading && <p>{t('share.generating')}</p>}
                    {error && <p className="text-red-500">{error}</p>}
                    {imageUrl && <img src={imageUrl} alt="Game summary preview" className="max-w-full max-h-full rounded-lg" />}
                </div>
                <div className="flex gap-4">
                    <button onClick={onClose} className="w-full bg-[--color-surface-light] hover:bg-[--color-border] font-bold py-3 rounded-lg">{t('common.close')}</button>
                    <button onClick={handleShare} disabled={!imageUrl} className="w-full bg-[--color-green] hover:bg-[--color-green-hover] text-white font-bold py-3 rounded-lg disabled:opacity-50">{t('share.action')}</button>
                </div>
            </div>
            <div className="absolute -left-full -top-full opacity-0">
                {themeColors && <ShareImageSVGGame ref={svgRef} summary={summary} players={players} themeColors={themeColors} />}
            </div>
        </div>
    );
};

const PostGameSummary: React.FC<{
    summary: GameSummary;
    players: Player[];
    onNewGame: () => void;
    onRematch: () => void;
}> = ({ summary, players, onNewGame, onRematch }) => {
    const { t } = useTranslation();
    const { gameInfo, finalScores, winnerIds, turnsPerPlayer, gameHistory } = summary;
    const [showChart, setShowChart] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    const getPlayerById = (id: string) => players.find(p => p.id === id);

    const PLAYER_COLORS = ['#2dd4bf', '#facc15', '#fb923c', '#a78bfa'];

    const ScoreProgressionChart: React.FC<{ gameHistory: GameSummary['gameHistory']; playerIds: string[]; players: Player[]; targetScore: number; }> = ({ gameHistory, playerIds, players, targetScore }) => {
        const chartData = useMemo(() => {
            if (!gameHistory || gameHistory.length < 1) return [];
            return playerIds.map((playerId, index) => {
                const playerInfo = players.find(p => p.id === playerId);
                return {
                    playerId,
                    name: playerInfo?.name || 'Unknown',
                    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
                    data: gameHistory.map((state, turnIndex) => ({
                        turn: turnIndex,
                        score: state.scores[playerId] || 0,
                    })),
                };
            });
        }, [gameHistory, playerIds, players]);
        if (chartData.length === 0 || gameHistory.length < 2) return null;
        const width = 500, height = 250, padding = { top: 20, right: 20, bottom: 60, left: 40 };
        const maxTurn = gameHistory.length - 1;
        const maxScore = Math.max(targetScore, ...gameHistory.flatMap(s => Object.values(s.scores)));
        const getX = (turn: number) => padding.left + (turn / maxTurn) * (width - padding.left - padding.right);
        const getY = (score: number) => height - padding.bottom - (maxScore > 0 ? (score / maxScore) * (height - padding.top - padding.bottom) : 0);
        const pathData = (seriesData: { turn: number, score: number }[]) => seriesData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.turn)} ${getY(d.score)}`).join(' ');
        return (
            <div className="bg-black/20 rounded-lg p-4 w-full mt-6">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-label="Score Progression Chart">
                    {[0, 0.25, 0.5, 0.75, 1].map(tick => (<g key={tick}><line x1={padding.left} y1={getY(maxScore * tick)} x2={width - padding.right} y2={getY(maxScore * tick)} className="stroke-[--color-border]" strokeWidth="0.5" strokeDasharray="2" /><text x={padding.left - 8} y={getY(maxScore * tick)} dy="0.3em" textAnchor="end" className="text-xs fill-[--color-text-secondary] font-mono">{Math.round(maxScore * tick)}</text></g>))}
                    <line x1={padding.left} y1={getY(targetScore)} x2={width - padding.right} y2={getY(targetScore)} className="stroke-[--color-red]/50" strokeWidth="1" strokeDasharray="4"/>
                    <text x={padding.left} y={height - padding.bottom + 15} textAnchor="start" className="text-xs fill-[--color-text-secondary] font-mono">Turn 0</text><text x={width - padding.right} y={height - padding.bottom + 15} textAnchor="end" className="text-xs fill-[--color-text-secondary] font-mono">Turn {maxTurn}</text>
                    {chartData.map(series => (<path key={series.playerId} d={pathData(series.data)} fill="none" stroke={series.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />))}
                    <g>{chartData.map((series, index) => { const legendItemWidth = (width - padding.left - padding.right) / chartData.length; const xPos = padding.left + index * legendItemWidth; const yPos = height - padding.bottom + 35; return (<g key={series.playerId} transform={`translate(${xPos}, ${yPos})`}><rect y="-5" width="12" height="12" fill={series.color} rx="3" /><text x="18" className="text-xs fill-[--color-text-secondary] truncate" width={legendItemWidth - 20}>{series.name}</text></g>)})}</g>
                </svg>
            </div>
        );
    };

    const StatItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (<div className="flex justify-between text-sm"><span className="text-[--color-text-secondary]">{label}</span><span className="font-mono font-bold text-[--color-text-primary]">{value}</span></div>);

    const isTeamGame = gameInfo.mode === 'team';
    const team1Ids = isTeamGame ? gameInfo.playerIds.filter((_, i) => i % 2 === 0) : [];
    const team2Ids = isTeamGame ? gameInfo.playerIds.filter((_, i) => i % 2 !== 0) : [];
    const team1Score = team1Ids.reduce((sum, id) => sum + (finalScores[id] || 0), 0);
    const team2Score = team2Ids.reduce((sum, id) => sum + (finalScores[id] || 0), 0);
    
    const team1IsWinner = isTeamGame && team1Score > team2Score;
    const team2IsWinner = isTeamGame && team2Score > team1Score;

    const PlayerResultCard: React.FC<{ playerId: string; isWinner: boolean }> = ({ playerId, isWinner }) => {
        const player = getPlayerById(playerId);
        if (!player) return null;
        const handicap = gameInfo.handicap?.playerId === playerId ? gameInfo.handicap.points : 0;
        const turns = turnsPerPlayer[playerId] || 0;
        const average = turns > 0 ? ((finalScores[playerId] - handicap) / turns).toFixed(2) : '0.00';
        
        return (
            <div className={`p-4 rounded-lg transition-all duration-300 flex items-center gap-4 relative ${isWinner && !isTeamGame ? 'bg-[--color-green]/20 border-2 border-[--color-green]' : isTeamGame ? 'bg-[--color-surface]' : 'bg-black/20'}`}>
                {isWinner && !isTeamGame && (<div className="absolute -top-3 -right-3 bg-[--color-green] text-black text-xs font-bold px-2 py-1 rounded-full uppercase">{t('postGame.winner')}</div>)}
                <Avatar avatar={player.avatar} className="w-16 h-16 flex-shrink-0" />
                <div className="flex-grow">
                    <div className="flex items-center gap-3"><p className="text-2xl font-bold text-[--color-text-primary]">{player.name}</p>{handicap > 0 && (<span className="text-xs font-semibold bg-[--color-yellow]/20 text-[--color-yellow] px-2 py-0.5 rounded">{t('postGame.handicapApplied', { points: handicap })}</span>)}</div>
                    <div className="grid grid-cols-2 gap-x-6 mt-2 max-w-xs">
                        <StatItem label={t('postGame.average')} value={average} />
                        <StatItem label={t('stats.history.turns')} value={turns} />
                    </div>
                </div>
                <div className="flex-shrink-0"><p className="text-5xl font-mono font-extrabold text-[--color-accent]">{finalScores[playerId]}</p></div>
            </div>
        );
    };

    return (
        <>
            {isShareModalOpen && <ShareModal summary={summary} players={players} onClose={() => setIsShareModalOpen(false)} />}
            <div className="w-full max-w-2xl bg-[--color-surface] rounded-2xl shadow-2xl p-8 transform transition-all duration-300">
                <h1 className="text-4xl font-extrabold mb-6 text-center text-[--color-accent]">{t('postGame.title')}</h1>
                <h2 className="text-xl font-semibold mb-8 text-center text-[--color-text-secondary]">{t(gameInfo.type as any)}</h2>
                
                {isTeamGame ? (
                    <div className="space-y-4">
                        <div className={`p-4 rounded-lg transition-all duration-300 relative ${team1IsWinner ? 'bg-[--color-green]/20 border-2 border-[--color-green]' : 'bg-black/20'}`}>
                            <div className="flex justify-between items-baseline mb-3"> <h3 className="text-2xl font-bold text-[--color-text-primary]">{t('gameSetup.team1')}</h3> <p className="text-5xl font-mono font-extrabold text-[--color-accent]">{team1Score}</p></div>
                            <div className="space-y-2">{team1Ids.map(pid => <PlayerResultCard key={pid} playerId={pid} isWinner={winnerIds.includes(pid)} />)}</div>
                            {team1IsWinner && <div className="absolute -top-3 -right-3 bg-[--color-green] text-black text-xs font-bold px-2 py-1 rounded-full uppercase">{t('postGame.winner')}</div>}
                        </div>
                        <div className={`p-4 rounded-lg transition-all duration-300 relative ${team2IsWinner ? 'bg-[--color-green]/20 border-2 border-[--color-green]' : 'bg-black/20'}`}>
                            <div className="flex justify-between items-baseline mb-3"> <h3 className="text-2xl font-bold text-[--color-text-primary]">{t('gameSetup.team2')}</h3> <p className="text-5xl font-mono font-extrabold text-[--color-accent]">{team2Score}</p></div>
                            <div className="space-y-2">{team2Ids.map(pid => <PlayerResultCard key={pid} playerId={pid} isWinner={winnerIds.includes(pid)} />)}</div>
                            {team2IsWinner && <div className="absolute -top-3 -right-3 bg-[--color-green] text-black text-xs font-bold px-2 py-1 rounded-full uppercase">{t('postGame.winner')}</div>}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {gameInfo.playerIds.map(playerId => (
                            <PlayerResultCard key={playerId} playerId={playerId} isWinner={winnerIds.includes(playerId)} />
                        ))}
                    </div>
                )}
                
                <div className="mt-6 text-center"><button onClick={() => setShowChart(!showChart)} className="text-[--color-accent] hover:opacity-80 font-semibold py-2 px-4 rounded-lg bg-[--color-surface-light] hover:bg-[--color-bg] transition-colors">{showChart ? t('postGame.hideChart') : t('postGame.showChart')}</button></div>
                {showChart && <ScoreProgressionChart gameHistory={gameHistory} playerIds={gameInfo.playerIds} players={players} targetScore={gameInfo.targetScore} />}
                <div className="flex flex-col md:flex-row gap-4 mt-8">
                    <button onClick={onRematch} className="w-full bg-[--color-primary] hover:bg-[--color-primary-hover] text-white font-bold py-3 rounded-lg text-lg shadow-md transition-all duration-200 hover:scale-105">{t('postGame.rematch')}</button>
                    <button onClick={onNewGame} className="w-full bg-[--color-primary]/80 hover:bg-[--color-primary] text-white font-bold py-3 rounded-lg text-lg shadow-md transition-all duration-200 hover:scale-105">{t('postGame.newGame')}</button>
                </div>
                 <div className="mt-4">
                    <button onClick={() => setIsShareModalOpen(true)} className="w-full bg-transparent border-2 border-[--color-accent] text-[--color-accent] hover:bg-[--color-accent]/20 font-bold py-3 rounded-lg text-lg shadow-md transition-colors">{t('share.buttonText')}</button>
                </div>
            </div>
        </>
    );
};

export default PostGameSummary;
