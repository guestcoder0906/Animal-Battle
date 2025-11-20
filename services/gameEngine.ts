
import { CARDS, generateDeck, getRandomElement as randomElem } from '../constants';
import { GameState as GS, PlayerState as PS, CardInstance as CI, CreatureType as CT, Habitat as H, CardType as CType, AbilityStatus as AS, CardDef, GameAction as GA, CardId as CID, GameNotification, StatusEffect } from '../types';

const getRNG = (rng: number[] | undefined, index: number): number => {
  return (rng && rng.length > index) ? rng[index] : Math.random();
};

export const createPlayer = (id: string, name: string): PS => {
  const types = [CT.Mammal, CT.Reptile, CT.Avian, CT.Amphibian];
  const sizes: ('Small' | 'Medium' | 'Big')[] = ['Small', 'Medium', 'Big'];
  
  const cType = randomElem(types);
  const size = randomElem(sizes);
  const deckDefs = generateDeck(cType, size);

  // Convert Defs to Instances
  const deck: CI[] = deckDefs.map((def, i) => ({
    instanceId: `${id}_card_${i}_${def.id}_${Math.floor(Math.random()*10000)}`,
    defId: def.id,
    charges: def.maxCharges 
  }));

  // Extract Size Card and Auto-Play it
  const sizeCardIndex = deck.findIndex(c => CARDS[c.defId].type === CType.Size);
  const sizeCard = deck.splice(sizeCardIndex, 1)[0];
  const formation = [sizeCard];

  // Initial Stats
  const hp = size === 'Small' ? 10 : size === 'Medium' ? 15 : 20;
  const stamina = size === 'Small' ? 4 : size === 'Medium' ? 3 : 2;

  return {
    id,
    name,
    hp,
    maxHp: hp,
    stamina,
    maxStamina: stamina,
    creatureType: cType,
    size,
    hand: deck.slice(0, 4),
    deck: deck.slice(4),
    discard: [],
    formation: formation,
    statuses: [],
    cardsPlayedThisTurn: 0,
    hasActedThisTurn: false,
    guaranteedHeads: false
  };
};

