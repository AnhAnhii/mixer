import fs from 'node:fs';
import path from 'node:path';

const targetPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(process.cwd(), process.env.LOG_STORE_PATH || 'data/logs/audit.jsonl');
const limitArg = process.argv[3] || process.env.PRODUCTION_CHECK_LIMIT || '';
const limit = Number(limitArg) > 0 ? Number(limitArg) : null;

const records = readJsonl(targetPath);
const scopedRecords = limit ? records.slice(-limit) : records;
const summary = buildProductionCheckSummary(scopedRecords, { targetPath, limit });

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

function buildProductionCheckSummary(records, meta) {
  const caseSpecs = [
    {
      key: 'shipping_eta',
      label: 'A. Shipping ETA',
      expected_case_type: 'shipping_eta_general',
      expected_decisions: ['would_auto_send', 'auto_send', 'draft_only'],
      canonical_reply_contains: [
        '2-3 ngày với đơn nội thành Hà Nội',
        '3-5 ngày với đơn ngoại thành Hà Nội',
        '4-7 ngày với đơn các tỉnh/thành khác ngoài Hà Nội'
      ],
      fail_if_case_types: ['unknown', 'greeting_or_opening', 'pricing_or_promotion'],
      fail_if_decisions: ['handoff'],
      matcher: (record) => record?.triage?.case_type === 'shipping_eta_general'
        || /ship.*mấy ngày|giao.*bao lâu|shipping eta/i.test(String(record?.normalized_message?.text || ''))
    },
    {
      key: 'pricing_followup_continuity',
      label: 'B. Pricing follow-up continuity',
      expected_case_type: 'pricing_or_promotion',
      expected_decisions: ['draft_only', 'handoff'],
      fail_if_case_types: ['unknown', 'shipping_eta_general', 'shipping_carrier'],
      fail_if_decisions: ['would_auto_send', 'auto_send'],
      matcher: (record) => {
        const triageCase = record?.triage?.case_type;
        const beforeCase = record?.thread_memory_before?.active_issue?.case_type;
        const afterCase = record?.thread_memory_after?.active_issue?.case_type;
        return triageCase === 'pricing_or_promotion'
          || beforeCase === 'pricing_or_promotion'
          || afterCase === 'pricing_or_promotion';
      }
    },
    {
      key: 'order_status_followup_continuity',
      label: 'C. Order status follow-up continuity',
      expected_case_type: 'order_status_request',
      expected_decisions: ['draft_only', 'handoff'],
      expected_slot_resolution: ['order_code', 'phone', 'receiver_phone'],
      fail_if_case_types: ['unknown', 'shipping_eta_general', 'shipping_carrier'],
      fail_if_decisions: ['would_auto_send', 'auto_send'],
      matcher: (record) => {
        const triageCase = record?.triage?.case_type;
        const beforeCase = record?.thread_memory_before?.active_issue?.case_type;
        const afterCase = record?.thread_memory_after?.active_issue?.case_type;
        return triageCase === 'order_status_request'
          || beforeCase === 'order_status_request'
          || afterCase === 'order_status_request';
      }
    },
    {
      key: 'complaint_negative_feedback',
      label: 'D. Complaint / negative feedback',
      expected_case_type: 'complaint_or_negative_feedback',
      expected_decisions: ['draft_only', 'handoff'],
      fail_if_case_types: ['shipping_eta_general'],
      fail_if_decisions: ['would_auto_send', 'auto_send'],
      matcher: (record) => record?.triage?.case_type === 'complaint_or_negative_feedback'
        || record?.thread_memory_after?.active_issue?.case_type === 'complaint_or_negative_feedback'
    }
  ];

  const cases = caseSpecs.map((spec) => summarizeCase(spec, records));

  return {
    source: meta.targetPath,
    records_analyzed: records.length,
    limited_to_last: meta.limit,
    time_range: buildTimeRange(records),
    cases,
    quick_table: cases.map((item) => ({
      case: item.label,
      pass: item.pass,
      observed_records: item.observed_records,
      observed_case_types: item.observed_case_types,
      observed_decisions: item.observed_decisions,
      continuity_threads: item.continuity_threads,
      notes: item.notes
    }))
  };
}

