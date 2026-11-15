/**
 * Hand-authored portraits for named players (Blue Lock cast, master strikers and well-known stars).
 * Field meanings are the creator's options (see LOOK_OPTIONS): hair style index, fringe, eye shape and
 * colour, brows, mouth, face shape, skin tone, facial hair, accessories. Everyone else gets a generated face.
 */
import type { Appearance, Player } from '../types';
import { lookFor } from '../career';

type L = Partial<Appearance>;
export const LOOKS: Record<string, L> = {
  // ── Blue Lock
  'Yoichi Isagi': { hair: 0, hairHex: '#1b2236', fringe: 5, eyes: 2, eyeCol: 2, brows: 0, mouth: 1, skin: 1, face: 0, nose: 0 },
  'Meguru Bachira': { hair: 3, hairHex: '#16161c', hair2: 2, fringe: 1, eyes: 0, eyeCol: 6, mouth: 3, skin: 1, face: 0 },
  'Rensuke Kunigami': { hair: 18, hairHex: '#e8742a', fringe: 7, eyes: 4, eyeCol: 11, brows: 3, mouth: 1, skin: 2, face: 3 },
  'Hyoma Chigiri': { hair: 2, hairHex: '#c23a52', fringe: 6, eyes: 3, eyeCol: 9, brows: 4, mouth: 4, skin: 0, face: 2 },
  'Seishiro Nagi': { hair: 21, hairHex: '#e9e9ef', fringe: 5, eyes: 5, eyeCol: 4, brows: 0, mouth: 1, skin: 0, face: 2 },
  'Reo Mikage': { hair: 11, hairHex: '#6c3fa3', fringe: 3, eyes: 3, eyeCol: 7, brows: 4, mouth: 4, skin: 1, face: 4 },
  'Rin Itoshi': { hair: 0, hairHex: '#1d3436', fringe: 6, eyes: 5, eyeCol: 3, brows: 1, mouth: 1, skin: 0, face: 4 },
  'Shoei Barou': { hair: 14, hairHex: '#111111', fringe: 4, eyes: 6, eyeCol: 5, brows: 1, mouth: 2, skin: 3, face: 3 },
  'Ryusei Shidou': { hair: 6, hairHex: '#ff6fa5', eyes: 6, eyeCol: 5, brows: 1, mouth: 3, skin: 1, face: 4 },
  'Gin Gagamaru': { hair: 5, hairHex: '#1a1a1a', eyes: 0, eyeCol: 0, brows: 3, mouth: 1, skin: 6, face: 1, ears: 2 },
  'Jingo Raichi': { hair: 1, hairHex: '#1a1a1a', eyes: 6, eyeCol: 1, brows: 1, mouth: 3, skin: 2, face: 3 },
  'Aoshi Tokimitsu': { hair: 2, hairHex: '#283a63', fringe: 1, eyes: 5, eyeCol: 3, brows: 4, mouth: 2, skin: 0, face: 2 },
  'Yo Hiori': { hair: 11, hairHex: '#8ecae6', fringe: 3, eyes: 5, eyeCol: 8, brows: 0, mouth: 1, skin: 0, face: 2 },
  'Kenyu Yukimiya': { hair: 0, hairHex: '#8a6a4a', fringe: 2, eyes: 3, eyeCol: 1, acc: 2, mouth: 0, skin: 1, face: 0 },
  'Ranze Kurona': { hair: 1, hairHex: '#b9314f', eyes: 4, eyeCol: 5, mouth: 3, brows: 1, skin: 1, face: 4 },
  'Eita Otoya': { hair: 12, hairHex: '#1f2a4f', eyes: 3, eyeCol: 3, mouth: 4, brows: 4, skin: 1, face: 2 },
  'Tabito Karasu': { hair: 11, hairHex: '#111111', fringe: 3, eyes: 1, eyeCol: 0, mouth: 4, brows: 1, skin: 1, face: 4 },
  'Oliver Aiku': { hair: 21, hairHex: '#16161a', eyes: 1, eyeCol: 1, acc: 4, mouth: 4, brows: 0, skin: 2, beard: 1, face: 3 },
  'Ikki Niko': { hair: 0, hairHex: '#2b2b33', fringe: 6, eyes: 5, eyeCol: 0, mouth: 1, skin: 1, face: 2 },
  'Tsurugi Zantetsu': { hair: 1, hairHex: '#c79a3a', eyes: 2, eyeCol: 6, mouth: 3, brows: 2, skin: 1 },
  'Gurimu Igaguri': { hair: 5, hairHex: '#2a2a2a', eyes: 0, eyeCol: 0, mouth: 3, brows: 3, skin: 2, face: 1 },
  'Jin Kiyora': { hair: 0, hairHex: '#3a2a1d', fringe: 2, eyes: 3, eyeCol: 1, mouth: 0, skin: 1 },
  'Wataru Kuon': { hair: 0, hairHex: '#1c1c22', fringe: 6, eyes: 4, eyeCol: 0, mouth: 1, brows: 0, skin: 1 },
  'Yudai Imamura': { hair: 1, hairHex: '#4a3220', eyes: 0, eyeCol: 1, mouth: 3, skin: 1 },
  'Teru Kitsunezato': { hair: 11, hairHex: '#d8b26a', eyes: 1, eyeCol: 6, mouth: 4, skin: 0 },
  'Kyohei Himizu': { hair: 0, hairHex: '#2a2f3a', fringe: 1, eyes: 5, eyeCol: 4, mouth: 1, skin: 0 },
  'Ryosuke Kira': { hair: 8, hairHex: '#d9b26a', eyes: 2, eyeCol: 1, mouth: 0, skin: 0 },
  'Jyubei Aryu': { hair: 2, hairHex: '#111111', fringe: 3, eyes: 3, eyeCol: 0, mouth: 4, brows: 4, skin: 0, face: 2 },
  'Shuto Sendou': { hair: 1, hairHex: '#d98b2b', eyes: 6, eyeCol: 6, mouth: 3, skin: 1 },
  'Nijiro Nanase': { hair: 3, hairHex: '#e6b9c8', eyes: 2, eyeCol: 9, mouth: 0, skin: 0 },
  // ── the world's best (Blue Lock canon) and the master strikers
  'Michael Kaiser': { hair: 19, hairHex: '#efd27c', hair2: 4, fringe: 6, eyes: 4, eyeCol: 2, brows: 2, mouth: 4, skin: 0, face: 4 },
  'Alexis Ness': { hair: 0, hairHex: '#b8a4e3', fringe: 6, eyes: 0, eyeCol: 7, brows: 4, mouth: 0, skin: 0, face: 2 },
  'Noel Noa': { hair: 17, hairHex: '#20232b', eyes: 4, eyeCol: 4, beard: 1, brows: 0, mouth: 1, skin: 1, face: 3 },
  'Charles Chevalier': { hair: 20, hairHex: '#f1e6c8', eyes: 2, eyeCol: 8, brows: 4, mouth: 3, skin: 0, face: 2 },
  'Don Lorenzo': { hair: 16, hairHex: '#1d1612', eyes: 5, eyeCol: 1, mouth: 3, brows: 0, skin: 6, face: 4 },
  'Julian Loki': { hair: 4, hairHex: '#f0f0f2', eyes: 4, eyeCol: 6, mouth: 1, brows: 0, skin: 4, face: 2 },
  'Lavinho': { hair: 13, hairHex: '#1b1410', eyes: 2, eyeCol: 1, mouth: 3, skin: 6, face: 0 },
  'Chris Prince': { hair: 8, hairHex: '#e8c766', eyes: 2, eyeCol: 2, mouth: 0, brows: 2, skin: 0, face: 3 },
  'Marc Snuffy': { hair: 2, hairHex: '#2b2b2b', fringe: 3, eyes: 5, eyeCol: 1, beard: 1, mouth: 1, skin: 2, face: 3 },
  'Erik Gesner': { hair: 18, hairHex: '#c9a35a', eyes: 4, eyeCol: 2, mouth: 4, skin: 0 },
  'Bunny Iglesias': { hair: 7, hairHex: '#3a2a1d', eyes: 0, eyeCol: 1, mouth: 3, skin: 3 },
  // ── well-known professionals (broad strokes only)
  'Erling Haaland': { hair: 17, hairHex: '#e6c77a', skin: 8, eyes: 0, eyeCol: 2, face: 3, brows: 0, mouth: 1 },
  'Kylian Mbappé': { hair: 5, hairHex: '#1a1410', skin: 6, eyes: 0, eyeCol: 1, mouth: 0, face: 0 },
  'Jude Bellingham': { hair: 5, hairHex: '#1a1410', skin: 5, eyeCol: 1, face: 3, mouth: 4 },
  'Lamine Yamal': { hair: 7, hairHex: '#141010', skin: 4, eyeCol: 1, face: 0, mouth: 0 },
  'Vinícius Júnior': { hair: 16, hairHex: '#141010', skin: 7, eyeCol: 1, mouth: 3 },
  'Mohamed Salah': { hair: 13, hairHex: '#1a1410', skin: 5, beard: 3, eyeCol: 1, mouth: 0 },
  'Kevin De Bruyne': { hair: 0, hairHex: '#c98a4b', skin: 8, eyeCol: 2, mark: 2, mouth: 1 },
  'Harry Kane': { hair: 14, hairHex: '#7a5a3a', skin: 1, eyeCol: 2, mouth: 0 },
  'Bukayo Saka': { hair: 5, hairHex: '#141010', skin: 7, eyeCol: 1, mouth: 0 },
  'Phil Foden': { hair: 5, hairHex: '#c9a46a', skin: 8, eyeCol: 2, mouth: 1 },
  'Pedri': { hair: 0, hairHex: '#2a1d14', skin: 2, eyeCol: 1, fringe: 5, mouth: 0 },
  'Rodri': { hair: 0, hairHex: '#3a2a1d', skin: 2, beard: 1, eyeCol: 1, mouth: 1 },
  'Florian Wirtz': { hair: 0, hairHex: '#6a4a2e', skin: 1, eyeCol: 1, fringe: 2, mouth: 0 },
  'Jamal Musiala': { hair: 7, hairHex: '#1a1410', skin: 5, eyeCol: 1, mouth: 0 },
  'Federico Valverde': { hair: 0, hairHex: '#2a1d14', skin: 2, beard: 1, eyeCol: 1 },
  'Alexander Isak': { hair: 7, hairHex: '#141010', skin: 7, eyeCol: 1 },
  'Lautaro Martínez': { hair: 14, hairHex: '#1a1410', skin: 3, beard: 3, eyeCol: 1 },
  'Martin Ødegaard': { hair: 8, hairHex: '#7a5a3a', skin: 0, eyeCol: 2, mouth: 0 },
  'Declan Rice': { hair: 5, hairHex: '#5a4030', skin: 1, eyeCol: 2 },
  'Virgil van Dijk': { hair: 5, hairHex: '#141010', skin: 6, beard: 3, eyeCol: 1, face: 3 },
  'Bruno Fernandes': { hair: 0, hairHex: '#2a1d14', skin: 2, beard: 1, eyeCol: 1 },
  'Ousmane Dembélé': { hair: 7, hairHex: '#141010', skin: 7, eyeCol: 1, mouth: 0 },
  'Achraf Hakimi': { hair: 18, hairHex: '#1a1410', skin: 4, beard: 1, eyeCol: 1 },
  'Gianluigi Donnarumma': { hair: 5, hairHex: '#1a1410', skin: 2, beard: 3, eyeCol: 1 },
  'Thibaut Courtois': { hair: 0, hairHex: '#2a1d14', skin: 1, beard: 1, eyeCol: 1 },
  'Alisson': { hair: 14, hairHex: '#2a1d14', skin: 2, beard: 3, eyeCol: 2 },
  'Désiré Doué': { hair: 7, hairHex: '#141010', skin: 7, eyeCol: 1, mouth: 0 },
  'Rafael Leão': { hair: 16, hairHex: '#141010', skin: 6, eyeCol: 1, mouth: 0 },
  'Nico Williams': { hair: 7, hairHex: '#141010', skin: 7, eyeCol: 1, mouth: 3 },
  'Cole Palmer': { hair: 7, hairHex: '#1a1410', skin: 4, eyeCol: 1, mouth: 1 },
  'Khvicha Kvaratskhelia': { hair: 21, hairHex: '#2a1d14', skin: 1, eyeCol: 1, mouth: 1 },
  'William Saliba': { hair: 5, hairHex: '#141010', skin: 7, eyeCol: 1 },
  'Rúben Dias': { hair: 0, hairHex: '#1a1410', skin: 3, beard: 3, eyeCol: 1 },
  'Victor Osimhen': { hair: 6, hairHex: '#e6c77a', skin: 7, acc: 8, eyeCol: 1 },
  'Mike Maignan': { hair: 5, hairHex: '#141010', skin: 7, beard: 3, eyeCol: 1 },
  'Joško Gvardiol': { hair: 5, hairHex: '#3a2a1d', skin: 0, beard: 2, eyeCol: 2 },
  'Cristiano Ronaldo': { hair: 18, hairHex: '#1a1410', skin: 3, eyeCol: 1, brows: 4, mouth: 0 },
  'Robert Lewandowski': { hair: 0, hairHex: '#5a4030', skin: 1, eyeCol: 2, fringe: 7 },
};
/** The portrait for a player: hand-made where one exists, generated otherwise. */
export function lookOf(p: Pick<Player, 'id' | 'name'>): Appearance {
  const o = LOOKS[p.name];
  return o ? { ...lookFor(p.id), ...o } : lookFor(p.id);
}
export const hasLook = (name: string) => !!LOOKS[name];
