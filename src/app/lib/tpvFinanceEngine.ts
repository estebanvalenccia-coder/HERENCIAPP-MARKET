export interface TPVSaleItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  iva: number;
  stock?: number;
}

export interface TPVSale {
  id: string;
  customer?: string;
  paymentMethod: string;
  subtotal: number;
  iva: number;
  total: number;
  createdAt: string;
  items: TPVSaleItem[];
}

export interface FinanceMovement {
  id: string;
  type: "income" | "expense" | "waste";
  concept: string;
  amount: number;
  createdAt: string;
}

const SALES_KEY = "herencia_sales";
const FINANCE_KEY = "herencia_finance";
const STOCK_KEY = "herencia_stock";
const CASH_KEY = "herencia_cash";

export function saveSale(sale: TPVSale) {
  const sales = getSales();
  localStorage.setItem(SALES_KEY, JSON.stringify([sale, ...sales]));

  syncFinance(sale);
  syncCash(sale);
  syncStock(sale);
}

export function getSales(): TPVSale[] {
  return JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
}

export function getFinanceMovements(): FinanceMovement[] {
  return JSON.parse(localStorage.getItem(FINANCE_KEY) || "[]");
}

export function getCashToday() {
  return JSON.parse(localStorage.getItem(CASH_KEY) || "{\"total\":0}");
}

function syncFinance(sale: TPVSale) {
  const finance = getFinanceMovements();

  finance.unshift({
    id: crypto.randomUUID(),
    type: "income",
    concept: `Venta TPV ${sale.paymentMethod}`,
    amount: sale.total,
    createdAt: new Date().toISOString(),
  });

  localStorage.setItem(FINANCE_KEY, JSON.stringify(finance));
}

function syncCash(sale: TPVSale) {
  const cash = getCashToday();

  const next = {
    total: Number(cash.total || 0) + Number(sale.total || 0),
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(CASH_KEY, JSON.stringify(next));
}

function syncStock(sale: TPVSale) {
  const stock = JSON.parse(localStorage.getItem(STOCK_KEY) || "[]");

  const updated = stock.map((product: any) => {
    const sold = sale.items.find((item) => item.id === product.id);

    if (!sold) return product;

    return {
      ...product,
      stock: Math.max(0, Number(product.stock || 0) - Number(sold.qty || 0)),
      updatedAt: new Date().toISOString(),
    };
  });

  localStorage.setItem(STOCK_KEY, JSON.stringify(updated));
}

export function getDashboardMetrics() {
  const sales = getSales();
  const finance = getFinanceMovements();

  const today = new Date().toISOString().slice(0, 10);

  const todaySales = sales.filter((sale) => sale.createdAt.startsWith(today));

  const totalSales = todaySales.reduce((sum, sale) => sum + sale.total, 0);
  const totalIVA = todaySales.reduce((sum, sale) => sum + sale.iva, 0);
  const transactions = todaySales.length;

  const income = finance
    .filter((f) => f.type === "income")
    .reduce((sum, f) => sum + f.amount, 0);

  return {
    totalSales,
    totalIVA,
    transactions,
    income,
  };
}