function summarizeCase(spec, records) {
  const matchedRecords = records.filter(spec.matcher);
  const latestRecords = takeLatestPerThread(matchedRecords);
  const observedCaseTypes = countBy(latestRecords, (record) => record?.triage?.case_type || 'unknown');
  const observedDecisions = countBy(latestRecords, (record) => record?.delivery?.decision || 'unknown');
  const continuityThreads = latestRecords.filter((record) => hasContinuitySignal(record, spec.expected_case_type)).length;
  const sampleRecord = latestRecords.at(-1) || matchedRecords.at(-1) || null;
  const notes = [];

  const unexpectedCaseTypes = Object.keys(observedCaseTypes).filter((caseType) => spec.fail_if_case_types?.includes(caseType));
  const unexpectedDecisions = Object.keys(observedDecisions).filter((decision) => spec.fail_if_decisions?.includes(decision));
  const missingExpectedCaseType = latestRecords.length > 0 && !observedCaseTypes[spec.expected_case_type];
  const missingExpectedDecision = latestRecords.length > 0 && !Object.keys(observedDecisions).some((decision) => spec.expected_decisions?.includes(decision));

  if (!latestRecords.length) {
    notes.push('No matching records found in the scanned audit window.');
  }
  if (missingExpectedCaseType) {
    notes.push(`Expected case_type ${spec.expected_case_type} not seen.`);
  }
  if (missingExpectedDecision) {
    notes.push(`Expected one of decisions ${spec.expected_decisions.join(', ')} not seen.`);
  }
  if (unexpectedCaseTypes.length) {
    notes.push(`Unexpected case_type(s): ${unexpectedCaseTypes.join(', ')}.`);
  }
  if (unexpectedDecisions.length) {
    notes.push(`Unexpected decision(s): ${unexpectedDecisions.join(', ')}.`);
  }

  if (spec.canonical_reply_contains?.length) {
    const replyText = readReplyText(sampleRecord);
    const missingCanonicalPhrases = spec.canonical_reply_contains.filter((phrase) => !replyText.includes(phrase));
    if (replyText && missingCanonicalPhrases.length) {
      notes.push(`Canonical reply drift: missing ${missingCanonicalPhrases.length}/${spec.canonical_reply_contains.length} expected phrase(s).`);
    }
  }

  if (spec.expected_slot_resolution?.length && sampleRecord) {
    const resolvedSlots = new Set(
      (sampleRecord?.thread_memory_after?.asked_slots || [])
        .filter((item) => item?.status === 'resolved')
        .map((item) => item?.slot)
        .filter(Boolean)
    );
    const resolvedExpectedSlot = spec.expected_slot_resolution.some((slot) => resolvedSlots.has(slot));
    if (!resolvedExpectedSlot && isLikelyFollowup(sampleRecord)) {
      notes.push('Follow-up seen but expected lookup slot resolution not visible in thread_memory_after.');
    }
  }

  const pass = latestRecords.length > 0
    && !missingExpectedCaseType
    && !missingExpectedDecision
    && unexpectedCaseTypes.length === 0
    && unexpectedDecisions.length === 0
    && !notes.some((note) => note.startsWith('Canonical reply drift'));

  return {
    key: spec.key,
    label: spec.label,
    pass,
    observed_records: latestRecords.length,
    observed_case_types: observedCaseTypes,
    observed_decisions: observedDecisions,
    continuity_threads: continuityThreads,
    sample: sampleRecord ? buildCompactSample(sampleRecord) : null,
    notes
  };
}

function takeLatestPerThread(records) {
  const byThread = new Map();
  for (const record of records) {
    const threadKey = record?.normalized_message?.thread_key || record?.normalized_message?.sender_psid || record?.normalized_message?.message_id || `record-${byThread.size}`;
    const previous = byThread.get(threadKey);
    const currentTime = Date.parse(record?.logged_at || 0) || 0;
    const previousTime = Date.parse(previous?.logged_at || 0) || 0;
    if (!previous || currentTime >= previousTime) {
      byThread.set(threadKey, record);
    }
  }
  return [...byThread.values()].sort((a, b) => (Date.parse(a?.logged_at || 0) || 0) - (Date.parse(b?.logged_at || 0) || 0));
}

function hasContinuitySignal(record, expectedCaseType) {
  return record?.thread_memory_before?.active_issue?.case_type === expectedCaseType
    || record?.thread_memory_after?.active_issue?.case_type === expectedCaseType;
}

function isLikelyFollowup(record) {
  return Boolean(record?.thread_memory_before?.active_issue?.case_type)
    || Boolean(record?.thread_memory_before?.asked_slots?.length)
    || Boolean(record?.thread_memory_before?.pending_customer_reply);
}

function readReplyText(record) {
  return String(
    record?.guarded_draft?.reply_text
    || record?.guarded_draft?.reply?.reply_text
    || record?.ai_draft?.reply_text
    || record?.ai_draft?.reply?.reply_text
    || ''
  );
}

function buildCompactSample(record) {
  return {
    logged_at: record?.logged_at || null,
    thread_key: record?.normalized_message?.thread_key || null,
    customer_text: record?.normalized_message?.text || null,
    case_type: record?.triage?.case_type || 'unknown',
    decision: record?.delivery?.decision || 'unknown',
    reply_text: readReplyText(record) || null,
    active_issue_before: record?.thread_memory_before?.active_issue || null,
    active_issue_after: record?.thread_memory_after?.active_issue || null,
    asked_slots_after: record?.thread_memory_after?.asked_slots || []
  };
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

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
