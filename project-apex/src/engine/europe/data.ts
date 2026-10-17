/**
 * European League mode: the national associations, their leagues and the
 * towns their clubs come from. Associations are listed in their starting
 * coefficient order; the ranking moves with European results every season.
 */

export interface AssociationLevelSeed {
  name: string;
  short: string;
  teams: number;
}

export interface AssociationSeed {
  id: string;
  name: string;
  /** Driver/staff name pool for local talent. */
  nationality: string;
  /** League pace relative to the strongest leagues, in car-rating points. */
  pace: number;
  levels: AssociationLevelSeed[];
  cupName: string;
  leagueCupName: string;
  superCupName: string;
  cities: string[];
  /** Club name patterns: `{city}` is replaced by a town. */
  patterns: string[];
}

const EN = ['{city} Racing', '{city} Motorsport', '{city} GP', '{city} Racing Club', '{city} Autosport', '{city} Speed', '{city} Engineering', '{city} Performance'];
const ES = ['{city} Racing', 'Escudería {city}', '{city} Motor Club', '{city} Competición', 'Racing {city}', '{city} Velocidad'];
const IT = ['Scuderia {city}', '{city} Corse', '{city} Racing', '{city} Motori', 'Squadra {city}', '{city} Velocità'];
const DE = ['{city} Rennsport', 'Motorsport {city}', '{city} Racing', 'Rennteam {city}', '{city} Speedworks', '{city} Renntechnik'];
const FR = ['Écurie {city}', '{city} Racing', '{city} Sport Auto', '{city} Compétition', 'Racing Club {city}', '{city} Motorsport'];
const NL = ['{city} Racing', 'Raceteam {city}', '{city} Motorsport', '{city} Speed', 'Racing Club {city}'];
const PT = ['{city} Racing', 'Escuderia {city}', '{city} Motor Clube', '{city} Competição', 'Racing {city}'];
const GEN = ['{city} Racing', '{city} Motorsport', '{city} GP', 'Racing Club {city}', '{city} Speed', '{city} Autosport'];

const big = (top: string, second: string, third: string): AssociationLevelSeed[] => [
  { name: top, short: 'L1', teams: 20 },
  { name: second, short: 'L2', teams: 20 },
  { name: third, short: 'L3', teams: 20 },
];
const mid = (top: string, second: string): AssociationLevelSeed[] => [
  { name: top, short: 'L1', teams: 18 },
  { name: second, short: 'L2', teams: 18 },
];
const small = (top: string, second: string): AssociationLevelSeed[] => [
  { name: top, short: 'L1', teams: 16 },
  { name: second, short: 'L2', teams: 14 },
];
const tiny = (top: string, second: string): AssociationLevelSeed[] => [
  { name: top, short: 'L1', teams: 12 },
  { name: second, short: 'L2', teams: 12 },
];

/** Pace by starting rank: the top leagues are a few tenths a lap quicker than the smallest. */
const paceFor = (rank: number): number => Math.round((4 - (rank - 1) * 0.53) * 10) / 10;

