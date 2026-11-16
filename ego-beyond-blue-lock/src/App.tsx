import { useEffect } from 'react';
import { useStore, nav, toggleNav } from './store/game';
import { Icon, Ovr, ClubBadge } from './ui/kit';
import { ovr } from './engine/attributes';
import { fmtDate, seasonLabel } from './engine/competitions';
import { nextStop } from './engine/sim';
import { pendingInteractions } from './engine/interactions';
import { openOffers } from './engine/transfers';
import { continueGame, simWeeks, ceremonyDue, galaDue } from './ui/flow';
import { HallOfFame } from './screens/HallOfFame';
import { Ceremony } from './screens/Ceremony';
import { Admin } from './screens/Admin';
import { MatchSim } from './screens/MatchSim';
import { isAdmin } from './storage/accounts';
import { Menu } from './screens/Menu';
import { Creator } from './screens/Creator';
import { Hub } from './screens/Hub';
import { PlayerScreen } from './screens/Player';
import { Weapons } from './screens/Weapons';
import { Training } from './screens/Training';
import { Squad, ClubScreen } from './screens/Squad';
import { Relationships } from './screens/Relationships';
import { MatchCentre } from './screens/Match';
import { NelBids, NelSummaryScreen } from './screens/Nel';
import { Competitions } from './screens/Competitions';
import { Stats } from './screens/Stats';
import { Awards } from './screens/Awards';
import { Transfers } from './screens/Transfers';
import { NewsScreen, History } from './screens/News';
import { Settings } from './screens/Settings';

const NAV: [string, string, string][] = [
  ['hub', 'Career Hub', 'hub'], ['player', 'Profile', 'player'], ['weapons', 'Weapons', 'weapon'], ['training', 'Training', 'training'], ['squad', 'Squad & Tactics', 'squad'],
  ['relationships', 'Relationships', 'people'], ['match', 'Match Centre', 'match'], ['bids', 'NEL Bids', 'bids'], ['competitions', 'Tables & Fixtures', 'table'], ['stats', 'Statistics', 'stats'],
  ['awards', 'Awards', 'award'], ['transfers', 'Transfers', 'transfer'], ['news', 'News', 'news'], ['history', 'Career History', 'history'], ['hof', 'Hall of Fame', 'award'], ['settings', 'Settings', 'settings'],
];

