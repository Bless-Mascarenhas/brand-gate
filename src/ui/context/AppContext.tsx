'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Role } from '@/src/types';

export interface ProviderStatus {
  gemini: 'configured' | 'missing' | 'failing';
  xai: 'configured' | 'missing' | 'failing';
  nvidia: 'configured' | 'missing' | 'failing';
}

interface AppContextType {
  role: Role;
  setRole: (role: Role) => void;
  mode: 'live' | 'replay';
  setMode: (mode: 'live' | 'replay') => void;
  speedMode: 'fast' | 'thorough';
  setSpeedMode: (speed: 'fast' | 'thorough') => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  demoDate: string;
  hasAccess: boolean;
  verifyAccess: (code: string) => Promise<boolean>;
  logoutAccess: () => Promise<void>;
  providers: ProviderStatus;
  refreshProviders: () => Promise<void>;
  isAccessModalOpen: boolean;
  setIsAccessModalOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<Role>('manager');
  const [mode, setMode] = useState<'live' | 'replay'>('live');
  const [speedMode, setSpeedMode] = useState<'fast' | 'thorough'>('fast');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState<boolean>(false);
  const [providers, setProviders] = useState<ProviderStatus>({
    gemini: 'missing',
    xai: 'missing',
    nvidia: 'missing',
  });

  const demoDate = process.env.NEXT_PUBLIC_DEMO_TODAY || '2026-10-24';

  useEffect(() => {
    // Check local storage for preferences
    const savedRole = localStorage.getItem('bg_role') as Role;
    if (savedRole) setRoleState(savedRole);

    const savedTheme = (localStorage.getItem('bg_theme') as 'light' | 'dark') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Check access session
    checkAccessSession();
    refreshProviders();
  }, []);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem('bg_role', newRole);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('bg_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const checkAccessSession = async () => {
    try {
      const res = await fetch('/api/access');
      if (res.ok) {
        const data = await res.json();
        setHasAccess(Boolean(data.authenticated));
      }
    } catch {
      setHasAccess(false);
    }
  };

  const verifyAccess = async (code: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        setHasAccess(true);
        setIsAccessModalOpen(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logoutAccess = async () => {
    try {
      await fetch('/api/access', { method: 'DELETE' });
    } finally {
      setHasAccess(false);
    }
  };

  const refreshProviders = async () => {
    try {
      const res = await fetch('/api/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers);
        if (data.modeSuggestion === 'replay') {
          setMode('replay');
        }
      }
    } catch {
      // offline fallback
      setProviders({ gemini: 'missing', xai: 'missing', nvidia: 'missing' });
    }
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        mode,
        setMode,
        speedMode,
        setSpeedMode,
        theme,
        toggleTheme,
        demoDate,
        hasAccess,
        verifyAccess,
        logoutAccess,
        providers,
        refreshProviders,
        isAccessModalOpen,
        setIsAccessModalOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider');
  return ctx;
};
