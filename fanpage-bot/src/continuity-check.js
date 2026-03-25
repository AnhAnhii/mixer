import fs from 'node:fs';
import path from 'node:path';
import { processWebhookBody } from './pipeline.js';
import { createThreadStateStore } from './thread-state.js';

const baseTmpDir = path.resolve(process.cwd(), 'data/tmp/continuity-check');
fs.mkdirSync(baseTmpDir, { recursive: true });

const dedupeStorePath = path.join(baseTmpDir, 'processed-message-ids.json');
const threadStatePath = path.join(baseTmpDir, 'thread-state.json');
const logPath = path.join(baseTmpDir, 'audit.jsonl');
const rawEventLogPath = path.join(baseTmpDir, 'raw-events.jsonl');
const handoffPath = path.join(baseTmpDir, 'pending-handoffs.jsonl');
const inHoursTimestamp = Date.UTC(2026, 2, 23, 3, 0, 0);

resetArtifacts();

const orderStatusResults = await runOrderStatusContinuityChecks();
const complaintResults = await runComplaintContinuityChecks();

const summary = {
  generated_at: new Date().toISOString(),
  focus: ['order_status_followup_continuity', 'complaint_followup_continuity'],
  temp_artifacts: {
    thread_state: threadStatePath,
    audit_log: logPath,
    raw_event_log: rawEventLogPath,
    pending_handoffs: handoffPath
  },
  checks: [orderStatusResults, complaintResults],
  quick_table: [orderStatusResults, complaintResults].map(toQuickRow),
  overall_pass: [orderStatusResults, complaintResults].every((item) => item.pass)
};

console.log(JSON.stringify(summary, null, 2));

async function runOrderStatusContinuityChecks() {
  resetStoresOnly();
  const store = createThreadStateStore({ threadStatePath });
  const threadKey = 'facebook:105265398928721:test-order-followup';

  store.updateMemory(threadKey, {
    normalizedMessage: {
      thread_key: threadKey,
      message_id: 'mid.seed.order.1',
      text: 'kiểm tra đơn giúp mình',
      timestamp: inHoursTimestamp
    },
    triage: {
      case_type: 'order_status_request',
      missing_info: ['order_code', 'receiver_phone'],
      reason: 'matched_order_status_rule',
      needs_human: true
    },
    guarded: {
      guarded_draft: {
        action: 'handoff',
        needs_human: true,
        missing_info: ['order_code', 'receiver_phone'],
        reason: 'need_order_identifiers',
        reply_text: 'Dạ anh/chị gửi giúp em mã đơn hoặc số điện thoại nhận hàng để bên em kiểm tra nhanh hơn nha.'
      },
      delivery: { decision: 'handoff' }
    }
  });

  const genericFollowupOutputs = await replaySingleMessage({
    senderId: 'test-order-followup',
    mid: 'mid.local.order.generic',
    text: 'dạ',
    timestamp: inHoursTimestamp + (60 * 1000)
  });

  const identifierFollowupOutputs = await replaySingleMessage({
    senderId: 'test-order-followup',
    mid: 'mid.local.order.identifier',
    text: 'sđt 0912 345 678',
    timestamp: inHoursTimestamp + (2 * 60 * 1000)
  });

  const generic = genericFollowupOutputs[0] || {};
  const identifier = identifierFollowupOutputs[0] || {};
  const genericReply = readReplyText(generic);
  const identifierReply = readReplyText(identifier);
  const resolvedSlots = (identifier.thread_memory_after?.asked_slots || [])
    .filter((item) => item?.status === 'resolved')
    .map((item) => item.slot);

  const assertions = {
    generic_followup_keeps_case: generic.triage?.case_type === 'order_status_request',
    generic_followup_stays_non_auto: ['handoff', 'draft_only'].includes(generic.delivery?.decision),
    generic_followup_requests_identifier: /mã đơn|số điện thoại nhận hàng/i.test(genericReply),
    generic_followup_has_continuity_flag: (generic.guarded_draft?.safety_flags || []).includes('order_status_followup_continuity'),
    identifier_followup_keeps_case: identifier.triage?.case_type === 'order_status_request',
    identifier_followup_stays_non_auto: ['handoff', 'draft_only'].includes(identifier.delivery?.decision),
    identifier_followup_acknowledges_received_info: /đã nhận.*số điện thoại/i.test(identifierReply),
    identifier_followup_clears_waiting_state: identifier.thread_memory_after?.pending_customer_reply === false,
    identifier_followup_marks_slot_resolved: resolvedSlots.includes('receiver_phone') || resolvedSlots.includes('phone')
  };

  return {
    key: 'order_status_followup_continuity',
    label: 'Order-status follow-up continuity',
    pass: Object.values(assertions).every(Boolean),
    assertions,
    sample: {
      generic_followup: buildCompactSample(generic),
      identifier_followup: buildCompactSample(identifier)
    }
  };
}