const RAW: Omit<AssociationSeed, 'pace'>[] = [
  { id: 'ENG', name: 'England', nationality: 'GBR', levels: big('Premier Grand Prix', 'GP Championship', 'National Trophy'), cupName: 'Crown Cup', leagueCupName: 'League Trophy', superCupName: 'Champions Shield', patterns: EN, cities: ['London', 'Manchester', 'Liverpool', 'Birmingham', 'Leeds', 'Newcastle', 'Sheffield', 'Bristol', 'Nottingham', 'Leicester', 'Southampton', 'Brighton', 'Norwich', 'Coventry', 'Derby', 'Portsmouth', 'Reading', 'Oxford', 'Cambridge', 'Ipswich', 'Sunderland', 'Middlesbrough', 'Hull', 'Plymouth', 'Bournemouth', 'Wolverhampton', 'Stoke', 'Luton', 'York', 'Exeter'] },
  { id: 'ESP', name: 'Spain', nationality: 'ESP', levels: big('Primera Fórmula', 'Segunda Fórmula', 'Tercera Fórmula'), cupName: 'Copa del Motor', leagueCupName: 'Copa de la Liga', superCupName: 'Supercopa', patterns: ES, cities: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Málaga', 'Zaragoza', 'Valladolid', 'Vigo', 'Gijón', 'Oviedo', 'Granada', 'Alicante', 'Murcia', 'Pamplona', 'San Sebastián', 'Santander', 'Córdoba', 'Almería', 'Cádiz', 'Girona', 'Tarragona', 'Salamanca', 'Burgos', 'Huelva', 'Jerez', 'Albacete', 'Logroño', 'Lleida', 'León'] },
  { id: 'ITA', name: 'Italy', nationality: 'ITA', levels: big('Serie A Corse', 'Serie B Corse', 'Serie C Corse'), cupName: 'Coppa Italia Motori', leagueCupName: 'Coppa di Lega', superCupName: 'Supercoppa', patterns: IT, cities: ['Milano', 'Torino', 'Roma', 'Napoli', 'Bologna', 'Firenze', 'Genova', 'Verona', 'Modena', 'Parma', 'Monza', 'Imola', 'Bergamo', 'Brescia', 'Padova', 'Venezia', 'Bari', 'Palermo', 'Cagliari', 'Udine', 'Lecce', 'Perugia', 'Trieste', 'Siena', 'Pisa', 'Ancona', 'Reggio Emilia', 'Maranello', 'Como', 'Ferrara'] },
  { id: 'GER', name: 'Germany', nationality: 'GER', levels: big('Formel Liga', '2. Formel Liga', '3. Formel Liga'), cupName: 'Motorsport Pokal', leagueCupName: 'Ligapokal', superCupName: 'Supercup', patterns: DE, cities: ['Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Leipzig', 'Bremen', 'Hannover', 'Nürnberg', 'Dresden', 'Essen', 'Bochum', 'Freiburg', 'Mainz', 'Augsburg', 'Kiel', 'Rostock', 'Karlsruhe', 'Wolfsburg', 'Bielefeld', 'Mannheim', 'Aachen', 'Kassel', 'Regensburg', 'Paderborn', 'Magdeburg', 'Ingolstadt'] },
  { id: 'FRA', name: 'France', nationality: 'FRA', levels: big('Élite Formule', 'Formule Deux', 'National Formule'), cupName: 'Coupe de France Auto', leagueCupName: 'Coupe de la Ligue', superCupName: 'Trophée des Champions', patterns: FR, cities: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille', 'Rennes', 'Reims', 'Le Mans', 'Toulon', 'Grenoble', 'Dijon', 'Angers', 'Nîmes', 'Brest', 'Metz', 'Lens', 'Saint-Étienne', 'Clermont', 'Le Havre', 'Caen', 'Auxerre', 'Troyes', 'Annecy', 'Pau', 'Orléans'] },
  { id: 'NED', name: 'Netherlands', nationality: 'NED', levels: big('Eredivisie Racing', 'Eerste Divisie', 'Tweede Divisie'), cupName: 'Racebeker', leagueCupName: 'Ligabeker', superCupName: 'Supercup', patterns: NL, cities: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven', 'Groningen', 'Tilburg', 'Almere', 'Breda', 'Nijmegen', 'Arnhem', 'Zwolle', 'Enschede', 'Haarlem', 'Maastricht', 'Leeuwarden', 'Assen', 'Alkmaar', 'Venlo', 'Deventer', 'Leiden', 'Delft', 'Apeldoorn', 'Amersfoort', 'Heerenveen'] },
  { id: 'POR', name: 'Portugal', nationality: 'POR', levels: mid('Primeira Fórmula', 'Segunda Fórmula'), cupName: 'Taça de Portugal Motor', leagueCupName: 'Taça da Liga', superCupName: 'Supertaça', patterns: PT, cities: ['Lisboa', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Aveiro', 'Setúbal', 'Funchal', 'Guimarães', 'Viseu', 'Leiria', 'Évora', 'Estoril', 'Portimão', 'Vila Real', 'Barcelos', 'Chaves', 'Famalicão', 'Tondela', 'Arouca'] },
  { id: 'BEL', name: 'Belgium', nationality: 'BEL', levels: mid('Pro Series', 'Challenger Series'), cupName: 'Beker van België', leagueCupName: 'Ligabeker', superCupName: 'Supercup', patterns: NL, cities: ['Brussel', 'Antwerpen', 'Gent', 'Liège', 'Brugge', 'Charleroi', 'Leuven', 'Mechelen', 'Namur', 'Genk', 'Hasselt', 'Kortrijk', 'Oostende', 'Mons', 'Spa', 'Zolder', 'Aalst', 'Waregem', 'Lommel', 'Eupen'] },
  { id: 'TUR', name: 'Turkey', nationality: 'TUR', levels: mid('Süper Formula', '1. Formula'), cupName: 'Türkiye Kupası', leagueCupName: 'Lig Kupası', superCupName: 'Süper Kupa', patterns: GEN, cities: ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Konya', 'Adana', 'Gaziantep', 'Kayseri', 'Trabzon', 'Eskişehir', 'Samsun', 'Denizli', 'Kocaeli', 'Sakarya', 'Malatya', 'Rize', 'Sivas', 'Hatay', 'Bodrum'] },
  { id: 'CZE', name: 'Czechia', nationality: 'CZE', levels: mid('První Formule', 'Druhá Formule'), cupName: 'Český pohár', leagueCupName: 'Ligový pohár', superCupName: 'Superpohár', patterns: GEN, cities: ['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc', 'Hradec Králové', 'Pardubice', 'Zlín', 'Jihlava', 'Most', 'Karlovy Vary', 'Teplice', 'Opava', 'Příbram', 'Kladno', 'Mladá Boleslav', 'České Budějovice', 'Jablonec', 'Slovácko'] },
  { id: 'AUT', name: 'Austria', nationality: 'AUT', levels: mid('Formel Bundesserie', 'Formel Zweite'), cupName: 'Austrian Cup', leagueCupName: 'Ligacup', superCupName: 'Supercup', patterns: DE, cities: ['Wien', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt', 'Villach', 'Wels', 'St. Pölten', 'Dornbirn', 'Steyr', 'Spielberg', 'Leoben', 'Bregenz', 'Wolfsberg', 'Krems', 'Ried', 'Hartberg', 'Kapfenberg', 'Lustenau'] },
  { id: 'SCO', name: 'Scotland', nationality: 'GBR', levels: mid('Scottish Premier', 'Scottish Championship'), cupName: 'Scottish Cup', leagueCupName: 'League Cup', superCupName: 'Super Cup', patterns: EN, cities: ['Glasgow', 'Edinburgh', 'Aberdeen', 'Dundee', 'Inverness', 'Perth', 'Stirling', 'Kilmarnock', 'Motherwell', 'Paisley', 'Livingston', 'Falkirk', 'Ayr', 'Dumfries', 'Greenock', 'Hamilton', 'Dunfermline', 'Kirkcaldy', 'Arbroath', 'Montrose'] },
  { id: 'SUI', name: 'Switzerland', nationality: 'SUI', levels: mid('Super Series', 'Challenge Series'), cupName: 'Schweizer Cup', leagueCupName: 'Ligacup', superCupName: 'Supercup', patterns: DE, cities: ['Zürich', 'Genève', 'Basel', 'Bern', 'Lausanne', 'Luzern', 'St. Gallen', 'Lugano', 'Winterthur', 'Sion', 'Thun', 'Biel', 'Aarau', 'Schaffhausen', 'Chur', 'Neuchâtel', 'Fribourg', 'Bellinzona', 'Yverdon', 'Wil'] },
  { id: 'NOR', name: 'Norway', nationality: 'NOR', levels: mid('Eliteserien Racing', 'Første Divisjon'), cupName: 'NM Cup', leagueCupName: 'Ligacup', superCupName: 'Supercup', patterns: GEN, cities: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Kristiansand', 'Tromsø', 'Drammen', 'Fredrikstad', 'Sandefjord', 'Bodø', 'Ålesund', 'Haugesund', 'Molde', 'Lillehammer', 'Hamar', 'Sarpsborg', 'Tønsberg', 'Skien', 'Narvik', 'Gjøvik'] },
  { id: 'DEN', name: 'Denmark', nationality: 'DEN', levels: mid('Superserien', '1. Division'), cupName: 'Landspokal', leagueCupName: 'Ligapokal', superCupName: 'Supercup', patterns: GEN, cities: ['København', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg', 'Randers', 'Horsens', 'Vejle', 'Kolding', 'Silkeborg', 'Herning', 'Roskilde', 'Viborg', 'Næstved', 'Helsingør', 'Fredericia', 'Hillerød', 'Holstebro', 'Lyngby', 'Brøndby'] },
  { id: 'GRE', name: 'Greece', nationality: 'GRE', levels: mid('Super Formula Hellas', 'Formula Hellas 2'), cupName: 'Greek Cup', leagueCupName: 'League Cup', superCupName: 'Super Cup', patterns: GEN, cities: ['Athína', 'Thessaloníki', 'Pátra', 'Irákleio', 'Lárisa', 'Vólos', 'Ioánnina', 'Chaniá', 'Kalamáta', 'Tríkala', 'Xánthi', 'Kavála', 'Lamía', 'Sérres', 'Kozáni', 'Rhodes', 'Piraeus', 'Kórinthos', 'Drama', 'Véroia'] },
  { id: 'POL', name: 'Poland', nationality: 'POL', levels: small('Ekstraklasa Formuła', 'I Liga Formuła'), cupName: 'Puchar Polski', leagueCupName: 'Puchar Ligi', superCupName: 'Superpuchar', patterns: GEN, cities: ['Warszawa', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk', 'Szczecin', 'Lublin', 'Katowice', 'Białystok', 'Gdynia', 'Bydgoszcz', 'Rzeszów', 'Kielce', 'Toruń', 'Opole'] },
  { id: 'CRO', name: 'Croatia', nationality: 'CRO', levels: small('Prva Formula', 'Druga Formula'), cupName: 'Hrvatski kup', leagueCupName: 'Liga kup', superCupName: 'Superkup', patterns: GEN, cities: ['Zagreb', 'Split', 'Rijeka', 'Osijek', 'Zadar', 'Pula', 'Slavonski Brod', 'Karlovac', 'Varaždin', 'Šibenik', 'Dubrovnik', 'Sisak', 'Velika Gorica', 'Vinkovci', 'Koprivnica', 'Čakovec'] },
  { id: 'SRB', name: 'Serbia', nationality: 'SRB', levels: small('Super Formula Srbija', 'Prva Formula Srbija'), cupName: 'Kup Srbije', leagueCupName: 'Liga kup', superCupName: 'Superkup', patterns: GEN, cities: ['Beograd', 'Novi Sad', 'Niš', 'Kragujevac', 'Subotica', 'Zrenjanin', 'Pančevo', 'Čačak', 'Kraljevo', 'Novi Pazar', 'Smederevo', 'Leskovac', 'Valjevo', 'Šabac', 'Užice', 'Vranje'] },
  { id: 'UKR', name: 'Ukraine', nationality: 'UKR', levels: small('Premier Formula', 'First Formula'), cupName: 'Ukrainian Cup', leagueCupName: 'League Cup', superCupName: 'Super Cup', patterns: GEN, cities: ['Kyiv', 'Kharkiv', 'Odesa', 'Dnipro', 'Lviv', 'Zaporizhzhia', 'Vinnytsia', 'Poltava', 'Chernihiv', 'Cherkasy', 'Zhytomyr', 'Sumy', 'Rivne', 'Ivano-Frankivsk', 'Ternopil', 'Lutsk'] },
  { id: 'SWE', name: 'Sweden', nationality: 'SWE', levels: small('Allsvenskan Racing', 'Superettan Racing'), cupName: 'Svenska Cupen', leagueCupName: 'Ligacupen', superCupName: 'Supercupen', patterns: GEN, cities: ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping', 'Lund', 'Umeå', 'Gävle', 'Borås', 'Halmstad', 'Karlstad'] },
  { id: 'HUN', name: 'Hungary', nationality: 'HUN', levels: small('NB I Formula', 'NB II Formula'), cupName: 'Magyar Kupa', leagueCupName: 'Ligakupa', superCupName: 'Szuperkupa', patterns: GEN, cities: ['Budapest', 'Debrecen', 'Szeged', 'Miskolc', 'Pécs', 'Győr', 'Nyíregyháza', 'Kecskemét', 'Székesfehérvár', 'Szombathely', 'Szolnok', 'Eger', 'Zalaegerszeg', 'Sopron', 'Kaposvár', 'Mogyoród'] },
  { id: 'ROU', name: 'Romania', nationality: 'ROU', levels: small('Liga 1 Formula', 'Liga 2 Formula'), cupName: 'Cupa României', leagueCupName: 'Cupa Ligii', superCupName: 'Supercupa', patterns: GEN, cities: ['București', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța', 'Craiova', 'Brașov', 'Galați', 'Ploiești', 'Oradea', 'Arad', 'Sibiu', 'Pitești', 'Bacău', 'Târgu Mureș', 'Baia Mare'] },
  { id: 'SVK', name: 'Slovakia', nationality: 'SVK', levels: small('Prvá Formula', 'Druhá Formula'), cupName: 'Slovenský pohár', leagueCupName: 'Ligový pohár', superCupName: 'Superpohár', patterns: GEN, cities: ['Bratislava', 'Košice', 'Prešov', 'Žilina', 'Nitra', 'Banská Bystrica', 'Trnava', 'Trenčín', 'Martin', 'Poprad', 'Prievidza', 'Zvolen', 'Michalovce', 'Piešťany', 'Ružomberok', 'Senica'] },
  { id: 'SLO', name: 'Slovenia', nationality: 'SLO', levels: tiny('Prva Formula SI', 'Druga Formula SI'), cupName: 'Pokal Slovenije', leagueCupName: 'Ligaški pokal', superCupName: 'Superpokal', patterns: GEN, cities: ['Ljubljana', 'Maribor', 'Celje', 'Kranj', 'Koper', 'Velenje', 'Novo Mesto', 'Ptuj', 'Kamnik', 'Murska Sobota', 'Nova Gorica', 'Domžale', 'Škofja Loka', 'Jesenice'] },
  { id: 'BUL', name: 'Bulgaria', nationality: 'BUL', levels: tiny('Parva Formula', 'Vtora Formula'), cupName: 'Bulgarian Cup', leagueCupName: 'League Cup', superCupName: 'Super Cup', patterns: GEN, cities: ['Sofia', 'Plovdiv', 'Varna', 'Burgas', 'Ruse', 'Stara Zagora', 'Pleven', 'Sliven', 'Dobrich', 'Shumen', 'Pernik', 'Haskovo', 'Blagoevgrad', 'Lovech'] },
  { id: 'CYP', name: 'Cyprus', nationality: 'GRE', levels: tiny('Cyprus Formula A', 'Cyprus Formula B'), cupName: 'Cyprus Cup', leagueCupName: 'League Cup', superCupName: 'Super Cup', patterns: GEN, cities: ['Nicosia', 'Limassol', 'Larnaca', 'Paphos', 'Famagusta', 'Kyrenia', 'Paralimni', 'Ayia Napa', 'Aradippou', 'Polis', 'Lefka', 'Morphou', 'Strovolos', 'Dali'] },
  { id: 'FIN', name: 'Finland', nationality: 'FIN', levels: tiny('Mestaruussarja', 'Ykkössarja'), cupName: 'Suomen Cup', leagueCupName: 'Liigacup', superCupName: 'Supercup', patterns: GEN, cities: ['Helsinki', 'Espoo', 'Tampere', 'Turku', 'Oulu', 'Jyväskylä', 'Lahti', 'Kuopio', 'Pori', 'Vaasa', 'Joensuu', 'Seinäjoki', 'Kotka', 'Rovaniemi'] },
  { id: 'IRL', name: 'Ireland', nationality: 'IRL', levels: tiny('Premier Division', 'First Division'), cupName: 'Irish Cup', leagueCupName: 'League Cup', superCupName: 'Super Cup', patterns: EN, cities: ['Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford', 'Sligo', 'Derry', 'Drogheda', 'Dundalk', 'Athlone', 'Kilkenny', 'Wexford', 'Bray', 'Tralee'] },
  { id: 'ISL', name: 'Iceland', nationality: 'ISL', levels: tiny('Úrvalsdeild Racing', '1. deild Racing'), cupName: 'Bikarinn', leagueCupName: 'Deildabikar', superCupName: 'Meistarakeppni', patterns: GEN, cities: ['Reykjavík', 'Kópavogur', 'Hafnarfjörður', 'Akureyri', 'Garðabær', 'Keflavík', 'Akranes', 'Selfoss', 'Vestmannaeyjar', 'Ísafjörður', 'Húsavík', 'Egilsstaðir', 'Grindavík', 'Borgarnes'] },
  { id: 'EST', name: 'Estonia', nationality: 'EST', levels: tiny('Meistriliiga Racing', 'Esiliiga Racing'), cupName: 'Eesti Karikas', leagueCupName: 'Liigakarikas', superCupName: 'Superkarikas', patterns: GEN, cities: ['Tallinn', 'Tartu', 'Narva', 'Pärnu', 'Kohtla-Järve', 'Viljandi', 'Rakvere', 'Maardu', 'Kuressaare', 'Sillamäe', 'Valga', 'Võru', 'Jõhvi', 'Haapsalu'] },
  { id: 'MLT', name: 'Malta', nationality: 'MLT', levels: tiny('Premier Formula Malta', 'Challenge Formula Malta'), cupName: 'Malta Trophy', leagueCupName: 'League Cup', superCupName: 'Super Cup', patterns: EN, cities: ['Valletta', 'Birkirkara', 'Mosta', 'Qormi', 'Żabbar', 'Sliema', 'Naxxar', 'Rabat', 'Marsaxlokk', 'Żejtun', 'Floriana', 'Ħamrun', 'Gżira', 'Mellieħa'] },
];

export const ASSOCIATIONS: AssociationSeed[] = RAW.map((a, i) => ({ ...a, pace: paceFor(i + 1) }));
export const ASSOCIATION_BY_ID: Record<string, AssociationSeed> = Object.fromEntries(ASSOCIATIONS.map((a) => [a.id, a]));

/** Weekends of two races a domestic league runs, by number of clubs. */
export function leagueWeekends(teams: number): number {
  if (teams >= 20) return 14;
  if (teams >= 18) return 13;
  if (teams >= 16) return 12;
  if (teams >= 14) return 11;
  return 10;
}

/** Clubs promoted (and relegated) between two levels each season. */
export function promotionPlaces(upperTeams: number): number {
  return upperTeams >= 18 ? 3 : 2;
}

export type ContinentalId = 'CL' | 'EL' | 'ECL';

export const CONTINENTAL: Record<ContinentalId, { name: string; short: string; opponents: number; pots: number; color: string; prestige: number }> = {
  CL: { name: 'Apex Champions League', short: 'Champions League', opponents: 8, pots: 4, color: '#3b82f6', prestige: 1 },
  EL: { name: 'Apex Europa League', short: 'Europa League', opponents: 8, pots: 4, color: '#f97316', prestige: 0.55 },
  ECL: { name: 'Apex Conference League', short: 'Conference League', opponents: 6, pots: 6, color: '#22c55e', prestige: 0.32 },
};

export const SUPER_CUP_NAME = 'Apex European Super Cup';
export const GOVERNING_BODY = 'European Motorsport Union';
