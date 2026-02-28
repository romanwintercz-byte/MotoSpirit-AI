
import React, { useState, useMemo, useCallback, useEffect, useRef, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Tournament, Player, GameRecord, TournamentSettings, Match, TournamentFormat } from '../types';
import { AppDataHook } from '../hooks';
import { dataURLtoFile } from '../utils';
import Avatar from './Avatar';
import { GAME_TYPE_DEFAULTS_SETUP, FALLBACK_AVATAR_PATH } from '../constants';

const getPlayerAverage = (playerId: string, gameTypeKey: string, gameLog: GameRecord[]): number => {
    const playerGames = gameLog.filter(g => g.playerId === playerId && g.gameType === gameTypeKey);
    if (playerGames.length === 0) return 0;
    const totalScore = playerGames.reduce((sum, game) => sum + game.score, 0);
    const totalTurns = playerGames.reduce((sum, game) => sum + game.turns, 0);
    return totalTurns > 0 ? totalScore / totalTurns : 0;
};

const PlayerListItem: React.FC<{
    player: Player;
    onClick: () => void;
    average?: number;
}> = ({ player, onClick, average }) => (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors bg-[--color-surface-light] hover:bg-[--color-primary]">
        <Avatar avatar={player.avatar} className="w-10 h-10 flex-shrink-0" />
        <div className="flex-grow min-w-0">
            <span className="font-semibold truncate">{player.name}</span>
            {average !== undefined && (
                 <p className="text-xs text-[--color-text-secondary] font-mono">Avg: {average.toFixed(2)}</p>
            )}
        </div>
    </button>
);

