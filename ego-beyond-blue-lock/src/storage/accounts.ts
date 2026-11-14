/**
 * Local accounts. The game has no server, so accounts live in this browser's storage:
 * a username with a salted SHA-256 password hash. Signing in scopes the save slots to that
 * account. This keeps several people's careers apart on a shared device; it is not a
 * security boundary (anyone with access to the browser profile can read its storage).
 *
 * One built-in administrator account exists (only its hash is stored in the code).
 */
const KEY = 'ego-accounts-v1';
const ADMIN_USER = 'Adm!n';
const ADMIN_HASH = '6869fe29ed025805295b46152ced80e175362c5051a2a54a202e672247d7b92d';
interface Rec { salt: string; hash: string; created: string }
interface Store { users: Record<string, Rec>; current: string | null }
let mem: Store = { users: {}, current: null };
let admin = false;
const subs = new Set<() => void>();

function read(): Store {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw) as Store; if (s && typeof s.users === 'object') mem = { users: s.users, current: s.current ?? null }; } } catch { /* storage unavailable: memory only */ }
  return mem;
}
function write(): void { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* memory only */ } for (const f of subs) f(); }
/** SHA-256 in plain JavaScript, so hashing works identically everywhere (including contexts without WebCrypto). */
function sha256(text: string): string {
  const K: number[] = [];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  for (let n = 2, k = 0; k < 64; n++) { let prime = true; for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; } if (prime) K[k++] = (Math.cbrt(n) * 4294967296) >>> 0; }
  const bytes = Array.from(new TextEncoder().encode(text));
  const bits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (bits >>> (i * 8)) & 255);
  const w = new Array<number>(64);
  for (let o = 0; o < bytes.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = ((bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3]) >>> 0;
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3); const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0; H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map((x) => x.toString(16).padStart(8, '0')).join('');
}
async function sha(text: string): Promise<string> { return sha256(text); }
export const _sha256 = sha256;
const norm = (u: string) => u.trim().toLowerCase();

read();
export function onAccountChange(f: () => void): () => void { subs.add(f); return () => { subs.delete(f); }; }
/** The signed-in username, or null for a guest. */
export function currentUser(): string | null { return admin ? ADMIN_USER : mem.current && mem.users[mem.current] ? mem.current : null; }
export function isAdmin(): boolean { return admin; }
export function listAccounts(): { name: string; created: string }[] { return Object.entries(mem.users).map(([name, r]) => ({ name, created: r.created })).sort((a, b) => a.name.localeCompare(b.name)); }

export async function signUp(username: string, password: string): Promise<string | null> {
  const u = norm(username);
  if (!/^[a-z0-9_.-]{3,20}$/.test(u)) return 'Usernames are 3–20 characters: letters, numbers, dot, dash or underscore.';
  if (u === norm(ADMIN_USER) || u === 'admin') return 'That username is reserved.';
  if (password.length < 4) return 'Choose a password of at least 4 characters.';
  if (mem.users[u]) return 'That username is already taken on this device.';
  const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
  mem.users[u] = { salt, hash: await sha(salt + ':' + password), created: new Date().toISOString() };
  mem.current = u; admin = false;
  write();
  return null;
}
export async function signIn(username: string, password: string): Promise<string | null> {
  if (username.trim() === ADMIN_USER) {
    if ((await sha(`${ADMIN_USER}:${password}`)) !== ADMIN_HASH) return 'Wrong password.';
    admin = true; write();
    return null;
  }
  const u = norm(username);
  const r = mem.users[u];
  if (!r) return 'No account with that username on this device.';
  if ((await sha(r.salt + ':' + password)) !== r.hash) return 'Wrong password.';
  mem.current = u; admin = false;
  write();
  return null;
}
export function signOut(): void { mem.current = null; admin = false; write(); }
export async function changePassword(username: string, password: string): Promise<string | null> {
  const r = mem.users[norm(username)];
  if (!r) return 'No such account.';
  if (password.length < 4) return 'Choose a password of at least 4 characters.';
  r.hash = await sha(r.salt + ':' + password);
  write();
  return null;
}
/** Admin only: remove an account (its save slots are deleted by the caller). */
export function removeAccount(username: string): void { const u = norm(username); delete mem.users[u]; if (mem.current === u) mem.current = null; write(); }
