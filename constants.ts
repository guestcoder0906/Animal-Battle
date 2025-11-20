
import { CardDef, CardId, CardType, AbilityStatus, CreatureType, Habitat } from './types';

export const CARDS: Record<string, CardDef> = {
  // --- SIZES ---
  [CardId.SmallSize]: {
    id: CardId.SmallSize, name: "Small Size", type: CardType.Size, abilityStatus: AbilityStatus.None,
    creatureTypes: 'All', habitats: 'All', staminaCost: 0, description: "HP: 10, Stamina: 4. Agile."
  },
  [CardId.MediumSize]: {
    id: CardId.MediumSize, name: "Medium Size", type: CardType.Size, abilityStatus: AbilityStatus.None,
    creatureTypes: 'All', habitats: 'All', staminaCost: 0, description: "HP: 15, Stamina: 3. Balanced."
  },
  [CardId.BigSize]: {
    id: CardId.BigSize, name: "Big Size", type: CardType.Size, abilityStatus: AbilityStatus.None,
    creatureTypes: 'All', habitats: 'All', staminaCost: 0, description: "HP: 20, Stamina: 2. Powerful."
  },

  // --- SPECIAL ---
  [CardId.Evolve]: {
    id: CardId.Evolve, name: "Evolve", type: CardType.Special, abilityStatus: AbilityStatus.ConsumableImpact,
    creatureTypes: 'All', habitats: 'All', staminaCost: 2,
    description: "Swap a played card with a card in your hand. Discard Evolve after use."
  },

  // --- PHYSICAL ---
  [CardId.SpikyBody]: {
    id: CardId.SpikyBody, name: "Spiky Body", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Mammal, CreatureType.Reptile], habitats: 'All', staminaCost: 0,
    description: "Attacking creature is damaged 1 unless Agile. If Agile, flip coin: heads = attacker takes 1 damage, tails = attack deals +1 damage."
  },
  [CardId.ArmoredExoskeleton]: {
    id: CardId.ArmoredExoskeleton, name: "Armored Exoskeleton", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Mammal, CreatureType.Reptile], habitats: [Habitat.Desert], staminaCost: 0,
    description: "Attacking creature flips coin; tails = attack deals 2 less damage."
  },
  [CardId.ClawAttack]: {
    id: CardId.ClawAttack, name: "Claw Attack", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Avian, CreatureType.Reptile, CreatureType.Mammal], habitats: 'All', staminaCost: 1,
    description: "Deal 2 damage to opponent."
  },
  [CardId.Camouflage]: {
    id: CardId.Camouflage, name: "Camouflage", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: 'All', habitats: 'All', staminaCost: 0,
    description: "Flip coin. Heads = successfully camouflaged, opponent cannot attack until they flip heads at start of their turn.",
    maxCharges: 2
  },
  [CardId.Whiskers]: {
    id: CardId.Whiskers, name: "Whiskers", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Mammal], habitats: 'All', staminaCost: 0,
    description: "Enhances senses; opponent stealth cards fail automatically."
  },
  [CardId.StrongJaw]: {
    id: CardId.StrongJaw, name: "Strong Jaw Grip", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Mammal, CreatureType.Reptile], habitats: 'All', staminaCost: 2,
    description: "Upgrade Bite. Deals total 3 damage and grapples opponent, they deal +1 damage while they are grappled.",
    isUpgrade: true, upgradeTarget: [CardId.Bite]
  },
  [CardId.Bite]: {
    id: CardId.Bite, name: "Bite", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Mammal, CreatureType.Reptile, CreatureType.Avian], habitats: 'All', staminaCost: 1,
    description: "Deal 3 damage. Can combine with Strong Jaw Grip."
  },
  [CardId.Fur]: {
    id: CardId.Fur, name: "Fur", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Mammal], habitats: 'All', staminaCost: 0,
    description: "Reduces 1 damage from attacks that you flipped heads."
  },
  [CardId.ThickFur]: {
    id: CardId.ThickFur, name: "Thick Fur", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Mammal], habitats: 'All', staminaCost: 0,
    description: "Reduces 1 damage from all attacks."
  },
  [CardId.StandOnHindLegs]: {
    id: CardId.StandOnHindLegs, name: "Stand on Hind Legs", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Mammal], habitats: 'All', staminaCost: 0,
    description: "Intimidation; opponent flips coin before attacking: tails = opponent loses attack."
  },
  [CardId.SwimsWell]: {
    id: CardId.SwimsWell, name: "Swims Well", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Mammal, CreatureType.Amphibian], habitats: [Habitat.Water], staminaCost: 0,
    description: "+2 damage in Water habitat."
  },
  [CardId.StrongBuild]: {
    id: CardId.StrongBuild, name: "Strong Build", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Mammal, CreatureType.Reptile], habitats: 'All', staminaCost: 0,
    description: "+2 HP and adds +1 damage to your attacks."
  },
  [CardId.LargeHindLegs]: {
    id: CardId.LargeHindLegs, name: "Large Hind Legs", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Mammal, CreatureType.Avian, CreatureType.Amphibian], habitats: 'All', staminaCost: 1,
    description: "Flip coin to dodge. Kick: 2 damage if Medium/Big."
  },
  [CardId.BigClaws]: {
    id: CardId.BigClaws, name: "Big Claws", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Mammal, CreatureType.Reptile], habitats: 'All', staminaCost: 1,
    description: "Can dig, climb, or attack. Deals 3 damage."
  },
  [CardId.StrongTail]: {
    id: CardId.StrongTail, name: "Strong Tail", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Reptile, CreatureType.Mammal], habitats: 'All', staminaCost: 1,
    description: "Can strike or swim fast. Deals 2 damage."
  },
  [CardId.ArmoredScales]: {
    id: CardId.ArmoredScales, name: "Armored Scales", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Reptile], habitats: 'All', staminaCost: 0,
    description: "Reduces all damage by 1."
  },
  [CardId.DeathRoll]: {
    id: CardId.DeathRoll, name: "Death Roll", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Reptile], habitats: [Habitat.Water], staminaCost: 2,
    description: "Upgrade Bite/Grip/Fangs. Flip coin: Heads = hold prey and deal 4 damage.",
    isUpgrade: true, upgradeTarget: [CardId.Bite, CardId.StrongJaw, CardId.VenomousFangs]
  },
  [CardId.CamouflageWater]: {
    id: CardId.CamouflageWater, name: "Camouflage in Water", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Reptile, CreatureType.Amphibian], habitats: [Habitat.Water], staminaCost: 0,
    description: "Ambush; opponent must flip coin to hit: heads = hit, tails = miss."
  },
  [CardId.SwimFast]: {
    id: CardId.SwimFast, name: "Swim Fast", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Reptile, CreatureType.Amphibian], habitats: [Habitat.Water], staminaCost: 1,
    description: "Flip coin to evade attacks or chase opponent; heads = evade."
  },
  [CardId.AmbushAttack]: {
    id: CardId.AmbushAttack, name: "Ambush Attack", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Reptile, CreatureType.Mammal], habitats: [Habitat.Forest], staminaCost: 1,
    description: "Flip coin. Heads = opponent cannot evade."
  },
  [CardId.KeenEyesight]: {
    id: CardId.KeenEyesight, name: "Keen Eyesight", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Avian], habitats: 'All', staminaCost: 0,
    description: "Opponent stealth cards fail automatically."
  },
  [CardId.GraspingTalons]: {
    id: CardId.GraspingTalons, name: "Grasping Talons", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Avian, CreatureType.Reptile], habitats: 'All', staminaCost: 2,
    description: "Deals 2 damage. Flip coin. Heads = opponent is Grappled."
  },
  [CardId.PoisonSkin]: {
    id: CardId.PoisonSkin, name: "Poison Skin", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Amphibian], habitats: 'All', staminaCost: 0,
    description: "When damaged by a Physical attack, attacker flips coin. Heads = attacker is Poisoned."
  },
  [CardId.DiveBomb]: {
    id: CardId.DiveBomb, name: "Dive Bomb", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Avian], habitats: 'All', staminaCost: 2,
    description: "Deals 4 damage. Bypasses all damage-reducing Physical cards."
  },
  [CardId.PiercingBeak]: {
    id: CardId.PiercingBeak, name: "Piercing Beak", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Avian], habitats: 'All', staminaCost: 1,
    description: "Deals 2 damage."
  },
  [CardId.BarbedQuills]: {
    id: CardId.BarbedQuills, name: "Barbed Quills", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Mammal, CreatureType.Reptile], habitats: 'All', staminaCost: 0,
    description: "Passive. If attack would cause you to become Grappled, the Grappled effect fails, attacker takes 2 damage, then discard this card."
  },
  [CardId.VenomousFangs]: {
    id: CardId.VenomousFangs, name: "Venomous Fangs", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Reptile, CreatureType.Amphibian], habitats: 'All', staminaCost: 1,
    description: "Deals 1 damage. The opponent is now Poisoned."
  },
  [CardId.CrushingWeight]: {
    id: CardId.CrushingWeight, name: "Crushing Weight", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: 'All', habitats: 'All', staminaCost: 1,
    description: "Only for Big creature. Deals 4 damage."
  },
  [CardId.Amphibious]: {
    id: CardId.Amphibious, name: "Amphibious", type: CardType.Physical, abilityStatus: AbilityStatus.None,
    creatureTypes: [CreatureType.Amphibian], habitats: 'All', staminaCost: 0,
    description: "Passive. Water habitat: recover +1 HP per round. Non-Water habitat: standard Evade costs 0 Stamina."
  },

  // --- ABILITIES ---
  [CardId.ShortBurst]: {
    id: CardId.ShortBurst, name: "Short Burst", type: CardType.Ability, abilityStatus: AbilityStatus.ConsumableImpact,
    creatureTypes: [CreatureType.Mammal, CreatureType.Avian], habitats: 'All', staminaCost: 2,
    description: "Automatically avoid the opponent's next attack."
  },
  [CardId.Confuse]: {
    id: CardId.Confuse, name: "Confuse", type: CardType.Ability, abilityStatus: AbilityStatus.PermanentUtility,
    creatureTypes: 'All', habitats: 'All', staminaCost: 1,
    description: "Flip a coin. Heads = opponent is Confused and cannot act until they flip heads on their turn."
  },
  [CardId.Intelligence]: {
    id: CardId.Intelligence, name: "Intelligence", type: CardType.Ability, abilityStatus: AbilityStatus.PermanentUtility,
    creatureTypes: 'All', habitats: 'All', staminaCost: 0,
    description: "Creature is immune to Confuse."
  },
  [CardId.Dig]: {
    id: CardId.Dig, name: "Dig", type: CardType.Ability, abilityStatus: AbilityStatus.PermanentUtility,
    creatureTypes: 'All', habitats: 'All', staminaCost: 1,
    description: "Flip a coin. Heads = hidden, cannot be attacked this turn. Tails = may hide on next turn."
  },
  [CardId.Freeze]: {
    id: CardId.Freeze, name: "Freeze (Stealth)", type: CardType.Ability, abilityStatus: AbilityStatus.PermanentUtility,
    creatureTypes: 'All', habitats: 'All', staminaCost: 1,
    description: "Flip a coin. Heads = opponent cannot attack next turn."
  },
  [CardId.Roar]: {
    id: CardId.Roar, name: "Roar/Growl", type: CardType.Ability, abilityStatus: AbilityStatus.PermanentUtility,
    creatureTypes: [CreatureType.Mammal], habitats: 'All', staminaCost: 1,
    description: "Flip 3 coins. 2 Heads+ = opponent cannot attack this turn."
  },
  [CardId.Hibernate]: {
    id: CardId.Hibernate, name: "Hibernate", type: CardType.Ability, abilityStatus: AbilityStatus.ConsumableImpact,
    creatureTypes: [CreatureType.Mammal], habitats: 'All', staminaCost: 1,
    description: "Recover 1 stamina or 2 HP."
  },
  [CardId.LoudHiss]: {
    id: CardId.LoudHiss, name: "Loud Hiss/Growl", type: CardType.Ability, abilityStatus: AbilityStatus.PermanentUtility,
    creatureTypes: [CreatureType.Reptile, CreatureType.Mammal], habitats: 'All', staminaCost: 1,
    description: "Flip coin. Heads = opponent skips next attack."
  },
  [CardId.Flight]: {
    id: CardId.Flight, name: "Flight", type: CardType.Ability, abilityStatus: AbilityStatus.PermanentUtility,
    creatureTypes: [CreatureType.Avian], habitats: 'All', staminaCost: 1,
    description: "Creature is Flying until start of your next turn. Attack targeting you must flip coin: tails = attack misses."
  },
  [CardId.ToxicSpit]: {
    id: CardId.ToxicSpit, name: "Toxic Spit", type: CardType.Ability, abilityStatus: AbilityStatus.ConsumableImpact,
    creatureTypes: [CreatureType.Reptile, CreatureType.Amphibian], habitats: 'All', staminaCost: 1,
    description: "Flip coin. Heads = Poisoned. Tails = Stuck (1 turn)."
  },
  [CardId.Regeneration]: {
    id: CardId.Regeneration, name: "Regeneration", type: CardType.Ability, abilityStatus: AbilityStatus.ConsumableImpact,
    creatureTypes: [CreatureType.Reptile, CreatureType.Amphibian], habitats: 'All', staminaCost: 2,
    description: "Heal 4 HP."
  },
  [CardId.Focus]: {
    id: CardId.Focus, name: "Focus", type: CardType.Ability, abilityStatus: AbilityStatus.ConsumableImpact,
    creatureTypes: 'All', habitats: 'All', staminaCost: 0,
    description: "Play immediately even if you played a card. Next coin flip this turn is guaranteed Heads. Allows playing another card."
  },
  [CardId.AdrenalineRush]: {
    id: CardId.AdrenalineRush, name: "Adrenaline Rush", type: CardType.Ability, abilityStatus: AbilityStatus.ConsumableImpact,
    creatureTypes: [CreatureType.Mammal], habitats: 'All', staminaCost: 0,
    description: "Gain 1 Stamina immediately. Lose 1 Stamina next turn."
  },
  [CardId.StickyTongue]: {
    id: CardId.StickyTongue, name: "Sticky Tongue", type: CardType.Ability, abilityStatus: AbilityStatus.PermanentUtility,
    creatureTypes: [CreatureType.Amphibian, CreatureType.Reptile], habitats: 'All', staminaCost: 1,
    description: "Flip coin. Heads = Opponent Stuck. Small opponents take 1 damage."
  },
  [CardId.ShedSkin]: {
    id: CardId.ShedSkin, name: "Shed Skin", type: CardType.Ability, abilityStatus: AbilityStatus.ConsumableImpact,
    creatureTypes: [CreatureType.Reptile], habitats: 'All', staminaCost: 1,
    description: "Remove all negative status effects."
  },
  [CardId.Rage]: {
    id: CardId.Rage, name: "Rage", type: CardType.Ability, abilityStatus: AbilityStatus.PermanentUtility,
    creatureTypes: [CreatureType.Mammal], habitats: 'All', staminaCost: 1,
    description: "Reset action flag (allows attacking again if stamina permits)."
  },
  [CardId.TerritorialDisplay]: {
    id: CardId.TerritorialDisplay, name: "Territorial Display", type: CardType.Ability, abilityStatus: AbilityStatus.ConsumableImpact,
    creatureTypes: [CreatureType.Mammal, CreatureType.Avian, CreatureType.Reptile], habitats: 'All', staminaCost: 2,
    description: "Flip coin. Heads = Opponent discards their hand."
  },
  [CardId.Mimicry]: {
     id: CardId.Mimicry, name: "Mimicry", type: CardType.Ability, abilityStatus: AbilityStatus.PermanentUtility,
     creatureTypes: [CreatureType.Avian], habitats: 'All', staminaCost: 1,
     description: "Copies the last played Ability of opponent."
  },
  [CardId.ExhaustingRoar]: {
    id: CardId.ExhaustingRoar, name: "Exhausting Roar", type: CardType.Ability, abilityStatus: AbilityStatus.ConsumableImpact,
    creatureTypes: [CreatureType.Mammal], habitats: 'All', staminaCost: 1,
    description: "Flip coin. Heads = Opponent loses 1 Stamina."
  },
  [CardId.SwiftReflexes]: {
    id: CardId.SwiftReflexes, name: "Swift Reflexes", type: CardType.Ability, abilityStatus: AbilityStatus.PermanentUtility,
    creatureTypes: [CreatureType.Mammal, CreatureType.Avian], habitats: 'All', staminaCost: 1,
    description: "Passive. If you successfully Evade, gain 1 Stamina."
  },
  [CardId.EnhancedSmell]: {
    id: CardId.EnhancedSmell, name: "Enhanced Smell", type: CardType.Ability, abilityStatus: AbilityStatus.PermanentUtility,
    creatureTypes: [CreatureType.Mammal], habitats: 'All', staminaCost: 0,
    description: "Reveal Hidden/Camouflaged opponent. Does not count as action."
  },
  [CardId.Copycat]: {
    id: CardId.Copycat, name: "Copycat", type: CardType.Ability, abilityStatus: AbilityStatus.ConsumableImpact,
    creatureTypes: [CreatureType.Avian], habitats: 'All', staminaCost: 2,
    description: "Steal a card from opponent's hand."
  }
};

export const getRandomElement = <T>(items: T[]): T => {
  return items[Math.floor(Math.random() * items.length)];
};

export const generateDeck = (creatureType: CreatureType, size: 'Small' | 'Medium' | 'Big'): CardDef[] => {
  const deck: CardDef[] = [];
  
  // Add Size Card
  const sizeId = size === 'Small' ? CardId.SmallSize : size === 'Medium' ? CardId.MediumSize : CardId.BigSize;
  if (CARDS[sizeId]) {
    deck.push(CARDS[sizeId]);
  }

  // Add other valid cards
  Object.values(CARDS).forEach(card => {
    if (card.type === CardType.Size) return; // Skip size cards, we added the specific one

    // Check creature type compatibility
    if (card.creatureTypes !== 'All' && !card.creatureTypes.includes(creatureType)) {
      return;
    }

    // Check size restrictions
    if (card.id === CardId.CrushingWeight && size !== 'Big') {
      return;
    }

    deck.push(card);
  });

  return deck;
};
