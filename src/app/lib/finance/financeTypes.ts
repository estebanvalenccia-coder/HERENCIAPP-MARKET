export type PaymentMethod = "Efectivo" | "Stripe" | "Tarjeta" | "Bizum" | "Transferencia";

export type SaleStatus = "Cobrado" | "Pendiente" | "Cancelado";
export type ExpenseStatus = "Pagado" | "Pendiente";

export interface DailySale {
  id?: string;
  sale_date: string;
  time: string;
  client: string;
  product: string;
  category: string;
  payment_method: PaymentMethod;
  amount: number;
  cost: number;
  status: SaleStatus;
  notes?: string;
  created_at?: string;
}

export interface DailyExpense {
  id?: string;
  expense_date: string;
  category: string;
  provider: string;
  concept: string;
  amount: number;
  payment_method: PaymentMethod;
  status: ExpenseStatus;
  notes?: string;
  created_at?: string;
}

export interface CashClosure {
  id?: string;
  closure_date: string;
  sales_total: number;
  expenses_total: number;
  costs_total: number;
  profit_total: number;
  expected_cash: number;
  real_cash: number;
  difference: number;
  notes?: string;
  created_at?: string;
}
