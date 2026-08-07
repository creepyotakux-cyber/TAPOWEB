import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { Dashboard } from './pages/Dashboard';
import { Config } from './pages/Config';
import { Recordings } from './pages/Recordings';
import { Dvr } from './pages/Dvr';
import { Login } from './pages/Login';
import { api } from './lib/api';
import { isAuthenticated, getToken, getUser, subscribe, logout } from './lib/auth';
import { useIsMobile } from './hooks/useIsMobile';

export default function App() {
  const [auth, setAuth] = useState(isAuthenticated);
  const isMobile = useIsMobile();
  const [page, setPage] = useState(() => sessionStorage.getItem('activePage') || 'dashboard');
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    return subscribe(() => setAuth(isAuthenticated()));
  }, []);

  useEffect(() => {
    sessionStorage.setItem('activePage', page);
  }, [page]);

  useEffect(() => {
    if (!auth) return;
    api.getSettings().then(s => {
      setTheme(s.theme);
      document.documentElement.classList.toggle('light', s.theme === 'light');
    }).catch(err => {
      if (err.message?.includes('Token')) logout();
    });
  }, [auth]);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('light', next === 'light');
    api.updateSettings({ theme: next }).catch(() => {});
  }, [theme]);

  const handleLogin = useCallback(() => {
    setAuth(true);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    setAuth(false);
  }, []);

  const user = getUser();
  const role = user?.role ?? '';

  if (!auth) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="h-full flex">
      {!isMobile && <Sidebar page={page} onNavigate={setPage} theme={theme} onToggleTheme={toggleTheme} role={role} onLogout={handleLogout} />}
      <div className="flex-1 h-full overflow-hidden flex flex-col min-w-0">
        <div className="flex-1 min-h-0 relative">
          <div className={page === 'dashboard' ? 'h-full' : 'h-full hidden'}>
            <Dashboard />
          </div>
          {page === 'config' && role === 'baseadv' && <Config />}
          {page === 'dvr' && <Dvr />}
          {page === 'recordings' && <Recordings />}
        </div>
        {isMobile && <MobileNav page={page} onNavigate={setPage} theme={theme} onToggleTheme={toggleTheme} role={role} onLogout={handleLogout} />}
      </div>
    </div>
  );
}
