
import { useState, useEffect, Dispatch, SetStateAction, useRef, useCallback } from 'react';
import { Player, AllStats, GameRecord, Tournament, ActiveGameState, MatchRequest, FullExportData, UserProfile, AdminCommunityStats } from './types';
import { supabase } from './supabaseClient';
import { triggerHapticFeedback } from './utils';

// Zjednodušená verze - uživatel píše ID přesně, jen ořežeme mezery
export const normalizeCommunityId = (text: string): string => {
    if (!text) return 'default';
    return text.trim();
};

function useLocalStorageState<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(state));
    }
  }, [key, state]);

  return [state, setState];
}

export type Theme = 'deep-teal' | 'arctic-light' | 'crimson-night' | 'sunset-orange' | 'cyber-violet';

export function useTheme(): [Theme, Dispatch<SetStateAction<Theme>>] {
    const [theme, setTheme] = useLocalStorageState<Theme>('scoreCounter:theme', 'deep-teal');
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);
    return [theme, setTheme];
}

export type AppDataHook = {
    players: Player[];
    addPlayer: (p: Omit<Player, 'id'>) => Promise<void>;
    updatePlayer: (p: Player) => Promise<void>;
    deletePlayer: (id: string) => Promise<void>;
    claimPlayer: (playerId: string) => Promise<void>;
    stats: AllStats;
    completedGamesLog: GameRecord[];
    saveGameResult: (records: GameRecord[]) => Promise<void>;
    tournaments: Tournament[];
    saveTournament: (t: Tournament) => Promise<void>;
    deleteTournament: (id: string) => Promise<void>;
    lastPlayedPlayerIds: string[];
    setLastPlayedPlayerIds: Dispatch<SetStateAction<string[]>>;
    communityId: string;
    setCommunityId: Dispatch<SetStateAction<string>>;
    refreshData: () => Promise<void>;
    importBackup: (backup: FullExportData) => Promise<void>;
    fixMissingCommunityIds: () => Promise<void>;
    isLoading: boolean;
    dbStats?: {
        totalPlayersInDb: number;
        totalLogsInDb: number;
        totalTournamentsInDb: number;
        orphanedLogsCount: number;
        existingCommunities: string[];
        error?: string;
    };
};

