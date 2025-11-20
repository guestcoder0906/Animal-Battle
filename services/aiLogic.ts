

import { GameState, GameAction, CardType, CardId, AbilityStatus, CardInstance } from '../types';
import { CARDS } from '../constants';

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
        return typeMatch && !def.isUpgrade;
      });

      if (validCards.length > 0) {
        // Heuristic: Play Physical if few physicals, else Ability
        const physCount = ai.formation.filter(c => CARDS[c.defId].type === CardType.Physical).length;
        
        // Prefer adding Physical cards if we have few
        let chosen = validCards.find(c => CARDS[c.defId].type === CardType.Physical);
        if (!chosen || physCount >= 2) {
            // Else take any ability
            chosen = validCards.find(c => CARDS[c.defId].type === CardType.Ability) || validCards[0];
        }
        
        if (chosen) {
           actions.push({
            type: 'PLAY_CARD',
            playerId: aiId,
            cardInstanceId: chosen.instanceId
          });
          cardPlayedInstance = chosen;
          // Play card doesn't cost stamina usually unless upgrade
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
