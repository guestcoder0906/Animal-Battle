
import { CARDS, generateDeck, getRandomElement as randomElem } from '../constants';
import { GameState as GS, PlayerState as PS, CardInstance as CI, CreatureType as CT, Habitat as H, CardType as CType, AbilityStatus as AS, CardDef, GameAction as GA, CardId as CID, GameNotification } from '../types';

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
  const baseStamina = size === 'Small' ? 4 : size === 'Medium' ? 3 : 2;
  
  // Handle Strong Build passive immediately for stats
  let finalHp = hp;
  
  const hand: CI[] = [];
  const remainingDeck: CI[] = [];

  const physicals = deck.filter(c => CARDS[c.defId].type === CType.Physical);
  const abilities = deck.filter(c => CARDS[c.defId].type === CType.Ability || CARDS[c.defId].type === CType.Special);
  
  // Start Game: 3 Physicals, 3 Abilities/Special in Hand
  for(let i=0; i<3; i++) {
    if(physicals.length > 0) hand.push(physicals.shift()!);
  }
  for(let i=0; i<3; i++) {
    if(abilities.length > 0) hand.push(abilities.shift()!);
  }

  remainingDeck.push(...physicals, ...abilities);
  
  // Shuffle Deck
  for (let i = remainingDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remainingDeck[i], remainingDeck[j]] = [remainingDeck[j], remainingDeck[i]];
  }

  return {
    id, name, hp: finalHp, maxHp: finalHp, stamina: baseStamina, maxStamina: baseStamina,
    creatureType: cType, size,
    hand, deck: remainingDeck, discard: [], formation,
    statuses: [],
    cardsPlayedThisTurn: 0, hasActedThisTurn: false,
    guaranteedHeads: false
  };
};

