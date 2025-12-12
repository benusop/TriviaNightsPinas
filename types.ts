export interface Team {
  id: string;
  name: string;
  leader: string;
  leaderContact?: string;
  members: { name: string; contact?: string }[];
  isArchived?: boolean;
}

export interface Host {
  id: string;
  name: string;
  teamId?: string; // Trivia team affiliation
  gender?: 'Male' | 'Female' | 'Other';
  age?: number;
}

export interface Season {
  id: string;
  name: string; // e.g., "Season 1"
  isActive: boolean;
}

export type GameType = 'Regular' | 'Special';
export type GameStatus = 'Upcoming' | 'Live' | 'Archived';
export type CategoryType = 'Text' | 'Picture' | 'Audio' | 'Others';

// Structure: 4 Sets -> 3 Categories -> 8 Questions
export interface GameScoreLog {
  [teamId: string]: number; // Total Score
}

export interface QuestionResult {
  setId: number;
  categoryId: number;
  questionIndex: number;
  correctTeamIds: string[];
  points: number;
}

export interface CategoryConfig {
  name: string;
  type: CategoryType;
}

export interface GameFeedback {
  teamId: string;
  rating: number; // 1-10
  remarks?: string;
  memorableCategoryKey?: string; // Key of the category they voted for
}

export interface Game {
  id: string;
  seasonId: string;
  hostIds: string[]; // Changed to array for multiple hosts
  type: GameType;
  title: string; // "Regular Game" or Custom Title
  date: string;
  status: GameStatus;
  participatingTeamIds: string[];
  
  // Configuration
  hasBonusRound: boolean;
  categoryPoints: Record<string, number>; // key: "setIndex-catIndex", value: points per question default 1
  categoryConfigs: Record<string, CategoryConfig>; // key: "setIndex-catIndex"
  stickyPoints?: number; // Keeps track of the last used point value
  
  // State
  currentStage: {
    set: number;
    category: number;
    question: number;
  };
  
  // History/Logs
  results: QuestionResult[];
  
  // Post Game
  feedback?: GameFeedback[];
}

export interface RoyaltyStandings {
  teamId: string;
  teamName: string;
  points: number;
  gamesPlayed: number;
  wins: number;
}