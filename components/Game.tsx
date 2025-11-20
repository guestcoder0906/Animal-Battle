

import React, { useState, useEffect, useRef } from 'react';
import { GameState, PlayerState, CardType, GameAction, CardId, Habitat, CoinFlipEvent, GameNotification, PendingReaction } from '../types';
import { CARDS } from '../constants';
import { Card } from './Card';

interface GameProps {
  state: GameState;
  playerId: string;
  dispatch: (action: GameAction) => void;
}

const ACTIVE_PHYSICALS = [
  CardId.ClawAttack, CardId.Bite, CardId.StrongJaw, CardId.LargeHindLegs, 
  CardId.BigClaws, CardId.StrongTail, CardId.DeathRoll, CardId.SwimFast, 
  CardId.AmbushAttack, CardId.GraspingTalons, CardId.DiveBomb, CardId.PiercingBeak, 
  CardId.VenomousFangs, CardId.CrushingWeight, CardId.Camouflage
];

const ACTIVE_ABILITIES = [
  CardId.Confuse, CardId.Hibernate, CardId.ToxicSpit, CardId.Regeneration, 
  CardId.Focus, CardId.AdrenalineRush, CardId.StickyTongue, CardId.ShedSkin, 
  CardId.Rage, CardId.TerritorialDisplay, CardId.ExhaustingRoar, CardId.EnhancedSmell, 
  CardId.Copycat, CardId.Agile
];

const NotificationToast: React.FC<{ note: GameNotification }> = ({ note }) => {
  const colors = {
    info: 'bg-blue-600/90 border-blue-400',
    error: 'bg-red-600/90 border-red-400',
    success: 'bg-green-600/90 border-green-400',
    warning: 'bg-yellow-600/90 border-yellow-400 text-black'
  };
  return (
    <div className={`mb-2 px-4 py-2 md:px-6 md:py-3 rounded-lg border shadow-[0_5px_15px_rgba(0,0,0,0.5)] flex items-center justify-between min-w-[250px] md:min-w-[300px] animate-slide-in-right backdrop-blur-sm ${colors[note.type]}`}>
       <span className="font-bold text-xs md:text-sm">{note.message}</span>
    </div>
  );
}

const habitatConfig: Record<Habitat, { bg: string, emoji: string }> = {
  [Habitat.Forest]: { bg: 'bg-emerald-900', emoji: '🌲' },
  [Habitat.Desert]: { bg: 'bg-amber-700', emoji: '🌵' },
  [Habitat.Water]: { bg: 'bg-blue-900', emoji: '🌊' },
  [Habitat.Arena]: { bg: 'bg-stone-900', emoji: '🏟️' },
};