const TournamentList: React.FC<{ 
    tournaments: Tournament[]; 
    onSelectTournament: (t: Tournament) => void; 
    onCreateNew: () => void; 
    appData: AppDataHook;
}> = ({ tournaments, onSelectTournament, onCreateNew }) => {
    const { t } = useTranslation();
    const ongoing = tournaments.filter(t => t.status === 'ongoing');
    const completed = tournaments.filter(t => t.status === 'completed');

    const Item: React.FC<{ tournament: Tournament }> = ({ tournament }) => (
        <button onClick={() => onSelectTournament(tournament)} className="w-full text-left bg-[--color-surface] hover:bg-[--color-surface-light] p-4 rounded-lg shadow-md transition-colors">
            <div className="flex justify-between items-center">
                <div><p className="font-bold text-xl text-[--color-text-primary]">{tournament.name}</p><p className="text-sm text-[--color-text-secondary]">{t(`tournament.format.${tournament.format}`)} · {tournament.playerIds.length} hráči · {new Date(tournament.createdAt).toLocaleDateString()}</p></div>
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${tournament.status === 'ongoing' ? 'bg-[--color-green]/20 text-[--color-green]' : 'bg-[--color-surface-light]/50 text-[--color-text-secondary]'}`}>{t(`tournament.${tournament.status}`)}</span>
            </div>
        </button>
    );

    return (
        <div className="w-full max-w-4xl p-4">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-extrabold text-[--color-text-primary]">{t('tournament.title')}</h1>
                <button onClick={onCreateNew} className="bg-[--color-green] hover:bg-[--color-green-hover] text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-md">{t('tournament.create')}</button>
            </div>
            {tournaments.length === 0 ? <p className="text-center text-[--color-text-secondary] mt-16">{t('tournament.noTournaments')}</p> : <div className="space-y-8">{ongoing.length > 0 && <div><h2 className="text-2xl font-bold text-[--color-accent] mb-4">{t('tournament.ongoing')}</h2><div className="space-y-3">{ongoing.map(t => <Item key={t.id} tournament={t} />)}</div></div>}{completed.length > 0 && <div><h2 className="text-2xl font-bold text-[--color-accent] mb-4">{t('tournament.completed')}</h2><div className="space-y-3">{completed.map(t => <Item key={t.id} tournament={t} />)}</div></div>}</div>}
        </div>
    );
};

const TournamentSetup: React.FC<{ players: Player[]; gameLog: GameRecord[]; onSubmit: (name: string, pIds: string[], s: TournamentSettings) => void; onCancel: () => void; }> = ({ players, gameLog, onSubmit, onCancel }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [format, setFormat] = useState<TournamentFormat>('round-robin');
    const [seeding, setSeeding] = useState<'random' | 'average'>('random');
    const [gameTypeKey, setGameTypeKey] = useState<string>('gameSetup.threeCushion');
    const [targetScore, setTargetScore] = useState<number>(GAME_TYPE_DEFAULTS_SETUP['gameSetup.threeCushion']);
    const [numGroups, setNumGroups] = useState(2);
    const [playersAdvancing, setPlayersAdvancing] = useState(1);

    const maxPlayers = useMemo(() => format === 'round-robin' ? 8 : 32, [format]);
    const minPlayers = useMemo(() => format === 'combined' ? 4 : 3, [format]);
    const getPlayersWithAverage = useCallback((list: Player[]) => list.map(p => ({ ...p, average: getPlayerAverage(p.id, gameTypeKey, gameLog) })), [gameTypeKey, gameLog]);
    const availablePlayers = useMemo(() => getPlayersWithAverage(players.filter(p => !selectedPlayerIds.includes(p.id))), [players, selectedPlayerIds, getPlayersWithAverage]);
    const selectedPlayers = useMemo(() => getPlayersWithAverage(selectedPlayerIds.map(id => players.find(p => p.id === id)).filter((p): p is Player => !!p)), [selectedPlayerIds, players, getPlayersWithAverage]);

    const handlePlayerToggle = (pId: string) => setSelectedPlayerIds(prev => prev.includes(pId) ? prev.filter(id => id !== pId) : (prev.length < maxPlayers ? [...prev, pId] : prev));
    const handleGameTypeChange = (key: string) => { setGameTypeKey(key); setTargetScore(GAME_TYPE_DEFAULTS_SETUP[key] || 50); };
    const handleSubmit = () => { if (name.trim() && selectedPlayerIds.length >= minPlayers && selectedPlayerIds.length <= maxPlayers) { const s: TournamentSettings = { format, gameTypeKey, targetScore, endCondition: 'equal-innings' }; if (format !== 'round-robin') s.seeding = seeding; if (format === 'combined') { s.numGroups = numGroups; s.playersAdvancing = playersAdvancing; } onSubmit(name.trim(), selectedPlayerIds, s); } };
    
    const isSubmitDisabled = name.trim().length === 0 || selectedPlayerIds.length < minPlayers || selectedPlayerIds.length > maxPlayers;
    const buttonClasses = (isActive: boolean) => `w-full text-center p-3 rounded-lg text-sm font-semibold transition-all duration-200 border-2 ${isActive ? 'bg-[--color-primary] border-[--color-accent] text-white shadow-lg' : 'bg-[--color-surface-light] border-[--color-border] hover:bg-[--color-bg] hover:border-[--color-border-hover]'}`;

    const groupOptions = useMemo(() => { const num = selectedPlayerIds.length; if (num < 4) return []; return [2, 4, 8].filter(opt => num >= opt * 2); }, [selectedPlayerIds.length]);
    const advancingOptions = useMemo(() => { const per = selectedPlayerIds.length / numGroups; return [1, 2, 4].filter(opt => opt < per); }, [selectedPlayerIds.length, numGroups]);

    useEffect(() => { if (groupOptions.length > 0 && !groupOptions.includes(numGroups)) setNumGroups(groupOptions[0]); }, [groupOptions, numGroups]);
    useEffect(() => { if (advancingOptions.length > 0 && !advancingOptions.includes(playersAdvancing)) setPlayersAdvancing(advancingOptions[0]); }, [advancingOptions, playersAdvancing]);

    return (
        <div className="w-full max-w-4xl bg-[--color-surface] rounded-2xl shadow-2xl p-8 transform transition-all duration-300">
            <h1 className="text-4xl font-extrabold mb-8 text-center text-[--color-text-primary]">{t('tournament.setupTitle')}</h1>
            <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div><label className="text-xl font-bold text-[--color-accent] mb-2 block">{t('tournament.name')}</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('tournament.namePlaceholder') as string} className="w-full bg-[--color-surface-light] text-[--color-text-primary] text-lg rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[--color-accent]"/></div>
                    <div><h3 className="text-xl font-bold text-[--color-accent] mb-4">{t('tournament.format')}</h3><div className="grid grid-cols-3 gap-2"><button onClick={() => setFormat('round-robin')} className={buttonClasses(format === 'round-robin')}>{t('tournament.format.roundRobin')}</button><button onClick={() => setFormat('knockout')} className={buttonClasses(format === 'knockout')}>{t('tournament.format.knockout')}</button><button onClick={() => setFormat('combined')} className={buttonClasses(format === 'combined')}>{t('tournament.format.combined')}</button></div></div>
                    {format !== 'round-robin' && (<div><h3 className="text-xl font-bold text-[--color-accent] mb-4">{t('tournament.seeding')}</h3><div className="grid grid-cols-2 gap-4"><button onClick={() => setSeeding('random')} className={buttonClasses(seeding === 'random')}>{t('tournament.seeding.random')}</button><button onClick={() => setSeeding('average')} className={buttonClasses(seeding === 'average')}>{t('tournament.seeding.average')}</button></div></div>)}
                    {format === 'combined' && (<div className="grid grid-cols-2 gap-4"><div><h3 className="text-lg font-bold text-[--color-accent] mb-2">{t('tournament.numGroups')}</h3><select value={numGroups} onChange={e => setNumGroups(Number(e.target.value))} className="w-full h-[44px] bg-[--color-surface-light] text-[--color-text-primary] text-center font-semibold rounded-lg px-2">{groupOptions.map(o => <option key={o} value={o}>{o}</option>)}</select></div><div><h3 className="text-lg font-bold text-[--color-accent] mb-2">{t('tournament.playersAdvancing')}</h3><select value={playersAdvancing} onChange={e => setPlayersAdvancing(Number(e.target.value))} className="w-full h-[44px] bg-[--color-surface-light] text-[--color-text-primary] text-center font-semibold rounded-lg px-2">{advancingOptions.map(o => <option key={o} value={o}>{o}</option>)}</select></div></div>)}
                    <div><h3 className="text-xl font-bold text-[--color-accent] mb-4">{t('gameSetup.selectType')}</h3><div className="grid grid-cols-2 gap-3">{Object.keys(GAME_TYPE_DEFAULTS_SETUP).map(key => (<button key={key} onClick={() => handleGameTypeChange(key)} className={buttonClasses(gameTypeKey === key)}>{t(key as any)}</button>))}</div></div>
                    <div><h3 className="text-xl font-bold text-[--color-accent] mb-4">{t('gameSetup.targetScore')}</h3><input type="number" value={targetScore} onChange={(e) => setTargetScore(Number(e.target.value))} className="w-full bg-[--color-surface-light] text-[--color-text-primary] text-center text-2xl font-bold rounded-lg px-4 py-2"/></div>
                </div>
                <div><h3 className="text-xl font-bold text-[--color-accent] mb-4">{t('tournament.selectPlayers')} ({selectedPlayerIds.length} / {maxPlayers})</h3><div className="grid grid-cols-2 gap-4"><div><h4 className="font-semibold text-[--color-text-secondary] mb-2">{t('gameSetup.availablePlayers')}</h4><div className="bg-black/20 p-2 rounded-lg h-96 overflow-y-auto space-y-2">{availablePlayers.map(p => <PlayerListItem key={p.id} player={p} average={p.average} onClick={() => handlePlayerToggle(p.id)} />)}</div></div><div><h4 className="font-semibold text-[--color-text-secondary] mb-2">{t('gameSetup.playersInGame')}</h4><div className="bg-black/20 p-2 rounded-lg h-96 overflow-y-auto space-y-2">{selectedPlayers.map(p => <PlayerListItem key={p.id} player={p} average={p.average} onClick={() => handlePlayerToggle(p.id)} />)}</div></div></div></div>
            </div>
            <div className="mt-8 flex gap-4"><button onClick={onCancel} className="w-full bg-[--color-surface-light] text-[--color-text-primary] font-bold py-3 rounded-lg">{t('cancel')}</button><button onClick={handleSubmit} disabled={isSubmitDisabled} className="w-full bg-[--color-green] text-white font-bold py-3 rounded-lg shadow-md disabled:opacity-50">{t('tournament.create')}</button></div>
        </div>
    );
};

type ThemeColors = { bg: string; surfaceLight: string; primary: string; accent: string; textPrimary: string; textSecondary: string; green: string; };

const ShareImageSVGTournament = forwardRef<SVGSVGElement, { tournament: Tournament, players: Player[], themeColors: ThemeColors }>(({ tournament, players, themeColors }, ref) => {
    const { t } = useTranslation();
    const playersMap = new Map<string, Player>(players.map(p => [p.id, p]));
    const width = 1200;
    const height = 630;

    const leaderboardData = useMemo(() => {
        const stats: Record<string, { playerId: string; played: number; wins: number; draws: number; losses: number; points: number; }> = {};
        tournament.playerIds.forEach(id => { stats[id] = { playerId: id, played: 0, wins: 0, draws: 0, losses: 0, points: 0 }; });
        const matches = tournament.format === 'round-robin' ? tournament.matches : tournament.matches.filter(m => !!m.groupId);
        matches.forEach(match => { if (match.status === 'completed' && match.result && match.player1Id && match.player2Id) { const { player1Id, player2Id, result } = match; if (stats[player1Id] && stats[player2Id]) { stats[player1Id].played++; stats[player2Id].played++; if (result.winnerId === null) { stats[player1Id].draws++; stats[player2Id].draws++; stats[player1Id].points++; stats[player2Id].points++; } else if (result.winnerId === player1Id) { stats[player1Id].wins++; stats[player2Id].losses++; stats[player1Id].points += 3; } else { stats[player2Id].wins++; stats[player1Id].losses++; stats[player2Id].points += 3; } } } });
        return Object.values(stats).sort((a, b) => b.points - a.points || (b.wins - a.wins)).slice(0, 7);
    }, [tournament]);

    return (
        <svg ref={ref} width={width} height={height} viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink">
            <defs><clipPath id="avatarClip"><circle cx="20" cy="20" r="20" /></clipPath></defs>
            <rect width="100%" height="100%" fill={themeColors.bg} />
            <text x={width / 2} y="70" textAnchor="middle" fill={themeColors.accent} fontSize="52" fontWeight="bold">{tournament.name}</text>
            <text x={width / 2} y="120" textAnchor="middle" fill={themeColors.textSecondary} fontSize="28">{t('tournament.leaderboard')}</text>
            <g transform="translate(60, 160)">
                <rect width={width - 120} height={50} y="0" fill={themeColors.surfaceLight} rx="10" />
                <text x="120" y="32" fill={themeColors.accent} fontSize="20" fontWeight="bold">{t('stats.player')}</text>
                <text x="700" y="32" fill={themeColors.accent} fontSize="20" fontWeight="bold" textAnchor="middle">{t('tournament.played')}</text>
                <text x="850" y="32" fill={themeColors.accent} fontSize="20" fontWeight="bold" textAnchor="middle">{t('tournament.wins')}</text>
                <text x="1000" y="32" fill={themeColors.accent} fontSize="20" fontWeight="bold" textAnchor="middle">{t('tournament.points')}</text>
                {leaderboardData.map((row, index) => {
                    const player = playersMap.get(row.playerId);
                    if (!player) return null;
                    const y = 65 + index * 55;
                    const avatar = player.avatar || FALLBACK_AVATAR_PATH;
                    return (
                        <g key={row.playerId}>
                            <text x="25" y={y+28} fill={themeColors.textSecondary} fontSize="24" fontWeight="bold" textAnchor="middle">{index+1}</text>
                             {avatar.startsWith('data:image') ? ( <image href={avatar} x="60" y={y+5} height="40" width="40" clipPath="url(#avatarClip)" />) : ( <g transform={`translate(60, ${y+5})`}><circle cx="20" cy="20" r="20" fill={themeColors.primary} /><path d={avatar} fill="#fff" transform="translate(4, 4) scale(1.6)" /></g> )}
                            <text x="120" y={y+28} fill={themeColors.textPrimary} fontSize="24" fontWeight="bold">{player.name}</text>
                            <text x="700" y={y+28} fill={themeColors.textPrimary} fontSize="24" fontWeight="bold" textAnchor="middle">{row.played}</text>
                            <text x="850" y={y+28} fill={themeColors.green} fontSize="24" fontWeight="bold" textAnchor="middle">{row.wins}</text>
                            <text x="1000" y={y+28} fill={themeColors.accent} fontSize="24" fontWeight="bold" textAnchor="middle">{row.points}</text>
                        </g>
                    );
                })}
            </g>
            <text x={width - 40} y={height - 30} textAnchor="end" fill={themeColors.textSecondary} opacity="0.7" fontSize="20">{t('share.generatedBy')}</text>
        </svg>
    );
});

const ShareModal = ({ tournament, players, onClose }: { tournament: Tournament, players: Player[], onClose: () => void }) => {
    const { t } = useTranslation();
    const svgRef = useRef<SVGSVGElement>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [themeColors, setThemeColors] = useState<ThemeColors | null>(null);

    useEffect(() => { const root = getComputedStyle(document.documentElement); setThemeColors({ bg: root.getPropertyValue('--color-bg').trim(), surfaceLight: root.getPropertyValue('--color-surface-light').trim(), primary: root.getPropertyValue('--color-primary').trim(), accent: root.getPropertyValue('--color-accent').trim(), textPrimary: root.getPropertyValue('--color-text-primary').trim(), textSecondary: root.getPropertyValue('--color-text-secondary').trim(), green: root.getPropertyValue('--color-green').trim() }); }, []);
    useEffect(() => { if (!svgRef.current || !themeColors) return; const generate = async () => { try { const svgNode = svgRef.current!; const svgString = new XMLSerializer().serializeToString(svgNode); const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString); const img = new Image(); const canvas = document.createElement('canvas'); canvas.width = svgNode.width.baseVal.value; canvas.height = svgNode.height.baseVal.value; const ctx = canvas.getContext('2d'); img.onload = () => { ctx?.drawImage(img, 0, 0); setImageUrl(canvas.toDataURL('image/png')); setIsLoading(false); }; img.src = svgDataUrl; } catch (e) { setIsLoading(false); } }; setTimeout(generate, 100); }, [themeColors]);

    const handleShare = async () => { if (imageUrl && navigator.share) { const file = dataURLtoFile(imageUrl, `tournament.png`); if (file) await navigator.share({ title: tournament.name, files: [file] }); } };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[--color-surface] rounded-2xl shadow-2xl p-6 w-full max-w-2xl text-center" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-[--color-accent] mb-4">{t('share.title')}</h2>
                <div className="w-full aspect-[1.9/1] bg-black/20 rounded-lg flex items-center justify-center my-4">{isLoading ? <p>{t('share.generating')}</p> : imageUrl && <img src={imageUrl} alt="Preview" className="max-w-full max-h-full rounded-lg" />}</div>
                <div className="flex gap-4"><button onClick={onClose} className="w-full bg-[--color-surface-light] font-bold py-3 rounded-lg">{t('common.close')}</button><button onClick={handleShare} disabled={!imageUrl} className="w-full bg-[--color-green] text-white font-bold py-3 rounded-lg">{t('share.action')}</button></div>
            </div>
            <div className="absolute -left-full -top-full opacity-0">{themeColors && <ShareImageSVGTournament ref={svgRef} tournament={tournament} players={players} themeColors={themeColors} />}</div>
        </div>
    );
};

const TournamentDashboard: React.FC<{ tournament: Tournament; players: Player[]; onExit: () => void; onStartMatch: (tournament: Tournament, match: Match) => void; onDelete: (id: string) => void; }> = ({ tournament, players, onExit, onStartMatch, onDelete }) => {
    const { t, i18n } = useTranslation();
    const playersMap = useMemo(() => new Map<string, Player>(players.map(p => [p.id, p])), [players]);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    const handleCancelTournament = () => { if (prompt(t('tournament.cancelConfirmBody') as string) === (i18n.language === 'cs' ? 'SMAZAT' : 'DELETE')) onDelete(tournament.id); };

    const MatchCard: React.FC<{ match: Match }> = ({ match }) => {
        const p1 = playersMap.get(match.player1Id!); const p2 = playersMap.get(match.player2Id!); if (!p1 || !p2) return null;
        return (
            <div className="bg-black/20 p-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-lg"><div className="flex items-center gap-2 w-32 justify-end"><span className="truncate text-right">{p1.name}</span><Avatar avatar={p1.avatar} className="w-8 h-8"/></div><span className="text-[--color-text-secondary] mx-2">vs</span><div className="flex items-center gap-2 w-32"><Avatar avatar={p2.avatar} className="w-8 h-8"/><span className="truncate">{p2.name}</span></div></div>
                {match.status === 'pending' ? (<button onClick={() => onStartMatch(tournament, match)} className="bg-[--color-green] text-white font-bold py-2 px-4 rounded-lg text-sm">{t('tournament.playMatch')}</button>) : (<div className="text-center font-mono font-bold text-xl"><span>{match.result?.player1Score}</span><span className="mx-2 opacity-50">-</span><span>{match.result?.player2Score}</span></div>)}
            </div>
        );
    };

    const RoundRobinView = () => {
        const leaderboard = useMemo(() => {
            const stats: Record<string, any> = {}; tournament.playerIds.forEach(id => { stats[id] = { playerId: id, played: 0, wins: 0, draws: 0, losses: 0, points: 0 }; });
            const matches = tournament.format === 'round-robin' ? tournament.matches : tournament.matches.filter(m => !!m.groupId);
            matches.forEach(m => { if (m.status === 'completed' && m.result && m.player1Id && m.player2Id) { const { player1Id, player2Id, result } = m; stats[player1Id].played++; stats[player2Id].played++; if (result.winnerId === null) { stats[player1Id].draws++; stats[player2Id].draws++; stats[player1Id].points++; stats[player2Id].points++; } else if (result.winnerId === player1Id) { stats[player1Id].wins++; stats[player2Id].losses++; stats[player1Id].points += 3; } else { stats[player2Id].wins++; stats[player1Id].losses++; stats[player2Id].points += 3; } } });
            return Object.values(stats).sort((a: any, b: any) => b.points - a.points || (b.wins - a.wins));
        }, [tournament]);
        return (
            <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-1 bg-[--color-surface] rounded-lg p-4 shadow-lg"><h2 className="text-2xl font-bold text-[--color-accent] mb-4">{t('tournament.leaderboard')}</h2><table className="w-full text-left text-sm"><thead><tr className="border-b border-[--color-border]"><th className="p-2">#</th><th className="p-2">{t('stats.player')}</th><th className="p-2 text-center">{t('tournament.points')}</th></tr></thead><tbody>{leaderboard.map((row: any, idx: number) => { const p = playersMap.get(row.playerId); return p ? (<tr key={p.id} className="border-b border-[--color-border]/50"><td className="p-2 font-bold">{idx+1}</td><td className="p-2 flex items-center gap-2"><Avatar avatar={p.avatar} className="w-6 h-6" />{p.name}</td><td className="p-2 text-center font-bold text-[--color-accent]">{row.points}</td></tr>) : null; })}</tbody></table></div>
                <div className="md:col-span-2 bg-[--color-surface] rounded-lg p-4 shadow-lg"><h2 className="text-2xl font-bold text-[--color-accent] mb-4">{t('tournament.matches')}</h2><div className="space-y-3 max-h-[60vh] overflow-y-auto">{tournament.matches.filter(m => tournament.format === 'round-robin' || m.groupId).map(m => <MatchCard key={m.id} match={m} />)}</div></div>
            </div>
        );
    };

    const KnockoutView = ({ matches }: { matches: Match[] }) => {
        const rounds = useMemo(() => { const g: Match[][] = []; matches.forEach(m => { const idx = (m.round || 1) - 1; if (!g[idx]) g[idx] = []; g[idx].push(m); }); return g; }, [matches]);
        return (
            <div className="bg-[--color-surface] rounded-lg p-4 shadow-lg overflow-x-auto"><div className="flex gap-4">{rounds.map((r, i) => (<div key={i} className="flex flex-col gap-4 min-w-[280px]"><h3 className="text-xl font-bold text-center text-[--color-accent]">Round {i+1}</h3><div className="space-y-3">{r.map(m => { const p1 = m.player1Id ? playersMap.get(m.player1Id) : null; const p2 = m.player2Id ? playersMap.get(m.player2Id) : null; return (<div key={m.id} className="bg-black/20 p-3 rounded-lg"><div className={`flex justify-between ${m.result?.winnerId === p1?.id ? 'font-bold' : 'opacity-60'}`}><span>{p1?.name || '...'}</span><span>{m.status === 'completed' ? m.result?.player1Score : '-'}</span></div><div className={`flex justify-between ${m.result?.winnerId === p2?.id ? 'font-bold' : 'opacity-60'}`}><span>{p2?.name || '...'}</span><span>{m.status === 'completed' ? m.result?.player2Score : '-'}</span></div>{p1 && p2 && m.status === 'pending' && <button onClick={() => onStartMatch(tournament, m)} className="w-full mt-2 bg-[--color-green] text-white text-xs font-bold py-1 rounded">Hrát</button>}</div>); })}</div></div>))}</div></div>
        );
    };

    return (
        <>
            {isShareModalOpen && <ShareModal tournament={tournament} players={players} onClose={() => setIsShareModalOpen(false)} />}
            <div className="w-full max-w-6xl p-4">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={onExit} className="text-[--color-text-secondary] font-bold">← Zpět</button>
                    <h1 className="text-3xl font-extrabold text-[--color-text-primary]">{tournament.name}</h1>
                    <div className="flex gap-2">
                        <button onClick={() => setIsShareModalOpen(true)} className="bg-[--color-primary] text-white font-bold py-2 px-4 rounded-lg text-sm">{t('share.buttonTextTournament')}</button>
                        <button onClick={handleCancelTournament} className="bg-[--color-red] text-white font-bold py-2 px-4 rounded-lg text-sm">{t('tournament.cancelTournament')}</button>
                    </div>
                </div>
                {tournament.format === 'round-robin' ? <RoundRobinView /> : tournament.format === 'knockout' ? <KnockoutView matches={tournament.matches} /> : (<div className="space-y-8"><div><h2 className="text-2xl font-bold text-[--color-accent] mb-4">Skupinová fáze</h2><RoundRobinView /></div>{(tournament.stage === 'knockout' || tournament.matches.some(m => !m.groupId)) && (<div><h2 className="text-2xl font-bold text-[--color-accent] mb-4">Vyřazovací fáze</h2><KnockoutView matches={tournament.matches.filter(m => !m.groupId)} /></div>)}</div>)}
            </div>
        </>
    );
};

export const TournamentView: React.FC<{
    tournaments: Tournament[];
    players: Player[];
    gameLog: GameRecord[];
    onCreateTournament: (name: string, playerIds: string[], settings: TournamentSettings) => void;
    onStartMatch: (tournament: Tournament, match: Match) => void;
    onDeleteTournament: (id: string) => void;
    appData: AppDataHook;
}> = ({ tournaments, players, gameLog, onCreateTournament, onStartMatch, onDeleteTournament, appData }) => {
    const [view, setView] = useState<'list' | 'setup' | 'dashboard'>('list');
    const [active, setActive] = useState<Tournament | null>(null);
    useEffect(() => { if (active) { const u = tournaments.find(t => t.id === active.id); if (u) setActive(u); } }, [tournaments]);

    switch (view) {
        case 'setup': return <TournamentSetup players={players} gameLog={gameLog} onSubmit={(n, p, s) => { onCreateTournament(n, p, s); setView('list'); }} onCancel={() => setView('list')} />;
        case 'dashboard': return active ? <TournamentDashboard tournament={active} players={players} onExit={() => setView('list')} onStartMatch={onStartMatch} onDelete={(id) => { onDeleteTournament(id); setView('list'); }} /> : null;
        default: return <TournamentList tournaments={tournaments} onSelectTournament={(t) => { setActive(t); setView('dashboard'); }} onCreateNew={() => setView('setup')} appData={appData} />;
    }
};
