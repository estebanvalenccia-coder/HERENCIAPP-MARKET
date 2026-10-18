/**
 * Fail-closed readiness checks for AliExpress unattended fulfillment.
 * Pure function: no orders, money, personal addresses or provider calls.
 * Every failing condition must be resolved before a separate live execution
 * component may make any remote order/payment request.
 */
const ID = /^\d{8,22}$/;
const cents = (value) => typeof value === "number" && Number.isFinite(value) && value > 0
  ? Math.round(value * 100) : null;
const validClock = (value) => Number.isFinite(Date.parse(String(value || "")));
export function assessAliExpressOrderReadiness(input = {}, policy = {}, now = Date.now()) {
  const issues = [];
  const paid = input.payment;
  const quote = input.quote;
  const match = input.mapping;
  const address = input.address;
  const total = cents(Number(input.salePriceEur));
  const provider = cents(Number(quote?.productCostEur));
  const postage = cents(Number(quote?.shippingCostEur));
  const tax = cents(Number(quote?.taxesEur));
  const other = cents(Number(quote?.otherCostsEur));
  const maxOrder = cents(Number(policy.maxSupplierSpendEur));
  const dailyBudget = cents(Number(policy.remainingDailyBudgetEur));
  const limitMargin = Number(policy.minimumMarginPercent);
  const availableMargin = total && [provider, postage, tax, other].every(Number.isInteger)
    ? (total - provider - postage - tax - other) / total * 100 : null;

  if (policy.authorized !== true) issues.push("merchant_authorization_required");
  if (policy.providerOrderApiVerified !== true) issues.push("provider_create_api_unverified");
  if (policy.paymentArrangementVerified !== true) issues.push("provider_payment_method_unverified");
  if (policy.customerPrivacyNoticeApproved !== true) issues.push("supplier_address_transfer_not_approved");
  if (!paid || paid.providerVerified !== true || paid.status !== "succeeded" || !String(paid.providerTransactionId || "").trim())
    issues.push("payment_not_verified");
  if (!String(input.orderId || "").trim()) issues.push("order_id_missing");
  if (!match || !ID.test(String(match.productId || "")) || !String(match.skuAttr || "").trim() || match.verified !== true)
    issues.push("exact_provider_variant_missing");
  if (!Number.isInteger(input.quantity) || input.quantity !== 1) issues.push("quantity_not_supported");
  if (!address || address.country !== "ES" ||
      !String(address.postalCode || "").trim() || !String(address.city || "").trim() ||
      !String(address.street || "").trim() || !String(address.recipient || "").trim() ||
      !String(address.phone || "").trim()) issues.push("address_incomplete");
  if (!quote || quote.providerVerified !== true || quote.shippingVerified !== true ||
      quote.destination !== "ES" || !quote.shippingService || !validClock(quote.checkedAt) ||
      Date.parse(quote.checkedAt) > now ||
      now - Date.parse(quote.checkedAt) > 10 * 60_000 ||
      ![provider, postage, tax, other].every(Number.isInteger)) issues.push("verified_quote_missing");
  if (!total || !Number.isInteger(maxOrder) || !Number.isInteger(dailyBudget) ||
      !Number.isInteger(limitMargin) || limitMargin < 10 || limitMargin > 70 ||
      availableMargin === null || availableMargin < limitMargin ||
      (provider !== null && postage !== null && tax !== null && other !== null &&
       (provider + postage + tax + other > maxOrder || provider + postage + tax + other > dailyBudget)))
    issues.push("supplier_budget_or_margin_failed");
  if (input.alreadySubmitted === true || input.externalOrderId || input.externalOrderStatus === "unknown" ||
      input.externalOrderStatus === "creating") issues.push("duplicate_or_ambiguous_submission");
  return {
    eligible: issues.length === 0,
    issues,
    estimatedCostEur: availableMargin === null ? null : (provider + postage + tax + other) / 100,
    estimatedMarginPercent: availableMargin === null ? null : Math.round(availableMargin * 100) / 100,
    mode: "preflight_only",
    canCreateSupplierOrder: false,
    canChargeSupplier: false,
  };
}