export const gameReducer = (state: GS, action: GA): GS => {
  const newState = JSON.parse(JSON.stringify(state)) as GS;

  const notify = (msg: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
    newState.notifications.push({
      id: Math.random().toString(36).substr(2, 9),
      message: msg,
      type
    });
  };

  const log = (msg: string) => {
    newState.log.unshift(`[T${newState.turn}] ${msg}`);
  };

  const performCoinFlip = (reason: string, rngVal: number, flipperId?: string): boolean => {
     let isHeads = rngVal > 0.5;
     
     if (flipperId) {
         const flipper = newState.players[flipperId];
         if (flipper && flipper.guaranteedHeads) {
             isHeads = true;
             flipper.guaranteedHeads = false;
             log(`${flipper.name} uses guaranteed HEADS for ${reason}!`);
         }
     }

     newState.activeCoinFlip = {
        id: Math.random().toString(36),
        result: isHeads ? 'Heads' : 'Tails',
        reason,
        timestamp: Date.now()
     };
     log(`Coin Flip (${reason}): ${isHeads ? 'HEADS' : 'TAILS'}`);
     return isHeads;
  };

  // Helper to apply damage and side effects
  const resolveAttackDamage = (attacker: PS, target: PS, def: CardDef, rng: number[]) => {
      let rngIndex = 10; // Start offset to avoid collision with previous checks
      let damage = 0;
      
      // Base Damage
      if (def.id === CID.Bite) damage = 3;
      else if (def.id === CID.ClawAttack) damage = 2;
      else if (def.id === CID.GraspingTalons) damage = 2;
      else if (def.id === CID.VenomousFangs) damage = 1;
      else if (def.id === CID.DiveBomb) {
          damage = 2;
          if (attacker.statuses.some(s => s.type === 'Flying')) damage = 4;
      }
      else if (def.id === CID.StrongTail) damage = 2;
      else if (def.id === CID.BigClaws) damage = 3;
      else if (def.id === CID.PiercingBeak) damage = 2;
      else if (def.id === CID.CrushingWeight) damage = 4;
      else if (def.id === CID.DeathRoll) damage = 4;
      else if (def.id === CID.StrongJaw) damage = 3; 
      else if (def.id === CID.LargeHindLegs && (attacker.size === 'Medium' || attacker.size === 'Big')) damage = 2;
      else if (def.id === CID.Leech) damage = 1;

      // Modifiers
      if (attacker.formation.some(c => c.defId === CID.StrongBuild)) damage += 1;
      if (newState.habitat === H.Water && attacker.formation.some(c => c.defId === CID.SwimsWell)) damage += 1;
      if (newState.habitat === H.Water && attacker.formation.some(c => c.defId === CID.SwimFast)) damage += 2; // Swim Fast Bonus
      if (newState.habitat === H.Water && attacker.creatureType === CT.Amphibian) damage += 1;
      
      // Damage Buff Status
      if (attacker.statuses.some(s => s.type === 'DamageBuff')) {
         damage += 1;
      }

      // Defense Calculation
      let defense = 0;
      if (target.formation.some(c => c.defId === CID.ArmoredScales)) defense += 1;
      if (target.formation.some(c => c.defId === CID.ThickFur)) defense += 1;
      if (target.formation.some(c => c.defId === CID.Fur) && performCoinFlip('Fur Defense', getRNG(rng, rngIndex++), target.id)) defense += 1;
      if (target.formation.some(c => c.defId === CID.ArmoredExoskeleton)) {
         if (!performCoinFlip('Exoskeleton', getRNG(rng, rngIndex++), attacker.id)) defense += 2;
      }

      if (def.id === CID.DiveBomb) defense = 0; 

      // Spiky Body
      if (target.formation.some(c => c.defId === CID.SpikyBody)) {
         const attackerAgile = attacker.formation.some(c => c.defId === CID.SmallSize || c.defId === CID.Agile);
         if (!attackerAgile) {
            attacker.hp -= 1;
            log(`${attacker.name} took 1 dmg (Spiky Body).`);
         } else {
            if (performCoinFlip('Spiky Body (Agile)', getRNG(rng, rngIndex++), attacker.id)) {
                attacker.hp -= 1;
            } else {
                damage += 1;
            }
         }
      }

      // Barbed Quills
      if (target.formation.some(c => c.defId === CID.BarbedQuills)) {
         const hasArmor = attacker.formation.some(c => c.defId === CID.ArmoredExoskeleton || c.defId === CID.SpikyBody);
         const isGrappled = target.statuses.some(s => s.type === 'Grappled');
         
         if (!hasArmor) {
            const recoilDamage = isGrappled ? 2 : 1;
            attacker.hp -= recoilDamage;
            log(`${attacker.name} took ${recoilDamage} recoil damage (Barbed Quills).`);
            notify(`${attacker.name} pricked by Quills!`, 'warning');
         } else {
            log(`${attacker.name}'s armor protected against Barbed Quills.`);
         }
      }
      
      // Poison Skin (Auto)
      if (target.formation.some(c => c.defId === CID.PoisonSkin)) {
          attacker.statuses.push({ type: 'Poisoned' });
          log(`${attacker.name} was Poisoned by Poison Skin.`);
          notify("Poisoned by skin!", 'warning');
      }
      
      let finalDmg = Math.max(0, damage - defense);
      target.hp -= finalDmg;
      log(`${attacker.name} attacked for ${finalDmg} dmg.`);
      notify(`Dealt ${finalDmg} damage!`, 'success');

      // On Hit Effects
      if (def.id === CID.VenomousFangs) {
         target.statuses.push({ type: 'Poisoned' });
      }

      if (def.id === CID.Leech) {
          // Poison chance
          const poisonFlip = performCoinFlip('Leech Poison', getRNG(rng, rngIndex++), target.id);
          if (!poisonFlip) { // Tails = Poisoned
              target.statuses.push({ type: 'Poisoned' });
              log("Leech applied Poison!");
          }

          // Leech Status check
          const hasProtection = target.formation.some(c => 
              c.defId === CID.ArmoredScales || 
              c.defId === CID.ArmoredExoskeleton || 
              c.defId === CID.ThickFur
          );

          if (!hasProtection) {
              // Check if already leeched by this source
              const existing = target.statuses.find(s => s.type === 'Leeched' && s.sourceId === attacker.id);
              if (!existing) {
                  target.statuses.push({ type: 'Leeched', sourceId: attacker.id });
                  log(`${target.name} is Leeched!`);
                  notify("Leeched!", 'success');
              }
          } else {
              log(`${target.name}'s armor prevented Leeching.`);
              notify("Leech blocked by armor/fur.", 'warning');
          }
      }
      
      if (def.id === CID.GraspingTalons && performCoinFlip('Grapple Chance', getRNG(rng, rngIndex++), attacker.id)) {
          target.statuses.push({ type: 'Grappled' });
      }
      if (def.id === CID.StrongJaw) target.statuses.push({ type: 'Grappled' });
      
      if (def.id === CID.DeathRoll && performCoinFlip('Death Roll', getRNG(rng, rngIndex++), attacker.id)) {
          target.statuses.push({ type: 'Grappled' });
      }
  };

  switch (action.type) {
    case 'INIT_GAME':
      // Apply Game Start Bonuses
      Object.values(action.payload.players).forEach(p => {
        // Strong Build
        if (p.formation.some(c => c.defId === CID.StrongBuild)) {
          p.maxHp += 2; p.hp += 2;
        }
        // Desert Bonus
        if (action.payload.habitat === H.Desert && (p.creatureType === CT.Reptile || p.creatureType === CT.Mammal)) {
           p.maxHp += 2; p.hp += 2;
        }
        // Water Bonus
        if (action.payload.habitat === H.Water && p.creatureType === CT.Amphibian) {
           p.maxHp += 1; p.hp += 1;
        }
      });
      return action.payload;
      
    case 'UPDATE_STATE':
      return action.payload;

    case 'DISMISS_NOTIFICATION':
      newState.notifications = newState.notifications.filter(n => n.id !== action.id);
      return newState;

    case 'ACKNOWLEDGE_COIN_FLIP':
      newState.activeCoinFlip = null;
      return newState;

    case 'END_TURN': {
      const player = newState.players[action.playerId];
      const opponentId = Object.keys(newState.players).find(id => id !== action.playerId)!;
      
      // Clear temporary flags for end of turn
      player.guaranteedHeads = false; 
      player.statuses = player.statuses.filter(s => s.type !== 'DamageBuff'); // Remove 1-turn buffs
      
      // Clear Stuck at the end of the player's turn
      if (player.statuses.some(s => s.type === 'Stuck')) {
        log(`${player.name} is no longer Stuck.`);
        player.statuses = player.statuses.filter(s => s.type !== 'Stuck');
      }

      newState.currentPlayer = opponentId;
      newState.turn += 1;
      newState.phase = 'start';
      newState.activeCoinFlip = null; 
      newState.pendingReaction = null;
      newState.pendingChoice = null;

      const nextPlayer = newState.players[opponentId]; // The player starting their turn
      const previousPlayer = player; // The player who just ended turn

      let rngIndex = 0;
      
      // 1. Status Management & Start of Turn Effects
      
      // Confused Check (Start of Turn)
      if (nextPlayer.statuses.some(s => s.type === 'Confused')) {
           const flip = performCoinFlip('Confusion Check', getRNG(action.rng, rngIndex++), nextPlayer.id);
           if (flip) {
              notify(`${nextPlayer.name} snapped out of confusion!`, 'success');
              nextPlayer.statuses = nextPlayer.statuses.filter(s => s.type !== 'Confused');
           } else {
              notify(`${nextPlayer.name} is confused and cannot act!`, 'error');
           }
      }

      // Adrenaline Rush: Lose 1 stamina
      if (nextPlayer.statuses.some(s => s.type === 'StaminaDebt')) {
          nextPlayer.stamina = Math.max(0, nextPlayer.stamina - 1);
          log(`${nextPlayer.name} loses 1 Stamina from Adrenaline Rush.`);
          nextPlayer.statuses = nextPlayer.statuses.filter(s => s.type !== 'StaminaDebt');
      }

      // Recover Stamina
      if (nextPlayer.stamina < nextPlayer.maxStamina) {
        nextPlayer.stamina += 1;
      }

      // Poison
      if (nextPlayer.statuses.some(s => s.type === 'Poisoned')) {
          nextPlayer.hp -= 1;
          log(`${nextPlayer.name} took 1 poison damage.`);
          notify(`${nextPlayer.name} took Poison damage`, 'warning');
      }

      // Leech Damage (Victim takes damage)
      if (nextPlayer.statuses.some(s => s.type === 'Leeched')) {
          nextPlayer.hp -= 1;
          log(`${nextPlayer.name} took 1 damage from Leech.`);
          notify(`${nextPlayer.name} drained by Leech`, 'warning');
      }

      // Leech Healing (Attacker heals if they have an active leech on opponent)
      const leechOnOpponent = previousPlayer.statuses.find(s => s.type === 'Leeched' && s.sourceId === nextPlayer.id);
      if (leechOnOpponent) {
          if (nextPlayer.hp < nextPlayer.maxHp) {
              nextPlayer.hp += 1;
              log(`${nextPlayer.name} healed 1 HP from Leeching.`);
              notify("Healed from Leech!", 'success');
          }
      }

      // Clear Duration based statuses
      nextPlayer.statuses = nextPlayer.statuses.filter(s => {
        if (s.duration !== undefined) {
          s.duration -= 1;
          return s.duration > 0;
        }
        return true;
      });

      // 3. Reset Turn Flags
      nextPlayer.cardsPlayedThisTurn = 0;
      nextPlayer.hasActedThisTurn = false;

      // 4. Habitat Bonuses / Passive Traits
      if (newState.habitat === H.Water && nextPlayer.formation.some(c => c.defId === CID.Amphibious)) {
        nextPlayer.hp = Math.min(nextPlayer.maxHp, nextPlayer.hp + 1);
        log(`${nextPlayer.name} regenerates 1 HP (Amphibious).`);
      }

      // 5. Draw Card (UNIQUE LOGIC)
      if (nextPlayer.deck.length > 0) {
        // Loop until we find a card that is NOT in hand and NOT in formation (Duplicate Rule)
        let drawn = nextPlayer.deck.shift();
        let checks = 0;
        const MAX_CHECKS = nextPlayer.deck.length + 5; 

        while (drawn && checks < MAX_CHECKS) {
           const isDuplicate = nextPlayer.hand.some(c => c.defId === drawn!.defId) || 
                               nextPlayer.formation.some(c => c.defId === drawn!.defId);
           
           if (isDuplicate) {
              nextPlayer.deck.push(drawn); // Put back
              nextPlayer.deck.sort(() => 0.5 - Math.random()); // Shuffle
              drawn = nextPlayer.deck.shift();
              checks++;
           } else {
              break; // Found unique
           }
        }
  
        if (drawn) {
            const def = CARDS[drawn.defId];
            const isStillDuplicate = nextPlayer.hand.some(c => c.defId === drawn!.defId) || nextPlayer.formation.some(c => c.defId === drawn!.defId);
            
            if (isStillDuplicate) {
               log(`${nextPlayer.name} drew duplicate ${def.name} (Returned to deck).`);
               nextPlayer.deck.push(drawn);
            } else {
              // Rules: Size and PASSIVE Physical are played immediately.
              const isPassiveTrait = def.type === CType.Physical && def.staminaCost === 0 && !def.isUpgrade && def.id !== CID.Camouflage && def.id !== CID.CamouflageWater && def.id !== CID.Agile; 
              
              if ((isPassiveTrait && def.id !== CID.Camouflage && def.id !== CID.CamouflageWater) || def.type === CType.Size) {
                   // Check MAX LIMITS for Auto-Play Passives
                   const physicalCount = nextPlayer.formation.filter(c => CARDS[c.defId].type === CType.Physical).length;
                   const abilityCount = nextPlayer.formation.filter(c => CARDS[c.defId].type === CType.Ability).length;

                   if (def.type === CType.Physical && physicalCount >= 5) {
                       log(`${nextPlayer.name} drew ${def.name} but formation full (Added to Hand).`);
                       nextPlayer.hand.push(drawn);
                   } else if (def.type === CType.Ability && abilityCount >= 5) {
                       log(`${nextPlayer.name} drew ${def.name} but formation full (Added to Hand).`);
                       nextPlayer.hand.push(drawn);
                   } else {
                       nextPlayer.formation.push(drawn);
                       if (def.id === CID.StrongBuild) { nextPlayer.hp += 2; nextPlayer.maxHp += 2; }
                       log(`${nextPlayer.name} drew & played ${def.name} (Passive).`);
                       notify(`${def.name} auto-played`, 'info');
                   }
              } else {
                nextPlayer.hand.push(drawn);
                log(`${nextPlayer.name} drew a card.`);
              }
            }
        }
      }

      return newState;
    }

    case 'PLAY_EVOLVE_CARD': {
       const p = newState.players[action.playerId];
       if (p.stamina < 2) {
         notify("Need 2 Stamina to Evolve.", 'error');
         return state;
       }
       
       // Validate Formation Card
       const formationCardIdx = p.formation.findIndex(c => c.instanceId === action.targetFormationId);
       if (formationCardIdx === -1) {
         notify("Invalid Evolve target.", 'error');
         return state;
       }
       const formationCard = p.formation[formationCardIdx];

       // Validate Type (Cannot Evolve Size)
       if (CARDS[formationCard.defId].type === CType.Size) {
           notify("Cannot Evolve Size cards.", 'error');
           return state;
       }

       // Validate Evolve Card presence
       const evolveCardIdx = p.hand.findIndex(c => c.instanceId === action.evolveInstanceId);
       if (evolveCardIdx === -1) return state;
       
       // Discard Evolve
       p.hand.splice(evolveCardIdx, 1);

       // Validate Replacement Card
       const replaceCardIdx = p.hand.findIndex(c => c.instanceId === action.replacementHandId);
       if (replaceCardIdx === -1) {
         notify("Invalid Evolve selection.", 'error');
         return state;
       }
       const replacementCard = p.hand[replaceCardIdx];

       p.stamina -= 2;
       p.formation[formationCardIdx] = replacementCard;
       p.hand[replaceCardIdx] = formationCard; 
       
       log(`${p.name} Evolved! Swapped ${CARDS[formationCard.defId].name} with ${CARDS[replacementCard.defId].name}.`);
       notify("Evolution Complete!", 'success');
       return newState;
    }

    case 'PLAY_APEX_EVOLUTION': {
        const p = newState.players[action.playerId];
        
        // Basic Checks
        if (p.stamina < 2) { notify("Need 2 Stamina.", 'error'); return state; }
        
        const apexIdx = p.hand.findIndex(c => c.instanceId === action.apexCardInstanceId);
        if (apexIdx === -1) return state;

        const targetIdx = p.formation.findIndex(c => c.instanceId === action.targetFormationInstanceId);
        if (targetIdx === -1) { notify("Invalid formation target.", 'error'); return state; }
        
        const targetCard = p.formation[targetIdx];
        const targetDef = CARDS[targetCard.defId];

        // Find valid upgrade
        const allCards = Object.values(CARDS);
        const upgradeDef = allCards.find(c => c.isUpgrade && c.upgradeTarget?.includes(targetDef.id));

        if (!upgradeDef) {
            notify("That card cannot be upgraded.", 'error');
            return state;
        }

        // Execute Apex Evolution
        p.stamina -= 2;
        // Discard Apex Card
        p.hand.splice(apexIdx, 1);
        
        // Transform the formation card
        p.formation[targetIdx] = {
            ...targetCard,
            defId: upgradeDef.id,
            charges: upgradeDef.maxCharges
        };

        log(`${p.name} used Apex Evolution on ${targetDef.name}! It is now ${upgradeDef.name}.`);
        notify(`Apex Evolution: ${upgradeDef.name}!`, 'success');
        
        // It's a free action, so do not set hasActedThisTurn
        return newState;
    }

    case 'PLAY_CARD': {
      const p = newState.players[action.playerId];
      const cardIdx = p.hand.findIndex(c => c.instanceId === action.cardInstanceId);
      if (cardIdx === -1) return state;
      const card = p.hand[cardIdx];
      const def = CARDS[card.defId];

      if (def.isUpgrade) {
         if (!action.targetInstanceId) {
             notify("Select a valid target card in formation to upgrade.", 'error');
             return state;
         }
         
         const targetIndex = p.formation.findIndex(c => c.instanceId === action.targetInstanceId);
         if (targetIndex === -1) {
            notify("Target card not found.", 'error');
            return state;
         }
         
         const target = p.formation[targetIndex];
         if (!def.upgradeTarget?.includes(target.defId)) {
             notify(`Cannot upgrade ${CARDS[target.defId].name}.`, 'error');
             return state;
         }

         p.hand.splice(cardIdx, 1);
         p.formation[targetIndex] = {
            ...target,
            defId: card.defId, 
            charges: def.maxCharges 
         };
         
         log(`${p.name} upgraded ${CARDS[target.defId].name} to ${def.name}.`);
         notify(`Upgraded to ${def.name}`, 'success');
         p.cardsPlayedThisTurn++;
         return newState;
      }

      // MAX CARD LIMIT CHECK
      const physicalCount = p.formation.filter(c => CARDS[c.defId].type === CType.Physical).length;
      const abilityCount = p.formation.filter(c => CARDS[c.defId].type === CType.Ability).length;

      if (def.type === CType.Physical && physicalCount >= 5) {
         notify("Max 5 Physical cards active! Use Evolve or Upgrade.", 'error');
         return state;
      }
      if (def.type === CType.Ability && abilityCount >= 5) {
         notify("Max 5 Ability cards active! Use Evolve or Upgrade.", 'error');
         return state;
      }

      // Limit cards played (unless exceptions exist, currently none standard except passives which auto-play)
      if (p.cardsPlayedThisTurn >= 1) {
        notify("Can only play 1 card per turn!", 'error');
        return state;
      }

      if (p.formation.some(c => c.defId === def.id)) {
         notify(`You already have ${def.name} in play!`, 'error');
         return state;
      }

      if (def.id === CID.CrushingWeight && p.size !== 'Big') {
         notify("Only Big creatures can use Crushing Weight!", 'error');
         return state;
      }

      p.hand.splice(cardIdx, 1);
      p.formation.push(card);
      p.cardsPlayedThisTurn++;
      
      if (def.id === CID.StrongBuild) { p.hp += 2; p.maxHp += 2; }
      
      log(`${p.name} played ${def.name}.`);
      notify(`Played ${def.name}`, 'success');
      return newState;
    }

    case 'ATTEMPT_GRAPPLE_ESCAPE': {
        const p = newState.players[action.playerId];
        if (!p.statuses.some(s => s.type === 'Grappled')) return state;
        if (p.hasActedThisTurn) return state;

        const flip = performCoinFlip('Grapple Escape', getRNG(action.rng, 0), p.id);
        p.hasActedThisTurn = true;
        if (flip) {
            p.statuses = p.statuses.filter(s => s.type !== 'Grappled');
            log(`${p.name} broke free from Grapple!`);
            notify("Broke free!", 'success');
        } else {
            log(`${p.name} failed to break free.`);
            notify("Failed to break free.", 'warning');
        }
        return newState;
    }

    case 'USE_HABITAT_ACTION': {
       const p = newState.players[action.playerId];
       if (p.hasUsedForestHide) {
         notify("Already used Forest hide.", 'error');
         return state;
       }
       if (newState.habitat !== H.Forest) return state;

       const isHeads = performCoinFlip('Forest Hide', getRNG(action.rng, 0), p.id);
       p.hasUsedForestHide = true;
       
       if (isHeads) {
          p.statuses.push({ type: 'Hidden', duration: 100 });
          log(`${p.name} is hiding in the Forest!`);
          notify('You are now Hidden!', 'success');
       } else {
          log(`${p.name} failed to hide.`);
          notify('Failed to hide.', 'warning');
       }
       return newState;
    }

    case 'CLEAR_POISON': {
      const p = newState.players[action.playerId];
      if (!p.statuses.some(s => s.type === 'Poisoned')) return state;
      if (p.hasActedThisTurn) { notify("Already acted", 'error'); return state; }
      if (p.stamina < 1) { notify("Not enough stamina", 'error'); return state; }

      p.stamina -= 1;
      p.hasActedThisTurn = true;
      p.statuses = p.statuses.filter(s => s.type !== 'Poisoned');
      log(`${p.name} cured Poison.`);
      notify("Cured Poison!", 'success');
      return newState;
    }

    case 'CLEAR_LEECH': {
        const p = newState.players[action.playerId];
        if (!p.statuses.some(s => s.type === 'Leeched')) return state;
        if (p.hasActedThisTurn) { notify("Already acted", 'error'); return state; }
        if (p.stamina < 1) { notify("Not enough stamina", 'error'); return state; }
  
        p.stamina -= 1;
        p.hasActedThisTurn = true;
        p.statuses = p.statuses.filter(s => s.type !== 'Leeched');
        log(`${p.name} removed Leech.`);
        notify("Removed Leech!", 'success');
        return newState;
    }

    case 'RESOLVE_CHOICE': {
        const p = newState.players[action.playerId];
        const opponentId = Object.keys(newState.players).find(id => id !== action.playerId)!;
        const opponent = newState.players[opponentId];

        if (!newState.pendingChoice || newState.pendingChoice.playerId !== p.id) return state;
        
        log(`${p.name} chose ${action.choice} for Big Claws!`);
        
        newState.pendingChoice = null;
        p.hasActedThisTurn = true;
        
        if (action.choice === 'Attack') {
             resolveAttackDamage(p, opponent, CARDS[CID.BigClaws], action.rng);
        } else if (action.choice === 'Dig') {
             p.statuses.push({ type: 'Hidden', duration: 1 });
             notify("Used Dig (Hidden)", 'success');
        } else if (action.choice === 'Climb') {
             p.statuses.push({ type: 'Climbing', duration: 1 });
             notify("Used Climb (Climbing Status)", 'success');
        }

        return newState;
    }

    case 'RESOLVE_AGILE': {
        if (!newState.pendingReaction) return state;
        const { attackerId, targetId, attackCardId } = newState.pendingReaction;
        const attacker = newState.players[attackerId];
        const target = newState.players[targetId];
        const def = CARDS[attackCardId];

        newState.pendingReaction = null;

        if (action.useAgile && target.stamina >= 2) {
            target.stamina -= 2;
            log(`${target.name} Evaded ${def.name} using Agile!`);
            notify("Evaded!", 'success');
            
            if (target.formation.some(c => c.defId === CID.SwiftReflexes)) {
                target.stamina += 1;
                notify("Swift Reflexes refund (+1 ST)", 'info');
            }
        } else {
            // If chose not to evade or couldn't afford it, resolve damage
            resolveAttackDamage(attacker, target, def, action.rng);
        }
        
        return newState;
    }

    case 'USE_ACTION': {
        const p = newState.players[action.playerId];
        const target = newState.players[action.targetPlayerId];
        const cardInstance = p.formation.find(c => c.instanceId === action.cardInstanceId);
        if (!cardInstance) return state;
        
        const def = CARDS[cardInstance.defId];
        
        // Validation
        if (p.hasActedThisTurn && def.abilityStatus !== AS.None && def.id !== CID.ShortBurst && def.id !== CID.AdrenalineRush && def.id !== CID.EnhancedSmell && def.id !== CID.Focus && def.id !== CID.Agile) {
            notify("Already acted this turn!", 'error');
            return state;
        }
        if (p.stamina < def.staminaCost) {
            notify(`Need ${def.staminaCost} Stamina!`, 'error');
            return state;
        }

        // STATUS CHECKS
        if (p.statuses.some(s => s.type === 'Stuck')) {
            if (def.type === CType.Physical || (def.type === CType.Ability && def.id === CID.Dig)) {
                notify("You are Stuck! Cannot move/attack.", 'error');
                return state;
            }
        }
        if (p.statuses.some(s => s.type === 'CannotAttack') && def.type === CType.Physical) {
            notify("Cannot Attack due to Roar!", 'error');
            return state;
        }
        if (p.statuses.some(s => s.type === 'Grappled')) {
             if (def.id !== CID.Focus && def.id !== CID.Rage && def.type !== CType.Physical) {
                 notify("Grappled! Can only Attack or use Breakout abilities.", 'error');
                 return state;
             }
             // Must flip heads to attack while grappled
             if (def.type === CType.Physical) {
                 const flip = performCoinFlip('Grappled Attack', getRNG(action.rng, 0), p.id);
                 if (!flip) {
                     p.stamina -= def.staminaCost;
                     p.hasActedThisTurn = true;
                     notify("Attack failed due to Grapple.", 'warning');
                     return newState;
                 }
             }
        }
        
        // Confused Check (Before Action)
        if (p.statuses.some(s => s.type === 'Confused')) {
            const flip = performCoinFlip('Confusion Action Check', getRNG(action.rng, 0), p.id);
            if (!flip) {
                p.stamina -= def.staminaCost;
                p.hasActedThisTurn = true;
                log(`${p.name} is confused and hurt themselves!`);
                p.hp -= 1;
                notify("Confusion caused self-harm!", 'error');
                return newState;
            }
        }

        // Pay Cost
        p.stamina -= def.staminaCost;
        
        // Mark action used (unless free action)
        const isFreeAction = def.id === CID.ShortBurst || def.id === CID.AdrenalineRush || def.id === CID.EnhancedSmell || def.id === CID.Focus || def.id === CID.Rage || (def.id === CID.Agile && def.type === CType.Ability);
        if (!isFreeAction) {
            p.hasActedThisTurn = true;
        }

        // Handle Consumables
        if (def.abilityStatus === AS.ConsumableImpact) {
             const idx = p.formation.findIndex(c => c.instanceId === cardInstance.instanceId);
             if (idx !== -1) {
                 p.formation.splice(idx, 1);
                 p.discard.push(cardInstance);
             }
        }

        let rngIndex = 1;

        // PHYSICAL ATTACK LOGIC
        if (def.type === CType.Physical) {
            
            // Handle Big Claws Choice Trigger
            if (def.id === CID.BigClaws) {
                newState.pendingChoice = {
                    id: Math.random().toString(),
                    playerId: action.playerId,
                    cardId: def.id,
                    options: ['Attack', 'Dig', 'Climb'],
                    targetPlayerId: action.targetPlayerId
                };
                return newState;
            }

            // Check Climbing Evasion (Attacker must be Flying to hit a Climbing target)
            const targetIsClimbing = target.statuses.some(s => s.type === 'Climbing');
            const attackerIsFlying = p.statuses.some(s => s.type === 'Flying') || def.id === CID.DiveBomb; // Dive Bomb implies flying momentarily
            
            if (targetIsClimbing && !attackerIsFlying) {
                log(`${p.name}'s attack missed because ${target.name} is Climbing!`);
                notify("Miss! Target is Climbing.", 'warning');
                return newState;
            }

            // Check Accuracy / Evasion
            const isAccurate = p.statuses.some(s => s.type === 'Accurate') || p.statuses.some(s => s.type === 'Chasing');
            const targetHidden = target.statuses.some(s => s.type === 'Hidden');
            const targetCamouflaged = target.statuses.some(s => s.type === 'Camouflaged');
            const targetFlying = target.statuses.some(s => s.type === 'Flying');
            const targetEvading = target.statuses.some(s => s.type === 'Evading');
            
            // Forced Miss Conditions
            if (!isAccurate) {
                if (targetHidden) {
                    log(`${p.name} missed (Target Hidden).`);
                    notify("Miss! Target Hidden.", 'warning');
                    return newState;
                }
                if (targetEvading) {
                     log(`${p.name} missed (Target Evaded).`);
                     notify("Miss! Target Evaded.", 'warning');
                     target.statuses = target.statuses.filter(s => s.type !== 'Evading');
                     return newState;
                }
                if (targetCamouflaged && !performCoinFlip('Camouflage Miss Chance', getRNG(action.rng, rngIndex++), p.id)) {
                    log(`${p.name} missed (Camouflage).`);
                    notify("Miss! Camouflage.", 'warning');
                    return newState;
                }
                if (targetFlying && !performCoinFlip('Flying Miss Chance', getRNG(action.rng, rngIndex++), p.id)) {
                    log(`${p.name} missed (Target Flying).`);
                    notify("Miss! Target Flying.", 'warning');
                    return newState;
                }
                // Water Camouflage
                if (newState.habitat === H.Water && target.formation.some(c => c.defId === CID.CamouflageWater)) {
                    if (!performCoinFlip('Water Camo', getRNG(action.rng, rngIndex++), p.id)) {
                        log(`${p.name} missed (Water Camo).`);
                        return newState;
                    }
                }
                // Stand on Hind Legs
                if (target.formation.some(c => c.defId === CID.StandOnHindLegs)) {
                     if (!performCoinFlip('Intimidation', getRNG(action.rng, rngIndex++), p.id)) {
                         log(`${p.name} was intimidated and missed.`);
                         notify("Intimidated! Miss.", 'warning');
                         return newState;
                     }
                }
            }

            // Agile Reaction Trigger (Opponent can pay to evade)
            const canTargetEvade = target.formation.some(c => c.defId === CID.SmallSize || c.defId === CID.Agile) && target.stamina >= 2 && !target.statuses.some(s => s.type === 'Grappled' || s.type === 'CannotEvade' || s.type === 'Stuck');
            
            // If attacking with Ambush, flip for evade prevention
            let ambushPrevent = false;
            if (def.id === CID.AmbushAttack) {
                 if (performCoinFlip('Ambush', getRNG(action.rng, rngIndex++), p.id)) ambushPrevent = true;
            }
            if (def.id === CID.SwimFast) ambushPrevent = true; // Swim fast prevents evasion

            if (canTargetEvade && !ambushPrevent && !isAccurate) {
                 newState.pendingReaction = {
                     type: 'AGILE_EVADE',
                     attackerId: p.id,
                     targetId: target.id,
                     attackCardId: def.id
                 };
                 log(`${target.name} can Evade! Waiting for reaction...`);
                 return newState;
            }
            
            // Resolve Damage directly if no reaction
            resolveAttackDamage(p, target, def, action.rng);

        } else {
            // ABILITY LOGIC
            if (def.id === CID.ShortBurst) { p.stamina += 1; notify("+1 Stamina", 'success'); }
            if (def.id === CID.AdrenalineRush) { p.stamina += 1; p.statuses.push({ type: 'StaminaDebt' }); notify("Adrenaline Rush!", 'success'); }
            if (def.id === CID.Confuse) {
                if (target.formation.some(c => c.defId === CID.Intelligence)) {
                    log(`${target.name} is immune to Confusion.`);
                    notify("Immune!", 'info');
                } else if (performCoinFlip('Confuse', getRNG(action.rng, rngIndex++), p.id)) {
                    target.statuses.push({ type: 'Confused', duration: 1 });
                    log(`${target.name} is Confused!`);
                } else {
                    notify("Confuse failed.", 'warning');
                }
            }
            if (def.id === CID.Dig) {
                p.statuses.push({ type: 'Hidden', duration: 1 });
                log(`${p.name} used Dig.`);
            }
            if (def.id === CID.Freeze) {
                 if (performCoinFlip('Freeze', getRNG(action.rng, rngIndex++), p.id)) {
                     p.statuses.push({ type: 'Hidden', duration: 1 });
                     log(`${p.name} froze and is Hidden.`);
                 }
            }
            if (def.id === CID.Flight) {
                p.statuses.push({ type: 'Flying', duration: 3 }); // Temporary flight
                log(`${p.name} took flight!`);
            }
            if (def.id === CID.Roar) {
                 if (performCoinFlip('Roar', getRNG(action.rng, rngIndex++), p.id)) {
                     target.statuses.push({ type: 'CannotAttack', duration: 1 });
                     log(`${target.name} is terrified by Roar!`);
                 }
            }
            if (def.id === CID.Hibernate) {
                p.hp = Math.min(p.maxHp, p.hp + 2);
                if (p.hp === p.maxHp) p.stamina += 1;
                log(`${p.name} hibernated.`);
            }
            if (def.id === CID.Regeneration) {
                p.hp = Math.min(p.maxHp, p.hp + 4);
                log(`${p.name} regenerated health.`);
            }
            if (def.id === CID.ToxicSpit) {
                const flip = performCoinFlip('Toxic Spit', getRNG(action.rng, rngIndex++), p.id);
                if (flip) target.statuses.push({ type: 'Poisoned' });
                else target.statuses.push({ type: 'Stuck', duration: 1 });
            }
            if (def.id === CID.Focus) {
                p.statuses = p.statuses.filter(s => s.type !== 'Grappled' && s.type !== 'Stuck');
                p.guaranteedHeads = true;
                p.statuses.push({ type: 'DamageBuff', duration: 1 });
                log(`${p.name} Focused! Breakout + Dmg + Guaranteed Heads.`);
            }
            if (def.id === CID.Rage) {
                p.statuses = p.statuses.filter(s => s.type !== 'Grappled' && s.type !== 'Stuck');
                p.statuses.push({ type: 'DamageBuff', duration: 1 });
                log(`${p.name} Enraged!`);
            }
            if (def.id === CID.StickyTongue) {
                if (performCoinFlip('Sticky Tongue', getRNG(action.rng, rngIndex++), p.id)) {
                    target.statuses.push({ type: 'Stuck', duration: 1 });
                }
            }
            if (def.id === CID.ShedSkin) {
                p.statuses = p.statuses.filter(s => s.type === 'DamageBuff' || s.type === 'Hidden' || s.type === 'Flying'); // Keep buffs
                log(`${p.name} Shed Skin (Cured Statuses).`);
            }
            if (def.id === CID.TerritorialDisplay) {
                if (performCoinFlip('Display', getRNG(action.rng, rngIndex++), p.id)) {
                    target.hand = []; // Discard Hand
                    log(`${target.name} fled and dropped their hand!`);
                    notify("Opponent Hand Discarded!", 'success');
                }
            }
            if (def.id === CID.EnhancedSmell) {
                target.statuses = target.statuses.filter(s => s.type !== 'Hidden' && s.type !== 'Camouflaged');
                p.statuses.push({ type: 'Chasing', duration: 1 });
                log(`${p.name} sniffed out the opponent!`);
            }
            if (def.id === CID.ExhaustingRoar) {
                if (performCoinFlip('Exhaust Roar', getRNG(action.rng, rngIndex++), p.id)) {
                    target.stamina = Math.max(0, target.stamina - 1);
                    log(`${target.name} lost stamina from Roar.`);
                }
            }
            if (def.id === CID.Agile) {
                p.statuses.push({ type: 'Accurate', duration: 1 });
                log(`${p.name} is moving with Agility (Accurate).`);
            }
            if (def.id === CID.Copycat && action.targetHandCardId) {
                 const targetCardIdx = target.hand.findIndex(c => c.instanceId === action.targetHandCardId);
                 if (targetCardIdx !== -1) {
                     const stolen = target.hand.splice(targetCardIdx, 1)[0];
                     p.hand.push(stolen);
                     log(`${p.name} copied/stole ${CARDS[stolen.defId].name}!`);
                     notify("Card Stolen!", 'success');
                 }
            }
        }

        return newState;
    }
      
    default:
      return state;
  }
};
