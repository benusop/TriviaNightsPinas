import React, { useState, useEffect } from 'react';
import { Team, Host, Season, Game, GameType, GameStatus, GameFeedback } from './types';
import { loadData, saveData, calculateSeasonStandings, SETS_PER_GAME, CATEGORIES_PER_SET, getTeamHistory } from './services/gameLogic';
import { Card, Button, Input, Select, Badge } from './components/UI';
import { LiveGame } from './components/LiveGame';
import { 
  LayoutDashboard, Users, Calendar, Trophy, Plus, Settings, 
  Trash2, PlayCircle, Archive, Phone, User, Edit2, Play, Grid, X, CheckCircle, AlertOctagon, RotateCcw, Menu, Star, MessageSquare, Cloud, RefreshCw, ChevronRight, History, MinusCircle, Download, Eye
} from 'lucide-react';

type View = 'dashboard' | 'games' | 'teams' | 'setup';

function App() {
  // --- Global State ---
  const [view, setView] = useState<View>('dashboard');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // --- Data State ---
  const [teams, setTeams] = useState<Team[]>(() => loadData<Team[]>('tnp_teams', []));
  const [hosts, setHosts] = useState<Host[]>(() => loadData<Host[]>('tnp_hosts', []));
  const [seasons, setSeasons] = useState<Season[]>(() => loadData<Season[]>('tnp_seasons', [{ id: 's0', name: 'Season 0', isActive: true }]));
  
  // Load games with migration logic for single hostId -> hostIds array
  const [games, setGames] = useState<Game[]>(() => {
     const loaded = loadData<any[]>('tnp_games', []);
     return loaded.map(g => ({
        ...g,
        hostIds: g.hostIds || (g.hostId ? [g.hostId] : [])
     }));
  });
  
  // Update default URL to the one provided by user
  const [sheetUrl, setSheetUrl] = useState<string>(() => loadData<string>('tnp_sheet_url', 'https://script.google.com/macros/s/AKfycbzCnTZBN4RrosKvqaloiGOv84iABKU2fNwWmXSaY0cHgeSp1Fb27yrZIUbRtnub8J4dQQ/exec'));

  // --- Persist Data on Change ---
  useEffect(() => saveData('tnp_teams', teams), [teams]);
  useEffect(() => saveData('tnp_hosts', hosts), [hosts]);
  useEffect(() => saveData('tnp_seasons', seasons), [seasons]);
  useEffect(() => saveData('tnp_games', games), [games]);
  useEffect(() => saveData('tnp_sheet_url', sheetUrl), [sheetUrl]);

  // --- Helpers ---
  const currentSeason = seasons.find(s => s.isActive) || seasons[0] || { id: 'fallback', name: 'Fallback Season', isActive: true };

  // --- Actions ---
  // Note: handleSaveGame is now managed inside GamesView component state to handle multiple hosts logic better
  
  const handleStartGame = (gameId: string) => {
    const game = games.find(g => g.id === gameId);
    if(!game) return;
    let participating = game.participatingTeamIds;
    if (game.status === 'Upcoming') {
        participating = []; 
    }
    const updatedGames = games.map(g => g.id === gameId ? { ...g, status: 'Live' as GameStatus, participatingTeamIds: participating } : g);
    setGames(updatedGames);
    setActiveGameId(gameId);
  };

  const updateActiveGame = (updatedGame: Game) => {
    setGames(prevGames => prevGames.map(g => g.id === updatedGame.id ? updatedGame : g));
  };

  const navigate = (newView: View) => {
      setView(newView);
      setIsMobileMenuOpen(false);
  }

  // --- Sub-Components ---

  const DashboardView = () => {
    const standings = calculateSeasonStandings(currentSeason.id, games, teams);
    
    return (
      <div className="space-y-6 pb-20 md:pb-0">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Trivia Royalty - {currentSeason.name}</h2>
          <div className="text-sm text-gray-500 font-medium">Total Teams: {teams.filter(t => !t.isArchived).length}</div>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
           {standings.slice(0, 4).map((s, i) => (
             <Card key={s.teamId} className={`relative overflow-hidden border-2 ${i === 0 ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                   <div className="text-gray-500 text-xs font-bold uppercase tracking-widest">Rank #{i + 1}</div>
                   {i === 0 && <Trophy className="w-5 h-5 text-yellow-500" />}
                </div>
                <div className="text-2xl font-bold text-gray-900 truncate">{s.teamName}</div>
                <div className="text-3xl font-black text-red-600 mt-2">{s.points} <span className="text-sm text-gray-400 font-normal">pts</span></div>
                <div className="mt-2 text-xs text-gray-500 font-medium">{s.wins} Wins • {s.gamesPlayed} Games</div>
             </Card>
           ))}
        </div>

        <Card title="Full Season Standings" className="overflow-hidden">
          <div className="overflow-x-auto -mx-6 md:mx-0">
            <table className="w-full text-left text-sm text-gray-600 min-w-[600px] md:min-w-full">
              <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-xs">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Rank</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3 text-center">Games</th>
                  <th className="px-4 py-3 text-center">Wins</th>
                  <th className="px-4 py-3 text-right rounded-tr-lg">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {standings.map((s, i) => (
                  <tr key={s.teamId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-500">#{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.teamName}</td>
                    <td className="px-4 py-3 text-center">{s.gamesPlayed}</td>
                    <td className="px-4 py-3 text-center">{s.wins}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const TeamsView = () => {
    const [isEditing, setIsEditing] = useState(false);
    const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
    const [viewingHistoryTeamId, setViewingHistoryTeamId] = useState<string | null>(null);
    const [members, setMembers] = useState<{name: string, contact: string}[]>([]);
    const [showArchived, setShowArchived] = useState(false);
    
    const handleSaveTeam = (e: React.FormEvent) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const data = new FormData(form);
      
      const teamData = {
          name: data.get('name') as string,
          leader: data.get('leader') as string,
          leaderContact: data.get('leaderContact') as string,
          members: members.filter(m => m.name.trim() !== '')
      };

      if (editingTeamId) {
          setTeams(teams.map(t => t.id === editingTeamId ? { ...t, ...teamData } : t));
      } else {
          const newTeam: Team = {
            id: crypto.randomUUID(),
            ...teamData,
            isArchived: false
          };
          setTeams([...teams, newTeam]);
      }
      closeForm();
    };

    const openEdit = (e: React.MouseEvent, team: Team) => {
        e.stopPropagation();
        setMembers(team.members);
        setEditingTeamId(team.id);
        setIsEditing(true);
    };

    const closeForm = () => {
        setIsEditing(false);
        setEditingTeamId(null);
        setMembers([]);
    };

    const toggleArchive = (e: React.MouseEvent, team: Team) => {
        e.stopPropagation();
        const action = team.isArchived ? "restore" : "archive";
        if(confirm(`Are you sure you want to ${action} ${team.name}?`)) {
            setTeams(teams.map(t => t.id === team.id ? { ...t, isArchived: !t.isArchived } : t));
        }
    };

    const addMemberField = () => {
      if (members.length < 20) {
        setMembers([...members, { name: '', contact: '' }]);
      }
    };

    const updateMember = (index: number, field: 'name' | 'contact', value: string) => {
      const updated = [...members];
      updated[index][field] = value;
      setMembers(updated);
    };

    const removeMember = (index: number) => {
      setMembers(members.filter((_, i) => i !== index));
    };

    const displayTeams = teams.filter(t => showArchived ? t.isArchived : !t.isArchived);
    const historyTeam = teams.find(t => t.id === viewingHistoryTeamId);
    const teamHistory = historyTeam ? getTeamHistory(historyTeam.id, games, hosts) : [];

    return (
      <div className="space-y-6 pb-20 md:pb-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Teams</h2>
            <div className="flex gap-2">
                <button onClick={() => setShowArchived(false)} className={`text-sm px-3 py-1 rounded-full ${!showArchived ? 'bg-red-100 text-red-700 font-bold' : 'text-gray-500'}`}>Active</button>
                <button onClick={() => setShowArchived(true)} className={`text-sm px-3 py-1 rounded-full ${showArchived ? 'bg-red-100 text-red-700 font-bold' : 'text-gray-500'}`}>Archived</button>
            </div>
          </div>
          <Button onClick={() => { closeForm(); setIsEditing(true); }} icon={Plus} className="w-full md:w-auto">Add Team</Button>
        </div>

        {/* --- Team Edit Modal --- */}
        {isEditing && (
          <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card title={editingTeamId ? "Edit Team" : "New Team"} className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95" noPadding>
            <form onSubmit={handleSaveTeam} className="flex flex-col h-full min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {editingTeamId && (
                      <input type="hidden" name="id" value={editingTeamId} />
                  )}
                  <Input name="name" label="Team Name" required placeholder="e.g. The Quizzards" defaultValue={teams.find(t => t.id === editingTeamId)?.name} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input name="leader" label="Team Leader" required placeholder="Full Name" defaultValue={teams.find(t => t.id === editingTeamId)?.leader} />
                    <Input name="leaderContact" label="Contact Info (Optional)" placeholder="Mobile/Email" defaultValue={teams.find(t => t.id === editingTeamId)?.leaderContact} />
                  </div>

                  {/* Members Section */}
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-bold text-gray-700">Team Members (Max 20)</label>
                      <Button type="button" variant="secondary" onClick={addMemberField} className="text-xs py-1 px-2" disabled={members.length >= 20}>
                        + Add Member
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {members.map((member, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded border border-gray-200">
                          <div className="flex-1 space-y-2">
                            <Input 
                              placeholder="Member Name" 
                              value={member.name} 
                              onChange={e => updateMember(idx, 'name', e.target.value)}
                              required
                              className="text-sm py-1"
                            />
                            <Input 
                              placeholder="Contact (Optional)" 
                              value={member.contact} 
                              onChange={e => updateMember(idx, 'contact', e.target.value)}
                              className="text-sm py-1"
                            />
                          </div>
                          <button type="button" onClick={() => removeMember(idx)} className="text-red-400 hover:text-red-600 p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {members.length === 0 && <div className="text-gray-400 text-sm italic col-span-full text-center py-4">No members added yet.</div>}
                    </div>
                  </div>
              </div>

              <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2 shrink-0">
                <Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button>
                <Button type="submit">Save Team</Button>
              </div>
            </form>
          </Card>
          </div>
        )}

        {/* --- Team History Modal --- */}
        {viewingHistoryTeamId && historyTeam && (
           <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
              <Card className="w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95">
                 <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-4">
                    <div>
                       <h2 className="text-2xl font-bold text-gray-900">{historyTeam.name}</h2>
                       <div className="text-sm text-gray-500 mt-1">Game History & Performance</div>
                    </div>
                    <button onClick={() => setViewingHistoryTeamId(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-6 h-6 text-gray-400"/></button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto">
                    {teamHistory.length === 0 ? (
                       <div className="text-center py-10 text-gray-400 italic">No games played yet.</div>
                    ) : (
                       <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                             <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold sticky top-0">
                                <tr>
                                   <th className="p-3 text-left">Date</th>
                                   <th className="p-3 text-left">Game</th>
                                   <th className="p-3 text-left">Host(s)</th>
                                   <th className="p-3 text-center">Rank</th>
                                   <th className="p-3 text-right">Score</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-gray-100">
                                {teamHistory.map((h, i) => (
                                   <tr key={i} className="hover:bg-gray-50">
                                      <td className="p-3 text-gray-500">{new Date(h.game.date).toLocaleDateString()}</td>
                                      <td className="p-3 font-medium text-gray-900">{h.game.title}</td>
                                      <td className="p-3 text-gray-600 max-w-[150px] truncate" title={h.hostName}>{h.hostName}</td>
                                      <td className="p-3 text-center font-bold">
                                         {h.rank === 1 && <span className="text-yellow-500">🥇 1st</span>}
                                         {h.rank === 2 && <span className="text-gray-400">🥈 2nd</span>}
                                         {h.rank === 3 && <span className="text-amber-700">🥉 3rd</span>}
                                         {h.rank > 3 && <span className="text-gray-500">#{h.rank}</span>}
                                      </td>
                                      <td className="p-3 text-right font-bold text-red-600">{h.score}</td>
                                   </tr>
                                ))}
                             </tbody>
                          </table>
                       </div>
                    )}
                 </div>
              </Card>
           </div>
        )}

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {displayTeams.map(team => (
            <Card key={team.id} className="hover:border-red-200 transition group relative cursor-pointer" >
               {/* Clickable Area Wrapper */}
               <div onClick={() => setViewingHistoryTeamId(team.id)}>
                  <div className="flex justify-between items-start">
                     <h3 className="text-xl font-bold text-gray-900">{team.name}</h3>
                     <div className="flex gap-1 z-10">
                        <button onClick={(e) => openEdit(e, team)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={(e) => toggleArchive(e, team)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded" title={team.isArchived ? "Restore" : "Archive"}>
                           {team.isArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        </button>
                     </div>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                     <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-500">Leader:</span> {team.leader}
                     </div>
                     {team.leaderContact && (
                        <div className="flex items-center gap-2">
                           <Phone className="w-4 h-4 text-gray-400" />
                           {team.leaderContact}
                        </div>
                     )}
                     <div className="pt-3 border-t border-gray-100 mt-3 flex justify-between items-center">
                        <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">{team.members.length} Members</div>
                        <div className="text-red-500 text-xs font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           View History <ChevronRight className="w-3 h-3" />
                        </div>
                     </div>
                  </div>
              </div>
            </Card>
          ))}
          {displayTeams.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  No teams found in this view.
              </div>
          )}
        </div>
      </div>
    );
  };

  const GamesView = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGameId, setEditingGameId] = useState<string | null>(null);
    const [modalHostIds, setModalHostIds] = useState<string[]>([]); // New state for multiple hosts
    const [showArchivedGames, setShowArchivedGames] = useState(false);

    // Filter games based on archive status
    const filteredGames = games.filter(g => showArchivedGames ? g.status === 'Archived' : g.status !== 'Archived');
    const sortedGames = [...filteredGames].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const openCreate = () => {
        setEditingGameId(null);
        setModalHostIds(['']); // Start with one empty host
        setIsModalOpen(true);
    }

    const openEdit = (id: string) => {
        setEditingGameId(id);
        const gameToEdit = games.find(g => g.id === id);
        // Ensure at least one select is shown
        setModalHostIds(gameToEdit?.hostIds && gameToEdit.hostIds.length > 0 ? gameToEdit.hostIds : ['']);
        setIsModalOpen(true);
    }

    const saveGame = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const type = formData.get('type') as GameType;
        const isSpecial = type === 'Special';
        const hasBonusRound = formData.get('hasBonusRound') === 'on';
        
        // Filter out empty host selections
        const finalHostIds = modalHostIds.filter(id => id.trim() !== '');

        if (finalHostIds.length === 0) {
            alert("Please select at least one host.");
            return;
        }

        if (editingGameId) {
            const updatedGames = games.map(g => {
                if (g.id === editingGameId) {
                    return {
                        ...g,
                        hostIds: finalHostIds,
                        type: type,
                        title: isSpecial ? (formData.get('title') as string) : 'Regular Game',
                        date: formData.get('date') as string,
                        hasBonusRound: hasBonusRound
                    }
                }
                return g;
            });
            setGames(updatedGames);
        } else {
            const newGame: Game = {
              id: crypto.randomUUID(),
              seasonId: currentSeason.id,
              hostIds: finalHostIds,
              type: type,
              title: isSpecial ? (formData.get('title') as string) : 'Regular Game',
              date: formData.get('date') as string,
              status: 'Upcoming',
              participatingTeamIds: [],
              hasBonusRound: hasBonusRound,
              categoryPoints: {},
              categoryConfigs: {},
              currentStage: { set: 0, category: 0, question: 0 },
              results: []
            };
            setGames([...games, newGame]);
        }
        setIsModalOpen(false);
    }

    const addHostField = () => {
        if (modalHostIds.length < 5) {
            setModalHostIds([...modalHostIds, '']);
        }
    };

    const updateHostField = (index: number, value: string) => {
        const updated = [...modalHostIds];
        updated[index] = value;
        setModalHostIds(updated);
    };

    const removeHostField = (index: number) => {
        const updated = modalHostIds.filter((_, i) => i !== index);
        setModalHostIds(updated.length ? updated : ['']);
    };

    const editingGame = games.find(g => g.id === editingGameId);

    return (
      <div className="space-y-6 pb-20 md:pb-0">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Games</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowArchivedGames(false)} className={`text-sm px-3 py-1 rounded-full ${!showArchivedGames ? 'bg-red-100 text-red-700 font-bold' : 'text-gray-500'}`}>Active</button>
            <button onClick={() => setShowArchivedGames(true)} className={`text-sm px-3 py-1 rounded-full ${showArchivedGames ? 'bg-red-100 text-red-700 font-bold' : 'text-gray-500'}`}>Archived</button>
            <Button onClick={openCreate} icon={Plus} className="ml-2">Create Game</Button>
          </div>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
             <Card title={editingGameId ? "Edit Game Settings" : "Schedule New Game"} className="w-full max-w-xl shadow-2xl animate-in fade-in zoom-in-95">
                <form onSubmit={saveGame} className="space-y-5">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Select name="type" label="Game Type" defaultValue={editingGame?.type || "Regular"}>
                         <option value="Regular">Regular Game</option>
                         <option value="Special">Special Game</option>
                      </Select>
                      <Input name="date" type="date" label="Date" required defaultValue={editingGame?.date} />
                   </div>
                   
                   {/* Multiple Hosts Selector */}
                   <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-semibold text-gray-700">Hosts (Max 5)</label>
                        {modalHostIds.length < 5 && (
                            <Button type="button" variant="ghost" onClick={addHostField} className="text-xs py-1 px-2 h-auto text-blue-600">
                                + Add Host
                            </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {modalHostIds.map((hId, idx) => (
                            <div key={idx} className="flex gap-2">
                                <select 
                                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-red-500 outline-none"
                                    value={hId}
                                    onChange={(e) => updateHostField(idx, e.target.value)}
                                    required={idx === 0}
                                >
                                    <option value="">Select Host...</option>
                                    {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                </select>
                                {modalHostIds.length > 1 && (
                                    <button type="button" onClick={() => removeHostField(idx)} className="text-red-400 hover:text-red-600 p-2">
                                        <MinusCircle className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        ))}
                      </div>
                   </div>

                   <Input name="title" label="Game Title (Optional Override)" placeholder="e.g. Halloween Special" defaultValue={editingGame?.title === 'Regular Game' ? '' : editingGame?.title} />
                   
                   <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <input type="checkbox" name="hasBonusRound" id="bonus" defaultChecked={editingGame?.hasBonusRound} className="w-5 h-5 rounded text-red-600 focus:ring-red-500 border-gray-300" />
                      <label htmlFor="bonus" className="text-gray-700 font-medium">Include Bonus Round (5th Set)</label>
                   </div>

                   <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                      <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                      <Button type="submit">Save Game</Button>
                   </div>
                </form>
             </Card>
          </div>
        )}

        <div className="grid gap-4">
          {sortedGames.map(game => {
             const hostNames = game.hostIds && game.hostIds.length > 0 
                ? game.hostIds.map(hid => hosts.find(h => h.id === hid)?.name || 'Unknown').join(', ')
                : 'No Host';

             const displayDate = new Date(game.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
             const displayTitle = game.type === 'Regular' 
                ? `${displayDate} Regular Game`
                : game.title;

             return (
             <div key={game.id} className="bg-white border border-gray-200 hover:border-red-200 transition shadow-sm rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                <div>
                   <div className="flex items-center gap-2 mb-2">
                      {game.status === 'Live' && <Badge color="green">LIVE NOW</Badge>}
                      {game.status === 'Upcoming' && <Badge color="blue">UPCOMING</Badge>}
                      {game.status === 'Archived' && <Badge color="gray">ARCHIVED</Badge>}
                      {game.status !== 'Upcoming' && <span className="text-gray-400 text-xs font-bold uppercase tracking-wide">{displayDate}</span>}
                   </div>
                   <h3 className="text-xl font-bold text-gray-900 group-hover:text-red-600 transition-colors">{displayTitle}</h3>
                   <div className="text-sm text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                       <span>Host(s): <span className="font-semibold text-gray-700">{hostNames}</span></span>
                       {game.hasBonusRound && <Badge color="yellow">Bonus Round</Badge>}
                   </div>
                </div>
                
                <div className="flex items-center gap-2 self-start md:self-center">
                   {game.status === 'Archived' ? (
                       <Button onClick={() => setActiveGameId(game.id)} variant="secondary" icon={Eye}>View Summary</Button>
                   ) : (
                       game.status === 'Live' ? (
                          <Button onClick={() => setActiveGameId(game.id)} variant="success" icon={Play}>Resume</Button>
                       ) : (
                          <Button onClick={() => handleStartGame(game.id)} variant="primary" icon={PlayCircle}>Start</Button>
                       )
                   )}
                   
                   <Button variant="secondary" className="px-3" onClick={() => openEdit(game.id)} title="Edit Game"><Edit2 className="w-4 h-4" /></Button>
                   
                   <Button variant="danger" className="px-3" onClick={() => {
                        if(confirm("Are you sure you want to PERMANENTLY delete this game? This cannot be undone.")) {
                            setGames(games.filter(g => g.id !== game.id));
                        }
                   }} title="Delete Game"><Trash2 className="w-4 h-4" /></Button>
                   
                </div>
             </div>
             )
          })}
          {sortedGames.length === 0 && <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-xl">No games found in this view.</div>}
        </div>
      </div>
    );
  };

  const SetupView = () => {
     const [isHostModalOpen, setIsHostModalOpen] = useState(false);
     const [editingHostId, setEditingHostId] = useState<string | null>(null);
     const [viewingHostId, setViewingHostId] = useState<string | null>(null);
     const [newSeason, setNewSeason] = useState("");
     const [isSyncing, setIsSyncing] = useState(false);
     const [isLoading, setIsLoading] = useState(false);

     const handleSaveHost = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const data = new FormData(form);
        const hostData = {
           name: data.get('name') as string,
           teamId: data.get('teamId') as string || undefined,
           gender: data.get('gender') as 'Male'|'Female'|'Other' || undefined,
           age: parseInt(data.get('age') as string) || undefined
        };

        if(editingHostId) {
           setHosts(hosts.map(h => h.id === editingHostId ? { ...h, ...hostData } : h));
        } else {
           setHosts([...hosts, { id: crypto.randomUUID(), ...hostData }]);
        }
        setIsHostModalOpen(false);
        setEditingHostId(null);
     }

     const addSeason = () => {
        if(newSeason) {
           const updated = seasons.map(s => ({ ...s, isActive: false }));
           setSeasons([...updated, { id: crypto.randomUUID(), name: newSeason, isActive: true }]);
           setNewSeason("");
        }
     }

     const syncToCloud = async () => {
        if (!sheetUrl) {
            alert("Please enter a Google Sheets Web App URL first.");
            return;
        }
        setIsSyncing(true);
        try {
            const payload = {
                teams,
                hosts,
                games,
                seasons
            };
            
            await fetch(sheetUrl, {
                method: 'POST',
                mode: 'no-cors', // Safer for GAS interactions from browser
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            alert("Sync command sent! Check your Google Sheet in a few seconds.");
        } catch (e) {
            console.error(e);
            alert("Sync failed. Check console or URL.");
        } finally {
            setIsSyncing(false);
        }
     }
     
     const loadFromCloud = async () => {
        if (!sheetUrl) {
            alert("Please enter a Google Sheets Web App URL first.");
            return;
        }
        if (!confirm("This will OVERWRITE your local data with data from the cloud. Continue?")) {
            return;
        }
        setIsLoading(true);
        try {
            // Append a timestamp to prevent browser caching of the GET request
            let urlStr = sheetUrl;
            try {
                const url = new URL(sheetUrl);
                url.searchParams.append('t', Date.now().toString());
                urlStr = url.toString();
            } catch(e) {
                // Fallback if URL is invalid (unlikely if user used default, but possible)
                if (urlStr.includes('?')) urlStr += `&t=${Date.now()}`;
                else urlStr += `?t=${Date.now()}`;
            }

            const response = await fetch(urlStr, {
                method: 'GET',
                // Important: Do NOT set Content-Type header for GET requests to GAS Web Apps to avoid CORS preflight issues.
            });
            
            if (!response.ok) {
                 throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error("Failed to parse JSON response:", text);
                throw new Error("Invalid JSON response from server. Check console for details.");
            }
            
            if (data) {
                if (data.teams) setTeams(data.teams);
                if (data.hosts) setHosts(data.hosts);
                // Handle legacy single-host migration on load as well
                if (data.games) {
                    const migratedGames = data.games.map((g: any) => ({
                        ...g,
                        hostIds: g.hostIds || (g.hostId ? [g.hostId] : [])
                    }));
                    setGames(migratedGames);
                }
                if (data.seasons) setSeasons(data.seasons);
                alert("Data loaded successfully!");
            }
        } catch (e) {
            console.error(e);
            alert(`Failed to load data: ${(e as Error).message}. Ensure your Script is deployed as 'Web App' with access 'Anyone'.`);
        } finally {
            setIsLoading(false);
        }
     };

     // --- Host Profile Stats ---
     const getHostStats = (hId: string) => {
        // Updated to check if host ID exists in the game's hostIds array
        const hostedGames = games.filter(g => g.status === 'Archived' && g.hostIds && g.hostIds.includes(hId));
        const count = hostedGames.length;
        
        let totalRating = 0;
        let ratingCount = 0;
        let comments: { team: string, text: string, rating: number, date: string }[] = [];

        hostedGames.forEach(g => {
           if(g.feedback) {
              g.feedback.forEach(f => {
                 if(f.rating) {
                    totalRating += f.rating;
                    ratingCount++;
                 }
                 if(f.remarks) {
                    const tName = teams.find(t => t.id === f.teamId)?.name || 'Unknown Team';
                    comments.push({ team: tName, text: f.remarks, rating: f.rating, date: g.date });
                 }
              });
           }
        });

        const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : "N/A";
        return { count, avgRating, comments };
     }

     const editingHost = hosts.find(h => h.id === editingHostId);
     const viewingHost = hosts.find(h => h.id === viewingHostId);
     const viewingStats = viewingHost ? getHostStats(viewingHost.id) : null;

     return (
        <div className="space-y-6 pb-20 md:pb-0">
           {/* -- Modals -- */}
           {/* (Host modals unchanged, kept same logic) */}
           {isHostModalOpen && (
              <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                 <Card title={editingHostId ? "Edit Host" : "New Host"} className="w-full max-w-lg shadow-xl animate-in fade-in zoom-in-95">
                    <form onSubmit={handleSaveHost} className="space-y-4">
                       <Input name="name" label="Host Name" required defaultValue={editingHost?.name} />
                       <div className="grid grid-cols-2 gap-4">
                          <Select name="gender" label="Gender" defaultValue={editingHost?.gender || ""}>
                             <option value="">Select...</option>
                             <option value="Male">Male</option>
                             <option value="Female">Female</option>
                             <option value="Other">Other</option>
                          </Select>
                          <Input name="age" type="number" label="Age" defaultValue={editingHost?.age} />
                       </div>
                       <Select name="teamId" label="Trivia Team Affiliation (Optional)" defaultValue={editingHost?.teamId || ""}>
                          <option value="">None / Independent</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                       </Select>
                       <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                          <Button type="button" variant="ghost" onClick={() => setIsHostModalOpen(false)}>Cancel</Button>
                          <Button type="submit">Save Host</Button>
                       </div>
                    </form>
                 </Card>
              </div>
           )}

           {viewingHostId && viewingHost && viewingStats && (
              <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                 <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl animate-in fade-in zoom-in-95 overflow-hidden">
                    <div className="bg-red-600 p-6 text-white flex justify-between items-start">
                       <div>
                          <h2 className="text-3xl font-black">{viewingHost.name}</h2>
                          <div className="flex items-center gap-2 mt-1 opacity-90">
                             {viewingHost.teamId && <Badge color="gray" >{teams.find(t => t.id === viewingHost.teamId)?.name}</Badge>}
                             <span className="text-sm">{viewingHost.gender} {viewingHost.age ? `• ${viewingHost.age}yo` : ''}</span>
                          </div>
                       </div>
                       <button onClick={() => setViewingHostId(null)} className="text-white/80 hover:text-white bg-white/10 rounded-full p-1"><X className="w-6 h-6" /></button>
                    </div>
                    
                    <div className="grid grid-cols-2 border-b border-gray-200">
                       <div className="p-4 text-center border-r border-gray-200">
                          <div className="text-sm text-gray-500 font-bold uppercase">Games Hosted</div>
                          <div className="text-3xl font-black text-gray-900">{viewingStats.count}</div>
                       </div>
                       <div className="p-4 text-center">
                          <div className="text-sm text-gray-500 font-bold uppercase">Avg Rating</div>
                          <div className="text-3xl font-black text-yellow-500 flex justify-center items-center gap-2">
                             {viewingStats.avgRating} <Star className="w-5 h-5 fill-current" />
                          </div>
                       </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                       <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Team Comments</h3>
                       <div className="space-y-3">
                          {viewingStats.comments.length === 0 && <div className="text-gray-400 italic">No comments recorded yet.</div>}
                          {viewingStats.comments.map((c, i) => (
                             <div key={i} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                <div className="flex justify-between items-start mb-1">
                                   <span className="font-bold text-gray-900 text-sm">{c.team}</span>
                                   <span className="text-xs text-gray-400">{new Date(c.date).toLocaleDateString()}</span>
                                </div>
                                <p className="text-gray-600 text-sm">"{c.text}"</p>
                                <div className="mt-2 flex items-center gap-1">
                                   <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                   <span className="text-xs font-bold text-gray-500">{c.rating}/10</span>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 </Card>
              </div>
           )}

           {/* -- Main Content -- */}
           
           <Card title="Cloud Backend Sync" className="bg-blue-50 border-blue-100">
               <div className="space-y-3">
                   <p className="text-sm text-blue-800">
                        Use this to backup your data or load data from another device. 
                        Requires the Google Apps Script ID configured.
                   </p>
                   <div className="flex flex-col gap-3">
                       <Input 
                            placeholder="https://script.google.com/macros/s/..." 
                            value={sheetUrl} 
                            onChange={(e) => setSheetUrl(e.target.value)} 
                            className="bg-white"
                        />
                        <div className="flex gap-2">
                           <Button onClick={syncToCloud} disabled={isSyncing} icon={isSyncing ? RefreshCw : Cloud} className="flex-1">
                                {isSyncing ? "Saving..." : "Save to Cloud"}
                           </Button>
                           <Button onClick={loadFromCloud} disabled={isLoading} icon={isLoading ? RefreshCw : Download} variant="secondary" className="flex-1">
                                {isLoading ? "Loading..." : "Load from Cloud"}
                           </Button>
                       </div>
                   </div>
               </div>
           </Card>

           <div className="grid md:grid-cols-2 gap-6">
              <Card title="Hosts Dashboard" action={<Button onClick={() => { setEditingHostId(null); setIsHostModalOpen(true); }} icon={Plus} variant="secondary" className="text-xs">Add Host</Button>}>
                 <div className="space-y-3">
                    {hosts.map(h => {
                       const stats = getHostStats(h.id);
                       return (
                          <div key={h.id} className="flex justify-between items-center bg-white border border-gray-200 p-3 rounded-lg shadow-sm hover:shadow-md transition">
                             <div className="flex-1 cursor-pointer" onClick={() => setViewingHostId(h.id)}>
                                <div className="font-bold text-gray-900">{h.name}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                   <span className="bg-gray-100 px-1.5 py-0.5 rounded">Hosted: {stats.count}</span>
                                   <span className="flex items-center text-yellow-600"><Star className="w-3 h-3 mr-1 fill-current"/> {stats.avgRating}</span>
                                </div>
                             </div>
                             <div className="flex gap-1 ml-4">
                                <Button variant="ghost" className="p-2 h-auto" onClick={() => { setEditingHostId(h.id); setIsHostModalOpen(true); }}><Edit2 className="w-4 h-4" /></Button>
                                <Button variant="ghost" className="p-2 h-auto text-red-400 hover:text-red-600" onClick={() => setHosts(hosts.filter(x => x.id !== h.id))}><Trash2 className="w-4 h-4" /></Button>
                             </div>
                          </div>
                       );
                    })}
                    {hosts.length === 0 && <div className="text-center text-gray-400 py-4">No hosts added.</div>}
                 </div>
              </Card>

              <Card title="Manage Seasons">
                 <div className="flex gap-2 mb-4">
                    <Input value={newSeason} onChange={e => setNewSeason(e.target.value)} placeholder="New Season Name" />
                    <Button onClick={addSeason}>Add</Button>
                 </div>
                 <ul className="space-y-2">
                    {seasons.map(s => (
                       <li key={s.id} className={`flex justify-between items-center p-3 rounded border ${s.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
                          <div>
                             <span className="font-bold text-gray-900 block">{s.name}</span>
                             {s.isActive && <span className="text-xs font-bold text-green-600 uppercase tracking-wide">Active Season</span>}
                          </div>
                          {!s.isActive && (
                             <Button variant="ghost" className="text-xs" onClick={() => {
                                setSeasons(seasons.map(x => ({ ...x, isActive: x.id === s.id })));
                             }}>Set Active</Button>
                          )}
                       </li>
                    ))}
                 </ul>
              </Card>
           </div>
        </div>
     );
  }

  // --- Main Render ---

  if (activeGameId) {
    const game = games.find(g => g.id === activeGameId);
    if (game) {
      return (
         <LiveGame 
            game={game} 
            teams={teams} 
            hosts={hosts} 
            onUpdateGame={updateActiveGame} 
            onExit={() => setActiveGameId(null)} 
         />
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row text-gray-900 font-sans">
      {/* Sidebar Navigation (Desktop) */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col shadow-lg z-10 sticky top-0 h-screen">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-black text-gray-900 leading-tight tracking-tight">Trivia Nights <span className="text-red-600">Pinas</span> <span className="text-gray-400 block text-xs font-bold uppercase tracking-widest mt-1">Kabacan Scoring</span></h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={LayoutDashboard}>Royalty Dashboard</NavButton>
          <NavButton active={view === 'games'} onClick={() => setView('games')} icon={Calendar}>Games</NavButton>
          <NavButton active={view === 'teams'} onClick={() => setView('teams')} icon={Users}>Teams</NavButton>
          <NavButton active={view === 'setup'} onClick={() => setView('setup')} icon={Settings}>Seasons & Hosts</NavButton>
        </nav>

        <div className="p-4 border-t border-gray-100 text-xs text-gray-400 text-center font-medium">
          v1.5.2 • Google Cloud
        </div>
      </aside>

      {/* Mobile Header & Menu */}
      <div className="md:hidden">
          <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
            <span className="font-black text-gray-900 text-lg">TNP <span className="text-red-600">Kabacan</span></span>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600">
                {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </header>

          {isMobileMenuOpen && (
              <div className="fixed inset-0 z-20 bg-gray-900/50 pt-[72px]" onClick={() => setIsMobileMenuOpen(false)}>
                  <div className="bg-white p-4 shadow-xl rounded-b-xl" onClick={e => e.stopPropagation()}>
                      <nav className="space-y-2">
                        <NavButton active={view === 'dashboard'} onClick={() => navigate('dashboard')} icon={LayoutDashboard}>Royalty Dashboard</NavButton>
                        <NavButton active={view === 'games'} onClick={() => navigate('games')} icon={Calendar}>Games</NavButton>
                        <NavButton active={view === 'teams'} onClick={() => navigate('teams')} icon={Users}>Teams</NavButton>
                        <NavButton active={view === 'setup'} onClick={() => navigate('setup')} icon={Settings}>Seasons & Hosts</NavButton>
                      </nav>
                  </div>
              </div>
          )}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {view === 'dashboard' && <DashboardView />}
          {view === 'games' && <GamesView />}
          {view === 'teams' && <TeamsView />}
          {view === 'setup' && <SetupView />}
        </div>
      </main>
    </div>
  );
}

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: any; children: React.ReactNode }> = ({ active, onClick, icon: Icon, children }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center px-4 py-3 rounded-lg transition-all font-bold ${active ? 'bg-red-50 text-red-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
  >
    <Icon className={`w-5 h-5 mr-3 ${active ? 'text-red-600' : 'text-gray-400'}`} />
    <span>{children}</span>
  </button>
);

export default App;