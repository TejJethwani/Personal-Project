/**
 * League and club baseline data for the 2025/26 season (approximate, written from memory —
 * NOT live or verified data). Results in the game are entirely fictional.
 *
 * The five Blue Lock clubs take the league places of their real-world inspirations:
 * Bastard München (Bundesliga), Manshine City (Premier League), FC Barcha (La Liga),
 * Ubers (Serie A) and Paris X Gen (Ligue 1).
 *
 * Row format: id|Full name|Short name|ABR|reputation|primary colour|secondary colour|style
 */
export interface LeagueDef { id: string; name: string; sn: string; nat: string; tier: number; up: number; playoff: number; down: number; cup: string; cupName: string; rows: string }
export interface StyleDef { name: string; form: string[]; press: number; line: number; tempo: number; width: number; direct: number; desc: string }

export const STYLES_TAC: Record<string, StyleDef> = {
  possession: { name: 'Possession', form: ['4-3-3', '4-2-3-1'], press: 0.6, line: 0.65, tempo: 0.45, width: 0.55, direct: 0.25, desc: 'Patient build-up, short passing, territorial control.' },
  gegenpress: { name: 'Gegenpress', form: ['4-2-3-1', '4-3-3'], press: 0.9, line: 0.75, tempo: 0.75, width: 0.5, direct: 0.55, desc: 'Win it back within seconds, attack before the opponent resets.' },
  counter: { name: 'Counter-Attack', form: ['4-4-2', '4-2-3-1', '5-3-2'], press: 0.4, line: 0.35, tempo: 0.7, width: 0.5, direct: 0.8, desc: 'Absorb pressure and break at pace into space.' },
  direct: { name: 'Direct', form: ['4-4-2', '4-3-3'], press: 0.5, line: 0.45, tempo: 0.65, width: 0.6, direct: 0.9, desc: 'Early forward passes, second balls, territory over possession.' },
  wing: { name: 'Wing Play', form: ['4-4-2', '4-3-3', '3-4-3'], press: 0.55, line: 0.5, tempo: 0.6, width: 0.85, direct: 0.55, desc: 'Stretch the pitch, overlap and cross.' },
  lowblock: { name: 'Low Block', form: ['5-3-2', '4-4-2'], press: 0.25, line: 0.2, tempo: 0.4, width: 0.4, direct: 0.6, desc: 'Compact, deep and disciplined. Concede space, not chances.' },
  balanced: { name: 'Balanced', form: ['4-3-3', '4-4-2', '4-2-3-1'], press: 0.5, line: 0.5, tempo: 0.5, width: 0.5, direct: 0.5, desc: 'Adaptable shape without extremes.' },
  tiki: { name: 'Positional Play', form: ['4-3-3', '3-4-3'], press: 0.7, line: 0.7, tempo: 0.5, width: 0.6, direct: 0.1, desc: 'Fixed zones, constant triangles, control through the ball.' },
  // NEL identities
  rational: { name: 'Rational Football', form: ['4-3-3'], press: 0.65, line: 0.6, tempo: 0.6, width: 0.5, direct: 0.5, desc: 'Efficiency above all: the highest-probability action, executed precisely.' },
  athletic: { name: 'Athletic Football', form: ['4-4-2'], press: 0.75, line: 0.6, tempo: 0.8, width: 0.7, direct: 0.7, desc: 'Physical supremacy: speed, power and relentless transitions.' },
  creative: { name: 'Creative Freedom', form: ['4-3-3'], press: 0.55, line: 0.6, tempo: 0.55, width: 0.65, direct: 0.3, desc: 'Improvisation and dribbling. Structure exists to release imagination.' },
  strategic: { name: 'Strategic Football', form: ['5-3-2'], press: 0.45, line: 0.35, tempo: 0.5, width: 0.45, direct: 0.65, desc: 'Pre-planned patterns and collective defensive discipline.' },
  dualace: { name: 'Dual-Ace System', form: ['4-2-3-1'], press: 0.6, line: 0.55, tempo: 0.7, width: 0.55, direct: 0.6, desc: 'The team rebuilds itself around whichever ace has the ball.' },
};

