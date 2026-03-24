import * as crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { processWebhookBody } from './pipeline.js';
import { verifyFacebookWebhookSignature } from './webhook.js';

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

console.log(JSON.stringify({ shadowOutputs, liveOutputs, markSeenOutputs, cooldownOutputs, restrictedOutputs, duplicateFirstPass, duplicateSecondPass, retryableSendOutputs, offHoursOutputs, complaintOutputs, complaintShippingOutputs, carrierOutputs, shortAmbiguousOutputs, multiIntentOutputs, disallowedPageOutputs, postbackOutputs, passiveEventOutputs, signatureChecks }, null, 2));

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
