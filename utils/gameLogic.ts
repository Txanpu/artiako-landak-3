
import { GameState, TileType, Player, TileData, INITIAL_MONEY, GovernmentType, Loan, GameEvent, Greyhound, RentFilter, LoanPool, LoanShare, FinancialOption, GovConfig, TradeOffer } from '../types';
import { INITIAL_TILES, COLORS } from '../constants';

export const seedFromString = (s: string) => {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    return h >>> 0;
};

// Configs de Gobierno Originales
const GOV_CONFIGS: Record<GovernmentType, GovConfig> = {
    left: { tax: 0.25, welfare: 0.30, interest: 0.10, rentIVA: 0.30 },
    right: { tax: -0.20, welfare: -0.30, interest: 0, rentIVA: 0.30 },
    authoritarian: { tax: 0.10, welfare: -0.20, interest: 0.05, rentIVA: 0.30 },
    libertarian: { tax: -1, welfare: 0, interest: -0.05, rentIVA: 0 },
    anarchy: { tax: 0, welfare: 0, interest: 0, rentIVA: 0 }
};

export const validateState = (state: GameState, TILES: TileData[]): string[] => {
    const errs: string[] = [];
    try {
      if (!Array.isArray(state.players)) errs.push('players no es array');
      state.players?.forEach((p, idx) => {
        if (typeof p.money !== 'number') errs.push(`p${idx}.money inválido`);
        if (p.pos < 0 || p.pos >= TILES.length) errs.push(`p${idx}.pos fuera de rango`);
      });
    } catch (e: any) { errs.push('Excepción en validate: ' + e.message); }
    return errs;
};

export const repairState = (state: GameState, TILES: TileData[]): GameState => {
    const newState = { ...state };
    newState.players.forEach(p => {
      if (!Number.isFinite(p.money)) p.money = 0;
      p.pos = Math.max(0, Math.min(Math.trunc(p.pos || 0), TILES.length - 1));
    });
    return newState;
};

export const createInitialState = (): GameState => {
  const govTypes: GovernmentType[] = ['left', 'right', 'authoritarian', 'libertarian', 'anarchy'];
  const startGov = govTypes[Math.floor(Math.random() * govTypes.length)];
  
  return {
      players: [],
      tiles: JSON.parse(JSON.stringify(INITIAL_TILES)),
      currentPlayerIndex: 0,
      rolled: false,
      dice: [0, 0],
      logs: ['Bienvenido a Artiako Landak!'],
      auction: null,
      trade: null,
      estadoMoney: 0, 
      turnCount: 0,
      gov: startGov,
      govTurnsLeft: 7,
      currentGovConfig: GOV_CONFIGS[startGov], 
      gameStarted: false,
      selectedTileId: null,
      bankCorrupt: true, 
      taxPot: 0,
      loans: [],
      loanPools: [],
      financialOptions: [],
      marketListings: [],
      showBankModal: false,
      showLoansModal: false,
      showTradeModal: false,
      showBalanceModal: false,
      showSlots: false,
      showCasinoModal: false,
      showHeatmap: false,
      activeEvent: null,
      showGreyhounds: false,
      greyhounds: [],
      greyhoundPot: 0,
      greyhoundBets: {},
      housesAvail: 32,
      hotelsAvail: 12,
      usedTransportHop: false,
      
      // Advanced Event State
      rentEventMul: 1,
      rentEventTurns: 0,
      rentFilters: [],
      blockMortgage: {},
      blockBuildTurns: 0,
      sellBonusByOwner: {},
      rentCap: null,
      nextEventId: null,
      
      // Graphics
      heatmap: {},
      
      // Roles
      fbiGuesses: {},
      vatIn: 0,
      vatOut: 0,

      // Utils
      rngSeed: seedFromString(new Date().toISOString())
  };
};

export const formatMoney = (amount: number) => `$${Math.round(amount)}`;

