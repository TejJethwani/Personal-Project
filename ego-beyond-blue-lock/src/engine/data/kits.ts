/**
 * Kits and crests. Patterns follow each club's well-known kit style (stripes, hoops, sash…) with the
 * club's own colours; crests are original designs generated from the club's colours and identity —
 * never copies of real badges. National teams use their traditional shirt colours.
 */
import { hashStr } from '../rng';

export type KitPat = 'plain' | 'stripes' | 'hoops' | 'halves' | 'sash' | 'band' | 'chestband' | 'sleeves' | 'checks' | 'pinstripes' | 'thirds';
export interface Kit { c1: string; c2: string; c3?: string; pat: KitPat }

/** Known kit styles by club short code (the part after the league prefix). */
const CLUB_PAT: Record<string, KitPat | [KitPat, string?, string?]> = {
  // England
  ars: 'sleeves', avl: ['sleeves', '#95bfe5'], whu: ['sleeves', '#1bb1e7'], bur: ['sleeves', '#99d6ea'], new: ['stripes', '#ffffff', '#111111'], bre: 'stripes', sun: 'stripes',
  cry: ['stripes', '#c4122e', '#1b458f'], bha: 'stripes', shu: 'stripes', stk: 'stripes', shw: 'stripes', qpr: 'hoops', bla: 'halves', bri: 'plain', wba: 'stripes', lin: 'stripes', exe: 'stripes',
  ful: 'plain', tot: 'plain', che: 'plain', liv: 'plain', mun: 'plain', eve: 'plain', wol: 'plain', bou: 'stripes', ips: 'plain', lei: 'plain', nor: 'plain', mid: 'chestband', sou: 'stripes', wat: 'plain',
  // Spain
  ath: 'stripes', atm: 'stripes', bet: 'stripes', esp: 'stripes', gir: 'stripes', ray: 'sash', spg: 'stripes', dep: 'stripes', zar: 'plain', lev: 'stripes', osa: 'plain', rso: 'stripes',
  barcha: ['stripes', '#a50044', '#004d98'], rma: 'plain', sev: 'plain', val: 'plain', vil: 'plain', alm: 'stripes', lpa: 'plain', mlg: 'stripes', gra: 'hoops',
  // Germany
  bastard: ['chestband', '#dc052d', '#ffffff'], bvb: 'plain', vfb: 'chestband', sge: 'plain', hsv: 'plain', koe: 'plain', svw: 'plain', s04: 'plain', aug: 'stripes', rbl: 'plain', fcu: 'plain', m05: 'plain', wob: 'plain', fcn: 'plain', f95: 'chestband',
  // Italy
  ubers: ['stripes', '#f4f4f4', '#111111'], int: ['stripes', '#010e80', '#111111'], mil: ['stripes', '#fb090b', '#111111'], ata: ['stripes', '#1e71b8', '#111111'], udi: 'stripes', gen: 'halves', cag: 'halves', par: 'chestband',
  bol: 'stripes', lec: 'stripes', sas: 'stripes', ven: 'plain', pal: 'plain', sam: 'hoops', cre: 'stripes', ver: 'plain', rom: 'plain', laz: 'plain', nap: 'plain', fio: 'plain', tor: 'plain', com: 'plain', pis: 'stripes', spe: 'plain',
  // France
  pxg: ['band', '#004170', '#da291c'], nic: 'stripes', len: 'plain', lil: 'plain', mar: 'plain', lyo: 'band', mon: 'halves', nan: 'plain', ren: 'chestband', str: 'plain', tou: 'plain', hac: 'halves', bst: 'plain', aux: 'plain', ang: 'stripes', lor: 'plain', met: 'plain', ste: 'plain', mhp: 'plain', bas: 'plain', gui: 'stripes',
  // Netherlands
  aja: 'band', psv: 'stripes', fey: 'halves', az: 'plain', twe: 'plain', utr: 'plain', gae: 'halves', nec: 'thirds', hee: 'sash', spa: 'plain', gro: 'plain', pec: 'plain', her: 'stripes', nac: 'plain', vit: 'stripes', ado: 'plain', exc: 'stripes',
  // Portugal
  bluelock: ['plain', '#0c1a33', '#1ea7ff'], japanu20: ['plain', '#f4f4f4', '#1d3c8f'], newgen: ['sash', '#111111', '#ffd166'], world: ['band', '#f4f4f4', '#d4af37'], masters: ['chestband', '#3a0b2e', '#ffd166'],
  ben: 'plain', fcp: ['stripes', '#0057b8', '#ffffff'], scp: ['hoops', '#00843d', '#ffffff'], bra: 'sleeves', vsc: 'plain', boa: 'checks', mrt: 'stripes', rio: 'stripes', aro: 'stripes', gil: 'halves',
};

