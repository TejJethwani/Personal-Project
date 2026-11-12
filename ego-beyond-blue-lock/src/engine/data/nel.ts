/**
 * EDITABLE Neo Egoist League roster file.
 *
 * Everything here is data: change ratings, positions, teams or add players and start a new
 * career. Each entry carries a `canon` confidence label that the game shows on player pages:
 *   'canon'     – recognisable placement, confident
 *   'likely'    – probably right, not certain
 *   'uncertain' – the character exists but the team/role here is a guess
 *   'original'  – an original fictional youth player created for this game (NOT canon)
 * Ratings, potentials, ages and attribute styles are this game's own estimates on its 1–99 scale.
 *
 * Row: name | short | pos | alt positions | age | OVR | POT | nation | abilities | ego 0-100 | canon | hair colour | style
 * abilities: comma list of ability ids, optional ":level" (first weapon is the signature weapon)
 */
export interface NelRow { name: string; sn: string; pos: string; pos2: string[]; age: number; ovr: number; pot: number; nat: string; ab: string[]; ego: number; canon: string; hair: string; style: string; bl: boolean }

function rows(src: string, bl: boolean): NelRow[] {
  return src.trim().split('\n').map((l) => {
    const c = l.split('|').map((x) => x.trim());
    return { name: c[0], sn: c[1], pos: c[2], pos2: c[3] ? c[3].split(',') : [], age: +c[4], ovr: +c[5], pot: +c[6], nat: c[7], ab: c[8] ? c[8].split(',') : [], ego: +c[9], canon: c[10], hair: c[11] || '', style: c[12] || 'balanced', bl };
  });
}

