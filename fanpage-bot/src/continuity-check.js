import fs from 'node:fs';
import path from 'node:path';
import { processWebhookBody } from './pipeline.js';
import { createThreadStateStore } from './thread-state.js';
import { classifyMessage } from './classify.js';

const baseTmpDir = path.resolve(process.cwd(), 'data/tmp/continuity-check');
fs.mkdirSync(baseTmpDir, { recursive: true });

const dedupeStorePath = path.join(baseTmpDir, 'processed-message-ids.json');
const threadStatePath = path.join(baseTmpDir, 'thread-state.json');
const logPath = path.join(baseTmpDir, 'audit.jsonl');
const rawEventLogPath = path.join(baseTmpDir, 'raw-events.jsonl');
const handoffPath = path.join(baseTmpDir, 'pending-handoffs.jsonl');
const inHoursTimestamp = Date.UTC(2026, 2, 23, 3, 0, 0);
const pageId = '105265398928721';

resetArtifacts();

const pricingResults = await runPricingDetailAcknowledgementChecks();
const stockResults = await runStockFollowupContinuityChecks();
const orderStatusResults = await runOrderStatusContinuityChecks();
const complaintResults = await runComplaintContinuityChecks();
const paymentScamResults = await runPaymentScamContinuityChecks();
const exchangeReturnResults = await runExchangeReturnContinuityChecks();

const checks = [
  pricingResults,
  stockResults,
  orderStatusResults,
  complaintResults,
  paymentScamResults,
  exchangeReturnResults
].flat();

const summary = {
  generated_at: new Date().toISOString(),
  focus: checks.map((item) => item.key),
  temp_artifacts: {
    thread_state: threadStatePath,
    audit_log: logPath,
    raw_event_log: rawEventLogPath,
    pending_handoffs: handoffPath
  },
  checks,
  quick_table: checks.map(toQuickRow),
  overall_pass: checks.every((item) => item.pass),
  operator_readback: buildOperatorReadback(checks),
  operator_report_lines: buildOperatorReportLines(checks),
  report_markdown: buildMarkdownReport(checks)
};

console.log(JSON.stringify(summary, null, 2));

async function runPricingDetailAcknowledgementChecks() {
  const variantOnlyCheck = await runPricingVariantOnlyFollowupCheck();
  const fullDetailCheck = await runPricingFullDetailLaneCheck();
  return [variantOnlyCheck, fullDetailCheck];
}

async function runPricingVariantOnlyFollowupCheck() {
  resetStoresOnly();
  const store = createThreadStateStore({ threadStatePath });
  const senderId = 'test-pricing-followup';
  const threadKey = `facebook:${pageId}:${senderId}`;

  seedPricingFollowupMemory(store, threadKey, {
    messageId: 'mid.seed.pricing.1',
    missingInfo: ['product_name', 'size_or_variant'],
    reason: 'pricing_context_missing_product'
  });

  const followupOutputs = await replaySingleMessage({
    senderId,
    mid: 'mid.local.pricing.detail',
    text: 'màu đen size L nha shop',
    timestamp: inHoursTimestamp + (60 * 1000)
  });

  const followup = followupOutputs[0] || {};
  const reply = readReplyText(followup);
  const missingInfo = guardedMissingInfo(followup);
  const resolvedSlots = resolvedSlotsAfter(followup);
  const flags = safetyFlags(followup);

  const assertions = {
    followup_keeps_case: followup.triage?.case_type === 'pricing_or_promotion',
    followup_stays_non_auto: ['handoff', 'draft_only'].includes(followup.delivery?.decision),
    followup_acknowledges_received_detail: /đã nhận.*size|đã nhận.*màu|đã nhận.*biến thể/i.test(reply),
    followup_mentions_remaining_need: /tên mẫu|ảnh\/link sản phẩm/i.test(reply),
    followup_keeps_price_check_path: /kiểm tra đúng giá\/ưu đãi hiện có/i.test(reply),
    followup_keeps_product_slot_unresolved: !resolvedSlots.includes('product_name'),
    followup_resolves_variant_slot: resolvedSlots.includes('size_or_variant') || resolvedSlots.includes('size'),
    followup_refines_missing_info_to_product_only: missingInfo.length === 1 && missingInfo.includes('product_name'),
    followup_sets_refinement_flag: flags.includes('repeat_info_request_refined')
  };

  return {
    key: 'pricing_variant_only_refinement',
    label: 'Pricing variant-only refinement',
    pass: Object.values(assertions).every(Boolean),
    assertions,
    sample: {
      followup: buildCompactSample(followup)
    }
  };
}