export const FORMATIONS: Record<string, [string, number, number][]> = {
  '4-3-3': [['GK', 4, 50], ['LB', 25, 14], ['CB', 20, 37], ['CB', 20, 63], ['RB', 25, 86], ['DM', 38, 50], ['CM', 48, 31], ['CM', 48, 69], ['LW', 70, 15], ['ST', 78, 50], ['RW', 70, 85]],
  '4-4-2': [['GK', 4, 50], ['LB', 25, 14], ['CB', 20, 37], ['CB', 20, 63], ['RB', 25, 86], ['LM', 50, 14], ['CM', 44, 38], ['CM', 44, 62], ['RM', 50, 86], ['ST', 76, 40], ['ST', 76, 60]],
  '4-2-3-1': [['GK', 4, 50], ['LB', 25, 14], ['CB', 20, 37], ['CB', 20, 63], ['RB', 25, 86], ['DM', 38, 38], ['DM', 38, 62], ['LW', 64, 15], ['AM', 60, 50], ['RW', 64, 85], ['ST', 78, 50]],
  '3-5-2': [['GK', 4, 50], ['CB', 20, 28], ['CB', 18, 50], ['CB', 20, 72], ['LM', 46, 10], ['CM', 44, 34], ['DM', 38, 50], ['CM', 44, 66], ['RM', 46, 90], ['ST', 76, 40], ['SS', 72, 60]],
  '3-4-3': [['GK', 4, 50], ['CB', 20, 28], ['CB', 18, 50], ['CB', 20, 72], ['LM', 46, 10], ['CM', 42, 38], ['CM', 42, 62], ['RM', 46, 90], ['LW', 70, 20], ['ST', 78, 50], ['RW', 70, 80]],
  '5-3-2': [['GK', 4, 50], ['LB', 28, 8], ['CB', 20, 30], ['CB', 18, 50], ['CB', 20, 70], ['RB', 28, 92], ['CM', 44, 30], ['DM', 38, 50], ['CM', 44, 70], ['ST', 76, 40], ['SS', 72, 60]],
};

