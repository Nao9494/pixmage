// Pixel icons, in place of the emoji the pixel font lacks: each a 12 × 12 colored glyph on a Private
// Use Area code point, so it flows through the text like any wide character. Most move: a few frames,
// each held its own milliseconds, picked by the clock when the Svg is drawn. The art came from the
// icon gallery (pixel-icons-preview.html) and is the source of truth now.

import type { Glyph } from './font'

const PALETTE: Record<string, number> = {
  W: 0xffffff,
  S: 0xb8c0e0,
  Y: 0xffd75f,
  O: 0xe8a33a,
  R: 0xff5f5f,
  r: 0xb8323c,
  P: 0xffb3c1,
  B: 0x5fafff,
  b: 0x2f6fbf,
  C: 0x8fe8ff,
  G: 0xd6dcff,
  L: 0x8a93c8,
  D: 0x5a3a2a,
  H: 0x8b5a2b,
  N: 0x5fd787,
  n: 0x2e9e5b,
  K: 0x1a1530,
  U: 0xb07cff,
  u: 0x6a3fb5,
  F: 0xff9f43,
  E: 0x6b7080,
  T: 0xf3e2b3,
}

export type IconName = keyof typeof ICON
export const ICON = {
  quill: '\uE000',
  calendar: '\uE001',
  memo: '\uE002',
  no: '\uE003',
  star: '\uE004',
  sword: '\uE005',
  heart: '\uE006',
  potion: '\uE007',
  coin: '\uE008',
  hourglass: '\uE009',
  campfire: '\uE00A',
  chest: '\uE00B',
  book: '\uE00C',
  crystal: '\uE00D',
  slime: '\uE00E',
  bubble: '\uE00F',
  key: '\uE010',
  scroll: '\uE011',
  envelope: '\uE012',
  moon: '\uE013',
  bulb: '\uE014',
  shield: '\uE015',
  gem: '\uE016',
  ghost: '\uE017',
  close: '\uE018',
  note: '\uE019',
  mute: '\uE01A',
  next: '\uE01B',
  gear: '\uE01C',
  setSfx: '\uE01D',
  setTracks: '\uE01E',
  setCompact: '\uE01F',
  setLang: '\uE020',
  setVolume: '\uE021',
  setMotion: '\uE022',
  setShuffle: '\uE023',
} as const

type Art = { ms: number[]; frames: string[][] }