// --- CASINO LOGIC ---
export const playBlackjack = (): { dealer: number, player: number, win: boolean, push: boolean } => {
    const draw = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    const dealer = draw(17, 23);
    const player = draw(16, 23);
    const dealerBust = dealer > 21;
    const playerBust = player > 21;
    let win = false;
    let push = false;
    if (playerBust) win = false;
    else if (dealerBust) win = true;
    else if (player > dealer) win = true;
    else if (player === dealer) push = true;
    else win = false;
    return { dealer, player, win, push };
};

export const playRoulette = (betColor: 'red' | 'black' | 'green'): { outcome: number, color: 'red' | 'black' | 'green', win: boolean } => {
    const n = Math.floor(Math.random() * 37);
    const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
    let color: 'red' | 'black' | 'green' = 'black';
    if (n === 0) color = 'green';
    else if (reds.has(n)) color = 'red';
    return { outcome: n, color, win: betColor === color };
};

// --- HEATMAP TRACKING ---
export const trackTileLanding = (state: GameState, tileId: number): Record<number, number> => {
    const newMap = { ...state.heatmap };
    newMap[tileId] = (newMap[tileId] || 0) + 1;
    return newMap;
};

// --- RENT & ECONOMY LOGIC ---
export const getRent = (tile: TileData, diceTotal: number = 0, tiles: TileData[], state?: GameState): number => {
  if (tile.type !== TileType.PROP) return 0;
  if (tile.mortgaged) return 0;
  if (tile.owner === 'E' && tile.mortgaged) return 0;

  let rent = 0;
  
  if (tile.subtype === 'utility') {
    const ownerId = tile.owner;
    if (ownerId === null) return 0;
    const ownedCount = tiles.filter(t => t.subtype === 'utility' && t.owner === ownerId).length;
    rent = Math.round((diceTotal * (ownedCount >= 2 ? 10 : 4)));
  } else if (tile.subtype === 'rail' || tile.subtype === 'bus') {
    const ownerId = tile.owner;
    if (ownerId === null) return 0;
    const ownedCount = tiles.filter(t => t.subtype === tile.subtype && t.owner === ownerId).length;
    rent = Math.round((25 * Math.pow(2, Math.max(0, ownedCount - 1))));
  } else if (tile.subtype === 'fiore') {
    rent = (tile.workers || 0) * 70;
  } else if (['casino_bj', 'casino_roulette'].includes(tile.subtype || '')) {
    rent = 0; 
  } else {
    let base = tile.baseRent || Math.round((tile.price || 0) * 0.1);
    if (tile.hotel) base *= 5;
    else if (tile.houses && tile.houses > 0) base *= (tile.houses + 1);
    rent = base;
  }

  // Event multipliers
  if (state) {
      if (state.rentEventMul && state.rentEventMul !== 1) {
          rent = Math.round(rent * state.rentEventMul);
      }
      state.rentFilters.forEach(filter => {
          let match = false;
          const isLeisure = tile.color === 'pink' || ['casino_bj','casino_roulette','fiore'].includes(tile.subtype || '');
          const isTransport = ['bus','rail','ferry','air'].includes(tile.subtype || '');
          
          if (filter.filterType === 'leisure' && isLeisure) match = true;
          if (filter.filterType === 'transport' && isTransport) match = true;
          if (filter.filterType === 'family' && (tile.familia === filter.filterValue || tile.color === filter.filterValue)) match = true;
          if (filter.filterType === 'owner' && tile.owner === filter.filterValue) match = true;
          if (match) rent = Math.round(rent * filter.mul);
      });
      if (state.rentCap && state.rentCap.amount > 0) {
          rent = Math.min(rent, state.rentCap.amount);
      }
  }

  return Math.max(0, rent);
};

