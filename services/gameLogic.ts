import { Game, QuestionResult, Team, RoyaltyStandings, Season } from '../types';

// Constants
export const SETS_PER_GAME = 4;
export const CATEGORIES_PER_SET = 3;
export const QUESTIONS_PER_CATEGORY = 8;

// LocalStorage Keys
const KEYS = {
  TEAMS: 'tnp_teams',
  SEASONS: 'tnp_seasons',
  HOSTS: 'tnp_hosts',
  GAMES: 'tnp_games',
  CONFIG: 'tnp_config',
};

// Data Helpers
export const loadData = <T>(key: string, defaultVal: T): T => {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : defaultVal;
};

export const saveData = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Game Logic
export const calculateGameScores = (game: Game): Record<string, number> => {
  const scores: Record<string, number> = {};
  
  // Initialize scores for participating teams
  game.participatingTeamIds.forEach(tId => scores[tId] = 0);

  game.results.forEach(res => {
    res.correctTeamIds.forEach(teamId => {
      if (scores[teamId] !== undefined) {
        scores[teamId] += res.points;
      }
    });
  });

  if (game.manualAdjustments) {
    game.manualAdjustments.forEach(adj => {
        if (scores[adj.teamId] !== undefined) {
            scores[adj.teamId] += adj.points;
        }
    });
  }

  return scores;
};

export const getTeamHistory = (teamId: string, games: Game[], hosts?: any[]) => {
  const history: { game: Game, score: number, rank: number, hostName: string }[] = [];
  
  games.filter(g => g.status === 'Archived' && g.participatingTeamIds.includes(teamId))
       .forEach(game => {
          const scores = calculateGameScores(game);
          // Calculate Rank
          const uniqueScores = Array.from(new Set(Object.values(scores))).sort((a,b) => b-a);
          const score = scores[teamId] || 0;
          const rank = uniqueScores.indexOf(score) + 1;
          
          let hostName = 'Unknown';
          if (hosts && game.hostIds && game.hostIds.length > 0) {
             const names = game.hostIds.map(hid => hosts.find((h: any) => h.id === hid)?.name).filter(Boolean);
             if (names.length > 0) hostName = names.join(', ');
          }

          history.push({
            game,
            score,
            rank,
            hostName
          });
       });
       
  return history.sort((a,b) => new Date(b.game.date).getTime() - new Date(a.game.date).getTime());
};

export const calculateSeasonStandings = (seasonId: string, games: Game[], teams: Team[]): RoyaltyStandings[] => {
  // Filter games by season, archive status, AND the countInRoyalty flag
  // Handle legacy data where countInRoyalty might be undefined (Regular games counted by default)
  const seasonGames = games.filter(g => 
    g.seasonId === seasonId && 
    g.status === 'Archived' && 
    (g.countInRoyalty !== undefined ? g.countInRoyalty : g.type === 'Regular')
  );
  
  const standingsMap: Record<string, RoyaltyStandings> = {};

  // Initialize all teams
  teams.forEach(team => {
    standingsMap[team.id] = {
      teamId: team.id,
      teamName: team.name,
      points: 0,
      gamesPlayed: 0,
      wins: 0
    };
  });

  seasonGames.forEach(game => {
    const scores = calculateGameScores(game);
    // Sort teams by score descending
    const sortedTeams = Object.entries(scores)
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

    if (sortedTeams.length === 0) return;

    // Apply points
    sortedTeams.forEach(([teamId, score], index) => {
      if (!standingsMap[teamId]) return;
      
      standingsMap[teamId].gamesPlayed += 1;
      
      // Participation Point
      standingsMap[teamId].points += 1;

      // Ranking Points based on unique scores to handle ties
      const uniqueScores = Array.from(new Set(Object.values(scores))).sort((a,b) => b-a);
      const teamRank = uniqueScores.indexOf(score) + 1;

      if (teamRank === 1) {
        standingsMap[teamId].points += 10;
        standingsMap[teamId].wins += 1;
      } else if (teamRank === 2) {
        standingsMap[teamId].points += 5;
      } else if (teamRank === 3) {
        standingsMap[teamId].points += 3;
      }
    });
  });

  return Object.values(standingsMap).sort((a, b) => b.points - a.points);
};