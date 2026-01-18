
import { GameState, TileType, Player, TileData, INITIAL_MONEY, GovernmentType, Loan, GameEvent, GovConfig, TradeOffer } from '../types';
import { INITIAL_TILES, COLORS, PLAYER_COLORS, PLAYER_EMOJIS } from '../constants';

// Configs de Gobierno: Definen cómo funciona la economía
const GOV_CONFIGS: Record<GovernmentType, GovConfig> = {
    // Izquierda: Impuestos altos, IVA alto, Ayudas altas
    left: { tax: 0.50, welfare: 0.50, interest: 0.15, rentIVA: 0.30 }, 
    // Derecha: Impuestos bajos (o negativos/devan), IVA medio, Recorte gastos
    right: { tax: -0.20, welfare: -0.50, interest: 0.05, rentIVA: 0.10 },
    // Autoritario: Saqueo máximo, Impuestos muy altos, IVA alto
    authoritarian: { tax: 0.80, welfare: -0.20, interest: 0.20, rentIVA: 0.50 },
    // Libertario: Cero impuestos, Cero IVA, Cero ayudas
    libertarian: { tax: -1, welfare: -1, interest: -0.05, rentIVA: 0 },
    // Anarquía: Caos (valores neutros, pero los eventos son caóticos)
    anarchy: { tax: 0, welfare: 0, interest: 0, rentIVA: 0 }
};

export const validateState = (state: GameState, TILES: TileData[]): string[] => {
    return [];
};

// --- MAZO DE EVENTOS AMPLIADO ---
export const EVENTS_DECK: GameEvent[] = [
    {
        id: 'ev_bank_error',
        title: 'Error Bancario',
        description: 'El sistema falla a tu favor. El Estado pierde dinero, tú ganas.',
        effect: (state, idx) => {
            const s = {...state};
            s.players[idx].money += 200;
            s.estadoMoney -= 200;
            s.logs.push(`${s.players[idx].name} recibe $200 por error del sistema.`);
            return s;
        }
    },
    {
        id: 'ev_speeding',
        title: 'Radar de Tráfico',
        description: 'Multa por exceso de velocidad.',
        effect: (state, idx) => {
            const s = {...state};
            const fine = 100;
            s.players[idx].money -= fine;
            s.estadoMoney += fine;
            s.logs.push(`${s.players[idx].name} paga multa de $${fine} al Estado.`);
            return s;
        }
    },
    {
        id: 'ev_tax_inspection',
        title: 'Inspección de Hacienda',
        description: 'Si tienes más de $2000, pagas un 20% de tu efectivo al Estado.',
        effect: (state, idx) => {
            const s = {...state};
            const p = s.players[idx];
            if (p.money > 2000) {
                const tax = Math.floor(p.money * 0.20);
                p.money -= tax;
                s.estadoMoney += tax;
                s.logs.push(`🕵️ Hacienda inspecciona a ${p.name}: paga $${tax}.`);
            } else {
                s.logs.push(`🕵️ Hacienda inspecciona a ${p.name}: está limpio (o pobre).`);
            }
            return s;
        }
    },
    {
        id: 'ev_subsidy',
        title: 'Subvención Cultural',
        description: 'El gobierno te da una ayuda para "promover la cultura".',
        effect: (state, idx) => {
            const s = {...state};
            const amount = 150;
            s.players[idx].money += amount;
            s.estadoMoney -= amount;
            s.logs.push(`${s.players[idx].name} recibe subvención de $${amount}.`);
            return s;
        }
    },
    {
        id: 'ev_repairs',
        title: 'Derrama en Propiedades',
        description: 'Pagas $40 por cada casa y $115 por cada hotel.',
        effect: (state, idx) => {
            const s = {...state};
            const p = s.players[idx];
            let cost = 0;
            s.tiles.forEach(t => {
                if (t.owner === p.id) {
                    if (t.hotel) cost += 115;
                    else cost += (t.houses || 0) * 40;
                }
            });
            if (cost > 0) {
                p.money -= cost;
                // El dinero se "quema" en reparaciones, o va al estado como IVA de obras (50%)
                s.estadoMoney += Math.floor(cost * 0.5); 
                s.logs.push(`${p.name} paga $${cost} por reparaciones.`);
            } else {
                s.logs.push(`${p.name} no tiene edificios que reparar.`);
            }
            return s;
        }
    },
    {
        id: 'ev_corruption',
        title: 'Escándalo de Corrupción',
        description: 'Pagas $50 a cada otro jugador para silenciarlos.',
        effect: (state, idx) => {
            const s = {...state};
            const payer = s.players[idx];
            s.players.forEach((p, i) => {
                if (i !== idx && p.alive) {
                    payer.money -= 50;
                    p.money += 50;
                }
            });
            s.logs.push(`${payer.name} reparte sobornos a todos.`);
            return s;
        }
    },
    {
        id: 'ev_trip',
        title: 'Viaje a las Bahamas',
        description: 'Avanza hasta la Salida (Cobras $200).',
        effect: (state, idx) => {
            const s = {...state};
            s.players[idx].pos = 0;
            s.players[idx].money += 200;
            s.estadoMoney -= 200;
            s.logs.push(`${s.players[idx].name} viaja a la Salida.`);
            return s;
        }
    },
    {
        id: 'ev_back3',
        title: 'Resaca Monumental',
        description: 'Retrocede 3 casillas.',
        effect: (state, idx) => {
            const s = {...state};
            let newPos = s.players[idx].pos - 3;
            if (newPos < 0) newPos += s.tiles.length;
            s.players[idx].pos = newPos;
            s.logs.push(`${s.players[idx].name} retrocede 3 casillas.`);
            return s;
        }
    }
];