export const getRentTable = (t: TileData) => {
    if (!t) return [];
    if (t.subtype === 'bus' || t.subtype === 'rail') {
        const table = [25, 50, 100, 200, 300];
        return table.map((r, i) => ({ label: `${i + 1} en posesión`, rent: r }));
    }
    const base = t.baseRent ?? Math.round((t.price || 0) * 0.3);
    const step = Math.round((t.price || 0) * 0.25); 
    return [
        { label: 'Alquiler base', rent: base },
        { label: '1 Casa', rent: base + step },
        { label: 'Hotel', rent: base + step * 5 },
    ];
};

export const getHouseCost = (tile: TileData): number => {
    return Math.round((tile.price || 0) * 0.5);
};

// --- STATE AI LOGIC ---
export const performStateAutoBuild = (tiles: TileData[], bankHouses: number, bankHotels: number, estadoMoney: number, gov: GovernmentType): { tiles: TileData[], bankHouses: number, bankHotels: number, estadoMoney: number, logs: string[] } => {
    const newTiles = [...tiles];
    let newBankHouses = bankHouses;
    let newBankHotels = bankHotels;
    let newEstadoMoney = estadoMoney;
    const logs: string[] = [];
    
    // LIBERTARIAN: State Sells Assets (Privatization)
    if (gov === 'libertarian') {
        const stateProps = newTiles.filter(t => t.owner === 'E');
        if (stateProps.length > 0) {
            // Sell one property per turn to simulate auction/privatization
            const propToSell = stateProps[0];
            propToSell.owner = null; // Release to public/auction pool
            newEstadoMoney += (propToSell.price || 0);
            logs.push(`🏛️ Gobierno Libertario privatiza (vende): ${propToSell.name}`);
        }
        return { tiles: newTiles, bankHouses: newBankHouses, bankHotels: newBankHotels, estadoMoney: newEstadoMoney, logs };
    }

    // NORMAL STATE BEHAVIOR (Build)
    const families = [...new Set(newTiles.filter(t => t.type === TileType.PROP && t.color).map(t => t.color!))];
    families.forEach(fam => {
        const group = newTiles.filter(t => t.color === fam);
        if (!group.every(t => t.owner === 'E')) return;
        if (group.some(t => t.mortgaged)) return;

        let built = true;
        while (built) {
            built = false;
            const levels = group.map(t => t.hotel ? 5 : (t.houses || 0));
            const min = Math.min(...levels);
            const max = Math.max(...levels);
            if (min >= 5) break; 

            const target = group.find(t => (t.hotel ? 5 : (t.houses || 0)) === min && !t.hotel);
            if (target) {
                const cost = getHouseCost(target);
                if ((target.houses || 0) < 4) {
                    if (newBankHouses > 0 && newEstadoMoney >= cost) {
                        target.houses = (target.houses || 0) + 1;
                        newBankHouses--; newEstadoMoney -= cost;
                        logs.push(`🏠 Estado construye casa en ${target.name}.`); built = true;
                    }
                } else if ((target.houses || 0) === 4) {
                    if (newBankHotels > 0 && newEstadoMoney >= cost) {
                        target.houses = 0; target.hotel = true;
                        newBankHotels--; newBankHouses += 4; newEstadoMoney -= cost;
                        logs.push(`🏨 Estado construye HOTEL en ${target.name}.`); built = true;
                    }
                }
            }
        }
    });
    return { tiles: newTiles, bankHouses: newBankHouses, bankHotels: newBankHotels, estadoMoney: newEstadoMoney, logs };
};

