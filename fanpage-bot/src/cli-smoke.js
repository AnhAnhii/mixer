import * as crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { processWebhookBody } from './pipeline.js';
import { verifyFacebookWebhookSignature } from './webhook.js';
import { normalizeDraftContract, generateDraft } from './ai-draft.js';
import { createThreadStateStore } from './thread-state.js';

const tmpDir = path.resolve(process.cwd(), 'data/tmp');
fs.mkdirSync(tmpDir, { recursive: true });
const dedupeStorePath = path.join(tmpDir, 'processed-message-ids.smoke.json');
const threadStatePath = path.join(tmpDir, 'thread-state.smoke.json');
resetDedupeStore();
resetThreadState();

const inHoursTimestamp = Date.UTC(2026, 2, 23, 3, 0, 0);

const sampleBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-1' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp,
          message: {
            mid: 'mid.local.1',
            text: 'shop ơi ship mấy ngày vậy'
          }
        },
        {
          sender: { id: 'test-psid-2' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp,
          message: {
            mid: 'mid.local.2',
            text: 'kiểm tra đơn giúp mình'
          }
        }
      ]
    }
  ]
};

const offHoursBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-3' },
          recipient: { id: '105265398928721' },
          timestamp: Date.UTC(2026, 2, 23, 18, 30, 0),
          message: {
            mid: 'mid.local.3',
            text: 'ship mấy ngày vậy shop'
          }
        }
      ]
    }
  ]
};

const complaintBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-4' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp,
          message: {
            mid: 'mid.local.5',
            text: 'shop xử lý quá tệ, mình rất thất vọng'
          }
        }
      ]
    }
  ]
};

const complaintShippingBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-10' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp,
          message: {
            mid: 'mid.local.10',
            text: 'ship lâu quá, mình bực mình rồi'
          }
        }
      ]
    }
  ]
};

const cooldownFollowupBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-1' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp + (5 * 60 * 1000),
          message: {
            mid: 'mid.local.4',
            text: 'vậy bên mình ship mấy ngày nữa shop'
          }
        }
      ]
    }
  ]
};

const carrierBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-5' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp,
          message: {
            mid: 'mid.local.6',
            text: 'shop ship đơn vị nào vậy'
          }
        }
      ]
    }
  ]
};

const pricingBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-14' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp,
          message: {
            mid: 'mid.local.11',
            text: 'áo này giá bao nhiêu, có sale không shop?'
          }
        }
      ]
    }
  ]
};

const pricingFollowupBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-14' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp + (60 * 1000),
          message: {
            mid: 'mid.local.12',
            text: 'shop check giúp mình nha'
          }
        }
      ]
    }
  ]
};

const pricingGenericFollowupAfterStateDriftBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-15' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp + (2 * 60 * 1000),
          message: {
            mid: 'mid.local.13',
            text: 'check giúp mình nha'
          }
        }
      ]
    }
  ]
};

const orderStatusGenericFollowupBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-16' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp + (3 * 60 * 1000),
          message: {
            mid: 'mid.local.14',
            text: 'dạ'
          }
        }
      ]
    }
  ]
};

const orderStatusPhoneFollowupBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-17' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp + (4 * 60 * 1000),
          message: {
            mid: 'mid.local.15',
            text: 'sđt 0912 345 678'
          }
        }
      ]
    }
  ]
};

const complaintOrderCodeFollowupBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-18' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp + (5 * 60 * 1000),
          message: {
            mid: 'mid.local.16',
            text: 'mã đơn DH654321'
          }
        }
      ]
    }
  ]
};

const shortAmbiguousBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-6' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp,
          message: {
            mid: 'mid.local.7',
            text: 'ship?'
          }
        }
      ]
    }
  ]
};

const multiIntentBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-7' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp,
          message: {
            mid: 'mid.local.8',
            text: 'shop ship mấy ngày và đơn vị nào vậy?'
          }
        }
      ]
    }
  ]
};

const disallowedPageBody = {
  object: 'page',
  entry: [
    {
      id: '999999999999999',
      messaging: [
        {
          sender: { id: 'test-psid-8' },
          recipient: { id: '999999999999999' },
          timestamp: inHoursTimestamp,
          message: {
            mid: 'mid.local.9',
            text: 'shop ơi ship mấy ngày vậy'
          }
        }
      ]
    }
  ]
};

const postbackBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-9' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp,
          postback: {
            title: 'Bắt đầu',
            payload: 'GET_STARTED'
          }
        }
      ]
    }
  ]
};

