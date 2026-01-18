
import { TileData, TileType } from './types';

export const COLORS = {
  brown: '#78350f',
  cyan: '#06b6d4',
  pink: '#db2777',
  orange: '#f97316',
  red: '#ef4444',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  
  // Extended Palette for Mega Board
  purple: '#9333ea',
  lime: '#84cc16',
  teal: '#14b8a6',
  indigo: '#6366f1',
  rose: '#e11d48',
  amber: '#d97706',
  emerald: '#10b981',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
  fuchsia: '#d946ef',
  slate: '#64748b',
  
  util: '#a3a3a3',
  rail: '#6d28d9',
  ferry: '#0ea5e9',
  air: '#facc15',
  park: '#4ade80',
  start: '#10b981',
  jail: '#111827',
  tax: '#f59e0b',
  bank: '#991b1b',
  event: '#a855f7',
  slots: '#d946ef'
};

export const PLAYER_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#14b8a6', '#ec4899', '#6366f1'];

export const PLAYER_EMOJIS = ['😃', '🤖', '🦊', '🐸', '🐼', '🐵', '🦄', '🐲'];

export const FUNNY: Record<string, string> = {
  start:    'salidas como tu madre.',
  tax:      'dinerito pal politiko',
  jail:     'Buen sitio pa hacer Networking?',
  gotojail: 'A la cárcel, a la cárcel, a la cárcel, a la cárcel, a la cárcel…',
  park:     'buen sitio pa fumar porros',
  slots:    'GANA GANA GANA!!!',
  bank:     'Banca corrupta: pide préstamo o tituliza deudas.',
  default:  'Sin info, como tu madre...'
};

const p = (name: string, color: string, price: number, familia?: string, subtype?: string): Partial<TileData> => ({
  type: TileType.PROP,
  name,
  price,
  color,
  familia: familia || color,
  subtype
});

const rail = (name: string) => p(name, 'rail', 200, 'rail', 'rail');
const bus = (name: string) => p(name, 'rail', 200, 'rail', 'bus');
const ferry = (name: string) => p(name, 'ferry', 180, 'ferry', 'ferry');
const air = (name: string) => p(name, 'air', 260, 'air', 'air');
const util = (name: string) => p(name, 'util', 150, 'util', 'utility');