// --- GOVERNMENT LOGIC & GENDER POLICIES ---
export const handleGovernmentTick = (state: GameState): Partial<GameState> => {
    let newState = { ...state };
    newState.govTurnsLeft -= 1;
    let newEstadoMoney = newState.estadoMoney;
    let govLogs: string[] = [];

    // GENDER POLICIES
    if (newState.players && newState.players.length > 0) {
        newState.players.forEach(p => {
            if (!p.alive || p.isBot) return; 
            
            const gender = p.gender;
            
            if (newState.gov === 'left') {
                if (gender === 'male') {
                    const tax = 20;
                    if (p.money >= tax) { p.money -= tax; newEstadoMoney += tax; }
                } else if (gender === 'female' || gender === 'marcianito') {
                    const subsidy = 20;
                    p.money += subsidy; newEstadoMoney -= subsidy;
                }
            } else if (newState.gov === 'right') {
                if (gender === 'female') {
                    const tax = 20;
                    if (p.money >= tax) { p.money -= tax; newEstadoMoney += tax; }
                } else if (gender === 'male') {
                    const bonus = 20;
                    p.money += bonus; newEstadoMoney -= bonus;
                }
            } else if (newState.gov === 'authoritarian') {
                if (gender === 'helicoptero') {
                    const subsidy = 50;
                    p.money += subsidy; newEstadoMoney -= subsidy;
                } else {
                    const tax = 10;
                    if (p.money >= tax) { p.money -= tax; newEstadoMoney += tax; }
                }
            }
        });
    }
    
    // Cambio de Gobierno
    if (newState.govTurnsLeft <= 0) {
        const govs: GovernmentType[] = ['left', 'right', 'authoritarian', 'libertarian', 'anarchy'];
        const nextGov = govs[Math.floor(Math.random() * govs.length)];
        newState.gov = nextGov;
        newState.govTurnsLeft = 7;
        newState.currentGovConfig = GOV_CONFIGS[nextGov];
        govLogs.push(`🗳️ ¡Elecciones! Nuevo gobierno: ${nextGov.toUpperCase()}`);
    }

    return { ...newState, estadoMoney: newEstadoMoney, logs: [...(newState.logs || []), ...govLogs] };
};

// --- BOT AI INTELLIGENCE ---
export const getBotTradeProposal = (state: GameState, bot: Player): TradeOffer | null => {
    // 1. Scan for monopolies I almost have (missing 1)
    const colors = [...new Set(state.tiles.filter(t => t.color).map(t => t.color))];
    
    for (const color of colors) {
        const group = state.tiles.filter(t => t.color === color);
        const myProps = group.filter(t => t.owner === bot.id);
        const missing = group.filter(t => t.owner !== bot.id && t.owner !== null && t.owner !== 'E');
        
        // Strategy: Only aggressive if I have majority or 50%
        if (myProps.length > 0 && missing.length === 1) {
            const targetProp = missing[0];
            const targetOwnerId = targetProp.owner as number;
            const targetPlayer = state.players.find(p => p.id === targetOwnerId);
            
            if (!targetPlayer || targetPlayer.id === bot.id) continue;

            // Determine Offer:
            // Find "Useless" properties (singletons in colors I don't care about)
            const myUseless = state.tiles.filter(t => {
                if (t.owner !== bot.id) return false;
                const cGroup = state.tiles.filter(x => x.color === t.color);
                return cGroup.filter(x => x.owner === bot.id).length === 1 && t.color !== color;
            }).map(t => t.id);

            // Calculate money to sweeten deal
            const valuation = (targetProp.price || 0) * 1.5; // Bot values the missing piece highly
            const offerProps = myUseless.slice(0, 2); // Offer up to 2 junk props
            const offerPropsVal = offerProps.reduce((acc, pid) => acc + (state.tiles[pid].price || 0), 0);
            
            let offerMoney = Math.max(0, valuation - offerPropsVal);
            if (offerMoney > bot.money * 0.4) offerMoney = bot.money * 0.4; // Don't go bankrupt trading

            return {
                initiatorId: bot.id,
                targetId: targetOwnerId,
                offeredMoney: Math.floor(offerMoney),
                offeredProps: offerProps,
                requestedMoney: 0,
                requestedProps: [targetProp.id],
                isOpen: true
            };
        }
    }
    return null;
};