export const useAppData = (): AppDataHook => {
    const [players, setPlayers] = useState<Player[]>([]);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [completedGamesLog, setCompletedGamesLog] = useState<GameRecord[]>([]);
    const [stats, setStats] = useState<AllStats>({});
    const [isLoading, setIsLoading] = useState(true);
    const [dbStats, setDbStats] = useState<AppDataHook['dbStats']>();
    const [lastPlayedPlayerIds, setLastPlayedPlayerIds] = useLocalStorageState<string[]>('scoreCounter:lastPlayedPlayerIds', []);
    const [communityId, setCommunityId] = useLocalStorageState<string>('scoreCounter:communityId', 'default');
    
    const activeCommunity = normalizeCommunityId(communityId);

    const syncUserProfile = useCallback(async () => {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (!user) return;
        await supabase.from('user_profiles').upsert({
            id: user.id,
            email: user.email,
            last_activity: new Date().toISOString()
        });
    }, []);

    const loadAllData = useCallback(async () => {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (!user) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        syncUserProfile();

        try {
            const [diagP, diagL, diagT, diagOrphaned] = await Promise.all([
                supabase.from('players').select('community_id').eq('user_id', user.id),
                supabase.from('game_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
                supabase.from('tournaments').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
                supabase.from('game_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('community_id', null)
            ]);

            const errorMsg = diagP.error?.message || diagL.error?.message || diagT.error?.message;
            const communities = Array.from(new Set(diagP.data?.map(p => p.community_id) || []));
            
            setDbStats({
                totalPlayersInDb: diagP.data?.length || 0,
                totalLogsInDb: diagL.count || 0,
                totalTournamentsInDb: diagT.count || 0,
                orphanedLogsCount: diagOrphaned.count || 0,
                existingCommunities: communities as string[],
                error: errorMsg
            });

            const [pRes, tRes, lRes] = await Promise.all([
                supabase.from('players').select('*').eq('community_id', activeCommunity),
                supabase.from('tournaments').select('*').eq('community_id', activeCommunity),
                supabase.from('game_logs').select('*').eq('community_id', activeCommunity)
            ]);

            if (pRes.data) {
                setPlayers(pRes.data.map(p => ({ 
                    id: p.id, name: p.name, avatar: p.avatar, communityId: p.community_id, createdByUserId: p.user_id,
                    linkedEmail: p.linked_email, ownerId: p.owner_id
                })));
            }

            if (tRes.data) {
                setTournaments(tRes.data.map(t => ({ 
                    id: t.id, name: t.name, format: t.format, settings: t.settings, matches: t.matches, 
                    playerIds: t.player_ids, status: t.status, stage: t.stage, createdAt: t.created_at, communityId: t.community_id 
                })));
            }

            if (lRes.data) {
                const logs: GameRecord[] = lRes.data.map(l => ({ 
                    gameId: l.game_id, playerId: l.player_id, gameType: l.game_type, score: l.score, 
                    turns: l.turns, date: l.date, result: l.result, handicap_applied: l.handicap_applied, 
                    zeroInnings: l.zero_innings || 0, clean10s: l.clean10s || 0, clean20s: l.clean20s || 0, 
                    highestRun: l.highest_run || 0, communityId: l.community_id
                }));
                setCompletedGamesLog(logs);
                
                const newStats: AllStats = {};
                logs.forEach(record => {
                    if (!newStats[record.gameType]) newStats[record.gameType] = {};
                    if (!newStats[record.gameType][record.playerId]) {
                        newStats[record.gameType][record.playerId] = { gamesPlayed: 0, wins: 0, losses: 0, totalTurns: 0, totalScore: 0, zeroInnings: 0, highestRun: 0 };
                    }
                    const s = newStats[record.gameType][record.playerId];
                    s.gamesPlayed++;
                    if (record.result === 'win') s.wins++;
                    if (record.result === 'loss') s.losses++;
                    s.totalScore += record.score;
                    s.totalTurns += record.turns;
                    s.zeroInnings += (record.zeroInnings || 0);
                    if (record.highestRun > (s.highestRun || 0)) s.highestRun = record.highestRun;
                });
                setStats(newStats);
            }
        } catch (err) {
            console.error("Chyba synchronizace:", err);
        } finally {
            setIsLoading(false);
        }
    }, [activeCommunity, syncUserProfile]);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    const fixMissingCommunityIds = async () => {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (!user) return;
        setIsLoading(true);
        try {
            await Promise.all([
                supabase.from('game_logs').update({ community_id: activeCommunity }).eq('user_id', user.id),
                supabase.from('players').update({ community_id: activeCommunity }).eq('user_id', user.id),
                supabase.from('tournaments').update({ community_id: activeCommunity }).eq('user_id', user.id)
            ]);
            await loadAllData();
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const addPlayer = async (p: Omit<Player, 'id'>) => {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (!user) return;
        const newId = `player-${Date.now()}`;
        const { error: dbError } = await supabase.from('players').insert({
            id: newId, user_id: user.id, name: p.name, avatar: p.avatar, community_id: activeCommunity,
            linked_email: p.linkedEmail
        });
        if (!dbError) await loadAllData();
    };

    const updatePlayer = async (p: Player) => {
        await supabase.from('players').update({ 
            name: p.name, 
            avatar: p.avatar,
            linked_email: p.linkedEmail
        }).eq('id', p.id);
        await loadAllData();
    };

    const deletePlayer = async (id: string) => {
        await supabase.from('players').delete().eq('id', id);
        await loadAllData();
    };

    const claimPlayer = async (playerId: string) => {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (!user) return;
        await supabase.from('players').update({ owner_id: user.id }).eq('id', playerId);
        await loadAllData();
    };

    const saveGameResult = async (records: GameRecord[]) => {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (!user) return;
        const dbRows = records.map(l => ({
            game_id: l.gameId, player_id: l.playerId, user_id: user.id, game_type: l.gameType,
            score: l.score, turns: l.turns, date: l.date, result: l.result, handicap_applied: l.handicapApplied || 0,
            // Fix: Property names on GameRecord are camelCase
            zero_innings: l.zeroInnings || 0, clean10s: l.clean10s || 0, clean20s: l.clean20s || 0,
            // Fix: Property names on GameRecord are camelCase
            highest_run: l.highestRun || 0, community_id: activeCommunity
        }));
        await supabase.from('game_logs').insert(dbRows);
        await loadAllData();
    };

    const saveTournament = async (t: Tournament) => {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (!user) return;
        await supabase.from('tournaments').upsert({
            id: t.id, user_id: user.id, name: t.name, format: t.format, settings: t.settings,
            matches: t.matches, player_ids: t.playerIds, status: t.status, stage: t.stage,
            created_at: t.createdAt, community_id: activeCommunity
        });
        await loadAllData();
    };

    const deleteTournament = async (id: string) => {
        await supabase.from('tournaments').delete().eq('id', id);
        await loadAllData();
    };

    const importBackup = async (backup: FullExportData) => {
        const { data: { user } } = await (supabase.auth as any).getUser();
        if (!user) return;
        for (const p of backup.data.players) {
            await supabase.from('players').upsert({ id: p.id, user_id: user.id, name: p.name, avatar: p.avatar, community_id: activeCommunity });
        }
        await loadAllData();
    };

    return {
        players, addPlayer, updatePlayer, deletePlayer, claimPlayer,
        stats, completedGamesLog, saveGameResult,
        tournaments, saveTournament, deleteTournament,
        lastPlayedPlayerIds, setLastPlayedPlayerIds,
        communityId, setCommunityId,
        refreshData: loadAllData,
        importBackup,
        fixMissingCommunityIds,
        isLoading,
        dbStats
    };
};

export const useAdminData = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [communityStats, setCommunityStats] = useState<AdminCommunityStats[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAdminData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: userData } = await supabase.from('user_profiles').select('*').order('last_activity', { ascending: false });
            if (userData) setUsers(userData);
            
            const { data: allPlayersData } = await supabase.from('players').select('*');
            if (allPlayersData) {
                const mappedPlayers: Player[] = allPlayersData.map(p => ({
                    id: p.id,
                    name: p.name,
                    avatar: p.avatar,
                    communityId: p.community_id,
                    createdByUserId: p.user_id,
                    linkedEmail: p.linked_email,
                    ownerId: p.owner_id
                }));
                setAllPlayers(mappedPlayers);

                const comms: Record<string, number> = {};
                mappedPlayers.forEach(p => {
                    const cid = p.communityId || 'default';
                    comms[cid] = (comms[cid] || 0) + 1;
                });
                setCommunityStats(Object.entries(comms).map(([id, count]) => ({ id, playerCount: count, matchCount: 0 })));
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, []);

    return { users, allPlayers, communityStats, loading, refresh: fetchAdminData };
};

export const useMatchRequests = () => {
    const [requests, setRequests] = useState<MatchRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [communityId] = useLocalStorageState<string>('scoreCounter:communityId', 'default');
    const activeCommunity = normalizeCommunityId(communityId);

    const fetchRequests = useCallback(async () => {
        const { data } = await supabase.from('match_requests').select('*').eq('community_id', activeCommunity).order('scheduled_at', { ascending: true });
        if (data) setRequests(data.map(r => ({ 
            id: r.id, createdByUserId: r.created_by, playerId: r.player_id, 
            acceptedByPlayerId: r.accepted_by_player_id, scheduledAt: r.scheduled_at, 
            gameType: r.game_type, note: r.note, status: r.status, venue: r.venue, communityId: r.community_id 
        })));
        setLoading(false);
    }, [activeCommunity]);
    useEffect(() => { fetchRequests(); }, [fetchRequests]);
    return { 
        requests, loading, 
        createRequest: async (request: any) => {
            const { data: { user } } = await (supabase.auth as any).getUser();
            if (!user) return;
            const { error } = await supabase.from('match_requests').insert({ created_by: user.id, player_id: request.playerId, scheduled_at: request.scheduledAt, game_type: request.gameType, note: request.note, status: 'open', community_id: activeCommunity });
            if (!error) { triggerHapticFeedback([20, 50, 20]); fetchRequests(); } else { alert(error.message); }
        },
        acceptRequest: async (requestId: string, acceptedByPlayerId: string) => { await supabase.from('match_requests').update({ accepted_by_player_id: acceptedByPlayerId, status: 'accepted' }).eq('id', requestId); fetchRequests(); },
        cancelRequest: async (id: string) => { await supabase.from('match_requests').delete().eq('id', id); fetchRequests(); },
        withdrawParticipation: async (id: string) => { await supabase.from('match_requests').update({ accepted_by_player_id: null, status: 'open' }).eq('id', id); fetchRequests(); },
        completeRequest: async (id: string) => { await supabase.from('match_requests').update({ status: 'completed' }).eq('id', id); fetchRequests(); }
    };
};

export const useRealtimeGame = (onRemoteUpdate: (state: ActiveGameState) => void) => {
    const [userId, setUserId] = useState<string | null>(null);
    const [communityId] = useLocalStorageState<string>('scoreCounter:communityId', 'default');
    const activeCommunity = normalizeCommunityId(communityId);
    useEffect(() => { (supabase.auth as any).getUser().then(({ data: { user } }: any) => { if (user) setUserId(user.id); }); }, []);
    useEffect(() => {
        if (!userId) return;
        const channel = supabase.channel(`game_sync_${userId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'active_games', filter: `user_id=eq.${userId}` }, (payload) => { if (payload.new && payload.new.game_state) onRemoteUpdate(payload.new.game_state as ActiveGameState); }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userId, onRemoteUpdate]);
    return { 
        saveActiveGame: async (state: ActiveGameState) => { 
            if (userId) return await supabase.from('active_games').upsert({ user_id: userId, game_state: state, updated_at: new Date().toISOString(), community_id: activeCommunity }); 
        }, 
        clearActiveGame: async () => {
            if (userId) await supabase.from('active_games').delete().eq('user_id', userId);
        } 
    };
};

export const useSpectatorGame = (targetUserId: string | null) => {
    const [spectatorState, setSpectatorState] = useState<ActiveGameState | null>(null);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (!targetUserId) return;
        setLoading(true);
        const fetchState = async () => {
            const { data } = await supabase.from('active_games').select('game_state').eq('user_id', targetUserId).single();
            if (data?.game_state) setSpectatorState(data.game_state as ActiveGameState);
            setLoading(false);
        };
        fetchState();
        const channel = supabase.channel(`spec_${targetUserId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'active_games', filter: `user_id=eq.${targetUserId}` }, (payload) => { if (payload.new && payload.new.game_state) setSpectatorState(payload.new.game_state as ActiveGameState); }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [targetUserId]);
    return { spectatorState, loading, error: null };
};

export const useTvGame = (communityId: string | null) => {
    const [gameState, setGameState] = useState<ActiveGameState | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!communityId) return;
        const activeComm = normalizeCommunityId(communityId);
        setLoading(true);

        const fetchLatest = async () => {
            const { data, error } = await supabase
                .from('active_games')
                .select('game_state')
                .eq('community_id', activeComm)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            if (!error && data?.game_state) {
                setGameState(data.game_state as ActiveGameState);
            } else {
                setGameState(null);
            }
            setLoading(false);
        };

        fetchLatest();

        const channel = supabase.channel(`tv_${activeComm}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'active_games', 
                filter: `community_id=eq.${activeComm}` 
            }, (payload) => {
                if (payload.eventType === 'DELETE') {
                    setGameState(null);
                } else if (payload.new && payload.new.game_state) {
                    setGameState(payload.new.game_state as ActiveGameState);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [communityId]);

    return { gameState, loading };
};
