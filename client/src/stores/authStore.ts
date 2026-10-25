/**
 * Auth Zustand store
 * Manages user session state, theme, and login/logout actions
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  rollNo?: string;
  division?: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  theme: 'dark' | 'light';
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  rollNo?: string;
  division?: string;
  role?: 'STUDENT' | 'TEACHER';
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      theme: 'dark',
      isLoading: false,

      setUser: (user) => set({ user }),

      setTheme: (theme) => {
        set({ theme });
        // Apply theme to HTML element
        const html = document.documentElement;
        html.classList.remove('dark', 'light');
        html.classList.add(theme);
      },

      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        get().setTheme(next);
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/login', { email, password });
          set({ user: res.data.data });
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/register', data);
          set({ user: res.data.data });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          // ignore
        }
        set({ user: null });
      },

      fetchMe: async () => {
        try {
          const res = await api.get('/auth/me');
          set({ user: res.data.data });
        } catch {
          set({ user: null });
        }
      },
    }),
    {
      name: 'vml-auth',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
