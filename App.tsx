
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Game } from './components/Game';
import { NetworkService } from './services/network';
import { gameReducer, createPlayer } from './services/gameEngine';
import { GameState, GameAction, Habitat } from './types';
import { getRandomElement } from './constants';
import { computeAiActions } from './services/aiLogic';

const App: React.FC = () => {
  const [network, setNetwork] = useState<NetworkService | null>(null);
  const [gameId, setGameId] = useState<string>(''); 
  const [joinId, setJoinId] = useState<string>('');
  const [status, setStatus] = useState<'menu' | 'connecting' | 'playing'>('menu');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [myName, setMyName] = useState('Player');
  
  // AI Mode State
  const [isAiMode, setIsAiMode] = useState(false);
  const aiTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAction = useCallback((action: GameAction) => {
    setGameState(prevState => {
      if (!prevState && action.type !== 'INIT_GAME') return null;
      
      if (action.type === 'INIT_GAME') return action.payload;
      if (action.type === 'UPDATE_STATE') return action.payload;
      
      // Host handshake logic handled elsewhere or ignored if playing AI
      if (action.type === 'JOIN_GAME') return prevState;

      const newState = gameReducer(prevState!, action);
      return newState;
    });
  }, []);

  // Initialize Network (only needed for P2P)
  useEffect(() => {
    const net = new NetworkService((remoteAction) => {
      handleAction(remoteAction);
    });
    setNetwork(net);
  }, []);

  const startGameAsHost = useCallback((opponentId: string, opponentName: string) => {
    if (!network) return;
    const habitats = [Habitat.Forest, Habitat.Desert, Habitat.Water, Habitat.Arena];
    const p1 = createPlayer(network.myId, myName + " (Host)");
    const p2 = createPlayer(opponentId, opponentName);
    
    const initialState: GameState = {
      gameId: network.myId,
      habitat: getRandomElement(habitats),
      turn: 1,
      currentPlayer: network.myId,
      players: { [p1.id]: p1, [p2.id]: p2 },
      log: ["Game Started!", `Opponent ${opponentName} joined!`],
      winner: null,
      phase: 'start',
      activeCoinFlip: null,
      notifications: []
    };
    dispatch({ type: 'INIT_GAME', payload: initialState });
    setStatus('playing');
  }, [network, myName]); // Add dependencies

  // Network Callback Update
  useEffect(() => {
    if (network) {
      network.setOnAction((action: GameAction) => {
         if (action.type === 'JOIN_GAME' && isHost) {
            startGameAsHost(action.playerId, action.name);
         } else {
            handleAction(action);
         }
      });
    }
  }, [network, isHost, handleAction, startGameAsHost]);

  const dispatch = (action: GameAction) => {
    handleAction(action);
    if (!isAiMode) {
      network?.send(action);
    }
  };

  // --- AI Logic Effect ---
  useEffect(() => {
    if (!gameState || !isAiMode || gameState.winner) return;
    
    const aiId = 'ai-bot';
    if (gameState.currentPlayer === aiId && gameState.phase !== 'end') {
      // It's AI's turn
      // Small initial delay for realism
      if (aiTurnTimeoutRef.current) clearTimeout(aiTurnTimeoutRef.current);
      
      aiTurnTimeoutRef.current = setTimeout(() => {
        const actions = computeAiActions(gameState, aiId);
        
        // Execute actions sequentially with delays
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
  }, [gameState?.currentPlayer, gameState?.turn, isAiMode]); 

  const startHost = async () => {
    if (!network) return;
    setIsAiMode(false);
    setStatus('connecting');
    try {
      // Pass undefined to generate ID
      const id = await network.init(); 
      setGameId(id);
      setPlayerId(id);
      setIsHost(true);
    } catch (e) {
      console.error(e);
      alert("Failed to initialize connection. PeerJS server might be unreachable.");
      setStatus('menu');
    }
  };

  const joinGame = async () => {
    if (!network || !joinId) return;
    setIsAiMode(false);
    setStatus('connecting');
    try {
      const myId = await network.init();
      setPlayerId(myId);
      await network.connect(joinId.trim());
      
      // Send join message only after connection is confirmed open
      network.send({ type: 'JOIN_GAME', playerId: myId, name: myName });
    } catch (e) {
      console.error(e);
      alert("Failed to join game. Check Host ID or connection.");
      setStatus('menu');
    }
  };

  const startAiGame = () => {
    setIsAiMode(true);
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
      notifications: []
    };

    if (Math.random() > 0.5) {
      initialState.currentPlayer = aiId;
      initialState.log.push("AI goes first!");
    } else {
      initialState.log.push("You go first!");
    }

    dispatch({ type: 'INIT_GAME', payload: initialState });
    setStatus('playing');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-900 text-white p-4">
      {status === 'menu' && (
        <div className="max-w-md w-full p-8 bg-stone-800 rounded-lg shadow-2xl border border-stone-700">
          <h1 className="text-4xl font-bold text-center mb-8 text-amber-500">Animal Battle</h1>
          
          <input 
            type="text" 
            placeholder="Your Name"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            className="w-full mb-4 px-4 py-2 bg-black rounded border border-stone-600 text-white"
          />

          <div className="space-y-4">
            <button onClick={startAiGame} className="w-full py-4 bg-purple-600 hover:bg-purple-500 rounded font-bold text-lg shadow-lg transition border-b-4 border-purple-800 active:border-b-0 active:translate-y-1">
              🤖 Play vs AI
            </button>

            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-stone-600"></div>
                <span className="flex-shrink mx-4 text-stone-400">Multiplayer</span>
                <div className="flex-grow border-t border-stone-600"></div>
            </div>

            <button onClick={startHost} className="w-full py-3 bg-green-600 hover:bg-green-500 rounded font-bold text-lg shadow-lg transition">
              Host Game
            </button>
            
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Enter Host ID" 
                className="flex-1 px-4 py-2 bg-stone-900 rounded border border-stone-600 focus:border-amber-500 outline-none"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
              />
              <button onClick={joinGame} className="px-6 bg-blue-600 hover:bg-blue-500 rounded font-bold">
                Join
              </button>
            </div>
          </div>
        </div>
      )}

      {status === 'connecting' && (
        <div className="text-center space-y-6 p-8 bg-stone-800 rounded-lg">
          <div className="animate-spin w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto"></div>
          {isHost ? (
            <div>
              <p className="text-stone-400 mb-2">Share code with opponent:</p>
              <div className="bg-black p-4 rounded font-mono text-2xl tracking-widest text-green-400 select-all cursor-pointer" onClick={() => navigator.clipboard.writeText(gameId)}>
                {gameId || 'Generating...'}
              </div>
              <p className="text-xs text-stone-500 mt-4">Waiting for opponent to join...</p>
            </div>
          ) : (
            <p>Connecting to host...</p>
          )}
           <button onClick={() => setStatus('menu')} className="text-sm text-red-400 hover:underline">Cancel</button>
        </div>
      )}

      {status === 'playing' && gameState && (
        <Game state={gameState} playerId={playerId} dispatch={dispatch} />
      )}
    </div>
  );
};

export default App;
