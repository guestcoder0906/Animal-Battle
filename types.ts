

export enum CreatureType {
  Mammal = 'Mammal',
  Reptile = 'Reptile',
  Avian = 'Avian',
  Amphibian = 'Amphibian',
}

export enum Habitat {
  Desert = 'Desert',
  Forest = 'Forest',
  Water = 'Water',
  Arena = 'Arena',
}

export enum CardType {
  Physical = 'Physical',
  Ability = 'Ability',
  Size = 'Size',
  Special = 'Special',
}

export enum AbilityStatus {
  PermanentUtility = 'Permanent Utility',
  ConsumableImpact = 'Consumable Impact',
  None = 'None',
}

export enum CardId {
  SmallSize = 'small_size',
  MediumSize = 'medium_size',
  BigSize = 'big_size',
  
  // Physical
  SpikyBody = 'spiky_body',
  ArmoredExoskeleton = 'armored_exoskeleton',
  ClawAttack = 'claw_attack',
  Whiskers = 'whiskers',
  StrongJaw = 'strong_jaw', // Upgrade
  Bite = 'bite',
  Fur = 'fur',
  ThickFur = 'thick_fur',
  StandOnHindLegs = 'stand_hind_legs',
  SwimsWell = 'swims_well',
  StrongBuild = 'strong_build',
  LargeHindLegs = 'large_hind_legs',
  BigClaws = 'big_claws',
  StrongTail = 'strong_tail',
  ArmoredScales = 'armored_scales',
  CamouflageWater = 'camouflage_water',
  DeathRoll = 'death_roll', // Upgrade
  SwimFast = 'swim_fast',
  AmbushAttack = 'ambush_attack',
  KeenEyesight = 'keen_eyesight',
  GraspingTalons = 'grasping_talons',
  PoisonSkin = 'poison_skin',
  DiveBomb = 'dive_bomb',
  PiercingBeak = 'piercing_beak',
  BarbedQuills = 'barbed_quills',
  VenomousFangs = 'venomous_fangs',
  CrushingWeight = 'crushing_weight',
  Amphibious = 'amphibious',
  Camouflage = 'camouflage', // Moved to Physical

  // Abilities
  ShortBurst = 'short_burst',
  Confuse = 'confuse',
  Intelligence = 'intelligence',
  Dig = 'dig',
  Freeze = 'freeze',
  Roar = 'roar',
  Hibernate = 'hibernate',
  LoudHiss = 'loud_hiss',
  Flight = 'flight',
  ToxicSpit = 'toxic_spit',
  Regeneration = 'regeneration',
  Focus = 'focus',
  AdrenalineRush = 'adrenaline_rush',
  StickyTongue = 'sticky_tongue',
  ShedSkin = 'shed_skin',
  Rage = 'rage',
  TerritorialDisplay = 'territorial_display',
  Mimicry = 'mimicry',
  ExhaustingRoar = 'exhausting_roar',
  SwiftReflexes = 'swift_reflexes',
  EnhancedSmell = 'enhanced_smell',
  Copycat = 'copycat',
  
  // Special
  Evolve = 'evolve',
}

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  abilityStatus: AbilityStatus;
  creatureTypes: CreatureType[] | 'All';
  habitats: Habitat[] | 'All';
  staminaCost: number;
  description: string;
  isUpgrade?: boolean;
  upgradeTarget?: string[];
  maxCharges?: number; 
}

export interface CardInstance {
  instanceId: string;
  defId: string;
  charges?: number;
}

export interface PlayerStatus {
  type: 'Grappled' | 'Poisoned' | 'Stuck' | 'Blinded' | 'Confused' | 'Hidden' | 'Flying' | 'Camouflaged' | 'StaminaDebt' | 'CannotEvade';
  duration?: number; // 1 means this turn only
}

export interface PlayerState {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  creatureType: CreatureType;
  size: 'Small' | 'Medium' | 'Big';
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  formation: CardInstance[];
  statuses: PlayerStatus[];
  cardsPlayedThisTurn: number; // Max 1
  hasActedThisTurn: boolean; // Max 1
  hasUsedForestHide?: boolean; // Once per game
}

export interface CoinFlipEvent {
  id: string;
  result: 'Heads' | 'Tails';
  reason: string;
  timestamp: number;
}

export interface GameNotification {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

export interface GameState {
  gameId: string;
  habitat: Habitat;
  turn: number;
  currentPlayer: string;
  players: Record<string, PlayerState>;
  log: string[];
  winner: string | null;
  phase: 'start' | 'main' | 'end';
  activeCoinFlip: CoinFlipEvent | null;
  notifications: GameNotification[];
}

export type GameAction = 
  | { type: 'INIT_GAME'; payload: GameState }
  | { type: 'JOIN_GAME'; playerId: string; name: string } 
  | { type: 'PLAY_CARD'; playerId: string; cardInstanceId: string; targetInstanceId?: string }
  | { type: 'PLAY_EVOLVE_CARD'; playerId: string; evolveInstanceId: string; targetFormationId: string; replacementHandId: string }
  | { type: 'USE_ACTION'; playerId: string; actionType: 'ATTACK' | 'ABILITY'; cardInstanceId?: string; targetPlayerId: string; rng?: number[]; targetHandCardId?: string }
  | { type: 'CLEAR_POISON'; playerId: string }
  | { type: 'ATTEMPT_GRAPPLE_ESCAPE'; playerId: string; rng?: number[] }
  | { type: 'USE_HABITAT_ACTION'; playerId: string; rng?: number[] }
  | { type: 'END_TURN'; playerId: string; rng?: number[] }
  | { type: 'UPDATE_STATE'; payload: GameState }
  | { type: 'ACKNOWLEDGE_COIN_FLIP' }
  | { type: 'DISMISS_NOTIFICATION'; id: string };