const passiveEventsBody = {
  object: 'page',
  entry: [
    {
      id: '105265398928721',
      messaging: [
        {
          sender: { id: 'test-psid-11' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp,
          delivery: {
            mids: ['mid.sent.1'],
            watermark: inHoursTimestamp
          }
        },
        {
          sender: { id: 'test-psid-12' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp,
          read: {
            watermark: inHoursTimestamp + 1000
          }
        },
        {
          sender: { id: 'test-psid-13' },
          recipient: { id: '105265398928721' },
          timestamp: inHoursTimestamp,
          message: {
            mid: 'mid.echo.1',
            is_echo: true,
            text: 'echo from page'
          }
        }
      ]
    }
  ]
};

const shadowOutputs = await processWebhookBody(sampleBody, {
  autoReplyEnabled: false,
  shadowMode: true,
  dedupeStorePath
});

resetDedupeStore();
const liveOutputs = await processWebhookBody(sampleBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  threadStatePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async (url, init) => ({
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({
        recipient_id: JSON.parse(init.body).recipient.id,
        message_id: 'mid.mock.sent.1',
        url
      });
    }
  })
});

const cooldownOutputs = await processWebhookBody(cooldownFollowupBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  threadStatePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called while cooldown is active');
  }
});

resetDedupeStore();
resetThreadState();
const markSeenOutputs = await processWebhookBody(carrierBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  threadStatePath,
  allowedCases: ['shipping_carrier'],
  markSeenBeforeReply: true,
  pageAccessToken: 'test-page-token',
  fetchImpl: createMarkSeenFetchMock()
});

resetDedupeStore();
resetThreadState();
const restrictedOutputs = await processWebhookBody(sampleBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  allowedCases: ['shipping_carrier'],
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called when case is outside allowlist');
  }
});

resetDedupeStore();
const duplicateFirstPass = await processWebhookBody(sampleBody, {
  autoReplyEnabled: false,
  shadowMode: true,
  dedupeStorePath
});

const duplicateSecondPass = await processWebhookBody(sampleBody, {
  autoReplyEnabled: false,
  shadowMode: true,
  dedupeStorePath
});

resetDedupeStore();
resetThreadState();
const retryableSendOutputs = await processWebhookBody(carrierBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  threadStatePath,
  allowedCases: ['shipping_carrier'],
  pageAccessToken: 'test-page-token',
  fetchImpl: createRetryableFetchMock()
});

resetDedupeStore();
const offHoursOutputs = await processWebhookBody(offHoursBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called outside support hours');
  }
});

resetDedupeStore();
const complaintOutputs = await processWebhookBody(complaintBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called for complaint handoff');
  }
});

resetDedupeStore();
const complaintShippingOutputs = await processWebhookBody(complaintShippingBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called for complaint-like shipping message');
  }
});

resetDedupeStore();
resetThreadState();
const carrierOutputs = await processWebhookBody(carrierBody, {
  autoReplyEnabled: false,
  shadowMode: true,
  dedupeStorePath,
  threadStatePath
});

resetDedupeStore();
resetThreadState();
const pricingOutputs = await processWebhookBody(pricingBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  threadStatePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called for ungrounded pricing/promo request');
  }
});

const pricingFollowupOutputs = await processWebhookBody(pricingFollowupBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  threadStatePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called for repeated ungrounded pricing/promo request');
  }
});

resetDedupeStore();
resetThreadState();
const pricingDriftStore = createThreadStateStore({ threadStatePath });
pricingDriftStore.updateMemory('facebook:105265398928721:test-psid-15', {
  normalizedMessage: {
    thread_key: 'facebook:105265398928721:test-psid-15',
    message_id: 'mid.seed.pricing.1',
    text: 'áo này giá bao nhiêu vậy shop',
    timestamp: inHoursTimestamp
  },
  triage: {
    case_type: 'pricing_or_promotion',
    missing_info: ['product_name'],
    reason: 'matched_pricing_or_promotion_rule',
    needs_human: false
  },
  guarded: {
    guarded_draft: {
      action: 'draft_only',
      needs_human: false,
      missing_info: ['product_name'],
      reason: 'pricing_or_promotion_needs_grounded_product_data',
      reply_text: 'Dạ để em báo đúng giá/ưu đãi hiện có, anh/chị gửi giúp em tên mẫu hoặc ảnh/link sản phẩm mình đang xem nha. Nếu có size/màu mình quan tâm thì nhắn kèm giúp em luôn ạ.'
    },
    delivery: { decision: 'draft_only' }
  }
});
pricingDriftStore.updateMemory('facebook:105265398928721:test-psid-15', {
  normalizedMessage: {
    thread_key: 'facebook:105265398928721:test-psid-15',
    message_id: 'mid.seed.pricing.2',
    text: 'ok shop',
    timestamp: inHoursTimestamp + 1000
  },
  triage: {
    case_type: 'unknown',
    missing_info: [],
    reason: 'customer_acknowledged',
    needs_human: false
  },
  guarded: {
    guarded_draft: {
      action: 'draft_only',
      needs_human: false,
      missing_info: [],
      reason: 'acknowledged'
    },
    delivery: { decision: 'draft_only' }
  }
});
const pricingGenericFollowupAfterStateDriftOutputs = await processWebhookBody(pricingGenericFollowupAfterStateDriftBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  threadStatePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called for vague pricing follow-up after state drift');
  }
});

