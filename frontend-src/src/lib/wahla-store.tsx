import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAccounts,
  fetchAlternatives,
  fetchTwin,
  simulateDecision,
  type SimulationResult,
  type TwinState,
} from "./api";

export type DecisionType = "loan" | "installment" | "bnpl" | "subscription";

export const decisionLabels: Record<DecisionType, string> = {
  loan: "قرض",
  installment: "شراء بالتقسيط",
  bnpl: "دفع آجل",
  subscription: "اشتراك جديد",
};

export interface DecisionState {
  type: DecisionType;
  monthly: number;
  months: number;
  hasDownPayment: boolean;
  downPaymentAmount: number;
  hasLastPayment: boolean;
  lastPaymentAmount: number;
  startDate: string; // YYYY-MM format
  bnplDate: string;  // YYYY-MM-DD for single BNPL payment
  bnplAmount: number;
}

interface Ctx {
  decision: DecisionState;
  setDecision: (patch: Partial<DecisionState>) => void;
  accountId: number;
  setAccountId: (id: number) => void;
}

const WahlaCtx = createContext<Ctx | null>(null);

const DEFAULT_ACCOUNT = 21; // "الحساب الرئيسي" — real Berka account behind the demo

function storedAccount(): number {
  if (typeof window === "undefined") return DEFAULT_ACCOUNT;
  const v = Number(window.localStorage.getItem("wahla-account"));
  return v > 0 ? v : DEFAULT_ACCOUNT;
}

function nextMonthStr(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function bnplDefaultDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function WahlaProvider({ children }: { children: ReactNode }) {
  const [decision, setDecisionState] = useState<DecisionState>({
    type: "installment",
    monthly: 400,
    months: 6,
    hasDownPayment: false,
    downPaymentAmount: 0,
    hasLastPayment: false,
    lastPaymentAmount: 0,
    startDate: nextMonthStr(),
    bnplDate: bnplDefaultDate(),
    bnplAmount: 0,
  });
  const [accountId, setAccountIdState] = useState(storedAccount);
  const setAccountId = (id: number) => {
    setAccountIdState(id);
    if (typeof window !== "undefined")
      window.localStorage.setItem("wahla-account", String(id));
  };
  const value = useMemo<Ctx>(() => ({
    decision,
    setDecision: (patch) => setDecisionState((d) => ({ ...d, ...patch })),
    accountId,
    setAccountId,
  }), [decision, accountId]);
  return <WahlaCtx.Provider value={value}>{children}</WahlaCtx.Provider>;
}

export function useWahla() {
  const ctx = useContext(WahlaCtx);
  if (!ctx) throw new Error("useWahla must be used inside WahlaProvider");
  return ctx;
}

// ---- Digital Twin queries (all UI data flows through these) ----

export function useTwin() {
  const { accountId } = useWahla();
  return useQuery<TwinState>({
    queryKey: ["twin", accountId],
    queryFn: () => fetchTwin(accountId),
    staleTime: 60_000,
  });
}

export function useAccounts() {
  return useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts,
                    staleTime: 60_000 });
}

export function useSimulation() {
  const { accountId, decision } = useWahla();
  // For BNPL, map to single-month payment
  const payload =
    decision.type === "bnpl"
      ? { ...decision, monthly: decision.bnplAmount, months: 1 }
      : decision;
  return useQuery<SimulationResult>({
    queryKey: ["simulate", accountId, decision],
    queryFn: () => simulateDecision(accountId, payload),
    staleTime: 60_000,
  });
}

export function useAlternatives() {
  const { accountId, decision } = useWahla();
  return useQuery({
    queryKey: ["alternatives", accountId, decision.monthly, decision.months],
    queryFn: () => fetchAlternatives(accountId, decision.monthly, decision.months),
    staleTime: 60_000,
  });
}

// financial commitments shown in the UI = loan payments + recurring bills
export function commitmentsOf(twin: TwinState): number {
  const recurring = twin.recurring_payments
    .filter((p) => p.monthly)
    .reduce((s, p) => s + p.amount, 0);
  return twin.monthly_loan_payment + recurring;
}

export function formatSAR(n: number) {
  return Math.round(n).toLocaleString("ar-SA", { maximumFractionDigits: 0 });
}
