
import React, { useReducer, useState, useEffect, useCallback } from 'react';
import { GameState, TileType, TradeOffer } from './types';
import { createInitialState, gameReducer, getHouseCost, formatMoney, getRentTable, getTransportDestinations } from './utils/gameLogic';
import { Board } from './components/Board';
import { DebugPanel } from './components/DebugPanel';
import { COLORS, FUNNY, PLAYER_EMOJIS } from './constants';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  
  // UI State
  const [setupOpen, setSetupOpen] = useState(true);
  const [setupHumans, setSetupHumans] = useState(2);
  const [humanConfigs, setHumanConfigs] = useState<{name:string, gender:string}[]>([
      {name: 'Jugador 1', gender: 'male'},
      {name: 'Jugador 2', gender: 'female'},
      {name: 'Jugador 3', gender: 'male'},
      {name: 'Jugador 4', gender: 'female'},
      {name: 'Jugador 5', gender: 'male'},
      {name: 'Jugador 6', gender: 'female'},
      {name: 'Jugador 7', gender: 'male'},
      {name: 'Jugador 8', gender: 'female'},
  ]);
  const [numBots, setNumBots] = useState(2);
  const [isRolling, setIsRolling] = useState(false);
  
  // Trade UI State
  const [tradeTargetId, setTradeTargetId] = useState<number|null>(null);
  const [tradeOfferMoney, setTradeOfferMoney] = useState(0);
  const [tradeReqMoney, setTradeReqMoney] = useState(0);
  const [tradeOfferProps, setTradeOfferProps] = useState<number[]>([]);
  const [tradeReqProps, setTradeReqProps] = useState<number[]>([]);
  
  // Bank/Loan/Pool UI State
  const [loanAmount, setLoanAmount] = useState(500);
  const [loanTurns, setLoanTurns] = useState(10);
  const [poolName, setPoolName] = useState('');
  const [selectedLoansForPool, setSelectedLoansForPool] = useState<string[]>([]);
  
  // Options UI State
  const [optPropId, setOptPropId] = useState(0);
  const [optStrike, setOptStrike] = useState(0);
  const [optPremium, setOptPremium] = useState(0);
  const [optBuyer, setOptBuyer] = useState(0);

  // Casino UI State
  const [rouletteBet, setRouletteBet] = useState(0);
  const [rouletteColor, setRouletteColor] = useState<'red'|'black'|'green'>('black');

  // Computed Values
  const currentPlayer = state.players[state.currentPlayerIndex] || ({} as any);
  const currentTile = state.tiles[currentPlayer.pos || 0];
  const isTransport = ['rail', 'bus', 'ferry', 'air'].includes(currentTile?.subtype || '');
  const availableTransports = getTransportDestinations(state, currentPlayer.pos || 0);
  const canBuyDirect = currentTile?.type === TileType.PROP && currentTile.owner === null;
  const canAuction = currentTile?.type === TileType.PROP && currentTile.owner === null;
  const isBlockedByGov = state.gov === 'left' && canBuyDirect; 
  const mustPayRent = currentTile?.type === TileType.PROP && currentTile.owner !== null && currentTile.owner !== currentPlayer.id && !currentTile.mortgaged && currentTile.owner !== 'E';

  // BOT INTELLIGENCE ENGINE
  useEffect(() => {
      if (!state.gameStarted) return;
      if (!currentPlayer.isBot) return;

      let timer: any;
      // Step 1: ROLL DICE
      if (!state.rolled) {
          timer = setTimeout(() => {
              if (currentPlayer.jail > 0 && currentPlayer.money > 200) {
                  dispatch({type: 'PAY_JAIL'});
              } else {
                  dispatch({type: 'ROLL_DICE'});
              }
          }, 1500);
      } 
      // Step 2: ACT & END TURN
      else {
          timer = setTimeout(() => {
              dispatch({type: 'BOT_RESOLVE_TURN'});
              setTimeout(() => {
                  dispatch({type: 'END_TURN'});
              }, 1000);
          }, 1500);
      }
      return () => clearTimeout(timer);
  }, [state.gameStarted, state.currentPlayerIndex, state.rolled, currentPlayer.isBot, currentPlayer.jail, currentPlayer.money]);

  const handleRollDice = async () => {
    setIsRolling(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    dispatch({ type: 'ROLL_DICE' });
    setIsRolling(false);
  };

  const startGame = () => {
    dispatch({
        type: 'START_GAME',
        payload: {
            humans: humanConfigs.slice(0, setupHumans),
            bots: numBots
        }
    });
    setSetupOpen(false);
  };

  return (
    <div className="flex w-screen h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      
      {/* LEFT: BOARD */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-slate-800 min-w-0">
        <Board state={state} onTileClick={(id) => dispatch({type: 'SELECT_TILE', payload: id})} focusId={currentPlayer.pos} />
        <DebugPanel state={state} dispatch={dispatch} />
      </div>
      
      {/* RIGHT: SIDEBAR */}
      <div className="w-80 md:w-96 bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl z-20 flex-shrink-0">
        
        {/* Sidebar Header / Controls */}
        <div className="p-4 bg-slate-800 border-b border-slate-700 shadow-md z-10">
            {state.gameStarted ? (
                <>
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-xl font-black text-yellow-500 tracking-wider">TURN {state.turnCount}</div>
                        <div className="flex flex-col items-end">
                            <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border mb-1 ${state.gov==='left'?'border-red-500 text-red-400':state.gov==='right'?'border-blue-500 text-blue-400':'border-gray-500 text-gray-400'}`}>Gob: {state.gov} ({state.govTurnsLeft})</div>
                            <div className="text-[10px] text-gray-400 font-mono">Reservas: <span className={`${state.estadoMoney < 0 ? 'text-red-500' : 'text-green-400'}`}>{formatMoney(state.estadoMoney)}</span></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        {!state.rolled && !isRolling ? (
                             currentPlayer.isBot ? (
                                 <div className="col-span-2 text-center text-yellow-400 font-mono py-3 animate-pulse border border-yellow-500/30 rounded bg-yellow-900/10">🎲 {currentPlayer.name} va a tirar...</div>
                             ) : (
                                 <>
                                    {currentPlayer.jail > 0 && currentPlayer.money >= 50 && (
                                        <button onClick={() => dispatch({type: 'PAY_JAIL'})} className="col-span-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 rounded border-b-4 border-yellow-800">Pagar Fianza ($50)</button>
                                    )}
                                    <button onClick={handleRollDice} disabled={isRolling} className="col-span-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 text-white font-bold py-3 px-4 rounded shadow-lg active:scale-95 border-b-4 border-green-800 transition-all disabled:opacity-50">
                                        {isRolling ? 'TIRANDO...' : 'TIRAR DADOS'}
                                    </button>
                                 </>
                             )
                        ) : (
                             <>
                                {isRolling ? (
                                    <div className="col-span-2 text-center text-yellow-400 font-bold py-3 animate-bounce">🎲 RODANDO...</div>
                                ) : (
                                    currentPlayer.isBot ? (
                                        <div className="col-span-2 text-center text-emerald-400 font-mono py-2 animate-pulse">
                                            🤖 {currentPlayer.name} está pensando...
                                        </div>
                                    ) : (
                                        <>
                                            {isTransport && !state.usedTransportHop && (
                                                <button onClick={() => {
                                                    const dest = availableTransports[Math.floor(Math.random() * availableTransports.length)];
                                                    if (dest) dispatch({type: 'TRAVEL_TRANSPORT', payload: { destId: dest }});
                                                }} className="col-span-2 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 rounded border-b-4 border-sky-800 text-xs flex items-center justify-center gap-1">🚇 Viajar en Transporte ($50)</button>
                                            )}

                                            {canBuyDirect && <button onClick={() => dispatch({type: 'BUY_PROP'})} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded border-b-4 border-blue-800 text-xs">Comprar (${currentTile?.price})</button>}
                                            {canAuction && <button onClick={() => dispatch({type: 'START_AUCTION', payload: currentTile?.id})} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded border-b-4 border-purple-800 text-xs">Subastar</button>}
                                            {isBlockedByGov && <div className="col-span-2 bg-red-900/50 border border-red-700 p-1 text-center text-xs text-red-300 font-bold rounded">🚫 Compra bloqueada por el Gobierno</div>}
                                            
                                            {mustPayRent && <button onClick={() => dispatch({type: 'PAY_RENT'})} className="col-span-2 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded border-b-4 border-red-800">Pagar Renta</button>}
                                            <button onClick={() => dispatch({type: 'END_TURN'})} className="col-span-2 bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 rounded border-b-4 border-slate-800">Terminar Turno</button>
                                        </>
                                    )
                                )}
                             </>
                        )}
                        <button onClick={() => { setTradeTargetId(null); setTradeOfferMoney(0); setTradeReqMoney(0); setTradeOfferProps([]); setTradeReqProps([]); dispatch({type: 'PROPOSE_TRADE'}); }} className="bg-indigo-700 hover:bg-indigo-600 text-[10px] py-1 rounded text-gray-200">Comercio</button>
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
            {state.logs.slice().reverse().map((l, i) => <div key={i} className="mb-1 border-b border-gray-900 pb-1 last:border-0 hover:bg-white/5">{l}</div>)}
        </div>
      </div>

      {state.showBalanceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => dispatch({type: 'TOGGLE_BALANCE_MODAL'})}>
              <div className="bg-slate-800 p-6 rounded-xl border border-emerald-500 shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <h2 className="text-2xl font-black text-emerald-400 mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                      💼 PORTFOLIO DE {state.players[state.currentPlayerIndex].name}
                  </h2>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {state.tiles.filter(t => t.owner === state.players[state.currentPlayerIndex].id).length === 0 && (
                          <div className="text-center text-gray-500 italic py-8">No tienes propiedades. ¡A comprar!</div>
                      )}
                      {state.tiles.filter(t => t.owner === state.players[state.currentPlayerIndex].id).map(t => {
                          const isMortgaged = t.mortgaged;
                          const unmortgageCost = Math.round((t.price || 0) * 0.55);
                          return (
                              <div key={t.id} className={`p-3 rounded border flex justify-between items-center ${isMortgaged ? 'bg-slate-900/50 border-red-900/50 opacity-70' : 'bg-slate-700/50 border-slate-600'}`}>
                                  <div className="flex items-center gap-3">
                                      <div className={`w-4 h-4 rounded-full border border-white/20`} style={{backgroundColor: t.color ? COLORS[t.color as keyof typeof COLORS] : '#666'}}></div>
                                      <div>
                                          <div className="font-bold text-sm text-white flex items-center gap-2">
                                              {t.name}
                                              {isMortgaged && <span className="text-[9px] bg-red-600 text-white px-1 rounded uppercase">Hipotecada</span>}
                                          </div>
                                          <div className="text-[10px] text-gray-400">
                                              {t.subtype === 'fiore' 
                                                ? `${t.workers||0} Trabajadores` 
                                                : t.hotel 
                                                    ? '1 Hotel' 
                                                    : `${t.houses||0} Casas`
                                              }
                                          </div>
                                      </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                      {isMortgaged ? (
                                          <button 
                                            onClick={() => dispatch({type: 'UNMORTGAGE_PROP', payload: { tId: t.id }})}
                                            disabled={state.players[state.currentPlayerIndex].money < unmortgageCost}
                                            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-[10px] font-bold py-1 px-2 rounded"
                                          >
                                              Deshipotecar (${unmortgageCost})
                                          </button>
                                      ) : (
                                          <button 
                                            onClick={() => dispatch({type: 'MORTGAGE_PROP', payload: { tId: t.id }})}
                                            className="bg-red-900/50 hover:bg-red-800 text-red-200 text-[10px] font-bold py-1 px-2 rounded border border-red-800"
                                          >
                                              Hipotecar (+${Math.round((t.price||0)*0.5)})
                                          </button>
                                      )}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
                  <button onClick={() => dispatch({type: 'TOGGLE_BALANCE_MODAL'})} className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded">Cerrar</button>
              </div>
          </div>
      )}

      {/* GREYHOUNDS MODAL */}
      {state.showGreyhounds && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
              <div className="bg-slate-800 w-full max-w-2xl p-6 rounded-xl border border-slate-600 shadow-2xl relative">
                  <h2 className="text-3xl font-black text-center text-white mb-6 uppercase tracking-widest">🏁 Carrera de Galgos 🏁</h2>
                  
                  <div className="space-y-4 mb-8 bg-black/30 p-4 rounded-lg">
                      {state.greyhounds.map(dog => (
                          <div key={dog.id} className="relative h-12 bg-slate-700 rounded-full overflow-hidden border border-slate-600">
                              <div className="absolute top-0 left-0 h-full transition-all duration-500 ease-linear" style={{ width: `${dog.progress}%`, backgroundColor: dog.color }}></div>
                              <div className="absolute top-0 left-0 h-full w-full flex items-center px-4 justify-end z-10">
                                  <span className="text-2xl drop-shadow-md">🐕</span>
                              </div>
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-white text-shadow-sm z-20">#{dog.id}</span>
                          </div>
                      ))}
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4">
                      {state.players.filter(p => !p.isBot).map(p => {
                          const hasBet = state.greyhoundBets[p.id];
                          return (
                              <div key={p.id} className="bg-slate-700 p-2 rounded text-center border border-slate-600">
                                  <div className="font-bold text-xs text-white mb-1">{p.name}</div>
                                  {!hasBet ? (
                                      <div className="grid grid-cols-2 gap-1">
                                          {[1,2,3,4].map(id => (
                                              <button key={id} onClick={() => dispatch({type: 'BET_GREYHOUND', payload: { pId: p.id, dogId: id, amount: 50 }})} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] py-1 rounded font-bold">#{id}</button>
                                          ))}
                                      </div>
                                  ) : (
                                      <div className="text-yellow-400 font-bold text-xs">Apostó al #{hasBet} ($50)</div>
                                  )}
                              </div>
                          );
                      })}
                  </div>
                  
                  <div className="text-center text-xs text-gray-400">Bote total: <span className="text-green-400 font-bold text-lg">${state.greyhoundPot}</span></div>
              </div>
          </div>
      )}

      {state.showTradeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-800 p-6 rounded-xl border border-indigo-500 shadow-2xl max-w-lg w-full h-[80vh] flex flex-col">
                  {state.trade ? (
                      // INCOMING OFFER VIEW
                      <>
                        <h2 className="text-2xl font-black text-indigo-400 mb-4 flex items-center gap-2">🤝 PROPUESA DE CAMBIO</h2>
                        <div className="grid grid-cols-2 gap-4 mb-6 flex-1 overflow-y-auto">
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
                      </>
                  ) : (
                      // CREATE OFFER VIEW
                      <>
                        <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2 pb-2 border-b border-indigo-500">📝 CREAR TRATO</h2>
                        
                        {tradeTargetId === null ? (
                            <div className="flex-1 flex flex-col gap-2">
                                <h3 className="text-gray-400 text-sm mb-2">Selecciona un socio comercial:</h3>
                                {state.players.filter(p => p.id !== state.currentPlayerIndex && p.alive).map(p => (
                                    <button 
                                        key={p.id}
                                        onClick={() => setTradeTargetId(p.id)}
                                        className="w-full bg-slate-700 hover:bg-slate-600 p-3 rounded text-left flex justify-between items-center"
                                    >
                                        <span className="font-bold text-white">{p.name}</span>
                                        <span className="text-xs text-green-400 font-mono">${p.money}</span>
                                    </button>
                                ))}
                                <button onClick={() => dispatch({type: 'CLOSE_TRADE'})} className="mt-auto w-full bg-slate-800 hover:bg-slate-700 text-gray-400 py-2 rounded">Cancelar</button>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                                    {/* Left: ME */}
                                    <div className="bg-slate-900/50 p-2 rounded flex flex-col min-h-0">
                                        <div className="text-xs text-green-400 font-bold mb-2 uppercase text-center border-b border-white/10 pb-1">TÚ OFRECES</div>
                                        <div className="mb-2">
                                            <label className="text-[10px] text-gray-500 block">Dinero</label>
                                            <input type="number" value={tradeOfferMoney} onChange={e => setTradeOfferMoney(Math.min(state.players[state.currentPlayerIndex].money, Math.max(0, parseInt(e.target.value)||0)))} className="w-full bg-slate-800 border border-slate-600 text-white text-xs p-1 rounded" />
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                                            {state.tiles.filter(t => t.owner === state.currentPlayerIndex).map(t => (
                                                <label key={t.id} className="flex items-center gap-2 p-1 hover:bg-white/5 cursor-pointer text-xs">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={tradeOfferProps.includes(t.id)}
                                                        onChange={e => {
                                                            if(e.target.checked) setTradeOfferProps([...tradeOfferProps, t.id]);
                                                            else setTradeOfferProps(tradeOfferProps.filter(id => id !== t.id));
                                                        }}
                                                    />
                                                    <span style={{color: t.color ? COLORS[t.color as keyof typeof COLORS] : '#aaa'}}>{t.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Right: THEM */}
                                    <div className="bg-slate-900/50 p-2 rounded flex flex-col min-h-0">
                                        <div className="text-xs text-red-400 font-bold mb-2 uppercase text-center border-b border-white/10 pb-1">{state.players[tradeTargetId].name} DA</div>
                                        <div className="mb-2">
                                            <label className="text-[10px] text-gray-500 block">Dinero</label>
                                            <input type="number" value={tradeReqMoney} onChange={e => setTradeReqMoney(Math.min(state.players[tradeTargetId].money, Math.max(0, parseInt(e.target.value)||0)))} className="w-full bg-slate-800 border border-slate-600 text-white text-xs p-1 rounded" />
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                                            {state.tiles.filter(t => t.owner === tradeTargetId).map(t => (
                                                <label key={t.id} className="flex items-center gap-2 p-1 hover:bg-white/5 cursor-pointer text-xs">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={tradeReqProps.includes(t.id)}
                                                        onChange={e => {
                                                            if(e.target.checked) setTradeReqProps([...tradeReqProps, t.id]);
                                                            else setTradeReqProps(tradeReqProps.filter(id => id !== t.id));
                                                        }}
                                                    />
                                                    <span style={{color: t.color ? COLORS[t.color as keyof typeof COLORS] : '#aaa'}}>{t.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <button onClick={() => setTradeTargetId(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white">Atrás</button>
                                    <button 
                                        onClick={() => {
                                            const offer: TradeOffer = {
                                                initiatorId: state.currentPlayerIndex,
                                                targetId: tradeTargetId,
                                                offeredMoney: tradeOfferMoney,
                                                offeredProps: tradeOfferProps,
                                                requestedMoney: tradeReqMoney,
                                                requestedProps: tradeReqProps,
                                                isOpen: true
                                            };
                                            dispatch({type: 'PROPOSE_TRADE', payload: offer});
                                            setTradeTargetId(null); // Reset UI
                                        }} 
                                        className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded text-sm"
                                    >
                                        ENVIAR PROPUESTA
                                    </button>
                                </div>
                            </div>
                        )}
                      </>
                  )}
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
                          {state.creditCrunchTurns && state.creditCrunchTurns > 0 ? (
                              <div className="bg-red-900/50 border border-red-500 p-2 rounded text-center text-red-300 font-bold text-xs mb-2">
                                  🚨 CRISIS DE CRÉDITO: Préstamos bloqueados por {state.creditCrunchTurns} turnos.
                              </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <label className="text-gray-400">Cantidad: ${loanAmount}</label>
                                <input type="range" min="100" max="2000" step="100" value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))} className="accent-red-500"/>
                                <div className="col-span-2 flex justify-between"><span>Plazo: {loanTurns} turnos</span><span>Interés: 20%</span></div>
                                <button onClick={() => dispatch({type: 'TAKE_LOAN', payload: { amount: loanAmount, interest: 20, turns: loanTurns }})} className="col-span-2 bg-red-600 hover:bg-red-500 py-2 rounded text-white font-bold">Solicitar Fondos</button>
                            </div>
                          )}
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

                  <div className="text-center text-xs text-gray-400 mb-4">Puja más alta: {state.auction.highestBidder === 'E' ? 'ESTADO' : (state.auction.highestBidder !== null ? state.players.find(p => p.id === state.auction.highestBidder)?.name : 'Nadie')}</div>

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
                      const t = state.tiles[state.selectedTileId || 0];
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
                                            
                                            {isOwner && !t.mortgaged && (t.houses || 0) < 5 && ( 
                                                <button onClick={() => dispatch({type: 'BUILD_HOUSE', payload: {tId: t.id}})} className="col-span-2 bg-blue-600 hover:bg-blue-500 py-2 rounded font-bold text-white shadow-lg">
                                                    {t.subtype === 'fiore' ? `Contratar Trabajador ($200)` : `Construir (${formatMoney(houseCost)})`}
                                                </button> 
                                            )}
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
                          <input type="range" min="0" max="8" step="1" value={setupHumans} onChange={e => setSetupHumans(parseInt(e.target.value))} className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-green-500" />
                      </div>

                      <div className="space-y-3">
                          {humanConfigs.slice(0, setupHumans).map((cfg, idx) => (
                              <div key={idx} className="bg-slate-900 p-3 rounded border border-slate-700">
                                  <div className="text-xs text-gray-500 mb-1 uppercase font-bold">Jugador {idx + 1}</div>
                                  <input 
                                      type="text" 
                                      value={cfg.name} 
                                      onChange={(e) => {
                                          const newCfgs = [...humanConfigs];
                                          newCfgs[idx] = { ...newCfgs[idx], name: e.target.value };
                                          setHumanConfigs(newCfgs);
                                      }}
                                      className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-sm text-white mb-2"
                                      placeholder="Nombre"
                                  />
                                  <select 
                                      value={cfg.gender}
                                      onChange={(e) => {
                                          const newCfgs = [...humanConfigs];
                                          newCfgs[idx] = { ...newCfgs[idx], gender: e.target.value };
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
    </div>
  );
}