/** Blue Lock project players (Japan-eligible) by NEL team. */
export const NEL_BLUELOCK: Record<string, NelRow[]> = {
  nel_bastard: rows(`
Yoichi Isagi|Isagi|SS|AM,ST|17|82|96|JPN|direct_shot:2,panoramic:2,spatial,adaptive,zero_frame|88|canon|#1d2b4f|poacher
Rensuke Kunigami|Kunigami|ST|RW|18|83|91|JPN|long_cannon:2,two_footed,iron_body|80|canon|#e8742a|shooter
Ranze Kurona|Kurona|LB|LW,LM|17|78|87|JPN|one_touch:2,speed_burst,catalyst|60|canon|#c2456b|speedster
Yo Hiori|Hiori|CM|LB,AM|17|80|92|JPN|disguised_pass:2,panoramic,ice_veins|62|canon|#8ecae6|playmaker
Kenyu Yukimiya|Yukimiya|LW|RW|18|80|88|JPN|feint_master:2,speed_burst|78|canon|#6b4a2b|dribbler
Jingo Raichi|Raichi|DM|CM,CB|18|76|84|JPN|ball_hunter:2,tireless|82|canon|#e9c46a|engine
Gin Gagamaru|Gagamaru|GK||18|78|89|JPN||55|canon|#2b2b2b|shotstopper
Gurimu Igaguri|Igaguri|CM|ST|17|68|77|JPN|press_resist|58|canon|#3a3a3a|engine
Jin Kiyora|Kiyora|LW|ST|18|73|82|JPN|counter_run|60|likely|#f1f1f1|speedster
`, true),
  nel_manshine: rows(`
Seishiro Nagi|Nagi|SS|ST,LW|17|83|95|JPN|trap_genius:2,box_predator,adaptive|72|canon|#e9ecef|complete
Reo Mikage|Reo|CM|AM,CB|17|81|90|JPN|panoramic,press_resist,adaptive,catalyst|70|canon|#7b4bb3|playmaker
Hyoma Chigiri|Chigiri|RW|LW,RB|17|81|90|JPN|speed_burst:2,counter_run,late_engine|75|canon|#d1345b|speedster
Okuhito Agi|Agi|CB|DM|18|73|81|JPN|aerial_dom|55|uncertain|#3d405b|stopper
Wataru Kuon|Kuon|ST|CB|18|70|78|JPN|aerial_dom|62|uncertain|#577590|target
Yudai Imamura|Imamura|RW|ST|18|69|77|JPN|speed_burst|58|uncertain|#b08968|speedster
`, true),
  nel_barcha: rows(`
Meguru Bachira|Bachira|LW|SS,AM|17|83|93|JPN|tight_dribble:2,feint_master:2,flow_seeker,monster_trance|80|canon|#f4d35e|dribbler
Eita Otoya|Otoya|RW|LW|17|79|87|JPN|blindside:2,speed_burst|68|canon|#9bd4c4|speedster
Kyohei Himizu|Himizu|CM|AM|18|72|80|JPN|press_resist|52|uncertain|#a8dadc|playmaker
Ryosuke Kira|Kira|ST|SS|17|69|79|JPN|box_predator|70|uncertain|#f6bd60|poacher
Teru Kitsunezato|Kitsunezato|RB|RM|19|71|78|JPN|whip_cross|50|uncertain|#e07a5f|wingback
`, true),
  nel_ubers: rows(`
Shoei Barou|Barou|ST|LW|18|85|93|JPN|long_cannon:2,feint_master,shield,rival_focus,big_stage|97|canon|#111111|shooter
Oliver Aiku|Aiku|CB|DM|19|82|88|JPN|interceptor:2,panoramic,spatial|74|canon|#2a2a2a|ballplayer
Ikki Niko|Niko|DM|CM,CB|16|78|89|JPN|interceptor:2,spatial,adaptive|64|canon|#6c757d|anchor
Jyubei Aryu|Aryu|CB|ST|18|77|85|JPN|aerial_dom:2,shield|72|canon|#22223b|stopper
Shuto Sendou|Sendou|ST|SS|19|76|82|JPN|box_predator,direct_shot|70|canon|#8d5524|poacher
Gen Fukaku|Fukaku|GK||19|76|83|JPN||50|uncertain|#343a40|shotstopper
Hayate Darai|Darai|CB|RB|19|74|80|JPN|ball_hunter|52|uncertain|#495057|stopper
`, true),
  nel_pxg: rows(`
Rin Itoshi|Rin|ST|SS,AM|16|87|97|JPN|curve_finish:2,panoramic:2,tempo_control,ice_veins,rival_focus,field_dominion|93|canon|#1b4332|complete
Ryusei Shidou|Shidou|ST|SS|18|86|93|JPN|box_predator:3,direct_shot,second_ball,dead_angle_genesis|95|canon|#ff70a6|poacher
Tabito Karasu|Karasu|DM|CM,AM|18|80|87|JPN|press_resist:2,shield,spatial|70|canon|#3c096c|anchor
Tsurugi Zantetsu|Zantetsu|LW|RW|17|77|85|JPN|speed_burst:2,counter_run|65|canon|#4a4e69|speedster
Aoshi Tokimitsu|Tokimitsu|RW|CM,RB|17|77|86|JPN|speed_burst,shield,tireless|40|canon|#52b788|engine
Nijiro Nanase|Nanase|CM|LW|16|73|83|JPN|one_touch,catalyst|48|canon|#ffd6a5|playmaker
Kazuma Wakatsuki|Wakatsuki|DM|CM|19|72|78|JPN|ball_hunter|50|uncertain|#6d6875|engine
`, true),
};

