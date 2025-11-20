import { GameState, GameAction, CardType, CardId, AbilityStatus, CardInstance, PendingReaction } from '../types';
import { CARDS } from '../constants';

export const computeReaction = (state: GameState, aiId: string): GameAction | null => {
   const reaction = state.pendingReaction;
   if (!reaction || reaction.targetId !== aiId) return null;

   const ai = state.players[aiId];
   if (ai.stamina < 2) return { type: 'RESOLVE_AGILE', playerId: aiId, useAgile: false, rng: [] };

   // Heuristic: When to evade?
   let shouldEvade = false;
   
   // 1. Avoid Lethal
   // Estimate damage of incoming attack
   let estimatedDmg = 2;
   if (reaction.attackCardId === CardId.DiveBomb || reaction.attackCardId === CardId.CrushingWeight) estimatedDmg = 4;
   if (reaction.attackCardId === CardId.Bite) estimatedDmg = 3;
   
   if (ai.hp <= estimatedDmg) shouldEvade = true;

   // 2. High Value Evasion
   else if (estimatedDmg >= 3) shouldEvade = true;
   
   // 3. Random factor if healthy
   else if (ai.hp < ai.maxHp * 0.5 && Math.random() > 0.4) shouldEvade = true;

   return {
       type: 'RESOLVE_AGILE',
       playerId: aiId,
       useAgile: shouldEvade,
       rng: Array.from({length: 5}, () => Math.random())
   };
}