export const getHouseCost = (tile: TileData): number => {
    if (!tile.price) return 50;
    return Math.floor(tile.price * 0.5);
};

export const formatMoney = (amount: number): string => {
    return '$' + Math.floor(amount).toLocaleString();
};

export const ownsFullGroup = (player: Player, tile: TileData, tiles: TileData[]) => {
    if (!tile.color) return false;
    const group = tiles.filter(t => t.color === tile.color);
    return group.every(t => t.owner === player.id);
};

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
    
    if ((!tile.houses || tile.houses === 0) && !tile.hotel && typeof tile.owner === 'number' && state) {
        const owner = state.players.find(p => p.id === tile.owner);
        if (owner && ownsFullGroup(owner, tile, tiles)) {
            base *= 2;
        }
    }

    if (tile.hotel) base *= 5;
    else if (tile.houses && tile.houses > 0) base *= (tile.houses + 1);
    rent = base;
  }
  return rent;
};

export const getRentTable = (tile: TileData): { label: string, rent: string | number }[] => {
    const base = tile.baseRent || Math.floor((tile.price || 200) * 0.1);
    return [
        { label: 'Alquiler', rent: base },
        { label: '1 Casa', rent: base * 5 },
        { label: '2 Casas', rent: base * 15 },
        { label: '3 Casas', rent: base * 45 },
        { label: '4 Casas', rent: base * 80 },
        { label: 'Hotel', rent: base * 100 },
    ];
};

export const getTransportDestinations = (state: GameState, currentPos: number): number[] => {
    return state.tiles
        .filter(t => ['rail', 'bus', 'ferry', 'air'].includes(t.subtype || '') && t.id !== currentPos)
        .map(t => t.id);
};

export const createInitialState = (): GameState => {
    // Seleccionar gobierno aleatorio inicial
    const govs: GovernmentType[] = ['left', 'right', 'authoritarian', 'libertarian', 'anarchy'];
    const initialGov = govs[Math.floor(Math.random() * govs.length)];

    return {
        players: [],
        tiles: JSON.parse(JSON.stringify(INITIAL_TILES)),
        currentPlayerIndex: 0,
        rolled: false,
        dice: [1, 1],
        logs: ['Bienvenido a Artiako Landak!'],
        auction: null,
        trade: null,
        estadoMoney: 0, // EL ESTADO EMPIEZA SIN DINERO
        turnCount: 1,
        gov: initialGov,
        govTurnsLeft: 3, // CICLOS DE 3 TURNOS
        gameStarted: false,
        selectedTileId: null,
        housesAvail: 32,
        hotelsAvail: 12,
        bankCorrupt: false,
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
        rentFilters: [],
        blockMortgage: {},
        blockBuildTurns: 0,
        sellBonusByOwner: {},
        heatmap: {},
        fbiGuesses: {},
        currentGovConfig: GOV_CONFIGS[initialGov],
        vatIn: 0,
        vatOut: 0,
        usedTransportHop: false,
        rngSeed: Date.now()
    };
};