async function runComplaintContinuityChecks() {
  resetStoresOnly();
  const store = createThreadStateStore({ threadStatePath });
  const threadKey = 'facebook:105265398928721:test-complaint-followup';

  store.updateMemory(threadKey, {
    normalizedMessage: {
      thread_key: threadKey,
      message_id: 'mid.seed.complaint.1',
      text: 'shop xử lý quá tệ, mình rất thất vọng',
      timestamp: inHoursTimestamp
    },
    triage: {
      case_type: 'complaint_or_negative_feedback',
      missing_info: ['order_code'],
      reason: 'matched_negative_feedback_rule',
      needs_human: true
    },
    guarded: {
      guarded_draft: {
        action: 'handoff',
        needs_human: true,
        missing_info: ['order_code'],
        reason: 'negative_feedback_needs_human',
        reply_text: 'Dạ em xin lỗi anh/chị về trải nghiệm này ạ. Anh/chị gửi giúp em mã đơn để bên em kiểm tra kỹ hơn và hỗ trợ mình phù hợp hơn nha.'
      },
      delivery: { decision: 'handoff' }
    }
  });

  const followupOutputs = await replaySingleMessage({
    senderId: 'test-complaint-followup',
    mid: 'mid.local.complaint.identifier',
    text: 'mã đơn DH654321',
    timestamp: inHoursTimestamp + (60 * 1000)
  });

  const followup = followupOutputs[0] || {};
  const reply = readReplyText(followup);
  const resolvedSlots = (followup.thread_memory_after?.asked_slots || [])
    .filter((item) => item?.status === 'resolved')
    .map((item) => item.slot);

  const assertions = {
    followup_keeps_case: followup.triage?.case_type === 'complaint_or_negative_feedback',
    followup_stays_non_auto: ['handoff', 'draft_only'].includes(followup.delivery?.decision),
    followup_keeps_apology_tone: /xin lỗi/i.test(reply),
    followup_acknowledges_received_info: /đã nhận.*thông tin đơn/i.test(reply),
    followup_does_not_reask_identifier: !/mã đơn để bên em kiểm tra/i.test(reply),
    followup_has_continuity_flag: (followup.guarded_draft?.safety_flags || []).includes('complaint_followup_continuity'),
    followup_clears_waiting_state: followup.thread_memory_after?.pending_customer_reply === false,
    followup_marks_order_code_resolved: resolvedSlots.includes('order_code')
  };

  return {
    key: 'complaint_followup_continuity',
    label: 'Complaint follow-up continuity',
    pass: Object.values(assertions).every(Boolean),
    assertions,
    sample: {
      followup: buildCompactSample(followup)
    }
  };
}

async function replaySingleMessage({ senderId, mid, text, timestamp }) {
  return processWebhookBody({
    object: 'page',
    entry: [
      {
        id: '105265398928721',
        messaging: [
          {
            sender: { id: senderId },
            recipient: { id: '105265398928721' },
            timestamp,
            message: {
              mid,
              text
            }
          }
        ]
      }
    ]
  }, {
    autoReplyEnabled: true,
    shadowMode: false,
    dedupeStorePath,
    threadStatePath,
    logPath,
    rawEventLogPath,
    handoffPath,
    pageAccessToken: 'test-page-token',
    fetchImpl: async () => {
      throw new Error('fetch should not be called for continuity checks');
    }
  });
}

function buildCompactSample(output) {
  return {
    customer_text: output.normalized_message?.text || null,
    case_type: output.triage?.case_type || null,
    decision: output.delivery?.decision || null,
    reply_text: readReplyText(output) || null,
    pending_customer_reply_after: output.thread_memory_after?.pending_customer_reply ?? null,
    resolved_slots_after: (output.thread_memory_after?.asked_slots || [])
      .filter((item) => item?.status === 'resolved')
      .map((item) => item.slot),
    active_issue_after: output.thread_memory_after?.active_issue || null
  };
}

function readReplyText(output) {
  return String(
    output.guarded_draft?.reply_text
      || output.guarded_draft?.reply?.reply_text
      || output.ai_draft?.reply_text
      || output.ai_draft?.reply?.reply_text
      || ''
  );
}

function toQuickRow(item) {
  return {
    check: item.label,
    pass: item.pass,
    failed_assertions: Object.entries(item.assertions)
      .filter(([, value]) => !value)
      .map(([key]) => key)
  };
}

function resetArtifacts() {
  fs.rmSync(baseTmpDir, { recursive: true, force: true });
  fs.mkdirSync(baseTmpDir, { recursive: true });
}

function resetStoresOnly() {
  for (const filePath of [dedupeStorePath, threadStatePath, logPath, rawEventLogPath, handoffPath]) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