const ART: Record<IconName, Art> = {
  // 羽毛筆：書記官
  quill: { ms: [220, 220, 220, 220], frames: [
    ['.........WWW', '.......WWWWS', '......WWWWS.', '.....WWWWS..', '....WWWSS...', '...WWWS.....', '...WWS......', '..WS........', '..Y.........', '.Y..........', 'Y...........', '.D..........'],
    ['.........WWW', '.......WWWWS', '......WWWWS.', '.....WWWWS..', '....WWWSS...', '...WWWS.....', '...WWS......', '..WS........', '..Y.........', '.Y..........', 'Y...........', '.DDD........'],
    ['.........WWW', '.......WWWWS', '......WWWWS.', '.....WWWWS..', '....WWWSS...', '...WWWS.....', '...WWS......', '..WS........', '..Y.........', '.Y..........', 'Y...........', '.DDDDD......'],
    ['.........WWW', '.......WWWWS', '......WWWWS.', '.....WWWWS..', '....WWWSS...', '...WWWS.....', '...WWS......', '..WS........', '..Y.........', '.Y..........', 'Y...........', '.DDDDDDD....'],
  ]},
  // 月曆：已記錄到行事曆
  calendar: { ms: [600, 600], frames: [
    ['............', '.RRRRRRRRRR.', '.RDRRRRRRDR.', '.WWWWWWWWWW.', '.WLWLWLWLWW.', '.WWWWWWWWWW.', '.WLWLWLWLWW.', '.WWWWWWWWWW.', '.WLWLWRRWWW.', '.WWWWWRRWWW.', '.WWWWWWWWWW.', '............'],
    ['............', '.RRRRRRRRRR.', '.RDRRRRRRDR.', '.WWWWWWWWWW.', '.WLWLWLWLWW.', '.WWWWWWWWWW.', '.WLWLWLWLWW.', '.WWWWWWWWWW.', '.WLWLWYYWWW.', '.WWWWWYYWWW.', '.WWWWWWWWWW.', '............'],
  ]},
  // 便條紙：本對話未記錄
  memo: { ms: [600, 250, 600], frames: [
    ['............', '.YYYYYYY....', '.YYYYYYYY...', '.YDDDDDYYY..', '.YYYYYYYYY..', '.YDDDDDDDY..', '.YYYYYYYYY..', '.YDDDDDDDY..', '.YYYYYYYYY..', '.YDDDDYYYY..', '.YYYYYYYYY..', '............'],
    ['............', '.YYYYYYY....', '.YYYYYYYY...', '.YDDDDDYYY..', '.YYYYYYYYY..', '.YDDDDDDDY..', '.YYYYYYYYY..', '.YDDDDDDDY..', '.YYYYYYYYY..', '.YDDDDDYYY..', '.YYYYYYYYY..', '............'],
    ['............', '.YYYYYYY....', '.YYYYYYYY...', '.YDDDDDYYY..', '.YYYYYYYYY..', '.YDDDDDDDY..', '.YYYYYYYYY..', '.YDDDDDDDY..', '.YYYYYYYYY..', '.YDDDDDDDY..', '.YYYYYYYYY..', '............'],
  ]},
  // 禁止：本對話不記錄
  no: { ms: [900, 160], frames: [
    ['....RRRR....', '..RRRRRRRR..', '.RRR....RRR.', '.RRRR....RR.', 'RR.RRR....RR', 'RR..RRR...RR', 'RR...RRR..RR', 'RR....RRR.RR', '.RR....RRRR.', '.RRR....RRR.', '..RRRRRRRR..', '....RRRR....'],
    ['....RRRR....', '..RRRRRRRR..', '.RRR....RRR.', '.RRRR....RR.', 'RR.RRR....RR', 'RR..RWR...RR', 'RR...RWR..RR', 'RR....RRR.RR', '.RR....RRRR.', '.RRR....RRR.', '..RRRRRRRR..', '....RRRR....'],
  ]},
  // 星星：Lv 等級
  star: { ms: [700, 120, 120], frames: [
    ['.....YY.....', '.....YY.....', '....YYYY....', 'YYYYYYYYYYYY', '.YYYYYYYYYY.', '..YYYYYYYY..', '...YYYYYY...', '...YYOOYY...', '..YYO..OYY..', '..YO....OY..', '.YO......OY.', '............'],
    ['.....YY.....', '.....YY.....', '....YYYY....', 'YYYYYWWYYYYY', '.YYYYWWYYYY.', '..YYYYYYYY..', '...YYYYYY...', '...YYOOYY...', '..YYO..OYY..', '..YO....OY..', '.YO......OY.', '............'],
    ['W....YY....W', '.W...YY...W.', '....YYYY....', 'YYYYYYYYYYYY', '.YYYYYYYYYY.', '..YYYYYYYY..', '...YYYYYY...', '...YYOOYY...', '..YYO..OYY..', '..YO....OY..', '.YO......OY.', '............'],
  ]},
  // 劍：KO 擊殺數
  sword: { ms: [600, 90, 90, 90, 90], frames: [
    ['..........WW', '.........WWW', '........WWS.', '.......WWS..', '......WWS...', '..Y..WWS....', '...YWWS.....', '....YS......', '...HHY......', '..HH..Y.....', '.HH.........', 'HH..........'],
    ['..........WW', '.........WWW', '........WWS.', '.......WWS..', '......WWS...', '..Y..WWS....', '...YWWS.....', '....YS......', '...HHY......', '..HH..Y.....', '.HH.........', 'HH..........'],
    ['..........WW', '.........WWW', '........WWS.', '.......WWS..', '......WCS...', '..Y..WWS....', '...YWWS.....', '....YS......', '...HHY......', '..HH..Y.....', '.HH.........', 'HH..........'],
    ['..........WW', '.........WWW', '........WCS.', '.......WWS..', '......WWS...', '..Y..WWS....', '...YWWS.....', '....YS......', '...HHY......', '..HH..Y.....', '.HH.........', 'HH..........'],
    ['..........WC', '.........WWW', '........WWS.', '.......WWS..', '......WWS...', '..Y..WWS....', '...YWWS.....', '....YS......', '...HHY......', '..HH..Y.....', '.HH.........', 'HH..........'],
  ]},
  // 愛心：5H 用量
  heart: { ms: [500, 110, 110, 110, 700], frames: [
    ['............', '..RRR..RRR..', '.RPPRRRRRRR.', '.RPRRRRRRRR.', '.RRRRRRRRRR.', '.RRRRRRRRRR.', '..RRRRRRRR..', '...RRRRRR...', '....RRRR....', '.....RR.....', '............', '............'],
    ['.RRRR..RRRR.', 'RRPPRRRRRRRR', 'RPPRRRRRRRRR', 'RPRRRRRRRRRR', 'RRRRRRRRRRRR', '.RRRRRRRRRR.', '..RRRRRRRR..', '...RRRRRR...', '....RRRR....', '.....RR.....', '............', '............'],
    ['............', '..RRR..RRR..', '.RPPRRRRRRR.', '.RPRRRRRRRR.', '.RRRRRRRRRR.', '.RRRRRRRRRR.', '..RRRRRRRR..', '...RRRRRR...', '....RRRR....', '.....RR.....', '............', '............'],
    ['.RRRR..RRRR.', 'RRPPRRRRRRRR', 'RPPRRRRRRRRR', 'RPRRRRRRRRRR', 'RRRRRRRRRRRR', '.RRRRRRRRRR.', '..RRRRRRRR..', '...RRRRRR...', '....RRRR....', '.....RR.....', '............', '............'],
    ['............', '..RRR..RRR..', '.RPPRRRRRRR.', '.RPRRRRRRRR.', '.RRRRRRRRRR.', '.RRRRRRRRRR.', '..RRRRRRRR..', '...RRRRRR...', '....RRRR....', '.....RR.....', '............', '............'],
  ]},
  // 藥水：7D 用量
  potion: { ms: [260, 260, 260], frames: [
    ['....HHHH....', '....HHHH....', '.....GG.....', '.....GG.....', '....G..G....', '...G....G...', '..GBBBBBBG..', '..GBWBBBBG..', '..GBWBBBBG..', '..GBBBCBBG..', '...GBBBBG...', '....GGGG....'],
    ['....HHHH....', '....HHHH....', '.....GG.....', '.....GG.....', '....G..G....', '...G....G...', '..GBBBBBBG..', '..GBWBBBBG..', '..GBWBBCBG..', '..GBBCBBBG..', '...GBBBBG...', '....GGGG....'],
    ['....HHHH....', '....HHHH....', '.....GG.....', '.....GG.....', '....G..G....', '...G....G...', '..GBBBBBBG..', '..GBWBCBBG..', '..GBWBBBBG..', '..GBBBBCBG..', '...GBBBBG...', '....GGGG....'],
  ]},
  // 金幣：花費
  coin: { ms: [400, 120, 120, 120], frames: [
    ['....YYYY....', '..YYYYYYYY..', '.YYYOOOOYYY.', '.YYOYYYYOYY.', 'YYYOYYYYYYYY', 'YYYYOOOOYYYY', 'YYYYYYYYOYYY', 'YYYOYYYYOYYY', '.YYYOOOOYYY.', '.YYYYYYYYYY.', '..YYYYYYYY..', '....YYYY....'],
    ['.....YY.....', '....YYYY....', '....YOYY....', '....YOYY....', '....YOYY....', '....YOYY....', '....YOYY....', '....YOYY....', '....YOYY....', '....YOYY....', '....YYYY....', '.....YY.....'],
    ['.....YO.....', '.....YO.....', '.....YO.....', '.....YO.....', '.....YO.....', '.....YO.....', '.....YO.....', '.....YO.....', '.....YO.....', '.....YO.....', '.....YO.....', '.....YO.....'],
    ['.....YY.....', '....YYYY....', '....YOYY....', '....YOYY....', '....YOYY....', '....YOYY....', '....YOYY....', '....YOYY....', '....YOYY....', '....YOYY....', '....YYYY....', '.....YY.....'],
  ]},
  // 沙漏：書記官整理中、等待
  hourglass: { ms: [380, 380, 380, 700], frames: [
    ['.HHHHHHHHHH.', '..G......G..', '..GYYYYYYG..', '...GYYYYG...', '....GYYG....', '.....GG.....', '....G..G....', '...G....G...', '..G......G..', '..G......G..', '.HHHHHHHHHH.', '............'],
    ['.HHHHHHHHHH.', '..G......G..', '..G......G..', '...GYYYYG...', '....GYYG....', '.....GG.....', '....GY.G....', '...G.Y..G...', '..G..Y...G..', '..GYYYYYYG..', '.HHHHHHHHHH.', '............'],
    ['.HHHHHHHHHH.', '..G......G..', '..G......G..', '...G....G...', '....GYYG....', '.....GG.....', '....GY.G....', '...G.Y..G...', '..GYYYYYYG..', '..GYYYYYYG..', '.HHHHHHHHHH.', '............'],
    ['.HHHHHHHHHH.', '..G......G..', '..G......G..', '...G....G...', '....G..G....', '.....GG.....', '....G..G....', '...GYYYYG...', '..GYYYYYYG..', '..GYYYYYYG..', '.HHHHHHHHHH.', '............'],
  ]},
  // 營火：閒置休息中
  campfire: { ms: [160, 160, 160], frames: [
    ['............', '.....R......', '.....RR.....', '....RFR.....', '....RFFR....', '...RFYFR....', '...RFYYFR...', '..RFFYYFR...', '...RFYYFR...', '..HDHHHHDH..', '.DHHDHHDHHD.', '............'],
    ['......Y.....', '......R.....', '.....RR.....', '.....RFR....', '....RFFR....', '....RFYFR...', '...RFYYFR...', '...RFYYFFR..', '...RFYYFR...', '..HDHHHHDH..', '.DHHDHHDHHD.', '............'],
    ['............', '....Y.......', '.....R..R...', '....RR.RR...', '....RFRFR...', '...RFFYFR...', '...RFYYFR...', '..RFYYYFR...', '...RFYYFR...', '..HDHHHHDH..', '.DHHDHHDHHD.', '............'],
  ]},
  // 寶箱：任務完成、升級
  chest: { ms: [700, 140, 140, 260, 260, 260, 260], frames: [
    ['............', '............', '............', '..HHHHHHHH..', '.HHHHHHHHHH.', '.YYYYYYYYYY.', '.HHHHYYHHHH.', '.HHHHYDHHHH.', '.HHHHHHHHHH.', '.HHHHHHHHHH.', '.DDDDDDDDDD.', '............'],
    ['............', '............', '............', '..HHHHHHHH..', '.HHHHHHHHHH.', '.YYYYYYYYYY.', '.HHHHWYHHHH.', '.HHHHYDHHHH.', '.HHHHHHHHHH.', '.HHHHHHHHHH.', '.DDDDDDDDDD.', '............'],
    ['............', '............', '..HHHHHHHH..', '.HHHHHHHHHH.', '.YYYYYYYYYY.', '.DDDDDDDDDD.', '.HHHHYYHHHH.', '.HHHHYDHHHH.', '.HHHHHHHHHH.', '.HHHHHHHHHH.', '.DDDDDDDDDD.', '............'],
    ['..HHHHHHHH..', '.HHHHHHHHHH.', '.YYYYYYYYYY.', '.D..W..Y..D.', '.DYYOYYOYYD.', '.YYYYYYYYYY.', '.HHHHYYHHHH.', '.HHHHHHHHHH.', '.HHHHHHHHHH.', '.HHHHHHHHHH.', '.DDDDDDDDDD.', '............'],
    ['..HHHHHHHH..', '.HHHHHHHHHH.', '.YYYYYYYYYY.', '.DY.....W.D.', '.DYYOYYOYYD.', '.YYYYYYYYYY.', '.HHHHYYHHHH.', '.HHHHHHHHHH.', '.HHHHHHHHHH.', '.HHHHHHHHHH.', '.DDDDDDDDDD.', '............'],
    ['..HHHHHHHH..', '.HHHHHHHHHH.', '.YYYYYYYYYY.', '.D..Y.W...D.', '.DYYOYYOYYD.', '.YYYYYYYYYY.', '.HHHHYYHHHH.', '.HHHHHHHHHH.', '.HHHHHHHHHH.', '.HHHHHHHHHH.', '.DDDDDDDDDD.', '............'],
    ['..HHHHHHHH..', '.HHHHHHHHHH.', '.YYYYYYYYYY.', '.DW.....Y.D.', '.DYYOYYOYYD.', '.YYYYYYYYYY.', '.HHHHYYHHHH.', '.HHHHHHHHHH.', '.HHHHHHHHHH.', '.HHHHHHHHHH.', '.DDDDDDDDDD.', '............'],
  ]},
  // 魔法書：讀檔案、查資料
  book: { ms: [260, 260, 260], frames: [
    ['...C........', '..CWC...U...', '...C........', '..WWW..WWW..', '.WWWWWWWWWW.', '.WLLLWWLLLW.', '.WWWWWWWWWW.', '.WLLLWWLLLW.', '.WWWWWWWWWW.', 'UUUUUWWUUUUU', '.uuuuuuuuuu.', '............'],
    ['........C...', '...U...CWC..', '........C...', '..WWW..WWW..', '.WWWWWWWWWW.', '.WLLLWWLLLW.', '.WWWWWWWWWW.', '.WLLLWWLLLW.', '.WWWWWWWWWW.', 'UUUUUWWUUUUU', '.uuuuuuuuuu.', '............'],
    ['.....U......', '....UCU.....', '.....U...C..', '..WWW..WWW..', '.WWWWWWWWWW.', '.WLLLWWLLLW.', '.WWWWWWWWWW.', '.WLLLWWLLLW.', '.WWWWWWWWWW.', 'UUUUUWWUUUUU', '.uuuuuuuuuu.', '............'],
  ]},
  // 水晶球：Claude 正在思考
  crystal: { ms: [300, 300, 300, 300], frames: [
    ['............', '....uuuu....', '..uuUUUUuu..', '.uUUCWUUUUu.', '.uUCWUUUUUu.', '.uUUUUUUUUu.', '.uUUUUUUUUu.', '..uuUUUUuu..', '....uuuu....', '...HHHHHH...', '..HOOOOOOH..', '..DDDDDDDD..'],
    ['............', '....uuuu....', '..uuUUUUuu..', '.uUUCWUCUUu.', '.uUCWUCCUUu.', '.uUUUCCUUUu.', '.uUUUUUUUUu.', '..uuUUUUuu..', '....uuuu....', '...HHHHHH...', '..HOOOOOOH..', '..DDDDDDDD..'],
    ['............', '....uuuu....', '..uuUUUUuu..', '.uUUCWCCUUu.', '.uUCWCCCCUu.', '.uUUCCCCUUu.', '.uUUUCCUUUu.', '..uuUUUUuu..', '....uuuu....', '...HHHHHH...', '..HOOOOOOH..', '..DDDDDDDD..'],
    ['............', '....uuuu....', '..uuUUUUuu..', '.uUUCWUUUUu.', '.uUCWUUCUUu.', '.uUUUUCCUUu.', '.uUUUCCUUUu.', '..uuUUUUuu..', '....uuuu....', '...HHHHHH...', '..HOOOOOOH..', '..DDDDDDDD..'],
  ]},
  // 史萊姆：怪物出現、工具呼叫
  slime: { ms: [260, 160, 260, 160], frames: [
    ['............', '............', '............', '............', '.....NN.....', '...NNNNNN...', '..NNNNNNNN..', '..NNKNNKNN..', '.NNNNNNNNNN.', '.NnNNNNNNnN.', '.nnnnnnnnnn.', '............'],
    ['............', '............', '............', '............', '............', '............', '..NNNNNNNN..', '.NNNKNNKNNN.', 'NNNNNNNNNNNN', 'NnNNNNNNNNnN', 'nnnnnnnnnnnn', '............'],
    ['............', '.....NN.....', '....NNNN....', '...NNNNNN...', '..NNKNNKNN..', '..NNNNNNNN..', '..NnNNNNnN..', '...nnnnnn...', '............', '............', '....EEEE....', '............'],
    ['............', '............', '............', '............', '............', '............', '..NNNNNNNN..', '.NNNKNNKNNN.', 'NNNNNNNNNNNN', 'NnNNNNNNNNnN', 'nnnnnnnnnnnn', '............'],
  ]},
  // 驚嘆號：等你回答、要你允許
  bubble: { ms: [420, 420], frames: [
    ['............', '..WWWWWWWW..', '.WWWWRRWWWW.', 'WWWWWRRWWWWW', 'WWWWWRRWWWWW', 'WWWWWWWWWWWW', 'WWWWWRRWWWWW', '.WWWWWWWWWW.', '..WWWWWWWW..', '...WW.......', '..WW........', '.W..........'],
    ['..WWWWWWWW..', '.WWWWRRWWWW.', 'WWWWWRRWWWWW', 'WWWWWRRWWWWW', 'WWWWWWWWWWWW', 'WWWWWRRWWWWW', '.WWWWWWWWWW.', '..WWWWWWWW..', '...WW.......', '..WW........', '.W..........', '............'],
  ]},
  // 鑰匙：要你允許權限
  key: { ms: [600, 110, 110, 110, 110], frames: [
    ['............', '............', '..YYY.......', '.YO.OY......', '.Y...YYYYYYY', '.YO.OY..Y.Y.', '..YYY...Y.Y.', '............', '............', '............', '............', '............'],
    ['............', '............', '..WYY.......', '.YO.OY......', '.Y...YYYYYYY', '.YO.OY..Y.Y.', '..YYY...Y.Y.', '............', '............', '............', '............', '............'],
    ['............', '............', '..YYY.......', '.YO.OY......', '.Y...YWYYYYY', '.YO.OY..Y.Y.', '..YYY...Y.Y.', '............', '............', '............', '............', '............'],
    ['............', '............', '..YYY.......', '.YO.OY......', '.Y...YYYYWYY', '.YO.OY..Y.Y.', '..YYY...Y.Y.', '............', '............', '............', '............', '............'],
    ['............', '............', '..YYY.....C.', '.YO.OY.....C', '.Y...YYYYYYW', '.YO.OY..Y.Y.', '..YYY...Y.Y.', '............', '............', '............', '............', '............'],
  ]},
  // 卷軸：開始新任務、你送出訊息
  scroll: { ms: [500, 160, 160, 900, 160, 160], frames: [
    ['............', '............', '............', '............', '..OYYYYYYO..', '..OYYYYYYO..', '..OYYYYYYO..', '..OYYYYYYO..', '............', '............', '............', '............'],
    ['............', '............', '............', '.OYYYYYYYYO.', '..TTTTTTTT..', '..TDDDDDDT..', '..TTTTTTTT..', '.OYYYYYYYYO.', '............', '............', '............', '............'],
    ['............', '.OYYYYYYYYO.', '..TTTTTTTT..', '..TDDDDDDT..', '..TTTTTTTT..', '..TDDDDTTT..', '..TTTTTTTT..', '..TDDDDDDT..', '..TTTTTTTT..', '.OYYYYYYYYO.', '............', '............'],
    ['.OYYYYYYYYO.', '..TTTTTTTT..', '..TDDDDDDT..', '..TTTTTTTT..', '..TDDDDTTT..', '..TTTTTTTT..', '..TDDDDDDT..', '..TTTTTTTT..', '..TDDDTTTT..', '..TTTTTTTT..', '.OYYYYYYYYO.', '............'],
    ['............', '.OYYYYYYYYO.', '..TTTTTTTT..', '..TDDDDDDT..', '..TTTTTTTT..', '..TDDDDTTT..', '..TTTTTTTT..', '..TDDDDDDT..', '..TTTTTTTT..', '.OYYYYYYYYO.', '............', '............'],
    ['............', '............', '............', '.OYYYYYYYYO.', '..TTTTTTTT..', '..TDDDDDDT..', '..TTTTTTTT..', '.OYYYYYYYYO.', '............', '............', '............', '............'],
  ]},
  // 信封：收到通知、背景任務完成
  envelope: { ms: [500, 140, 140, 500], frames: [
    ['............', '............', 'WWWWWWWWWWWW', 'WSWWWWWWWWSW', 'WWSWWWWWWSWW', 'WWWSWWWWSWWW', 'WWWWSRRSWWWW', 'WWWWWRRWWWWW', 'WWWWWWWWWWWW', 'WWWWWWWWWWWW', 'SSSSSSSSSSSS', '............'],
    ['............', 'WWWWWWWWWWWW', 'WSWWWWWWWWSW', 'WWSWWWWWWSWW', 'WWWSWWWWSWWW', 'WWWWSRRSWWWW', 'WWWWWRRWWWWW', 'WWWWWWWWWWWW', 'WWWWWWWWWWWW', 'SSSSSSSSSSSS', '............', '............'],
    ['P..........P', 'WWWWWWWWWWWW', 'WSWWWWWWWWSW', 'WWSWWWWWWSWW', 'WWWSWWWWSWWW', 'WWWWSRRSWWWW', 'WWWWWRRWWWWW', 'WWWWWWWWWWWW', 'WWWWWWWWWWWW', 'SSSSSSSSSSSS', '............', '............'],
    ['............', '............', 'WWWWWWWWWWWW', 'WSWWWWWWWWSW', 'WWSWWWWWWSWW', 'WWWSWWWWSWWW', 'WWWWSRRSWWWW', 'WWWWWRRWWWWW', 'WWWWWWWWWWWW', 'WWWWWWWWWWWW', 'SSSSSSSSSSSS', '............'],
  ]},
  // 月亮 Zzz：Clawd 睡著
  moon: { ms: [450, 450, 450, 450], frames: [
    ['............', '............', '............', '...YYYY.....', '..YYY.......', '.YYY........', '.YY.....LLLL', '.YY.......L.', '.YYY.....L..', '..YYYY..LLLL', '...YYYYYY...', '............'],
    ['............', '............', '............', '...YYYY.....', '..YYY...LLLL', '.YYY......L.', '.YY......L..', '.YY.....LLLL', '.YYY........', '..YYYY......', '...YYYYYY...', '............'],
    ['............', '............', '........LLLL', '...YYYY...L.', '..YYY....L..', '.YYY....LLLL', '.YY.........', '.YY.........', '.YYY........', '..YYYY......', '...YYYYYY...', '............'],
    ['........EEEE', '..........E.', '.........E..', '...YYYY.EEEE', '..YYY.......', '.YYY........', '.YY.........', '.YY.........', '.YYY........', '..YYYY......', '...YYYYYY...', '............'],
  ]},
  // 燈泡：有新點子、書記官寫好了
  bulb: { ms: [700, 120, 120, 900], frames: [
    ['............', '....SSSS....', '...S....S...', '..S......S..', '..S......S..', '..S......S..', '...S....S...', '....S..S....', '....EEEE....', '....EEEE....', '.....EE.....', '............'],
    ['............', '....SSSS....', '...SYYYYS...', '..SYYYYYYS..', '..SYYYYYYS..', '..SYYYYYYS..', '...SYYYYS...', '....SYYS....', '....EEEE....', '....EEEE....', '.....EE.....', '............'],
    ['............', '....SSSS....', '...S....S...', '..S......S..', '..S......S..', '..S......S..', '...S....S...', '....S..S....', '....EEEE....', '....EEEE....', '.....EE.....', '............'],
    ['Y....YY....Y', '....YYYY....', '...YWWYYY...', 'Y.YWYYYYYY.Y', '..YYYYYYYY..', '..YYYYYYYY..', '...YYYYYY...', '....YYYY....', '....EEEE....', '....EEEE....', '.....EE.....', '............'],
  ]},
  // 盾牌：被擋下、安全檢查
  shield: { ms: [700, 120, 120, 120], frames: [
    ['.SSSSSSSSSS.', 'SBBBBSSBBBBS', 'SBBBBSYBBBBS', 'SBBBBSYBBBBS', 'SSSSSYYSSSSS', 'SYYYYYYYYYYS', 'SBBBBSYBBBBS', '.SBBBSYBBBS.', '.SBBBSYBBBS.', '..SBBSYBBS..', '...SSSSSS...', '.....SS.....'],
    ['.SSSSSSSSSS.', 'SWBBBSSBBBBS', 'SBBBBSYBBBBS', 'SBBBBSYBBBBS', 'SSSSSYYSSSSS', 'SYYYYYYYYYYS', 'SBBBBSYBBBBS', '.SBBBSYBBBS.', '.SBBBSYBBBS.', '..SBBSYBBS..', '...SSSSSS...', '.....SS.....'],
    ['.SSSSSSSSSS.', 'SBBBBSSBBBBS', 'SBBBBSYBBBBS', 'SBBBBSYBBBBS', 'SSSSSYYSSSSS', 'SYYYYWYYYYYS', 'SBBBBSYBBBBS', '.SBBBSYBBBS.', '.SBBBSYBBBS.', '..SBBSYBBS..', '...SSSSSS...', '.....SS.....'],
    ['.SSSSSSSSSS.', 'SBBBBSSBBBBS', 'SBBBBSYBBBBS', 'SBBBBSYBBBBS', 'SSSSSYYSSSSS', 'SYYYYYYYYYYS', 'SBBBBSYBBBBS', '.SBBBSYBBBS.', '.SBBBSYBBWS.', '..SBBSYBBS..', '...SSSSSS...', '.....SS.....'],
  ]},
  // 寶石：稀有獎勵、Boss 掉落
  gem: { ms: [600, 120, 120, 120], frames: [
    ['............', '...CCCCCC...', '..CWCCCCBC..', '.CWCCCCCCBb.', 'bbbbbbbbbbbb', '.bBBBBBBBBb.', '..bBBBBBBb..', '...bBBBBb...', '....bBBb....', '.....bb.....', '............', '............'],
    ['............', '...CCCCCC...', '..WWCCCCBC..', '.CWCCCCCCBb.', 'bbbbbbbbbbbb', '.bBBBBBBBBb.', '..bBBBBBBb..', '...bBBBBb...', '....bBBb....', '.....bb.....', '............', '............'],
    ['............', '...CCCCCC...', '..CWCCCCBC..', '.CWCCCCCCBb.', 'bbbbbbbbbbbb', '.bBBBBWBBBb.', '..bBBBBBBb..', '...bBBBBb...', '....bBBb....', '.....bb.....', '............', '............'],
    ['............', '...CCCCCC...', '..CWCCCCBC..', '.CWCCCCCCBb.', 'bbbbbbbbbbbb', '.bBBBBBBBBb.', '..bBBBBBBb..', '...bBCBBb...', '....bBBb....', '.....bb.....', '............', '............'],
  ]},
  // 小幽靈：派出小幫手
  ghost: { ms: [300, 300, 300, 300], frames: [
    ['............', '....WWWW....', '..WWWWWWWW..', '.WWWWWWWWWW.', '.WWKWWWKWWW.', '.WWKWWWKWWW.', '.WWWWWWWWWW.', '.WWWWPPWWWW.', '.WWWWWWWWWW.', '.WWWWWWWWWW.', '.WW.WWW.WWW.', '.W...W...W..'],
    ['....WWWW....', '..WWWWWWWW..', '.WWWWWWWWWW.', '.WWKWWWKWWW.', '.WWKWWWKWWW.', '.WWWWWWWWWW.', '.WWWWPPWWWW.', '.WWWWWWWWWW.', '.WWWWWWWWWW.', '.WW.WWW.WWW.', '.W...W...W..', '............'],
    ['.....WWWW...', '...WWWWWWWW.', '..WWWWWWWWWW', '..WWKWWWKWWW', '..WWKWWWKWWW', '..WWWWWWWWWW', '..WWWWPPWWWW', '..WWWWWWWWWW', '..WWWWWWWWWW', '..WW.WWW.WWW', '..W...W...W.', '............'],
    ['............', '.....WWWW...', '...WWWWWWWW.', '..WWWWWWWWWW', '..WWKWWWKWWW', '..WWKWWWKWWW', '..WWWWWWWWWW', '..WWWWPPWWWW', '..WWWWWWWWWW', '..WWWWWWWWWW', '..WW.WWW.WWW', '..W...W...W.'],
  ]},
  // 叉叉：關閉畫面
  close: { ms: [1000], frames: [
    ['.KK......KK.', 'KRRK....KRRK', 'KRRRK..KRRRK', '.KRRRKKRRRK.', '..KRRRRRRK..', '...KRRRRK...', '...KRRRRK...', '..KRRRRRRK..', '.KRRRKKRRRK.', 'KRRRK..KRRRK', 'KRRK....KRRK', '.KK......KK.'],
  ]},
  // 音符：背景音樂播放中（輕輕跳）
  note: { ms: [450, 450], frames: [
    ['....BBBBBBB.', '....BBBBBBB.', '....B.....B.', '....B.....B.', '....B.....B.', '....B.....B.', '....B.....B.', '..CCB...CCB.', '.CCCC..CCCC.', '.CCCC..CCCC.', '..CC....CC..', '............'],
    ['....BBBBBBB.', '....B.....B.', '....B.....B.', '....B.....B.', '....B.....B.', '....B.....B.', '..CCB...CCB.', '.CCCC..CCCC.', '.CCCC..CCCC.', '..CC....CC..', '............', '............'],
  ]},
  // 灰音符加一道紅線：背景音樂關閉
  mute: { ms: [1000], frames: [
    ['....LLLLLLL.', '....LLLLLLL.', '....L....RL.', '....L...R.L.', '....L..R..L.', '....L.R...L.', '....LR....L.', '..LLR...LLL.', '.LLRL..LLLL.', '.LRLL..LLLL.', '.RLL....LL..', 'R...........'],
  ]},
  // 下一首
  next: { ms: [1000], frames: [
    ['............', '............', 'G....G....G.', 'GG...GG...G.', 'GGG..GGG..G.', 'GGGG.GGGG.G.', 'GGGG.GGGG.G.', 'GGG..GGG..G.', 'GG...GG...G.', 'G....G....G.', '............', '............'],
  ]},
  // 金色齒輪：設定
  gear: { ms: [1000], frames: [
    ['.....YY.....', '.YY..YY..YY.', '.YYYYYYYYYY.', '..YWWYYYYY..', '..YWY..YYY..', 'YYYY....YOOO', 'YYYY....OOOO', '..YYY..OOO..', '..YYYYOOOO..', '.YYYYOOOOOO.', '.YY..OO..OO.', '.....OO.....'],
  ]},
  // 鈴鐺：音效（叮噹響）
  setSfx: { ms: [700, 160, 160, 160], frames: [
    ['............', '.....YY.....', '....YYYY....', '...YWYYYY...', '...YWYYYY...', '...YYYYYY...', '..YYYYYYYY..', '..YYYYYYYY..', '.YYYYYYYYYY.', '.OOOOOOOOOO.', '.....OO.....', '............'],
    ['............', '.....YY.....', '....YYYY....', '.C.YWYYYY.C.', '.C.YWYYYY.C.', '.C.YYYYYY.C.', '..YYYYYYYY..', '..YYYYYYYY..', '.YYYYYYYYYY.', '.OOOOOOOOOO.', '....OO......', '............'],
    ['............', '.....YY.....', 'C...YYYY...C', 'C..YWYYYY..C', 'C..YWYYYY..C', 'C..YYYYYY..C', '..YYYYYYYY..', '..YYYYYYYY..', '.YYYYYYYYYY.', '.OOOOOOOOOO.', '......OO....', '............'],
    ['............', '.....YY.....', '....YYYY....', '.C.YWYYYY.C.', '.C.YWYYYY.C.', '.C.YYYYYY.C.', '..YYYYYYYY..', '..YYYYYYYY..', '.YYYYYYYYYY.', '.OOOOOOOOOO.', '....OO......', '............'],
  ]},
  // 循環箭頭：播放方式（光點繞圈）
  setTracks: { ms: [260, 260, 260, 260], frames: [
    ['............', '.......B....', '..CWCCCBB...', '.CCCCCCBBB..', '.CC....BB...', '.CC....B....', '....B....CC.', '...BB....CC.', '..BBBCCCCCC.', '...BBCCCCC..', '....B.......', '............'],
    ['............', '.......B....', '..CCCCCBB...', '.CCCCWCBBB..', '.CC....BB...', '.CC....B....', '....B....CC.', '...BB....CC.', '..BBBCCCCCC.', '...BBCCCCC..', '....B.......', '............'],
    ['............', '.......B....', '..CCCCCBB...', '.CCCCCCBBB..', '.CC....BB...', '.CC....B....', '....B....CC.', '...BB....CC.', '..BBBCCCCCC.', '...BBCCCWC..', '....B.......', '............'],
    ['............', '.......B....', '..CCCCCBB...', '.CCCCCCBBB..', '.CC....BB...', '.CC....B....', '....B....CC.', '...BB....CC.', '..BBBCWCCCC.', '...BBCCCCC..', '....B.......', '............'],
  ]},
  // 兩條交叉的箭頭：隨機播放
  setShuffle: { ms: [260, 260, 260, 260], frames: [
    ['............', '.........B..', 'WCC.....CBB.', 'CCCC...CCBB.', '...CC.CC.B..', '....CCC.....', '....CCC.....', '...CC.CC.B..', 'CCCC...CCBB.', 'CCC.....CBB.', '.........B..', '............'],
    ['............', '.........B..', 'CCC.....CBB.', 'CCCC...CCBB.', '...CW.CC.B..', '....CCC.....', '....CCC.....', '...CC.CC.B..', 'CCCC...CCBB.', 'CCC.....CBB.', '.........B..', '............'],
    ['............', '.........B..', 'CCC.....CBB.', 'CCCC...CCBB.', '...CC.CC.B..', '....CCC.....', '....CCC.....', '...CW.CC.B..', 'CCCC...CCBB.', 'CCC.....CBB.', '.........B..', '............'],
    ['............', '.........B..', 'CCC.....CBB.', 'CCCC...CCBB.', '...CC.CC.B..', '....CCC.....', '....CCC.....', '...CC.CC.B..', 'CCCC...CCBB.', 'CCC.....WBB.', '.........B..', '............'],
  ]},
  // 卷軸自己捲成一捆，閃一下：自動壓縮
  setCompact: { ms: [700, 160, 160, 700], frames: [
    ['............', '.OYYYYYYYYO.', '..TTTTTTTT..', '..TDDDDDDT..', '..TTTTTTTT..', '..TDDDDTTT..', '..TTTTTTTT..', '..TDDDDDDT..', '..TTTTTTTT..', '..TDDDTTTT..', '.OYYYYYYYYO.', '............'],
    ['............', '............', '.OYYYYYYYYO.', '..TTTTTTTT..', '..TDDDDDDT..', '..TTTTTTTT..', '..TDDDDTTT..', '..TTTTTTTT..', '..TDDDDDDT..', '.OYYYYYYYYO.', '............', '............'],
    ['............', '............', '............', '............', '.OYYYYYYYYO.', '..TTTTTTTT..', '..TDDDDDDT..', '.OYYYYYYYYO.', '............', '............', '............', '............'],
    ['............', '..W......W..', '............', '............', '..OYYYYYYO..', '..OYYYYYYO..', '..OYYYYYYO..', '..OYYYYYYO..', '............', '............', '..W......W..', '............'],
  ]},
  // 卷軸上的字：語言（中→A→ア 輪流）
  setLang: { ms: [700, 700, 700], frames: [
    ['............', '.OYYYYYYYYO.', '..TTTTTTTT..', '..TTTTDTTT..', '..TTDDDDDT..', '..TTDTDTDT..', '..TTDDDDDT..', '..TTTTDTTT..', '..TTTTTTTT..', '..TTTTTTTT..', '.OYYYYYYYYO.', '............'],
    ['............', '.OYYYYYYYYO.', '..TTTTTTTT..', '..TTTDDDTT..', '..TTDTTTDT..', '..TTDDDDDT..', '..TTDTTTDT..', '..TTDTTTDT..', '..TTTTTTTT..', '..TTTTTTTT..', '.OYYYYYYYYO.', '............'],
    ['............', '.OYYYYYYYYO.', '..TTTTTTTT..', '..TTDDDDDT..', '..TTTTTTDT..', '..TTTTDDTT..', '..TTTTDTTT..', '..TTTDTTTT..', '..TTTTTTTT..', '..TTTTTTTT..', '.OYYYYYYYYO.', '............'],
  ]},
  // 喇叭：音量（聲波一圈圈出去）
  setVolume: { ms: [500, 250, 250, 500], frames: [
    ['............', '............', '....S.......', '...SS.......', 'SSSSS.......', 'SWSSS.......', 'SSSSS.......', 'SSSSS.......', '...SS.......', '....S.......', '............', '............'],
    ['............', '............', '....S.......', '...SS.......', 'SSSSS.C.....', 'SWSSS..C....', 'SSSSS..C....', 'SSSSS.C.....', '...SS.......', '....S.......', '............', '............'],
    ['............', '............', '....S.......', '...SS...C...', 'SSSSS.C..C..', 'SWSSS..C.C..', 'SSSSS..C.C..', 'SSSSS.C..C..', '...SS...C...', '....S.......', '............', '............'],
    ['............', '............', '....S.....C.', '...SS...C..C', 'SSSSS.C..C.C', 'SWSSS..C.C.C', 'SSSSS..C.C.C', 'SSSSS.C..C.C', '...SS...C..C', '....S.....C.', '............', '............'],
  ]},
  // 慢慢伸縮觸角的蝸牛：減少動畫
  setMotion: { ms: [900, 700], frames: [
    ['............', '............', '.W.W..OOOO..', '.N.N.OYYYYO.', '.NNN.OYOOYO.', '.NNN.OYOYYO.', '.NNN.OOYYYO.', '.NNNNNOOOON.', '.NNNNNNNNNN.', '..nnnnnnnnn.', '............', '............'],
    ['............', '............', '......OOOO..', '.W.W.OYYYYO.', '.NNN.OYOOYO.', '.NNN.OYOYYO.', '.NNN.OOYYYO.', '.NNNNNOOOO..', '.NNNNNNNNN..', '..nnnnnnnn..', '............', '............'],
  ]},
}

const toGlyph = (art: string[]): Glyph => ({
  w: 12,
  rows: art.map(line => [...line].reduce((bits, c) => (bits << 1) | (c === '.' ? 0 : 1), 0)),
  paint: art.map(line => [...line].map(c => PALETTE[c] ?? -1)),
})

type Anim = { frames: Glyph[]; ms: number[]; cycle: number }
const ANIMS = new Map<number, Anim>((Object.keys(ART) as IconName[]).map(name => {
  const { ms, frames } = ART[name]
  return [ICON[name].codePointAt(0)!, { frames: frames.map(toGlyph), ms, cycle: ms.reduce((a, b) => a + b, 0) }]
}))

// The frame showing at `t` (milliseconds; any clock: only its remainder over the cycle matters).
export function iconGlyph(code: number, t = 0): Glyph | undefined {
  const a = ANIMS.get(code)
  if (!a) return undefined
  let left = ((t % a.cycle) + a.cycle) % a.cycle
  for (let i = 0; i < a.frames.length; i++) {
    left -= a.ms[i]!
    if (left < 0) return a.frames[i]
  }
  return a.frames[0]
}

export const isIcon = (code: number) => ANIMS.has(code)