// --- LOGICA DE POLÍTICA (Se ejecuta al iniciar ronda) ---
const applyGovernmentPolicies = (state: GameState): Partial<GameState> => {
    const newState = { ...state };
    const logs: string[] = [];
    
    if (newState.players.length === 0) return {};

    const gov = newState.gov;
    const config = newState.currentGovConfig;

    newState.players.forEach(p => {
        if (!p.alive) return;

        // Impuestos sobre el patrimonio (cash)
        // Si el tax es positivo (Izquierda/Autoritario), pagan.
        // Si es negativo (Derecha/Libertario), a veces reciben incentivos o simplemente no pagan.
        
        if (config.tax > 0 && p.money > 1000) {
            // Impuesto a la riqueza
            const taxAmount = Math.floor(p.money * (config.tax * 0.1)); // Un % suave del modificador
            if (taxAmount > 0) {
                p.money -= taxAmount;
                newState.estadoMoney += taxAmount;
                logs.push(`🏛️ ${gov.toUpperCase()}: ${p.name} paga impuesto patrimonio $${taxAmount}.`);
            }
        }

        // Welfare (Ayudas)
        if (config.welfare > 0 && p.money < 500) {
            const aid = 100;
            p.money += aid;
            newState.estadoMoney -= aid;
            logs.push(`🏛️ ${gov.toUpperCase()}: Ayuda social de $${aid} para ${p.name}.`);
        }

        // Casos especiales por Rol/Genero (Politicas de identidad)
        if (gov === 'left' && (p.gender === 'female' || p.gender === 'marcianito')) {
             p.money += 20;
             newState.estadoMoney -= 20; // Brecha salarial invertida
        }
        if (gov === 'right' && (p.gender === 'male' || p.gender === 'helicoptero')) {
             p.money += 20;
             newState.estadoMoney -= 20; // Bonus corporativo
        }
        
        // Anarquía: Robos random
        if (gov === 'anarchy' && Math.random() > 0.7) {
             const loss = 50;
             p.money -= loss;
             // El dinero desaparece en el caos
             logs.push(`🏴 ANARQUÍA: ${p.name} fue asaltado y perdió $${loss}.`);
        }
    });

    if (logs.length > 0) newState.logs = [...newState.logs, ...logs];
    return newState;
};

