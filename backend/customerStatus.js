export function calculateCustomerStatus(orders = [], minimumSpend = 50) {
  const paidStatuses = new Set(["paid", "completed", "delivered"]);
  const totalPaid = orders
    .filter((order) => paidStatuses.has(order.status))
    .reduce((sum, order) => sum + Number(order.total || 0), 0);

  return {
    totalPaid,
    isVip: totalPaid >= minimumSpend,
  };
}
