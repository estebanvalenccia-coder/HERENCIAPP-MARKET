import type { DailyExpense, DailySale } from "./financeTypes";

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
};

export const calculateProfit = (sale: DailySale) => {
  return (sale.amount || 0) - (sale.cost || 0);
};

export const getTotalSales = (sales: DailySale[]) => {
  return sales.reduce((acc, sale) => acc + (sale.amount || 0), 0);
};

export const getTotalCosts = (sales: DailySale[]) => {
  return sales.reduce((acc, sale) => acc + (sale.cost || 0), 0);
};

export const getTotalExpenses = (expenses: DailyExpense[]) => {
  return expenses.reduce((acc, expense) => acc + (expense.amount || 0), 0);
};

export const getNetProfit = (
  sales: DailySale[],
  expenses: DailyExpense[]
) => {
  return (
    getTotalSales(sales) -
    getTotalCosts(sales) -
    getTotalExpenses(expenses)
  );
};
