export const LOW_RISK_CASES = new Set([
  'greeting_or_opening',
  'shipping_eta_general',
  'shipping_carrier',
  'support_hours'
]);

export const HANDOFF_CASES = new Set([
  'order_status_request',
  'exchange_return_specific',
  'defective_product_claim',
  'stock_or_product_availability',
  'complaint_or_negative_feedback',
  'unknown'
]);

export const KNOWN_CASES = new Set([
  ...LOW_RISK_CASES,
  ...HANDOFF_CASES,
  'pricing_or_promotion',
  'payment_or_scam_concern'
]);

export const VALID_DRAFT_ACTIONS = new Set(['auto_send', 'draft_only', 'handoff']);
export const VALID_RISK_LEVELS = new Set(['low', 'medium', 'high']);

export function normalizeCaseType(value, fallback = 'unknown') {
  const normalized = normalizeToken(value);
  return normalized && KNOWN_CASES.has(normalized) ? normalized : fallback;
}

export function normalizeDraftAction(value, fallback = 'handoff') {
  const normalized = normalizeToken(value);
  return normalized && VALID_DRAFT_ACTIONS.has(normalized) ? normalized : fallback;
}

export function normalizeRiskLevel(value, fallback = 'high') {
  const normalized = normalizeToken(value);
  return normalized && VALID_RISK_LEVELS.has(normalized) ? normalized : fallback;
}

export function normalizeToken(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}
