
import React, { useState, useEffect, useReducer, useRef } from 'react';
import { Board } from './components/Board';
import { DebugPanel } from './components/DebugPanel';
import { GameState, Player, TileType, INITIAL_MONEY, TileData, Loan, AuctionState, TradeOffer, FinancialOption } from './types';
import { createInitialState, rollDice, getRent, formatMoney, getNextPlayerIndex, assignRoles, handleGovernmentTick, createLoan, processTurnLoans, drawEvent, initGreyhounds, EVENTS_DECK, getRentTable, ownsFullGroup, getHouseCost, canSellEven, performStateAutoBuild, checkFiestaClandestina, getTransportDestinations, tickAdvancedEvents, calculateMaintenance, checkMarginCalls, createLoanPool, distributePoolDividends, trackTileLanding, handleRoleAbilities, processFioreTips, validateState, makeHistory, makeWatchdog, createFinancialOption, playBlackjack, playRoulette, getBotTradeProposal, evaluateTradeByBot } from './utils/gameLogic';
import { COLORS, PLAYER_COLORS, FUNNY } from './constants';

const SAVE_KEY = 'artiako_landak_save_v2';

const resolveAuction = (state: GameState): GameState => {
    if (!state.auction) return state;
    const winnerId = state.auction.highestBidder;
    let newState = { ...state };
    
    if (winnerId !== null && typeof winnerId === 'number') {
        const wIdx = state.players.findIndex(p => p.id === winnerId);
        if (wIdx === -1) return { ...state, auction: null };
        
        const wPlayer = { ...state.players[wIdx] };
        const wTiles = [...state.tiles];
        
        if (wPlayer.money >= state.auction.currentBid) {
            wPlayer.money -= state.auction.currentBid;
            newState.estadoMoney += state.auction.currentBid;
            
            const targets = state.auction.kind === 'bundle' && state.auction.items ? state.auction.items : [state.auction.tileId];
            targets.forEach(tid => {
                if (!wPlayer.props.includes(tid)) wPlayer.props.push(tid);
                wTiles[tid].owner = wPlayer.id;
            });
            
            const wPs = [...state.players];
            wPs[wIdx] = wPlayer;
            
            newState.players = wPs;
            newState.tiles = wTiles;
            newState.logs = [`🔨 ¡Vendido! ${wPlayer.name} gana por ${formatMoney(state.auction.currentBid)}`, ...state.logs];
        } else {
             newState.logs = [`🔨 Subasta cancelada: ${wPlayer.name} no puede pagar.`, ...state.logs];
        }
    } else {
        newState.logs = ['🔨 Subasta desierta.', ...state.logs];
    }
    
    newState.auction = null;
    return newState;
};

