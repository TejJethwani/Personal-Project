import { Component, type ReactNode } from 'react';
import { GameShell, Toasts } from './components/Shell';
import { DriverProfileModal } from './components/DriverProfile';
import { TeamProfileModal } from './components/TeamProfile';
import { NegotiationModal } from './components/Negotiation';
import { RaceResultModal } from './components/RaceResultModal';
import { useStore } from './store/gameStore';
import { TitleScreen } from './pages/TitleScreen';
import { NewCareer } from './pages/NewCareer';
import { Headquarters } from './pages/Headquarters';
import { DriversPage } from './pages/Drivers';
import { MarketPage } from './pages/Market';
import { CarPage } from './pages/CarDevelopment';
import { RaceCenter } from './pages/race/RaceCenter';
import { ChampionshipPage } from './pages/Championship';
import { FinancesPage } from './pages/Finances';
import { StaffPage } from './pages/StaffFacilities';
import { NewsPage } from './pages/News';
import { HistoryPage } from './pages/History';
import { SettingsPage } from './pages/Settings';
import { SeasonReview } from './pages/SeasonReview';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto mt-24 max-w-xl rounded-xl border border-red-900 bg-red-950/40 p-6 text-sm">
          <h2 className="font-display text-2xl font-bold uppercase">Something went wrong</h2>
          <p className="mt-2 text-red-200">{this.state.error.message}</p>
          <p className="mt-4 text-apex-muted">Your progress is autosaved. Reload the page and choose Continue on the title screen.</p>
          <button className="mt-4 rounded bg-apex-red px-4 py-2 font-semibold" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function GamePages() {
  const page = useStore((s) => s.page);
  switch (page) {
    case 'hq':
      return <Headquarters />;
    case 'drivers':
      return <DriversPage />;
    case 'market':
      return <MarketPage />;
    case 'car':
      return <CarPage />;
    case 'race':
      return <RaceCenter />;
    case 'championship':
      return <ChampionshipPage />;
    case 'finances':
      return <FinancesPage />;
    case 'staff':
      return <StaffPage />;
    case 'news':
      return <NewsPage />;
    case 'history':
      return <HistoryPage />;
    case 'settings':
      return <SettingsPage />;
    case 'seasonReview':
      return <SeasonReview />;
  }
}

export function App() {
  const screen = useStore((s) => s.screen);
  return (
    <ErrorBoundary>
      {screen === 'title' && <TitleScreen />}
      {screen === 'newCareer' && <NewCareer />}
      {screen === 'game' && (
        <GameShell>
          <GamePages />
          <DriverProfileModal />
          <TeamProfileModal />
          <NegotiationModal />
          <RaceResultModal />
        </GameShell>
      )}
      <Toasts />
    </ErrorBoundary>
  );
}