/** International youth players attached to each NEL club (not part of the Blue Lock ranking). */
export const NEL_YOUTH: Record<string, NelRow[]> = {
  nel_bastard: rows(`
Michael Kaiser|Kaiser|ST|SS|19|89|96|GER|direct_shot:4,curve_finish:2,panoramic:2,ice_veins,big_stage,zero_frame|99|canon|#f6e27f|complete
Alexis Ness|Ness|AM|CM|19|85|91|GER|disguised_pass:3,tempo_control,catalyst,puppet_master|66|canon|#c77dff|playmaker
Erik Gesner|Gesner|RW|LW|19|79|85|GER|speed_burst,counter_run|62|likely|#adb5bd|speedster
Benedikt Grim|Grim|CM|ST|19|79|85|GER|aerial_dom,shield|60|likely|#6c584c|engine
Birkenstock|Birkenstock|CB||19|78|84|GER|ball_hunter|55|likely|#dda15e|stopper
Lukas Hartwig|Hartwig|CB|RB|18|75|83|GER|interceptor|50|original||ballplayer
Jonas Köhler|Köhler|RB|RM|18|74|82|GER|whip_cross|48|original||wingback
Emre Aydin|Aydin|DM|CM|19|74|81|GER|ball_hunter|55|original||anchor
Niklas Vogt|Vogt|GK||19|72|80|GER||45|original||sweeper
Tim Sauer|Sauer|LB|CB|18|73|81|GER||45|original||stopper
`, false),
  nel_manshine: rows(`
Callum Ashby|Ashby|GK||19|76|84|ENG||50|original||shotstopper
Marcus Oyelaran|Oyelaran|CB||19|78|85|ENG|aerial_dom|58|original||stopper
Declan Frost|Frost|CB|DM|18|76|84|ENG|interceptor|52|original||ballplayer
Theo Lockhart|Lockhart|LB|LM|18|76|83|ENG|speed_burst|55|original||wingback
Reggie Okoro|Okoro|RB|RW|19|76|83|ENG|counter_run|58|original||speedster
Jude Whitlock|Whitlock|DM|CM|19|78|85|ENG|ball_hunter,tireless|60|original||engine
Finley Hartson|Hartson|CM|AM|18|77|86|ENG|disguised_pass|57|original||playmaker
Ellis Garrick|Garrick|LW|RW|18|78|86|ENG|feint_master|68|original||dribbler
Kofi Adebayo|Adebayo|ST||19|79|85|ENG|shield,aerial_dom|70|original||target
Rhys Pemberton|Pemberton|RM|RB|18|74|81|WAL|whip_cross|50|original||wingback
Aidan Kerr|Kerr|CM|DM|19|74|80|SCO|press_resist|52|original||engine
`, false),
  nel_barcha: rows(`
Bunny Iglesias|Bunny|LW|ST|18|82|90|ESP|feint_master:2,blindside,flow_seeker|78|canon|#ffafcc|dribbler
Iker Zubiri|Zubiri|GK||19|77|85|ESP||50|original||sweeper
Pau Ferrer|Ferrer|CB|DM|18|78|86|ESP|interceptor|55|original||ballplayer
Unai Etxarri|Etxarri|CB||19|77|84|ESP|ball_hunter|58|original||stopper
Álex Moreno|Moreno|LB|LM|18|76|84|ESP|whip_cross|52|original||wingback
Dani Roca|Roca|RB|RM|19|76|83|ESP|speed_burst|55|original||wingback
Marc Vidal|Vidal|DM|CM|19|78|85|ESP|press_resist,tempo_control|60|original||anchor
Nico Sarabia|Sarabia|CM|AM|17|79|88|ESP|disguised_pass:2|62|original||playmaker
Thiago Luján|Luján|AM|CM|18|78|87|ARG|tight_dribble|70|original||dribbler
Hugo Benítez|Benítez|ST|SS|19|78|84|ESP|box_predator|72|original||poacher
Joel Castaño|Castaño|RW|LW|18|76|84|ESP|counter_run|58|original||speedster
`, false),
  nel_ubers: rows(`
Don Lorenzo|Lorenzo|CB|DM,LB|18|86|93|ITA|ball_hunter:3,interceptor:2,iron_body,tireless,iron_curtain|76|canon|#f5cb5c|stopper
Matteo Brivio|Brivio|CB||19|78|84|ITA|aerial_dom|55|original||stopper
Luca Ferrante|Ferrante|LB|LM|18|76|83|ITA|whip_cross|50|original||wingback
Davide Monti|Monti|RB|RM|19|76|83|ITA|speed_burst|52|original||wingback
Simone Valletti|Valletti|DM|CM|19|78|85|ITA|interceptor,spatial|58|original||anchor
Giacomo Sorrentino|Sorrentino|CM|AM|18|78|86|ITA|disguised_pass|60|original||playmaker
Pietro Lanza|Lanza|CM|DM|19|76|82|ITA|press_resist|55|original||engine
Nicolò Baresi|Baresi|SS|ST|18|77|85|ITA|blindside|68|original||poacher
Enrico Galli|Galli|GK||18|73|82|ITA||45|original||shotstopper
`, false),
  nel_pxg: rows(`
Charles Chevalier|Charles|AM|CM|15|84|94|FRA|disguised_pass:3,tempo_control:2,flow_seeker,puppet_master|74|canon|#ffd60a|playmaker
Mathis Roussel|Roussel|GK||19|77|85|FRA||50|original||shotstopper
Ibrahima Kanté|Kanté|CB||19|79|86|FRA|aerial_dom,ball_hunter|58|original||stopper
Loïc Marchand|Marchand|CB|DM|18|77|85|FRA|interceptor|52|original||ballplayer
Yanis Belkacem|Belkacem|LB|LW|18|77|85|FRA|speed_burst|60|original||wingback
Enzo Delmas|Delmas|RB|RM|19|76|83|FRA|whip_cross|52|original||wingback
Moussa Diakité|Diakité|DM|CM|19|78|85|FRA|ball_hunter,tireless|60|original||engine
Théo Garnier|Garnier|CM|AM|18|76|84|FRA|press_resist|55|original||playmaker
Rayan Hamidi|Hamidi|RW|LW|18|77|85|FRA|feint_master|66|original||dribbler
`, false),
};

