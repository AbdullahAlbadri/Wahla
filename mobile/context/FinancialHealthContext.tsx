import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { ACCOUNT_ID, fetchBudget, fetchSuggestions, fetchTwin } from '@/lib/api';
import { buildFinancialHealthData, type AdaptedFinancialHealth, type BudgetSegment } from '@/lib/adapter';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { FullScreenError } from '@/components/FullScreenError';

// Derived from AdaptedFinancialHealth's actual return types (adapter.ts is
// the source of truth) rather than hand-written here, so the two can never
// drift out of sync.
export type SpendingCategory = AdaptedFinancialHealth['spendingCategories'][number];
export type Recommendation = AdaptedFinancialHealth['recommendations'][number];
export type Dimension = AdaptedFinancialHealth['dimensions'][number];

export interface NotificationSettings {
  budgetAlerts: boolean;
  weeklyInsights: boolean;
  goalReminders: boolean;
  savingsOpportunities: boolean;
  monthlyReport: boolean;
}

export type { BudgetSegment };

const NOTIFICATIONS_STORAGE_KEY = 'wahla:notificationSettings';
const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  budgetAlerts: true,
  weeklyInsights: true,
  goalReminders: false,
  savingsOpportunities: true,
  monthlyReport: true,
};

export interface FinancialHealthContextType extends AdaptedFinancialHealth {
  notifications: NotificationSettings;
  toggleNotification: (key: keyof NotificationSettings) => void;
  simulatorExtraMonthly: number;
  setSimulatorExtraMonthly: (v: number) => void;
  simulatorDebtPayment: number;
  setSimulatorDebtPayment: (v: number) => void;
}

const FinancialHealthContext = createContext<FinancialHealthContextType | null>(null);

export function FinancialHealthProvider({ children }: { children: React.ReactNode }) {
  const twinQuery = useQuery({
    queryKey: ['twin', ACCOUNT_ID],
    queryFn: () => fetchTwin(ACCOUNT_ID),
    staleTime: 60_000,
  });
  const budgetQuery = useQuery({
    queryKey: ['budget', ACCOUNT_ID],
    queryFn: () => fetchBudget(ACCOUNT_ID),
    staleTime: 60_000,
  });
  const suggestionsQuery = useQuery({
    queryKey: ['suggestions', ACCOUNT_ID],
    queryFn: () => fetchSuggestions(ACCOUNT_ID, { signals: { in_savings_product: false }, history: [] }),
    staleTime: 60_000,
    enabled: !!twinQuery.data,
  });

  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [simulatorExtraMonthly, setSimulatorExtraMonthly] = useState(500);
  const [simulatorDebtPayment, setSimulatorDebtPayment] = useState(1000);

  // Real persistence — previously local-only useState that silently reset
  // to defaults on every reload. Loads once on mount; save is fire-and-
  // forget (this is a local device preference, not something that needs to
  // block the UI or be retried on failure).
  useEffect(() => {
    AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          setNotifications({ ...DEFAULT_NOTIFICATIONS, ...JSON.parse(raw) });
        } catch {
          // corrupt stored value — keep defaults rather than crash
        }
      }
    });
  }, []);

  const toggleNotification = (key: keyof NotificationSettings) => {
    setNotifications(prev => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const data = useMemo(() => {
    if (!twinQuery.data || !budgetQuery.data) return null;
    return buildFinancialHealthData(twinQuery.data, budgetQuery.data, suggestionsQuery.data ?? []);
  }, [twinQuery.data, budgetQuery.data, suggestionsQuery.data]);

  const isLoading = twinQuery.isLoading || budgetQuery.isLoading;
  const isError = twinQuery.isError || budgetQuery.isError;

  const retry = () => {
    twinQuery.refetch();
    budgetQuery.refetch();
  };

  const value: FinancialHealthContextType | null = data && {
    ...data,
    notifications,
    toggleNotification,
    simulatorExtraMonthly,
    setSimulatorExtraMonthly,
    simulatorDebtPayment,
    setSimulatorDebtPayment,
  };

  return (
    <FinancialHealthContext.Provider value={value}>
      {isLoading ? (
        <FullScreenLoader />
      ) : isError || !value ? (
        <FullScreenError onRetry={retry} />
      ) : (
        children
      )}
    </FinancialHealthContext.Provider>
  );
}

export function useFinancialHealth() {
  const ctx = useContext(FinancialHealthContext);
  if (!ctx) throw new Error('useFinancialHealth must be used within FinancialHealthProvider');
  return ctx;
}
