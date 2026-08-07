export interface AuthUser {
  username: string;
  role: string;
  allowed_camera_ids: string[];
}

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

let _token: string | null = localStorage.getItem(TOKEN_KEY);
let _user: AuthUser | null = null;

try {
  const raw = localStorage.getItem(USER_KEY);
  if (raw) _user = JSON.parse(raw);
} catch {
  _user = null;
}

let _listeners: Array<() => void> = [];

function notify() {
  for (const fn of _listeners) fn();
}

export function getToken(): string | null {
  return _token;
}

export function getUser(): AuthUser | null {
  return _user;
}

export function isAuthenticated(): boolean {
  return _token !== null && _user !== null;
}

export function login(token: string, user: AuthUser) {
  _token = token;
  _user = user;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notify();
}

export function logout() {
  _token = null;
  _user = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notify();
}

export function subscribe(fn: () => void): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}
