/**
 * Trials Zustand store
 * Manages observation trials with local persistence (guest mode)
 * and syncs to the server when authenticated
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';
import toast from 'react-hot-toast';

export interface Trial {
  id?: string;              // undefined for local-only (guest)
  localId: string;          // always present (uuid)
  h: number;
  y: number;
  mA: number;
  mB: number;
  material: string;
  XA: number;
  XB: number;
  UA: number;
  UB: number;
  VA: number;
  VB: number;
  e: number;
  noiseApplied: boolean;
  createdAt: string;
}

interface TrialsState {
  trials: Trial[];
  isSyncing: boolean;

  // Actions
  addTrial: (trial: Omit<Trial, 'localId' | 'createdAt'>) => void;
  deleteTrial: (localId: string) => Promise<void>;
  clearTrials: () => Promise<void>;
  fetchTrials: () => Promise<void>;
  syncToServer: () => Promise<void>;
  exportCsv: () => void;
}

function generateId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const useTrialsStore = create<TrialsState>()(
  persist(
    (set, get) => ({
      trials: [],
      isSyncing: false,

      addTrial: (trialData) => {
        const trial: Trial = {
          ...trialData,
          localId: generateId(),
          createdAt: new Date().toISOString(),
        };

        set((state) => ({ trials: [...state.trials, trial] }));

        // Try to save to server if possible
        api
          .post('/trials', {
            h: trial.h, y: trial.y, mA: trial.mA, mB: trial.mB,
            material: trial.material, XA: trial.XA, XB: trial.XB,
            UA: trial.UA, UB: trial.UB, VA: trial.VA, VB: trial.VB,
            e: trial.e, noiseApplied: trial.noiseApplied,
          })
          .then((res) => {
            // Update local trial with server id
            set((state) => ({
              trials: state.trials.map((t) =>
                t.localId === trial.localId ? { ...t, id: res.data.data.id } : t
              ),
            }));
          })
          .catch(() => {
            // Guest mode – silently ignore
          });
      },

      deleteTrial: async (localId: string) => {
        const trial = get().trials.find((t) => t.localId === localId);
        set((state) => ({ trials: state.trials.filter((t) => t.localId !== localId) }));

        if (trial?.id) {
          try {
            await api.delete(`/trials/${trial.id}`);
          } catch {
            // ignore
          }
        }
      },

      clearTrials: async () => {
        set({ trials: [] });
        try {
          await api.delete('/trials');
        } catch {
          // ignore
        }
      },

      fetchTrials: async () => {
        try {
          const res = await api.get('/trials');
          const serverTrials: Trial[] = res.data.data.map((t: any) => ({
            ...t,
            localId: t.id,
          }));
          set({ trials: serverTrials });
        } catch {
          // not authenticated – keep local trials
        }
      },

      syncToServer: async () => {
        const unsyncedTrials = get().trials.filter((t) => !t.id);
        if (unsyncedTrials.length === 0) return;

        set({ isSyncing: true });
        try {
          await api.post('/trials/sync', {
            trials: unsyncedTrials.map((t) => ({
              h: t.h, y: t.y, mA: t.mA, mB: t.mB,
              material: t.material, XA: t.XA, XB: t.XB,
              UA: t.UA, UB: t.UB, VA: t.VA, VB: t.VB,
              e: t.e, noiseApplied: t.noiseApplied,
            })),
          });
          toast.success(`Synced ${unsyncedTrials.length} trial(s) to server`);
          await get().fetchTrials();
        } catch {
          toast.error('Failed to sync trials');
        } finally {
          set({ isSyncing: false });
        }
      },

      exportCsv: () => {
        const trials = get().trials;
        const headers = [
          'Sr.No', 'h (m)', 'y (m)', 'mA (kg)', 'mB (kg)', 'Material',
          'XA (m)', 'XB (m)', 'UA (m/s)', 'UB (m/s)', 'VA (m/s)', 'VB (m/s)', 'e'
        ];
        const rows = trials.map((t, i) => [
          i + 1, t.h, t.y, t.mA, t.mB, t.material,
          t.XA.toFixed(4), t.XB.toFixed(4),
          t.UA.toFixed(4), t.UB.toFixed(4),
          t.VA.toFixed(4), t.VB.toFixed(4),
          t.e.toFixed(4),
        ]);
        const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'experiment5_observations.csv';
        a.click();
        URL.revokeObjectURL(url);
      },
    }),
    {
      name: 'vml-trials', // localStorage key for guest persistence
      partialize: (state) => ({ trials: state.trials }),
    }
  )
);
