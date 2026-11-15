/** Nations (code, name, confederation, baseline senior strength, name pool) and name pools for generated players. */
export interface Nation { id: string; name: string; conf: 'UEFA' | 'CONMEBOL' | 'CAF' | 'AFC' | 'CONCACAF' | 'OFC'; str: number; pool: string; adj: string }

const RAW = `ENG,England,UEFA,86,en,English;ESP,Spain,UEFA,87,es,Spanish;GER,Germany,UEFA,85,de,German;ITA,Italy,UEFA,83,it,Italian;FRA,France,UEFA,88,fr,French;
POR,Portugal,UEFA,86,pt,Portuguese;NED,Netherlands,UEFA,84,nl,Dutch;BEL,Belgium,UEFA,82,nl,Belgian;CRO,Croatia,UEFA,81,sl,Croatian;SUI,Switzerland,UEFA,79,de,Swiss;
AUT,Austria,UEFA,79,de,Austrian;DEN,Denmark,UEFA,80,sc,Danish;SWE,Sweden,UEFA,78,sc,Swedish;NOR,Norway,UEFA,80,sc,Norwegian;POL,Poland,UEFA,77,sl,Polish;
SRB,Serbia,UEFA,77,sl,Serbian;TUR,Türkiye,UEFA,79,tr,Turkish;SCO,Scotland,UEFA,76,en,Scottish;WAL,Wales,UEFA,74,en,Welsh;IRL,Republic of Ireland,UEFA,73,en,Irish;
UKR,Ukraine,UEFA,77,sl,Ukrainian;CZE,Czechia,UEFA,76,sl,Czech;HUN,Hungary,UEFA,76,sl,Hungarian;GRE,Greece,UEFA,76,sl,Greek;SVK,Slovakia,UEFA,74,sl,Slovak;
SVN,Slovenia,UEFA,74,sl,Slovenian;ROU,Romania,UEFA,74,sl,Romanian;ALB,Albania,UEFA,73,sl,Albanian;KOS,Kosovo,UEFA,72,sl,Kosovan;GEO,Georgia,UEFA,74,sl,Georgian;
ISL,Iceland,UEFA,70,sc,Icelandic;FIN,Finland,UEFA,70,sc,Finnish;BIH,Bosnia and Herzegovina,UEFA,73,sl,Bosnian;MNE,Montenegro,UEFA,70,sl,Montenegrin;NIR,Northern Ireland,UEFA,70,en,Northern Irish;
ISR,Israel,UEFA,71,ar,Israeli;ARM,Armenia,UEFA,68,sl,Armenian;LUX,Luxembourg,UEFA,66,fr,Luxembourgish;MKD,North Macedonia,UEFA,69,sl,Macedonian;EST,Estonia,UEFA,62,sc,Estonian;
BRA,Brazil,CONMEBOL,87,pt,Brazilian;ARG,Argentina,CONMEBOL,88,es,Argentine;URU,Uruguay,CONMEBOL,82,es,Uruguayan;COL,Colombia,CONMEBOL,81,es,Colombian;ECU,Ecuador,CONMEBOL,78,es,Ecuadorian;
PAR,Paraguay,CONMEBOL,75,es,Paraguayan;CHI,Chile,CONMEBOL,74,es,Chilean;VEN,Venezuela,CONMEBOL,73,es,Venezuelan;PER,Peru,CONMEBOL,72,es,Peruvian;
NGA,Nigeria,CAF,79,af,Nigerian;SEN,Senegal,CAF,81,af,Senegalese;GHA,Ghana,CAF,76,af,Ghanaian;CIV,Ivory Coast,CAF,79,af,Ivorian;MAR,Morocco,CAF,83,ar,Moroccan;
EGY,Egypt,CAF,78,ar,Egyptian;CMR,Cameroon,CAF,76,af,Cameroonian;ALG,Algeria,CAF,78,ar,Algerian;MLI,Mali,CAF,75,af,Malian;TUN,Tunisia,CAF,74,ar,Tunisian;
COD,DR Congo,CAF,75,af,Congolese;GUI,Guinea,CAF,72,af,Guinean;BFA,Burkina Faso,CAF,73,af,Burkinabé;GAB,Gabon,CAF,70,af,Gabonese;CPV,Cape Verde,CAF,71,pt,Cape Verdean;
ANG,Angola,CAF,70,pt,Angolan;GAM,Gambia,CAF,68,af,Gambian;TOG,Togo,CAF,67,af,Togolese;BEN,Benin,CAF,68,af,Beninese;MOZ,Mozambique,CAF,67,pt,Mozambican;
ZAM,Zambia,CAF,68,af,Zambian;RSA,South Africa,CAF,72,en,South African;ZIM,Zimbabwe,CAF,66,af,Zimbabwean;GNB,Guinea-Bissau,CAF,67,pt,Bissau-Guinean;
JPN,Japan,AFC,82,jp,Japanese;KOR,South Korea,AFC,79,kr,South Korean;AUS,Australia,AFC,75,en,Australian;IRN,Iran,AFC,76,ar,Iranian;KSA,Saudi Arabia,AFC,72,ar,Saudi;
UZB,Uzbekistan,AFC,73,sl,Uzbek;JOR,Jordan,AFC,70,ar,Jordanian;IRQ,Iraq,AFC,70,ar,Iraqi;QAT,Qatar,AFC,69,ar,Qatari;IDN,Indonesia,AFC,66,nl,Indonesian;
USA,United States,CONCACAF,78,en,American;MEX,Mexico,CONCACAF,78,es,Mexican;CAN,Canada,CONCACAF,76,en,Canadian;JAM,Jamaica,CONCACAF,70,en,Jamaican;CRC,Costa Rica,CONCACAF,71,es,Costa Rican;
PAN,Panama,CONCACAF,71,es,Panamanian;HAI,Haiti,CONCACAF,66,fr,Haitian;CUW,Curaçao,CONCACAF,67,nl,Curaçaoan;SUR,Suriname,CONCACAF,66,nl,Surinamese;NZL,New Zealand,OFC,68,en,New Zealander;
RUS,Russia,UEFA,74,sl,Russian;BUL,Bulgaria,UEFA,68,sl,Bulgarian;BLR,Belarus,UEFA,66,sl,Belarusian;KAZ,Kazakhstan,UEFA,66,sl,Kazakh;AZE,Azerbaijan,UEFA,64,tr,Azerbaijani;
CYP,Cyprus,UEFA,63,sl,Cypriot;FRO,Faroe Islands,UEFA,60,sc,Faroese;LVA,Latvia,UEFA,60,sl,Latvian;LTU,Lithuania,UEFA,60,sl,Lithuanian;MDA,Moldova,UEFA,60,sl,Moldovan;
MLT,Malta,UEFA,58,it,Maltese;AND,Andorra,UEFA,56,es,Andorran;LIE,Liechtenstein,UEFA,52,de,Liechtensteiner;GIB,Gibraltar,UEFA,52,en,Gibraltarian;SMR,San Marino,UEFA,48,it,Sammarinese;
BOL,Bolivia,CONMEBOL,70,es,Bolivian;
UGA,Uganda,CAF,67,af,Ugandan;KEN,Kenya,CAF,65,af,Kenyan;TAN,Tanzania,CAF,65,af,Tanzanian;ETH,Ethiopia,CAF,62,af,Ethiopian;SDN,Sudan,CAF,64,ar,Sudanese;
LBY,Libya,CAF,65,ar,Libyan;MTN,Mauritania,CAF,66,ar,Mauritanian;EQG,Equatorial Guinea,CAF,68,es,Equatoguinean;NAM,Namibia,CAF,65,af,Namibian;MAD,Madagascar,CAF,65,fr,Malagasy;
MWI,Malawi,CAF,62,af,Malawian;RWA,Rwanda,CAF,62,af,Rwandan;SLE,Sierra Leone,CAF,63,af,Sierra Leonean;NIG,Niger,CAF,62,af,Nigerien;CGO,Congo,CAF,64,af,Congolese (Brazzaville);
CTA,Central African Republic,CAF,61,af,Central African;LBR,Liberia,CAF,61,af,Liberian;COM,Comoros,CAF,64,fr,Comorian;BDI,Burundi,CAF,60,af,Burundian;BOT,Botswana,CAF,61,af,Motswana;
LES,Lesotho,CAF,58,af,Basotho;SWZ,Eswatini,CAF,57,af,Swazi;SSD,South Sudan,CAF,56,af,South Sudanese;ERI,Eritrea,CAF,54,af,Eritrean;DJI,Djibouti,CAF,52,ar,Djiboutian;
SOM,Somalia,CAF,50,ar,Somali;CHA,Chad,CAF,55,af,Chadian;STP,São Tomé and Príncipe,CAF,52,pt,Santomean;SEY,Seychelles,CAF,50,fr,Seychellois;MRI,Mauritius,CAF,56,fr,Mauritian;
CHN,China,AFC,68,zh,Chinese;UAE,United Arab Emirates,AFC,70,ar,Emirati;OMA,Oman,AFC,68,ar,Omani;BHR,Bahrain,AFC,67,ar,Bahraini;SYR,Syria,AFC,66,ar,Syrian;
PLE,Palestine,AFC,65,ar,Palestinian;LBN,Lebanon,AFC,64,ar,Lebanese;KUW,Kuwait,AFC,63,ar,Kuwaiti;YEM,Yemen,AFC,56,ar,Yemeni;AFG,Afghanistan,AFC,56,ar,Afghan;
THA,Thailand,AFC,66,sea,Thai;VIE,Vietnam,AFC,65,sea,Vietnamese;MAS,Malaysia,AFC,63,sea,Malaysian;PHI,Philippines,AFC,60,sea,Filipino;SIN,Singapore,AFC,58,sea,Singaporean;
MYA,Myanmar,AFC,57,sea,Burmese;CAM,Cambodia,AFC,55,sea,Cambodian;LAO,Laos,AFC,52,sea,Laotian;BRU,Brunei,AFC,48,sea,Bruneian;TLS,Timor-Leste,AFC,48,pt,Timorese;
IND,India,AFC,62,in,Indian;PAK,Pakistan,AFC,54,in,Pakistani;BAN,Bangladesh,AFC,54,in,Bangladeshi;NEP,Nepal,AFC,54,in,Nepali;SRI,Sri Lanka,AFC,50,in,Sri Lankan;
MDV,Maldives,AFC,54,in,Maldivian;BHU,Bhutan,AFC,48,in,Bhutanese;TJK,Tajikistan,AFC,63,sl,Tajik;KGZ,Kyrgyzstan,AFC,62,sl,Kyrgyz;TKM,Turkmenistan,AFC,60,tr,Turkmen;
PRK,North Korea,AFC,65,kr,North Korean;HKG,Hong Kong,AFC,59,zh,Hong Konger;TPE,Chinese Taipei,AFC,56,zh,Taiwanese;MAC,Macau,AFC,50,zh,Macanese;MNG,Mongolia,AFC,50,kr,Mongolian;GUM,Guam,AFC,48,en,Guamanian;
HON,Honduras,CONCACAF,68,es,Honduran;SLV,El Salvador,CONCACAF,66,es,Salvadoran;GUA,Guatemala,CONCACAF,66,es,Guatemalan;TRI,Trinidad and Tobago,CONCACAF,65,en,Trinidadian;NCA,Nicaragua,CONCACAF,60,es,Nicaraguan;
CUB,Cuba,CONCACAF,60,es,Cuban;DOM,Dominican Republic,CONCACAF,62,es,Dominican;PUR,Puerto Rico,CONCACAF,57,es,Puerto Rican;BER,Bermuda,CONCACAF,56,en,Bermudian;GUY,Guyana,CONCACAF,58,en,Guyanese;
SKN,Saint Kitts and Nevis,CONCACAF,55,en,Kittitian;LCA,Saint Lucia,CONCACAF,54,en,Saint Lucian;ATG,Antigua and Barbuda,CONCACAF,54,en,Antiguan;GRN,Grenada,CONCACAF,54,en,Grenadian;BRB,Barbados,CONCACAF,52,en,Barbadian;
BLZ,Belize,CONCACAF,52,en,Belizean;VIN,Saint Vincent and the Grenadines,CONCACAF,52,en,Vincentian;DMA,Dominica,CONCACAF,50,en,Dominican (Dominica);ARU,Aruba,CONCACAF,50,nl,Aruban;CAY,Cayman Islands,CONCACAF,48,en,Caymanian;
BAH,Bahamas,CONCACAF,48,en,Bahamian;MSR,Montserrat,CONCACAF,50,en,Montserratian;TCA,Turks and Caicos Islands,CONCACAF,46,en,Turks and Caicos Islander;VGB,British Virgin Islands,CONCACAF,44,en,British Virgin Islander;VIR,US Virgin Islands,CONCACAF,44,en,US Virgin Islander;AIA,Anguilla,CONCACAF,42,en,Anguillan;
FIJ,Fiji,OFC,55,en,Fijian;PNG,Papua New Guinea,OFC,54,en,Papua New Guinean;SOL,Solomon Islands,OFC,55,en,Solomon Islander;NCL,New Caledonia,OFC,56,fr,New Caledonian;TAH,Tahiti,OFC,55,fr,Tahitian;
VAN,Vanuatu,OFC,53,en,Ni-Vanuatu;SAM,Samoa,OFC,48,en,Samoan;TGA,Tonga,OFC,46,en,Tongan;COK,Cook Islands,OFC,46,en,Cook Islander;ASA,American Samoa,OFC,44,en,American Samoan`;