async function runPricingFullDetailLaneCheck() {
  resetStoresOnly();
  const store = createThreadStateStore({ threadStatePath });
  const senderId = 'test-pricing-full-detail';
  const threadKey = `facebook:${pageId}:${senderId}`;

  seedPricingFollowupMemory(store, threadKey, {
    messageId: 'mid.seed.pricing.full.1',
    missingInfo: ['product_name', 'size_or_variant'],
    reason: 'pricing_context_missing_product'
  });

  const followupOutputs = await replaySingleMessage({
    senderId,
    mid: 'mid.local.pricing.full.detail',
    text: 'áo polo basic màu đen size L nha',
    timestamp: inHoursTimestamp + (60 * 1000)
  });

  const followup = followupOutputs[0] || {};
  const reply = readReplyText(followup);
  const missingInfo = guardedMissingInfo(followup);
  const resolvedSlots = resolvedSlotsAfter(followup);

  const assertions = {
    followup_keeps_case: followup.triage?.case_type === 'pricing_or_promotion',
    followup_stays_non_auto: ['handoff', 'draft_only'].includes(followup.delivery?.decision),
    followup_acknowledges_received_detail: /đã nhận thông tin mẫu|đã nhận mẫu/i.test(reply),
    followup_keeps_price_check_path: /kiểm tra lại giá\/ưu đãi|phản hồi mình sớm nhất/i.test(reply),
    followup_does_not_reask_product_detail: !/tên mẫu cụ thể|ảnh\/link sản phẩm/i.test(reply),
    followup_resolves_product_slot: resolvedSlots.includes('product_name'),
    followup_resolves_variant_slot: resolvedSlots.includes('size_or_variant') || resolvedSlots.includes('size'),
    followup_missing_info_refined_or_cleared: !missingInfo.includes('product_name'),
    followup_avoids_generic_unknown_fallback: followup.triage?.case_type !== 'unknown' && !/chia sẻ thêm giúp em nội dung cần hỗ trợ/i.test(reply)
  };

  return {
    key: 'pricing_detail_acknowledgement',
    label: 'Pricing detail acknowledgement',
    pass: Object.values(assertions).every(Boolean),
    assertions,
    sample: {
      followup: buildCompactSample(followup)
    }
  };
}

function seedPricingFollowupMemory(store, threadKey, { messageId, missingInfo, reason }) {
  store.updateMemory(threadKey, {
    normalizedMessage: {
      thread_key: threadKey,
      message_id: messageId,
      text: 'áo này giá sao shop',
      timestamp: inHoursTimestamp
    },
    triage: {
      case_type: 'pricing_or_promotion',
      missing_info: missingInfo,
      reason: 'matched_pricing_followup_rule',
      needs_human: true
    },
    guarded: {
      guarded_draft: {
        action: 'handoff',
        needs_human: true,
        missing_info: missingInfo,
        reason,
        reply_text: 'Dạ để em báo đúng giá/ưu đãi hiện có, anh/chị gửi giúp em tên mẫu hoặc ảnh/link sản phẩm mình đang xem nha. Nếu có size/màu mình quan tâm thì nhắn kèm giúp em luôn ạ.'
      },
      delivery: { decision: 'handoff' }
    }
  });
}

