import type { DailyExpense, DailySale } from "./financeTypes";

export const todayISO = () => new Date().toISOString().split("T")[0];

export const currentTime = () =>
  new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

export const money = (value: number) => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
};

export function calculateTotals(sales: DailySale[], expenses: DailyExpense[]) {
  const salesTotal = sales.reduce((acc, sale) => acc + Number(sale.amount || 0), 0);
  const costsTotal = sales.reduce((acc, sale) => acc + Number(sale.cost || 0), 0);
  const expensesTotal = expenses.reduce((acc, expense) => acc + Number(expense.amount || 0), 0);
  const profit = salesTotal - costsTotal - expensesTotal;

  const expectedCash = sales
    .filter((sale) => sale.payment_method === "Efectivo")
    .reduce((acc, sale) => acc + Number(sale.amount || 0), 0);

  return {
    salesTotal,
    costsTotal,
    expensesTotal,
    profit,
    expectedCash,
    averageTicket: sales.length ? salesTotal / sales.length : 0,
  };
}

export function buildDailyIncomeChart(sales: DailySale[]) {
  const grouped = new Map<string, { income: number; profit: number }>();

  sales.forEach((sale) => {
    const day = sale.sale_date?.split("-")[2] || "00";

    const current = grouped.get(day) || { income: 0, profit: 0 };

    current.income += Number(sale.amount || 0);
    current.profit += Number(sale.amount || 0) - Number(sale.cost || 0);

    grouped.set(day, current);
  });

  return Array.from(grouped.entries()).map(([day, values]) => ({
    day,
    income: values.income,
    profit: values.profit,
  }));
}

export function buildPaymentChart(sales: DailySale[]) {
  const methods = new Map<string, number>();

  sales.forEach((sale) => {
    methods.set(
      sale.payment_method,
      (methods.get(sale.payment_method) || 0) + Number(sale.amount || 0)
    );
  });

  return Array.from(methods.entries()).map(([name, value]) => ({
    name,
    value,
  }));
}
