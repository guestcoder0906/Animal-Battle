import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Game } from './components/Game';
import { gameReducer, createPlayer } from './services/gameEngine';
import { GameState, GameAction, Habitat } from './types';
import { getRandomElement } from './constants';
import { computeAiActions, computeReaction } from './services/aiLogic';

const App: React.FC = () => {
  const [status, setStatus] = useState<'menu' | 'rules' | 'playing'>('menu');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [myName, setMyName] = useState('Player');
  
  // AI Mode State
  const aiTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAction = useCallback((action: GameAction) => {
    setGameState(prevState => {
      if (!prevState && action.type !== 'INIT_GAME') return null;
      
      if (action.type === 'INIT_GAME') return action.payload;
      if (action.type === 'UPDATE_STATE') return action.payload;
      
      // JOIN_GAME is no longer relevant in single player
      if (action.type === 'JOIN_GAME') return prevState;

      const newState = gameReducer(prevState!, action);
      return newState;
    });
  }, []);

  const dispatch = (action: GameAction) => {
    handleAction(action);
  };

  // --- AI Logic Effect ---
  useEffect(() => {
    if (!gameState || !gameState.currentPlayer || gameState.winner) return;
    
    const aiId = 'ai-bot';
    
    // Check for Pending Reaction Target = AI
    if (gameState.pendingReaction && gameState.pendingReaction.targetId === aiId) {
        // AI needs to react
        if (aiTurnTimeoutRef.current) clearTimeout(aiTurnTimeoutRef.current);
        aiTurnTimeoutRef.current = setTimeout(() => {
            const reaction = computeReaction(gameState, aiId);
            if (reaction) dispatch(reaction);
        }, 1000); // Delay reaction for UI effect
        return;
    }

    if (gameState.currentPlayer === aiId && gameState.phase !== 'end' && !gameState.pendingReaction) {
      // It's AI's turn
      if (aiTurnTimeoutRef.current) clearTimeout(aiTurnTimeoutRef.current);
      
      aiTurnTimeoutRef.current = setTimeout(() => {
        const actions = computeAiActions(gameState, aiId);
        
        let i = 0;
        const executeNext = () => {
          if (i < actions.length) {
             dispatch(actions[i]);
             i++;
             if (i < actions.length) {
                aiTurnTimeoutRef.current = setTimeout(executeNext, 1500);
             }
          }
        };
        executeNext();
      }, 1000);
    }

    return () => {
      if (aiTurnTimeoutRef.current) clearTimeout(aiTurnTimeoutRef.current);
    };
  }, [gameState?.currentPlayer, gameState?.turn, gameState?.pendingReaction]); 

  const prepareGame = () => {
    const myId = 'local-player';
    const aiId = 'ai-bot';
    setPlayerId(myId);

    const habitats = [Habitat.Forest, Habitat.Desert, Habitat.Water, Habitat.Arena];
    const p1 = createPlayer(myId, myName || "Player");
    const p2 = createPlayer(aiId, "AI Opponent");
    
    const initialState: GameState = {
      gameId: 'local-ai-game',
      habitat: getRandomElement(habitats),
      turn: 1,
      currentPlayer: myId, 
      players: { [p1.id]: p1, [p2.id]: p2 },
      log: ["Game Started vs AI!", `Habitat: ${habitats[0]}`, "Good luck!"],
      winner: null,
      phase: 'start',
      activeCoinFlip: null,
      pendingReaction: null,
      pendingChoice: null,
      notifications: []
    };

    // 50% chance for AI to go first
    if (Math.random() > 0.5) {
      initialState.currentPlayer = aiId;
      initialState.log.push("AI goes first!");
    } else {
      initialState.log.push("You go first!");
    }

    dispatch({ type: 'INIT_GAME', payload: initialState });
    setStatus('rules');
  };

  const confirmStart = () => {
    setStatus('playing');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-900 text-white p-4">
      {status === 'menu' && (
        <div className="max-w-md w-full p-8 bg-stone-800 rounded-lg shadow-2xl border border-stone-700">
          <h1 className="text-4xl font-bold text-center mb-8 text-amber-500">Creature Clash</h1>
          
          <input 
            type="text" 
            placeholder="Your Name"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            className="w-full mb-8 px-4 py-3 bg-black rounded border border-stone-600 text-white text-lg text-center focus:border-amber-500 outline-none"
          />

          <button 
            onClick={prepareGame} 
            className="w-full py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-lg font-black text-xl shadow-lg transition transform hover:scale-105 active:scale-95 border-b-4 border-orange-800"
          >
            PLAY GAME
          </button>
          
          <div className="mt-6 text-center text-stone-500 text-xs">
            Single Player vs AI
          </div>
        </div>
      )}

      {status === 'rules' && (
        <div className="max-w-lg w-full p-8 bg-stone-800 rounded-lg shadow-2xl border-2 border-amber-500/50 animate-fade-in">
           <h2 className="text-3xl font-bold text-amber-500 mb-6 text-center">How to Play</h2>
           <div className="space-y-4 text-stone-300 mb-8 text-sm md:text-base leading-relaxed">
              <p className="bg-black/30 p-3 rounded border border-white/5">
                 <span className="text-amber-400 font-bold block mb-1">Deck Building Limit</span>
                 Max <span className="text-white font-bold">5 Physical</span> and Max <span className="text-white font-bold">5 Ability</span> cards active on the field at once.
              </p>
              <p className="bg-black/30 p-3 rounded border border-white/5">
                 <span className="text-amber-400 font-bold block mb-1">Turn Actions</span>
                 You can generally perform <span className="text-white font-bold">1 Play Card</span> and <span className="text-white font-bold">1 Action</span> (Attack/Ability) per turn, unless effects apply.
              </p>
              <p className="text-xs text-stone-500 italic text-center">
                 Cards are drawn automatically. Duplicates are reshuffled.
              </p>
           </div>
           <button 
             onClick={confirmStart}
             className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-black text-xl rounded-lg shadow-lg transition-transform hover:scale-105 border-b-4 border-green-800"
           >
             START MATCH
           </button>
        </div>
      )}

      {status === 'playing' && gameState && (
        <Game state={gameState} playerId={playerId} dispatch={dispatch} />
      )}
    </div>
  );
};

export default App;