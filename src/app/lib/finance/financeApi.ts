import type { CashClosure, DailyExpense, DailySale } from "./financeTypes";
import { backendStorage } from "../backendStorage";

const SALES_KEY = "herencia_finance_sales";
const EXPENSES_KEY = "herencia_finance_expenses";
const CLOSURES_KEY = "herencia_finance_closures";

function safeRead<T>(key: string): T[] {
  try {
    return JSON.parse(backendStorage.getItem(key) || "[]") as T[];
  } catch {
    return [];
  }
}

async function safeWrite<T>(key: string, data: T[]) {
  const result = await backendStorage.setItem(key, JSON.stringify(data));
  if (!result.ok) throw new Error(result.error || `No se pudo guardar ${key}`);
}

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export async function getSalesByDate(date: string): Promise<DailySale[]> {
  return safeRead<DailySale>(SALES_KEY).filter((sale) => sale.sale_date === date);
}
export async function getExpensesByDate(date: string): Promise<DailyExpense[]> {
  return safeRead<DailyExpense>(EXPENSES_KEY).filter((expense) => expense.expense_date === date);
}
export async function getMonthSales(year: number, month: number): Promise<DailySale[]> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return safeRead<DailySale>(SALES_KEY).filter((sale) => sale.sale_date?.startsWith(prefix));
}
export async function getMonthExpenses(year: number, month: number): Promise<DailyExpense[]> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return safeRead<DailyExpense>(EXPENSES_KEY).filter((expense) => expense.expense_date?.startsWith(prefix));
}
export async function createSale(sale: Omit<DailySale, "id" | "created_at">): Promise<DailySale> {
  const sales = safeRead<DailySale>(SALES_KEY);
  const newSale: DailySale = { ...sale, id: makeId(), created_at: new Date().toISOString() };
  await safeWrite(SALES_KEY, [newSale, ...sales]);
  return newSale;
}
export async function createExpense(expense: Omit<DailyExpense, "id" | "created_at">): Promise<DailyExpense> {
  const expenses = safeRead<DailyExpense>(EXPENSES_KEY);
  const newExpense: DailyExpense = { ...expense, id: makeId(), created_at: new Date().toISOString() };
  await safeWrite(EXPENSES_KEY, [newExpense, ...expenses]);
  return newExpense;
}
export async function createCashClosure(closure: Omit<CashClosure, "id" | "created_at">): Promise<CashClosure> {
  const closures = safeRead<CashClosure>(CLOSURES_KEY);
  const newClosure: CashClosure = { ...closure, id: makeId(), created_at: new Date().toISOString() };
  await safeWrite(CLOSURES_KEY, [newClosure, ...closures]);
  return newClosure;
}
export async function deleteSale(id: string): Promise<void> {
  await safeWrite(SALES_KEY, safeRead<DailySale>(SALES_KEY).filter((sale) => sale.id !== id));
}
export async function deleteExpense(id: string): Promise<void> {
  await safeWrite(EXPENSES_KEY, safeRead<DailyExpense>(EXPENSES_KEY).filter((expense) => expense.id !== id));
}
export async function getCashClosures(): Promise<CashClosure[]> {
  return safeRead<CashClosure>(CLOSURES_KEY);
}