const gameReducer = (state: GameState, action: any): GameState => {
  switch (action.type) {
    case 'START_GAME':
      const playersWithRoles = action.payload; 
      return { 
        ...state, 
        players: playersWithRoles, 
        gameStarted: true, 
        currentPlayerIndex: 0,
        estadoMoney: 0, 
        logs: ['Partida comenzada!', 'Roles asignados.', '¡Buena suerte!'],
        turnCount: 1
      };
      
    case 'LOAD_GAME':
      return { ...action.payload, logs: ['💾 Partida cargada correctamente.', ...action.payload.logs] };
    
    case 'RESTORE_STATE':
        return action.payload;

    case 'ROLL_DICE':
      if (state.rolled) return state;
      const pIdx = state.currentPlayerIndex;
      const player = { ...state.players[pIdx] };
      const [d1, d2] = action.payload?.dice || rollDice(); 
      const total = d1 + d2;
      const isDouble = d1 === d2;
      
      let logs = [`${player.name} sacó ${d1} + ${d2} = ${total}.${isDouble ? ' ¡DOBLES!' : ''}`];
      let newPlayers = [...state.players];
      let newRolled = !isDouble; 
      let newPos = (player.pos + total) % state.tiles.length;
      let newEstadoMoney = state.estadoMoney;
      
      if (player.jail > 0) {
          if (isDouble) { 
              player.jail = 0; 
              logs.push('¡Dobles! Sales de la cárcel.'); 
              newPos = (player.pos + total) % state.tiles.length; 
          } else { 
              player.jail--; 
              logs.push(`Te quedan ${player.jail} turnos.`); 
              newPos = player.pos; 
              newRolled = true; 
          }
      } else {
          if (newPos < player.pos) { 
              const salary = 200;
              player.money += salary; 
              newEstadoMoney -= salary;
              logs.push('Cobras 200 de salida (paga el Estado).'); 
          }
      }
      
      player.pos = newPos;
      const newHeatmap = trackTileLanding(state, newPos);
      const roleLogs = handleRoleAbilities(state, player, state.tiles[newPos]);
      
      const tile = state.tiles[newPos];
      let showCasino = false;
      let casinoGame: 'blackjack' | 'roulette' | null = null;
      if (tile.subtype === 'casino_bj') { showCasino = true; casinoGame = 'blackjack'; }
      if (tile.subtype === 'casino_roulette') { showCasino = true; casinoGame = 'roulette'; }
      if (tile.type === TileType.SLOTS) { showCasino = true; casinoGame = null; }

      if (player.isBot) {
          showCasino = false; 
      }

      newPlayers[pIdx] = player;

      let finalState: GameState = {
        ...state,
        rolled: newRolled,
        dice: [d1, d2] as [number, number],
        players: newPlayers,
        estadoMoney: newEstadoMoney,
        heatmap: newHeatmap,
        showCasinoModal: showCasino,
        casinoGame: casinoGame,
        logs: [...logs, ...roleLogs, ...state.logs],
        selectedTileId: state.selectedTileId, 
        usedTransportHop: false
      };

      if (tile.type === TileType.EVENT) {
          const evtRes = drawEvent(finalState, pIdx);
          finalState = { ...finalState, ...evtRes };
      }

      return finalState;
    
    case 'END_TURN':
      let epIdx = state.currentPlayerIndex;
      let ePlayer = state.players[epIdx];
      let endLogs: string[] = [];
      let ePlayers = [...state.players];
      
      let currentEstadoMoney = state.estadoMoney;

      const loanRes = processTurnLoans(state, epIdx);
      endLogs.push(...(loanRes.logs || []));
      ePlayers = loanRes.players as Player[];
      
      const fiorePay = state.tiles.filter(t => t.subtype === 'fiore' && t.owner === ePlayer.id).reduce((acc, t) => acc + (t.workers||0)*70, 0); 
      if(fiorePay > 0) endLogs.push(...processFioreTips(state, ePlayers[epIdx], fiorePay));

      const stateBuild = performStateAutoBuild(state.tiles, state.housesAvail, state.hotelsAvail, currentEstadoMoney, state.gov);
      const eTiles = stateBuild.tiles;
      currentEstadoMoney = stateBuild.estadoMoney;
      
      endLogs.push(...stateBuild.logs);

      const advUpdates = tickAdvancedEvents(state);
      const govUpdate = handleGovernmentTick({ ...state, players: ePlayers, estadoMoney: currentEstadoMoney });
      
      if (govUpdate.estadoMoney !== undefined) currentEstadoMoney = govUpdate.estadoMoney;
      let finalPlayers = govUpdate.players || ePlayers;

      let nextIdx = getNextPlayerIndex({ ...state, players: finalPlayers });
      
      const maintFee = calculateMaintenance(finalPlayers[nextIdx].id, eTiles);
      if (maintFee > 0) { 
          finalPlayers[nextIdx].money -= maintFee; 
          currentEstadoMoney += maintFee; 
          endLogs.push(`🏗️ Mantenimiento: ${finalPlayers[nextIdx].name} paga ${formatMoney(maintFee)}.`);
      }
      
      const marginRes = checkMarginCalls({ ...state, players: finalPlayers, tiles: eTiles } as GameState, finalPlayers[nextIdx].id);
      if (marginRes.soldTiles.length > 0) {
          endLogs.push(`📉 MARGIN CALL: ${finalPlayers[nextIdx].name} vende: ${marginRes.soldTiles.join(', ')} (+${formatMoney(marginRes.amountRaised)}).`);
      }
      
      const newState = {
        ...state,
        ...govUpdate, 
        ...advUpdates,
        tiles: eTiles,
        loans: loanRes.loans as Loan[],
        currentPlayerIndex: nextIdx,
        rolled: false,
        turnCount: state.turnCount + 1,
        logs: [`Turno de ${finalPlayers[nextIdx].name}`, ...endLogs, ...(govUpdate.logs||[]), ...state.logs]
      };

      const validationErrs = validateState(newState, newState.tiles);
      if(validationErrs.length > 0) {
          console.error("State Corruption Detected:", validationErrs);
          newState.logs = [...newState.logs, ...validationErrs.map(e => `⚠️ ERROR: ${e}`)];
      }

      return newState;

    case 'BUY_PROP': { 
        const buyerIdx = state.currentPlayerIndex; 
        const buyer = { ...state.players[buyerIdx] }; 
        const tileId = buyer.pos; 
        const tile = { ...state.tiles[tileId] }; 
        
        if (state.gov === 'left') {
             return { ...state, logs: ['🚫 Gobierno de Izquierdas prohíbe la compra privada.', ...state.logs] };
        }

        if (tile.price && buyer.money >= tile.price) { 
            buyer.money -= tile.price; 
            state.estadoMoney += tile.price; 
            buyer.props.push(tileId); 
            tile.owner = buyer.id; 
            const uPlayers = [...state.players]; 
            uPlayers[buyerIdx] = buyer; 
            const uTiles = [...state.tiles]; 
            uTiles[tileId] = tile; 
            return { ...state, players: uPlayers, tiles: uTiles, logs: [`${buyer.name} compró ${tile.name} por ${formatMoney(tile.price)} (Pago al Estado)`, ...state.logs] }; 
        } 
        return state; 
    }
    case 'BUILD_HOUSE': {
        const { tId } = action.payload;
        const pIdx = state.currentPlayerIndex;
        const player = { ...state.players[pIdx] };
        const tile = { ...state.tiles[tId] };
        const cost = getHouseCost(tile);

        if (tile.owner === player.id && player.money >= cost && (tile.houses || 0) < 5) {
             player.money -= cost;
             state.estadoMoney += cost; 
             if ((tile.houses || 0) === 4) { tile.houses = 0; tile.hotel = true; }
             else { tile.houses = (tile.houses || 0) + 1; }
             
             const uTiles = [...state.tiles]; uTiles[tId] = tile;
             const uPlayers = [...state.players]; uPlayers[pIdx] = player;
             return { ...state, tiles: uTiles, players: uPlayers, logs: [`${player.name} mejoró ${tile.name}.`, ...state.logs] };
        }
        return state;
    }
    case 'PAY_RENT': { 
        const payerIdx = state.currentPlayerIndex; 
        const payer = { ...state.players[payerIdx] }; 
        const tId = payer.pos; 
        const t = state.tiles[tId]; 
        const baseRent = getRent(t, state.dice[0] + state.dice[1], state.tiles, state); 
        
        if (baseRent > 0 && typeof t.owner === 'number' && t.owner !== payer.id) { 
            const ivaRate = state.currentGovConfig.rentIVA || 0; 
            const ivaAmount = Math.round(baseRent * ivaRate);
            const totalPay = baseRent + ivaAmount;

            payer.money -= totalPay; 
            
            const ownerIdx = state.players.findIndex(p => p.id === t.owner); 
            const updatedPlayers = [...state.players]; 
            updatedPlayers[payerIdx] = payer; 
            
            let logStr = `${payer.name} pagó ${formatMoney(baseRent)} a ${updatedPlayers[ownerIdx]?.name}`;

            if (ownerIdx !== -1) { 
                updatedPlayers[ownerIdx] = { ...updatedPlayers[ownerIdx], money: updatedPlayers[ownerIdx].money + baseRent }; 
            } 
            
            let newEstadoMoney = state.estadoMoney;
            if (ivaAmount > 0) {
                newEstadoMoney += ivaAmount;
                logStr += ` + ${formatMoney(ivaAmount)} IVA al Estado.`;
            }

            return { ...state, players: updatedPlayers, estadoMoney: newEstadoMoney, logs: [logStr, ...state.logs] }; 
        } 
        return state; 
    }
    case 'PAY_JAIL': { 
        const jpIdx = state.currentPlayerIndex; 
        const jPlayer = { ...state.players[jpIdx] }; 
        if (jPlayer.money >= 50 && jPlayer.jail > 0) { 
            jPlayer.money -= 50; 
            jPlayer.jail = 0; 
            const jpPlayers = [...state.players]; 
            jpPlayers[jpIdx] = jPlayer; 
            return { ...state, players: jpPlayers, estadoMoney: state.estadoMoney + 50, logs: [`${jPlayer.name} paga fianza de $50 y queda libre.`, ...state.logs] }; 
        } 
        return state; 
    }

    // --- AUCTION ---
    case 'START_AUCTION': { 
        const aucTileId = action.payload; 
        return { 
            ...state, 
            auction: { 
                tileId: aucTileId, 
                currentBid: 0, 
                highestBidder: null, 
                activePlayers: state.players.filter(p => p.alive).map(p => p.id), 
                timer: 20, 
                isOpen: true, 
                kind: 'tile' 
            } 
        }; 
    }
    case 'BID_AUCTION': { 
        const { amount, pId: bidderId } = action.payload; 
        if (state.auction && amount > state.auction.currentBid && state.auction.activePlayers.includes(bidderId)) { 
            return { ...state, auction: { ...state.auction, currentBid: amount, highestBidder: bidderId, timer: 10 }, logs: [`Subasta: ${state.players[bidderId].name} puja ${formatMoney(amount)}`, ...state.logs] }; 
        } 
        return state; 
    }
    case 'TICK_AUCTION': {
        if (!state.auction || !state.auction.isOpen) return state;
        if (state.auction.timer <= 0) {
             return resolveAuction(state);
        }
        return { ...state, auction: { ...state.auction, timer: state.auction.timer - 1 } };
    }
    case 'WITHDRAW_AUCTION': {
        const { pId } = action.payload;
        if (!state.auction) return state;
        const newActive = state.auction.activePlayers.filter(id => id !== pId);
        const quitter = state.players.find(p => p.id === pId);
        
        if (newActive.length === 0) {
            // Everyone left, end auction immediately
            return resolveAuction(state);
        }
        
        return { 
            ...state, 
            auction: { ...state.auction, activePlayers: newActive }, 
            logs: [`${quitter?.name} se retiró de la subasta.`, ...state.logs] 
        };
    }

    case 'END_AUCTION': { 
        return resolveAuction(state);
    }
    
    // --- TRADE ---
    case 'PROPOSE_TRADE': {
        const proposal = action.payload; // If generic open modal, handle in UI. If bot payload, handle here.
        if (proposal) return { ...state, trade: proposal, showTradeModal: true };
        return { ...state, showTradeModal: true };
    }
    case 'ACCEPT_TRADE': {
        if (!state.trade) return state;
        const t = state.trade;
        const p1 = state.players.find(p => p.id === t.initiatorId);
        const p2 = state.players.find(p => p.id === t.targetId);
        if (!p1 || !p2) return state;

        // Execute Money
        p1.money -= t.offeredMoney; p1.money += t.requestedMoney;
        p2.money -= t.requestedMoney; p2.money += t.offeredMoney;

        // Execute Props
        const newTiles = [...state.tiles];
        t.offeredProps.forEach(pid => {
            const tile = newTiles[pid];
            p1.props = p1.props.filter(id => id !== pid);
            p2.props.push(pid);
            tile.owner = p2.id;
        });
        t.requestedProps.forEach(pid => {
            const tile = newTiles[pid];
            p2.props = p2.props.filter(id => id !== pid);
            p1.props.push(pid);
            tile.owner = p1.id;
        });

        const ps = [...state.players];
        // Ensure array update
        return { ...state, players: ps, tiles: newTiles, trade: null, showTradeModal: false, logs: [`🤝 ¡Trato cerrado entre ${p1.name} y ${p2.name}!`, ...state.logs] };
    }
    case 'REJECT_TRADE': {
        return { ...state, trade: null, showTradeModal: false, logs: [`❌ Trato rechazado.`, ...state.logs] };
    }

    // --- LOANS & POOLS ---
    case 'TAKE_LOAN': { const { amount, interest, turns } = action.payload; const lBorrowerIdx = state.currentPlayerIndex; const lBorrower = { ...state.players[lBorrowerIdx] }; const newLoan = createLoan(lBorrower.id, amount, interest, turns); lBorrower.money += amount; const lPlayers = [...state.players]; lPlayers[lBorrowerIdx] = lBorrower; return { ...state, players: lPlayers, loans: [...state.loans, newLoan], estadoMoney: state.estadoMoney - amount, showBankModal: false, logs: [`${lBorrower.name} pidió un préstamo corrupto de ${formatMoney(amount)}`, ...state.logs] }; }
    case 'CREATE_POOL': { const { loanIds, name } = action.payload; if(loanIds.length === 0) return state; const pool = createLoanPool(state, loanIds, name); return { ...state, logs: [`Pool "${name}" creado con ${loanIds.length} préstamos.`, ...state.logs] }; }
    case 'DISTRIBUTE_DIVIDENDS': { const { poolId } = action.payload; const amt = distributePoolDividends(state, poolId); return { ...state, logs: [`Repartidos $${amt} en dividendos del Pool.`, ...state.logs] }; }
    
    // --- FINANCIAL OPTIONS ---
    case 'CREATE_OPTION': {
        const { type, propId, strike, premium, buyerId } = action.payload;
        const sellerId = state.players[state.currentPlayerIndex].id;
        const opt = createFinancialOption(state, type, propId, strike, premium, sellerId, buyerId);
        const buyer = state.players.find(p => p.id === buyerId);
        const seller = state.players.find(p => p.id === sellerId);
        if(buyer && seller && buyer.money >= premium) {
            buyer.money -= premium;
            seller.money += premium;
            return { ...state, financialOptions: [...state.financialOptions, opt], logs: [`Opción ${type.toUpperCase()} creada sobre #${propId} para ${buyer.name}.`, ...state.logs] };
        }
        return state;
    }
    case 'EXERCISE_OPTION': {
        const { optId } = action.payload;
        const opt = state.financialOptions.find(o => o.id === optId);
        if(!opt) return state;
        const buyer = state.players.find(p => p.id === opt.buyerId);
        const seller = state.players.find(p => p.id === opt.sellerId);
        const tile = state.tiles[opt.propertyId];
        if(buyer && seller && tile && buyer.money >= opt.strikePrice) {
             buyer.money -= opt.strikePrice;
             seller.money += opt.strikePrice;
             tile.owner = buyer.id;
             const remainingOpts = state.financialOptions.filter(o => o.id !== optId);
             return { ...state, financialOptions: remainingOpts, logs: [`Opción ejercida! ${buyer.name} adquiere ${tile.name}.`, ...state.logs] };
        }
        return state;
    }

    // --- CASINO ---
    case 'PLAY_CASINO': {
        const { game, bet } = action.payload; 
        const player = state.players[state.currentPlayerIndex];
        let amount = 0;
        let logMsg = '';
        
        if (game === 'blackjack') {
            const res = playBlackjack();
            if (res.win) { amount = 15; player.money += 15; logMsg = `🃏 BJ: ${player.name} GANA (${res.player} vs ${res.dealer})`; }
            else if (res.push) { logMsg = `🃏 BJ: Empate (${res.player})`; }
            else { player.money -= 30; logMsg = `🃏 BJ: Pierdes (${res.player} vs ${res.dealer})`; }
        } else if (game === 'roulette') {
            const { betAmount, color } = bet;
            if (player.money >= betAmount) {
                const res = playRoulette(color);
                if (res.win) { 
                    const mult = color === 'green' ? 35 : 1; 
                    player.money += betAmount * mult; 
                    logMsg = `🎯 Ruleta: ${res.outcome} (${res.color}). GANAS ${formatMoney(betAmount*mult)}!`;
                } else {
                    player.money -= betAmount;
                    logMsg = `🎯 Ruleta: ${res.outcome} (${res.color}). Pierdes.`;
                }
            }
        }
        
        return { ...state, showCasinoModal: false, logs: [logMsg, ...state.logs] };
    }
    case 'CLOSE_CASINO': return { ...state, showCasinoModal: false };
    case 'FBI_GUESS': { const { fbiId, targetId, roleGuess } = action.payload; const fbi = state.players.find(p => p.id === fbiId); const target = state.players.find(p => p.id === targetId); if(!fbi || !target) return state; const newGuesses = { ...state.fbiGuesses }; if(!newGuesses[fbiId]) newGuesses[fbiId] = {}; newGuesses[fbiId][targetId] = roleGuess; const isCorrect = target.role === roleGuess; const logMsg = isCorrect ? `🕵️ FBI ${fbi.name} acertó: ${target.name} es ${roleGuess}!` : `🕵️ FBI ${fbi.name} falló sospecha sobre ${target.name}.`; return { ...state, fbiGuesses: newGuesses, logs: [logMsg, ...state.logs] }; }
    case 'TOGGLE_HEATMAP': return { ...state, showHeatmap: !state.showHeatmap };
    case 'TOGGLE_LOANS_MODAL': return { ...state, showLoansModal: !state.showLoansModal };
    case 'CLOSE_BANK_MODAL': return { ...state, showBankModal: false };
    case 'TOGGLE_BANK_MODAL': return { ...state, showBankModal: !state.showBankModal };
    case 'SELECT_TILE': return { ...state, selectedTileId: action.payload };
    case 'CLOSE_MODAL': return { ...state, selectedTileId: null };
    case 'CLOSE_EVENT': return { ...state, activeEvent: null };
    case 'TOGGLE_BALANCE_MODAL': return { ...state, showBalanceModal: !state.showBalanceModal };
    case 'PROPOSE_TRADE': return { ...state, showTradeModal: true };
    case 'CLOSE_TRADE': return { ...state, showTradeModal: false };
    case 'DEBUG_ADD_MONEY': { const { pId, amount } = action.payload; const ps = [...state.players]; if (ps[pId]) ps[pId].money += amount; return { ...state, players: ps }; }
    case 'DEBUG_TELEPORT': { const { pId, pos } = action.payload; const ps = [...state.players]; if (ps[pId]) ps[pId].pos = pos; return { ...state, players: ps }; }
    case 'DEBUG_SET_ROLE': { const { pId, role } = action.payload; const ps = [...state.players]; if (ps[pId]) ps[pId].role = role as any; return { ...state, players: ps }; }
    case 'DEBUG_SET_GOV': return { ...state, gov: action.payload as any };
    case 'DEBUG_TRIGGER_EVENT': return { ...state, nextEventId: action.payload };

    default: return state;
  }
};

