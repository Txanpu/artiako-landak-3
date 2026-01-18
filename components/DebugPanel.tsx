
import React, { useState } from 'react';
import { GameState, TileType } from '../types';
import { EVENTS_DECK } from '../utils/gameLogic';

interface DebugPanelProps {
    state: GameState;
    dispatch: React.Dispatch<any>;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ state, dispatch }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'status' | 'actions' | 'roles' | 'events' | 'export'>('status');

    if (!state.gameStarted) return null;

    const currentPlayer = state.players[state.currentPlayerIndex];

    const copyState = () => {
        navigator.clipboard.writeText(JSON.stringify(state));
        alert('Estado copiado al portapapeles');
    };

    return (
        <>
            {/* Toggle Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-4 right-4 z-50 p-2 rounded-full shadow-lg border transition-all ${isOpen ? 'bg-yellow-500 border-yellow-300 text-black rotate-90' : 'bg-slate-800 border-slate-600 text-gray-400 hover:text-white'}`}
            >
                🐞
            </button>

            {/* Panel */}
            {isOpen && (
                <div className="fixed bottom-16 right-4 z-50 w-80 bg-white text-slate-900 rounded-lg shadow-2xl border border-slate-300 overflow-hidden text-xs font-mono">
                    <div className="flex bg-slate-100 border-b border-slate-200">
                        {['status', 'actions', 'roles', 'events', 'export'].map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`flex-1 py-2 capitalize ${activeTab === tab ? 'bg-white font-bold text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="p-3 max-h-96 overflow-y-auto">
                        
                        {activeTab === 'status' && (
                            <div className="space-y-1">
                                <div className="flex justify-between"><span className="text-slate-500">Turno:</span> <b>{state.turnCount}</b></div>
                                <div className="flex justify-between"><span className="text-slate-500">Jugador:</span> <b>{currentPlayer.name}</b></div>
                                <div className="flex justify-between"><span className="text-slate-500">Rolled:</span> <b>{state.rolled ? 'YES' : 'NO'}</b></div>
                                <div className="flex justify-between"><span className="text-slate-500">Gobierno:</span> <b className="uppercase">{state.gov}</b></div>
                                <div className="flex justify-between"><span className="text-slate-500">Estado Money:</span> <b>${state.estadoMoney}</b></div>
                                <div className="flex justify-between"><span className="text-slate-500">Loans:</span> <b>{state.loans.length}</b></div>
                            </div>
                        )}

                        {activeTab === 'actions' && (
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => dispatch({type: 'END_TURN'})} className="bg-slate-200 hover:bg-slate-300 p-2 rounded">Force End Turn</button>
                                <button onClick={() => dispatch({type: 'ROLL_DICE'})} className="bg-slate-200 hover:bg-slate-300 p-2 rounded">Force Roll</button>
                                <button onClick={() => dispatch({type: 'DEBUG_ADD_MONEY', payload: {pId: state.currentPlayerIndex, amount: 1000}})} className="bg-green-100 hover:bg-green-200 text-green-800 p-2 rounded">+1000$ (Self)</button>
                                <button onClick={() => dispatch({type: 'DEBUG_ADD_MONEY', payload: {pId: state.currentPlayerIndex, amount: -1000}})} className="bg-red-100 hover:bg-red-200 text-red-800 p-2 rounded">-1000$ (Self)</button>
                                
                                <div className="col-span-2 mt-2 pt-2 border-t border-slate-200">
                                    <label className="block mb-1 text-slate-500">Teleport Current Player</label>
                                    <select 
                                        className="w-full p-1 border rounded"
                                        onChange={(e) => dispatch({type: 'DEBUG_TELEPORT', payload: {pId: state.currentPlayerIndex, pos: parseInt(e.target.value)}})}
                                        value={currentPlayer.pos}
                                    >
                                        {state.tiles.map(t => (
                                            <option key={t.id} value={t.id}>#{t.id} {t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {activeTab === 'roles' && (
                            <div className="space-y-2">
                                {state.players.map((p, idx) => (
                                    <div key={p.id} className="flex items-center justify-between">
                                        <span>{p.name}</span>
                                        <select 
                                            value={p.role || 'civil'}
                                            onChange={(e) => dispatch({type: 'DEBUG_SET_ROLE', payload: {pId: idx, role: e.target.value}})}
                                            className="ml-2 p-1 border rounded text-[10px]"
                                        >
                                            <option value="civil">Civil</option>
                                            <option value="proxeneta">Proxeneta</option>
                                            <option value="florentino">Florentino</option>
                                            <option value="fbi">FBI</option>
                                            <option value="okupa">Okupa</option>
                                        </select>
                                    </div>
                                ))}
                                <div className="pt-2 border-t mt-2">
                                    <label className="block text-slate-500 mb-1">Set Government</label>
                                    <select 
                                        value={state.gov}
                                        onChange={(e) => dispatch({type: 'DEBUG_SET_GOV', payload: e.target.value})}
                                        className="w-full p-1 border rounded"
                                    >
                                        <option value="left">Left</option>
                                        <option value="right">Right</option>
                                        <option value="authoritarian">Authoritarian</option>
                                        <option value="libertarian">Libertarian</option>
                                        <option value="anarchy">Anarchy</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {activeTab === 'events' && (
                            <div className="space-y-1">
                                {EVENTS_DECK.map(evt => (
                                    <button 
                                        key={evt.id}
                                        onClick={() => dispatch({type: 'DEBUG_TRIGGER_EVENT', payload: evt.id})}
                                        className="w-full text-left p-2 hover:bg-purple-50 rounded border border-transparent hover:border-purple-200 truncate"
                                    >
                                        ⚡ {evt.title}
                                    </button>
                                ))}
                            </div>
                        )}

                        {activeTab === 'export' && (
                            <div className="space-y-2">
                                <button onClick={copyState} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-500 font-bold">
                                    📋 Copiar Estado al Portapapeles
                                </button>
                                <div className="text-[10px] text-gray-500">Últimos Logs:</div>
                                <textarea readOnly className="w-full h-40 bg-slate-100 border p-1 text-[9px]" value={state.logs.slice(0, 50).join('\n')} />
                            </div>
                        )}

                    </div>
                </div>
            )}
        </>
    );
};
