import type {
  CashClosure,
  DailyExpense,
  DailySale,
} from "./financeTypes";

const SALES_KEY = "herencia_finance_sales";
const EXPENSES_KEY = "herencia_finance_expenses";
const CLOSURES_KEY = "herencia_finance_closures";

export const financeApi = {
  getSales(): DailySale[] {
    return JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
  },

  saveSales(data: DailySale[]) {
    localStorage.setItem(SALES_KEY, JSON.stringify(data));
  },

  addSale(sale: DailySale) {
    const sales = this.getSales();
    sales.unshift({
      ...sale,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    });
    this.saveSales(sales);
    return sales;
  },

  getExpenses(): DailyExpense[] {
    return JSON.parse(localStorage.getItem(EXPENSES_KEY) || "[]");
  },

  saveExpenses(data: DailyExpense[]) {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(data));
  },

  addExpense(expense: DailyExpense) {
    const expenses = this.getExpenses();
    expenses.unshift({
      ...expense,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    });
    this.saveExpenses(expenses);
    return expenses;
  },

  getClosures(): CashClosure[] {
    return JSON.parse(localStorage.getItem(CLOSURES_KEY) || "[]");
  },

  saveClosures(data: CashClosure[]) {
    localStorage.setItem(CLOSURES_KEY, JSON.stringify(data));
  },

  addClosure(closure: CashClosure) {
    const closures = this.getClosures();
    closures.unshift({
      ...closure,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    });
    this.saveClosures(closures);
    return closures;
  },
};
