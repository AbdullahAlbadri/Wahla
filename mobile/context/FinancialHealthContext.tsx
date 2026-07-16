import React, { createContext, useContext, useMemo, useState } from 'react';
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

  const [notifications, setNotifications] = useState<NotificationSettings>({
    budgetAlerts: true,
    weeklyInsights: true,
    goalReminders: false,
    savingsOpportunities: true,
    monthlyReport: true,
  });
  const [simulatorExtraMonthly, setSimulatorExtraMonthly] = useState(500);
  const [simulatorDebtPayment, setSimulatorDebtPayment] = useState(1000);

  const toggleNotification = (key: keyof NotificationSettings) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
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