export const computeAiActions = (state: GameState, aiId: string): GameAction[] => {
  const actions: GameAction[] = [];
  const ai = state.players[aiId];
  if (!ai) return [];
  
  const opponentId = Object.keys(state.players).find(id => id !== aiId)!;
  const opponent = state.players[opponentId];
  
  let currentStamina = ai.stamina;
  let cardsPlayed = ai.cardsPlayedThisTurn;
  let hasActed = ai.hasActedThisTurn;

  // To correctly simulate the turn, we need to track which card we decide to play
  // so we can use it in the action phase immediately (since play/action can happen same turn).
  let cardPlayedInstance: CardInstance | null = null;

  // --- 1. PLAY CARD PHASE ---
  if (cardsPlayed === 0) {
    
    // Check for Evolve Logic
    const evolveCardIndex = ai.hand.findIndex(c => CARDS[c.defId].id === CardId.Evolve);
    const canEvolve = evolveCardIndex !== -1 && currentStamina >= 2 && ai.formation.length > 0 && ai.hand.length > 1;

    if (canEvolve) {
        // Evolve logic: Swap a weak formation card for a strong hand card
        // Find weakest card in formation (prioritize low stamina cost or passive)
        const formationTarget = [...ai.formation].sort((a, b) => CARDS[a.defId].staminaCost - CARDS[b.defId].staminaCost)[0];
        
        // Find strongest card in hand (not the Evolve card itself)
        const validHandCards = ai.hand.filter((c, idx) => idx !== evolveCardIndex && c.defId !== CardId.Evolve);
        const handTarget = [...validHandCards].sort((a, b) => CARDS[b.defId].staminaCost - CARDS[a.defId].staminaCost)[0];

        if (formationTarget && handTarget) {
            actions.push({
                type: 'PLAY_EVOLVE_CARD',
                playerId: aiId,
                evolveInstanceId: ai.hand[evolveCardIndex].instanceId,
                targetFormationId: formationTarget.instanceId,
                replacementHandId: handTarget.instanceId
            });
            currentStamina -= 2;
            // No card played instance for normal action, but we did swap cards.
            // We won't play another card this turn (Evolve counts as the play).
        }
    } else {

        // Try to find an upgrade first
        const upgrades = ai.hand.filter(c => CARDS[c.defId].isUpgrade);
        let playedUpgrade = false;
        
        for (const upg of upgrades) {
        const def = CARDS[upg.defId];
        if (currentStamina >= def.staminaCost && def.upgradeTarget) {
            const target = ai.formation.find(c => def.upgradeTarget!.includes(c.defId));
            if (target) {
            actions.push({
                type: 'PLAY_CARD',
                playerId: aiId,
                cardInstanceId: upg.instanceId,
                targetInstanceId: target.instanceId
            });
            currentStamina -= def.staminaCost;
            cardsPlayed++; 
            playedUpgrade = true;
            break;
            }
        }
        }

        // If no upgrade, play a normal card
        if (!playedUpgrade) {
        const validCards = ai.hand.filter(c => {
            const def = CARDS[c.defId];
            const typeMatch = def.creatureTypes === 'All' || def.creatureTypes.includes(ai.creatureType);
            // Explicitly filter out Evolve so it doesn't try to play it as a normal card
            return typeMatch && !def.isUpgrade && def.id !== CardId.Evolve;
        });

        if (validCards.length > 0) {
            // Check limits before playing
            const physCount = ai.formation.filter(c => CARDS[c.defId].type === CardType.Physical).length;
            const abilCount = ai.formation.filter(c => CARDS[c.defId].type === CardType.Ability).length;

            const playables = validCards.filter(c => {
                const def = CARDS[c.defId];
                if (def.type === CardType.Physical && physCount >= 5) return false;
                if (def.type === CardType.Ability && abilCount >= 5) return false;
                return true;
            });

            if (playables.length > 0) {
                // Heuristic: Play Physical if few physicals, else Ability
                let chosen = playables.find(c => CARDS[c.defId].type === CardType.Physical);
                if (!chosen || physCount >= 2) {
                    // Else take any ability
                    chosen = playables.find(c => CARDS[c.defId].type === CardType.Ability) || playables[0];
                }
                
                if (chosen) {
                    actions.push({
                        type: 'PLAY_CARD',
                        playerId: aiId,
                        cardInstanceId: chosen.instanceId
                    });
                    cardPlayedInstance = chosen;
                }
            }
        }
        }
    }
  }

  // --- 2. ACTION PHASE ---
  if (!hasActed) {
    // Check for Status preventing action
    const isConfused = ai.statuses.some(s => s.type === 'Confused');
    const isStuck = ai.statuses.some(s => s.type === 'Stuck');
    
    if (!isStuck) {
      // Gather available actions from Formation ONLY. 
      // Includes existing formation + the card we decided to play in Step 1.
      const availableActions: { instanceId: string, defId: string }[] = [];
      
      ai.formation.forEach(c => availableActions.push({ instanceId: c.instanceId, defId: c.defId }));
      if (cardPlayedInstance) {
        availableActions.push({ instanceId: cardPlayedInstance.instanceId, defId: cardPlayedInstance.defId });
      }

      const affordableActions = availableActions.filter(c => {
        const def = CARDS[c.defId];
        if (def.staminaCost > currentStamina) return false;
        
        // EXCLUSIONS: Strong Build, Sizes, etc are PASSIVE
        if (def.id === CardId.StrongBuild) return false;
        if (def.type === CardType.Size) return false;
        if (def.id === CardId.Amphibious) return false;
        if (def.id === CardId.CamouflageWater) return false;
        if (def.id === CardId.PoisonSkin) return false;
        if (def.id === CardId.BarbedQuills) return false;
        if (def.id === CardId.ArmoredScales) return false;
        if (def.id === CardId.ArmoredExoskeleton) return false;
        
        // Can only use cards if they are active or permanent or consumable (once played to formation)
        if (def.type === CardType.Physical || def.type === CardType.Ability) return true;
        
        return false;
      });

      if (affordableActions.length > 0) {
        // Scoring System
        const scoredActions = affordableActions.map(c => {
          const def = CARDS[c.defId];
          let score = 0;
          let extraPayload: any = {};
          
          // Heals - High priority if low HP
          if (def.id === CardId.Regeneration || def.id === CardId.Hibernate) {
            if (ai.hp < ai.maxHp * 0.4) score += 20;
            else if (ai.hp < ai.maxHp * 0.7) score += 5;
            else score -= 10; // Don't waste heal
          }

          // Attacks
          if (def.type === CardType.Physical) {
             let dmg = 2; 
             if (def.id === CardId.Bite) dmg = 3;
             if (def.id === CardId.DiveBomb) dmg = 4;
             if (def.id === CardId.CrushingWeight) dmg = 4;
             
             if (opponent.hp <= dmg) score += 1000; // Lethal
             else score += dmg * 2;
          }

          // Copycat
          if (def.id === CardId.Copycat) {
             if (opponent.hand.length > 0) {
                score += 15; // High priority
                // Pick a random card to steal for now, or best one
                // Since AI can see state, let's steal the highest cost card
                const bestSteal = [...opponent.hand].sort((a,b) => CARDS[b.defId].staminaCost - CARDS[a.defId].staminaCost)[0];
                extraPayload.targetHandCardId = bestSteal.instanceId;
             } else {
                score -= 100; // Don't use if empty hand
             }
          }

          // Debuffs / Control
          if (def.id === CardId.Confuse) score += 5;
          if (def.id === CardId.ToxicSpit) score += 5;
          if (def.id === CardId.TerritorialDisplay) score += 4;

          // Randomize slightly to make AI less predictable
          score += Math.random() * 3;

          return { c, score, def, extraPayload };
        });

        // Sort by score descending
        scoredActions.sort((a, b) => b.score - a.score);
        const bestAction = scoredActions[0];

        if (bestAction && bestAction.score > 0) {
           actions.push({
             type: 'USE_ACTION',
             playerId: aiId,
             actionType: bestAction.def.type === CardType.Physical ? 'ATTACK' : 'ABILITY',
             cardInstanceId: bestAction.c.instanceId,
             targetPlayerId: opponentId,
             rng: Array.from({length: 10}, () => Math.random()),
             ...bestAction.extraPayload
           });
        }
      }
    }
  }

  // --- 3. END TURN ---
  actions.push({
    type: 'END_TURN',
    playerId: aiId,
    rng: Array.from({length: 10}, () => Math.random())
  });

  return actions;
};