resetDedupeStore();
resetThreadState();
const orderStatusContinuityStore = createThreadStateStore({ threadStatePath });
orderStatusContinuityStore.updateMemory('facebook:105265398928721:test-psid-16', {
  normalizedMessage: {
    thread_key: 'facebook:105265398928721:test-psid-16',
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
const orderStatusGenericFollowupOutputs = await processWebhookBody(orderStatusGenericFollowupBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  threadStatePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called for generic order-status follow-up');
  }
});

resetDedupeStore();
resetThreadState();
const orderStatusPhoneStore = createThreadStateStore({ threadStatePath });
orderStatusPhoneStore.updateMemory('facebook:105265398928721:test-psid-17', {
  normalizedMessage: {
    thread_key: 'facebook:105265398928721:test-psid-17',
    message_id: 'mid.seed.order.2',
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
const orderStatusPhoneFollowupOutputs = await processWebhookBody(orderStatusPhoneFollowupBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  threadStatePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called for order-status phone follow-up');
  }
});

resetDedupeStore();
resetThreadState();
const complaintFollowupStore = createThreadStateStore({ threadStatePath });
complaintFollowupStore.updateMemory('facebook:105265398928721:test-psid-18', {
  normalizedMessage: {
    thread_key: 'facebook:105265398928721:test-psid-18',
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
const complaintOrderCodeFollowupOutputs = await processWebhookBody(complaintOrderCodeFollowupBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  threadStatePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called for complaint order-code follow-up');
  }
});

resetDedupeStore();
const shortAmbiguousOutputs = await processWebhookBody(shortAmbiguousBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called for ambiguous short message');
  }
});

resetDedupeStore();
const multiIntentOutputs = await processWebhookBody(multiIntentBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called for multi-intent message');
  }
});

resetDedupeStore();
const disallowedPageOutputs = await processWebhookBody(disallowedPageBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  allowedPageIds: ['105265398928721'],
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called for disallowed page');
  }
});

resetDedupeStore();
const postbackOutputs = await processWebhookBody(postbackBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called for postback events');
  }
});

resetDedupeStore();
const passiveEventOutputs = await processWebhookBody(passiveEventsBody, {
  autoReplyEnabled: true,
  shadowMode: false,
  dedupeStorePath,
  pageAccessToken: 'test-page-token',
  fetchImpl: async () => {
    throw new Error('fetch should not be called for passive Messenger events');
  }
});

const signatureChecks = runSignatureChecks();
const reasoningBundleChecks = runReasoningBundleChecks(pricingOutputs);
const draftContractChecks = await runDraftContractChecks({ shadowOutputs, liveOutputs, complaintOutputs, pricingOutputs });
const threadMemoryChecks = runThreadMemoryChecks();
const pricingFollowupChecks = runPricingFollowupChecks({ pricingOutputs, pricingFollowupOutputs, pricingGenericFollowupAfterStateDriftOutputs });
const orderStatusContinuityChecks = runOrderStatusContinuityChecks({ orderStatusGenericFollowupOutputs, orderStatusPhoneFollowupOutputs });
const complaintFollowupChecks = runComplaintFollowupChecks({ complaintOrderCodeFollowupOutputs });

console.log(JSON.stringify({ shadowOutputs, liveOutputs, markSeenOutputs, cooldownOutputs, restrictedOutputs, duplicateFirstPass, duplicateSecondPass, retryableSendOutputs, offHoursOutputs, complaintOutputs, complaintShippingOutputs, carrierOutputs, pricingOutputs, pricingFollowupOutputs, pricingGenericFollowupAfterStateDriftOutputs, orderStatusGenericFollowupOutputs, orderStatusPhoneFollowupOutputs, complaintOrderCodeFollowupOutputs, shortAmbiguousOutputs, multiIntentOutputs, disallowedPageOutputs, postbackOutputs, passiveEventOutputs, signatureChecks, reasoningBundleChecks, draftContractChecks, threadMemoryChecks, pricingFollowupChecks, orderStatusContinuityChecks, complaintFollowupChecks }, null, 2));