/** National team shirts: [shirt, trim, pattern?]. */
const NAT: Record<string, [string, string, KitPat?]> = {
  JPN: ['#1d3c8f', '#ffffff'], KOR: ['#d4202c', '#111a3a'], AUS: ['#f7c600', '#00553e'], IRN: ['#f4f4f4', '#d10b14'], KSA: ['#f4f4f4', '#006c35'], QAT: ['#7a1e3a', '#ffffff'], UZB: ['#f4f4f4', '#1d4fa0'], JOR: ['#f4f4f4', '#ce1126'], IRQ: ['#f4f4f4', '#007a3d'],
  CHN: ['#d52b1e', '#ffde00'], IND: ['#1a4fa0', '#f28c28'], PAK: ['#01411c', '#ffffff'], BAN: ['#006a4e', '#f42a41'], THA: ['#1d3c8f', '#d4202c'], VIE: ['#d4202c', '#ffde00'], IDN: ['#d4202c', '#ffffff'], UAE: ['#f4f4f4', '#00732f'], SYR: ['#d4202c', '#ffffff'], OMA: ['#d4202c', '#ffffff'], BHR: ['#d4202c', '#ffffff'], PLE: ['#f4f4f4', '#007a3d'], LBN: ['#d4202c', '#ffffff'], PRK: ['#d4202c', '#ffffff'], MAS: ['#ffde00', '#111111'], PHI: ['#1d3c8f', '#d4202c'], NEP: ['#d4202c', '#1d3c8f'], SRI: ['#1d3c8f', '#f7c600'], AFG: ['#d4202c', '#111111'],
  ENG: ['#f4f4f4', '#0b1f4d'], ESP: ['#c60b1e', '#ffc400'], GER: ['#f4f4f4', '#111111'], ITA: ['#1f5fbf', '#ffffff'], FRA: ['#21304d', '#ffffff'], POR: ['#c8102e', '#00602a'], NED: ['#f36c21', '#ffffff'], BEL: ['#c8102e', '#f6c800'], CRO: ['#d4202c', '#ffffff', 'checks'],
  SUI: ['#d4202c', '#ffffff'], AUT: ['#d4202c', '#ffffff'], DEN: ['#c8102e', '#ffffff'], SWE: ['#ffcd00', '#0058a3'], NOR: ['#d4202c', '#00205b'], POL: ['#f4f4f4', '#dc143c'], SRB: ['#c6363c', '#ffffff'], TUR: ['#e30a17', '#ffffff'], SCO: ['#0b1f4d', '#ffffff'], WAL: ['#d4202c', '#00b140'], IRL: ['#169b62', '#ffffff'],
  UKR: ['#ffd500', '#005bbb'], CZE: ['#d4202c', '#ffffff'], HUN: ['#c8102e', '#ffffff'], GRE: ['#f4f4f4', '#0d5eaf'], SVK: ['#f4f4f4', '#0b4ea2'], SVN: ['#f4f4f4', '#0b4ea2'], ROU: ['#fcd116', '#002b7f'], ALB: ['#d4202c', '#111111'], GEO: ['#f4f4f4', '#d4202c'], ISL: ['#003897', '#d72828'], FIN: ['#f4f4f4', '#002f6c'],
  BIH: ['#002395', '#fecb00'], MNE: ['#d4202c', '#c5a000'], NIR: ['#00843d', '#ffffff'], ISR: ['#f4f4f4', '#0038b8'], RUS: ['#f4f4f4', '#d52b1e'], BUL: ['#f4f4f4', '#00966e'], KOS: ['#244aa5', '#d0a650'], MKD: ['#d4202c', '#f8e92e'], ARM: ['#d4202c', '#0033a0'],
  BRA: ['#ffdc02', '#0a3d8f'], ARG: ['#74acdf', '#ffffff', 'stripes'], URU: ['#5cbfeb', '#111111'], COL: ['#fcd116', '#003893'], ECU: ['#ffd100', '#034ea2'], PAR: ['#d4202c', '#ffffff', 'stripes'], CHI: ['#d52b1e', '#0039a6'], VEN: ['#8a1e3a', '#ffffff'], PER: ['#f4f4f4', '#d91023', 'sash'], BOL: ['#007934', '#ffffff'],
  NGA: ['#008751', '#ffffff'], SEN: ['#f4f4f4', '#00853f'], GHA: ['#f4f4f4', '#111111'], CIV: ['#f77f00', '#009e60'], MAR: ['#c1272d', '#006233'], EGY: ['#c8102e', '#ffffff'], CMR: ['#007a5e', '#ce1126'], ALG: ['#f4f4f4', '#006233'], MLI: ['#fcd116', '#14b53a'], TUN: ['#e70013', '#ffffff'],
  COD: ['#007fff', '#f7d618'], GUI: ['#ce1126', '#fcd116'], BFA: ['#009e49', '#ef2b2d'], GAB: ['#fcd116', '#009e60'], CPV: ['#003893', '#cf2027'], ANG: ['#cc092f', '#111111'], RSA: ['#ffb612', '#007a4d'], ZAM: ['#198a00', '#ef7d00'], KEN: ['#bb0000', '#006600'], UGA: ['#fcdc04', '#d90000'],
  USA: ['#f4f4f4', '#0a3161'], MEX: ['#006847', '#ffffff'], CAN: ['#d80621', '#ffffff'], JAM: ['#fed100', '#009b3a'], CRC: ['#ce1126', '#002b7f'], PAN: ['#d21034', '#ffffff'], HON: ['#f4f4f4', '#0073cf'], SLV: ['#0f47af', '#ffffff'], HAI: ['#00209f', '#d21034'], TRI: ['#ce1126', '#111111'],
  NZL: ['#f4f4f4', '#111111'], FIJ: ['#f4f4f4', '#68bfe5'],
};
const NAT_FALLBACK = ['#1e6bd6', '#d62828', '#f4f4f4', '#2a9d8f', '#f4a261', '#6a4c93', '#111111', '#ffd60a', '#0b6e4f', '#8a1e3a'];

