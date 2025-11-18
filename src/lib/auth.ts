// Authentication utilities with toggleable Netlify Identity integration.
// Default remains the existing test login until explicitly enabled.
export interface User {
  email: string;
  role: 'customer' | 'employee' | 'admin';
  name: string;
}

type AuthMode = 'test' | 'identity' | 'supabase';

function getEnvAuthMode(): AuthMode {
  try {
    const envMode = (import.meta as any)?.env?.VITE_AUTH_MODE as AuthMode | undefined;
    if (envMode === 'identity' || envMode === 'test' || envMode === 'supabase') return envMode;
  } catch {}
  return 'test';
}

export function getAuthMode(): AuthMode {
  const stored = localStorage.getItem('auth_mode');
  if (stored === 'identity' || stored === 'test') return stored as AuthMode;
  return getEnvAuthMode();
}

export function isIdentityEnabled(): boolean {
  return getAuthMode() === 'identity';
}

export function isSupabaseEnabled(): boolean {
  return getAuthMode() === 'supabase';
}

export function setAuthMode(mode: AuthMode) {
  localStorage.setItem('auth_mode', mode);
  if (mode === 'identity') {
    initIdentity();
  }
}

const QUICK_ACCESS_USERS = {
  customer: {
    email: 'customer@gmail.com',
    role: 'customer' as const,
    name: 'Customer User'
  },
  employee: {
    email: 'employee@gmail.com',
    role: 'employee' as const,
    name: 'Employee User'
  },
  admin: {
    email: 'admin@gmail.com',
    role: 'admin' as const,
    name: 'Admin User'
  }
};

export function getCurrentUser(): User | null {
  if (isIdentityEnabled()) {
    try {
      const user = identityCurrentUser();
      if (user) return user;
    } catch {}
  }
  if (isSupabaseEnabled()) {
    const cached = localStorage.getItem('currentUser');
    if (cached) return JSON.parse(cached);
  }
  const stored = localStorage.getItem('currentUser');
  if (!stored) return null;
  return JSON.parse(stored);
}

export function setCurrentUser(user: User | null): void {
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  } else {
    localStorage.removeItem('currentUser');
  }
  try {
    // Notify app of auth state changes in same tab
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: user }));
  } catch {
    // noop
  }
}

export function quickAccessLogin(role: 'customer' | 'employee' | 'admin'): User {
  const user = QUICK_ACCESS_USERS[role];
  setCurrentUser(user);
  return user;
}

// Identity integration
let identityInitialized = false;
let identityListenersRegistered = false;

function ensureIdentityWidget(): Promise<void> {
  return new Promise((resolve) => {
    const w = window as any;
    if (w.netlifyIdentity) {
      resolve();
      return;
    }
    // Avoid double-inject
    if (document.querySelector('script[data-netlify-identity]')) {
      (document.querySelector('script[data-netlify-identity]') as HTMLScriptElement).addEventListener('load', () => resolve());
      return;
    }
    const s = document.createElement('script');
    s.src = '/.netlify/identity/widget.js';
    s.async = true;
    s.defer = true;
    s.setAttribute('data-netlify-identity', 'true');
    s.onload = () => resolve();
    s.onerror = () => resolve(); // Resolve even if not available locally
    document.head.appendChild(s);
  });
}

export function initIdentity(): void {
  if (identityInitialized) return;
  identityInitialized = true;
  ensureIdentityWidget().then(() => {
    const w = window as any;
    const id = w.netlifyIdentity;
    if (!id) return;
    // Initialize to pick up persisted sessions
    try { id.init(); } catch {}
    if (!identityListenersRegistered) {
      identityListenersRegistered = true;
      try {
        id.on('login', (u: any) => {
          const mapped = mapIdentityUser(u);
          setCurrentUser(mapped);
        });
        id.on('logout', () => {
          setCurrentUser(null);
        });
        id.on('init', (u: any) => {
          if (u) setCurrentUser(mapIdentityUser(u));
        });
      } catch {}
    }
  });
}

// Supabase integration
import supabase from './supabase';

export function initSupabaseAuth(): void {
  if (!isSupabaseEnabled()) return;
  try {
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await getSupabaseUserProfile(session.user.id);
        const mapped: User = { email: session.user.email || '', name: profile?.name || (session.user.email || '').split('@')[0], role: (profile?.role as any) || 'customer' };
        setCurrentUser(mapped);
        try { await getSupabaseCustomerProfile(session.user.id); } catch {}
      } else {
        setCurrentUser(null);
      }
    });
  } catch {}
}

async function getSupabaseUserProfile(userId: string): Promise<{ role: 'admin'|'employee'|'customer'; name?: string } | null> {
  try {
    const { data, error } = await supabase.from('app_users').select('role,name').eq('id', userId).maybeSingle();
    if (error) return null;
    return (data as any) || null;
  } catch { return null; }
}