function resetDedupeStore() {
  if (fs.existsSync(dedupeStorePath)) {
    fs.unlinkSync(dedupeStorePath);
  }
}

function resetThreadState() {
  if (fs.existsSync(threadStatePath)) {
    fs.unlinkSync(threadStatePath);
  }
}

function createRetryableFetchMock() {
  let callCount = 0;

  return async (url, init) => {
    callCount += 1;

    if (callCount === 1) {
      return {
        ok: false,
        status: 500,
        async text() {
          return JSON.stringify({ error: { message: 'temporary upstream error' }, url });
        }
      };
    }

    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          recipient_id: JSON.parse(init.body).recipient.id,
          message_id: 'mid.mock.sent.retry.1',
          url,
          attempts_seen_by_mock: callCount
        });
      }
    };
  };
}

function createMarkSeenFetchMock() {
  const calls = [];

  return async (url, init) => {
    const payload = JSON.parse(init.body);
    calls.push(payload);

    return {
      ok: true,
      status: 200,
      async text() {
        if (payload.sender_action === 'mark_seen') {
          return JSON.stringify({
            recipient_id: payload.recipient.id,
            message_id: null,
            sender_action: 'mark_seen',
            url,
            calls_seen_by_mock: calls.length
          });
        }

        return JSON.stringify({
          recipient_id: payload.recipient.id,
          message_id: 'mid.mock.sent.markseen.1',
          url,
          calls_seen_by_mock: calls.length,
          sender_action_first: calls[0]?.sender_action || null
        });
      }
    };
  };
}

async function runDraftContractChecks({ shadowOutputs, liveOutputs, complaintOutputs, pricingOutputs }) {
  const samples = [
    shadowOutputs?.[0]?.ai_draft,
    liveOutputs?.[0]?.ai_draft,
    complaintOutputs?.[0]?.ai_draft,
    pricingOutputs?.[0]?.ai_draft
  ].filter(Boolean);

  const malformedNormalized = normalizeDraftContract({
    understanding: { intent: 'totally_new_case', missing_info: 'order_code' },
    decision: { action: 'SEND_NOW', reason: '' },
    reply: { reply_text: '' },
    ops_meta: { needs_human: 'false', confidence: '82%', policy_refs: 'policy:shipping_eta_general', safety_flags: ['negative_sentiment'] }
  }, {
    triage_hint: { case_type: 'shipping_eta_general', missing_info: [] }
  });

  const generatedMalformed = await generateDraft({
    message: { text: 'shop ship mấy ngày vậy' },
    triage_hint: { case_type: 'shipping_eta_general', needs_human: false, missing_info: [], reason: 'matched_shipping_eta_rule' },
    grounding_bundle: { grounding: {} }
  }, {
    mockOpenAIResponse: {
      output_text: JSON.stringify({
        understanding: { intent: 'new_case_from_model', sentiment: 'neutral', missing_info: 'tracking_code' },
        decision: { action: 'AUTO_SEND', strategy: 'freeform' },
        reply: { reply_text: '' },
        ops_meta: { needs_human: false, confidence: '150%', policy_refs: ['policy:shipping_eta_general'], safety_flags: ['negative_sentiment'] }
      })
    }
  });

  return {
    samples_checked: samples.length,
    all_have_reasoning_first_shape: samples.every(hasReasoningFirstShape),
    all_keep_legacy_fields: samples.every(hasLegacyCompatibilityShape),
    sample_actions: samples.map((draft) => draft.decision?.action || draft.action || null),
    sample_intents: samples.map((draft) => draft.understanding?.intent || null),
    malformed_normalized: {
      action: malformedNormalized.action,
      intent: malformedNormalized.understanding?.intent,
      missing_info: malformedNormalized.missing_info,
      confidence: malformedNormalized.confidence,
      issues: malformedNormalized.contract_meta?.issues || []
    },
    malformed_generate_draft: {
      action: generatedMalformed.draft?.action,
      reply_text_present: Boolean(generatedMalformed.draft?.reply_text),
      confidence: generatedMalformed.draft?.confidence,
      needs_human: generatedMalformed.draft?.needs_human,
      validation_issues: generatedMalformed.meta?.validation?.issues || []
    },
    sales_assist_meta_present: samples.every((draft) => draft?.sales_assist_meta && Array.isArray(draft.sales_assist_meta.signals))
  };
}

