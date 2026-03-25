import fs from 'node:fs';
import path from 'node:path';

const targetPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(process.cwd(), process.env.LOG_STORE_PATH || 'data/logs/audit.jsonl');
const limitArg = process.argv[3] || process.env.PRODUCTION_CHECK_LIMIT || '';
const limit = Number(limitArg) > 0 ? Number(limitArg) : 400;

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
  const specs = [
    {
      key: 'shipping_eta',
      label: 'A. Shipping ETA',
      expectedCaseType: 'shipping_eta_general',
      expectedDecisions: ['would_auto_send', 'auto_send', 'draft_only'],
      rejectDecisions: ['handoff'],
      rejectCaseTypes: ['unknown', 'greeting_or_opening', 'pricing_or_promotion'],
      canonicalReplyContains: [
        '2-3 ngày với đơn nội thành Hà Nội',
        '3-5 ngày với đơn ngoại thành Hà Nội',
        '4-7 ngày với đơn các tỉnh/thành khác ngoài Hà Nội'
      ],
      selectors: [
        /shop\s*ơi\s*ship\s*mấy\s*ngày\s*vậy/i,
        /ship\s*mấy\s*ngày\s*vậy\s*shop/i,
        /vậy\s*bên\s*mình\s*ship\s*mấy\s*ngày\s*nữa\s*shop/i
      ],
      matcher: (record, text) => textIncludesAny(text, [/ship\s*mấy\s*ngày/i, /giao\s*bao\s*lâu/i])
        || triageCase(record) === 'shipping_eta_general'
    },
    {
      key: 'pricing_followup_continuity',
      label: 'B. Pricing follow-up continuity',
      expectedCaseType: 'pricing_or_promotion',
      expectedDecisions: ['handoff', 'draft_only'],
      rejectDecisions: ['would_auto_send', 'auto_send'],
      rejectCaseTypes: ['unknown', 'shipping_eta_general', 'shipping_carrier'],
      selectors: [
        /shop\s*check\s*giúp\s*mình\s*nha/i,
        /check\s*giúp\s*mình\s*nha/i,
        /áo\s*này\s*giá\s*sao\s*shop/i
      ],
      matcher: (record, text) => textIncludesAny(text, [/giá\s*sao/i, /check\s*giúp\s*mình/i, /báo\s*giúp\s*mình/i])
        || activeIssueBefore(record) === 'pricing_or_promotion'
        || activeIssueAfter(record) === 'pricing_or_promotion'
        || triageCase(record) === 'pricing_or_promotion',
      extraChecks: (record) => {
        const notes = [];
        if (activeIssueBefore(record) === 'pricing_or_promotion' && triageCase(record) !== 'pricing_or_promotion') {
          notes.push('continuity_lost_from_thread_memory');
        }
        return notes;
      }
    },
    {
      key: 'order_status_followup_continuity',
      label: 'C. Order status follow-up continuity',
      expectedCaseType: 'order_status_request',
      expectedDecisions: ['handoff', 'draft_only'],
      rejectDecisions: ['would_auto_send', 'auto_send'],
      rejectCaseTypes: ['unknown', 'shipping_eta_general', 'shipping_carrier'],
      selectors: [
        /check\s*đơn/i,
        /sđt\s*0/i,
        /mã\s*đơn/i
      ],
      matcher: (record, text) => textIncludesAny(text, [/check\s*đơn/i, /sđt\s*0/i, /mã\s*đơn/i])
        || activeIssueBefore(record) === 'order_status_request'
        || activeIssueAfter(record) === 'order_status_request'
        || triageCase(record) === 'order_status_request',
      extraChecks: (record) => {
        const notes = [];
        const resolvedSlots = new Set(((record?.thread_memory_after?.asked_slots) || [])
          .filter((item) => item?.status === 'resolved')
          .map((item) => item?.slot));
        if (textIncludesAny(normalizedText(record), [/sđt\s*0/i, /mã\s*đơn/i])
          && !['order_code', 'phone', 'receiver_phone'].some((slot) => resolvedSlots.has(slot))) {
          notes.push('identifier_followup_seen_but_slot_not_resolved');
        }
        if (textIncludesAny(normalizedText(record), [/sđt\s*0/i, /mã\s*đơn/i])
          && activeIssueAfter(record) !== 'order_status_request') {
          notes.push('identifier_followup_left_order_status_lane');
        }
        return notes;
      }
    },
    {
      key: 'complaint_negative_feedback',
      label: 'D. Complaint / negative feedback',
      expectedCaseType: 'complaint_or_negative_feedback',
      expectedDecisions: ['handoff', 'draft_only'],
      rejectDecisions: ['would_auto_send', 'auto_send'],
      rejectCaseTypes: ['shipping_eta_general'],
      selectors: [
        /bực\s*mình/i,
        /nhận\s*hàng\s*lỗi/i,
        /ship\s*lâu\s*quá/i
      ],
      matcher: (record, text) => textIncludesAny(text, [/bực\s*mình/i, /nhận\s*hàng\s*lỗi/i, /ship\s*lâu\s*quá/i])
        || triageCase(record) === 'complaint_or_negative_feedback'
        || activeIssueAfter(record) === 'complaint_or_negative_feedback',
      extraChecks: (record) => {
        const notes = [];
        const reply = readReplyText(record);
        if (reply && !/xin lỗi|kiểm tra|hỗ trợ/i.test(reply)) {
          notes.push('complaint_tone_may_be_too_weak');
        }
        return notes;
      }
    }
  ];

  const laneSummaries = specs.map((spec) => summarizeLane(spec, records));
  const overallPass = laneSummaries.every((lane) => lane.pass || lane.status === 'not_observed_yet');
  const requiredRetest = laneSummaries
    .filter((lane) => lane.status === 'not_observed_yet' || !lane.pass)
    .map((lane) => ({ key: lane.key, label: lane.label, status: lane.status, reasons: lane.fail_reasons }));

  return {
    source: meta.targetPath,
    records_analyzed: records.length,
    limited_to_last: meta.limit,
    time_range: buildTimeRange(records),
    overall_pass: overallPass,
    lanes: laneSummaries,
    quick_table: laneSummaries.map((lane) => ({
      case: lane.label,
      status: lane.status,
      pass: lane.pass,
      observed_at: lane.latest_sample?.logged_at || null,
      observed_text: lane.latest_sample?.customer_text || null,
      observed_case_type: lane.latest_sample?.case_type || null,
      observed_decision: lane.latest_sample?.decision || null,
      fail_reasons: lane.fail_reasons
    })),
    required_retest: requiredRetest,
    operator_readback: buildOperatorReadback(laneSummaries)
  };
}