async function runStockFollowupContinuityChecks() {
  resetStoresOnly();
  const store = createThreadStateStore({ threadStatePath });
  const senderId = 'test-stock-followup';
  const threadKey = `facebook:${pageId}:${senderId}`;

  store.updateMemory(threadKey, {
    normalizedMessage: {
      thread_key: threadKey,
      message_id: 'mid.seed.stock.1',
      text: 'còn mẫu này không shop',
      timestamp: inHoursTimestamp
    },
    triage: {
      case_type: 'stock_or_product_availability',
      missing_info: ['product_name', 'size_or_variant', 'color_if_relevant'],
      reason: 'matched_stock_check_rule',
      needs_human: true
    },
    guarded: {
      guarded_draft: {
        action: 'handoff',
        needs_human: true,
        missing_info: ['product_name', 'size_or_variant', 'color_if_relevant'],
        reason: 'requires_stock_verification',
        reply_text: 'Anh/chị giúp em gửi tên mẫu kèm size/màu mình cần để bên em kiểm tra lại chính xác hơn nha.'
      },
      delivery: { decision: 'handoff' }
    }
  });

  const followupOutputs = await replaySingleMessage({
    senderId,
    mid: 'mid.local.stock.detail',
    text: 'áo polo basic màu đen size m nha',
    timestamp: inHoursTimestamp + (60 * 1000)
  });

  const followup = followupOutputs[0] || {};
  const reply = readReplyText(followup);
  const missingInfo = guardedMissingInfo(followup);
  const resolvedSlots = resolvedSlotsAfter(followup);
  const flags = safetyFlags(followup);

  const assertions = {
    followup_keeps_case: followup.triage?.case_type === 'stock_or_product_availability',
    followup_stays_non_auto: ['handoff', 'draft_only'].includes(followup.delivery?.decision),
    followup_acknowledges_received_detail: /đã nhận.*mẫu\/size|đã nhận.*size|đã nhận.*mẫu/i.test(reply),
    followup_does_not_reask_variant_blindly: !/gửi tên mẫu kèm size\/màu/i.test(reply),
    followup_has_continuity_flag: flags.includes('stock_followup_continuity'),
    followup_missing_info_cleared: Array.isArray(missingInfo) && missingInfo.length === 0,
    followup_resolves_product_slot: resolvedSlots.includes('product_name'),
    followup_resolves_variant_slot: resolvedSlots.includes('size_or_variant') || resolvedSlots.includes('size'),
    followup_waiting_state_cleared: followup.thread_memory_after?.pending_customer_reply === false
  };

  return {
    key: 'stock_followup_continuity',
    label: 'Stock follow-up continuity',
    pass: Object.values(assertions).every(Boolean),
    assertions,
    sample: {
      followup: buildCompactSample(followup)
    }
  };
}