export const Game: React.FC<GameProps> = ({ state, playerId, dispatch }) => {
  const me = state.players[playerId];
  const opponentId = Object.keys(state.players).find(id => id !== playerId);
  const opponent = opponentId ? state.players[opponentId] : null;
  const isMyTurn = state.currentPlayer === playerId;
  
  // If there is a pending reaction, we pause normal interactions
  const isInterrupted = !!state.pendingReaction;
  const amIReacting = state.pendingReaction?.targetId === playerId;

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [inspectCardId, setInspectCardId] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Evolve State
  const [evolveMode, setEvolveMode] = useState<'none' | 'select-formation' | 'select-hand'>('none');
  const [evolveCardId, setEvolveCardId] = useState<string | null>(null);
  const [evolveTargetId, setEvolveTargetId] = useState<string | null>(null);

  // Copycat State
  const [copycatMode, setCopycatMode] = useState(false);

  // Auto-scroll Log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [state.log]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (state.notifications.length > 0) {
      const timer = setTimeout(() => {
        dispatch({ type: 'DISMISS_NOTIFICATION', id: state.notifications[0].id });
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [state.notifications, dispatch]);

  if (!me || !opponent) return <div className="text-white p-10">Waiting for opponent...</div>;

  const handleCardClick = (instanceId: string, location: 'hand' | 'formation', ownerId: string) => {
    if (isInterrupted) return; // Disable clicks during interrupt

    const isMyCard = ownerId === playerId;
    
    if (!isMyCard) {
       setInspectCardId(instanceId);
       return;
    }

    // EVOLVE FLOW
    if (evolveMode === 'select-formation') {
        if (location === 'formation' && isMyCard) {
            setEvolveTargetId(instanceId);
            setEvolveMode('select-hand');
            return;
        }
    }
    if (evolveMode === 'select-hand') {
        if (location === 'hand' && isMyCard) {
            if (instanceId === evolveCardId) {
                // Cancel if clicking evolve card again
                setEvolveMode('none');
                setEvolveCardId(null);
                setEvolveTargetId(null);
                return;
            }
            // Execute Evolve
            dispatch({ 
                type: 'PLAY_EVOLVE_CARD', 
                playerId, 
                evolveInstanceId: evolveCardId!, 
                targetFormationId: evolveTargetId!, 
                replacementHandId: instanceId 
            });
            setEvolveMode('none');
            setEvolveCardId(null);
            setEvolveTargetId(null);
            return;
        }
    }

    // STANDARD FLOW
    if (location === 'hand') {
       setSelectedCardId(prev => prev === instanceId ? null : instanceId);
       return;
    }

    if (location === 'formation') {
       // If playing upgrade
       if (isMyTurn && isMyCard && selectedCardId) {
         const handCard = me.hand.find(c => c.instanceId === selectedCardId);
         if (handCard && CARDS[handCard.defId].isUpgrade) {
            dispatch({ type: 'PLAY_CARD', playerId, cardInstanceId: selectedCardId, targetInstanceId: instanceId });
            setSelectedCardId(null);
            return;
         }
       }
       setSelectedCardId(prev => prev === instanceId ? null : instanceId);
    }
  };

  const getRNG = (count: number) => Array.from({length: count}, () => Math.random());

  const handleAction = (type: 'ATTACK' | 'ABILITY') => {
    if (!selectedCardId) return;
    if (!isMyTurn) return;

    const selectedDef = getSelectedCardDef();
    if (type === 'ABILITY' && selectedDef?.id === CardId.Copycat) {
      setCopycatMode(true);
      return;
    }
    
    dispatch({
      type: 'USE_ACTION',
      playerId,
      actionType: type,
      cardInstanceId: selectedCardId,
      targetPlayerId: opponent.id,
      rng: getRNG(5)
    });
    setSelectedCardId(null);
  };

  const handleCopycatSteal = (targetCardId: string) => {
     if (!selectedCardId) return;
     dispatch({
        type: 'USE_ACTION',
        playerId,
        actionType: 'ABILITY',
        cardInstanceId: selectedCardId,
        targetPlayerId: opponent.id,
        rng: getRNG(5),
        targetHandCardId: targetCardId
     });
     setCopycatMode(false);
     setSelectedCardId(null);
  };

  const handleReaction = (useAgile: boolean) => {
      dispatch({
          type: 'RESOLVE_AGILE',
          playerId,
          useAgile,
          rng: getRNG(5)
      });
  };

  const playSelected = () => {
    if (!selectedCardId) return;
    
    const card = me.hand.find(c => c.instanceId === selectedCardId);
    if (card && CARDS[card.defId].id === CardId.Evolve) {
       setEvolveMode('select-formation');
       setEvolveCardId(selectedCardId);
       setSelectedCardId(null);
       return;
    }

    dispatch({ type: 'PLAY_CARD', playerId, cardInstanceId: selectedCardId });
    setSelectedCardId(null);
  };

  const endTurn = () => {
    dispatch({ type: 'END_TURN', playerId, rng: getRNG(5) });
    setSelectedCardId(null);
    setEvolveMode('none');
    setCopycatMode(false);
  };

  const clearPoison = () => {
    dispatch({ type: 'CLEAR_POISON', playerId });
  }

  const getCardByInstanceId = (id: string) => {
    return me.hand.find(c => c.instanceId === id) ||
           me.formation.find(c => c.instanceId === id) ||
           opponent.hand.find(c => c.instanceId === id) ||
           opponent.formation.find(c => c.instanceId === id);
  };

  const getSelectedCardDef = () => {
    if (!selectedCardId) return null;
    const c = getCardByInstanceId(selectedCardId);
    return c ? CARDS[c.defId] : null;
  };

  const selectedDef = getSelectedCardDef();
  const isSelectedInHand = me.hand.some(c => c.instanceId === selectedCardId);
  const isSelectedInFormation = me.formation.some(c => c.instanceId === selectedCardId);
  const isPoisoned = me.statuses.some(s => s.type === 'Poisoned');
  const canUpgrade = isSelectedInHand && selectedDef?.isUpgrade;
  
  // Validation for play button
  const canPlaySelected = () => {
    if (isInterrupted) return false;
    if (!selectedDef || !isSelectedInHand) return false;
    if (selectedDef.isUpgrade) return false; // Force target selection for upgrades
    if (selectedDef.id === CardId.CrushingWeight && me.size !== 'Big') return false;
    if (selectedDef.id === CardId.Evolve && (me.stamina < 2 || me.formation.length === 0 || me.hand.length < 2)) return false; 
    return true;
  };

  const habitatStyle = habitatConfig[state.habitat];

  // --- COMPONENTS ---

  const CoinFlipOverlay = ({ event }: { event: CoinFlipEvent }) => {
    const [visibleResult, setVisibleResult] = useState<'FLIPPING' | 'HEADS' | 'TAILS'>('FLIPPING');
    const [rotation, setRotation] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => { setRotation(r => r + 720); }, 100);
        const t1 = setTimeout(() => { clearInterval(interval); setRotation(0); setVisibleResult(event.result.toUpperCase() as 'HEADS' | 'TAILS'); }, 1500);
        const t2 = setTimeout(() => { dispatch({ type: 'ACKNOWLEDGE_COIN_FLIP' }); }, 3500);
        return () => { clearInterval(interval); clearTimeout(t1); clearTimeout(t2); }
    }, [event]);

    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in px-4">
        <div className="text-2xl md:text-5xl text-amber-400 font-black mb-8 tracking-widest uppercase shadow-black drop-shadow-[0_5px_5px_rgba(0,0,0,1)] text-center break-words">{event.reason}</div>
        <div className="relative w-40 h-40 md:w-64 md:h-64 perspective-1000">
             <div className={`w-full h-full transition-transform duration-500 transform-style-3d ${visibleResult === 'FLIPPING' ? 'animate-spin-y' : ''}`}>
                 <div className={`absolute inset-0 rounded-full border-8 border-yellow-600 bg-yellow-400 shadow-[0_0_100px_rgba(250,204,21,0.6)] flex items-center justify-center text-3xl md:text-6xl font-bold text-yellow-900 ${visibleResult === 'TAILS' ? 'hidden' : ''}`}>HEADS</div>
                 <div className={`absolute inset-0 rounded-full border-8 border-gray-400 bg-gray-200 shadow-[0_0_100px_rgba(255,255,255,0.4)] flex items-center justify-center text-3xl md:text-6xl font-bold text-gray-800 ${visibleResult === 'HEADS' ? 'hidden' : ''}`}>TAILS</div>
             </div>
        </div>
        <div className={`mt-12 text-4xl md:text-6xl font-bold animate-bounce-in ${visibleResult === 'HEADS' ? 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]' : visibleResult === 'TAILS' ? 'text-red-500 drop-shadow-[0_0_10px_rgba(248,113,113,0.8)]' : 'opacity-0'}`}>{visibleResult !== 'FLIPPING' && visibleResult}</div>
      </div>
    );
  };

  const InspectOverlay = () => {
    if (!inspectCardId) return null;
    const card = getCardByInstanceId(inspectCardId);
    if (!card) return null;
    return (
      <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setInspectCardId(null)}>
        <div className="relative transform scale-110 md:scale-150 origin-center" onClick={e => e.stopPropagation()}>
          <Card defId={card.defId} instanceId={card.instanceId} charges={card.charges} isSelected={false} noHover={true} />
          <button onClick={() => setInspectCardId(null)} className="absolute -top-6 -right-6 bg-stone-700 text-white border border-stone-500 rounded-full w-8 h-8 flex items-center justify-center font-bold hover:bg-stone-600 shadow-lg">✕</button>
        </div>
      </div>
    );
  };

  const ReactionOverlay = ({ reaction }: { reaction: PendingReaction }) => {
      const attacker = state.players[reaction.attackerId];
      const def = CARDS[reaction.attackCardId];
      
      return (
          <div className="fixed inset-0 z-[190] bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-md animate-fade-in">
              <div className="text-3xl font-bold text-red-500 mb-4 animate-pulse">⚠️ INCOMING ATTACK!</div>
              <div className="text-white text-xl mb-8 text-center">
                  <span className="font-bold text-amber-400">{attacker.name}</span> is attacking with <span className="font-bold text-red-400">{def.name}</span>!
              </div>
              <div className="flex gap-6">
                  <button 
                    onClick={() => handleReaction(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xl font-black py-4 px-8 rounded-xl shadow-[0_0_30px_rgba(37,99,235,0.6)] transform hover:scale-105 transition-all flex flex-col items-center"
                  >
                      <span>EVADE!</span>
                      <span className="text-xs font-normal mt-1 opacity-80">(Costs 2 Stamina)</span>
                  </button>
                  <button 
                    onClick={() => handleReaction(false)}
                    className="bg-stone-700 hover:bg-stone-600 text-stone-300 text-xl font-black py-4 px-8 rounded-xl border border-stone-500 hover:border-white transition-all"
                  >
                      TAKE HIT
                  </button>
              </div>
          </div>
      );
  };

  const CopycatOverlay = () => {
     if (!copycatMode) return null;
     return (
        <div className="fixed inset-0 z-[180] bg-purple-900/95 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in p-4 md:p-8 overflow-y-auto">
           <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 text-center">Choose a card to Steal!</h2>
           <p className="text-purple-200 mb-8 text-center text-sm md:text-base">Click on an opponent's card to add it to your hand.</p>
           
           <div className="flex flex-wrap gap-4 justify-center items-center max-w-4xl">
               {opponent.hand.length === 0 && <div className="text-xl text-white/50 italic">Opponent has no cards!</div>}
               {opponent.hand.map(c => (
                  <div key={c.instanceId} className="cursor-pointer hover:scale-110 transition-transform" onClick={() => handleCopycatSteal(c.instanceId)}>
                      <Card defId={c.defId} instanceId={c.instanceId} isPlayable={true} isSmall={false} />
                  </div>
               ))}
           </div>
           <button onClick={() => setCopycatMode(false)} className="mt-8 px-6 py-2 bg-stone-700 text-white rounded-lg hover:bg-stone-600">Cancel</button>
        </div>
     );
  };

  const PlayerStats = ({ p, isOpponent }: { p: PlayerState, isOpponent?: boolean }) => (
    <div className={`flex items-center gap-2 text-xs md:text-sm bg-black/60 p-2 rounded border border-white/10 w-full justify-between shadow-md shrink-0 ${isOpponent ? 'flex-row-reverse' : ''}`}>
      <div className="font-bold text-amber-500 truncate max-w-[80px] md:max-w-[150px]">{p.name}</div>
      <div className="flex gap-3 font-mono text-sm">
        <span className="text-red-400 font-bold drop-shadow-sm">HP:{p.hp}/{p.maxHp}</span>
        <span className="text-yellow-400 font-bold drop-shadow-sm">ST:{p.stamina}/{p.maxStamina}</span>
      </div>
      <div className="flex gap-1 overflow-hidden max-w-[100px] md:max-w-[150px] flex-wrap justify-end">
        {p.statuses.map((s, i) => (
          <span key={i} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shadow-sm truncate max-w-full ${
             s.type === 'Poisoned' ? 'bg-green-900 border-green-500 text-green-100' : 
             s.type === 'Grappled' ? 'bg-orange-900 border-orange-500 text-orange-100' : 
             s.type === 'Camouflaged' ? 'bg-cyan-900 border-cyan-500 text-cyan-100' : 
             s.type === 'Hidden' ? 'bg-stone-700 border-stone-500 text-stone-300' : 
             s.type === 'Accurate' ? 'bg-yellow-900 border-yellow-500 text-yellow-100' : 
             s.type === 'DamageBuff' ? 'bg-red-700 border-red-400 text-white' :
             s.type === 'Chasing' ? 'bg-blue-700 border-blue-400 text-white' :
             'bg-purple-900 border-purple-500 text-purple-100'}`}>{s.type === 'DamageBuff' ? '+1 DMG' : s.type}</span>
        ))}
      </div>
    </div>
  );

  const FormationArea = ({ p, isSelf }: { p: PlayerState, isSelf: boolean }) => (
    <div className={`flex flex-wrap gap-2 justify-center items-center min-h-[90px] md:min-h-[120px] p-2 md:p-3 bg-black/20 rounded-lg w-full border border-white/5 shadow-inner ${evolveMode === 'select-formation' && isSelf ? 'ring-4 ring-fuchsia-500 bg-fuchsia-900/20 animate-pulse cursor-pointer' : ''}`}>
       {p.formation.map(c => (
         <div key={c.instanceId} className={`relative transition-transform ${evolveMode === 'select-formation' && isSelf ? 'hover:scale-110' : 'hover:scale-105'}`}>
           <Card 
             defId={c.defId} 
             instanceId={c.instanceId}
             charges={c.charges}
             isSmall 
             isSelected={selectedCardId === c.instanceId || evolveTargetId === c.instanceId}
             onClick={() => handleCardClick(c.instanceId, 'formation', p.id)}
           />
           {/* Highlight valid upgrade targets */}
           {canUpgrade && selectedDef?.upgradeTarget?.includes(c.defId) && isSelf && evolveMode === 'none' && (
             <div className="absolute inset-0 border-4 border-yellow-400 rounded-lg animate-pulse pointer-events-none z-30" />
           )}
           {evolveMode === 'select-formation' && isSelf && (
             <div className="absolute inset-0 border-4 border-fuchsia-400 rounded-lg animate-pulse pointer-events-none z-30" />
           )}
         </div>
       ))}
       {p.formation.length === 0 && <div className="text-white/20 text-xs italic">Empty Formation</div>}
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-stone-900 overflow-hidden select-none font-sans">
      <style>{`
        @keyframes spin-y { 0% { transform: rotateX(0deg); } 100% { transform: rotateX(1080deg); } }
        .animate-spin-y { animation: spin-y 1s infinite linear; }
        @keyframes slide-in-right { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out forwards; }
      `}</style>
      
      <InspectOverlay />
      <CopycatOverlay />
      {state.activeCoinFlip && <CoinFlipOverlay event={state.activeCoinFlip} />}
      
      {/* Reaction Overlay for Agile Choice */}
      {amIReacting && state.pendingReaction && <ReactionOverlay reaction={state.pendingReaction} />}
      {/* Simple blocker if waiting for opponent reaction */}
      {isInterrupted && !amIReacting && (
          <div className="fixed inset-0 z-[190] bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <div className="text-2xl font-bold text-white animate-pulse">Opponent is reacting...</div>
          </div>
      )}

      {/* Notifications */}
      <div className="fixed top-16 right-4 z-[150] flex flex-col items-end pointer-events-none space-y-2 max-w-[90%]">
        {state.notifications.map(n => <NotificationToast key={n.id} note={n} />)}
      </div>

      {/* Evolve Instruction Overlay */}
      {evolveMode !== 'none' && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[160] w-max max-w-[90%] bg-fuchsia-900/90 border-2 border-fuchsia-500 px-4 py-2 md:px-6 md:py-3 rounded-full shadow-[0_0_20px_rgba(217,70,239,0.6)] animate-bounce text-white font-bold text-sm md:text-lg pointer-events-none backdrop-blur-md text-center">
              {evolveMode === 'select-formation' ? 'Select a card to REMOVE from formation' : 'Select a card from HAND to add'}
          </div>
      )}

      {/* HEADER / MOBILE INFO */}
      <div className="md:hidden flex justify-between items-center p-2 bg-stone-900 border-b border-stone-800 text-xs shadow-md z-40 relative shrink-0">
        <span className="text-stone-400 font-mono font-bold">TURN {state.turn}</span>
        <h1 className="text-amber-500 font-black uppercase tracking-widest text-sm">Creature Clash</h1>
        <button onClick={() => setShowLog(!showLog)} className="px-3 py-1 bg-stone-800 border border-stone-700 rounded hover:bg-stone-700 text-stone-300">LOG</button>
      </div>

      {/* SIDEBAR / LOG */}
      <div className={`fixed inset-0 z-[140] bg-black/95 p-4 md:static md:bg-stone-950 md:w-80 md:border-r md:border-stone-800 md:flex md:flex-col ${showLog ? 'flex flex-col' : 'hidden'}`}>
        <div className="flex justify-between items-center mb-4 md:hidden"><h2 className="text-amber-500 font-bold">Game Log</h2><button onClick={() => setShowLog(false)} className="text-white p-2 font-bold text-xl">✕</button></div>
        <div className="hidden md:block mb-6 border-b border-stone-800 pb-4">
           <h1 className="text-2xl font-black text-amber-500 tracking-tight uppercase">Creature Clash</h1>
           <div className="text-xs text-stone-500 mt-2 space-y-2">
             <div className="flex justify-between items-center bg-stone-900 p-2 rounded"><span>Habitat</span> <span className="text-stone-200 font-bold uppercase text-lg">{habitatStyle.emoji} {state.habitat}</span></div>
             <div className="flex justify-between items-center bg-stone-900 p-2 rounded"><span>Turn</span> <span className="text-white font-mono">{state.turn}</span></div>
             <div className={`font-bold text-center py-2 rounded mt-2 text-base md:text-lg tracking-wider shadow-inner ${isMyTurn ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>{isMyTurn ? 'YOUR TURN' : 'OPPONENT TURN'}</div>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide text-xs font-mono space-y-2 text-stone-400 flex flex-col-reverse px-1" ref={logRef}>{state.log.map((l, i) => <div key={i} className="border-b border-white/5 pb-1 leading-relaxed">{l}</div>)}</div>
        <div className="hidden md:flex flex-col gap-2 mt-4"></div>
      </div>

      {/* CENTER STATUS - FIXED POSITION */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[50] pointer-events-none w-full flex justify-center">
          {!state.winner && (
            <div className={`px-6 py-2 md:px-8 md:py-3 rounded-xl border-2 shadow-[0_0_30px_rgba(0,0,0,0.5)] text-sm md:text-lg font-black backdrop-blur-md transition-all duration-500 ${isMyTurn ? 'bg-green-900/80 border-green-500 text-green-100 scale-105' : 'bg-red-900/80 border-red-500 text-red-100'}`}>{isMyTurn ? 'YOUR TURN' : 'WAITING...'}</div>
          )}
          {state.winner && (
             <div className="px-8 py-6 md:px-10 md:py-8 rounded-xl bg-yellow-500 text-black font-black text-xl md:text-4xl shadow-2xl border-4 border-white animate-bounce z-50 text-center">{state.players[state.winner].name} WINS!</div>
          )}
      </div>

      {/* GAME BOARD */}
      <div className={`flex-1 flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] ${habitatStyle.bg} transition-colors duration-1000 overflow-hidden`}>
        
        {/* SCROLLABLE AREA FOR BOARD CONTENT */}
        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
            {/* OPPONENT AREA */}
            <div className="flex flex-col p-2 md:p-3 bg-black/30 border-b border-white/5 min-h-min shrink-0 justify-center transition-colors duration-500 shadow-lg gap-2">
               <PlayerStats p={opponent} isOpponent />
               <div className="flex justify-center -space-x-3 md:-space-x-4 my-1 md:my-3 opacity-80">
                 {opponent.hand.map((_, i) => (
                   <div key={i} className="w-8 h-12 md:w-12 md:h-16 bg-stone-800 border border-stone-600 rounded shadow-lg transform hover:-translate-y-2 transition-transform" />
                 ))}
               </div>
               <FormationArea p={opponent} isSelf={false} />
            </div>

            {/* PLAYER AREA */}
            <div className="flex-1 flex flex-col p-2 md:p-3 justify-end gap-2 md:gap-3 bg-gradient-to-t from-stone-950 via-stone-900/50 to-transparent min-h-min">
               <FormationArea p={me} isSelf={true} />
               <PlayerStats p={me} />
               
               <div className="flex gap-3 px-1 justify-end min-h-[28px] md:min-h-[32px]">
                  {isPoisoned && isMyTurn && !isInterrupted && (
                    <button onClick={clearPoison} className="px-3 py-1 md:px-4 bg-green-800 text-green-100 text-[10px] md:text-xs font-bold rounded border border-green-600 hover:bg-green-700 animate-pulse shadow-lg hover:scale-105 transition-transform">🧪 Cure Poison (1 Stam)</button>
                  )}
                  {evolveMode !== 'none' && (
                     <button onClick={() => setEvolveMode('none')} className="px-3 py-1 md:px-4 bg-stone-700 text-white text-[10px] md:text-xs font-bold rounded border border-stone-500 hover:bg-stone-600 shadow-lg">Cancel Evolve</button>
                  )}
               </div>
               
               {/* HAND */}
               <div className={`flex gap-2 md:gap-3 overflow-x-auto pb-2 md:pb-4 px-2 items-end min-h-[130px] md:min-h-[160px] scrollbar-hide shrink-0 ${evolveMode === 'select-hand' ? 'bg-fuchsia-900/30 ring-2 ring-fuchsia-500 rounded-lg' : ''}`}>
                  {me.hand.map(c => (
                    <Card 
                      key={c.instanceId} 
                      defId={c.defId}
                      instanceId={c.instanceId}
                      isPlayable={isMyTurn && evolveMode === 'none' && !isInterrupted}
                      isSelected={selectedCardId === c.instanceId || evolveCardId === c.instanceId}
                      onClick={() => handleCardClick(c.instanceId, 'hand', me.id)}
                    />
                  ))}
               </div>
            </div>
        </div>

        {/* CONTROLS TOOLBAR - FIXED/STICKY AT BOTTOM */}
        <div className="grid grid-cols-4 md:grid-cols-5 gap-1 md:gap-2 p-2 md:p-3 bg-stone-950 border-t border-stone-800 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-30 shrink-0">
           {isMyTurn && !state.winner && !isInterrupted ? (
             <>
               <button 
                 disabled={!selectedCardId || !isSelectedInHand || !canPlaySelected()}
                 onClick={playSelected}
                 className={`rounded-lg py-2 md:py-3 font-black text-[10px] md:text-sm transition-all active:scale-95 disabled:opacity-30 disabled:scale-100 col-span-2 md:col-span-1 ${isSelectedInHand ? (canUpgrade ? 'bg-stone-800 text-stone-500 cursor-not-allowed' : selectedDef?.type === CardType.Special ? 'bg-fuchsia-600 text-white hover:bg-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.4)]' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]') : 'bg-stone-800 text-stone-500'}`}
               >
                 {canUpgrade ? 'SELECT TARGET' : selectedDef?.id === CardId.Evolve ? 'EVOLVE (2 ST)' : 'PLAY CARD'}
               </button>
               
               <button 
                 disabled={!selectedCardId || !isSelectedInFormation || selectedDef?.type !== CardType.Physical || !ACTIVE_PHYSICALS.includes(selectedDef?.id as CardId)}
                 onClick={() => handleAction('ATTACK')}
                 className={`rounded-lg py-2 md:py-3 font-black text-[10px] md:text-sm transition-all active:scale-95 disabled:opacity-30 disabled:scale-100 ${isSelectedInFormation && selectedDef?.type === CardType.Physical && ACTIVE_PHYSICALS.includes(selectedDef?.id as CardId) ? 'bg-red-600 text-white hover:bg-red-500 shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'bg-stone-800 text-stone-500'}`}
               >
                 ATTACK
               </button>

               <button 
                 disabled={!selectedCardId || !isSelectedInFormation || selectedDef?.type !== CardType.Ability || !ACTIVE_ABILITIES.includes(selectedDef?.id as CardId)}
                 onClick={() => handleAction('ABILITY')}
                 className={`rounded-lg py-2 md:py-3 font-black text-[10px] md:text-sm transition-all active:scale-95 disabled:opacity-30 disabled:scale-100 ${isSelectedInFormation && selectedDef?.type === CardType.Ability && ACTIVE_ABILITIES.includes(selectedDef?.id as CardId) ? 'bg-purple-600 text-white hover:bg-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.4)]' : 'bg-stone-800 text-stone-500'}`}
               >
                 ABILITY
               </button>

               <button 
                 onClick={endTurn}
                 className="rounded-lg py-2 md:py-3 font-black text-[10px] md:text-sm bg-amber-700 text-amber-100 hover:bg-amber-600 shadow-[0_0_15px_rgba(217,119,6,0.2)] transition-all active:scale-95 col-span-2 md:col-span-1"
               >
                 END TURN
               </button>
             </>
           ) : (
             <div className="col-span-4 md:col-span-4 text-center text-stone-500 italic py-2 md:py-3 flex items-center justify-center bg-stone-900/50 rounded-lg border border-stone-800 text-xs md:text-sm">{state.winner ? 'Game Over' : isInterrupted ? 'Waiting for reaction...' : 'Opponent is thinking...'}</div>
           )}
           
           <button 
             disabled={!selectedCardId || isInterrupted}
             onClick={() => selectedCardId && setInspectCardId(selectedCardId)}
             className={`rounded-lg py-2 md:py-3 font-black text-[10px] md:text-sm transition-colors border col-span-4 md:col-span-1 mt-1 md:mt-0 ${selectedCardId && !isInterrupted ? 'bg-cyan-900/50 text-cyan-400 border-cyan-700 hover:bg-cyan-900' : 'bg-stone-900 text-stone-700 border-stone-800'}`}
           >
             INSPECT
           </button>
        </div>
      </div>
    </div>
  );
}
