
export enum TileType {
  START = 'start',
  PROP = 'prop',
  TAX = 'tax',
  JAIL = 'jail',
  GOTOJAIL = 'gotojail',
  PARK = 'park',
  EVENT = 'event',
  SLOTS = 'slots',
  BANK = 'bank',
}

export interface TileData {
  id: number;
  type: TileType;
  name: string;
  price?: number;
  color?: string;
  subtype?: string; // 'rail', 'bus', 'utility', 'fiore', etc.
  owner?: number | 'E' | null;
  houses?: number;
  hotel?: boolean;
  mortgaged?: boolean;
  baseRent?: number;
  rent?: number;
  familia?: string;
  workers?: number;
  maintenance?: number; // v21 Coste de mantenimiento por turno
  wagePer?: number; // Coste por trabajador (Fiore)
  houseCost?: number; 
  mortgagePrincipal?: number;
}

// v21: Securitization Types
export interface LoanShare {
    id: string;
    ownerId: number;
    bips: number; // Basis points (1/10000)
}

export interface LoanPool {
    id: string;
    name: string;
    loanIds: string[];
    unitsTotal: number;
    holdings: Record<number, number>; // playerId -> units
    cash: number; // Undistributed dividends
}

export interface Loan {
  id: string;
  borrowerId: number;
  lenderId: number | 'E'; // 'E' is Estado (Bank)
  principal: number;
  interestTotal: number;
  turnsTotal: number;
  turnsLeft: number;
  amountPerTurn: number;
  status: 'active' | 'defaulted' | 'paid';
  collateralTileIds?: number[]; // v21 Margin Call support
  lastMarginTurn?: number;
  
  // v21 Securitization
  poolId?: string;
  shares?: LoanShare[];
}

// v21: Financial Options
export interface FinancialOption {
    id: string;
    type: 'call' | 'put';
    propertyId: number; // Tile ID
    strikePrice: number;
    premium: number;
    buyerId: number;
    sellerId: number;
    expiresTurn: number;
}

export interface Player {
  id: number;
  name: string;
  money: number;
  pos: number;
  alive: boolean;
  jail: number; // 0 = libre, > 0 = turnos restantes
  color: string;
  isBot: boolean;
  gender: 'male' | 'female' | 'helicoptero' | 'marcianito';
  role?: 'proxeneta' | 'florentino' | 'fbi' | 'okupa' | 'civil'; // v22
  props: number[];
  taxBase: number;
  vatIn: number;
  vatOut: number;
  doubleStreak: number;
  pendingMove?: number | null;
  skipTurns?: number;
  insiderTokens: number; // v21
}

export interface AuctionState {
  tileId: number; // Primary ID (or first of bundle)
  items?: number[]; // For bundles
  currentBid: number;
  highestBidder: number | 'E' | null;
  activePlayers: number[];
  timer: number;
  isOpen: boolean;
  kind?: 'tile' | 'bundle' | 'loan' | 'poolUnit'; // v21 extended
  
  // Securitization Auction Props
  assetId?: string; // For loans/pools
  units?: number;   // For pool units
  
  sealed?: boolean;
  bids?: Record<string, number>; // For sealed auctions: playerId -> amount
  stateMaxBid?: number; // Max amount state will bid
}

export interface TradeOffer {
    initiatorId: number;
    targetId: number;
    offeredMoney: number;
    offeredProps: number[]; // Tile IDs
    requestedMoney: number;
    requestedProps: number[]; // Tile IDs
    isOpen: boolean;
}

export interface Greyhound {
    id: number;
    color: string;
    progress: number;
    speed: number;
}

export interface GameEvent {
    id: string;
    title: string;
    description: string;
    effect: (state: GameState, currentPlayerIdx: number) => Partial<GameState>;
    tags?: string[]; // 'economy', 'risk', etc.
}

// Advanced Event Types
export interface RentFilter {
    id: string;
    mul: number;
    turns: number;
    filterType: 'leisure' | 'transport' | 'family' | 'owner';
    filterValue?: string | number; // Family name or Owner ID
}

export type GovernmentType = 'left' | 'right' | 'authoritarian' | 'libertarian' | 'anarchy';

export interface GovConfig {
    tax: number;      // Multiplicador de impuestos (ej: 0.25 para +25%)
    welfare: number;  // Multiplicador de ayudas (ej: 0.30 para +30% en salida)
    interest: number; // Multiplicador de intereses
    rentIVA: number;  // IVA en alquileres (ej: 0.21)
}

export interface GameState {
  players: Player[];
  tiles: TileData[];
  currentPlayerIndex: number;
  rolled: boolean;
  dice: [number, number];
  logs: string[];
  auction: AuctionState | null;
  trade: TradeOffer | null;
  estadoMoney: number;
  turnCount: number;
  gov: GovernmentType;
  govTurnsLeft: number;
  gameStarted: boolean;
  selectedTileId: number | null;
  
  // Bank Stock
  housesAvail: number;
  hotelsAvail: number;

  // Advanced features
  bankCorrupt: boolean;
  taxPot: number;
  loans: Loan[]; 
  loanPools: LoanPool[]; // v21
  financialOptions: FinancialOption[]; // v21 Options
  marketListings: any[];
  
  // UI States
  showBankModal: boolean;
  showLoansModal: boolean;
  showTradeModal: boolean;
  showBalanceModal: boolean; // v21 Mi Balance
  showSlots: boolean; // For visual slots overlay
  showCasinoModal: boolean; // v20 Casino
  casinoGame?: 'blackjack' | 'roulette' | null;
  showHeatmap: boolean; // v21 UI Graphics
  slotsData?: { r1: string, r2: string, r3: string, win: boolean, msg: string };
  
  // Event & Mini-game States
  activeEvent: { title: string, description: string } | null;
  showGreyhounds: boolean;
  greyhounds: Greyhound[];
  greyhoundPot: number;
  greyhoundBets: Record<number, number>; // playerId -> dogId
  
  // Economy Event Modifiers (Advanced)
  rentEventMul?: number; // Multiplicador Global
  rentEventTurns?: number;
  
  buildEventMul?: number; // Coste construcción
  buildEventTurns?: number;
  
  rentFilters: RentFilter[]; // Filtros específicos (ej: Ocio +15%)
  rentCap?: { amount: number, turns: number } | null; // Tope alquiler (Congelación)
  blockMortgage: Record<number, number>; // pid -> turns
  blockBuildTurns: number; // Huelga de obras
  sellBonusByOwner: Record<number, number>; // pid -> multiplier
  
  // v21 Insider & Risk
  nextEventId?: string | null; // Evento fijado por Insider
  
  // v21 Graphics / Metrics
  heatmap: Record<number, number>; // tileId -> landingCount
  
  // v22 Roles State
  fbiGuesses: Record<number, Record<number, string>>; // fbiId -> { targetId: role }
  
  // Government Configs Active
  currentGovConfig: GovConfig;

  // State Tracking
  vatIn: number;  // IVA soportado por el Estado
  vatOut: number; // IVA repercutido por el Estado
  
  // One-time turn flags
  usedTransportHop: boolean;
  
  // Utils
  rngSeed: number; // For Mulberry32
}

export const INITIAL_MONEY = 1500;