async function runOrderStatusContinuityChecks() {
  resetStoresOnly();
  const store = createThreadStateStore({ threadStatePath });
  const senderId = 'test-order-followup';
  const threadKey = `facebook:${pageId}:${senderId}`;

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
    senderId,
    mid: 'mid.local.order.generic',
    text: 'dạ',
    timestamp: inHoursTimestamp + (60 * 1000)
  });

  const identifierFollowupOutputs = await replaySingleMessage({
    senderId,
    mid: 'mid.local.order.identifier',
    text: 'sđt 0912 345 678',
    timestamp: inHoursTimestamp + (2 * 60 * 1000)
  });

  const generic = genericFollowupOutputs[0] || {};
  const identifier = identifierFollowupOutputs[0] || {};
  const genericReply = readReplyText(generic);
  const identifierReply = readReplyText(identifier);
  const resolvedSlots = resolvedSlotsAfter(identifier);

  const assertions = {
    generic_followup_keeps_case: generic.triage?.case_type === 'order_status_request',
    generic_followup_stays_non_auto: ['handoff', 'draft_only'].includes(generic.delivery?.decision),
    generic_followup_requests_identifier: /mã đơn|số điện thoại nhận hàng/i.test(genericReply),
    generic_followup_has_continuity_flag: safetyFlags(generic).includes('order_status_followup_continuity'),
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
  const senderId = 'test-complaint-followup';
  const threadKey = `facebook:${pageId}:${senderId}`;

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
    senderId,
    mid: 'mid.local.complaint.identifier',
    text: 'mã đơn DH654321',
    timestamp: inHoursTimestamp + (60 * 1000)
  });

  const followup = followupOutputs[0] || {};
  const reply = readReplyText(followup);
  const resolvedSlots = resolvedSlotsAfter(followup);

  const assertions = {
    followup_keeps_case: followup.triage?.case_type === 'complaint_or_negative_feedback',
    followup_stays_non_auto: ['handoff', 'draft_only'].includes(followup.delivery?.decision),
    followup_keeps_apology_tone: /xin lỗi/i.test(reply),
    followup_acknowledges_received_info: /đã nhận.*thông tin đơn/i.test(reply),
    followup_does_not_reask_identifier: !/mã đơn để bên em kiểm tra/i.test(reply),
    followup_has_continuity_flag: safetyFlags(followup).includes('complaint_followup_continuity'),
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

async function runPaymentScamContinuityChecks() {
  resetStoresOnly();
  const store = createThreadStateStore({ threadStatePath });
  const senderId = 'test-payment-scam-followup';
  const threadKey = `facebook:${pageId}:${senderId}`;

  store.updateMemory(threadKey, {
    normalizedMessage: {
      thread_key: threadKey,
      message_id: 'mid.seed.payment.1',
      text: 'mình hơi lo, page này có chính thức không và chuyển khoản có an toàn không shop',
      timestamp: inHoursTimestamp
    },
    triage: {
      case_type: 'payment_or_scam_concern',
      missing_info: ['brief_context_of_concern_if_not_clear', 'order_code'],
      reason: 'matched_payment_or_scam_concern_rule',
      needs_human: true
    },
    guarded: {
      guarded_draft: {
        action: 'handoff',
        needs_human: true,
        missing_info: ['brief_context_of_concern_if_not_clear', 'order_code'],
        reason: 'payment_or_scam_concern_needs_human',
        reply_text: 'Dạ bên em rất tiếc vì anh/chị đang lo về vấn đề thanh toán/độ uy tín ạ. Anh/chị giúp em gửi thêm mã đơn, số điện thoại nhận hàng hoặc mô tả ngắn tình huống để bên em kiểm tra và hỗ trợ mình theo luồng xác minh phù hợp nha.'
      },
      delivery: { decision: 'handoff' }
    }
  });

  const initialOutputs = await replaySingleMessage({
    senderId: 'test-payment-scam-initial',
    mid: 'mid.local.payment.initial',
    text: 'shop ơi page này có chính thức không, chuyển khoản trước có an toàn không ạ',
    timestamp: inHoursTimestamp + (30 * 1000)
  });

  const followupOutputs = await replaySingleMessage({
    senderId,
    mid: 'mid.local.payment.identifier',
    text: 'mã đơn DH888999, mình chuyển khoản lúc nãy rồi',
    timestamp: inHoursTimestamp + (60 * 1000)
  });

  const initial = initialOutputs[0] || {};
  const followup = followupOutputs[0] || {};
  const initialReply = readReplyText(initial);
  const followupReply = readReplyText(followup);
  const resolvedSlots = resolvedSlotsAfter(followup);
  const followupFlags = safetyFlags(followup);
  const followupMissingInfo = guardedMissingInfo(followup);

  const pageTrustProbe = classifyMessage({ text: 'page có chính thức không ạ' });
  const billProbe = classifyMessage({ text: 'bill này có phải giả không' });
  const transferProbe = classifyMessage({ text: 'mình chuyển khoản rồi mà chưa thấy shop xác nhận' });
  const ckProbe = classifyMessage({ text: 'em ck rồi nhưng chưa thấy lên đơn' });

  const assertions = {
    initial_detects_payment_or_scam_case: initial.triage?.case_type === 'payment_or_scam_concern',
    initial_stays_non_auto: ['handoff', 'draft_only'].includes(initial.delivery?.decision),
    initial_acknowledges_concern: /lo về vấn đề thanh toán|độ uy tín|kiểm tra và hỗ trợ mình theo luồng xác minh/i.test(initialReply),
    initial_does_not_downplay_risk: !/cứ chuyển khoản|hoàn toàn an toàn|yên tâm tuyệt đối/i.test(initialReply),
    page_trust_probe_detected: pageTrustProbe.case_type === 'payment_or_scam_concern',
    fake_bill_probe_detected: billProbe.case_type === 'payment_or_scam_concern',
    transfer_pending_probe_detected: transferProbe.case_type === 'payment_or_scam_concern',
    ck_pending_probe_detected: ckProbe.case_type === 'payment_or_scam_concern',
    followup_keeps_case: followup.triage?.case_type === 'payment_or_scam_concern',
    followup_stays_non_auto: ['handoff', 'draft_only'].includes(followup.delivery?.decision),
    followup_acknowledges_received_info: /đã nhận thông tin đơn\/thanh toán/i.test(followupReply),
    followup_has_continuity_flag: followupFlags.includes('payment_or_scam_followup_continuity'),
    followup_waiting_state_matches_remaining_context: followupMissingInfo.length > 0
      ? followup.thread_memory_after?.pending_customer_reply === true
      : followup.thread_memory_after?.pending_customer_reply === false,
    followup_marks_identifier_resolved: ['order_code', 'phone', 'receiver_phone'].some((slot) => resolvedSlots.includes(slot))
  };

  return {
    key: 'payment_or_scam_followup_continuity',
    label: 'Payment/scam concern continuity',
    pass: Object.values(assertions).every(Boolean),
    assertions,
    sample: {
      initial: buildCompactSample(initial),
      followup: buildCompactSample(followup)
    }
  };
}

async function runExchangeReturnContinuityChecks() {
  resetStoresOnly();
  const orderCodeStore = createThreadStateStore({ threadStatePath });
  const orderCodeSenderId = 'test-exchange-followup-order-code';
  const orderCodeThreadKey = `facebook:${pageId}:${orderCodeSenderId}`;

  orderCodeStore.updateMemory(orderCodeThreadKey, {
    normalizedMessage: {
      thread_key: orderCodeThreadKey,
      message_id: 'mid.seed.exchange.1',
      text: 'shop ơi mình muốn đổi vì quạt bị lỗi',
      timestamp: inHoursTimestamp
    },
    triage: {
      case_type: 'exchange_return_specific',
      missing_info: ['order_code', 'product_issue_detail'],
      reason: 'matched_exchange_or_defect_rule',
      needs_human: true
    },
    guarded: {
      guarded_draft: {
        action: 'handoff',
        needs_human: true,
        missing_info: ['order_code', 'product_issue_detail'],
        reason: 'exchange_return_case_needs_human',
        reply_text: 'Dạ anh/chị cho em xin mã đơn và mô tả lỗi để bên em hỗ trợ mình chuẩn hơn ạ.'
      },
      delivery: { decision: 'handoff' }
    }
  });

  const orderCodeFollowupOutputs = await replaySingleMessage({
    senderId: orderCodeSenderId,
    mid: 'mid.local.exchange.order_code',
    text: 'mã đơn DH123456',
    timestamp: inHoursTimestamp + (60 * 1000)
  });

  resetStoresOnly();
  const issueStore = createThreadStateStore({ threadStatePath });
  const issueSenderId = 'test-exchange-followup-issue';
  const issueThreadKey = `facebook:${pageId}:${issueSenderId}`;

  issueStore.updateMemory(issueThreadKey, {
    normalizedMessage: {
      thread_key: issueThreadKey,
      message_id: 'mid.seed.exchange.2',
      text: 'shop ơi mình muốn đổi',
      timestamp: inHoursTimestamp
    },
    triage: {
      case_type: 'exchange_return_specific',
      missing_info: ['order_code', 'product_issue_detail'],
      reason: 'matched_exchange_or_defect_rule',
      needs_human: true
    },
    guarded: {
      guarded_draft: {
        action: 'handoff',
        needs_human: true,
        missing_info: ['order_code', 'product_issue_detail'],
        reason: 'exchange_return_case_needs_human',
        reply_text: 'Dạ anh/chị cho em xin mã đơn và mô tả lỗi để bên em hỗ trợ mình chuẩn hơn ạ.'
      },
      delivery: { decision: 'handoff' }
    }
  });

  const issueFollowupOutputs = await replaySingleMessage({
    senderId: issueSenderId,
    mid: 'mid.local.exchange.issue',
    text: 'quạt bị gãy cánh với rung mạnh',
    timestamp: inHoursTimestamp + (2 * 60 * 1000)
  });

  const orderCodeFollowup = orderCodeFollowupOutputs[0] || {};
  const issueFollowup = issueFollowupOutputs[0] || {};
  const orderCodeReply = readReplyText(orderCodeFollowup);
  const issueReply = readReplyText(issueFollowup);
  const orderCodeResolvedSlots = resolvedSlotsAfter(orderCodeFollowup);
  const issueResolvedSlots = resolvedSlotsAfter(issueFollowup);
  const orderCodeMissingInfo = guardedMissingInfo(orderCodeFollowup);

  const assertions = {
    order_code_followup_keeps_case: orderCodeFollowup.triage?.case_type === 'exchange_return_specific',
    order_code_followup_stays_non_auto: ['handoff', 'draft_only'].includes(orderCodeFollowup.delivery?.decision),
    order_code_followup_acknowledges_received_order_code: /đã nhận.*thông tin đổi\/trả|đã nhận.*mã đơn/i.test(orderCodeReply),
    order_code_followup_only_requests_remaining_context_or_completes_intake: (
      /mô tả lỗi|lý do đổi/i.test(orderCodeReply) && !/mã đơn.*ngày nhận hàng.*lý do/i.test(orderCodeReply)
    ) || (Array.isArray(orderCodeMissingInfo) && orderCodeMissingInfo.length === 0 && orderCodeFollowup.thread_memory_after?.pending_customer_reply === false),
    order_code_followup_has_continuity_flag: safetyFlags(orderCodeFollowup).includes('exchange_return_followup_continuity'),
    order_code_followup_marks_order_slot_resolved: orderCodeResolvedSlots.includes('order_code'),
    issue_followup_keeps_case: issueFollowup.triage?.case_type === 'exchange_return_specific',
    issue_followup_stays_non_auto: ['handoff', 'draft_only'].includes(issueFollowup.delivery?.decision),
    issue_followup_acknowledges_received_issue_detail: /đã nhận thêm thông tin|đã nhận mô tả lỗi/i.test(issueReply),
    issue_followup_asks_only_remaining_order_code: /mã đơn/i.test(issueReply) && !/ngày nhận hàng/i.test(issueReply),
    issue_followup_has_continuity_flag: safetyFlags(issueFollowup).includes('exchange_return_followup_continuity'),
    issue_followup_marks_issue_slot_resolved: issueResolvedSlots.includes('product_issue_detail') || issueResolvedSlots.includes('reason_for_exchange_or_return')
  };

  return {
    key: 'exchange_return_followup_continuity',
    label: 'Exchange/return + defect follow-up continuity',
    pass: Object.values(assertions).every(Boolean),
    assertions,
    sample: {
      order_code_followup: buildCompactSample(orderCodeFollowup),
      issue_followup: buildCompactSample(issueFollowup)
    }
  };
}

async function replaySingleMessage({ senderId, mid, text, timestamp }) {
  return processWebhookBody({
    object: 'page',
    entry: [
      {
        id: pageId,
        messaging: [
          {
            sender: { id: senderId },
            recipient: { id: pageId },
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
    reason: output.guarded_draft?.reason || output.ai_draft?.reason || null,
    reply_text: readReplyText(output) || null,
    pending_customer_reply_after: output.thread_memory_after?.pending_customer_reply ?? null,
    missing_info_after: guardedMissingInfo(output),
    resolved_slots_after: resolvedSlotsAfter(output),
    asked_slots_after: normalizeAskedSlotEvidence(output.thread_memory_after?.asked_slots),
    active_issue_before: output.thread_memory_before?.active_issue || null,
    active_issue_after: output.thread_memory_after?.active_issue || null,
    safety_flags: safetyFlags(output)
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

function guardedMissingInfo(output) {
  const missing = output.guarded_draft?.missing_info
    || output.guarded_draft?.reply?.missing_info
    || output.triage?.missing_info
    || [];
  return Array.isArray(missing) ? missing.filter(Boolean) : [];
}

function safetyFlags(output) {
  return Array.isArray(output.guarded_draft?.safety_flags) ? output.guarded_draft.safety_flags : [];
}

function resolvedSlotsAfter(output) {
  return (output.thread_memory_after?.asked_slots || [])
    .filter((item) => item?.status === 'resolved' && item?.slot)
    .map((item) => item.slot);
}

function normalizeAskedSlotEvidence(askedSlots = []) {
  return (askedSlots || []).map((item) => ({
    slot: item?.slot || null,
    status: item?.status || null,
    resolved_value_preview: item?.resolved_value_preview || null
  }));
}

function toQuickRow(item) {
  const failedAssertions = Object.entries(item.assertions)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    check: item.label,
    pass: item.pass,
    failed_assertions: failedAssertions,
    evidence: pickPrimarySample(item)?.asked_slots_after || null
  };
}

function buildOperatorReadback(checks) {
  return checks.map((item) => {
    const sample = pickPrimarySample(item);
    if (!sample) {
      return `${item.label}: ${item.pass ? 'PASS' : 'FAIL'} — chưa có sample output.`;
    }

    const continuity = summarizeContinuity(sample);
    const failedAssertions = listFailedAssertions(item);

    if (item.pass) {
      return `${item.label}: PASS — ${sample.case_type || 'unknown'} / ${sample.decision || 'unknown'}${continuity ? ` | ${continuity}` : ''}.`;
    }

    return `${item.label}: FAIL — ${failedAssertions.join(', ')}${continuity ? ` | ${continuity}` : ''}.`;
  });
}

function buildOperatorReportLines(checks) {
  return checks.map((item) => {
    const sample = pickPrimarySample(item);
    const failedAssertions = listFailedAssertions(item);

    return {
      lane: item.label,
      status: item.pass ? 'pass' : 'fail',
      summary: sample
        ? `${item.pass ? 'PASS' : 'FAIL'} — ${sample.case_type || 'unknown'} / ${sample.decision || 'unknown'}`
        : `${item.pass ? 'PASS' : 'FAIL'} — sample missing`,
      next_action: item.pass
        ? 'Lane này đang đủ rõ để đọc continuity/readback nhanh.'
        : 'Mở sample lane này, nhìn reply + missing/resolved slots + safety flags rồi fix đúng chỗ.',
      evidence: sample ? buildEvidence(sample) : null,
      failed_assertions: failedAssertions
    };
  });
}

function buildMarkdownReport(checks) {
  const lines = [
    '# Continuity regression readback',
    '',
    `- Overall: **${checks.every((item) => item.pass) ? 'PASS' : 'CHECK REQUIRED'}**`,
    `- Generated: ${new Date().toISOString()}`,
    ''
  ];

  for (const item of checks) {
    const sample = pickPrimarySample(item);
    const failedAssertions = listFailedAssertions(item);
    const evidence = sample ? buildEvidence(sample) : null;

    lines.push(`## ${item.label}`);
    lines.push(`- Status: **${item.pass ? 'PASS' : 'FAIL'}**`);
    if (!sample) {
      lines.push('- Evidence: (no sample)');
      lines.push('');
      continue;
    }

    lines.push(`- Observed: \`${sample.case_type || 'unknown'}\` / \`${sample.decision || 'unknown'}\``);
    lines.push(`- Customer: ${sample.customer_text || '(empty)'}`);
    lines.push(`- Reply: ${sample.reply_text || '(no reply text)'}`);
    lines.push(`- Continuity: ${evidence.continuity || '-'}`);
    lines.push(`- Missing after: ${evidence.missing_info_after?.length ? evidence.missing_info_after.join(', ') : '(none)'}`);
    lines.push(`- Safety flags: ${evidence.safety_flags?.length ? evidence.safety_flags.join(', ') : '(none)'}`);
    lines.push(`- Failed assertions: ${failedAssertions.length ? failedAssertions.join(', ') : '(none)'}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

function pickPrimarySample(item) {
  if (item.sample?.followup) return item.sample.followup;
  if (item.sample?.identifier_followup) return item.sample.identifier_followup;
  if (item.sample?.order_code_followup) return item.sample.order_code_followup;
  const firstSample = Object.values(item.sample || {}).find((value) => value && typeof value === 'object');
  return firstSample || null;
}

function listFailedAssertions(item) {
  return Object.entries(item.assertions || {})
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

function buildEvidence(sample) {
  return {
    customer_text: sample.customer_text || null,
    reply_text: sample.reply_text || null,
    continuity: summarizeContinuity(sample),
    missing_info_after: sample.missing_info_after || [],
    safety_flags: sample.safety_flags || []
  };
}

function summarizeContinuity(sample) {
  const bits = [];
  const beforeCase = sample.active_issue_before?.case_type || null;
  const afterCase = sample.active_issue_after?.case_type || null;
  if (beforeCase) bits.push(`before=${beforeCase}`);
  if (afterCase) bits.push(`after=${afterCase}`);

  const resolved = (sample.resolved_slots_after || []).filter(Boolean);
  if (resolved.length) bits.push(`resolved=${resolved.join(',')}`);

  const pending = sample.pending_customer_reply_after;
  if (typeof pending === 'boolean') bits.push(`waiting=${pending ? 'yes' : 'no'}`);

  const missing = (sample.missing_info_after || []).filter(Boolean);
  if (missing.length) bits.push(`missing=${missing.join(',')}`);

  return bits.join(' | ');
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