function hasReasoningFirstShape(draft) {
  return Boolean(
    draft
    && draft.understanding
    && typeof draft.understanding.intent === 'string'
    && Array.isArray(draft.understanding.missing_info)
    && draft.decision
    && typeof draft.decision.action === 'string'
    && typeof draft.decision.reason === 'string'
    && draft.reply
    && typeof draft.reply.reply_text === 'string'
    && draft.ops_meta
    && typeof draft.ops_meta.needs_human === 'boolean'
    && typeof draft.ops_meta.confidence === 'number'
    && Array.isArray(draft.ops_meta.policy_refs)
    && Array.isArray(draft.ops_meta.safety_flags)
  );
}

function hasLegacyCompatibilityShape(draft) {
  return Boolean(
    draft
    && typeof draft.reply_text === 'string'
    && typeof draft.action === 'string'
    && typeof draft.needs_human === 'boolean'
    && typeof draft.confidence === 'number'
    && Array.isArray(draft.missing_info)
    && Array.isArray(draft.policy_refs)
    && Array.isArray(draft.safety_flags)
  );
}

function runOrderStatusContinuityChecks({ orderStatusGenericFollowupOutputs, orderStatusPhoneFollowupOutputs }) {
  const genericReply = orderStatusGenericFollowupOutputs?.[0]?.guarded_draft?.reply_text
    || orderStatusGenericFollowupOutputs?.[0]?.ai_draft?.reply_text
    || '';
  const genericTriage = orderStatusGenericFollowupOutputs?.[0]?.triage?.case_type || null;
  const genericFlags = orderStatusGenericFollowupOutputs?.[0]?.guarded_draft?.safety_flags || [];
  const phoneReply = orderStatusPhoneFollowupOutputs?.[0]?.guarded_draft?.reply_text
    || orderStatusPhoneFollowupOutputs?.[0]?.ai_draft?.reply_text
    || '';
  const phoneMissing = orderStatusPhoneFollowupOutputs?.[0]?.guarded_draft?.missing_info || [];
  const phoneMemory = orderStatusPhoneFollowupOutputs?.[0]?.thread_memory_after || {};

  return {
    generic_followup_triage: genericTriage,
    generic_followup_reply: genericReply,
    generic_followup_stays_order_status: genericTriage === 'order_status_request',
    generic_followup_avoids_generic_unknown_fallback: !/chia sẻ thêm giúp em nội dung cần hỗ trợ/i.test(genericReply),
    generic_followup_requests_lookup_identifier: /mã đơn|số điện thoại nhận hàng/i.test(genericReply),
    generic_followup_continuity_flagged: genericFlags.includes('order_status_followup_continuity'),
    phone_followup_reply: phoneReply,
    phone_followup_acknowledges_identifier: /đã nhận.*số điện thoại/i.test(phoneReply),
    phone_followup_missing_info_cleared: Array.isArray(phoneMissing) && phoneMissing.length === 0,
    phone_followup_thread_waiting_cleared: phoneMemory.pending_customer_reply === false,
    phone_followup_thread_resolved_slots: (phoneMemory.asked_slots || []).filter((item) => item.status === 'resolved').map((item) => item.slot)
  };
}

function runComplaintFollowupChecks({ complaintOrderCodeFollowupOutputs }) {
  const reply = complaintOrderCodeFollowupOutputs?.[0]?.guarded_draft?.reply_text
    || complaintOrderCodeFollowupOutputs?.[0]?.ai_draft?.reply_text
    || '';
  const triage = complaintOrderCodeFollowupOutputs?.[0]?.triage?.case_type || null;
  const flags = complaintOrderCodeFollowupOutputs?.[0]?.guarded_draft?.safety_flags || [];
  const memory = complaintOrderCodeFollowupOutputs?.[0]?.thread_memory_after || {};

  return {
    followup_triage: triage,
    followup_stays_complaint: triage === 'complaint_or_negative_feedback',
    followup_reply: reply,
    followup_acknowledges_identifier: /đã nhận.*thông tin đơn/i.test(reply),
    followup_keeps_apology_tone: /xin lỗi/i.test(reply),
    followup_avoids_reasking_identifier: !/mã đơn để bên em kiểm tra/i.test(reply),
    followup_continuity_flagged: flags.includes('complaint_followup_continuity'),
    followup_missing_info_cleared: Array.isArray(complaintOrderCodeFollowupOutputs?.[0]?.guarded_draft?.missing_info)
      && complaintOrderCodeFollowupOutputs[0].guarded_draft.missing_info.length === 0,
    followup_thread_waiting_cleared: memory.pending_customer_reply === false,
    followup_thread_resolved_slots: (memory.asked_slots || []).filter((item) => item.status === 'resolved').map((item) => item.slot)
  };
}