export const LEAGUES: LeagueDef[] = [
  { id: 'eng1', name: 'Premier League', sn: 'PL', nat: 'ENG', tier: 1, up: 0, playoff: 0, down: 3, cup: 'engcup', cupName: 'FA Cup', rows: `
ars|Arsenal|Arsenal|ARS|91|#e0202c|#ffffff|possession
avl|Aston Villa|Aston Villa|AVL|84|#7a1e3a|#95bfe5|counter
bou|AFC Bournemouth|Bournemouth|BOU|79|#d71920|#111111|gegenpress
bre|Brentford|Brentford|BRE|78|#e30613|#ffffff|direct
bha|Brighton & Hove Albion|Brighton|BHA|80|#0057b8|#ffffff|possession
bur|Burnley|Burnley|BUR|73|#6c1d45|#99d6ea|lowblock
che|Chelsea|Chelsea|CHE|88|#034694|#ffffff|possession
cry|Crystal Palace|Crystal Palace|CRY|80|#1b458f|#c4122e|counter
eve|Everton|Everton|EVE|78|#003399|#ffffff|balanced
ful|Fulham|Fulham|FUL|78|#f5f5f5|#111111|balanced
lee|Leeds United|Leeds|LEE|76|#f4f4f4|#1d428a|gegenpress
liv|Liverpool|Liverpool|LIV|92|#c8102e|#00b2a9|gegenpress
manshine|Manshine City|Manshine City|MSC|92|#6cabdd|#1c2c5b|athletic
mun|Manchester United|Man United|MUN|86|#da291c|#111111|counter
new|Newcastle United|Newcastle|NEW|85|#202020|#ffffff|gegenpress
nfo|Nottingham Forest|Nott'm Forest|NFO|80|#dd0000|#ffffff|counter
sun|Sunderland|Sunderland|SUN|75|#eb172b|#ffffff|balanced
tot|Tottenham Hotspur|Tottenham|TOT|85|#f4f4f8|#132257|gegenpress
whu|West Ham United|West Ham|WHU|78|#7a263a|#1bb1e7|direct
wol|Wolverhampton Wanderers|Wolves|WOL|76|#fdb913|#231f20|counter` },
  { id: 'eng2', name: 'Championship', sn: 'CH', nat: 'ENG', tier: 2, up: 2, playoff: 4, down: 3, cup: 'engcup', cupName: 'FA Cup', rows: `
bir|Birmingham City|Birmingham|BIR|70|#0000ff|#ffffff|possession
bla|Blackburn Rovers|Blackburn|BLB|66|#009ee0|#ffffff|balanced
brc|Bristol City|Bristol City|BRC|67|#e21a23|#ffffff|balanced
cha|Charlton Athletic|Charlton|CHA|63|#d4021d|#ffffff|direct
cov|Coventry City|Coventry|COV|69|#59cbe8|#ffffff|gegenpress
der|Derby County|Derby|DER|65|#f4f4f4|#111111|direct
hul|Hull City|Hull|HUL|65|#f5a12d|#111111|balanced
ips|Ipswich Town|Ipswich|IPS|72|#3a64a3|#ffffff|gegenpress
lei|Leicester City|Leicester|LEI|73|#003090|#fdbe11|possession
mid|Middlesbrough|Middlesbrough|MID|69|#e11b22|#ffffff|possession
mil|Millwall|Millwall|MIL|65|#001d5e|#ffffff|direct
nor|Norwich City|Norwich|NOR|68|#fff200|#00a650|possession
oxf|Oxford United|Oxford Utd|OXF|62|#fff200|#001958|lowblock
por|Portsmouth|Portsmouth|POR|63|#001489|#ffffff|direct
pne|Preston North End|Preston|PNE|64|#f4f4f4|#000055|balanced
qpr|Queens Park Rangers|QPR|QPR|65|#1d5ba4|#ffffff|counter
shu|Sheffield United|Sheffield Utd|SHU|72|#ee2737|#ffffff|balanced
shw|Sheffield Wednesday|Sheffield Wed|SHW|62|#4482d0|#ffffff|lowblock
sou|Southampton|Southampton|SOU|73|#d71920|#ffffff|possession
stk|Stoke City|Stoke|STK|66|#e03a3e|#ffffff|direct
swa|Swansea City|Swansea|SWA|66|#f4f4f4|#111111|possession
wat|Watford|Watford|WAT|66|#fbee23|#ed2127|counter
wba|West Bromwich Albion|West Brom|WBA|68|#122f67|#ffffff|balanced
wre|Wrexham|Wrexham|WRE|67|#e4002b|#ffffff|direct` },
  { id: 'eng3', name: 'League One', sn: 'L1', nat: 'ENG', tier: 3, up: 2, playoff: 4, down: 4, cup: 'engcup', cupName: 'FA Cup', rows: `
afw|AFC Wimbledon|AFC Wimbledon|AFW|52|#0000a0|#ffdd00|direct
bar|Barnsley|Barnsley|BAR|58|#d71921|#ffffff|balanced
blp|Blackpool|Blackpool|BLP|57|#f68712|#ffffff|direct
bol|Bolton Wanderers|Bolton|BOL|60|#f4f4f4|#263c7e|possession
brd|Bradford City|Bradford|BRD|56|#7a263a|#fdb913|direct
brt|Burton Albion|Burton|BRT|51|#fff200|#111111|lowblock
car|Cardiff City|Cardiff|CAR|62|#0070b5|#ffffff|balanced
don|Doncaster Rovers|Doncaster|DON|54|#d71921|#ffffff|balanced
exe|Exeter City|Exeter|EXE|53|#e31b23|#ffffff|possession
hud|Huddersfield Town|Huddersfield|HUD|60|#0e63ad|#ffffff|balanced
ley|Leyton Orient|Leyton Orient|LEY|56|#e21a23|#ffffff|possession
lin|Lincoln City|Lincoln|LIN|55|#e21a23|#ffffff|direct
lut|Luton Town|Luton|LUT|63|#f78f1e|#002d62|counter
man|Mansfield Town|Mansfield|MAN|53|#f5a12d|#0000a0|balanced
nth|Northampton Town|Northampton|NTH|52|#7a263a|#ffffff|direct
pet|Peterborough United|Peterborough|PET|55|#0055a5|#ffffff|possession
ply|Plymouth Argyle|Plymouth|PLY|60|#00704a|#ffffff|balanced
ptv|Port Vale|Port Vale|PTV|52|#f4f4f4|#111111|lowblock
rea|Reading|Reading|REA|58|#004494|#ffffff|possession
rot|Rotherham United|Rotherham|ROT|56|#dd1e25|#ffffff|direct
ste|Stevenage|Stevenage|STE|54|#b0122c|#ffffff|lowblock
stp|Stockport County|Stockport|STP|58|#003da5|#ffffff|gegenpress
wig|Wigan Athletic|Wigan|WIG|57|#1d59af|#ffffff|balanced
wyc|Wycombe Wanderers|Wycombe|WYC|57|#8fd6f0|#002f62|direct` },
  { id: 'esp1', name: 'La Liga', sn: 'LL', nat: 'ESP', tier: 1, up: 0, playoff: 0, down: 3, cup: 'espcup', cupName: 'Copa del Rey', rows: `
ala|Deportivo Alavés|Alavés|ALA|72|#0761af|#ffffff|lowblock
ath|Athletic Club|Athletic Club|ATH|84|#ee2523|#ffffff|gegenpress
atm|Atlético Madrid|Atlético|ATM|88|#cb3524|#272e61|counter
barcha|FC Barcha|FC Barcha|BAR|92|#a50044|#004d98|creative
cel|Celta Vigo|Celta|CEL|77|#8ac3ee|#ffffff|possession
elc|Elche|Elche|ELC|71|#f4f4f4|#05642c|possession
esp|Espanyol|Espanyol|ESP|73|#007fc8|#ffffff|counter
get|Getafe|Getafe|GET|74|#005999|#ffffff|lowblock
gir|Girona|Girona|GIR|77|#cd2534|#ffffff|possession
lev|Levante|Levante|LEV|70|#b4053f|#005ca5|balanced
mal|RCD Mallorca|Mallorca|MLL|74|#e20613|#111111|lowblock
osa|Osasuna|Osasuna|OSA|75|#d91a21|#0a346f|direct
ray|Rayo Vallecano|Rayo|RAY|76|#f4f4f4|#e53027|gegenpress
bet|Real Betis|Betis|BET|81|#0bb363|#ffffff|possession
rma|Real Madrid|Real Madrid|RMA|94|#f6f6f6|#febe10|counter
ovi|Real Oviedo|Oviedo|OVI|69|#004996|#ffffff|balanced
rso|Real Sociedad|Real Sociedad|RSO|80|#0067b1|#ffffff|possession
sev|Sevilla|Sevilla|SEV|78|#f4f4f4|#d81920|balanced
val|Valencia|Valencia|VAL|77|#f4f4f4|#ee3524|counter
vil|Villarreal|Villarreal|VIL|83|#ffe667|#005187|counter` },
  { id: 'ger1', name: 'Bundesliga', sn: 'BL', nat: 'GER', tier: 1, up: 0, playoff: 0, down: 2, cup: 'gercup', cupName: 'DFB-Pokal', rows: `
aug|FC Augsburg|Augsburg|AUG|73|#ba3733|#46714d|direct
lev04|Bayer Leverkusen|Leverkusen|B04|86|#e32221|#111111|possession
bastard|Bastard München|Bastard München|BAS|93|#dc052d|#0066b2|rational
bvb|Borussia Dortmund|Dortmund|BVB|86|#fde100|#111111|gegenpress
bmg|Borussia Mönchengladbach|M'gladbach|BMG|76|#f4f4f4|#111111|balanced
sge|Eintracht Frankfurt|Frankfurt|SGE|82|#e1000f|#111111|counter
scf|SC Freiburg|Freiburg|SCF|79|#e2001a|#111111|balanced
hsv|Hamburger SV|Hamburg|HSV|73|#0a3f86|#ffffff|possession
hdh|1. FC Heidenheim|Heidenheim|HDH|70|#e2001a|#003b79|direct
tsg|TSG Hoffenheim|Hoffenheim|TSG|77|#1961b5|#ffffff|gegenpress
koe|1. FC Köln|Köln|KOE|74|#ed1c24|#ffffff|gegenpress
rbl|RB Leipzig|Leipzig|RBL|84|#dd0741|#001f47|gegenpress
m05|Mainz 05|Mainz|M05|77|#c3141e|#ffffff|gegenpress
stpauli|FC St. Pauli|St. Pauli|STP|71|#624839|#ffffff|lowblock
vfb|VfB Stuttgart|Stuttgart|VFB|82|#f4f4f4|#e32219|possession
fcu|Union Berlin|Union Berlin|FCU|74|#eb1923|#fff200|lowblock
svw|Werder Bremen|Bremen|SVW|76|#1d9053|#ffffff|balanced
wob|VfL Wolfsburg|Wolfsburg|WOB|76|#65b32e|#ffffff|balanced` },
  { id: 'ita1', name: 'Serie A', sn: 'SA', nat: 'ITA', tier: 1, up: 0, playoff: 0, down: 3, cup: 'itacup', cupName: 'Coppa Italia', rows: `
ata|Atalanta|Atalanta|ATA|84|#1e71b8|#111111|gegenpress
bol|Bologna|Bologna|BOL|80|#1a2f48|#a21c26|possession
cag|Cagliari|Cagliari|CAG|72|#b01028|#002350|lowblock
com|Como|Como|COM|78|#003f8f|#ffffff|possession
cre|Cremonese|Cremonese|CRE|70|#ce1126|#7b7f83|lowblock
fio|Fiorentina|Fiorentina|FIO|80|#482e92|#ffffff|balanced
gen|Genoa|Genoa|GEN|73|#ad1919|#00214e|balanced
ver|Hellas Verona|Verona|VER|71|#003c7e|#ffed00|direct
int|Inter|Inter|INT|90|#010e80|#111111|possession
ubers|Ubers|Ubers|UBE|88|#f4f4f4|#111111|strategic
laz|Lazio|Lazio|LAZ|81|#87d8f7|#ffffff|balanced
lec|Lecce|Lecce|LEC|71|#fff200|#db2d1f|counter
mil|AC Milan|Milan|MIL|87|#fb090b|#111111|counter
nap|Napoli|Napoli|NAP|89|#12a0d7|#ffffff|possession
par|Parma|Parma|PAR|72|#fff200|#1b4094|counter
pis|Pisa|Pisa|PIS|69|#0a1f44|#111111|lowblock
rom|Roma|Roma|ROM|84|#8e1f2f|#f0bc42|gegenpress
sas|Sassuolo|Sassuolo|SAS|72|#00a752|#111111|possession
tor|Torino|Torino|TOR|74|#8a1e03|#ffffff|balanced
udi|Udinese|Udinese|UDI|73|#f4f4f4|#111111|direct` },
  { id: 'fra1', name: 'Ligue 1', sn: 'L1F', nat: 'FRA', tier: 1, up: 0, playoff: 0, down: 2, cup: 'fracup', cupName: 'Coupe de France', rows: `
ang|Angers SCO|Angers|ANG|69|#f4f4f4|#111111|lowblock
aux|AJ Auxerre|Auxerre|AUX|71|#f4f4f4|#0a5eb0|counter
bst|Stade Brestois|Brest|BRE|74|#e30613|#ffffff|balanced
hac|Le Havre|Le Havre|HAC|69|#79bce7|#183360|lowblock
len|RC Lens|Lens|RCL|78|#ec1c24|#fff200|gegenpress
lil|Lille|Lille|LIL|82|#e01e13|#20325f|balanced
lor|FC Lorient|Lorient|LOR|71|#f58113|#111111|possession
lyo|Olympique Lyonnais|Lyon|OL|82|#f4f4f4|#da0812|possession
mar|Olympique de Marseille|Marseille|OM|85|#2faee0|#ffffff|gegenpress
met|FC Metz|Metz|MET|68|#6e0f12|#ffffff|lowblock
mon|AS Monaco|Monaco|ASM|83|#e51b22|#ffffff|counter
nan|FC Nantes|Nantes|NAN|72|#fcd405|#00a85a|counter
nic|OGC Nice|Nice|NIC|79|#111111|#cc0000|balanced
pfc|Paris FC|Paris FC|PFC|73|#0e2a5c|#ffffff|possession
pxg|Paris X Gen|Paris X Gen|PXG|93|#004170|#da291c|dualace
ren|Stade Rennais|Rennes|REN|78|#e13327|#111111|balanced
str|RC Strasbourg|Strasbourg|STR|78|#009fe3|#ffffff|possession
tou|Toulouse|Toulouse|TFC|74|#5a2d81|#ffffff|balanced` },
];