export const gameReducer = (state: GameState, action: { type: string; payload?: any }): GameState => {
    const newState = { ...state };
    const currentPlayer = newState.players[newState.currentPlayerIndex];
    
    switch (action.type) {
        case 'START_GAME': {
            const { humans, bots } = action.payload;
            const newPlayers: Player[] = [];
            
            humans.forEach((h: any, i: number) => {
                newPlayers.push({
                    id: i,
                    name: h.name,
                    money: INITIAL_MONEY,
                    pos: 0,
                    alive: true,
                    jail: 0,
                    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
                    isBot: false,
                    gender: h.gender,
                    props: [],
                    taxBase: 0,
                    vatIn: 0,
                    vatOut: 0,
                    doubleStreak: 0,
                    insiderTokens: 0
                });
            });

            for (let i = 0; i < bots; i++) {
                const id = humans.length + i;
                newPlayers.push({
                    id: id,
                    name: `Bot ${i + 1} ${PLAYER_EMOJIS[i % PLAYER_EMOJIS.length]}`,
                    money: INITIAL_MONEY,
                    pos: 0,
                    alive: true,
                    jail: 0,
                    color: PLAYER_COLORS[id % PLAYER_COLORS.length],
                    isBot: true,
                    gender: 'male', 
                    props: [],
                    taxBase: 0,
                    vatIn: 0,
                    vatOut: 0,
                    doubleStreak: 0,
                    insiderTokens: 0
                });
            }

            newState.players = newPlayers;
            newState.gameStarted = true;
            newState.turnCount = 1;
            newState.currentPlayerIndex = 0;
            newState.logs = ['¡El juego ha comenzado!'];
            return newState;
        }

        case 'ROLL_DICE': {
            if (newState.rolled) return state;
            
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            newState.dice = [d1, d2];
            newState.rolled = true;
            const total = d1 + d2;
            
            newState.logs.push(`${currentPlayer.name} tiró ${d1} y ${d2} (${total})`);

            if (currentPlayer.jail > 0) {
                 if (d1 === d2) {
                     currentPlayer.jail = 0;
                     newState.logs.push(`${currentPlayer.name} saca dobles y sale de la cárcel.`);
                 } else {
                     currentPlayer.jail--;
                     if (currentPlayer.jail === 0) {
                         newState.logs.push(`${currentPlayer.name} cumple su condena.`);
                     } else {
                        newState.logs.push(`${currentPlayer.name} sigue en la cárcel. Turnos restantes: ${currentPlayer.jail}`);
                        return newState; 
                     }
                 }
            }

            if (currentPlayer.jail === 0) {
                let newPos = (currentPlayer.pos + total) % newState.tiles.length;
                if (newPos < currentPlayer.pos) {
                    // Pasar por salida
                    currentPlayer.money += 200; 
                    newState.estadoMoney -= 200; // El Estado paga
                    newState.logs.push(`${currentPlayer.name} pasa por Salida. Cobra $200.`);
                }
                currentPlayer.pos = newPos;
                newState.heatmap[newPos] = (newState.heatmap[newPos] || 0) + 1;

                const tile = newState.tiles[newPos];
                newState.logs.push(`${currentPlayer.name} cae en ${tile.name}`);

                // --- LÓGICA DE CASILLAS ESPECIALES ---
                
                // 1. IMPUESTOS (Dinámicos según Gobierno)
                if (tile.type === TileType.TAX) {
                    const taxRate = Math.max(0, newState.currentGovConfig.tax); // Solo si es positivo
                    let taxAmount = 200; // Base
                    
                    if (newState.gov === 'libertarian') taxAmount = 0; // Libertario no paga
                    else if (newState.gov === 'anarchy') taxAmount = 0; // Nadie cobra
                    else {
                        // Ajustar por la tasa impositiva
                        taxAmount = Math.floor(200 * (1 + taxRate));
                    }

                    if (taxAmount > 0) {
                        currentPlayer.money -= taxAmount;
                        newState.estadoMoney += taxAmount;
                        newState.logs.push(`${currentPlayer.name} paga $${taxAmount} de impuestos (${newState.gov}).`);
                    } else {
                        newState.logs.push(`${currentPlayer.name} se libra de impuestos gracias al gobierno.`);
                    }
                }
                
                // 2. EVENTOS (SUERTE)
                if (tile.type === TileType.EVENT) {
                    // Seleccionar evento aleatorio del mazo ampliado
                    const evt = EVENTS_DECK[Math.floor(Math.random() * EVENTS_DECK.length)];
                    newState.logs.push(`🍀 SUERTE: ${evt.title}`);
                    // Ejecutar efecto
                    return evt.effect(newState, newState.currentPlayerIndex);
                }
                
                // 3. CÁRCEL
                if (tile.type === TileType.GOTOJAIL) {
                    const jailTileIdx = newState.tiles.findIndex(t => t.type === TileType.JAIL);
                    currentPlayer.pos = jailTileIdx !== -1 ? jailTileIdx : 26; 
                    currentPlayer.jail = 3;
                    newState.logs.push(`${currentPlayer.name} va a la cárcel.`);
                    newState.rolled = true;
                }
            }

            return newState;
        }

        case 'BOT_RESOLVE_TURN': {
            if (!currentPlayer.isBot) return state;
            const tile = newState.tiles[currentPlayer.pos];
            
            // 1. Pay Rent (CON IVA)
            if (tile.type === TileType.PROP && tile.owner !== null && tile.owner !== currentPlayer.id && tile.owner !== 'E' && !tile.mortgaged) {
                const rentTotal = getRent(tile, state.dice[0]+state.dice[1], state.tiles, state);
                const owner = state.players.find(p => p.id === tile.owner);
                
                if (owner) {
                    const ivaRate = Math.max(0, newState.currentGovConfig.rentIVA);
                    const ivaAmount = Math.floor(rentTotal * ivaRate);
                    const netRent = rentTotal - ivaAmount;

                    currentPlayer.money -= rentTotal;
                    
                    // El dueño recibe el neto
                    const ownerIdx = state.players.findIndex(p => p.id === owner.id);
                    newState.players[ownerIdx].money += netRent;
                    
                    // El estado recibe el IVA
                    newState.estadoMoney += ivaAmount;

                    newState.logs.push(`🤖 ${currentPlayer.name} paga $${rentTotal} (IVA: $${ivaAmount}).`);
                }
            }
            
            // 2. Buy Property
            if (tile.type === TileType.PROP && tile.owner === null && currentPlayer.money > (tile.price || 0) + 200) {
                // Bloqueo gubernamental izquierda
                if (newState.gov === 'left' && Math.random() > 0.5) {
                    // A veces no compran en izquierda por miedo a expropiación
                } else {
                    currentPlayer.money -= (tile.price || 0);
                    newState.estadoMoney += (tile.price || 0); // Paga al Estado
                    tile.owner = currentPlayer.id;
                    currentPlayer.props.push(tile.id);
                    newState.logs.push(`🤖 ${currentPlayer.name} compró ${tile.name}.`);
                }
            }

            return newState;
        }

        case 'END_TURN': {
            newState.rolled = false;
            newState.usedTransportHop = false;
            
            let loops = 0;
            do {
                newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
                loops++;
            } while (!newState.players[newState.currentPlayerIndex].alive && loops < newState.players.length);

            // INICIO DE RONDA (Turno del primer jugador)
            if (newState.currentPlayerIndex === 0) {
                newState.turnCount++;
                
                // Aplicar políticas del gobierno actual (Welfare, Taxes por turno)
                const policyUpdates = applyGovernmentPolicies(newState);
                Object.assign(newState, policyUpdates);

                if (newState.govTurnsLeft > 0) newState.govTurnsLeft--;
                
                // CAMBIO DE GOBIERNO CADA 3 TURNOS
                if (newState.govTurnsLeft === 0) {
                    const govs: GovernmentType[] = ['left', 'right', 'authoritarian', 'libertarian', 'anarchy'];
                    let nextGov = govs[Math.floor(Math.random() * govs.length)];
                    
                    // Intentar que cambie, aunque es aleatorio puro, si sale el mismo, pues sale.
                    // Para dar sensación de cambio, forzamos un reroll si es el mismo (opcional, pero lo dejo random puro o reroll simple)
                    if (nextGov === newState.gov) {
                         nextGov = govs[Math.floor(Math.random() * govs.length)];
                    }
                    
                    newState.gov = nextGov;
                    newState.govTurnsLeft = 3; // RESET A 3
                    newState.currentGovConfig = GOV_CONFIGS[newState.gov];
                    newState.logs.push(`🚨 ¡GOLPE DE TIMÓN! Nuevo Gobierno: ${newState.gov.toUpperCase()} (Duración: 3 turnos)`);
                }
            }
            return newState;
        }

        case 'SELECT_TILE':
            newState.selectedTileId = action.payload;
            return newState;

        case 'CLOSE_MODAL':
            newState.selectedTileId = null;
            return newState;
            
        case 'BUY_PROP': {
            const tile = newState.tiles[currentPlayer.pos];
            if (tile && tile.type === TileType.PROP && tile.owner === null && tile.price && currentPlayer.money >= tile.price) {
                currentPlayer.money -= tile.price;
                newState.estadoMoney += tile.price; // Paga al Estado
                tile.owner = currentPlayer.id;
                currentPlayer.props.push(tile.id);
                newState.logs.push(`${currentPlayer.name} compró ${tile.name} por ${formatMoney(tile.price)}`);
            }
            return newState;
        }
        
        case 'PAY_RENT': {
             const tile = newState.tiles[currentPlayer.pos];
             if (tile && typeof tile.owner === 'number') {
                 const rentTotal = getRent(tile, state.dice[0]+state.dice[1], state.tiles, state);
                 const ownerIdx = state.players.findIndex(p => p.id === tile.owner);
                 const owner = newState.players[ownerIdx];
                 
                 if (currentPlayer.money >= rentTotal) {
                     // Lógica de IVA
                     const ivaRate = Math.max(0, newState.currentGovConfig.rentIVA);
                     const ivaAmount = Math.floor(rentTotal * ivaRate);
                     const netRent = rentTotal - ivaAmount;

                     currentPlayer.money -= rentTotal;
                     owner.money += netRent;
                     newState.estadoMoney += ivaAmount;

                     newState.logs.push(`${currentPlayer.name} pagó ${formatMoney(rentTotal)} (IVA ${formatMoney(ivaAmount)} pal Estado).`);
                 } else {
                     newState.logs.push(`${currentPlayer.name} no puede pagar el alquiler!`);
                 }
             }
             return newState;
        }

        case 'DEBUG_ADD_MONEY': {
            const { pId, amount } = action.payload;
            if (newState.players[pId]) {
                newState.players[pId].money += amount;
                newState.logs.push(`DEBUG: ${newState.players[pId].name} ${amount > 0 ? '+' : ''}${amount}`);
            }
            return newState;
        }
        case 'DEBUG_TELEPORT': {
            const { pId, pos } = action.payload;
            if (newState.players[pId]) {
                newState.players[pId].pos = pos;
                newState.logs.push(`DEBUG: ${newState.players[pId].name} teleported to #${pos}`);
            }
            return newState;
        }
        case 'DEBUG_SET_ROLE':
            if (newState.players[action.payload.pId]) {
                newState.players[action.payload.pId].role = action.payload.role;
            }
            return newState;
        case 'DEBUG_SET_GOV':
            newState.gov = action.payload;
            newState.currentGovConfig = GOV_CONFIGS[action.payload as GovernmentType];
            return newState;
        case 'DEBUG_TRIGGER_EVENT':
             const evt = EVENTS_DECK.find(e => e.id === action.payload);
             if (evt) return evt.effect(newState, newState.currentPlayerIndex);
             return newState;
        case 'PAY_JAIL':
            if (currentPlayer.money >= 50) {
                currentPlayer.money -= 50;
                newState.estadoMoney += 50; // Paga al Estado
                currentPlayer.jail = 0;
                newState.logs.push(`${currentPlayer.name} pagó $50 de fianza al Estado.`);
            }
            return newState;
        case 'TRAVEL_TRANSPORT':
            if (currentPlayer.money >= 50 && action.payload.destId) {
                currentPlayer.money -= 50;
                newState.estadoMoney += 50; // Paga al transporte público
                currentPlayer.pos = action.payload.destId;
                newState.usedTransportHop = true;
                newState.heatmap[currentPlayer.pos] = (newState.heatmap[currentPlayer.pos] || 0) + 1;
                newState.logs.push(`${currentPlayer.name} viajó en transporte a ${newState.tiles[currentPlayer.pos].name}`);
            }
            return newState;
        case 'START_AUCTION':
            newState.auction = {
                tileId: action.payload,
                currentBid: newState.tiles[action.payload].price || 100,
                highestBidder: null,
                activePlayers: newState.players.filter(p => !p.isBot).map(p => p.id),
                timer: 20,
                isOpen: true,
                kind: 'tile'
            };
            return newState;
        case 'BID_AUCTION':
            if (newState.auction) {
                newState.auction.currentBid = action.payload.amount;
                newState.auction.highestBidder = action.payload.pId;
                newState.auction.timer = 20; 
            }
            return newState;
        case 'WITHDRAW_AUCTION':
            if (newState.auction) {
                newState.auction.activePlayers = newState.auction.activePlayers.filter(id => id !== action.payload.pId);
            }
            return newState;
        case 'END_AUCTION':
             if (newState.auction && newState.auction.highestBidder !== null && typeof newState.auction.highestBidder === 'number') {
                 const winnerIdx = newState.players.findIndex(p => p.id === newState.auction!.highestBidder);
                 const winner = newState.players[winnerIdx];
                 const tile = newState.tiles[newState.auction.tileId];
                 winner.money -= newState.auction.currentBid;
                 newState.estadoMoney += newState.auction.currentBid; // Subasta va al estado
                 tile.owner = winner.id;
                 winner.props.push(tile.id);
                 newState.logs.push(`${winner.name} ganó la subasta de ${tile.name} por ${formatMoney(newState.auction.currentBid)}`);
             }
             newState.auction = null;
             return newState;
        case 'TOGGLE_BANK_MODAL': newState.showBankModal = !newState.showBankModal; return newState;
        case 'CLOSE_BANK_MODAL': newState.showBankModal = false; return newState;
        case 'TOGGLE_BALANCE_MODAL': newState.showBalanceModal = !newState.showBalanceModal; return newState;
        case 'TOGGLE_HEATMAP': newState.showHeatmap = !newState.showHeatmap; return newState;
        case 'BUILD_HOUSE': {
             const t = newState.tiles[action.payload.tId];
             const cost = getHouseCost(t);
             if (currentPlayer.money >= cost) {
                 currentPlayer.money -= cost;
                 newState.estadoMoney += cost; // Permisos de obra
                 t.houses = (t.houses || 0) + 1;
                 if (t.houses > 4) { t.hotel = true; t.houses = 0; }
                 newState.logs.push(`${currentPlayer.name} mejoró ${t.name}`);
             }
             return newState;
        }
        case 'PROPOSE_TRADE':
            if (action.payload) { newState.trade = action.payload; newState.showTradeModal = true; } 
            else { newState.trade = null; newState.showTradeModal = true; }
            return newState;
        case 'CLOSE_TRADE': newState.showTradeModal = false; newState.trade = null; return newState;
        case 'REJECT_TRADE': newState.trade = null; newState.showTradeModal = false; newState.logs.push(`Trato rechazado.`); return newState;
        case 'ACCEPT_TRADE':
             if (newState.trade) {
                 const p1 = newState.players[newState.trade.initiatorId];
                 const p2 = newState.players[newState.trade.targetId];
                 p1.money -= newState.trade.offeredMoney;
                 p2.money += newState.trade.offeredMoney;
                 p2.money -= newState.trade.requestedMoney;
                 p1.money += newState.trade.requestedMoney;
                 newState.trade.offeredProps.forEach(pid => {
                     newState.tiles[pid].owner = p2.id;
                     p1.props = p1.props.filter(id => id !== pid);
                     p2.props.push(pid);
                 });
                 newState.trade.requestedProps.forEach(pid => {
                     newState.tiles[pid].owner = p1.id;
                     p2.props = p2.props.filter(id => id !== pid);
                     p1.props.push(pid);
                 });
                 newState.logs.push(`Trato aceptado entre ${p1.name} y ${p2.name}`);
                 newState.trade = null;
                 newState.showTradeModal = false;
             }
             return newState;
        case 'MORTGAGE_PROP': {
            const t = newState.tiles[action.payload.tId];
            if (!t.mortgaged) {
                t.mortgaged = true;
                const amount = Math.floor((t.price || 0) * 0.5);
                currentPlayer.money += amount;
                newState.estadoMoney -= amount; // El banco te da la hipoteca
                newState.logs.push(`${currentPlayer.name} hipotecó ${t.name} por ${formatMoney(amount)}`);
            }
            return newState;
        }
        case 'UNMORTGAGE_PROP': {
            const t = newState.tiles[action.payload.tId];
            if (t.mortgaged) {
                const amount = Math.floor((t.price || 0) * 0.55);
                if (currentPlayer.money >= amount) {
                    currentPlayer.money -= amount;
                    newState.estadoMoney += amount; // Pagas al banco
                    t.mortgaged = false;
                    newState.logs.push(`${currentPlayer.name} deshipotecó ${t.name} por ${formatMoney(amount)}`);
                }
            }
            return newState;
        }
        case 'TAKE_LOAN': {
             const { amount, turns } = action.payload;
             const loan: Loan = {
                 id: `loan_${Date.now()}`,
                 borrowerId: currentPlayer.id,
                 lenderId: 'E',
                 principal: amount,
                 interestTotal: Math.floor(amount * 0.2),
                 turnsTotal: turns,
                 turnsLeft: turns,
                 amountPerTurn: Math.floor((amount * 1.2) / turns),
                 status: 'active'
             };
             currentPlayer.money += amount;
             newState.estadoMoney -= amount; // Sale de las arcas del estado
             newState.loans.push(loan);
             newState.logs.push(`${currentPlayer.name} tomó un préstamo de ${formatMoney(amount)}`);
             return newState;
        }
        case 'CREATE_POOL': return newState;
        case 'CREATE_OPTION': return newState;
        case 'PLAY_CASINO': return newState;
        case 'CLOSE_CASINO': newState.showCasinoModal = false; return newState;
        case 'BET_GREYHOUND':
             newState.greyhoundBets[action.payload.pId] = action.payload.dogId;
             newState.players[action.payload.pId].money -= action.payload.amount;
             newState.greyhoundPot += action.payload.amount;
             return newState;

        default:
            return state;
    }
};