/** Master strikers: senior stars of the parent clubs. They coach the NEL teams and may play only via Star Change. */
export const NEL_MASTERS: Record<string, NelRow> = {
  nel_bastard: rows(`Noel Noa|Noa|ST|SS|31|96|96|FRA|two_footed:5,direct_shot:5,speed_burst:4,panoramic:4,ice_veins:4,big_stage:4,zero_frame:4|90|canon|#e5e5e5|complete`, false)[0],
  nel_manshine: rows(`Chris Prince|Prince|RW|ST|29|94|94|ENG|speed_burst:5,long_cannon:4,shield:4,iron_body:5,tireless:4,god_sprint:4|88|canon|#f4c95d|complete`, false)[0],
  nel_barcha: rows(`Lavinho|Lavinho|LW|SS|27|93|93|BRA|feint_master:5,tight_dribble:5,curve_finish:3,flow_seeker:5,monster_trance:5|92|canon|#2d6a4f|dribbler`, false)[0],
  nel_ubers: rows(`Marc Snuffy|Snuffy|SS|ST,AM|34|92|92|ITA|panoramic:5,disguised_pass:4,box_predator:4,spatial:5,ice_veins:4,field_dominion:4|70|canon|#9d4edd|complete`, false)[0],
  nel_pxg: rows(`Julian Loki|Loki|RW|ST|17|93|97|FRA|speed_burst:5,counter_run:5,feint_master:3,late_engine:4,god_sprint:5|85|canon|#bde0fe|speedster`, false)[0],
};

/**
 * Other notable Blue Lock-universe players placed directly into senior clubs.
 * Club placements for the "world five" are NOT canon — edit freely.
 * Extra columns: club id.
 */
export const WORLD_EXTRA: { club: string; row: NelRow }[] = [
  { club: 'esp1_rma', row: rows(`Sae Itoshi|Sae|AM|CM|18|88|96|JPN|disguised_pass:4,tempo_control:3,panoramic:3,ice_veins:3,puppet_master:3|90|likely|#c1666b|playmaker`, true)[0] },
  { club: 'esp1_rma', row: rows(`Leonardo Luna|Luna|LW|ST|22|90|94|ESP|feint_master:4,curve_finish:3,big_stage:3,dead_angle_genesis:3|94|likely|#f8f9fa|dribbler`, false)[0] },
  { club: 'eng1_ars', row: rows(`Adam Blake|Blake|ST|SS|25|90|92|ENG|shield:4,box_predator:4,aerial_dom:3,iron_body:3,sky_tyrant:3|86|uncertain|#343a40|target`, false)[0] },
  { club: 'esp1_atm', row: rows(`Pablo Cavazos|Cavazos|AM|SS|22|90|94|ARG|tight_dribble:4,disguised_pass:3,flow_seeker:3,monster_trance:3|84|uncertain|#6f4518|dribbler`, false)[0] },
  { club: 'ita1_nap', row: rows(`Dada Silva|Dada Silva|ST|RW|24|91|93|BRA|long_cannon:4,speed_burst:4,shield:3,tireless:3,god_sprint:3|88|uncertain|#3a2618|shooter`, false)[0] },
];

/**
 * Known canonical NEL results. Only used when the "canonical outcomes may change" setting is OFF:
 * fixtures listed here that do not involve the user's team are steered to the listed winner.
 * Leave a pairing out to let it be simulated freely. Confidence is noted per entry.
 */
export const NEL_CANON_RESULTS: { a: string; b: string; winner: string; score: [number, number]; confidence: string }[] = [
  { a: 'nel_bastard', b: 'nel_manshine', winner: 'nel_bastard', score: [3, 2], confidence: 'canon' },
  { a: 'nel_bastard', b: 'nel_barcha', winner: 'nel_bastard', score: [3, 2], confidence: 'likely' },
  { a: 'nel_ubers', b: 'nel_bastard', winner: 'nel_ubers', score: [3, 2], confidence: 'likely' },
  { a: 'nel_bastard', b: 'nel_pxg', winner: 'nel_bastard', score: [3, 2], confidence: 'canon' },
];
