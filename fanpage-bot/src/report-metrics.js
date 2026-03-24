import fs from 'node:fs';
import path from 'node:path';

const targetPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(process.cwd(), process.env.LOG_STORE_PATH || 'data/logs/audit.jsonl');
const limitArg = process.argv[3] || process.env.METRICS_LIMIT || '';
const limit = Number(limitArg) > 0 ? Number(limitArg) : null;

const records = readJsonl(targetPath);
const scopedRecords = limit ? records.slice(-limit) : records;
const summary = buildSummary(scopedRecords, { targetPath, limit });

console.log(JSON.stringify(summary, null, 2));

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function buildSummary(records, meta) {
  const summary = {
    source: meta.targetPath,
    records_analyzed: records.length,
    limited_to_last: meta.limit,
    time_range: buildTimeRange(records),
    totals: {
      inbound_messages: records.length,
      unique_threads: countDistinct(records.map((record) => record.normalized_message?.thread_key).filter(Boolean)),
      low_risk_cases: 0,
      needs_human: 0,
      attachments_present: 0,
      duplicate_ignored: 0,
      would_auto_send: 0,
      auto_send: 0,
      sent: 0,
      send_failed: 0,
      draft_only: 0,
      handoff: 0,
      unknown_case: 0,
      outside_support_hours: 0,
      cooldown_blocked: 0
    },
    by_case_type: {},
    by_decision: {},
    by_send_status: {},
    by_policy_version: {},
    by_prompt_version: {},
    by_ai_mode: {},
    by_ai_model: {},
    top_classifier_reasons: {},
    top_safety_flags: {}
  };

  for (const record of records) {
    const triage = record.triage || {};
    const normalized = record.normalized_message || {};
    const delivery = record.delivery || {};
    const sendResult = record.send_result || {};
    const guardedDraft = record.guarded_draft || {};
    const processingMeta = record.processing_meta || {};

    bump(summary.by_case_type, triage.case_type || 'unknown');
    bump(summary.by_decision, delivery.decision || 'unknown');
    bump(summary.by_send_status, sendResult.status || 'unknown');
    bump(summary.by_policy_version, processingMeta.policy_version || 'unknown');
    bump(summary.by_prompt_version, processingMeta.prompt_version || 'unknown');
    bump(summary.by_ai_mode, processingMeta.ai_mode || 'unknown');
    bump(summary.by_ai_model, processingMeta.ai_model || 'unknown');
    bump(summary.top_classifier_reasons, triage.reason || 'unknown');

    for (const flag of guardedDraft.safety_flags || []) {
      bump(summary.top_safety_flags, flag);
      if (flag === 'outside_support_hours') summary.totals.outside_support_hours += 1;
      if (flag === 'thread_auto_reply_cooldown_active') summary.totals.cooldown_blocked += 1;
    }

    if (triage.risk_level === 'low') summary.totals.low_risk_cases += 1;
    if (triage.needs_human) summary.totals.needs_human += 1;
    if ((normalized.attachments || []).length > 0) summary.totals.attachments_present += 1;
    if ((triage.case_type || 'unknown') === 'unknown') summary.totals.unknown_case += 1;

    if (delivery.decision === 'ignore') summary.totals.duplicate_ignored += 1;
    if (delivery.decision === 'would_auto_send') summary.totals.would_auto_send += 1;
    if (delivery.decision === 'auto_send') summary.totals.auto_send += 1;
    if (delivery.decision === 'draft_only') summary.totals.draft_only += 1;
    if (delivery.decision === 'handoff') summary.totals.handoff += 1;

    if (sendResult.status === 'sent') summary.totals.sent += 1;
    if (sendResult.status === 'failed') summary.totals.send_failed += 1;
  }

  return summary;
}

function buildTimeRange(records) {
  if (!records.length) {
    return { first_logged_at: null, last_logged_at: null };
  }

  return {
    first_logged_at: records[0]?.logged_at || null,
    last_logged_at: records[records.length - 1]?.logged_at || null
  };
}

function bump(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function countDistinct(values) {
  return new Set(values).size;
}
