import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './providers/ThemeProvider';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { Analytics } from './pages/Analytics/Analytics';
import { Camera } from './pages/Camera/Camera';
import { NfcManagement } from './pages/NfcManagement/NfcManagement';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/camera" element={<Camera />} />
          <Route path="/nfc" element={<NfcManagement />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;