async function getSupabaseCustomerProfile(userId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase.from('customers').select('*').eq('id', userId).maybeSingle();
    if (error) return null;
    if (data) {
      try { localStorage.setItem('customerProfile', JSON.stringify(data)); } catch {}
      try { window.dispatchEvent(new CustomEvent('customer-profile-changed', { detail: data })); } catch {}
    }
    return data || null;
  } catch { return null; }
}

export async function loginSupabase(email: string, password: string): Promise<User | null> {
  if (!isSupabaseEnabled()) return login(email, password);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return null;
    const userId = data.user?.id;
    const profile = userId ? await getSupabaseUserProfile(userId) : null;
    const mapped: User = { email: data.user?.email || email, name: profile?.name || (email.split('@')[0]), role: (profile?.role as any) || 'customer' };
    setCurrentUser(mapped);
    if (userId) { try { await getSupabaseCustomerProfile(userId); } catch {} }
    return mapped;
  } catch {
    return null;
  }
}

export async function signupSupabase(email: string, password: string, name?: string): Promise<User | null> {
  if (!isSupabaseEnabled()) return createAccount(email, password, name || email.split('@')[0]);
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return null;
    const userId = data.user?.id;
    if (userId) {
      try {
        await supabase.from('app_users').upsert({ id: userId, email, role: 'customer', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'id' });
        await supabase.from('customers').upsert({ id: userId, email, name: name || '' , created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'id' });
      } catch {}
    }
    const mapped: User = { email, name: name || (email.split('@')[0]), role: 'customer' };
    setCurrentUser(mapped);
    if (userId) { try { await getSupabaseCustomerProfile(userId); } catch {} }
    return mapped;
  } catch {
    return null;
  }
}

function mapIdentityUser(u: any): User {
  const email: string = u?.email ?? '';
  const name: string = u?.user_metadata?.full_name ?? (email ? email.split('@')[0] : '');
  const roles: string[] = (u?.app_metadata?.roles || u?.user_metadata?.roles || []) as string[];
  let role: 'customer' | 'employee' | 'admin' = 'customer';
  if (roles.includes('admin')) role = 'admin';
  else if (roles.includes('employee')) role = 'employee';
  return { email, name, role };
}

function identityCurrentUser(): User | null {
  const w = window as any;
  const id = w.netlifyIdentity;
  if (!id) return null;
  try {
    const raw = id.currentUser();
    if (!raw) return null;
    return mapIdentityUser(raw);
  } catch {
    return null;
  }
}

export function beginLogin(_roleHint?: 'employee' | 'admin') {
  if (!isIdentityEnabled()) return quickAccessLogin(_roleHint || 'employee');
  initIdentity();
  const w = window as any;
  const id = w.netlifyIdentity;
  if (!id) return null;
  try {
    id.open('login');
  } catch {
    // Fallback: open default
    try { id.open(); } catch {}
  }
  return null;
}

export function login(email: string, password: string): User {
  if (isIdentityEnabled()) {
    // In Identity mode, use the hosted widget; interactive login handled by beginLogin()
    beginLogin();
    const user = identityCurrentUser();
    if (user) return user;
    // Return a neutral customer until widget completes
    return { email, role: 'customer', name: email.split('@')[0] };
  }
  // Determine role based on email
  let role: 'customer' | 'employee' | 'admin' = 'customer';
  
  if (email.toLowerCase().includes('admin')) {
    role = 'admin';
  } else if (email.toLowerCase().includes('employee')) {
    role = 'employee';
  }

  const user: User = {
    email,
    role,
    name: email.split('@')[0]
  };

  setCurrentUser(user);
  return user;
}

export function createAccount(email: string, password: string, name: string): User {
  if (isIdentityEnabled()) {
    initIdentity();
    const w = window as any;
    const id = w.netlifyIdentity;
    // Use widget signup; mapping occurs on 'login' once completed
    try { id.open('signup'); } catch { try { id.open(); } catch {} }
    const user = identityCurrentUser();
    if (user) return user;
    return { email, role: 'customer', name };
  }
  const user: User = {
    email,
    role: 'customer',
    name
  };

  setCurrentUser(user);
  return user;
}

export function logout(): void {
  if (isIdentityEnabled()) {
    try {
      const w = window as any;
      const id = w.netlifyIdentity;
      if (id) id.logout();
    } catch {}
    setCurrentUser(null);
    return;
  }
  if (isSupabaseEnabled()) {
    (async () => { try { await supabase.auth.signOut(); } catch {} })();
    try { localStorage.removeItem('customerProfile'); } catch {}
    try { window.dispatchEvent(new CustomEvent('customer-profile-changed', { detail: null })); } catch {}
    setCurrentUser(null);
    return;
  }
  try {
    const prev = localStorage.getItem('impersonator');
    if (prev) {
      const admin = JSON.parse(prev);
      localStorage.removeItem('impersonator');
      setCurrentUser(admin);
      return;
    }
  } catch {}
  setCurrentUser(null);
}