export const NATIONS: Record<string, Nation> = {};
for (const row of RAW.replace(/\n/g, '').split(';')) {
  const [id, name, conf, str, pool, adj] = row.split(',');
  NATIONS[id] = { id, name, conf: conf as Nation['conf'], str: +str, pool, adj };
}
export const NATION_IDS = Object.keys(NATIONS);
export function nationName(id: string): string { return NATIONS[id]?.name ?? id; }

const P = (s: string) => s.split(' ').map((x) => x.replace(/_/g, ' '));
export const NAME_POOLS: Record<string, { first: string[]; last: string[] }> = {
  en: {
    first: P('Jack Harry Oliver George Noah Charlie Jacob Alfie Freddie Oscar Leo Archie Ethan Joshua Thomas James William Henry Lucas Mason Riley Tyler Callum Reece Jordan Kyle Marcus Declan Jude Cole Ellis Finley Lewis Aaron Dominic Rhys Connor Liam Nathan Morgan'),
    last: P('Smith Jones Taylor Brown Williams Wilson Johnson Davies Robinson Wright Thompson Evans Walker White Roberts Green Hall Wood Jackson Clarke Harrison Scott Cooper King Baker Morris Bennett Carter Mitchell Parker Shaw Fletcher Hughes Barnes Marshall Chapman Lawson Whitfield Okafor Mensah Campbell Stewart Murray Douglas Kerr Byrne Doyle Gallagher Hartley Ashworth Pemberton Holloway'),
  },
  es: {
    first: P('Alejandro Pablo Hugo Daniel Álvaro Adrián David Mario Diego Javier Sergio Marcos Iván Carlos Miguel Rubén Víctor Iker Jorge Raúl Mateo Nicolás Santiago Lautaro Thiago Facundo Joaquín Emiliano Luciano Gonzalo Martín Tomás Julián Franco Agustín Rodrigo Unai Gorka Pau Ferran'),
    last: P('García Rodríguez González Fernández López Martínez Sánchez Pérez Gómez Martín Jiménez Ruiz Hernández Díaz Moreno Muñoz Álvarez Romero Alonso Gutiérrez Navarro Torres Domínguez Vázquez Ramos Gil Ramírez Serrano Blanco Molina Morales Suárez Ortega Delgado Castro Ortiz Rubio Marín Iglesias Medina Cabrera Acosta Benítez Herrera Silva Rojas Figueroa Paredes Vega Etxeberria Aguirre Zubiri'),
  },
  de: {
    first: P('Lukas Leon Finn Jonas Paul Elias Noah Ben Luis Felix Maximilian Moritz Julian Niklas Tim Jan Florian Tobias Fabian Philipp Simon David Erik Kai Nico Marvin Dennis Lennart Jannik Robin Timo Kevin Pascal Sebastian Marco Luca Malte Henrik'),
    last: P('Müller Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Hoffmann Schäfer Koch Bauer Richter Klein Wolf Schröder Neumann Schwarz Zimmermann Braun Krüger Hofmann Hartmann Lange Werner Krause Lehmann Köhler Herrmann König Walter Kaiser Fuchs Peters Lang Scholz Möller Weiß Jung Hahn Vogel Friedrich Keller Günther Frank Berger Winkler Roth Beck Lorenz Baumann Brandt Seidel Yilmaz Demir'),
  },
  it: {
    first: P('Francesco Alessandro Lorenzo Mattia Andrea Leonardo Riccardo Gabriele Matteo Tommaso Davide Federico Giuseppe Antonio Marco Luca Giovanni Simone Nicolò Filippo Pietro Samuele Daniele Stefano Cristian Emanuele Edoardo Giacomo Michele Salvatore Alessio Manuel Gianluca Enrico'),
    last: P('Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti De_Luca Mancini Costa Giordano Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Rinaldi Caruso Ferrara Galli Martini Leone Longo Gentile Martinelli Vitale Lombardo Serra Coppola De_Santis Marchetti Parisi Villa Conte Ferraro Fabbri Bianco Marini Grasso Valentini Pellegrino Bellini'),
  },
  fr: {
    first: P('Lucas Hugo Louis Gabriel Arthur Jules Nathan Enzo Léo Raphaël Adam Maël Théo Ethan Noah Tom Mathis Clément Antoine Maxime Baptiste Alexandre Quentin Julien Kylian Rayan Ibrahim Moussa Mamadou Youssouf Bradley Warren Désiré Castello Wilfried Loïc Axel Yanis Sofiane Malo'),
    last: P('Martin Bernard Dubois Thomas Robert Richard Petit Durand Leroy Moreau Simon Laurent Lefebvre Michel Garcia David Bertrand Roux Vincent Fournier Morel Girard André Mercier Dupont Lambert Bonnet François Martinez Legrand Garnier Faure Rousseau Blanc Guerin Muller Henry Diallo Traoré Koné Camara Cissé Sow Diarra Konaté Dembélé Sissoko Touré Bamba Coulibaly Fofana N\'Diaye Mbemba Kamara'),
  },
  pt: {
    first: P('João Pedro Gabriel Lucas Matheus Rafael Guilherme Gustavo Felipe Bruno Thiago Vinícius Rodrigo Diogo Tiago Gonçalo André Rúben Bernardo Francisco Martim Tomás Miguel Nuno Rui Hugo Vitor Caio Igor Renan Danilo Éder Wesley Luan Yuri Kauã Estêvão Endrick Savio'),
    last: P('Silva Santos Oliveira Souza Rodrigues Ferreira Alves Pereira Lima Gomes Costa Ribeiro Martins Carvalho Almeida Lopes Soares Fernandes Vieira Barbosa Rocha Dias Nascimento Andrade Moreira Nunes Marques Machado Mendes Freitas Cardoso Ramos Gonçalves Santana Teixeira Correia Pinto Azevedo Cunha Moura Cavalcanti Monteiro Neves Coelho Tavares Fonseca Paixão Sampaio Leão Bento'),
  },
  nl: {
    first: P('Daan Sem Lucas Levi Finn Milan Luuk Noah Bram Jesse Thijs Lars Ruben Stijn Sven Tim Jurriën Xavi Quinten Mats Ryan Devyne Tijjani Jeremie Micky Joey Kenneth Wout Cody Denzel Kevin Arne Thibaut Yari Jorrit Lois Senne Matthijs'),
    last: P('de_Jong Jansen de_Vries van_den_Berg van_Dijk Bakker Janssen Visser Smit Meijer de_Boer Mulder de_Groot Bos Vos Peters Hendriks van_Leeuwen Dekker Brouwer de_Wit Dijkstra Smits de_Graaf van_der_Meer Kok Jacobs de_Haan Vermeulen van_den_Heuvel van_der_Veen van_den_Broek Peeters Maes Claes Wouters Goossens Mertens Timmermans Koopman Veerman Schouten Hartman Kuipers Verbeek Hoekstra Postma'),
  },
  sc: {
    first: P('Erik Lars Anders Magnus Oscar Emil Victor Alexander Mikkel Rasmus Jonas Andreas Mathias Kasper Frederik Nikolaj Sander Martin Kristian Henrik Viktor Isak Elias Hugo Anton Morten Jens Simon Joakim Marcus Ludvig Albin Hákon Aron Teemu Oliver'),
    last: P('Andersen Nielsen Hansen Pedersen Larsen Jensen Christensen Olsen Johansson Karlsson Nilsson Eriksson Lindberg Svensson Gustafsson Berg Lund Holm Dahl Haugen Solberg Nyland Ødegaard Thorsby Hauge Strand Bjørn Lindqvist Forsberg Ekdal Sundberg Kristiansen Mortensen Skov Højbjerg Nørgaard Wind Dolberg Sigurdsson Gudmundsson Pukki Niskanen Elanga Isaksen'),
  },
  sl: {
    first: P('Luka Ivan Marko Nikola Petar Stefan Mateo Josip Ante Filip Dušan Aleksandar Miloš Nemanja Andrija Lazar Jakub Kacper Piotr Krzysztof Tomáš Patrik Adam Ondřej Mykhailo Oleksandr Viktor Artem Dominik Milan Bence Giorgi Khvicha Andrei Florin Dimitris Kostas Edon Arber Benjamin'),
    last: P('Horvat Kovačić Babić Marić Jurić Novak Petrović Jovanović Nikolić Marković Đorđević Stojanović Ilić Pavlović Milenković Vlahović Kowalski Nowak Wiśniewski Zieliński Lewandowski Kamiński Szymański Novák Svoboda Dvořák Černý Shevchenko Kovalenko Bondarenko Mudryk Nagy Szabó Tóth Varga Kvaratskhelia Mamardashvili Popescu Ionescu Stanciu Papadopoulos Giannoulis Mavropanos Rashica Muriqi Hajdari Džeko Pjanić Krunić Šeško Oblak'),
  },
  tr: {
    first: P('Arda Kenan Hakan Emre Burak Mert Ozan Can Yusuf Ahmet Mehmet Kerem Ferdi Orkun Cengiz İrfan Salih Barış Çağlar Enes Semih Okay Zeki Uğurcan Berkay Eren Altay Samet İsmail Halil'),
    last: P('Yılmaz Kaya Demir Çelik Şahin Yıldız Yıldırım Öztürk Aydın Özdemir Arslan Doğan Kılıç Aslan Çetin Kara Koç Kurt Özkan Şimşek Güler Çalhanoğlu Kökçü Aktürkoğlu Akgün Ünder Tosun Bardakcı Ayhan Kahveci Akaydin Özcan Yazıcı Söyüncü Demiral Kabak Kadıoğlu Müldür Elmas Uzun'),
  },
  af: {
    first: P('Victor Samuel Emmanuel Kelechi Wilfred Ademola Taiwo Sadio Ismaïla Idrissa Kalidou Cheikh Pape Mohammed Thomas Jordan André Inaki Antoine Franck Nicolas Sébastien Eric Bryan Carlos Yves Amadou Moussa Hamari Bakary Serhou Naby Edmond Bertrand Chancel Yoane Cédric Fiston Lamine Habib Iliman Abdoulaye Krépin Nicolas Simon Ola Calvin Alex Frank Dango'),
    last: P('Osimhen Chukwueze Iheanacho Ndidi Lookman Awoniyi Okoye Onyeka Bassey Aina Adeyemi Mané Sarr Gueye Koulibaly Kouyaté Diatta Jackson Mendy Ndiaye Kudus Partey Ayew Williams Semenyo Salisu Kessié Haller Pépé Zaha Adingra Bailly Aboubakar Anguissa Mbeumo Onana Choupo-Moting Bissouma Haidara Diarra Traoré Guirassy Keïta Tapsoba Ouattara Aubameyang Mbemba Wissa Bakambu Diomande Sangaré Doumbia Boateng Asante Owusu Mensah Afolabi Eze Okonkwo Balogun Danso Nwaneri'),
  },
  ar: {
    first: P('Mohamed Ahmed Omar Youssef Achraf Hakim Sofyan Noussair Yassine Brahim Nayef Azzedine Bilal Amine Riyad Ismaël Islam Rayan Saïd Houssem Mahmoud Mostafa Hamza Zakaria Anis Ilias Ayoub Karim Sami Mehdi Ali Hussein Salem Firas Saleh Yazan Amir Sardar Alireza Mehdi'),
    last: P('Salah Marmoush Elneny Trezeguet Hakimi Ziyech Amrabat Mazraoui Bounou En-Nesyri Díaz Aguerd Ounahi El Khannouss Mahrez Bennacer Slimani Aït-Nouri Bensebaini Gouiri Atal Benrahma Msakni Skhiri Khazri Laïdouni Al-Dawsari Al-Faraj Al-Shehri Kanno Taremi Azmoun Jahanbakhsh Ghoddos Al-Tamari Olwan Hussein Ali Afif Hassan Mansour El Idrissi Benali Chaouch Haddad Darwish Najjar Saadi'),
  },
  in: {
    first: P('Arjun Rohan Aarav Vihaan Aditya Karan Rahul Sahil Ishaan Kabir Dev Nikhil Varun Sunil Sandesh Gurpreet Anirudh Lallianzuala Manvir Liston Ali Hamza Bilal Usman Hassan Imran Faisal Zain Saad Danish Tariq Asif Jamal Rakib Tapu Topu Anjan Kiran Bimal Suman Dinesh Waseem Ahmed Naveen Pradeep Ashique Brandon Mahesh Rafiq Shakib Mehedi Sohel Nabib'),
    last: P('Sharma Singh Kumar Patel Chhetri Thapa Gurung Rai Fernandes Colaco Sandhu Jhingan Bheke Bose Das Ghosh Mondal Khan Ahmed Hussain Malik Butt Qureshi Sheikh Chaudhry Raza Iqbal Aslam Rahman Islam Hossain Barman Biswas Shrestha Magar Tamang Lama Perera Silva Fernando Jayasuriya Naik Nair Menon Reddy Rao Verma Yadav Mishra Thakur Poojary Ralte'),
  },
  zh: {
    first: P('Wei Lei Jun Hao Yu Chen Jie Peng Tao Bin Long Feng Xin Kai Ming Yang Zhen Bo Liang Qiang Shuai Chao Lin Dong Han Rui Ze Yi Xiang Hang Wing Ka Chun Tsz Ho'),
    last: P('Wang Li Zhang Liu Chen Yang Huang Zhao Wu Zhou Xu Sun Ma Zhu Hu Guo He Gao Lin Luo Zheng Liang Xie Tang Han Cao Deng Feng Wei Jiang Yan Yu Dong Xiao Cheng Yuan Lam Chan Wong Leung Tse'),
  },
  sea: {
    first: P('Chanathip Teerasil Supachok Theerathon Suphanat Sarach Kritsada Quang Van Cong Tien Duc Hoang Minh Tuan Thanh Faisal Safawi Arif Syahmi Akhyar Neil Stephan Patrick Jefferson Manny Aung Maung Htet Kyaw Chan Keo Sieng Bounphachan Soukaphone Ikhsan Hariss Irfan Shawal Adam'),
    last: P('Songkrasin Dangda Sarachat Bunmathan Mueanta Yooyen Kaman Nguyen Tran Le Pham Hoang Phan Vu Dang Bui Do Halim Rasid Aiman Rashid Zakuan Etheridge Schrock Reichelt Ott Lin Thu Aung Tun Oo Vathanaka Polroth Chanthea Vongchiengkham Fandi Anuar Suzliman Baharudin'),
  },
  jp: {
    first: P('Haruto Ren Sota Yuto Kaito Riku Hinata Daiki Shun Takumi Kenta Ryo Yuki Kota Sho Tatsuya Hayato Naoki Itsuki Asahi Keita Tsubasa Masato Akira Jun Shinji Kazuki Taiga Rui Minato Koki Wataru Takehiro Kaoru Daichi Ritsu Ao Reo Hidemasa Junya Keito Yuito Zion Shuto Koji'),
    last: P('Sato Suzuki Takahashi Tanaka Watanabe Ito Yamamoto Nakamura Kobayashi Kato Yoshida Yamada Sasaki Yamaguchi Matsumoto Inoue Kimura Hayashi Shimizu Yamazaki Mori Abe Ikeda Hashimoto Ishikawa Ogawa Okada Hasegawa Fujita Goto Murakami Kondo Sakamoto Endo Aoki Fujii Nishimura Fukuda Ota Miura Maeda Ueda Morita Machida Nakayama Sugawara Hatate Soma Kubo Doan'),
  },
  kr: {
    first: P('Min-jun Seo-jun Do-yun Ji-ho Ha-jun Joon-woo Hyun-woo Ji-hoon Woo-jin Sung-min Jae-sung Heung-min Kang-in Hee-chan In-beom Young-woo Seung-ho Gue-sung Tae-hwan Jin-su Chang-hoon Dong-jun Sang-ho Jun-ho Hyeon-gyu'),
    last: P('Kim Lee Park Choi Jung Kang Cho Yoon Jang Lim Han Oh Seo Shin Kwon Hwang Ahn Song Yoo Hong Jeon Ko Moon Yang Son Bae Baek Heo Nam Hwangbo'),
  },
};

export const COACH_FIRST = P('Marco Stefan Antonio Roberto Thomas Julian Carlos Luis Pep Jürgen Mikel Unai Xabi Vincent Andoni Eddie Kieran Graham Sean Rafael Diego Mauricio Erik Roger Ralf Hansi Didier Luciano Massimiliano Simone Gian Sérgio Rúben Nuno Régis Franck Will Daniel Russell Scott Gary Paul Nathan Liam Michael Mark');
export const COACH_LAST = P('Albrecht Varela Montero Castellan Whitlock Farnsworth Okafor-Reyes Lindqvist Baumgart Rinaldi Deschain Morano Ferreira-Luz Hartwell Sandoval Kovač Ivanek Brennan Achterberg Vandermeer Solano Marchetti Delacroix Tanaka Oyelaran Castellanos Ruggeri Halvorsen Petrakis Ashdown Villanueva Montgomery Sterling-Hale Navarrete Eriksen-Dahl Beaumont Carrington Zambrano Holloway Thorne');
