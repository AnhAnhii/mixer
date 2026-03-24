import { readOpenPendingHandoffs, readPendingHandoffs, readHandoffResolutions } from './store.js';

const limit = Number(process.argv[2] || 20);
const openHandoffs = readOpenPendingHandoffs();
const handoffs = openHandoffs.slice(-Math.max(limit, 1)).reverse();

console.log(JSON.stringify({
  count: handoffs.length,
  total_pending_records: readPendingHandoffs().length,
  total_resolutions: readHandoffResolutions().length,
  open_handoffs: openHandoffs.length,
  handoffs
}, null, 2));
