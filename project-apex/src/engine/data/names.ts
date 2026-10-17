/** Fictional name pools by nationality. Combinations are random, so no real person is depicted. */
export interface NationalityData {
  code: string;
  name: string;
  weight: number;
  first: string[];
  last: string[];
}

export const NATIONALITIES: NationalityData[] = [
  { code: 'GBR', name: 'Great Britain', weight: 9, first: ['Oliver', 'Harry', 'Jack', 'George', 'Callum', 'Ewan', 'Toby', 'Rhys', 'Alfie', 'Freddie', 'Archie', 'Ellis', 'Jamie', 'Owen', 'Finley', 'Isla', 'Hannah', 'Lewis', 'Rory', 'Declan'], last: ['Hartley', 'Whitmore', 'Ashdown', 'Pennington', 'Blackwood', 'Carrow', 'Fenwick', 'Hollis', 'Langford', 'Merriman', 'Ratcliffe', 'Stanmore', 'Thorne', 'Wexley', 'Kingsley', 'Ashby', 'Calloway', 'Dunmore', 'Fairbrook', 'Gresham'] },
  { code: 'ITA', name: 'Italy', weight: 7, first: ['Luca', 'Marco', 'Matteo', 'Lorenzo', 'Alessandro', 'Davide', 'Riccardo', 'Tommaso', 'Gabriele', 'Federico', 'Andrea', 'Nicolò', 'Pietro', 'Edoardo', 'Giulia', 'Sofia'], last: ['Ferraresi', 'Bellandi', 'Castellano', 'Moretti', 'Vianello', 'Santoro', 'Ricciardelli', 'Bassani', 'Lombardo', 'Fontana', 'Gentile', 'Marchetti', 'Pellegrini', 'Rinaldi', 'Valentini', 'Zanetti'] },
  { code: 'GER', name: 'Germany', weight: 7, first: ['Lukas', 'Felix', 'Jonas', 'Maximilian', 'Leon', 'Niklas', 'Moritz', 'Paul', 'Tim', 'Florian', 'Julian', 'Jannik', 'Lena', 'Marie', 'Tobias', 'Sebastian'], last: ['Brandt', 'Kessler', 'Hoffmann', 'Lindner', 'Vogt', 'Engel', 'Krämer', 'Wolff', 'Sauer', 'Haller', 'Dietrich', 'Brenner', 'Falk', 'Reuter', 'Winkler', 'Albrecht'] },
  { code: 'FRA', name: 'France', weight: 6, first: ['Théo', 'Hugo', 'Louis', 'Antoine', 'Victor', 'Mathis', 'Arthur', 'Raphaël', 'Bastien', 'Clément', 'Quentin', 'Romain', 'Camille', 'Léa', 'Julien', 'Maxime'], last: ['Delacroix', 'Fournier', 'Lambert', 'Moreau', 'Rousseau', 'Girard', 'Chevalier', 'Marchand', 'Leclair', 'Dumont', 'Beaumont', 'Garnier', 'Perrin', 'Vasseur', 'Lefèvre', 'Mercier'] },
  { code: 'ESP', name: 'Spain', weight: 5, first: ['Alejandro', 'Pablo', 'Javier', 'Diego', 'Álvaro', 'Daniel', 'Sergio', 'Adrián', 'Iker', 'Marc', 'Pol', 'Lucía', 'Hugo', 'Raúl', 'Carla', 'Óscar'], last: ['Navarro', 'Castillo', 'Romero', 'Serrano', 'Ortega', 'Delgado', 'Morales', 'Vidal', 'Iglesias', 'Medina', 'Cortés', 'Herrera', 'Rubio', 'Molina', 'Prieto', 'Soler'] },
  { code: 'NED', name: 'Netherlands', weight: 4, first: ['Daan', 'Sem', 'Luuk', 'Milan', 'Thijs', 'Jesse', 'Bram', 'Ruben', 'Stijn', 'Joris', 'Tess', 'Niels', 'Koen', 'Lars'], last: ['de Vries', 'van Dijk', 'Bakker', 'Visser', 'Smit', 'Mulder', 'van Leeuwen', 'Kuiper', 'Dekker', 'Verbeek', 'Hendriks', 'van der Berg', 'Postma', 'Brouwer'] },
  { code: 'BEL', name: 'Belgium', weight: 2, first: ['Arne', 'Wout', 'Senne', 'Jules', 'Lucas', 'Robbe', 'Maxime', 'Elias', 'Nathan', 'Thibault'], last: ['Peeters', 'Janssens', 'Maes', 'Wouters', 'Claes', 'Goossens', 'Lemaire', 'Dubois', 'Vermeulen', 'Hermans'] },
  { code: 'AUT', name: 'Austria', weight: 2, first: ['David', 'Elias', 'Fabian', 'Lorenz', 'Raphael', 'Simon', 'Valentin', 'Anna', 'Matthias', 'Stefan'], last: ['Gruber', 'Huber', 'Pichler', 'Moser', 'Steiner', 'Leitner', 'Berger', 'Eder', 'Fuchs', 'Hofer'] },
  { code: 'SUI', name: 'Switzerland', weight: 2, first: ['Noah', 'Levin', 'Gian', 'Nico', 'Dario', 'Livio', 'Yannick', 'Mara', 'Joel', 'Fabio'], last: ['Meier', 'Keller', 'Baumann', 'Frei', 'Zimmermann', 'Brunner', 'Gerber', 'Bühler', 'Graf', 'Schärer'] },
  { code: 'FIN', name: 'Finland', weight: 3, first: ['Eetu', 'Aleksi', 'Onni', 'Veeti', 'Lauri', 'Joonas', 'Kalle', 'Miro', 'Aino', 'Valtteri', 'Juho', 'Sami'], last: ['Laaksonen', 'Virtanen', 'Mäkelä', 'Heikkinen', 'Koskinen', 'Lehtonen', 'Salonen', 'Halonen', 'Rantanen', 'Niemi', 'Aaltonen', 'Kivelä'] },
  { code: 'SWE', name: 'Sweden', weight: 2, first: ['Oscar', 'William', 'Hugo', 'Elias', 'Axel', 'Viktor', 'Linnea', 'Albin', 'Isak', 'Emil'], last: ['Lindqvist', 'Bergström', 'Sandberg', 'Holm', 'Lundgren', 'Ekström', 'Nyberg', 'Sjöberg', 'Wallin', 'Forsberg'] },
  { code: 'DEN', name: 'Denmark', weight: 2, first: ['Magnus', 'Frederik', 'Mads', 'Rasmus', 'Christian', 'Mikkel', 'Freja', 'Anders', 'Kasper', 'Oliver'], last: ['Kjær', 'Nørgaard', 'Østergaard', 'Lund', 'Dahl', 'Holm', 'Bech', 'Skov', 'Thorsen', 'Brix'] },
  { code: 'NOR', name: 'Norway', weight: 1, first: ['Sander', 'Henrik', 'Eirik', 'Sindre', 'Jakob', 'Ingrid', 'Torbjørn', 'Håkon'], last: ['Haugen', 'Solberg', 'Bakken', 'Lie', 'Strand', 'Moen', 'Aas', 'Eide'] },
  { code: 'POL', name: 'Poland', weight: 2, first: ['Jakub', 'Kacper', 'Szymon', 'Filip', 'Mateusz', 'Bartosz', 'Zuzanna', 'Wiktor', 'Kamil', 'Michał'], last: ['Nowicki', 'Zieliński', 'Wróbel', 'Kaczmarek', 'Pawlak', 'Sikora', 'Ostrowski', 'Wójcik', 'Kowalczyk', 'Baran'] },
  { code: 'CZE', name: 'Czechia', weight: 1, first: ['Jan', 'Tomáš', 'Ondřej', 'Vojtěch', 'Adam', 'Petr', 'Tereza', 'Matěj'], last: ['Novák', 'Dvořák', 'Černý', 'Procházka', 'Kučera', 'Veselý', 'Horák', 'Marek'] },
  { code: 'POR', name: 'Portugal', weight: 1, first: ['Tiago', 'Rodrigo', 'Gonçalo', 'Duarte', 'Afonso', 'Rafael', 'Inês', 'Martim'], last: ['Ferreira', 'Carvalho', 'Pinto', 'Teixeira', 'Correia', 'Mendes', 'Sousa', 'Antunes'] },
  { code: 'IRL', name: 'Ireland', weight: 1, first: ['Cian', 'Oisín', 'Darragh', 'Seán', 'Conor', 'Niamh', 'Eoin', 'Ciarán'], last: ["O'Connell", 'Byrne', 'Doyle', 'Kavanagh', 'Brennan', "O'Malley", 'Quinlan', 'Moloney'] },
  { code: 'MON', name: 'Monaco', weight: 1, first: ['Louis', 'Arthur', 'Charles', 'Antoine', 'Hugo', 'Stéphane'], last: ['Bellando', 'Gastaud', 'Médecin', 'Notari', 'Pastor', 'Rey'] },
  { code: 'BRA', name: 'Brazil', weight: 4, first: ['Gabriel', 'Lucas', 'Matheus', 'Rafael', 'Felipe', 'Gustavo', 'Enzo', 'Caio', 'Bruno', 'Thiago', 'Beatriz', 'Vinícius'], last: ['Albuquerque', 'Barreto', 'Cardoso', 'Duarte', 'Fonseca', 'Guimarães', 'Lacerda', 'Moraes', 'Nogueira', 'Peixoto', 'Rezende', 'Tavares'] },
  { code: 'ARG', name: 'Argentina', weight: 2, first: ['Santiago', 'Tomás', 'Joaquín', 'Facundo', 'Agustín', 'Franco', 'Valentín', 'Martina'], last: ['Aguirre', 'Bustos', 'Echeverría', 'Funes', 'Ledesma', 'Quiroga', 'Sosa', 'Villalba'] },
  { code: 'MEX', name: 'Mexico', weight: 2, first: ['Emiliano', 'Sebastián', 'Mateo', 'Leonardo', 'Rodrigo', 'Ximena', 'Iván', 'Patricio'], last: ['Arellano', 'Cervantes', 'Domínguez', 'Galindo', 'Mendoza', 'Orozco', 'Salazar', 'Zúñiga'] },
  { code: 'USA', name: 'United States', weight: 5, first: ['Logan', 'Mason', 'Carter', 'Hunter', 'Tyler', 'Cole', 'Brody', 'Chase', 'Avery', 'Jordan', 'Riley', 'Dalton', 'Grant', 'Parker'], last: ['Holloway', 'Brennan', 'Caldwell', 'Danforth', 'Everett', 'Garrison', 'Hensley', 'Lockhart', 'McAllister', 'Prescott', 'Sterling', 'Whitaker', 'Bradford', 'Sutton'] },
  { code: 'CAN', name: 'Canada', weight: 2, first: ['Liam', 'Ethan', 'Nathan', 'Owen', 'Xavier', 'Émile', 'Chloé', 'Gavin', 'Tristan'], last: ['Tremblay', 'Gagnon', 'Bouchard', 'MacLeod', 'Fraser', 'Lachance', 'Pelletier', 'Gauthier', 'Morrison'] },
  { code: 'AUS', name: 'Australia', weight: 3, first: ['Lachlan', 'Cooper', 'Mitchell', 'Jaxon', 'Hamish', 'Brodie', 'Kai', 'Zara', 'Riley', 'Darcy'], last: ['Mackenzie', 'Hargreaves', 'Fitzgerald', 'Dawson', 'Kerr', 'Pearce', 'Ridley', 'Talbot', 'Walsh', 'Cartwright'] },
  { code: 'NZL', name: 'New Zealand', weight: 1, first: ['Nikau', 'Tane', 'Hamish', 'Callum', 'Arlo', 'Ruby'], last: ['Ngata', 'Whaanga', 'Burrows', 'McKinnon', 'Paewai', 'Lindsay'] },
  { code: 'JPN', name: 'Japan', weight: 3, first: ['Haruto', 'Ren', 'Sota', 'Yuto', 'Riku', 'Kaito', 'Takumi', 'Hinata', 'Daiki', 'Yuki', 'Kenta'], last: ['Takahashi', 'Nakamura', 'Kobayashi', 'Yamamoto', 'Fujita', 'Matsuda', 'Okada', 'Ishikawa', 'Hayashi', 'Morita', 'Shimizu'] },
  { code: 'CHN', name: 'China', weight: 2, first: ['Hao', 'Wei', 'Jun', 'Zihan', 'Yichen', 'Ruoxi', 'Tianyu', 'Mingyu'], last: ['Zhang', 'Liu', 'Chen', 'Huang', 'Zhou', 'Wu', 'Lin', 'Guo'] },
  { code: 'KOR', name: 'South Korea', weight: 1, first: ['Min-jun', 'Seo-jun', 'Ha-eun', 'Ji-ho', 'Do-yun', 'Yu-na'], last: ['Kim', 'Park', 'Choi', 'Jung', 'Kang', 'Han'] },
  { code: 'IND', name: 'India', weight: 2, first: ['Arjun', 'Rohan', 'Kabir', 'Vihaan', 'Aditya', 'Ishaan', 'Ananya', 'Dev'], last: ['Mehta', 'Rao', 'Iyer', 'Kapoor', 'Malhotra', 'Bhatia', 'Chandra', 'Saxena'] },
  { code: 'RSA', name: 'South Africa', weight: 1, first: ['Ruan', 'Pieter', 'Tristan', 'Liam', 'Thabo', 'Jade'], last: ['van Wyk', 'Botha', 'Naidoo', 'Pretorius', 'Ndlovu', 'Steyn'] },
  { code: 'THA', name: 'Thailand', weight: 1, first: ['Krit', 'Thanawat', 'Nattapong', 'Pim', 'Chaiya', 'Anan'], last: ['Srisuk', 'Wongsa', 'Chaiyaporn', 'Rattana', 'Boonmee', 'Sukhum'] },
  // European League mode associations (weight 0: never drawn at random in Classic careers).
  { code: 'TUR', name: 'Turkey', weight: 0, first: ['Emre', 'Burak', 'Can', 'Kerem', 'Mert', 'Arda', 'Deniz', 'Efe', 'Zeynep', 'Ozan'], last: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Kurt'] },
  { code: 'GRE', name: 'Greece', weight: 0, first: ['Giorgos', 'Nikos', 'Kostas', 'Dimitris', 'Yannis', 'Petros', 'Eleni', 'Stavros', 'Alexis', 'Thanos'], last: ['Papadopoulos', 'Nikolaidis', 'Georgiou', 'Antoniou', 'Karalis', 'Vlachos', 'Makris', 'Christou', 'Lazaridis', 'Doukas'] },
  { code: 'CRO', name: 'Croatia', weight: 0, first: ['Luka', 'Ivan', 'Marko', 'Ante', 'Josip', 'Mateo', 'Petra', 'Filip', 'Dario', 'Toni'], last: ['Horvat', 'Kovačević', 'Babić', 'Marić', 'Jurić', 'Novak', 'Knežević', 'Vuković', 'Perić', 'Matić'] },
  { code: 'SRB', name: 'Serbia', weight: 0, first: ['Nikola', 'Stefan', 'Aleksa', 'Lazar', 'Miloš', 'Uroš', 'Jelena', 'Vuk', 'Dušan', 'Nemanja'], last: ['Jovanović', 'Petrović', 'Nikolić', 'Marković', 'Đorđević', 'Stojanović', 'Ilić', 'Pavlović', 'Milošević', 'Todorović'] },
  { code: 'UKR', name: 'Ukraine', weight: 0, first: ['Oleksandr', 'Andriy', 'Dmytro', 'Maksym', 'Bohdan', 'Yaroslav', 'Olena', 'Taras', 'Mykola', 'Artem'], last: ['Shevchenko', 'Kovalenko', 'Bondarenko', 'Tkachenko', 'Kravchenko', 'Melnyk', 'Oliynyk', 'Lysenko', 'Moroz', 'Savchenko'] },
  { code: 'HUN', name: 'Hungary', weight: 0, first: ['Bence', 'Máté', 'Levente', 'Dániel', 'Ádám', 'Gergő', 'Réka', 'Balázs', 'Zsolt', 'Márk'], last: ['Nagy', 'Kovács', 'Tóth', 'Szabó', 'Horváth', 'Varga', 'Kiss', 'Molnár', 'Németh', 'Farkas'] },
  { code: 'ROU', name: 'Romania', weight: 0, first: ['Andrei', 'Alexandru', 'Ionuț', 'Mihai', 'Vlad', 'Răzvan', 'Ioana', 'Cristian', 'Sorin', 'Darius'], last: ['Popescu', 'Ionescu', 'Constantin', 'Dumitrescu', 'Stan', 'Stoica', 'Gheorghe', 'Rusu', 'Munteanu', 'Matei'] },
  { code: 'SVK', name: 'Slovakia', weight: 0, first: ['Martin', 'Tomáš', 'Peter', 'Matúš', 'Samuel', 'Jakub', 'Lucia', 'Marek', 'Patrik', 'Lukáš'], last: ['Horváth', 'Kováč', 'Varga', 'Tóth', 'Nagy', 'Baláž', 'Szabó', 'Molnár', 'Lukáč', 'Hudák'] },
  { code: 'SLO', name: 'Slovenia', weight: 0, first: ['Luka', 'Jan', 'Žiga', 'Nejc', 'Tilen', 'Matic', 'Nika', 'Rok', 'Gašper', 'Anže'], last: ['Novak', 'Horvat', 'Krajnc', 'Kovačič', 'Zupančič', 'Potočnik', 'Mlakar', 'Vidmar', 'Kos', 'Golob'] },
  { code: 'BUL', name: 'Bulgaria', weight: 0, first: ['Georgi', 'Ivan', 'Dimitar', 'Nikolay', 'Hristo', 'Martin', 'Maria', 'Petar', 'Stoyan', 'Kaloyan'], last: ['Ivanov', 'Georgiev', 'Dimitrov', 'Petrov', 'Nikolov', 'Hristov', 'Stoyanov', 'Todorov', 'Kolev', 'Angelov'] },
  { code: 'ISL', name: 'Iceland', weight: 0, first: ['Jón', 'Sigurður', 'Guðmundur', 'Gunnar', 'Ólafur', 'Einar', 'Anna', 'Kristján', 'Stefán', 'Aron'], last: ['Jónsson', 'Sigurðsson', 'Guðmundsson', 'Gunnarsson', 'Ólafsson', 'Einarsson', 'Kristjánsson', 'Magnússon', 'Stefánsson', 'Björnsson'] },
  { code: 'EST', name: 'Estonia', weight: 0, first: ['Martin', 'Rasmus', 'Karl', 'Sander', 'Markus', 'Kristjan', 'Liis', 'Ott', 'Tanel', 'Rene'], last: ['Tamm', 'Saar', 'Sepp', 'Mägi', 'Kask', 'Kukk', 'Rebane', 'Ilves', 'Pärn', 'Koppel'] },
  { code: 'MLT', name: 'Malta', weight: 0, first: ['Luke', 'Matthew', 'Jean', 'Kyle', 'Nicholas', 'Andrea', 'Maria', 'Gabriel', 'Jake', 'Daniel'], last: ['Borg', 'Camilleri', 'Vella', 'Farrugia', 'Zammit', 'Galea', 'Micallef', 'Grech', 'Attard', 'Spiteri'] },
];

export const NATIONALITY_BY_CODE: Record<string, NationalityData> = Object.fromEntries(NATIONALITIES.map((n) => [n.code, n]));

/** Principals, engineers and other staff draw from the same pools. */
export const STAFF_SPECIALIZATIONS: Record<string, string[]> = {
  technicalDirector: ['Aerodynamics', 'Mechanical', 'Power Unit', 'Reliability'],
  raceEngineer: ['Car Setup', 'Driver Rapport', 'Data Analysis'],
  headStrategist: ['Tyre Strategy', 'Weather Calls', 'Race Reading'],
  chiefMechanic: ['Pit Stops', 'Reliability', 'Repairs'],
  driverCoach: ['Youth Development', 'Racecraft', 'Physical Conditioning', 'Mental Performance'],
  headScout: ['Youth Talent', 'Market Analysis', 'Hidden Gems'],
  academyDirector: ['Talent Identification', 'Development Programmes', 'Pathway Management'],
};
