
import React, { useMemo, useRef, useEffect } from 'react';
import { GameState, TileData, TileType } from '../types';
import { COLORS, PLAYER_EMOJIS } from '../constants';

interface BoardProps {
  state: GameState;
  onTileClick: (id: number) => void;
  focusId?: number; // Tile ID to scroll to
}

const Tile = ({ tile, players, onClick, sidePosition, heatVal }: { tile: TileData; players: any[]; onClick: () => void; sidePosition: 'bottom' | 'left' | 'top' | 'right'; heatVal?: number }) => {
  const getBorderColor = (tile: TileData) => {
    if (tile.owner === 'E') return '3px solid #ffd700';
    if (typeof tile.owner === 'number') {
        const owner = players.find(p => p.id === tile.owner);
        return owner ? `3px solid ${owner.color}` : '1px solid #334155';
    }
    return '1px solid #1e293b';
  };

  const barColor = tile.color ? COLORS[tile.color as keyof typeof COLORS] : '#334155';
  const playersHere = players.filter(p => p.pos === tile.id && p.alive);
  const isCorner = [TileType.START, TileType.JAIL, TileType.GOTOJAIL, TileType.PARK].includes(tile.type);

  let flexDirection = 'flex-col';
  let barClass = 'h-[25%] w-full border-b border-white/10';
  let textRot = 'rotate-0';
  let mainContentClass = 'flex-col justify-between';
  
  if (sidePosition === 'left') {
      flexDirection = 'flex-row-reverse'; barClass = 'w-[25%] h-full border-l border-white/10'; mainContentClass = 'flex-row-reverse justify-between items-center';
  } else if (sidePosition === 'right') {
      flexDirection = 'flex-row'; barClass = 'w-[25%] h-full border-r border-white/10'; mainContentClass = 'flex-row justify-between items-center';
  } else if (sidePosition === 'top') {
      flexDirection = 'flex-col-reverse'; barClass = 'h-[25%] w-full border-t border-white/10'; mainContentClass = 'flex-col-reverse justify-between';
  }
  if (isCorner) {
      flexDirection = 'flex-col'; barClass = 'hidden'; mainContentClass = 'flex-col justify-center';
  }

  const isMortgaged = tile.mortgaged;
  
  // Heatmap Overlay Color
  const heatOpacity = heatVal ? Math.min(0.8, heatVal * 0.1) : 0;
  const heatStyle = heatVal ? { backgroundColor: `rgba(255, 80, 0, ${heatOpacity})` } : {};

  return (
    <div
      onClick={onClick}
      className={`relative flex ${flexDirection} h-full w-full bg-[#0f172a] hover:z-50 hover:scale-125 transition-transform duration-200 cursor-pointer overflow-hidden group shadow-md select-none ${isMortgaged ? 'opacity-60 grayscale' : ''}`}
      style={{ border: getBorderColor(tile), borderRadius: '4px' }}
    >
      {/* Heatmap Layer */}
      {heatVal && <div className="absolute inset-0 z-0 pointer-events-none transition-all duration-500" style={heatStyle}></div>}

      {tile.type === TileType.PROP && !isCorner && <div className={`${barClass} relative overflow-hidden z-10`} style={{ backgroundColor: barColor }}>{isMortgaged && <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-bold text-white uppercase tracking-wider">💸 Hipotecada</div>}</div>}

      <div className={`flex-1 flex ${mainContentClass} p-1 text-center ${textRot} overflow-hidden relative z-10`}>
        <span className={`absolute text-[10px] text-gray-500 font-mono font-bold z-10 ${sidePosition === 'top' ? 'bottom-0.5 left-1' : 'top-0.5 right-1'}`}>#{tile.id}</span>
        <div className="flex-1 flex items-center justify-center w-full px-1"><span className={`leading-tight font-bold text-gray-200 ${isCorner ? 'text-[11px] uppercase tracking-wider' : 'text-[10px] line-clamp-3'}`} style={{textShadow: '0 1px 2px black'}}>{tile.name}</span></div>
        {tile.type === TileType.PROP && <div className="w-full flex justify-between items-end text-[9px] text-gray-300 font-mono mt-0.5 px-0.5 leading-none"><span className="font-bold text-emerald-400">${tile.price}</span>{tile.owner !== null && tile.owner !== undefined ? <span className="text-gray-400">R:${tile.rent || tile.baseRent}</span> : <span className="opacity-0">.</span>}</div>}
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            {tile.type === TileType.START && <span className="text-5xl">🚩</span>}
            {tile.type === TileType.JAIL && <span className="text-5xl">⛓️</span>}
            {tile.type === TileType.GOTOJAIL && <span className="text-5xl">👮</span>}
            {tile.type === TileType.PARK && <span className="text-5xl">🚗</span>}
            {tile.type === TileType.EVENT && <span className="text-4xl text-purple-400">❓</span>}
            {tile.type === TileType.TAX && <span className="text-4xl">💸</span>}
            {tile.type === TileType.BANK && <span className="text-4xl">🏦</span>}
            {tile.type === TileType.SLOTS && <span className="text-4xl">🎰</span>}
            {tile.subtype === 'rail' && <span className="text-4xl">🚇</span>}
            {tile.subtype === 'bus' && <span className="text-4xl">🚌</span>}
            {tile.subtype === 'utility' && <span className="text-4xl">💡</span>}
            {tile.subtype === 'ferry' && <span className="text-4xl">⛴️</span>}
            {tile.subtype === 'air' && <span className="text-4xl">✈️</span>}
        </div>
        <div className="absolute bottom-4 left-0 w-full flex justify-center gap-0.5 z-10">
            {Array.from({length: tile.houses || 0}).map((_, i) => <span key={i} className="text-[9px] drop-shadow-md">🏠</span>)}
            {tile.hotel && <span className="text-[9px] drop-shadow-md">🏨</span>}
        </div>
      </div>
      {playersHere.length > 0 && <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[1px]"><div className="flex flex-wrap justify-center gap-1 p-1">{playersHere.map(p => <div key={p.id} className="w-8 h-8 rounded-full border-2 border-white shadow-[0_0_10px_rgba(0,0,0,0.5)] flex items-center justify-center text-lg relative animate-bounce bg-slate-800" style={{ borderColor: p.color, animationDuration: `${1 + p.id * 0.2}s` }} title={p.name}>{PLAYER_EMOJIS[p.id % PLAYER_EMOJIS.length]}</div>)}</div></div>}
    </div>
  );
};

export const Board: React.FC<BoardProps> = ({ state, onTileClick, focusId }) => {
  const tiles = state.tiles;
  const tileRefs = useRef<{[key: number]: HTMLDivElement | null}>({});

  const gridConfig = useMemo(() => {
    const total = tiles.length;
    const sideCount = Math.ceil(total / 4);
    const dim = sideCount + 1;
    const positions: { [key: number]: { row: number, col: number, side: 'bottom'|'left'|'top'|'right' } } = {};
    for (let i = 0; i < total; i++) {
        let row, col, side: 'bottom'|'left'|'top'|'right' = 'bottom';
        if (i < sideCount) { side = 'bottom'; row = dim; col = dim - i; } 
        else if (i < 2 * sideCount) { side = 'left'; const offset = i - sideCount; col = 1; row = dim - offset; } 
        else if (i < 3 * sideCount) { side = 'top'; const offset = i - 2 * sideCount; row = 1; col = 1 + offset; } 
        else { side = 'right'; const offset = i - 3 * sideCount; col = dim; row = 1 + offset; }
        positions[i] = { row, col, side };
    }
    return { dim, positions };
  }, [tiles.length]);

  // Auto-scroll logic
  useEffect(() => {
    if (focusId !== undefined && tileRefs.current[focusId]) {
        tileRefs.current[focusId]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });
    }
  }, [focusId]);

  return (
    <div className="w-full h-full bg-board-dark overflow-auto flex scroll-smooth">
        <div className="bg-[#0f172a] shadow-2xl relative border-[8px] border-slate-700 m-auto" style={{ display: 'grid', gridTemplateColumns: `repeat(${gridConfig.dim}, 110px)`, gridTemplateRows: `repeat(${gridConfig.dim}, 110px)`, gap: '2px', width: 'max-content', height: 'max-content', padding: '4px' }}>
            <div style={{ gridColumn: `2 / span ${gridConfig.dim - 2}`, gridRow: `2 / span ${gridConfig.dim - 2}` }} className="bg-[#0f172a] flex flex-col items-center justify-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-[#0f172a] to-slate-900/10"></div>
                 <div className="z-10 flex flex-col items-center pointer-events-none select-none opacity-50"><h1 className="text-[12rem] font-black text-slate-800 tracking-widest uppercase -rotate-12 drop-shadow-[0_4px_4px_rgba(255,255,255,0.05)] leading-none text-center">ARTIAKO<br/>LANDAK</h1></div>
            </div>
            {tiles.map((tile, i) => {
                const pos = gridConfig.positions[i];
                if (!pos) return null; 
                return (
                    <div key={tile.id} ref={el => { if(el) tileRefs.current[tile.id] = el; }} style={{ gridColumn: pos.col, gridRow: pos.row }} className="h-full w-full">
                        <Tile tile={tile} players={state.players} onClick={() => onTileClick(tile.id)} sidePosition={pos.side} heatVal={state.showHeatmap ? state.heatmap[tile.id] : undefined} />
                    </div>
                );
            })}
        </div>
    </div>
  );
};
