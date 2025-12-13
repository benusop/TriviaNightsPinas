import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Game, Team, QuestionResult, CategoryType, GameFeedback, Host, ManualAdjustment } from '../types';
import { SETS_PER_GAME, CATEGORIES_PER_SET, QUESTIONS_PER_CATEGORY, saveData, calculateGameScores } from '../services/gameLogic';
import { Button, Card, Badge, Input, Select } from './UI';
import { Check, X, Users, RotateCcw, Save, Play, Plus, ChevronRight, Trophy, AlertTriangle, Pause, Settings, UserPlus, ClipboardList, Type, Image, Music, Box, Star, MessageSquare, RefreshCw, Download, Grid, ChevronLeft, Minus, ArrowRight, Gavel, MoreHorizontal } from 'lucide-react';
import html2canvas from 'html2canvas';

interface LiveGameProps {
  game: Game;
  teams: Team[];
  hosts: Host[];
  onUpdateGame: (game: Game) => void;
  onExit: () => void;
}

export const LiveGame: React.FC<LiveGameProps> = ({ game, teams, hosts, onUpdateGame, onExit }) => {
  const [currentSelection, setCurrentSelection] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'scorer' | 'scoreboard' | 'report' | 'feedback' | 'summary' | 'setSummary'>('scorer');
  const [isExiting, setIsExiting] = useState(false);
  
  // Adjustment Modal State
  const [adjustingTeamId, setAdjustingTeamId] = useState<string | null>(null);
  const [adjustmentPoints, setAdjustmentPoints] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  
  // Feedback State
  const [feedbackData, setFeedbackData] = useState<Record<string, GameFeedback>>({});

  // Points Management
  const [manualPoints, setManualPoints] = useState<number | null>(null);

  // Roster Management State
  const [showRoster, setShowRoster] = useState(false);
  const [rosterIds, setRosterIds] = useState<Set<string>>(new Set(game.participatingTeamIds));

  // Export State
  const summaryRef = useRef<HTMLDivElement>(null);
  const setSummaryRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Sync rosterIds if game prop changes externally
  useEffect(() => {
    setRosterIds(new Set(game.participatingTeamIds));
  }, [game.participatingTeamIds]);

  // Initial State Load for Archived Games
  useEffect(() => {
    if (game.status === 'Archived') {
        setViewMode('summary');
    }
  }, []);

  // Sync Selection with current stage
  const { set, category, question } = game.currentStage;
  useEffect(() => {
      // Find existing result for this stage
      const existingResult = game.results.find(r => r.setId === set && r.categoryId === category && r.questionIndex === question);
      
      if (existingResult) {
          setCurrentSelection(new Set(existingResult.correctTeamIds));
          setManualPoints(existingResult.points);
      } else {
          // New question
          setCurrentSelection(new Set());
          setManualPoints(null);
      }
  }, [set, category, question, game.results]);

  // Display Helpers
  const isBonusRound = set === SETS_PER_GAME; 
  const displayDate = new Date(game.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const displayTitle = game.type === 'Regular' ? `${displayDate} Regular Game` : game.title;
  
  // Config Keys
  const configKey = `${set}-${category}`;
  const categoryConfig = game.categoryConfigs?.[configKey] || { name: '', type: 'Text' };

  // Calculate Points Logic
  const currentPoints = manualPoints !== null ? manualPoints : (game.stickyPoints || 1);

  // Participating Teams
  const gameTeams = useMemo(() => 
    teams.filter(t => game.participatingTeamIds.includes(t.id)), 
  [teams, game.participatingTeamIds]);

  // Live Scores
  const scores = useMemo(() => calculateGameScores(game), [game]);
  const rankedTeams = useMemo(() => 
    gameTeams.sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)),
  [gameTeams, scores]);

  const toggleTeam = (teamId: string) => {
    const next = new Set(currentSelection);
    if (next.has(teamId)) next.delete(teamId);
    else next.add(teamId);
    setCurrentSelection(next);
  };

  const selectAll = () => setCurrentSelection(new Set(gameTeams.map(t => t.id)));
  const selectNone = () => setCurrentSelection(new Set());

  const handlePrevious = () => {
    let nextQ = question - 1;
    let nextCat = category;
    let nextSet = set;

    if (nextQ < 0) {
        nextQ = QUESTIONS_PER_CATEGORY - 1;
        nextCat--;
        if (nextCat < 0) {
            nextCat = CATEGORIES_PER_SET - 1;
            nextSet--;
        }
    }

    if (nextSet < 0) return; // Can't go back past start

    onUpdateGame({
        ...game,
        currentStage: { set: nextSet, category: nextCat, question: nextQ }
    });
  };

  const handleNext = () => {
    // 1. Create Result Object
    const result: QuestionResult = {
      setId: set,
      categoryId: category,
      questionIndex: question,
      correctTeamIds: Array.from(currentSelection),
      points: currentPoints
    };

    // 2. Update Results Array (Replace existing or Append new)
    const existingIndex = game.results.findIndex(r => r.setId === set && r.categoryId === category && r.questionIndex === question);
    let newResults = [...game.results];
    
    if (existingIndex >= 0) {
        newResults[existingIndex] = result;
    } else {
        newResults.push(result);
    }

    // 3. Determine Next Stage
    let nextSet = set;
    let nextCat = category;
    let nextQ = question + 1;

    if (nextQ >= QUESTIONS_PER_CATEGORY) {
      nextQ = 0;
      nextCat++;
      if (nextCat >= CATEGORIES_PER_SET) {
        nextCat = 0;
        nextSet++;
      }
    }

    // 4. Check for Set Transition Trigger
    const isEndOfSet = nextSet > set;

    const updatedGame: Game = {
      ...game,
      results: newResults,
      stickyPoints: currentPoints, // Persist points setting
      currentStage: { set: nextSet, category: nextCat, question: nextQ }
    };

    onUpdateGame(updatedGame);

    if (isEndOfSet) {
        setViewMode('setSummary');
    }
  };
  
  const openAdjustmentModal = (teamId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setAdjustingTeamId(teamId);
      setAdjustmentPoints(0);
      setAdjustmentReason('');
  }
  
  const saveAdjustment = () => {
      if (!adjustingTeamId) return;
      
      const newAdjustment: ManualAdjustment = {
          id: crypto.randomUUID(),
          teamId: adjustingTeamId,
          points: adjustmentPoints,
          setId: set, // Associate with current set
          reason: adjustmentReason,
          timestamp: new Date().toISOString()
      };
      
      onUpdateGame({
          ...game,
          manualAdjustments: [...(game.manualAdjustments || []), newAdjustment]
      });
      
      setAdjustingTeamId(null);
  }

  const updateCategoryConfig = (field: 'name' | 'type', value: string) => {
     const newConfigs = { ...game.categoryConfigs };
     newConfigs[configKey] = { ...categoryConfig, [field]: value };
     onUpdateGame({ ...game, categoryConfigs: newConfigs });
  };

  const startEndGameFlow = () => {
     setViewMode('summary');
  }

  const finalizeGame = () => {
    if (confirm("This will permanently archive the game and save all ratings. Continue?")) {
      setIsExiting(true);
      // Ensure all participating teams have a feedback entry, even if default
      const allFeedback: GameFeedback[] = gameTeams.map(team => {
          const entry = feedbackData[team.id];
          return {
              teamId: team.id,
              rating: entry?.rating || 10,
              remarks: entry?.remarks,
              memorableCategoryKey: entry?.memorableCategoryKey
          };
      });

      const updatedGame: Game = {
        ...game,
        status: 'Archived',
        feedback: allFeedback
      };
      
      // Update state first
      onUpdateGame(updatedGame);
      
      // Small delay to ensure state propagates before unmounting
      setTimeout(() => {
        onExit();
      }, 100);
    }
  };

  const exportElementAsPng = async (element: HTMLElement | null, fileName: string) => {
    if (element) {
        setIsExporting(true);
        try {
            const canvas = await html2canvas(element, {
                scale: 2, 
                backgroundColor: '#ffffff',
                useCORS: true
            });
            const link = document.createElement('a');
            link.download = fileName;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Export failed', error);
            alert('Failed to export image.');
        } finally {
            setIsExporting(false);
        }
    }
  };

  // Feedback helpers
  const updateFeedback = (teamId: string, field: keyof GameFeedback, value: any) => {
     setFeedbackData(prev => ({
        ...prev,
        [teamId]: {
           teamId,
           rating: 10, // Default if starting fresh
           ...(prev[teamId] || {}),
           [field]: value
        }
     }));
  };

  const saveRoster = () => {
     const updatedGame: Game = {
        ...game,
        participatingTeamIds: Array.from(rosterIds)
     };
     onUpdateGame(updatedGame);
     setShowRoster(false);
  };

  const toggleRosterTeam = (id: string) => {
     const next = new Set(rosterIds);
     if(next.has(id)) next.delete(id);
     else next.add(id);
     setRosterIds(next);
  }

  const isGameOver = !game.hasBonusRound && set >= SETS_PER_GAME || (game.hasBonusRound && set > SETS_PER_GAME);

  // --- Roster Modal ---
  if (showRoster) {
     return (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
           <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" title="Manage Game Roster" noPadding>
              <div className="p-4 border-b border-gray-200 bg-gray-50 text-sm text-gray-600">
                 Select teams participating in this game.
              </div>
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {teams.filter(t => !t.isArchived || rosterIds.has(t.id)).map(team => {
                    const isSelected = rosterIds.has(team.id);
                    return (
                       <button
                          key={team.id}
                          onClick={() => toggleRosterTeam(team.id)}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                             isSelected 
                                ? 'bg-red-50 border-red-500 text-red-900' 
                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                          }`}
                       >
                          <div className="flex flex-col text-left">
                             <span className="font-bold">{team.name}</span>
                             <span className="text-xs opacity-70">{team.leader}</span>
                          </div>
                          {isSelected ? <Check className="w-5 h-5 text-red-600" /> : <Plus className="w-5 h-5" />}
                       </button>
                    );
                 })}
              </div>
              <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
                 <Button variant="ghost" onClick={() => setShowRoster(false)}>Cancel</Button>
                 <Button onClick={saveRoster}>Save Roster</Button>
              </div>
           </Card>
        </div>
     );
  }
  
  // --- Adjustment Modal ---
  const adjustmentModal = adjustingTeamId ? (
      <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
         <Card title={`Adjust Points: ${teams.find(t => t.id === adjustingTeamId)?.name}`} className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
             <div className="space-y-4">
                 <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                     Add bonus points (positive) or penalties (negative). These will be added to the total score.
                 </div>
                 <div>
                     <label className="block text-sm font-semibold text-gray-700 mb-1">Points to Add/Deduct</label>
                     <div className="flex items-center gap-2">
                         <button onClick={() => setAdjustmentPoints(p => p - 1)} className="p-2 bg-gray-100 rounded hover:bg-gray-200 border border-gray-300"><Minus className="w-4 h-4"/></button>
                         <input 
                            type="number" 
                            className="flex-1 text-center font-bold text-2xl border border-gray-300 rounded py-2 bg-white text-gray-900 shadow-sm"
                            value={adjustmentPoints}
                            onChange={e => setAdjustmentPoints(parseInt(e.target.value) || 0)}
                         />
                         <button onClick={() => setAdjustmentPoints(p => p + 1)} className="p-2 bg-gray-100 rounded hover:bg-gray-200 border border-gray-300"><Plus className="w-4 h-4"/></button>
                     </div>
                 </div>
                 <Input label="Reason (Optional)" placeholder="e.g. Best Costume, Late Penalty" value={adjustmentReason} onChange={e => setAdjustmentReason(e.target.value)} />
                 
                 <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                     <Button variant="ghost" onClick={() => setAdjustingTeamId(null)}>Cancel</Button>
                     <Button onClick={saveAdjustment}>Save Adjustment</Button>
                 </div>
             </div>
         </Card>
      </div>
  ) : null;

  // Resolve Host Names for summaries
  const hostNames = game.hostIds && game.hostIds.length > 0 
                ? game.hostIds.map(hid => hosts.find(h => h.id === hid)?.name || 'Unknown').join(', ')
                : 'TNP Kabacan Team';

  // --- Set Summary View ---
  if (viewMode === 'setSummary') {
      const setJustFinished = set - 1; // because set is already incremented in handleNext
      // Build columns: Set 1 ... Set JustFinished, Total
      const setsToShow = Array.from({length: setJustFinished + 1}, (_, i) => i);
      
      const setSummaryData = rankedTeams.map(team => {
          const setScores: number[] = [];
          let total = 0;
          setsToShow.forEach(sId => {
              const setResults = game.results.filter(r => r.setId === sId);
              let sScore = 0;
              setResults.forEach(r => {
                 if(r.correctTeamIds.includes(team.id)) sScore += r.points;
              });
              
              // Add manual adjustments for this set
              const adjPoints = (game.manualAdjustments || [])
                  .filter(a => a.setId === sId && a.teamId === team.id)
                  .reduce((sum, a) => sum + a.points, 0);
              
              sScore += adjPoints;

              setScores.push(sScore);
              total += sScore;
          });
          return { team, setScores, total };
      });

      const title = setJustFinished === SETS_PER_GAME ? "Bonus Round" : `Set ${setJustFinished + 1}`;

      return (
         <div className="h-full flex flex-col p-4 md:p-6 max-w-7xl mx-auto w-full pb-24">
             <div className="flex justify-between items-center mb-6">
                 <h2 className="text-2xl font-bold text-gray-900">Set Summary: {title}</h2>
                 <div className="flex gap-2">
                     <Button onClick={() => exportElementAsPng(setSummaryRef.current, `${game.title}_Set${setJustFinished+1}_Summary.png`)} disabled={isExporting} icon={Download}>
                        {isExporting ? "Exporting..." : "Download PNG"}
                     </Button>
                     <Button variant="success" onClick={() => setViewMode('scorer')} icon={ArrowRight}>Continue to Next Set</Button>
                 </div>
             </div>

             <div className="overflow-auto bg-gray-200 p-4 rounded-xl border border-gray-300">
                <div ref={setSummaryRef} className="bg-white p-8 rounded-xl shadow-sm min-w-[600px] text-gray-900">
                   <div className="text-center mb-6 border-b-2 border-red-600 pb-4">
                      <div className="flex justify-center items-center gap-2 mb-2">
                           <div className="text-2xl font-black text-gray-900 tracking-tight">Trivia Nights <span className="text-red-600">Pinas</span></div>
                      </div>
                      <h2 className="text-3xl font-black text-gray-900 uppercase">{title} Standings</h2>
                      <p className="text-gray-500">{displayTitle}</p>
                   </div>
                   
                   <table className="w-full text-left">
                       <thead>
                           <tr className="border-b-2 border-gray-800">
                               <th className="py-2 px-2 text-sm font-black uppercase text-gray-600 w-16 text-center">Rank</th>
                               <th className="py-2 px-2 text-sm font-black uppercase text-gray-600">Team</th>
                               {setsToShow.map(i => (
                                   <th key={i} className="py-2 px-2 text-sm font-black uppercase text-gray-600 text-center">
                                       {i === SETS_PER_GAME ? 'Bonus' : `Set ${i+1}`}
                                    </th>
                                ))}
                               <th className="py-2 px-2 text-sm font-black uppercase text-red-600 text-right w-24">Total</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                           {setSummaryData.map((row, idx) => (
                               <tr key={row.team.id} className={idx < 3 ? 'bg-yellow-50/30' : ''}>
                                   <td className="py-3 px-2 text-center font-bold text-gray-500">#{idx+1}</td>
                                   <td className="py-3 px-2 font-bold text-lg">{row.team.name}</td>
                                   {row.setScores.map((s, i) => (
                                       <td key={i} className="py-3 px-2 text-center font-medium text-gray-600">{s}</td>
                                   ))}
                                   <td className="py-3 px-2 text-right font-black text-2xl text-red-600">{row.total}</td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
                </div>
             </div>
         </div>
      );
  }

  // --- Final Summary View ---
  if (viewMode === 'summary') {
     const setIndices = Array.from({length: SETS_PER_GAME + (game.hasBonusRound ? 1 : 0)}, (_, i) => i);
     
     // Calculate scores per set per team
     const tableData = rankedTeams.map(team => {
         const setScores: number[] = [];
         let total = 0;
         
         setIndices.forEach(setId => {
             const setResults = game.results.filter(r => r.setId === setId);
             let setScore = 0;
             setResults.forEach(r => {
                 if (r.correctTeamIds.includes(team.id)) {
                     setScore += r.points;
                 }
             });

             // Add manual adjustments for this set
             const adjPoints = (game.manualAdjustments || [])
                  .filter(a => a.setId === setId && a.teamId === team.id)
                  .reduce((sum, a) => sum + a.points, 0);
             setScore += adjPoints;

             setScores.push(setScore);
             total += setScore;
         });
         return { team, setScores, total };
     });
     
     return (
        <div className="h-full flex flex-col p-4 md:p-6 max-w-7xl mx-auto w-full pb-24">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Official Game Summary</h2>
                <div className="flex gap-2">
                    {game.status !== 'Archived' && (
                        <Button onClick={() => setViewMode('scorer')} variant="ghost" icon={RotateCcw}>Back</Button>
                    )}
                    <Button onClick={() => exportElementAsPng(summaryRef.current, `${game.title}_FinalSummary.png`)} disabled={isExporting} icon={Download}>
                        {isExporting ? "Exporting..." : "Download PNG"}
                    </Button>
                    <Button onClick={() => setViewMode('feedback')} icon={MessageSquare}>Next: Feedback</Button>
                </div>
             </div>

             <div className="overflow-auto bg-gray-200 p-4 rounded-xl border border-gray-300">
                {/* Printable Area */}
                <div ref={summaryRef} className="bg-white p-8 rounded-xl shadow-sm min-w-[800px] text-gray-900">
                    <div className="text-center mb-8 border-b-2 border-red-600 pb-4">
                        {/* Logo Area */}
                        <div className="flex justify-center items-center gap-2 mb-4">
                           <div className="text-3xl font-black text-gray-900 tracking-tight">
                              Trivia Nights <span className="text-red-600">Pinas</span>
                           </div>
                        </div>
                        
                        <h1 className="text-4xl font-black text-gray-900 uppercase tracking-tight mb-2">{displayTitle}</h1>
                        <p className="text-gray-500 font-medium mb-1">{displayDate}</p>
                        <p className="text-gray-700 font-bold text-lg">Hosted by {hostNames}</p>
                    </div>

                    <table className="w-full text-left mb-8">
                        <thead>
                            <tr className="border-b-2 border-gray-800">
                                <th className="py-3 px-2 text-sm font-black uppercase text-gray-600 w-16 text-center">Rank</th>
                                <th className="py-3 px-2 text-sm font-black uppercase text-gray-600">Team Name</th>
                                {setIndices.map(i => (
                                    <th key={i} className="py-3 px-2 text-sm font-black uppercase text-gray-600 text-center">
                                        {i === SETS_PER_GAME ? 'Bonus' : `Set ${i+1}`}
                                    </th>
                                ))}
                                <th className="py-3 px-2 text-sm font-black uppercase text-red-600 text-right w-24">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {tableData.map((row, idx) => (
                                <tr key={row.team.id} className={idx < 3 ? 'bg-yellow-50/30' : ''}>
                                    <td className="py-4 px-2 text-center font-bold text-gray-500">
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`}
                                    </td>
                                    <td className="py-4 px-2 font-bold text-lg">{row.team.name}</td>
                                    {row.setScores.map((score, i) => (
                                        <td key={i} className="py-4 px-2 text-center font-medium text-gray-600">
                                            {score}
                                        </td>
                                    ))}
                                    <td className="py-4 px-2 text-right font-black text-2xl text-red-600">{row.total}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {/* Game Matrix / Visual Check Marks */}
                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <h3 className="text-sm font-bold uppercase text-gray-500 mb-4 flex items-center gap-2">
                            <Grid className="w-4 h-4" /> Performance Matrix
                        </h3>
                        <div className="space-y-3">
                            {rankedTeams.map(team => (
                                <div key={team.id} className="flex items-center gap-4">
                                    <div className="w-32 text-xs font-bold text-gray-600 truncate text-right">{team.name}</div>
                                    <div className="flex-1 flex flex-wrap gap-0.5">
                                        {game.results.map((res, i) => {
                                            const isCorrect = res.correctTeamIds.includes(team.id);
                                            // Optional: Add separate between sets visually
                                            const isNewSet = i > 0 && res.setId !== game.results[i-1].setId;
                                            return (
                                                <div key={i} className={`flex ${isNewSet ? 'ml-1' : ''}`}>
                                                    <div 
                                                        className={`w-2 h-4 md:w-3 md:h-5 rounded-[1px] ${isCorrect ? 'bg-green-500' : 'bg-gray-200'}`} 
                                                        title={`Q${i+1}: ${isCorrect ? 'Correct' : 'Wrong'}`}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="w-16 text-right text-xs font-medium text-gray-400">
                                        {Math.round((game.results.filter(r => r.correctTeamIds.includes(team.id)).length / game.results.length) * 100)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex justify-end gap-4 text-[10px] text-gray-400 uppercase font-bold">
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-[1px]"></div> Correct</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-200 rounded-[1px]"></div> Wrong</div>
                        </div>
                    </div>
                </div>
             </div>
        </div>
     );
  }

  // --- Feedback View ---
  if (viewMode === 'feedback') {
      // Get all played categories for the dropdown
      const playedCategories: {key: string, label: string}[] = [];
      const maxSet = game.hasBonusRound ? SETS_PER_GAME + 1 : SETS_PER_GAME;
      for(let s = 0; s < maxSet; s++) {
          for(let c = 0; c < CATEGORIES_PER_SET; c++) {
              const key = `${s}-${c}`;
              const cfg = game.categoryConfigs[key];
              // Only include if it has a custom name or we just use default
              const label = cfg?.name ? `S${s+1}-C${c+1}: ${cfg.name}` : `Set ${s+1} Category ${c+1}`;
              playedCategories.push({ key, label });
          }
      }

      return (
         <div className="h-full flex flex-col p-4 md:p-6 max-w-5xl mx-auto w-full pb-24">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Post-Game Feedback</h2>
            <p className="text-gray-500 mb-6">Please collect ratings and feedback from each team regarding the Host(s) and their favorite categories.</p>
            
            <div className="space-y-4">
                {gameTeams.map(team => {
                   const fb = feedbackData[team.id] || { teamId: team.id, rating: 10 };
                   return (
                       <Card key={team.id} className="p-4">
                           <h3 className="font-bold text-lg mb-3">{team.name}</h3>
                           <div className="grid md:grid-cols-2 gap-4">
                               <div>
                                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Host(s) Rating (1-10)</label>
                                   <div className="flex items-center gap-3">
                                       <input 
                                          type="range" min="1" max="10" step="1" 
                                          value={fb.rating} 
                                          onChange={(e) => updateFeedback(team.id, 'rating', parseInt(e.target.value))}
                                          className="flex-1"
                                       />
                                       <span className="font-bold text-xl w-8 text-center">{fb.rating}</span>
                                   </div>
                               </div>
                               <div>
                                   <Input 
                                      label="Host(s) Remarks (Optional)" 
                                      placeholder="Any comments for the hosts..." 
                                      value={fb.remarks || ''}
                                      onChange={(e) => updateFeedback(team.id, 'remarks', e.target.value)}
                                   />
                               </div>
                               <div className="md:col-span-2">
                                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Memorable Category</label>
                                   <select 
                                       className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2"
                                       value={fb.memorableCategoryKey || ''}
                                       onChange={(e) => updateFeedback(team.id, 'memorableCategoryKey', e.target.value)}
                                   >
                                       <option value="">-- Select Category --</option>
                                       {playedCategories.map(pc => (
                                           <option key={pc.key} value={pc.key}>{pc.label}</option>
                                       ))}
                                   </select>
                               </div>
                           </div>
                       </Card>
                   )
                })}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-50 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setViewMode('summary')} disabled={isExiting}>Back to Summary</Button>
                {game.status !== 'Archived' && (
                    <Button variant="success" onClick={finalizeGame} disabled={isExiting} icon={isExiting ? RefreshCw : Check}>
                        {isExiting ? "Saving..." : "Finalize & Archive Game"}
                    </Button>
                )}
                {game.status === 'Archived' && (
                     <Button variant="ghost" onClick={onExit} icon={X}>Close</Button>
                )}
            </div>
         </div>
      );
  }

  // --- Reports/Scoreboard/GameOver/Scorer ---
  
  if (viewMode === 'report') {
    return (
      <div className="h-full flex flex-col p-4 md:p-6 max-w-7xl mx-auto w-full">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
               <ClipboardList className="text-red-600 w-8 h-8" /> Game Report
            </h2>
            <Button onClick={() => setViewMode('scorer')} icon={RotateCcw}>Back to Scoring</Button>
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card title="Category Performance">
               <div className="space-y-4">
                  {Array.from({length: SETS_PER_GAME + (game.hasBonusRound ? 1 : 0)}).map((_, sIdx) => (
                     <div key={sIdx}>
                        <h4 className="font-bold text-gray-500 text-xs uppercase mb-2">Set {sIdx + 1}</h4>
                        <div className="grid gap-2">
                           {Array.from({length: CATEGORIES_PER_SET}).map((_, cIdx) => {
                              const key = `${sIdx}-${cIdx}`;
                              const config = game.categoryConfigs?.[key] || { name: `Category ${cIdx+1}`, type: 'Text' };
                              // Calculate stats
                              const catResults = game.results.filter(r => r.setId === sIdx && r.categoryId === cIdx);
                              if (catResults.length === 0) return null;
                              
                              let totalCorrect = 0;
                              let totalPossible = catResults.length * gameTeams.length;
                              catResults.forEach(r => totalCorrect += r.correctTeamIds.length);
                              
                              const pct = totalPossible > 0 ? Math.round((totalCorrect / totalPossible) * 100) : 0;
                              
                              return (
                                 <div key={cIdx} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                                    <div className="flex items-center gap-2">
                                       <Badge color="gray">{config.type}</Badge>
                                       <span className="font-medium">{config.name || `Category ${cIdx+1}`}</span>
                                    </div>
                                    <div className="text-right">
                                       <span className={`font-bold ${pct > 70 ? 'text-green-600' : pct < 30 ? 'text-red-600' : 'text-yellow-600'}`}>{pct}% Correct</span>
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  ))}
               </div>
            </Card>
            
            <Card title="Team Standings Summary">
               <div className="overflow-y-auto max-h-[500px]">
                  <table className="w-full text-sm">
                     <thead className="bg-gray-100 sticky top-0">
                        <tr>
                           <th className="p-2 text-left">Rank</th>
                           <th className="p-2 text-left">Team</th>
                           <th className="p-2 text-right">Score</th>
                        </tr>
                     </thead>
                     <tbody>
                        {rankedTeams.map((t, i) => (
                           <tr key={t.id} className="border-b border-gray-100">
                              <td className="p-2 font-bold text-gray-500">#{i+1}</td>
                              <td className="p-2 font-medium">{t.name}</td>
                              <td className="p-2 text-right font-bold text-red-600">{scores[t.id]}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </Card>
         </div>
      </div>
    );
  }

  if (viewMode === 'scoreboard') {
    return (
      <div className="h-full flex flex-col p-4 md:p-6 max-w-6xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Trophy className="text-yellow-500 w-8 h-8" /> Live Scoreboard
          </h2>
          <Button onClick={() => setViewMode('scorer')} icon={RotateCcw}>Back to Scoring</Button>
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {rankedTeams.map((team, idx) => (
            <div key={team.id} className={`relative overflow-hidden p-6 rounded-xl border-2 shadow-sm ${idx < 3 ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex justify-between items-start z-10 relative">
                <div>
                  <div className="text-5xl font-black text-gray-900 mb-2">{scores[team.id]}</div>
                  <div className="text-lg text-gray-600 font-bold truncate w-full">{team.name}</div>
                </div>
                <div className={`text-3xl font-black ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-700' : 'text-gray-300'}`}>
                  #{idx + 1}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isGameOver) {
    return (
      <Card className="max-w-md mx-auto mt-10 text-center p-10">
        <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Game Finished!</h2>
        <p className="text-gray-500 mb-6">All sets and questions have been completed.</p>
        <div className="space-y-3">
           <Button onClick={() => setViewMode('summary')} variant="primary" className="w-full">View Final Summary</Button>
           <Button onClick={() => setViewMode('report')} variant="secondary" className="w-full">View Stats Report</Button>
           
           <div className="pt-4 border-t border-gray-100 grid grid-cols-1 gap-2">
               {!game.hasBonusRound && (
                   <Button 
                       onClick={() => onUpdateGame({...game, hasBonusRound: true})} 
                       variant="success" 
                       className="w-full"
                       icon={Plus}
                   >
                       Add Bonus Round
                   </Button>
               )}
               <Button 
                   onClick={() => {
                       const prevSet = set - 1;
                       const prevCat = CATEGORIES_PER_SET - 1;
                       const prevQ = QUESTIONS_PER_CATEGORY - 1;
                       onUpdateGame({
                           ...game,
                           currentStage: { set: prevSet, category: prevCat, question: prevQ }
                       });
                   }} 
                   variant="ghost" 
                   className="w-full"
                   icon={RotateCcw}
               >
                   Back to Scoring
               </Button>
           </div>
        </div>
      </Card>
    );
  }

  // --- Standard Scorer View ---
  
  const TypeIcon = {
     'Text': Type,
     'Picture': Image,
     'Audio': Music,
     'Others': Box
  }[categoryConfig.type];

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto p-2 md:p-6 w-full gap-4 md:gap-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6">
         <div className="flex-1 w-full">
            <div className="flex items-center justify-between md:justify-start gap-2 mb-2">
               <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">{displayTitle}</span>
               {game.stickyPoints && <span className="text-xs text-gray-400">Pts: {game.stickyPoints}</span>}
            </div>
            
            {/* Updated Header Format */}
            <div className="flex items-baseline justify-between md:justify-start gap-1 md:gap-4 text-gray-900 flex-wrap">
               <div className="flex flex-col">
                  <span className="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-widest">Set</span>
                  <span className="text-3xl md:text-5xl font-black tracking-tighter text-red-600">
                     {isBonusRound ? "BONUS" : set + 1}
                  </span>
               </div>
               <span className="text-3xl font-thin text-gray-300">/</span>
               <div className="flex flex-col">
                  <span className="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-widest">Category</span>
                  <span className="text-3xl md:text-5xl font-black tracking-tighter text-gray-800">
                     {category + 1}
                  </span>
               </div>
               <span className="text-3xl font-thin text-gray-300">/</span>
               <div className="flex flex-col">
                  <span className="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-widest">Question</span>
                  <span className="text-3xl md:text-5xl font-black tracking-tighter text-gray-800">
                     #{question + 1}
                  </span>
               </div>

               <div className="md:hidden ml-auto flex flex-col items-end">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Points</span>
                    <input 
                         type="number"
                         value={currentPoints}
                         onChange={(e) => setManualPoints(parseInt(e.target.value) || 0)}
                         className="w-20 text-3xl font-black text-right bg-transparent border-b-2 border-red-200 focus:border-red-500 outline-none text-red-600 p-0"
                    />
               </div>
            </div>
         </div>

         {/* Category Configuration Box */}
         <div className="w-full md:w-auto bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-col gap-2 min-w-[280px]">
            <div className="flex items-center gap-2 mb-1">
               <TypeIcon className="w-4 h-4 text-red-500" />
               <span className="text-xs font-bold text-gray-500 uppercase">Category {category + 1} Settings</span>
            </div>
            <div className="flex gap-2">
               <Input 
                  placeholder="Name" 
                  value={categoryConfig.name} 
                  onChange={(e) => updateCategoryConfig('name', e.target.value)}
                  className="bg-white text-sm"
               />
               <select 
                  className="bg-white border border-gray-300 rounded-lg px-2 py-2 text-sm focus:ring-red-500 outline-none"
                  value={categoryConfig.type}
                  onChange={(e) => updateCategoryConfig('type', e.target.value as CategoryType)}
               >
                  <option value="Text">Text</option>
                  <option value="Picture">Pic</option>
                  <option value="Audio">Audio</option>
                  <option value="Others">Other</option>
               </select>
            </div>
         </div>
         
         {/* Top Controls - End Game moved here */}
         <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
            <Button variant="secondary" className="flex-1 md:flex-none text-xs" onClick={() => setShowRoster(true)} icon={UserPlus}>Roster</Button>
            <Button variant="secondary" className="flex-1 md:flex-none text-xs" onClick={() => setViewMode('report')} icon={ClipboardList}>Report</Button>
            <Button variant="secondary" className="flex-1 md:flex-none text-xs" onClick={() => setViewMode('scoreboard')} icon={Trophy}>Scores</Button>
            <Button variant="danger" className="flex-1 md:flex-none text-xs" onClick={startEndGameFlow} icon={Check}>End Game</Button>
            <Button variant="secondary" className="flex-1 md:flex-none text-xs" onClick={onExit} icon={Pause}>Pause</Button>
         </div>
      </div>

      {/* Main Scorer Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
         
         {/* Left: Score & Selection Controls */}
         <div className="lg:col-span-1 space-y-4">
             <Card title="Result Controls" className="h-full hidden md:block">
                <div className="flex flex-col gap-4">
                   <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                      <label className="text-xs font-bold text-red-800 uppercase block mb-2">Points for this Question</label>
                      <div className="flex items-center justify-between gap-2">
                          <button onClick={() => setManualPoints(currentPoints - 1)} className="w-10 h-10 flex items-center justify-center bg-white rounded-lg border border-red-200 hover:bg-red-100 text-red-600 shadow-sm transition-colors"><Minus className="w-5 h-5" /></button>
                          <div className="flex-1 min-w-0">
                             <input 
                                type="number"
                                value={currentPoints}
                                onChange={(e) => setManualPoints(parseInt(e.target.value) || 0)}
                                className="w-full text-3xl font-black text-center bg-white border-2 border-red-200 rounded-lg py-2 focus:border-red-500 outline-none text-red-600 shadow-inner"
                             />
                          </div>
                          <button onClick={() => setManualPoints(currentPoints + 1)} className="w-10 h-10 flex items-center justify-center bg-white rounded-lg border border-red-200 hover:bg-red-100 text-red-600 shadow-sm transition-colors"><Plus className="w-5 h-5" /></button>
                      </div>
                      <p className="text-[10px] text-red-400 mt-2 leading-tight">Adjusting this updates the current question score.</p>
                   </div>

                   <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="h-14 text-xs font-bold flex-col gap-1 border-gray-200" onClick={selectAll}>
                         <Check className="w-5 h-5 text-green-600" />
                         Everyone Correct
                      </Button>
                      <Button variant="secondary" className="h-14 text-xs font-bold flex-col gap-1 border-gray-200" onClick={selectNone}>
                         <X className="w-5 h-5 text-red-600" />
                         No One Correct
                      </Button>
                   </div>
                </div>
             </Card>

             <div className="grid grid-cols-2 gap-2 md:hidden">
                  <Button variant="secondary" className="h-12 text-xs font-bold flex-row gap-2 border-gray-200 bg-white" onClick={selectAll}>
                      <Check className="w-4 h-4 text-green-600" /> All Correct
                  </Button>
                  <Button variant="secondary" className="h-12 text-xs font-bold flex-row gap-2 border-gray-200 bg-white" onClick={selectNone}>
                      <X className="w-4 h-4 text-red-600" /> No One
                  </Button>
             </div>
         </div>

         {/* Right: Team Grid */}
         <div className="lg:col-span-3 flex flex-col h-full">
            <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 flex-1 shadow-sm">
               <div className="flex justify-between items-center mb-4 md:mb-6">
                 <div>
                    <h3 className="text-gray-800 text-lg font-bold">Participating Teams</h3>
                    <p className="text-gray-500 text-xs md:text-sm">Select teams that answered correctly.</p>
                 </div>
                 <Badge color="blue">{gameTeams.length} Active</Badge>
               </div>
               
               {gameTeams.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                     <Users className="w-8 h-8 md:w-12 md:h-12 text-gray-300 mb-4" />
                     <p className="text-gray-500 font-medium mb-4 text-sm">No teams in roster yet.</p>
                     <Button onClick={() => setShowRoster(true)} icon={UserPlus}>Add Teams</Button>
                  </div>
               ) : (
                 <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-4 pb-20 md:pb-0">
                    {gameTeams.map(team => {
                       const isSelected = currentSelection.has(team.id);
                       return (
                          <button
                             key={team.id}
                             onClick={() => toggleTeam(team.id)}
                             className={`p-2 md:p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center text-center h-24 md:h-28 relative group ${
                                isSelected 
                                   ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-200 scale-[1.02]' 
                                   : 'bg-white border-gray-100 text-gray-600 hover:border-red-200 hover:shadow-md'
                             }`}
                          >
                             {isSelected && <div className="absolute top-1 right-1 md:top-2 md:right-2 bg-white/20 rounded-full p-1"><Check className="w-3 h-3 md:w-4 md:h-4 text-white" /></div>}
                             <div className="absolute top-1 left-1 md:top-2 md:left-2" onClick={(e) => openAdjustmentModal(team.id, e)}>
                                 <div className="bg-gray-100 hover:bg-gray-200 rounded-full p-1 text-gray-500" title="Adjust Points">
                                     <MoreHorizontal className="w-3 h-3 md:w-4 md:h-4" />
                                 </div>
                             </div>
                             
                             <span className={`font-bold text-sm md:text-lg leading-tight line-clamp-2 ${isSelected ? 'text-white' : 'text-gray-800'}`}>{team.name}</span>
                             <span className={`text-[10px] md:text-xs mt-1 font-medium ${isSelected ? 'text-red-100' : 'text-gray-400'}`}>{scores[team.id] || 0} pts</span>
                          </button>
                       )
                    })}
                 </div>
               )}
            </div>
         </div>

      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur border-t border-gray-200 md:relative md:bg-transparent md:border-none md:p-0 z-40">
          <div className="flex gap-2">
             <Button 
                className="flex-1 py-3 md:py-4 shadow-sm border-gray-200" 
                variant="secondary"
                onClick={handlePrevious}
                disabled={set === 0 && category === 0 && question === 0}
                icon={ChevronLeft}
             >
                Prev
             </Button>
             <Button 
                className="flex-[3] py-3 md:py-4 text-lg shadow-lg shadow-red-200" 
                onClick={handleNext}
                disabled={gameTeams.length === 0}
             >
                Next Question
             </Button>
          </div>
      </div>
      
      {adjustmentModal}
    </div>
  );
};