function runPricingFollowupChecks({ pricingOutputs, pricingFollowupOutputs, pricingGenericFollowupAfterStateDriftOutputs }) {
  const firstReply = pricingOutputs?.[0]?.guarded_draft?.reply_text || pricingOutputs?.[0]?.ai_draft?.reply_text || '';
  const secondReply = pricingFollowupOutputs?.[0]?.guarded_draft?.reply_text || pricingFollowupOutputs?.[0]?.ai_draft?.reply_text || '';
  const secondFlags = pricingFollowupOutputs?.[0]?.guarded_draft?.safety_flags || [];
  const askedSlots = pricingFollowupOutputs?.[0]?.thread_memory_after?.asked_slots || [];
  const driftReply = pricingGenericFollowupAfterStateDriftOutputs?.[0]?.guarded_draft?.reply_text
    || pricingGenericFollowupAfterStateDriftOutputs?.[0]?.ai_draft?.reply_text
    || '';
  const driftTriage = pricingGenericFollowupAfterStateDriftOutputs?.[0]?.triage?.case_type || null;

  return {
    first_reply: firstReply,
    second_reply: secondReply,
    second_flags: secondFlags,
    pending_slots_after_followup: askedSlots.filter((item) => item.status !== 'resolved').map((item) => item.slot),
    refined_product_request_detected: /ảnh|link|sản phẩm|tên mẫu|mẫu cụ thể/i.test(secondReply),
    optional_variant_request_detected: /size\/màu/i.test(secondReply),
    repeat_info_request_refined_flagged: secondFlags.includes('repeat_info_request_refined'),
    state_drift_followup_triage: driftTriage,
    state_drift_followup_reply: driftReply,
    state_drift_followup_stays_specific: /ảnh|link|sản phẩm|tên mẫu|mẫu cụ thể/i.test(driftReply) && /size\/màu/i.test(driftReply),
    state_drift_followup_avoids_generic_fallback: !/chia sẻ thêm giúp em nội dung cần hỗ trợ/i.test(driftReply)
  };
}

