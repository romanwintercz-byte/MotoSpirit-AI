
import { Match, Player, TournamentSettings, GameRecord } from './types';

export const triggerHapticFeedback = (pattern: number | number[] = 50) => {
    if (window.navigator && 'vibrate' in window.navigator) {
        try {
            window.navigator.vibrate(pattern);
        } catch (error) {
            console.warn("Haptic feedback failed:", error);
        }
    }
};

export const exportDataToFile = (data: object, filename: string) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Vypočítá klouzavý průměr hráče z posledních 10 zápasů daného typu.
 */
export const getPlayerAverage = (playerId: string, gameTypeKey: string, gameLog: GameRecord[]): number => {
    const playerGames = gameLog.filter(g => g.playerId === playerId && g.gameType === gameTypeKey);
    if (playerGames.length === 0) return 0;
    const sourceGames = playerGames.length >= 10 ? playerGames.slice(-10) : playerGames;
    const totalScore = sourceGames.reduce((sum, game) => sum + game.score, 0);
    const totalTurns = sourceGames.reduce((sum, game) => sum + game.turns, 0);
    return totalTurns > 0 ? totalScore / totalTurns : 0;
};

/**
 * Resizes and compresses an image data URL to save database space.
 */
export const resizeImage = (dataUrl: string, maxDim: number = 400): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxDim) {
                    height *= maxDim / width;
                    width = maxDim;
                }
            } else {
                if (height > maxDim) {
                    width *= maxDim / height;
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            // Convert to JPEG with 0.7 quality to significantly reduce size
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = dataUrl;
    });
};

export const dataURLtoFile = (dataurl: string, filename: string): File | null => {
    const arr = dataurl.split(',');
    if (arr.length < 2) return null;
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
};

// Helper for Web Push VAPID key conversion
export const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

type PlayerWithStats = Player & { average: number };

export const generateRoundRobinMatches = (playerIds: string[], groupId?: string): Match[] => {
    const matches: Match[] = [];
    for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
            matches.push({
                id: `match-${Date.now()}-${i}-${j}`,
                player1Id: playerIds[i],
                player2Id: playerIds[j],
                status: 'pending',
                groupId,
            });
        }
    }
    return matches;
};

export const generateKnockoutBracket = (playersWithStats: PlayerWithStats[], settings: TournamentSettings): Match[] => {
    let players = [...playersWithStats];

    if (settings.seeding === 'random') {
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
    } else {
        players.sort((a, b) => b.average - a.average);
    }
    
    const numPlayers = players.length;
    if (numPlayers === 0) return [];
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
    const byes = bracketSize - numPlayers;

    const matches: Match[] = [];
    const rounds: Match[][] = [];

    const round1: Match[] = [];
    const numRound1Matches = bracketSize / 2;
    const playersInRound1 = players.slice(byes);
    const topSeedsWithByes = players.slice(0, byes);

    for (let i = 0; i < numRound1Matches - byes; i++) {
        const p1 = playersInRound1[i];
        const p2 = playersInRound1[playersInRound1.length - 1 - i];
        round1.push({
            id: `match-${Date.now()}-r1-${i}`,
            player1Id: p1.id,
            player2Id: p2.id,
            status: 'pending',
            round: 1,
        });
    }
    rounds.push(round1);

    let currentRoundPlayers = topSeedsWithByes.length + round1.length;
    let roundNum = 2;
    while (currentRoundPlayers > 1) {
        const nextRound: Match[] = [];
        const numMatchesInRound = currentRoundPlayers / 2;
        for (let i = 0; i < numMatchesInRound; i++) {
            nextRound.push({
                id: `match-${Date.now()}-r${roundNum}-${i}`,
                player1Id: null,
                player2Id: null,
                status: 'pending',
                round: roundNum,
            });
        }
        rounds.push(nextRound);
        currentRoundPlayers /= 2;
        roundNum++;
    }

    const allMatches = rounds.flat();
    
    for(let i = 0; i < round1.length; i++) {
        const match = round1[i];
        const nextMatchIndex = Math.floor(i / 2);
        match.nextMatchId = rounds[1][nextMatchIndex].id;
    }

    for(let i = 0; i < topSeedsWithByes.length; i++) {
        const player = topSeedsWithByes[i];
        const targetMatchIndex = Math.floor(i / 2);
        const targetMatch = rounds[1][targetMatchIndex];
        if (i % 2 === 0) {
            targetMatch.player1Id = player.id;
        } else {
            targetMatch.player2Id = player.id;
        }
    }

    for (let r = 1; r < rounds.length - 1; r++) {
        for (let i = 0; i < rounds[r].length; i++) {
            const match = rounds[r][i];
            const nextMatchIndex = Math.floor(i / 2);
            match.nextMatchId = rounds[r+1][nextMatchIndex].id;
        }
    }
    
    return allMatches;
};

export const generateCombinedTournament = (playersWithStats: PlayerWithStats[], settings: TournamentSettings): Match[] => {
    let players = [...playersWithStats];
    const { numGroups = 1, playersAdvancing = 1 } = settings;

    if (settings.seeding === 'random') {
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
    } else {
        players.sort((a, b) => b.average - a.average);
    }

    const groups: string[][] = Array.from({ length: numGroups }, () => []);
    players.forEach((player, index) => {
        groups[index % numGroups].push(player.id);
    });

    const groupMatches = groups.flatMap((playerIds, index) => 
        generateRoundRobinMatches(playerIds, `group-${index}`)
    );

    const numAdvancing = numGroups * playersAdvancing;
    const knockoutPlayers = Array.from({ length: numAdvancing }, () => ({ id: '', name: '', avatar: '', average: 0 }));
    const knockoutMatches = generateKnockoutBracket(knockoutPlayers, { ...settings, seeding: 'random' });

    return [...groupMatches, ...knockoutMatches];
};