export function App() {
  const { g, ui } = useStore();
  const r = ui.route;
  useEffect(() => { document.body.classList.toggle('rm', !!g?.settings.reduceMotion); }, [g?.settings.reduceMotion]);
  useEffect(() => { if (!g && r.name !== 'menu' && r.name !== 'create' && r.name !== 'admin' && r.name !== 'sim') nav('menu'); }, [g, r.name]);
  const overlays = (
    <>
      {ui.busy && <div className="busy" role="status"><div>{ui.busy}</div></div>}
      {ui.moment && <div className={`moment ${ui.moment.kind ?? ''}`} aria-live="assertive"><div><div className="mt1">{ui.moment.t1}</div>{ui.moment.t2 && <div className="mt2">{ui.moment.t2}</div>}</div></div>}
      <div className="toastwrap" aria-live="polite">{ui.toasts.map((t) => <div key={t.id} className={`toast ${t.bad ? 'bad' : ''}`}>{t.text}</div>)}</div>
    </>
  );
  if (r.name === 'admin') return <><Admin />{overlays}</>;
  if (r.name === 'sim') return <><MatchSim />{overlays}</>;
  if (!g || r.name === 'menu' || r.name === 'create') return <>{r.name === 'create' ? <Creator /> : <Menu />}{overlays}</>;
  const w = g.world;
  const me = w.players[g.career.pid];
  const stop = nextStop(g);
  const pend = pendingInteractions(g).length, offers = openOffers(g).length;
  const screen = (() => {
    switch (r.name) {
      case 'player': return <PlayerScreen g={g} id={r.id ?? me.id} />;
      case 'weapons': return <Weapons g={g} />;
      case 'training': return <Training g={g} />;
      case 'squad': return <Squad g={g} />;
      case 'club': return <ClubScreen g={g} id={r.id ?? me.club ?? ''} />;
      case 'relationships': return <Relationships g={g} tab={r.id} />;
      case 'match': return <MatchCentre g={g} />;
      case 'bids': return <NelBids g={g} />;
      case 'nelsummary': return <NelSummaryScreen g={g} />;
      case 'competitions': return <Competitions g={g} id={r.id} />;
      case 'stats': return <Stats g={g} />;
      case 'awards': return <Awards g={g} />;
      case 'transfers': return <Transfers g={g} />;
      case 'news': return <NewsScreen g={g} />;
      case 'history': return <History g={g} />;
      case 'hof': return <HallOfFame g={g} />;
      case 'ceremony': return <Ceremony g={g} />;
      case 'settings': return <Settings g={g} />;
      default: return <Hub g={g} />;
    }
  })();
  return (
    <div className="app">
      <aside className={`side ${ui.navOpen ? 'open' : ''}`}>
        <div className="brand"><b>EGO</b><span>Beyond Blue Lock</span></div>
        <nav className="nav" aria-label="Main">
          {NAV.filter(([id]) => id !== 'bids' || w.nel.round > 0 || w.phase === 'nel').map(([id, label, icon]) => (
            <button key={id} className={r.name === id || (id === 'squad' && r.name === 'club') ? 'on' : ''} onClick={() => nav(id)} aria-current={r.name === id ? 'page' : undefined}>
              <Icon n={icon} />{label}
              {id === 'relationships' && pend > 0 && <span className="pip">{pend}</span>}
              {id === 'transfers' && offers > 0 && <span className="pip">{offers}</span>}
            </button>
          ))}
          <div className="sep" />
          {isAdmin() && <button onClick={() => nav('admin')}><Icon n="settings" />Admin panel</button>}
          <button onClick={() => nav('menu')}><Icon n="save" />Main Menu</button>
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <button className="btn sm ghost mobnav" onClick={toggleNav} aria-label="Open menu"><Icon n="menu" /></button>
          <button className="link row gap6" onClick={() => nav('player')}><Ovr v={ovr(me)} size="sm" /><b>{me.name}</b></button>
          {me.club && <span className="row gap6 hide-s"><ClubBadge g={g} id={me.club} /><span className="muted">{w.clubs[me.club]?.sn}</span></span>}
          {g.edited && <span className="chip w" title="This save has been changed with the sandbox editor.">Edited save</span>}
          <span className="grow" />
          <span className="muted small hide-s">{w.phase === 'nel' ? 'Neo Egoist League' : seasonLabel(w.season)} · {fmtDate(w, w.day, true)}</span>
          {ceremonyDue(g) && r.name !== 'ceremony' && <button className="btn pulse" onClick={() => nav('ceremony')}>{galaDue(g) ? "🏆 Ballon d'Or gala" : '🏆 Awards ceremony'}</button>}
          {!g.live && stop.kind !== 'retired' && <select className="simsel" aria-label="Simulate several weeks" value="" onChange={(e) => { const v = +e.target.value; e.target.value = ''; if (v) simWeeks(v); }}><option value="">Sim ahead…</option><option value="1">1 week</option><option value="2">2 weeks</option><option value="4">4 weeks</option><option value="8">8 weeks</option><option value="13">3 months</option><option value="26">Half a season</option><option value="52">A full year</option></select>}
          <button className={`btn pri ${stop.kind !== 'none' ? 'pulse' : ''}`} onClick={() => continueGame()} disabled={stop.kind === 'retired'} title={stop.detail}><Icon n="play" s={14} />{stop.label.length > 34 ? stop.label.slice(0, 32) + '…' : stop.label}</button>
        </div>
        <div className="page" key={r.name + (r.id ?? '')}>{screen}</div>
      </main>
      {overlays}
    </div>
  );
}