function runThreadMemoryChecks() {
  const store = createThreadStateStore({
    threadStatePath: path.join(tmpDir, 'thread-state.logic.smoke.json')
  });
  const threadKey = 'facebook:test-page:test-user';

  store.updateMemory(threadKey, {
    normalizedMessage: {
      thread_key: threadKey,
      message_id: 'mid.thread.1',
      text: 'shop kiểm tra đơn giúp mình',
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
        reason: 'need_order_identifiers'
      },
      delivery: { decision: 'handoff' }
    }
  });

  const afterAsk = store.getMemory(threadKey);

  store.updateMemory(threadKey, {
    normalizedMessage: {
      thread_key: threadKey,
      message_id: 'mid.thread.2',
      text: 'mã đơn của mình là DH123456, sđt 0912 345 678',
      timestamp: inHoursTimestamp + 1000
    },
    triage: {
      case_type: 'unknown',
      missing_info: [],
      reason: 'customer_provided_requested_info',
      needs_human: true
    },
    guarded: {
      guarded_draft: {
        action: 'handoff',
        needs_human: true,
        missing_info: [],
        reason: 'ready_for_manual_lookup'
      },
      delivery: { decision: 'handoff' }
    }
  });

  const afterReply = store.getMemory(threadKey);

  const phoneOnlyThreadKey = 'facebook:test-page:test-phone-only-user';
  store.updateMemory(phoneOnlyThreadKey, {
    normalizedMessage: {
      thread_key: phoneOnlyThreadKey,
      message_id: 'mid.phone.1',
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
        reason: 'need_order_identifiers'
      },
      delivery: { decision: 'handoff' }
    }
  });

  store.updateMemory(phoneOnlyThreadKey, {
    normalizedMessage: {
      thread_key: phoneOnlyThreadKey,
      message_id: 'mid.phone.2',
      text: 'sđt 0912 345 678',
      timestamp: inHoursTimestamp + 1000
    },
    triage: {
      case_type: 'unknown',
      missing_info: [],
      reason: 'customer_provided_phone_only',
      needs_human: true
    },
    guarded: {
      guarded_draft: {
        action: 'handoff',
        needs_human: true,
        missing_info: [],
        reason: 'ready_for_manual_lookup'
      },
      delivery: { decision: 'handoff' }
    }
  });

  const afterPhoneOnlyReply = store.getMemory(phoneOnlyThreadKey);

  const salesThreadKey = 'facebook:test-page:test-sales-user';
  store.updateMemory(salesThreadKey, {
    normalizedMessage: {
      thread_key: salesThreadKey,
      message_id: 'mid.sales.1',
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
        reason: 'need_variant_details'
      },
      delivery: { decision: 'handoff' }
    }
  });

  store.updateMemory(salesThreadKey, {
    normalizedMessage: {
      thread_key: salesThreadKey,
      message_id: 'mid.sales.2',
      text: 'áo polo basic màu đen size m nha',
      timestamp: inHoursTimestamp + 1000
    },
    triage: {
      case_type: 'unknown',
      missing_info: [],
      reason: 'customer_provided_variant_details',
      needs_human: true
    },
    guarded: {
      guarded_draft: {
        action: 'handoff',
        needs_human: true,
        missing_info: [],
        reason: 'ready_for_inventory_check'
      },
      delivery: { decision: 'handoff' }
    }
  });

  const afterSalesReply = store.getMemory(salesThreadKey);

  const staleThreadKey = 'facebook:test-page:test-stale-user';
  store.updateMemory(staleThreadKey, {
    normalizedMessage: {
      thread_key: staleThreadKey,
      message_id: 'mid.stale.1',
      text: 'kiểm tra đơn giúp mình',
      timestamp: inHoursTimestamp
    },
    triage: {
      case_type: 'order_status_request',
      missing_info: ['order_code'],
      reason: 'matched_order_status_rule',
      needs_human: true
    },
    guarded: {
      guarded_draft: {
        action: 'handoff',
        needs_human: true,
        missing_info: ['order_code'],
        reason: 'need_order_code'
      },
      delivery: { decision: 'handoff' }
    }
  });

  store.updateMemory(staleThreadKey, {
    normalizedMessage: {
      thread_key: staleThreadKey,
      message_id: 'mid.stale.2',
      text: 'shop mấy giờ mở cửa vậy',
      timestamp: inHoursTimestamp + 1000
    },
    triage: {
      case_type: 'support_hours',
      missing_info: [],
      reason: 'matched_support_hours_rule',
      needs_human: false
    },
    guarded: {
      guarded_draft: {
        action: 'draft_only',
        needs_human: false,
        missing_info: [],
        reason: 'knowledge_bank_faq_answer'
      },
      delivery: { decision: 'draft_only' }
    }
  });

  const afterCaseShift = store.getMemory(staleThreadKey);

  return {
    after_ask: {
      pending_customer_reply: afterAsk.pending_customer_reply,
      asked_slots: afterAsk.asked_slots,
      customer_facts: afterAsk.customer_facts
    },
    after_reply: {
      pending_customer_reply: afterReply.pending_customer_reply,
      asked_slots: afterReply.asked_slots,
      resolved_slots: afterReply.asked_slots.filter((item) => item.status === 'resolved').map((item) => item.slot),
      customer_facts: afterReply.customer_facts,
      fact_types: afterReply.customer_facts.map((item) => item.fact_type)
    },
    phone_only_reply: {
      pending_customer_reply: afterPhoneOnlyReply.pending_customer_reply,
      asked_slots: afterPhoneOnlyReply.asked_slots,
      resolved_slots: afterPhoneOnlyReply.asked_slots.filter((item) => item.status === 'resolved').map((item) => item.slot),
      customer_facts: afterPhoneOnlyReply.customer_facts,
      fact_types: afterPhoneOnlyReply.customer_facts.map((item) => item.fact_type)
    },
    sales_follow_up: {
      pending_customer_reply: afterSalesReply.pending_customer_reply,
      asked_slots: afterSalesReply.asked_slots,
      resolved_slots: afterSalesReply.asked_slots.filter((item) => item.status === 'resolved').map((item) => item.slot),
      resolved_values: Object.fromEntries(afterSalesReply.asked_slots.filter((item) => item.status === 'resolved').map((item) => [item.slot, item.resolved_value_preview])),
      fact_types: afterSalesReply.customer_facts.map((item) => item.fact_type)
    },
    case_shift_cleanup: {
      pending_customer_reply: afterCaseShift.pending_customer_reply,
      asked_slots: afterCaseShift.asked_slots,
      active_issue: afterCaseShift.active_issue
    }
  };
}

