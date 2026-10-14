import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './providers/ThemeProvider';
import { ConnectionBanner } from './components/ConnectionBanner/ConnectionBanner';
import { KioskScreen } from './components/KioskScreen/KioskScreen';
import { Dashboard } from './pages/Dashboard/Dashboard';
import './index.css';

const Analytics = lazy(() =>
  import('./pages/Analytics/Analytics').then((module) => ({
    default: module.Analytics,
  })),
);

const Camera = lazy(() =>
  import('./pages/Camera/Camera').then((module) => ({
    default: module.Camera,
  })),
);

const NfcManagement = lazy(() =>
  import('./pages/NfcManagement/NfcManagement').then((module) => ({
    default: module.NfcManagement,
  })),
);

const Weather = lazy(() =>
  import('./pages/Weather/Weather').then((module) => ({
    default: module.Weather,
  })),
);

const LedControl = lazy(() =>
  import('./pages/LedControl/LedControl').then((module) => ({
    default: module.LedControl,
  })),
);

const Settings = lazy(() =>
  import('./pages/Settings/Settings').then((module) => ({
    default: module.Settings,
  })),
);

function RouteLoadingFallback() {
  return <div className="route-loading">Yukleniyor...</div>;
}

function App() {
  return (
    <ThemeProvider>
      <ConnectionBanner />
      <KioskScreen />
      <BrowserRouter>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/camera" element={<Camera />} />
            <Route path="/nfc" element={<NfcManagement />} />
            <Route path="/weather" element={<Weather />} />
            <Route path="/led" element={<LedControl />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