export function nationKit(id: string): Kit {
  const n = NAT[id];
  if (n) return { c1: n[0], c2: n[1], pat: n[2] ?? 'plain' };
  const h = hashStr(id);
  const c1 = NAT_FALLBACK[h % NAT_FALLBACK.length];
  let c2 = NAT_FALLBACK[(h >> 4) % NAT_FALLBACK.length];
  if (c2 === c1) c2 = c1 === '#f4f4f4' ? '#111111' : '#f4f4f4';
  return { c1, c2, pat: 'plain' };
}
/** The kit of a club (id like "esp1_barcha" or "nel_barcha") given its two colours. */
export function clubKit(id: string, col: [string, string] | string[]): Kit {
  id = id ?? '';
  const short = id.includes('_') ? id.slice(id.indexOf('_') + 1) : id;
  const o = CLUB_PAT[short];
  const h = hashStr(id);
  if (o) { const [pat, a, b] = Array.isArray(o) ? o : [o]; return { c1: a ?? col[0], c2: b ?? col[1], pat }; }
  const r = h % 100;
  return { c1: col[0], c2: col[1], pat: r < 62 ? 'plain' : r < 74 ? 'sleeves' : r < 84 ? 'stripes' : r < 90 ? 'chestband' : r < 95 ? 'hoops' : 'halves' };
}