function summarizeLane(spec, records) {
  const matching = records.filter((record) => spec.matcher(record, normalizedText(record)));
  const selected = chooseBestRecord(spec, matching);

  if (!selected) {
    return {
      key: spec.key,
      label: spec.label,
      status: 'not_observed_yet',
      pass: false,
      observed_records: 0,
      fail_reasons: ['No matching evidence found in the scanned audit window.'],
      latest_sample: null
    };
  }

  const failReasons = [];
  const caseType = triageCase(selected) || 'unknown';
  const decision = deliveryDecision(selected) || 'unknown';
  const replyText = readReplyText(selected);

  if (caseType !== spec.expectedCaseType) {
    failReasons.push(`expected_case_type=${spec.expectedCaseType} but saw ${caseType}`);
  }
  if (!spec.expectedDecisions.includes(decision)) {
    failReasons.push(`expected_decision in [${spec.expectedDecisions.join(', ')}] but saw ${decision}`);
  }
  if (spec.rejectCaseTypes?.includes(caseType)) {
    failReasons.push(`rejected_case_type=${caseType}`);
  }
  if (spec.rejectDecisions?.includes(decision)) {
    failReasons.push(`rejected_decision=${decision}`);
  }
  if (spec.canonicalReplyContains?.length) {
    const missing = spec.canonicalReplyContains.filter((phrase) => !replyText.includes(phrase));
    if (missing.length) {
      failReasons.push(`canonical_reply_drift missing ${missing.length}/${spec.canonicalReplyContains.length} phrase(s)`);
    }
  }

  const extraChecks = spec.extraChecks ? spec.extraChecks(selected) : [];
  failReasons.push(...extraChecks);

  return {
    key: spec.key,
    label: spec.label,
    status: failReasons.length ? 'fail' : 'pass',
    pass: failReasons.length === 0,
    observed_records: matching.length,
    fail_reasons: failReasons,
    latest_sample: buildCompactSample(selected)
  };
}

function chooseBestRecord(spec, records) {
  if (!records.length) {
    return null;
  }

  const candidates = records
    .filter((record) => deliveryDecision(record) !== 'ignore')
    .map((record) => ({ record, score: scoreRecord(spec, record) }))
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return recordTime(a.record) - recordTime(b.record);
    });

  return (candidates[0]?.record) || records.at(-1) || null;
}

function scoreRecord(spec, record) {
  let score = 0;
  const text = normalizedText(record);
  if (spec.selectors?.some((pattern) => pattern.test(text))) score += 6;
  if (triageCase(record) === spec.expectedCaseType) score += 5;
  if (activeIssueBefore(record) === spec.expectedCaseType) score += 4;
  if (activeIssueAfter(record) === spec.expectedCaseType) score += 4;
  if (spec.expectedDecisions.includes(deliveryDecision(record))) score += 2;
  if (deliveryDecision(record) === 'ignore') score -= 10;
  if (text) score += 1;
  return score;
}

function buildOperatorReadback(lanes) {
  return lanes.map((lane) => {
    if (lane.status === 'not_observed_yet') {
      return `${lane.label}: chưa có evidence trong cửa sổ log đang scan, cần gửi lại case này ở production.`;
    }
    if (lane.pass) {
      return `${lane.label}: PASS — ${lane.latest_sample?.case_type} / ${lane.latest_sample?.decision}.`;
    }
    return `${lane.label}: FAIL — ${lane.fail_reasons.join('; ')}.`;
  });
}

function buildCompactSample(record) {
  return {
    logged_at: record?.logged_at || null,
    customer_text: normalizedText(record) || null,
    case_type: triageCase(record) || 'unknown',
    decision: deliveryDecision(record) || 'unknown',
    reply_text: readReplyText(record) || null,
    active_issue_before: activeIssueBefore(record) || null,
    active_issue_after: activeIssueAfter(record) || null,
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

function normalizedText(record) {
  return String(record?.normalized_message?.text || '').trim();
}

function triageCase(record) {
  return record?.triage?.case_type || null;
}

function deliveryDecision(record) {
  return record?.delivery?.decision || null;
}

function activeIssueBefore(record) {
  return record?.thread_memory_before?.active_issue?.case_type || null;
}

function activeIssueAfter(record) {
  return record?.thread_memory_after?.active_issue?.case_type || null;
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

function textIncludesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function recordTime(record) {
  return Date.parse(record?.logged_at || 0) || 0;
}