const App: React.FC = () => {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const [setupOpen, setSetupOpen] = useState(true);
  
  // Animation State
  const [isRolling, setIsRolling] = useState(false);
  const [displayDice, setDisplayDice] = useState<[number, number]>([1, 1]);
  
  // Setup Configuration State
  const [setupHumans, setSetupHumans] = useState(2);
  const [humanConfigs, setHumanConfigs] = useState<{name: string, gender: 'male'|'female'|'helicoptero'|'marcianito'}[]>([
      { name: 'Jugador 1', gender: 'male' },
      { name: 'Jugador 2', gender: 'female' }
  ]);
  const [numBots, setNumBots] = useState(0);
  
  const historyRef = useRef(makeHistory<GameState>());
  const watchdogRef = useRef(makeWatchdog(5000));

  // Bot Timer Ref
  const botTimeoutRef = useRef<any>(null);

  const [loanAmount, setLoanAmount] = useState(500);
  const [loanTurns, setLoanTurns] = useState(10);
  const [poolName, setPoolName] = useState('Nuevo Pool');
  const [selectedLoansForPool, setSelectedLoansForPool] = useState<string[]>([]);
  const [optPropId, setOptPropId] = useState<number>(0);
  const [optStrike, setOptStrike] = useState(100);
  const [optPremium, setOptPremium] = useState(20);
  const [optBuyer, setOptBuyer] = useState<number>(0);
  const [rouletteBet, setRouletteBet] = useState(50);
  const [rouletteColor, setRouletteColor] = useState<'red'|'black'|'green'>('red');

  // Auction Timer Effect
  useEffect(() => {
      let interval: any = null;
      if (state.auction && state.auction.isOpen) {
          interval = setInterval(() => {
              dispatch({ type: 'TICK_AUCTION' });
          }, 1000);
      }
      return () => { if (interval) clearInterval(interval); };
  }, [state.auction?.isOpen]);

  // Sync humanConfigs when setupHumans changes
  useEffect(() => {
      setHumanConfigs(prev => {
          const next = [...prev];
          if (setupHumans > prev.length) {
              for(let i = prev.length; i < setupHumans; i++) {
                  next.push({ name: `Jugador ${i+1}`, gender: 'male' });
              }
          } else if (setupHumans < prev.length) {
              return next.slice(0, setupHumans);
          }
          return next;
      });
  }, [setupHumans]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key.toLowerCase() === 's') { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); alert('💾 Guardado'); }
    if (e.key.toLowerCase() === 'l') { const saved = localStorage.getItem(SAVE_KEY); if (saved) dispatch({type:'LOAD_GAME', payload: JSON.parse(saved)}); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (historyRef.current.canUndo()) {
            const prev = historyRef.current.undo();
            if (prev) dispatch({ type: 'RESTORE_STATE', payload: prev });
        }
    }
  };
  useEffect(() => { window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [state]);

  useEffect(() => {
      historyRef.current.snapshot(state);
  }, [state.turnCount, state.currentPlayerIndex]);

  // Dice Roll Logic with Animation
  const handleRollDice = () => {
      if (isRolling || state.rolled) return;
      setIsRolling(true);
      
      const interval = setInterval(() => {
          setDisplayDice([Math.ceil(Math.random()*6), Math.ceil(Math.random()*6)]);
      }, 80);

      setTimeout(() => {
          clearInterval(interval);
          const finalDice: [number, number] = [Math.ceil(Math.random()*6), Math.ceil(Math.random()*6)];
          setDisplayDice(finalDice);
          setIsRolling(false);
          dispatch({ type: 'ROLL_DICE', payload: { dice: finalDice } });
      }, 800);
  };

  // Sync display dice with state when state updates from other sources (bots)
  useEffect(() => {
      if(!isRolling) {
          setDisplayDice(state.dice);
      }
  }, [state.dice, isRolling]);

  // --- BOT AI LOGIC (Separate Effect for Auction) ---
  useEffect(() => {
      if (state.auction && state.auction.isOpen) {
          const auction = state.auction;
          // IMPORTANT: Check primitive values or stable refs to avoid timer reset loop
          
          const activeBots = state.players.filter(p => p.isBot && auction.activePlayers.includes(p.id));
          
          // Only think if there are bots that can bid
          if (activeBots.length > 0) {
              const delay = 1000 + Math.random() * 2000;
              const timer = setTimeout(() => {
                  if (!state.auction?.isOpen) return;
                  
                  // Re-evaluate with fresh state inside timeout
                  const currentAuc = state.auction;
                  const currentBots = state.players.filter(p => p.isBot && currentAuc.activePlayers.includes(p.id));
                  
                  const candidate = currentBots.find(bot => {
                      if (currentAuc.highestBidder === bot.id) return false; 
                      if (bot.money < currentAuc.currentBid + 10) return false; 
                      
                      const tile = state.tiles[currentAuc.tileId];
                      let val = (tile.price || 0);
                      const group = state.tiles.filter(t => t.color === tile.color);
                      const myCount = group.filter(t => t.owner === bot.id).length;
                      if (myCount > 0) val *= 1.5; 
                      if (myCount === group.length - 1) val *= 2.5; 
                      
                      if (currentAuc.currentBid > val || bot.money < currentAuc.currentBid + 50) return false;
                      return true;
                  });

                  if (candidate) {
                      dispatch({ type: 'BID_AUCTION', payload: { amount: currentAuc.currentBid + 10, pId: candidate.id } });
                  }
              }, delay);
              return () => clearTimeout(timer);
          }
      }
  }, [state.auction?.currentBid, state.auction?.highestBidder, state.auction?.isOpen]); 
  // Dependency array MUST NOT include 'state' or 'state.auction' object, only primitives that change when a bid happens.

  // --- MAIN BOT LOGIC (Turn & Trade) ---
  useEffect(() => {
      if (!state.gameStarted) return;
      if (state.activeEvent) return; 

      // 1. INCOMING TRADE HANDLING
      if (state.trade && state.trade.isOpen && state.players[state.trade.targetId].isBot) {
          const bot = state.players[state.trade.targetId];
          const timer = setTimeout(() => {
              const accept = evaluateTradeByBot(state, bot, state.trade!);
              if (accept) dispatch({ type: 'ACCEPT_TRADE' });
              else dispatch({ type: 'REJECT_TRADE' });
          }, 2000);
          return () => clearTimeout(timer);
      }

      // 2. TURN AI (Robust Promise Chain)
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (currentPlayer && currentPlayer.isBot && !state.auction && !state.trade) {
          
          const botTurn = async () => {
              const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

              // A. Pre-Roll / Jail
              if (!state.rolled) {
                  await wait(1000);
                  if (currentPlayer.jail > 0) {
                      if (currentPlayer.money > 500) dispatch({ type: 'PAY_JAIL' });
                      else dispatch({ type: 'ROLL_DICE' });
                  } else {
                      dispatch({ type: 'ROLL_DICE' });
                  }
                  return; // State update triggers re-effect
              }

              await wait(1500); // Wait for roll animation/move

              // B. Action Phase
              const tile = state.tiles[currentPlayer.pos];
              
              // B1. Buy / Auction
              if (tile.type === TileType.PROP && tile.owner === null) {
                  if (state.gov === 'left') {
                      // Do nothing
                  } else if (state.gov === 'authoritarian') {
                      if (currentPlayer.money > (tile.price || 0) + 100) dispatch({ type: 'BUY_PROP' });
                  } else {
                      dispatch({ type: 'START_AUCTION', payload: tile.id });
                      return; // Auction triggers re-effect
                  }
              }

              // B2. Pay Rent (Handled)
              if (tile.type === TileType.PROP && tile.owner !== null && tile.owner !== currentPlayer.id && tile.owner !== 'E') {
                  dispatch({ type: 'PAY_RENT' });
                  await wait(1000);
              }

              // B3. Trading (Intelligent)
              const tradeProposal = getBotTradeProposal(state, currentPlayer);
              if (tradeProposal) {
                  dispatch({ type: 'PROPOSE_TRADE', payload: tradeProposal });
                  return; // Wait for player response
              }

              // B4. Build / Mortgage (Asset Management)
              // If broke, mortgage. If rich, build.
              if (currentPlayer.money < 0) {
                  // Logic to mortgage (simplified for now: AI generally doesn't go negative without losing, but good for robust play)
              } else {
                  const colors = [...new Set(state.tiles.filter(t => t.color).map(t => t.color))];
                  for (const c of colors) {
                      const group = state.tiles.filter(t => t.color === c);
                      if (group.every(t => t.owner === currentPlayer.id) && currentPlayer.money > 300) {
                          const lowest = group.reduce((prev, curr) => (curr.houses||0) < (prev.houses||0) ? curr : prev);
                          if ((lowest.houses || 0) < 5) {
                              dispatch({ type: 'BUILD_HOUSE', payload: { tId: lowest.id } });
                              await wait(500); // Visual delay for build
                              break; // Build one at a time
                          }
                      }
                  }
              }

              // B5. End Turn (Safety Valve)
              await wait(500);
              dispatch({ type: 'END_TURN' });
          };

          botTurn();
      }

  }, [state.currentPlayerIndex, state.rolled, state.turnCount, state.gameStarted, state.trade]);

  const startGame = () => {
    const newPlayers: Player[] = [];
    let idCounter = 0;
    
    // Create Humans from Config
    humanConfigs.forEach((cfg, idx) => {
        newPlayers.push({
            id: idCounter++,
            name: cfg.name,
            money: INITIAL_MONEY,
            pos: 0,
            alive: true,
            jail: 0,
            color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
            isBot: false,
            gender: cfg.gender as any,
            props: [],
            taxBase: 0,
            vatIn: 0,
            vatOut: 0,
            doubleStreak: 0,
            insiderTokens: 0
        });
    });

    const botGenders: ('male'|'female'|'helicoptero'|'marcianito')[] = ['male', 'female', 'helicoptero', 'marcianito'];

    for (let i = 0; i < numBots; i++) { 
        newPlayers.push({ 
            id: idCounter++, 
            name: `Bot ${i + 1}`, 
            money: INITIAL_MONEY, 
            pos: 0, 
            alive: true, 
            jail: 0, 
            color: PLAYER_COLORS[(humanConfigs.length + i) % PLAYER_COLORS.length], 
            isBot: true, 
            gender: botGenders[Math.floor(Math.random() * botGenders.length)], 
            props: [], 
            taxBase: 0, 
            vatIn: 0, 
            vatOut: 0, 
            doubleStreak: 0, 
            insiderTokens: 0 
        }); 
    }
    
    dispatch({ type: 'START_GAME', payload: assignRoles(newPlayers) });
    setSetupOpen(false);
  };

  const currentPlayer = state.players[state.currentPlayerIndex];
  const currentTile = currentPlayer ? state.tiles[currentPlayer.pos] : null;
  const isOwnerlessProp = currentTile && currentTile.type === TileType.PROP && currentTile.owner === null;
  const mustPayRent = currentTile && currentTile.type === TileType.PROP && currentTile.owner !== null && currentPlayer && currentTile.owner !== currentPlayer.id && currentTile.owner !== 'E';

  const canBuyDirect = isOwnerlessProp && currentPlayer && currentPlayer.money >= (currentTile.price || 0) && state.gov === 'authoritarian';
  const canAuction = isOwnerlessProp && ['right', 'libertarian', 'anarchy'].includes(state.gov);
  const isBlockedByGov = isOwnerlessProp && state.gov === 'left';

  return (
    <div className="flex w-screen h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-slate-800">
        <div className="absolute inset-0 flex items-center justify-center p-2 md:p-8">
            <Board state={state} onTileClick={(id) => dispatch({type: 'SELECT_TILE', payload: id})} focusId={currentPlayer?.pos} />
        </div>
        <DebugPanel state={state} dispatch={dispatch} />
      </div>

      <div className="w-80 md:w-96 bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl z-20 h-full">
        <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
            <div>
                <h1 className="text-xl font-black text-white tracking-wider">Artiako Landak</h1>
                <div className="flex flex-col gap-1 text-xs font-mono text-gray-400 mt-1">
                    <div className="flex gap-2"><span>Turno: {state.turnCount}</span><span className="uppercase text-yellow-500">Gov: {state.gov}</span></div>
                    <div className="text-emerald-400 font-bold">Estado: ${state.estadoMoney}</div>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => { if(historyRef.current.canUndo()) dispatch({type: 'RESTORE_STATE', payload: historyRef.current.undo()}) }} className="text-xs bg-slate-700 px-2 py-1 rounded hover:bg-slate-600 disabled:opacity-50">↩ Undo</button>
                <button onClick={() => setSetupOpen(true)} className="text-xs bg-slate-700 px-2 py-1 rounded hover:bg-slate-600">Reset</button>
            </div>
        </div>

        <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex flex-col gap-3">
            {currentPlayer ? (
                <>
                    <div className="flex justify-between items-center">
                         <div className="font-bold text-lg flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border border-white" style={{backgroundColor: currentPlayer.color}}></span>
                            <span className="truncate">{currentPlayer.name}</span>
                            {currentPlayer.role && <span className="text-[9px] bg-slate-600 px-1.5 py-0.5 rounded text-gray-300 uppercase tracking-wide border border-slate-500">{currentPlayer.role}</span>}
                         </div>
                         <div className="font-mono text-green-400 text-xl font-bold">${currentPlayer.money}</div>
                    </div>
                    
                    {currentPlayer.jail > 0 && <div className="bg-red-900/30 border border-red-500/50 p-2 rounded text-center text-xs text-red-300">⛓️ CÁRCEL: {currentPlayer.jail} turnos</div>}
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div className={`bg-slate-900 rounded p-2 text-center border border-slate-600 ${isRolling ? 'animate-pulse border-yellow-500' : ''}`}><span className="block text-[9px] text-gray-500">DADO 1</span><span className="text-xl font-bold">{displayDice[0]}</span></div>
                        <div className={`bg-slate-900 rounded p-2 text-center border border-slate-600 ${isRolling ? 'animate-pulse border-yellow-500' : ''}`}><span className="block text-[9px] text-gray-500">DADO 2</span><span className="text-xl font-bold">{displayDice[1]}</span></div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                        {!state.rolled && !isRolling ? (
                             <>
                                {currentPlayer.jail > 0 && currentPlayer.money >= 50 && (
                                    <button onClick={() => dispatch({type: 'PAY_JAIL'})} className="col-span-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 rounded border-b-4 border-yellow-800">Pagar Fianza ($50)</button>
                                )}
                                <button onClick={handleRollDice} disabled={isRolling} className="col-span-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 text-white font-bold py-3 px-4 rounded shadow-lg active:scale-95 border-b-4 border-green-800 transition-all disabled:opacity-50">
                                    {isRolling ? 'TIRANDO...' : 'TIRAR DADOS'}
                                </button>
                             </>
                        ) : (
                             <>
                                {isRolling ? (
                                    <div className="col-span-2 text-center text-yellow-400 font-bold py-3 animate-bounce">🎲 RODANDO...</div>
                                ) : (
                                    <>
                                        {canBuyDirect && <button onClick={() => dispatch({type: 'BUY_PROP'})} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded border-b-4 border-blue-800 text-xs">Comprar (${currentTile?.price})</button>}
                                        {canAuction && <button onClick={() => dispatch({type: 'START_AUCTION', payload: currentTile?.id})} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded border-b-4 border-purple-800 text-xs">Subastar</button>}
                                        {isBlockedByGov && <div className="col-span-2 bg-red-900/50 border border-red-700 p-1 text-center text-xs text-red-300 font-bold rounded">🚫 Compra bloqueada por el Gobierno</div>}
                                        
                                        {mustPayRent && <button onClick={() => dispatch({type: 'PAY_RENT'})} className="col-span-2 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded border-b-4 border-red-800">Pagar Renta</button>}
                                        <button onClick={() => dispatch({type: 'END_TURN'})} className="col-span-2 bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 rounded border-b-4 border-slate-800">Terminar Turno</button>
                                    </>
                                )}
                             </>
                        )}
                        <button onClick={() => dispatch({type: 'PROPOSE_TRADE'})} className="bg-indigo-700 hover:bg-indigo-600 text-[10px] py-1 rounded text-gray-200">Comercio</button>
                        <button onClick={() => dispatch({type: 'TOGGLE_BANK_MODAL'})} className="bg-red-800 hover:bg-red-700 text-[10px] py-1 rounded text-gray-200">Banca</button>
                        <button onClick={() => dispatch({type: 'TOGGLE_BALANCE_MODAL'})} className="bg-emerald-700 hover:bg-emerald-600 text-[10px] py-1 rounded text-white">Mi Balance</button>
                        <button onClick={() => dispatch({type: 'TOGGLE_HEATMAP'})} className={`text-[10px] py-1 rounded text-white ${state.showHeatmap ? 'bg-orange-600' : 'bg-slate-700'}`}>Heatmap</button>
                    </div>
                </>
            ) : (<div className="text-center text-gray-500 py-8 italic">Configurando...</div>)}
        </div>
        
        {/* Player List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-900 custom-scrollbar">
            {state.players.map(p => (
                <div key={p.id} className={`flex items-center justify-between p-2 rounded border transition-all ${p.id === state.currentPlayerIndex ? 'border-yellow-500 bg-slate-800' : 'border-slate-700 bg-slate-800/40 opacity-70'}`}>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: p.color}}></div>
                        <div className="text-xs">
                            <span className="font-bold block">{p.name} {p.jail > 0 && '⛓️'}</span>
                            <span className="text-[10px] text-gray-400">{state.tiles[p.pos]?.name}</span>
                        </div>
                    </div>
                    <div className="font-mono font-bold text-green-500 text-xs">${p.money}</div>
                </div>
            ))}
        </div>

        {/* Logs */}
        <div className="h-32 bg-black/80 p-2 font-mono text-[10px] overflow-y-auto border-t border-slate-700 text-gray-400 custom-scrollbar">
            {state.logs.map((l, i) => <div key={i} className="mb-1 border-b border-gray-900 pb-1 last:border-0 hover:bg-white/5">{l}</div>)}
        </div>
      </div>

      {state.showTradeModal && state.trade && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-800 p-6 rounded-xl border border-indigo-500 shadow-2xl max-w-lg w-full">
                  <h2 className="text-2xl font-black text-indigo-400 mb-4 flex items-center gap-2">🤝 PROPUESA DE CAMBIO</h2>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-900 p-3 rounded border border-slate-700">
                          <div className="text-xs text-gray-500 uppercase font-bold mb-2">{state.players.find(p => p.id === state.trade!.initiatorId)?.name} OFRECE:</div>
                          <div className="text-green-400 font-bold mb-1">${state.trade.offeredMoney}</div>
                          <div className="space-y-1">
                              {state.trade.offeredProps.map(pid => (
                                  <div key={pid} className="text-xs text-white bg-slate-800 px-1 rounded border border-slate-600">{state.tiles[pid].name}</div>
                              ))}
                          </div>
                      </div>
                      <div className="bg-slate-900 p-3 rounded border border-slate-700">
                          <div className="text-xs text-gray-500 uppercase font-bold mb-2">{state.players.find(p => p.id === state.trade!.targetId)?.name} RECIBE:</div>
                          <div className="text-green-400 font-bold mb-1">${state.trade.requestedMoney}</div>
                          <div className="space-y-1">
                              {state.trade.requestedProps.map(pid => (
                                  <div key={pid} className="text-xs text-white bg-slate-800 px-1 rounded border border-slate-600">{state.tiles[pid].name}</div>
                              ))}
                          </div>
                      </div>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => dispatch({type: 'REJECT_TRADE'})} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded">RECHAZAR</button>
                      <button onClick={() => dispatch({type: 'ACCEPT_TRADE'})} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded">ACEPTAR</button>
                  </div>
              </div>
          </div>
      )}

      {state.showBankModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-800 p-6 rounded-xl border border-red-500/50 shadow-2xl max-w-lg w-full h-[90vh] flex flex-col">
                  <h2 className="text-2xl font-black text-red-500 mb-4 border-b border-red-900 pb-2">🏛️ BANCA & TITULIZACIÓN</h2>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                      <div className="bg-slate-900 p-4 rounded border border-slate-700">
                          <h3 className="font-bold mb-2 text-white">Pedir Préstamo Personal</h3>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                              <label className="text-gray-400">Cantidad: ${loanAmount}</label>
                              <input type="range" min="100" max="2000" step="100" value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))} className="accent-red-500"/>
                              <div className="col-span-2 flex justify-between"><span>Plazo: {loanTurns} turnos</span><span>Interés: 20%</span></div>
                              <button onClick={() => dispatch({type: 'TAKE_LOAN', payload: { amount: loanAmount, interest: 20, turns: loanTurns }})} className="col-span-2 bg-red-600 hover:bg-red-500 py-2 rounded text-white font-bold">Solicitar Fondos</button>
                          </div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-blue-700">
                          <h3 className="font-bold mb-2 text-blue-400">Crear Pool de Deuda</h3>
                          <input type="text" value={poolName} onChange={e => setPoolName(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded p-1 mb-2 text-xs text-white" placeholder="Nombre del Pool" />
                          <div className="h-32 overflow-y-auto border border-slate-700 p-1 mb-2 bg-black/20">
                              {state.loans.filter(l => !l.poolId && l.status === 'active').length === 0 && <div className="text-gray-500 text-xs p-2">No hay préstamos activos.</div>}
                              {state.loans.filter(l => !l.poolId && l.status === 'active').map(l => (
                                  <div key={l.id} className="flex items-center gap-2 text-xs p-1 hover:bg-slate-800">
                                      <input type="checkbox" checked={selectedLoansForPool.includes(l.id)} onChange={(e) => { if(e.target.checked) setSelectedLoansForPool([...selectedLoansForPool, l.id]); else setSelectedLoansForPool(selectedLoansForPool.filter(id => id !== l.id)); }} />
                                      <span className="font-mono text-yellow-500">${l.principal}</span>
                                      <span className="text-gray-400"> (Deudor: {state.players.find(p=>p.id===l.borrowerId)?.name})</span>
                                  </div>
                              ))}
                          </div>
                          <button onClick={() => { dispatch({type: 'CREATE_POOL', payload: { loanIds: selectedLoansForPool, name: poolName }}); setSelectedLoansForPool([]); }} className="w-full bg-blue-600 hover:bg-blue-500 py-1 rounded text-white text-xs font-bold" disabled={selectedLoansForPool.length === 0}>Crear Pool</button>
                      </div>
                      <div className="bg-slate-900 p-4 rounded border border-purple-700">
                          <h3 className="font-bold mb-2 text-purple-400">Opciones Financieras</h3>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                              <label className="text-gray-400">Propiedad (ID):</label><input type="number" value={optPropId} onChange={e => setOptPropId(Number(e.target.value))} className="bg-slate-800 border-slate-600 rounded text-white"/>
                              <label className="text-gray-400">Strike Price:</label><input type="number" value={optStrike} onChange={e => setOptStrike(Number(e.target.value))} className="bg-slate-800 border-slate-600 rounded text-white"/>
                              <label className="text-gray-400">Premium:</label><input type="number" value={optPremium} onChange={e => setOptPremium(Number(e.target.value))} className="bg-slate-800 border-slate-600 rounded text-white"/>
                              <label className="text-gray-400">Comprador (ID):</label><input type="number" value={optBuyer} onChange={e => setOptBuyer(Number(e.target.value))} className="bg-slate-800 border-slate-600 rounded text-white"/>
                              <button onClick={() => dispatch({type: 'CREATE_OPTION', payload: { type:'call', propId:optPropId, strike:optStrike, premium:optPremium, buyerId:optBuyer }})} className="bg-green-700 hover:bg-green-600 text-white rounded py-1">Vender CALL</button>
                              <button onClick={() => dispatch({type: 'CREATE_OPTION', payload: { type:'put', propId:optPropId, strike:optStrike, premium:optPremium, buyerId:optBuyer }})} className="bg-red-700 hover:bg-red-600 text-white rounded py-1">Vender PUT</button>
                          </div>
                      </div>
                  </div>
                  <button onClick={() => dispatch({type: 'CLOSE_BANK_MODAL'})} className="mt-4 bg-slate-700 hover:bg-slate-600 py-2 rounded text-white font-bold">Cerrar Banca</button>
              </div>
          </div>
      )}

      {state.auction && state.auction.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
              <div className="bg-slate-800 p-6 rounded-xl border-2 border-purple-500 shadow-[0_0_50px_rgba(168,85,247,0.3)] max-w-md w-full relative max-h-[90vh] overflow-y-auto">
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg">
                      {state.auction.kind === 'bundle' ? '📦 SUBASTA DE LOTE' : 'SUBASTA'}
                  </div>
                  {state.auction.kind === 'bundle' ? (
                      <div className="my-4 space-y-1 bg-slate-900 p-2 rounded border border-slate-700">
                          {state.auction.items?.map(tid => (<div key={tid} className="text-sm text-gray-300 flex justify-between"><span>{state.tiles[tid].name}</span><span className="text-green-500">${state.tiles[tid].price}</span></div>))}
                          <div className="text-xs text-center text-gray-500 pt-1 border-t border-slate-800">Valor Total: ${state.auction.items?.reduce((acc, id) => acc + (state.tiles[id].price||0), 0)}</div>
                      </div>
                  ) : (<h3 className="text-xl text-center text-white font-bold mt-4 mb-2">{state.tiles[state.auction.tileId].name}</h3>)}
                  
                  <div className="text-center text-4xl font-black text-green-400 mb-2">{formatMoney(state.auction.currentBid)}</div>
                  
                  {/* Timer Visual */}
                  <div className="mb-4 w-full bg-gray-700 rounded-full h-4 overflow-hidden relative border border-gray-600">
                      <div className={`h-full transition-all duration-1000 ease-linear ${state.auction.timer < 5 ? 'bg-red-600 animate-pulse' : 'bg-yellow-500'}`} style={{ width: `${(state.auction.timer / 20) * 100}%` }}></div>
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md z-10">{state.auction.timer}s</div>
                  </div>

                  <div className="text-center text-xs text-gray-400 mb-4">Puja más alta: {state.auction.highestBidder !== null ? state.players.find(p => p.id === state.auction.highestBidder)?.name : 'Nadie'}</div>

                  <div className="space-y-3 mb-4">
                      {state.players.filter(p => !p.isBot && state.auction!.activePlayers.includes(p.id)).length === 0 && (
                          <div className="text-center text-gray-500 italic text-sm">No quedan humanos en la puja.</div>
                      )}
                      
                      {state.players.filter(p => !p.isBot && state.auction!.activePlayers.includes(p.id)).map(human => (
                          <div key={human.id} className="bg-slate-700/50 p-3 rounded border border-slate-600 flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                  <span className="font-bold text-sm text-white">{human.name}</span>
                                  <span className="font-mono text-green-400 text-xs">${human.money}</span>
                              </div>
                              <div className="grid grid-cols-4 gap-1">
                                  <button onClick={() => dispatch({type: 'BID_AUCTION', payload: {amount: state.auction!.currentBid + 10, pId: human.id}})} disabled={human.money < state.auction!.currentBid + 10} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold py-2 rounded disabled:opacity-50">+10</button>
                                  <button onClick={() => dispatch({type: 'BID_AUCTION', payload: {amount: state.auction!.currentBid + 50, pId: human.id}})} disabled={human.money < state.auction!.currentBid + 50} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold py-2 rounded disabled:opacity-50">+50</button>
                                  <button onClick={() => dispatch({type: 'BID_AUCTION', payload: {amount: state.auction!.currentBid + 100, pId: human.id}})} disabled={human.money < state.auction!.currentBid + 100} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold py-2 rounded disabled:opacity-50">+100</button>
                                  <button onClick={() => dispatch({type: 'WITHDRAW_AUCTION', payload: {pId: human.id}})} className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold py-2 rounded">Pasar</button>
                              </div>
                          </div>
                      ))}
                  </div>

                  <button onClick={() => dispatch({type: 'END_AUCTION'})} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg shadow-lg border-b-4 border-green-800 active:scale-95 transition-all">
                      ADJUDICAR / CERRAR
                  </button>
              </div>
          </div>
      )}

      {state.showCasinoModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
              <div className="bg-gray-900 p-8 rounded-2xl border-4 border-yellow-500 shadow-2xl max-w-lg w-full text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-felt.png')] opacity-20"></div>
                  <h2 className="text-4xl font-black text-yellow-400 mb-6 drop-shadow-md relative z-10">🎰 CASINO</h2>
                  {state.casinoGame === 'blackjack' && (
                      <div className="relative z-10">
                          <p className="text-white mb-4">Juegas contra el Dealer (Dueño).</p>
                          <button onClick={() => dispatch({type: 'PLAY_CASINO', payload: { game: 'blackjack' }})} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full text-xl shadow-lg transform transition hover:scale-105">JUGAR</button>
                      </div>
                  )}
                  {state.casinoGame === 'roulette' && (
                      <div className="relative z-10">
                          <p className="text-white mb-4">Apuesta a Color</p>
                          <div className="flex justify-center gap-2 mb-4">
                              <button onClick={() => setRouletteColor('red')} className={`w-12 h-12 rounded-full bg-red-600 border-4 ${rouletteColor==='red'?'border-white':'border-transparent'}`}></button>
                              <button onClick={() => setRouletteColor('black')} className={`w-12 h-12 rounded-full bg-black border-4 ${rouletteColor==='black'?'border-white':'border-transparent'}`}></button>
                              <button onClick={() => setRouletteColor('green')} className={`w-12 h-12 rounded-full bg-green-600 border-4 ${rouletteColor==='green'?'border-white':'border-transparent'}`}></button>
                          </div>
                          <div className="flex items-center justify-center gap-2 mb-6"><label className="text-white">Apuesta:</label><input type="number" value={rouletteBet} onChange={(e) => setRouletteBet(Number(e.target.value))} className="w-20 bg-gray-800 text-white border border-gray-600 rounded p-1 text-center" /></div>
                          <button onClick={() => dispatch({type: 'PLAY_CASINO', payload: { game: 'roulette', bet: { betAmount: rouletteBet, color: rouletteColor } }})} className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 px-8 rounded-full text-xl shadow-lg transform transition hover:scale-105">GIRAR</button>
                      </div>
                  )}
                  {state.casinoGame === null && (
                      <div className="relative z-10"><p className="text-xl text-white mb-4 font-bold">TRAGAPERRAS</p><button onClick={() => { alert("¡Premio gordo! (Mentira)"); dispatch({type: 'CLOSE_CASINO'}); }} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-8 rounded-full text-xl">TIRAR</button></div>
                  )}
                  <button onClick={() => dispatch({type: 'CLOSE_CASINO'})} className="mt-6 text-gray-500 hover:text-white underline text-sm relative z-10">Salir del Casino</button>
              </div>
          </div>
      )}

      {state.selectedTileId !== null && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => dispatch({type: 'CLOSE_MODAL'})}>
              <div className="bg-slate-900 text-white w-full max-w-sm rounded-xl overflow-hidden shadow-2xl border border-slate-700 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                  {(() => {
                      const t = state.tiles[state.selectedTileId];
                      const headerColor = t.color ? COLORS[t.color as keyof typeof COLORS] : '#334155';
                      const isOwner = t.owner === state.players[state.currentPlayerIndex]?.id;
                      const houseCost = getHouseCost(t);
                      return (
                          <>
                            <div className="h-32 flex flex-col items-center justify-center text-white p-4 shadow-inner relative overflow-hidden" style={{backgroundColor: headerColor}}>
                                <div className="absolute inset-0 bg-black/10"></div>
                                <h3 className="text-3xl font-black uppercase text-center drop-shadow-md z-10 relative">{t.name}</h3>
                                {t.type === TileType.PROP && <div className="text-xs uppercase tracking-widest opacity-80 mt-1 z-10 relative font-bold">{t.familia || t.color || 'Propiedad'}</div>}
                            </div>
                            <div className="p-6 space-y-4 bg-slate-900">
                                {t.type === TileType.PROP ? (
                                    <>
                                        <div className="flex justify-between border-b border-slate-700 pb-2"><span className="text-gray-400">Precio</span><span className="font-bold text-xl text-green-400">{formatMoney(t.price || 0)}</span></div>
                                        <div className="bg-slate-800 rounded-lg overflow-hidden text-xs"><table className="w-full"><thead className="bg-slate-700 text-gray-300"><tr><th className="p-2 text-left">Nivel</th><th className="p-2 text-right">Renta</th></tr></thead><tbody className="divide-y divide-slate-700/50">{getRentTable(t).map((row, idx) => ( <tr key={idx} className={row.label.includes(t.houses === 5 ? 'Hotel' : `${t.houses} Casa`) ? 'bg-yellow-900/30 text-yellow-200 font-bold' : 'text-gray-400'}><td className="p-2">{row.label}</td><td className="p-2 text-right font-mono">{typeof row.rent === 'number' ? formatMoney(row.rent) : row.rent}</td></tr> ))}</tbody></table></div>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {t.owner === null && canBuyDirect && <button onClick={() => {dispatch({type: 'BUY_PROP'}); dispatch({type: 'CLOSE_MODAL'})}} className="col-span-2 bg-green-600 hover:bg-green-500 py-2 rounded font-bold text-white shadow-lg">Comprar</button>}
                                            {t.owner === null && canAuction && <button onClick={() => {dispatch({type: 'START_AUCTION', payload: t.id}); dispatch({type: 'CLOSE_MODAL'})}} className="col-span-2 bg-purple-600 hover:bg-purple-500 py-2 rounded font-bold text-white shadow-lg">Subastar</button>}
                                            {t.owner === null && isBlockedByGov && <div className="col-span-2 bg-red-900/50 p-2 text-center text-xs text-red-300 rounded font-bold border border-red-800">🚫 Gobierno de Izquierdas: Compra Prohibida</div>}
                                            
                                            {isOwner && !t.mortgaged && (t.houses || 0) < 5 && ( <button onClick={() => dispatch({type: 'BUILD_HOUSE', payload: {tId: t.id}})} className="col-span-2 bg-blue-600 hover:bg-blue-500 py-2 rounded font-bold text-white shadow-lg">Construir ({formatMoney(houseCost)})</button> )}
                                        </div>
                                    </>
                                ) : ( <div className="py-4 text-center"><div className="text-gray-500 italic mb-4">Casilla Especial<br/><span className="text-white font-bold not-italic mt-2 block">{t.type.toUpperCase()}</span></div><div className="bg-slate-800 p-4 rounded text-yellow-500 font-medium border border-slate-700 shadow-inner">"{FUNNY[t.type] || FUNNY.default}"</div></div> )}
                                <button onClick={() => dispatch({type: 'CLOSE_MODAL'})} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg font-bold border border-slate-600">Cerrar</button>
                            </div>
                          </>
                      );
                  })()}
              </div>
          </div>
      )}

      {setupOpen && ( 
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md w-full h-full p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-600 max-w-sm w-full relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500"></div>
                  <h2 className="text-3xl font-black mb-6 text-white text-center">Configuración</h2>
                  <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
                      <div>
                          <div className="flex justify-between mb-2">
                              <label className="text-sm font-bold text-gray-300">Nº Humanos</label>
                              <span className="text-sm font-mono text-green-400">{setupHumans}</span>
                          </div>
                          <input type="range" min="1" max="8" step="1" value={setupHumans} onChange={e => setSetupHumans(parseInt(e.target.value))} className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-green-500" />
                      </div>

                      <div className="space-y-3">
                          {humanConfigs.map((cfg, idx) => (
                              <div key={idx} className="bg-slate-900 p-3 rounded border border-slate-700">
                                  <div className="text-xs text-gray-500 mb-1 uppercase font-bold">Jugador {idx + 1}</div>
                                  <input 
                                      type="text" 
                                      value={cfg.name} 
                                      onChange={(e) => {
                                          const newCfgs = [...humanConfigs];
                                          newCfgs[idx].name = e.target.value;
                                          setHumanConfigs(newCfgs);
                                      }}
                                      className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-sm text-white mb-2"
                                      placeholder="Nombre"
                                  />
                                  <select 
                                      value={cfg.gender}
                                      onChange={(e) => {
                                          const newCfgs = [...humanConfigs];
                                          newCfgs[idx].gender = e.target.value as any;
                                          setHumanConfigs(newCfgs);
                                      }}
                                      className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white"
                                  >
                                      <option value="male">Masculino</option>
                                      <option value="female">Femenino</option>
                                      <option value="helicoptero">Helicóptero de Combate</option>
                                      <option value="marcianito">Marcianito 100% real no fake</option>
                                  </select>
                              </div>
                          ))}
                      </div>

                      <div className="border-t border-slate-700 pt-4">
                          <div className="flex justify-between mb-2">
                              <label className="text-sm font-bold text-gray-300">Nº Bots</label>
                              <span className="text-sm font-mono text-blue-400">{numBots}</span>
                          </div>
                          <input type="range" min="0" max="8" step="1" value={numBots} onChange={e => setNumBots(parseInt(e.target.value))} className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                      </div>
                      <button onClick={startGame} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 text-white font-bold py-4 rounded-xl shadow-lg mt-4 transform hover:scale-105 transition-all">EMPEZAR</button>
                  </div>
              </div>
          </div> 
      )}
      
      {state.activeEvent && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95"><div className="bg-slate-100 text-slate-900 p-8 rounded-xl shadow-2xl max-w-sm w-full text-center border-4 border-slate-300 relative overflow-hidden"><div className="absolute top-0 left-0 w-full h-4 bg-purple-600"></div><h3 className="text-2xl font-black mb-2 uppercase tracking-wide text-purple-700">{state.activeEvent.title}</h3><p className="text-gray-700 text-lg mb-6 leading-relaxed font-medium">{state.activeEvent.description}</p><button onClick={() => dispatch({type: 'CLOSE_EVENT'})} className="bg-slate-900 text-white px-6 py-3 rounded-lg font-bold hover:bg-slate-800 transition w-full">Entendido</button></div></div>)}
    </div>
  );
};

export default App;