export type CrestShape = 'shield' | 'round' | 'pointed' | 'hex' | 'diamond' | 'banner';
export type CrestField = 'plain' | 'stripes' | 'halves' | 'quarters' | 'chevron' | 'sash' | 'ring' | 'cross';
export type CrestIcon = 'star' | 'ball' | 'crown' | 'wings' | 'tower' | 'flame' | 'wave' | 'bolt' | 'anchor' | 'leaf' | 'sun' | 'eye' | 'lock';
export interface Crest { shape: CrestShape; field: CrestField; icon: CrestIcon; stars: number; c1: string; c2: string; c3: string; text: string }
const SHAPES: CrestShape[] = ['shield', 'round', 'pointed', 'shield', 'hex', 'diamond', 'banner', 'round'];
const FIELDS: CrestField[] = ['plain', 'stripes', 'halves', 'quarters', 'chevron', 'sash', 'ring', 'cross', 'plain', 'stripes'];
const ICONS: CrestIcon[] = ['star', 'ball', 'crown', 'wings', 'tower', 'flame', 'wave', 'bolt', 'anchor', 'leaf', 'sun', 'eye'];
/** Hand-picked identities for the Blue Lock clubs and a few classic clubs (still original designs). */
const CREST_OVR: Record<string, Partial<Crest>> = {
  bluelock: { shape: 'pointed', field: 'plain', icon: 'lock' }, world: { shape: 'round', field: 'ring', icon: 'star', stars: 3 }, newgen: { shape: 'banner', field: 'sash', icon: 'bolt' }, japanu20: { shape: 'shield', field: 'plain', icon: 'sun' }, masters: { shape: 'diamond', field: 'plain', icon: 'crown' },
  bastard: { shape: 'round', field: 'ring', icon: 'eye', stars: 0 }, barcha: { shape: 'pointed', field: 'quarters', icon: 'ball' }, manshine: { shape: 'round', field: 'ring', icon: 'sun' },
  ubers: { shape: 'shield', field: 'stripes', icon: 'bolt' }, pxg: { shape: 'round', field: 'ring', icon: 'tower' }, rma: { shape: 'round', field: 'ring', icon: 'crown' },
  liv: { shape: 'shield', field: 'plain', icon: 'flame' }, mun: { shape: 'round', field: 'ring', icon: 'flame' }, ars: { shape: 'shield', field: 'plain', icon: 'bolt' }, che: { shape: 'round', field: 'ring', icon: 'crown' },
  int: { shape: 'round', field: 'ring', icon: 'wave' }, mil: { shape: 'diamond', field: 'stripes', icon: 'star' }, bvb: { shape: 'round', field: 'ring', icon: 'bolt' }, ben: { shape: 'shield', field: 'plain', icon: 'wings' },
  fcp: { shape: 'shield', field: 'quarters', icon: 'tower' }, scp: { shape: 'pointed', field: 'stripes', icon: 'leaf' }, aja: { shape: 'round', field: 'ring', icon: 'star' }, psv: { shape: 'round', field: 'ring', icon: 'flame' },
  atm: { shape: 'shield', field: 'stripes', icon: 'star' }, ath: { shape: 'pointed', field: 'stripes', icon: 'tower' }, nap: { shape: 'round', field: 'ring', icon: 'wave' }, rom: { shape: 'shield', field: 'halves', icon: 'wings' },
  laz: { shape: 'shield', field: 'plain', icon: 'wings' }, mar: { shape: 'shield', field: 'plain', icon: 'star', stars: 1 }, mon: { shape: 'diamond', field: 'halves', icon: 'crown' },
};
export function crestOf(id: string, col: string[], abbr: string, nation = false): Crest {
  const h = hashStr(id + ':crest');
  const short = id.includes('_') ? id.slice(id.indexOf('_') + 1) : id;
  const light = (hex: string) => { const v = parseInt(hex.slice(1), 16); return ((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11 > 170; };
  const c1 = col[0], c2 = col[1] && col[1] !== col[0] ? col[1] : light(col[0]) ? '#111111' : '#ffffff';
  const base: Crest = nation
    ? { shape: 'shield', field: (['halves', 'stripes', 'plain', 'sash'] as CrestField[])[h % 4], icon: 'star', stars: 0, c1, c2, c3: light(c1) && light(c2) ? '#111111' : '#ffd166', text: abbr }
    : { shape: SHAPES[h % SHAPES.length], field: FIELDS[(h >>> 3) % FIELDS.length], icon: ICONS[(h >>> 7) % ICONS.length], stars: (h >>> 11) % 5 === 0 ? 1 + ((h >>> 13) % 3) : 0, c1, c2, c3: '#ffd166', text: abbr };
  return { ...base, ...(CREST_OVR[short] ?? {}) };
}

/** Paint a kit pattern into a rectangle on a canvas (the caller sets the clip and the base colour). */
export function paintKit(ctx: CanvasRenderingContext2D, k: Kit, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = k.c2;
  switch (k.pat) {
    case 'stripes': for (let i = 1; i < 7; i += 2) ctx.fillRect(x + (i * w) / 7, y, w / 7, h); break;
    case 'pinstripes': ctx.globalAlpha *= 0.8; for (let i = 1; i < 12; i++) ctx.fillRect(x + (i * w) / 12 - w / 80, y, w / 40, h); ctx.globalAlpha /= 0.8; break;
    case 'hoops': for (let i = 1; i < 6; i += 2) ctx.fillRect(x, y + (i * h) / 6, w, h / 6); break;
    case 'halves': ctx.fillRect(x + w / 2, y, w / 2, h); break;
    case 'thirds': ctx.fillRect(x + w / 3, y, w / 3, h); break;
    case 'band': ctx.fillRect(x + w * 0.38, y, w * 0.24, h); break;
    case 'chestband': ctx.fillRect(x, y + h * 0.22, w, h * 0.2); break;
    case 'sash': ctx.beginPath(); ctx.moveTo(x, y + h * 0.05); ctx.lineTo(x + w * 0.28, y); ctx.lineTo(x + w, y + h * 0.95); ctx.lineTo(x + w * 0.72, y + h); ctx.closePath(); ctx.fill(); break;
    case 'checks': { const n = 4; for (let i = 0; i < n; i++) for (let j = 0; j < n + 1; j++) if ((i + j) % 2) ctx.fillRect(x + (i * w) / n, y + (j * h) / (n + 1), w / n, h / (n + 1)); break; }
    default: break;
  }
}

const rgb = (hex: string): [number, number, number] => { const m = /^#?([0-9a-f]{6})$/i.exec(hex); const v = m ? parseInt(m[1], 16) : 0x808080; return [v >> 16, (v >> 8) & 255, v & 255]; };
const dist = (a: string, b: string) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
/** Home and away kits for a match: when the shirts clash, the away side changes to its second kit. */
export function matchKits(home: Kit, away: Kit): [Kit, Kit] {
  if (dist(home.c1, away.c1) > 140) return [home, away];
  // second kit: the club's other colour as the shirt, or white / navy when that clashes too
  let c1 = away.c2;
  if (dist(c1, home.c1) < 140) c1 = dist('#f4f4f4', home.c1) > 160 ? '#f4f4f4' : '#14213d';
  const c2 = dist(away.c1, c1) > 90 ? away.c1 : c1 === '#f4f4f4' ? '#14213d' : '#f4f4f4';
  return [home, { c1, c2, pat: away.pat === 'stripes' || away.pat === 'hoops' ? away.pat : 'plain' }];
}