// THE FULL MEGA BOARD (~104 Tiles)
// Must be divisible by 4 for perfect square layout (104 tiles = 26 per side)
export const BOARD_DEF: Partial<TileData>[] = [
  { type: TileType.START, name: 'SALIDA' },

  // === Grupo TXAKOLI (brown) ===
  p('San Lorenzo ermitie', 'brown', 60, 'Txakoli'),
  p('Santa Maria Elizie', 'brown', 70, 'Txakoli'),
  rail('Metro Zelaieta Sur'), 
  { type: TileType.TAX, name: 'Impuesto 33%' },

  // === Grupo PINTXO (cyan) ===
  p('Pipi´s Bar', 'cyan', 80, 'Pintxo'),
  p('Artea', 'cyan', 90, 'Pintxo'),
  bus('Bizkaibus Herriko Enparantza'),
  util('Iberduero Aguas'),

  // === Grupo KALEA (pink) ===
  p('Perrukeria', 'pink', 100, 'Kalea'),
  p('Estetika Zentroa', 'pink', 105, 'Kalea'), // Added to fill gap
  ferry('Ferris Laida'),
  { type: TileType.TAX, name: 'Impuesto 33%' },

  // === Grupo MENDI (orange) ===
  p('Atxarre', 'orange', 120, 'Mendi'),
  p('San Miguel', 'orange', 130, 'Mendi'),
  p('Omako Basoa', 'orange', 140, 'Mendi'),
  { type: TileType.GOTOJAIL, name: 'Ir a la cárcel' },

  // === Grupo ITSASO (red) ===
  p('Gruas Arego', 'red', 150, 'Itsaso'),
  p('Talleres Arteaga', 'red', 160, 'Itsaso'),
  rail('Metro Arteaga Urias'),
  { type: TileType.TAX, name: 'Impuesto 33%' },
  { type: TileType.EVENT, name: 'Suerte' },

  // === Grupo ARRANTZALE (yellow) ===
  p('Casa Rural Ozollo', 'yellow', 170, 'Arrantzale'),
  p('Aberasturi', 'yellow', 180, 'Arrantzale'),
  util('IberdueroLuz'),
  bus('Bizkaibus Mendialdua'),

  { type: TileType.JAIL, name: 'Cárcel' },

  // === Grupo GUGGEN (green) ===
  p('Bird Center', 'green', 190, 'Guggen'),
  p('Autokarabanak', 'green', 200, 'Guggen'),
  { type: TileType.TAX, name: 'Impuesto 33%' },
  p('Casino Blackjack', 'pink', 300, 'Rosa', 'casino_bj'),

  // === Grupo ROJO (blue) ===
  p('Txokoa', 'blue', 210, 'Rojo'),
  p('Cocina Pablo', 'blue', 220, 'Rojo'),
  p('Casa Minte', 'blue', 230, 'Rojo'),
  rail('Metro Islas'),
  { type: TileType.TAX, name: 'Impuesto 33%' },

  { type: TileType.PARK, name: 'Parkie' },

  // === Grupo NARANJA (amber) ===
  p('Marko Pollo', 'amber', 240, 'Naranja'),
  p('Arketas', 'amber', 250, 'Naranja'),
  ferry('Ferris Mundaka'),
  { type: TileType.GOTOJAIL, name: 'Ir a la cárcel' },
  { type: TileType.EVENT, name: 'Suerte' },

  // === Grupo AMARILLO (lime) ===
  p('Joshua´s', 'lime', 260, 'Amarillo'),
  p('Santana Esnekiak', 'lime', 270, 'Amarillo'),
  p('Klinika Dental Arteaga', 'lime', 280, 'Amarillo'),
  bus('Bizkaibus Muruetagane'),
  { type: TileType.TAX, name: 'Impuesto 33%' },

  // === Grupo VERDE (emerald) ===
  p('Kanala Bitch', 'emerald', 290, 'Verde'),
  p('Kanaleko Tabernie', 'emerald', 300, 'Verde'),
  air('Loiu'),
  rail('Metro Portuas'),
  { type: TileType.EVENT, name: 'Suerte' },

  // === Grupo AZUL (teal) ===
  p('Baratze', 'teal', 310, 'Azul'),
  p('Eskolie', 'teal', 320, 'Azul'),
  { type: TileType.TAX, name: 'Impuesto 33%' },
  p('Fiore', 'green', 240, 'Verde', 'fiore'),

  // === Grupo CIAN (sky) ===
  p('Garbigune', 'sky', 330, 'Cian'),
  p('Padura', 'sky', 340, 'Cian'),
  p('Santanako Desaguie', 'sky', 350, 'Cian'),
  bus('Bizkaibus Ibarrekozubi'),
  { type: TileType.TAX, name: 'Impuesto 33%' },

  // === Grupo ROSA (rose) ===
  p('Farmazixe', 'rose', 360, 'Rosa'),
  p('Medikue', 'rose', 370, 'Rosa'),
  air('Ozolloko Aireportue'),
  { type: TileType.GOTOJAIL, name: 'Ir a la cárcel' },
  { type: TileType.EVENT, name: 'Suerte' },

  // === Grupo BASERRI (indigo) ===
  p('Frontoie', 'indigo', 380, 'Baserri'),
  p('Skateko Pistie', 'indigo', 390, 'Baserri'),
  p('Txarlin Pistie', 'indigo', 400, 'Baserri'),
  rail('Metro Ozollo'),
  { type: TileType.TAX, name: 'Impuesto 33%' },

  // === Grupo SIRIMIRI (violet) ===
  p('Txopebenta', 'violet', 410, 'Sirimiri'),
  p('Jaunsolo Molino', 'violet', 420, 'Sirimiri'),
  p('Casino Ruleta', 'pink', 300, 'Rosa', 'casino_roulette'),

  // === Grupo BILBO (fuchsia) ===
  p('Lezika', 'fuchsia', 430, 'Bilbo'),
  p('Bernaetxe', 'fuchsia', 440, 'Bilbo'),
  p('Baserri Maitea', 'fuchsia', 450, 'Bilbo'),
  { type: TileType.GOTOJAIL, name: 'Ir a la cárcel' },
  { type: TileType.TAX, name: 'Impuesto 33%' },
  { type: TileType.EVENT, name: 'Suerte' },

  // === Grupo GAZTELUGATXE (slate) ===
  p('Artiako Kanterie', 'slate', 460, 'Gaztelugatxe'),
  p('Ereñokoa Ez Dan Kanterie', 'slate', 470, 'Gaztelugatxe'),

  // === Grupo NERVIÓN (purple) ===
  p('Artiako GYM-e', 'purple', 480, 'Nervión'),
  p('Ereñoko GYM-e', 'purple', 490, 'Nervión'),
  p('Frontoiko Bici estatikak', 'purple', 500, 'Nervión'),

  { type: TileType.SLOTS, name: 'Tragaperras' },

  // === Grupo TXISTORRA (red) ===
  p('Solabe', 'red', 510, 'Txistorra'),
  p('Katxitxone', 'red', 520, 'Txistorra'),

  // === Grupo SAGARDOA (orange) ===
  p('San Antolin', 'orange', 530, 'Sagardoa'),
  p('Farolak', 'orange', 540, 'Sagardoa'),

  // === Grupo KAIKU (yellow) ===
  p('Santi Mamiñe', 'yellow', 550, 'Kaiku'),
  p('Portuaseko Kobazuloa', 'yellow', 560, 'Kaiku'),

  // === Grupo ZORIONAK (blue) ===
  p('Hemingway Etxea', 'blue', 570, 'Zorionak'),
  p('Etxealaia', 'blue', 580, 'Zorionak'),

  { type: TileType.PARK, name: 'Parkie' },

  // === Grupo LOIU (cyan) ===
  p('Kastillue', 'cyan', 590, 'Loiu'),
  p('Errota', 'cyan', 600, 'Loiu'),

  { type: TileType.GOTOJAIL, name: 'Ir a la cárcel' },
  { type: TileType.BANK, name: 'Banca corrupta' },
  { type: TileType.SLOTS, name: 'Tragaperras' },
  { type: TileType.BANK, name: 'Banca corrupta' },
  
  // Padding to ensure 104 tiles for perfect square (26 per side)
  { type: TileType.EVENT, name: 'Obras Públicas' },
  { type: TileType.EVENT, name: 'Manifestación' },
  { type: TileType.EVENT, name: 'Día Festivo' },
];

export const INITIAL_TILES: TileData[] = BOARD_DEF.map((t, i) => ({
  ...t,
  id: i,
  owner: null,
  houses: 0,
  hotel: false,
  mortgaged: false,
  workers: 0,
} as TileData));
