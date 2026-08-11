import * as React from 'react';

export interface UserPreferences {
  alerts: { enabled: boolean; threshold: number };
  defaultTimeRange: '30d' | '90d' | '12m' | 'ytd';
  compactMode: boolean;
}

const defaultPreferences: UserPreferences = {
  alerts: { enabled: true, threshold: 5 },
  defaultTimeRange: '12m',
  compactMode: false,
};

interface UserPreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
}

const UserPreferencesContext = React.createContext<UserPreferencesContextType | null>(null);

const STORAGE_KEY = 'fwi_user_preferences';

export function UserPreferencesProvider(props: { children: React.ReactNode }) {
  const [preferences, setPreferences] = React.useState<UserPreferences>(() => {
    if (typeof window === 'undefined') return defaultPreferences;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaultPreferences, ...JSON.parse(stored) } : defaultPreferences;
    } catch {
      return defaultPreferences;
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch { 
      // Ignore storage errors
    }
  }, [preferences]);

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  };

  const resetPreferences = () => setPreferences(defaultPreferences);

  const value: UserPreferencesContextType = { preferences, updatePreferences, resetPreferences };

  return React.createElement(
    UserPreferencesContext.Provider,
    { value },
    props.children
  );
}

export function useUserPreferences(): UserPreferencesContextType {
  const context = React.useContext(UserPreferencesContext);
  if (!context) throw new Error('useUserPreferences must be used within UserPreferencesProvider');
  return context;
}
