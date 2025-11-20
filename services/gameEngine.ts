
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
      
      newState.currentPlayer = opponentId;
      newState.turn += 1;
      newState.phase = 'start';
      newState.activeCoinFlip = null; 

      const nextPlayer = newState.players[opponentId];
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

      // Clear Stuck automatically after opponent's next turn (which is now)
      if (nextPlayer.statuses.some(s => s.type === 'Stuck')) {
          log(`${nextPlayer.name} is no longer Stuck.`);
          nextPlayer.statuses = nextPlayer.statuses.filter(s => s.type !== 'Stuck');
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
              const isPassiveTrait = def.type === CType.Physical && def.staminaCost === 0 && !def.isUpgrade && def.id !== CID.Camouflage; 
              
              if ((isPassiveTrait && def.id !== CID.Camouflage) || def.type === CType.Size) {
                   nextPlayer.formation.push(drawn);
                   if (def.id === CID.StrongBuild) { nextPlayer.hp += 2; nextPlayer.maxHp += 2; }
                   log(`${nextPlayer.name} drew & played ${def.name} (Passive).`);
                   notify(`${def.name} auto-played`, 'info');
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
       const evolveCardIdx = p.hand.findIndex(c => c.instanceId === action.evolveInstanceId);
       if (evolveCardIdx === -1) return state;
       p.hand.splice(evolveCardIdx, 1);

       const formationCardIdx = p.formation.findIndex(c => c.instanceId === action.targetFormationId);
       const replaceCardIdx = p.hand.findIndex(c => c.instanceId === action.replacementHandId);

       if (formationCardIdx === -1 || replaceCardIdx === -1) {
         notify("Invalid Evolve selection.", 'error');
         return state;
       }

       const formationCard = p.formation[formationCardIdx];
       const replacementCard = p.hand[replaceCardIdx];

       p.stamina -= 2;
       p.formation[formationCardIdx] = replacementCard;
       p.hand[replaceCardIdx] = formationCard; 
       
       log(`${p.name} Evolved! Swapped ${CARDS[formationCard.defId].name} with ${CARDS[replacementCard.defId].name}.`);
       notify("Evolution Complete!", 'success');
       return newState;
    }

    case 'PLAY_CARD': {
      const p = newState.players[action.playerId];
      const cardIdx = p.hand.findIndex(c => c.instanceId === action.cardInstanceId);
      if (cardIdx === -1) return state;
      const card = p.hand[cardIdx];
      const def = CARDS[card.defId];

      if (def.creatureTypes !== 'All' && !def.creatureTypes.includes(p.creatureType)) {
         notify(`Cannot play ${def.name} (Wrong Type)`, 'error');
         return state;
      }

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

      // Focus bypasses the 1-card limit
      if (p.cardsPlayedThisTurn >= 1 && def.id !== CID.Focus) {
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
      
      // FOCUS LOGIC
      if (def.id === CID.Focus) {
          // Focus is played and consumed.
          p.discard.push(card);
          
          // Grant effects:
          // 1. Next flip guaranteed heads
          p.guaranteedHeads = true;
          
          // 2. Allows playing another card.
          // Since we just "played" Focus (which might have bypassed the limit),
          // we want to ensure the counter allows exactly one more card relative to before Focus.
          // If count was 0, we play Focus -> count 0.
          // If count was 1, we play Focus -> count 0.
          if (p.cardsPlayedThisTurn > 0) {
              p.cardsPlayedThisTurn--;
          }
          
          log(`${p.name} played Focus! Guaranteed Heads & Extra Card.`);
          notify("Focus! Next flip Heads + Play Card.", 'success');
          return newState;
      }

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
      log(`${p.name} cleared Poison.`);
      notify('Poison cleared', 'success');
      return newState;
    }

    case 'USE_ACTION': {
      const p = newState.players[action.playerId];
      const target = newState.players[action.targetPlayerId];
      const cardInFormation = p.formation.find(c => c.instanceId === action.cardInstanceId);
      const def = cardInFormation ? CARDS[cardInFormation.defId] : null;

      if (!def) return state;

      const isConfused = p.statuses.some(s => s.type === 'Confused');
      const isGrappled = p.statuses.some(s => s.type === 'Grappled');
      const isStuck = p.statuses.some(s => s.type === 'Stuck');

      if (isConfused) {
         notify("You are Confused and cannot act!", 'error');
         return state;
      }
      
      if (isStuck && action.actionType === 'ATTACK') {
         notify("You are Stuck and cannot attack!", 'error');
         return state;
      }

      if (p.hasActedThisTurn && def.id !== CID.EnhancedSmell) {
         notify("Already acted this turn!", 'error');
         return state;
      }
      if (p.stamina < def.staminaCost) {
        notify("Not enough Stamina!", 'error');
        return state;
      }

      // Grapple Check for Attacks
      if (isGrappled && action.actionType === 'ATTACK') {
          notify("You are Grappled! Must flip heads to attack.", 'warning');
          const grappleFlip = performCoinFlip('Grappled Attack Check', getRNG(action.rng, 0), p.id);
          if (!grappleFlip) {
              p.stamina -= def.staminaCost; 
              p.hasActedThisTurn = true;
              log(`${p.name} failed grapple check.`);
              return newState;
          } else {
              log(`${p.name} overcame grapple!`);
              p.statuses = p.statuses.filter(s => s.type !== 'Grappled');
          }
      }

      p.stamina -= def.staminaCost;
      if (def.id !== CID.Rage && def.id !== CID.EnhancedSmell) {
        p.hasActedThisTurn = true;
      }

      let rngIndex = 1;

      // -- ATTACK (and Physical Utility) --
      if (action.actionType === 'ATTACK') {
         // Handle Physical Utilities that don't deal standard damage
         if (def.id === CID.Camouflage) {
            if (performCoinFlip('Camouflage', getRNG(action.rng, rngIndex++), p.id)) {
               p.statuses.push({ type: 'Camouflaged' });
               notify("Camouflaged!", 'success');
            } else {
               notify("Failed to Camouflage.", 'warning');
            }
            // Consumes charge if any
            if (cardInFormation && cardInFormation.charges !== undefined) {
                cardInFormation.charges -= 1;
                if (cardInFormation.charges <= 0) {
                    p.formation = p.formation.filter(c => c.instanceId !== action.cardInstanceId);
                }
            }
            return newState;
         }

         if (def.id === CID.AmbushAttack) {
             if (performCoinFlip('Ambush Attack Setup', getRNG(action.rng, rngIndex++), p.id)) {
                 target.statuses.push({ type: 'CannotEvade', duration: 2 }); // Lasts until they are attacked?
                 notify("Ambush set! Opponent cannot evade.", 'success');
             } else {
                 notify("Ambush failed.", 'warning');
             }
             return newState;
         }

         let damage = 0;
         let hit = true;
         
         // Base Damage
         if (def.id === CID.Bite) damage = 3;
         else if (def.id === CID.ClawAttack) damage = 2;
         else if (def.id === CID.GraspingTalons) damage = 2;
         else if (def.id === CID.VenomousFangs) damage = 1;
         else if (def.id === CID.DiveBomb) damage = 4;
         else if (def.id === CID.StrongTail) damage = 2;
         else if (def.id === CID.BigClaws) damage = 3;
         else if (def.id === CID.PiercingBeak) damage = 2;
         else if (def.id === CID.CrushingWeight) damage = 4;
         else if (def.id === CID.DeathRoll) damage = 4;
         else if (def.id === CID.StrongJaw) damage = 3; 
         else if (def.id === CID.LargeHindLegs && (p.size === 'Medium' || p.size === 'Big')) damage = 2;

         if (p.formation.some(c => c.defId === CID.StrongBuild)) damage += 1;
         if (newState.habitat === H.Water && p.formation.some(c => c.defId === CID.SwimsWell)) damage += 2;
         if (newState.habitat === H.Water && p.creatureType === CT.Amphibian) damage += 1;

         // HIT LOGIC
         const isTargetHidden = target.statuses.some(s => s.type === 'Hidden') || target.statuses.some(s => s.type === 'Camouflaged');
         if (isTargetHidden) {
             const hasDetection = p.formation.some(c => c.defId === CID.KeenEyesight || c.defId === CID.Whiskers || c.defId === CID.EnhancedSmell); 
             if (!hasDetection) {
                if (target.statuses.some(s => s.type === 'Camouflaged')) {
                   const flip = performCoinFlip('Attack Camouflaged', getRNG(action.rng, rngIndex++), p.id);
                   if (!flip) {
                      log(`${p.name} missed Camouflaged target.`);
                      notify("Missed (Camouflaged)!", 'warning');
                      hit = false;
                   }
                } else {
                   log(`${p.name} cannot find Hidden target.`);
                   notify("Target is Hidden!", 'error');
                   hit = false;
                }
             } else {
                log(`${p.name} spotted Hidden target!`);
             }
         } else if (target.formation.some(c => c.defId === CID.CamouflageWater) && newState.habitat === H.Water) {
             const flip = performCoinFlip('Water Camouflage', getRNG(action.rng, rngIndex++), p.id);
             if (!flip) {
                 log(`${p.name} missed (Water Ambush).`);
                 hit = false;
             }
         }

         if (hit && target.statuses.some(s => s.type === 'Flying')) {
            const flip = performCoinFlip('Hit Flying Target', getRNG(action.rng, rngIndex++), p.id);
            if (!flip) {
               log(`${p.name} missed Flying target.`);
               hit = false;
            }
         }

         // Evasion
         if (hit) {
             const cannotEvade = target.statuses.some(s => s.type === 'CannotEvade') || (def.id === CID.AmbushAttack && false); // Ambush handled above
             if (!cannotEvade) {
                const evades = target.formation.filter(c => c.defId === CID.LargeHindLegs || c.defId === CID.SwimFast);
                if (evades.length > 0 && !target.statuses.some(s => s.type === 'Grappled')) { 
                    const evadeFlip = performCoinFlip('Evasion Attempt', getRNG(action.rng, rngIndex++), target.id);
                    if (evadeFlip) {
                        log(`${target.name} evaded the attack!`);
                        hit = false;
                        if (target.formation.some(c => c.defId === CID.SwiftReflexes) && target.stamina < target.maxStamina) {
                            target.stamina += 1;
                            log(`${target.name} gained Stamina (Swift Reflexes).`);
                        }
                    }
                }
             }
         }

         if (hit) {
            // Defense Calculation
            let defense = 0;
            if (target.formation.some(c => c.defId === CID.ArmoredScales)) defense += 1;
            if (target.formation.some(c => c.defId === CID.ThickFur)) defense += 1;
            if (target.formation.some(c => c.defId === CID.Fur) && performCoinFlip('Fur Defense', getRNG(action.rng, rngIndex++), target.id)) defense += 1;
            if (target.formation.some(c => c.defId === CID.ArmoredExoskeleton)) {
               if (!performCoinFlip('Exoskeleton', getRNG(action.rng, rngIndex++), p.id)) defense += 2;
            }

            if (def.id === CID.DiveBomb) defense = 0; 

            // Spiky Body
            if (target.formation.some(c => c.defId === CID.SpikyBody)) {
               const attackerAgile = p.size === 'Small';
               if (!attackerAgile) {
                  p.hp -= 1;
                  log(`${p.name} took 1 dmg (Spiky Body).`);
               } else {
                  if (performCoinFlip('Spiky Body (Agile)', getRNG(action.rng, rngIndex++), p.id)) {
                      p.hp -= 1;
                  } else {
                      damage += 1;
                  }
               }
            }
            
            // Barbed Quills
            if (def.id === CID.StrongJaw || def.id === CID.GraspingTalons || def.id === CID.DeathRoll) {
                const quillsIdx = target.formation.findIndex(c => c.defId === CID.BarbedQuills);
                if (quillsIdx !== -1) {
                    p.hp -= 2;
                    log(`${p.name} took 2 dmg (Barbed Quills). Grapple prevented.`);
                    target.formation.splice(quillsIdx, 1);
                }
            }

            let finalDmg = Math.max(0, damage - defense);
            target.hp -= finalDmg;
            log(`${p.name} attacked for ${finalDmg} dmg.`);
            notify(`Dealt ${finalDmg} damage!`, 'success');

            // On Hit Effects
            if (def.id === CID.VenomousFangs || (def.id === CID.PoisonSkin && performCoinFlip('Poison Skin', getRNG(action.rng, rngIndex++), p.id))) {
               target.statuses.push({ type: 'Poisoned' });
            }
            
            if (def.id === CID.GraspingTalons && performCoinFlip('Grapple Chance', getRNG(action.rng, rngIndex++), p.id)) {
                target.statuses.push({ type: 'Grappled' });
            }
            if (def.id === CID.StrongJaw) target.statuses.push({ type: 'Grappled' });
            
            if (def.id === CID.DeathRoll && performCoinFlip('Death Roll', getRNG(action.rng, rngIndex++), p.id)) {
                target.statuses.push({ type: 'Grappled' });
            }
         }
      }

      // -- ABILITY --
      else if (action.actionType === 'ABILITY') {
         log(`${p.name} used ability ${def.name}.`);

         if (def.id === CID.Hibernate) {
            if (p.hp < p.maxHp - 2) p.hp += 2; else p.stamina += 1;
         }
         else if (def.id === CID.Regeneration) {
            p.hp = Math.min(p.maxHp, p.hp + 4);
         }
         else if (def.id === CID.EnhancedSmell) {
            target.statuses = target.statuses.filter(s => s.type !== 'Hidden');
            notify("Revealed hidden opponent!", 'success');
            p.hasActedThisTurn = false; 
         }
         else if (def.id === CID.Confuse) {
            if (performCoinFlip('Confuse', getRNG(action.rng, rngIndex++), p.id)) {
               if (!target.formation.some(c => c.defId === CID.Intelligence)) {
                  target.statuses.push({ type: 'Confused' });
               } else notify("Blocked by Intelligence", 'warning');
            }
         }
         else if (def.id === CID.ToxicSpit) {
             if (performCoinFlip('Toxic Spit', getRNG(action.rng, rngIndex++), p.id)) {
                 target.statuses.push({ type: 'Poisoned' });
             } else {
                 target.statuses.push({ type: 'Stuck', duration: 1 }); 
             }
         }
         else if (def.id === CID.StickyTongue) {
             if (performCoinFlip('Sticky Tongue', getRNG(action.rng, rngIndex++), p.id)) {
                 target.statuses.push({ type: 'Stuck' });
                 if (target.size === 'Small') target.hp -= 1;
             }
         }
         else if (def.id === CID.AdrenalineRush) {
             p.stamina += 1;
             p.statuses.push({ type: 'StaminaDebt', duration: 1 }); 
             notify("Gained +1 Stamina (Debt next turn)", 'success');
         }
         else if (def.id === CID.TerritorialDisplay) {
             if (performCoinFlip('Territorial Display', getRNG(action.rng, rngIndex++), p.id)) {
                 target.hand = [];
                 notify("Opponent discarded hand!", 'success');
             }
         }
         else if (def.id === CID.ExhaustingRoar) {
             if (performCoinFlip('Exhausting Roar', getRNG(action.rng, rngIndex++), p.id)) {
                 target.stamina = Math.max(0, target.stamina - 1);
             }
         }
         else if (def.id === CID.ShedSkin) {
             p.statuses = [];
         }
         else if (def.id === CID.Rage) {
            p.hasActedThisTurn = false;
         }
         else if (def.id === CID.Copycat) {
            if (action.targetHandCardId) {
               const targetHandIdx = target.hand.findIndex(c => c.instanceId === action.targetHandCardId);
               if (targetHandIdx !== -1) {
                  const stolenCard = target.hand.splice(targetHandIdx, 1)[0];
                  p.hand.push(stolenCard);
                  notify(`Stole ${CARDS[stolenCard.defId].name}!`, 'success');
               } else {
                  notify("Failed to steal card.", 'error');
               }
            }
         }
         
         // Consumable Removal
         if (def.abilityStatus === AS.ConsumableImpact) {
            p.formation = p.formation.filter(c => c.instanceId !== action.cardInstanceId);
         }
      }

      if (target.hp <= 0) {
         newState.winner = p.id;
         log(`${p.name} Wins!`);
         notify(`${p.name} Wins!`, 'success');
      }
      
      return newState;
    }

    default:
      return state;
  }
};