/** Lower-division clubs outside the simulated pyramid. They swap in when clubs are relegated out of it. */
export const POOLS: Record<string, { name: string; rows: string }> = {
  ENG: { name: 'League Two', rows: `mkd|MK Dons|MK Dons|MKD|52|#f4f4f4|#d71920|possession
brr|Bristol Rovers|Bristol Rovers|BRR|52|#0054a6|#ffffff|direct
crw|Crawley Town|Crawley|CRW|49|#d71920|#ffffff|balanced
cam|Cambridge United|Cambridge|CAM|51|#fbba00|#111111|direct
shr|Shrewsbury Town|Shrewsbury|SHR|50|#0066b3|#fbba00|lowblock
ntc|Notts County|Notts County|NTC|52|#f4f4f4|#111111|possession
chf|Chesterfield|Chesterfield|CHF|51|#1b458f|#ffffff|balanced
wal|Walsall|Walsall|WAL|51|#e21a23|#ffffff|direct
swi|Swindon Town|Swindon|SWI|50|#dc0714|#ffffff|balanced
gil|Gillingham|Gillingham|GIL|50|#002b5c|#ffffff|direct
col|Colchester United|Colchester|COL|49|#0077c0|#ffffff|balanced
sal|Salford City|Salford|SAL|50|#d71920|#ffffff|counter` },
  ESP: { name: 'Segunda División', rows: `leg|CD Leganés|Leganés|LEG|70|#f4f4f4|#0050a0|lowblock
lpa|UD Las Palmas|Las Palmas|LPA|70|#ffe400|#0058a5|possession
vll|Real Valladolid|Valladolid|VLL|69|#5c2d91|#ffffff|balanced
alm|UD Almería|Almería|ALM|70|#e30613|#ffffff|counter
gra|Granada CF|Granada|GRA|68|#c8102e|#ffffff|balanced
cad|Cádiz CF|Cádiz|CAD|68|#ffe400|#0045a5|lowblock
spg|Sporting Gijón|Sporting|SPG|67|#d50a1e|#ffffff|direct
zar|Real Zaragoza|Zaragoza|ZAR|67|#f4f4f4|#1c3f94|balanced
dep|Deportivo La Coruña|Deportivo|DEP|68|#0a5bb5|#ffffff|possession
mlg|Málaga CF|Málaga|MLG|67|#6cace4|#ffffff|balanced` },
  GER: { name: '2. Bundesliga', rows: `boc|VfL Bochum|Bochum|BOC|70|#005ca9|#ffffff|direct
ksv|Holstein Kiel|Kiel|KSV|69|#005eb8|#ffffff|gegenpress
s04|FC Schalke 04|Schalke|S04|71|#004d9d|#ffffff|balanced
bsc|Hertha BSC|Hertha|BSC|70|#005ca9|#ffffff|possession
h96|Hannover 96|Hannover|H96|69|#1a9e3a|#111111|balanced
f95|Fortuna Düsseldorf|Düsseldorf|F95|69|#e2001a|#ffffff|counter
fcn|1. FC Nürnberg|Nürnberg|FCN|68|#8a0e24|#111111|possession
fck|1. FC Kaiserslautern|K'lautern|FCK|68|#e2001a|#ffffff|direct` },
  ITA: { name: 'Serie B', rows: `emp|Empoli|Empoli|EMP|70|#00579c|#ffffff|possession
ven|Venezia|Venezia|VEN|69|#111111|#f58220|balanced
mza|Monza|Monza|MZA|70|#e4002b|#ffffff|possession
pal|Palermo|Palermo|PAL|70|#f4a6c0|#111111|balanced
sam|Sampdoria|Sampdoria|SAM|69|#1b5497|#ffffff|counter
bri|Bari|Bari|BAR|67|#f4f4f4|#d50a1e|direct
spe|Spezia|Spezia|SPE|68|#f4f4f4|#111111|lowblock
fro|Frosinone|Frosinone|FRO|67|#ffe400|#0054a6|balanced` },
  FRA: { name: 'Ligue 2', rows: `rei|Stade de Reims|Reims|REI|71|#ee2223|#ffffff|counter
ste|AS Saint-Étienne|Saint-Étienne|STE|72|#009639|#ffffff|balanced
mhp|Montpellier HSC|Montpellier|MHP|70|#f58113|#0c2340|direct
gui|EA Guingamp|Guingamp|GUI|66|#e2001a|#111111|balanced
tro|ESTAC Troyes|Troyes|TRO|67|#0055a4|#ffffff|possession
bas|SC Bastia|Bastia|BAS|66|#0055a4|#ffffff|lowblock
gre|Grenoble Foot 38|Grenoble|GRE|65|#0055a4|#ffffff|balanced
dun|USL Dunkerque|Dunkerque|DUN|65|#0a2a5c|#ffffff|gegenpress` },
};