export const gameReducer = (state: GS, action: GA): GS => {
  // Deep copy manually where needed or just top level
  const newState = { ...state, players: { ...state.players }, log: [...state.log], notifications: [...state.notifications] };
  
  const updatePlayer = (pid: string, updates: Partial<PS>) => {
     newState.players[pid] = { ...newState.players[pid], ...updates };
  };

  switch (action.type) {
    case 'INIT_GAME':
        return action.payload;
    
    case 'PLAY_CARD': {
        const { playerId, cardInstanceId, targetInstanceId } = action;
        const p = newState.players[playerId];
        const cardIndex = p.hand.findIndex(c => c.instanceId === cardInstanceId);
        if (cardIndex === -1) return state;
        
        const card = p.hand[cardIndex];
        const def = CARDS[card.defId];

        if (def.isUpgrade && targetInstanceId) {
             if (p.stamina < def.staminaCost) {
                 newState.notifications.push({ id: Date.now().toString(), message: "Not enough Stamina!", type: 'error' });
                 return newState;
             }
             const targetIndex = p.formation.findIndex(c => c.instanceId === targetInstanceId);
             if (targetIndex !== -1) {
                 const oldCard = p.formation[targetIndex];
                 p.formation[targetIndex] = card; 
                 p.hand.splice(cardIndex, 1);
                 p.discard.push(oldCard);
                 p.stamina -= def.staminaCost;
                 p.cardsPlayedThisTurn++;
                 newState.log.push(`${p.name} upgraded ${CARDS[oldCard.defId].name} to ${def.name}!`);
             }
        } else {
             if (def.type === CType.Physical || def.type === CType.Ability) {
                 const typeCount = p.formation.filter(c => CARDS[c.defId].type === def.type).length;
                 if (typeCount >= 5) {
                     newState.notifications.push({ id: Date.now().toString(), message: `Max 5 ${def.type} cards!`, type: 'error' });
                     return newState;
                 }
                 p.hand.splice(cardIndex, 1);
                 p.formation.push(card);
                 p.cardsPlayedThisTurn++;
                 newState.log.push(`${p.name} played ${def.name}.`);
             }
        }
        updatePlayer(playerId, p);
        return newState;
    }

    case 'USE_ACTION': {
        const { playerId, cardInstanceId, targetPlayerId, rng } = action;
        const p = newState.players[playerId];
        const target = newState.players[targetPlayerId];
        const card = p.formation.find(c => c.instanceId === cardInstanceId) || p.hand.find(c => c.instanceId === cardInstanceId);
        
        if (!card) return state;
        const def = CARDS[card.defId];
        
        if (p.stamina < def.staminaCost) {
            newState.notifications.push({ id: Date.now().toString(), message: "Not enough Stamina!", type: 'error' });
            return newState;
        }
        
        p.stamina -= def.staminaCost;
        p.hasActedThisTurn = true;

        if (action.actionType === 'ATTACK') {
             // --- ATTACK RESOLUTION ---
             let damage = 2;
             if (def.id === CID.Bite) damage = 3;
             if (def.id === CID.StrongJaw) damage = 3;
             if (def.id === CID.ClawAttack) damage = 2;
             if (def.id === CID.BigClaws) damage = 3; 
             if (def.id === CID.DiveBomb) damage = 2; 
             if (def.id === CID.CrushingWeight) damage = 4;
             if (def.id === CID.DeathRoll) damage = 4;
             if (def.id === CID.GraspingTalons) damage = 2;
             if (def.id === CID.LargeHindLegs) damage = 2;
             if (def.id === CID.StrongTail) damage = 2;
             if (def.id === CID.PiercingBeak) damage = 2;
             if (def.id === CID.VenomousFangs) damage = 1;
             if (def.id === CID.Leech) damage = 1;

             // Modifiers
             if (p.statuses.some(s => s.type === 'DamageBuff')) damage += 1;
             if (p.formation.some(c => c.defId === CID.StrongBuild)) damage += 1;
             if (newState.habitat === H.Water && p.formation.some(c => c.defId === CID.SwimFast)) damage += 2;
             if (def.id === CID.DiveBomb && p.statuses.some(s => s.type === 'Flying')) damage += 2;
             
             // Hit Logic (Simplified)
             const isHidden = target.statuses.some(s => s.type === 'Hidden');
             if (isHidden) {
                 newState.log.push(`${p.name}'s attack missed (Target Hidden)!`);
             } else {
                 // Apply Armor
                 let reduction = 0;
                 if (target.formation.some(c => c.defId === CID.ArmoredScales)) reduction += 1;
                 if (target.formation.some(c => c.defId === CID.ThickFur)) reduction += 1;
                 
                 const finalDmg = Math.max(0, damage - reduction);
                 target.hp = Math.max(0, target.hp - finalDmg);
                 newState.log.push(`${p.name} attacks with ${def.name} dealing ${finalDmg} damage!`);

                 // --- BARBED QUILLS FIX START ---
                 const targetHasQuills = target.formation.some(c => c.defId === CID.BarbedQuills);
                 if (targetHasQuills) {
                     const attackerIsArmored = p.formation.some(c => 
                         [CID.ArmoredExoskeleton, CID.ArmoredScales, CID.ThickFur].includes(c.defId as CID)
                     );
                     
                     if (!attackerIsArmored) {
                         const isGrappled = target.statuses.some(s => s.type === 'Grappled');
                         const thorns = isGrappled ? 2 : 1;
                         p.hp = Math.max(0, p.hp - thorns);
                         newState.log.push(`${p.name} is pricked by Barbed Quills for ${thorns} damage!`);
                     } else {
                         newState.log.push(`${p.name}'s armor protects against Barbed Quills.`);
                     }
                 }
                 // --- BARBED QUILLS FIX END ---

                 // Spiky Body
                 const targetHasSpiky = target.formation.some(c => c.defId === CID.SpikyBody);
                 if (targetHasSpiky) {
                     const attackerAgile = p.formation.some(c => c.defId === CID.Agile);
                     // Assuming non-agile takes damage for simplicity based on request scope
                     if (!attackerAgile) {
                         p.hp = Math.max(0, p.hp - 1);
                         newState.log.push(`${p.name} takes 1 damage from Spiky Body.`);
                     }
                 }

                 // Poison Skin
                 if (target.formation.some(c => c.defId === CID.PoisonSkin)) {
                     if (!p.statuses.some(s => s.type === 'Poisoned')) {
                         p.statuses.push({ type: 'Poisoned', duration: 3 });
                         newState.log.push(`${p.name} is Poisoned by Poison Skin!`);
                     }
                 }
             }
        } else {
             // Abilities
             newState.log.push(`${p.name} uses ${def.name}!`);
             if (def.id === CID.Regeneration) { p.hp = Math.min(p.maxHp, p.hp + 4); }
             if (def.id === CID.Hibernate) { p.hp = Math.min(p.maxHp, p.hp + 2); }
             if (def.id === CID.AdrenalineRush) { p.stamina += 1; }
             if (def.id === CID.ShortBurst) { p.stamina += 1; }
        }

        updatePlayer(playerId, p);
        updatePlayer(targetPlayerId, target);
        return newState;
    }

    case 'END_TURN': {
        const { playerId } = action;
        const p = newState.players[playerId];
        const opponentId = Object.keys(newState.players).find(id => id !== playerId)!;
        const opponent = newState.players[opponentId];

        // Status Effects
        if (p.statuses.some(s => s.type === 'Poisoned')) {
            p.hp = Math.max(0, p.hp - 1);
            newState.log.push(`${p.name} takes 1 Poison damage.`);
        }
        if (p.statuses.some(s => s.type === 'Leeched')) {
            p.hp = Math.max(0, p.hp - 1);
            opponent.hp = Math.min(opponent.maxHp, opponent.hp + 1);
            newState.log.push(`${p.name} suffers Leech! ${opponent.name} heals 1.`);
        }
        
        p.statuses = p.statuses.map(s => ({ ...s, duration: (s.duration || 0) - 1 })).filter(s => (s.duration || 0) > 0);
        p.stamina = p.maxStamina;
        p.cardsPlayedThisTurn = 0;
        p.hasActedThisTurn = false;

        // Draw Card
        if (p.deck.length > 0) {
             p.hand.push(p.deck.shift()!);
        }

        newState.currentPlayer = opponentId;
        newState.turn += 1;
        newState.log.push(`Turn ${newState.turn}: ${opponent.name}'s turn.`);
        return newState;
    }
    
    case 'DISMISS_NOTIFICATION':
        newState.notifications = newState.notifications.filter(n => n.id !== action.id);
        return newState;

    case 'UPDATE_STATE':
        return action.payload;

    case 'PLAY_EVOLVE_CARD':
        // Logic for evolution would go here
        return state;
        
    case 'PLAY_APEX_EVOLUTION':
        // Logic for apex would go here
        return state;

    case 'RESOLVE_AGILE':
        // Logic for reaction resolution
        if (newState.pendingReaction) newState.pendingReaction = null;
        return newState;
    
    case 'RESOLVE_CHOICE':
        // Logic for choice resolution
        if (newState.pendingChoice) newState.pendingChoice = null;
        return newState;

    default:
      return state;
  }
};
