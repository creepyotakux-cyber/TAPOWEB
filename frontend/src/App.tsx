import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Config } from './pages/Config';
import { Recordings } from './pages/Recordings';
import { Dvr } from './pages/Dvr';
import { api } from './lib/api';

export default function App() {
  const [page, setPage] = useState(() => sessionStorage.getItem('activePage') || 'dashboard');
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    sessionStorage.setItem('activePage', page);
  }, [page]);

  useEffect(() => {
    api.getSettings().then(s => {
      setTheme(s.theme);
      document.documentElement.classList.toggle('light', s.theme === 'light');
    });
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('light', next === 'light');
    api.updateSettings({ theme: next });
  }, [theme]);

  return (
    <div className="h-full flex">
      <Sidebar page={page} onNavigate={setPage} theme={theme} onToggleTheme={toggleTheme} />
      <div className="flex-1 h-full overflow-hidden relative">
        <div className={page === 'dashboard' ? 'h-full' : 'h-full hidden'}>
          <Dashboard />
        </div>
        {page === 'config' && <Config />}
        {page === 'dvr' && <Dvr />}
        {page === 'recordings' && <Recordings />}
      </div>
    </div>
  );
}