/** NEL team definitions: youth teams attached to a parent senior club and coached by its master striker. */
export const NEL_TEAMS = [
  { id: 'nel_bastard', parent: 'ger1_bastard', name: 'Bastard München', abbr: 'BAS', nat: 'GER', style: 'rational', train: ['POS', 'DEC', 'FIN', 'TIQ'], identity: 'Rational football. Every action is judged by probability; the coach rewards efficiency and punishes waste.' },
  { id: 'nel_manshine', parent: 'eng1_manshine', name: 'Manshine City', abbr: 'MSC', nat: 'ENG', style: 'athletic', train: ['ACC', 'SPD', 'STR', 'STA'], identity: 'Athletic football. Physical data drives selection: the fastest, strongest version of you plays.' },
  { id: 'nel_barcha', parent: 'esp1_barcha', name: 'FC Barcha', abbr: 'BAR', nat: 'ESP', style: 'creative', train: ['DRI', 'AGI', 'SKL', 'BCO'], identity: 'Creative freedom. Dribbling and improvisation are the curriculum; ideas matter more than patterns.' },
  { id: 'nel_ubers', parent: 'ita1_ubers', name: 'Ubers', abbr: 'UBE', nat: 'ITA', style: 'strategic', train: ['TIQ', 'DAW', 'MAR', 'DEC'], identity: 'Strategic football. Rehearsed patterns and collective defence; discipline earns your place.' },
  { id: 'nel_pxg', parent: 'fra1_pxg', name: 'Paris X Gen', abbr: 'PXG', nat: 'FRA', style: 'dualace', train: ['SHP', 'FIN', 'ACC', 'COM'], identity: 'The dual-ace system. The team reshapes itself around its stars — become one, or serve one.' },
] as const;

export function clubId(league: string, short: string): string { return `${league}_${short}`; }