export const evaluateTradeByBot = (state: GameState, bot: Player, offer: TradeOffer): boolean => {
    // Value of what I give
    let giveVal = offer.requestedMoney;
    offer.requestedProps.forEach(pid => {
        const t = state.tiles[pid];
        let val = (t.price || 0);
        // Is this part of a monopoly I own?
        const group = state.tiles.filter(x => x.color === t.color);
        const myCount = group.filter(x => x.owner === bot.id).length;
        if (myCount >= 2) val *= 3; // Don't break my sets!
        else if (myCount > 0) val *= 1.2;
        giveVal += val;
    });

    // Value of what I get
    let getVal = offer.offeredMoney;
    offer.offeredProps.forEach(pid => {
        const t = state.tiles[pid];
        let val = (t.price || 0);
        // Does this complete a set for me?
        const group = state.tiles.filter(x => x.color === t.color);
        const myCount = group.filter(x => x.owner === bot.id).length;
        if (myCount === group.length - 1) val *= 2.5; // HUGE value if it completes set
        else if (myCount > 0) val *= 1.2;
        getVal += val;
    });

    // Bot is smart: Only accepts if value is good (> 1.1 ratio)
    return getVal >= giveVal * 1.1;
};

// --- EVENTS SYSTEM ---
export const EVENTS_DECK: GameEvent[] = [
    {
        id: 'ev_lottery',
        title: 'Lotería Nacional',
        description: '¡Has ganado el segundo premio! Recibes $150.',
        effect: (state, idx) => {
            const p = [...state.players]; p[idx].money += 150;
            return { players: p, estadoMoney: state.estadoMoney - 150 };
        }
    },
    {
        id: 'ev_tax_audit',
        title: 'Inspección Fiscal',
        description: 'Hacienda somos todos. Pagas $100.',
        effect: (state, idx) => {
            const p = [...state.players]; p[idx].money -= 100;
            return { players: p, estadoMoney: state.estadoMoney + 100 };
        }
    },
    {
        id: 'ev_jail_card',
        title: 'Redada Policial',
        description: 'Te han pillado con material sospechoso. Vas a la cárcel.',
        effect: (state, idx) => {
            const p = [...state.players]; p[idx].pos = 10; p[idx].jail = 3;
            return { players: p, rolled: false }; 
        }
    },
    {
        id: 'ev_advance_go',
        title: 'Avance Rápido',
        description: 'Corre a la Salida. Cobras $200.',
        effect: (state, idx) => {
            const p = [...state.players]; p[idx].pos = 0; p[idx].money += 200;
            return { players: p, estadoMoney: state.estadoMoney - 200 };
        }
    },
    {
        id: 'ev_inflation',
        title: 'Inflación Galopante',
        description: 'Los precios suben. Todas las rentas aumentan un 50% durante 5 turnos.',
        effect: (state, idx) => {
            return { rentEventMul: 1.5, rentEventTurns: 5 };
        }
    },
    {
        id: 'ev_market_crash',
        title: 'Crack Bursátil',
        description: 'Pánico en los mercados. Rentas a la mitad durante 5 turnos.',
        effect: (state, idx) => {
            return { rentEventMul: 0.5, rentEventTurns: 5 };
        }
    }
];

export const drawEvent = (state: GameState, playerIdx: number): Partial<GameState> => {
    const card = EVENTS_DECK[Math.floor(Math.random() * EVENTS_DECK.length)];
    const effectResult = card.effect(state, playerIdx);
    const newLogs = [`⚡ EVENTO: ${card.title}`, ...(effectResult.logs || [])];
    return {
        ...effectResult,
        activeEvent: { title: card.title, description: card.description },
        logs: [...newLogs, ...state.logs]
    };
};

export const tickAdvancedEvents = (s: GameState): Partial<GameState> => {
    const updates: Partial<GameState> = {};
    if (s.rentEventTurns && s.rentEventTurns > 0) {
        updates.rentEventTurns = s.rentEventTurns - 1;
        if (updates.rentEventTurns === 0) {
             updates.rentEventMul = 1;
        }
    }
    return updates;
};

