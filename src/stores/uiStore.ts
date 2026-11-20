import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setRuntimeMockMode } from '../api/client';
import { ENV } from '../config/env';
import type { AspectRatio } from '../types/project';
import type { NotificationItem } from '../types/system';
import { normalizeSmartFramingAspectRatio } from '../components/dashboard/dashboardWidgetUtils';
import { normalizeThemePreference, type ThemePreference } from '../utils/theme';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: 'info' | 'success' | 'warning' | 'error';
}

export type { ThemePreference };

interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  projectViewMode: 'grid' | 'list';
  mockModeEnabled: boolean;
  themeMode: ThemePreference;
  smartFramingAspectRatio: AspectRatio;
  toasts: ToastItem[];
  notifications: NotificationItem[];
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setProjectViewMode: (mode: 'grid' | 'list') => void;
  setMockModeEnabled: (enabled: boolean) => void;
  setThemeMode: (theme: ThemePreference) => void;
  setSmartFramingAspectRatio: (ratio: AspectRatio) => void;
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      projectViewMode: 'grid',
      mockModeEnabled:
        ENV.USE_MOCK_API ||
        (ENV.IS_DEV &&
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('mock') === '1'),
      themeMode: 'dark',
      smartFramingAspectRatio: '9:16',
      toasts: [],
      notifications: [],

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      setMobileNavOpen: (open) => set({ mobileNavOpen: open }),

      setProjectViewMode: (mode) => set({ projectViewMode: mode }),

      setMockModeEnabled: (enabled) => {
        setRuntimeMockMode(enabled);
        set({ mockModeEnabled: enabled });
      },

      setThemeMode: (themeMode) =>
        set({ themeMode: normalizeThemePreference(themeMode) }),

      setSmartFramingAspectRatio: (ratio) =>
        set({ smartFramingAspectRatio: normalizeSmartFramingAspectRatio(ratio) }),

      addToast: (toast) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((state) => ({
          toasts: [...state.toasts.slice(-3), { ...toast, id }],
        }));
        setTimeout(() => {
          set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
          }));
        }, 4500);
      },

      dismissToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            {
              ...notification,
              id: `notif-${Date.now()}`,
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...state.notifications.slice(0, 19),
          ],
        })),

      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),

      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'clipcat-ui-preferences',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        projectViewMode: state.projectViewMode,
        themeMode: normalizeThemePreference(state.themeMode),
        smartFramingAspectRatio: normalizeSmartFramingAspectRatio(state.smartFramingAspectRatio),
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<UiState> | undefined) ?? {};
        return {
          ...currentState,
          ...persisted,
          themeMode: normalizeThemePreference(persisted.themeMode),
          smartFramingAspectRatio: normalizeSmartFramingAspectRatio(
            persisted.smartFramingAspectRatio
          ),
        };
      },
    }
  )
);