function runSignatureChecks() {
  const rawBody = JSON.stringify(sampleBody);
  const appSecret = 'test-app-secret';
  const validSignature = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;

  return {
    skippedWithoutSecret: verifyFacebookWebhookSignature({
      headers: {},
      body: rawBody
    }),
    valid: verifyFacebookWebhookSignature(
      {
        headers: { 'x-hub-signature-256': validSignature },
        body: rawBody
      },
      { appSecret }
    ),
    invalid: verifyFacebookWebhookSignature(
      {
        headers: { 'x-hub-signature-256': 'sha256=deadbeef' },
        body: rawBody
      },
      { appSecret }
    ),
    missingRawBody: verifyFacebookWebhookSignature(
      {
        headers: { 'x-hub-signature-256': validSignature },
        body: sampleBody
      },
      { appSecret }
    )
  };
}

function runReasoningBundleChecks(pricingOutputs = []) {
  const knowledgeDir = path.resolve(process.cwd(), 'knowledge');
  const schema = readJson(path.join(knowledgeDir, 'reply-brain-schema-v1.json'));
  const policyBank = readJson(path.join(knowledgeDir, 'policy-bank.json'));
  const caseBank = readJson(path.join(knowledgeDir, 'case-bank.json'));
  const toneGuide = readJson(path.join(knowledgeDir, 'tone-guide.json'));
  const responsePatternBank = readJson(path.join(knowledgeDir, 'response-pattern-bank.json'));

  return {
    files_present: {
      schema: fs.existsSync(path.join(knowledgeDir, 'reply-brain-schema-v1.json')),
      policy_bank: fs.existsSync(path.join(knowledgeDir, 'policy-bank.json')),
      case_bank: fs.existsSync(path.join(knowledgeDir, 'case-bank.json')),
      tone_guide: fs.existsSync(path.join(knowledgeDir, 'tone-guide.json')),
      response_pattern_bank: fs.existsSync(path.join(knowledgeDir, 'response-pattern-bank.json'))
    },
    schema_contract: {
      version: schema.version,
      policy_store: schema.memory_system?.policy_memory?.primary_store || null,
      case_store: schema.memory_system?.case_memory?.primary_store || null,
      language_store: schema.memory_system?.language_memory?.primary_store || null
    },
    bundle_versions: {
      policy_bank: policyBank.version,
      case_bank: caseBank.version,
      tone_guide: toneGuide.version,
      response_pattern_bank: responsePatternBank.version
    },
    workflow_guardrails: {
      shipping_eta_case: summarizeCase(caseBank, 'shipping_eta_general'),
      order_status_case: summarizeCase(caseBank, 'order_status_request'),
      complaint_case: summarizeCase(caseBank, 'complaint_or_negative_feedback'),
      pricing_case: summarizeCase(caseBank, 'pricing_or_promotion'),
      shipping_eta_policy: summarizePolicy(policyBank, 'shipping_eta_general'),
      tone_reasoning_first_rule: toneGuide.voice_principles?.reasoning_first_rule || null,
      pattern_forbidden_uses_count: responsePatternBank.usage_contract?.forbidden_uses?.length || 0
    },
    sales_runtime_hook: {
      pricing_case_seen: pricingOutputs?.[0]?.triage?.case_type === 'pricing_or_promotion',
      pricing_decision: pricingOutputs?.[0]?.delivery?.decision || null,
      buyer_intent_hint: pricingOutputs?.[0]?.grounding_bundle?.grounding?.sales_assist?.buyer_intent_hint || null,
      lead_strength_hint: pricingOutputs?.[0]?.grounding_bundle?.grounding?.sales_assist?.lead_strength_hint || null,
      product_grounding_status: pricingOutputs?.[0]?.grounding_bundle?.grounding?.sales_assist?.product_grounding_status || null,
      pricing_guardrails_count: pricingOutputs?.[0]?.grounding_bundle?.grounding?.sales_assist?.guardrails?.length || 0
    }
  };
}

function summarizeCase(caseBank, caseId) {
  const entry = caseBank.cases?.find((item) => item.case_id === caseId);
  if (!entry) {
    return null;
  }

  return {
    case_id: entry.case_id,
    decision_default: entry.decision_default,
    auto_reply_allowed: entry.auto_reply_allowed,
    risk_level: entry.risk_level
  };
}

function summarizePolicy(policyBank, policyId) {
  const entry = policyBank.policies?.find((item) => item.policy_id === policyId);
  if (!entry) {
    return null;
  }

  return {
    policy_id: entry.policy_id,
    allowed_case_types: entry.allowed_case_types || [],
    fact_count: entry.facts?.length || 0,
    has_conflict_notes: Boolean(entry.conflict_notes?.length)
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