// --- OPTIONS & SEC ---
export const createFinancialOption = (state: GameState, type: 'call' | 'put', propertyId: number, strike: number, premium: number, sellerId: number, buyerId: number): FinancialOption => {
    return {
        id: Math.random().toString(36).substr(2, 9),
        type, propertyId, strikePrice: strike, premium, sellerId, buyerId,
        expiresTurn: state.turnCount + 10
    };
};

export const createLoanPool = (state: GameState, loanIds: string[], name: string): LoanPool => {
    const poolId = Math.random().toString(36).substr(2, 9);
    const pool: LoanPool = {
        id: poolId, name, loanIds, unitsTotal: 1000,
        holdings: { [state.players[state.currentPlayerIndex].id]: 1000 },
        cash: 0
    };
    state.loanPools.push(pool);
    state.loans.forEach(l => { if (loanIds.includes(l.id)) l.poolId = poolId; });
    return pool;
};

// --- ROLE ASSIGNMENT ---
export const assignRoles = (players: Player[]) => {
    const specialRoles = ['proxeneta', 'florentino', 'fbi', 'okupa'];
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    shuffled.forEach((p, i) => {
        if (i < specialRoles.length) {
            p.role = specialRoles[i] as any;
        } else {
            p.role = 'civil';
        }
    });
    return shuffled.sort((a, b) => a.id - b.id);
};

// --- BASIC HELPERS ---
export const rollDice = (): [number, number] => [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
export const getNextPlayerIndex = (state: GameState): number => {
  if (state.players.length === 0) return 0;
  let next = (state.currentPlayerIndex + 1) % state.players.length;
  let loopCount = 0;
  while (loopCount < state.players.length) {
      const p = state.players[next];
      if (!p.alive) next = (next + 1) % state.players.length;
      else if (p.skipTurns && p.skipTurns > 0) break; 
      else break; 
      loopCount++;
  }
  return next;
};

// --- UTILS: HISTORY & WATCHDOG ---
export const makeHistory = <T>(max = 30) => {
    const stack: T[] = [];
    let idx = -1;
    return {
      snapshot(state: T) {
        const snap = structuredClone(state);
        stack.splice(idx + 1);
        stack.push(snap);
        if (stack.length > max) { stack.shift(); } else { idx++; }
      },
      canUndo() { return idx > 0; },
      canRedo() { return idx < stack.length - 1; },
      undo() { if (idx > 0) return structuredClone(stack[--idx]); },
      peek() { return structuredClone(stack[idx]); }
    };
};

export const makeWatchdog = (ms = 3000) => {
    let timer: any = null;
    return {
      arm(tag = 'op') { clearTimeout(timer); timer = setTimeout(() => { console.error('Watchdog:', tag); }, ms); },
      disarm() { clearTimeout(timer); timer = null; }
    };
};

// --- PLACEHOLDERS ---
export const initGreyhounds = () => [];
export const checkFiestaClandestina = (state: GameState) => null;
export const getTransportDestinations = () => [];
export const calculateMaintenance = (playerId: number, tiles: TileData[]) => 0;
export const checkMarginCalls = (state: GameState, playerId: number) => ({ soldTiles: [] as string[], amountRaised: 0 });
export const distributePoolDividends = (state: GameState, poolId: string) => 0;
export const handleRoleAbilities = (state: GameState, player: Player, tile: TileData) => [] as string[];
export const processFioreTips = (state: GameState, player: Player, amount: number) => [] as string[];
export const ownsFullGroup = (player: Player, tile: TileData, tiles: TileData[]) => false;
export const canSellEven = (tile: TileData, tiles: TileData[]) => false;
export const processTurnLoans = (state: GameState, playerIdx: number) => ({ loans: state.loans, players: state.players, logs: [] as string[] });
export const createLoan = (borrowerId: number, amount: number, interest: number, turns: number) => ({} as Loan);
