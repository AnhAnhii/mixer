import fs from 'node:fs';
import path from 'node:path';
import { classifyMessage } from './classify.js';
import { buildGroundedInput } from './grounding.js';
import { buildFallbackDraft } from './fallback-draft.js';

const fanpageBotRoot = path.resolve(new URL('..', import.meta.url).pathname);
const knowledgeDir = path.resolve(fanpageBotRoot, 'knowledge');

const POLICY_CASE_FIXTURES = [
  {
    label: 'return_policy_general',
    expectedCaseType: 'return_policy_general',
    message: 'shop có hỗ trợ đổi trả không',
    expectedPolicyIds: ['return_policy_general'],
    expectedPolicyRefs: ['policy:return_policy_general'],
    expectedReplyIncludes: ['đổi/trả', '3 ngày'],
    expectedSafetyFlags: ['policy_topic_conservative']
  },
  {
    label: 'defective_product_policy_general',
    expectedCaseType: 'defective_product_policy_general',
    message: 'hàng lỗi có được đổi không',
    expectedPolicyIds: ['defective_product_support'],
    expectedPolicyRefs: ['policy:defective_product_support'],
    expectedReplyIncludes: ['sản phẩm lỗi', '3 ngày', 'ship 2 đầu'],
    expectedSafetyFlags: ['policy_topic_conservative']
  }
];

export function runPolicyReadbackChecks() {
  const policyBank = readJson(path.join(knowledgeDir, 'policy-bank.json'));
  const caseBank = readJson(path.join(knowledgeDir, 'case-bank.json'));

  return {
    knowledge_alignment: buildKnowledgeAlignmentSummary(policyBank, caseBank),
    runtime_readback: POLICY_CASE_FIXTURES.map((fixture) => runFixture(fixture))
  };
}

function runFixture(fixture) {
  const normalizedMessage = {
    source: 'facebook_messenger',
    page_id: '105265398928721',
    sender_psid: `policy-check-${fixture.label}`,
    thread_key: `facebook:105265398928721:policy-check-${fixture.label}`,
    message_id: `mid.policy-check.${fixture.label}`,
    timestamp: Date.UTC(2026, 2, 26, 3, 40, 0),
    text: fixture.message,
    attachments: []
  };

  const triage = classifyMessage(normalizedMessage);
  const groundedInput = buildGroundedInput(normalizedMessage, triage, []);
  const fallbackDraft = buildFallbackDraft({
    message: { text: fixture.message },
    latest_customer_message: fixture.message,
    triage,
    grounding_bundle: {
      customer_context: {
        thread_memory: null
      },
      grounding: groundedInput.grounding
    }
  });

  const selectedPolicyIds = (groundedInput.grounding?.selected?.policy_entries || []).map((entry) => entry.policy_id);
  const selectedPolicyRefs = fallbackDraft.policy_refs || [];
  const replyText = fallbackDraft.reply_text || '';
  const safetyFlags = fallbackDraft.safety_flags || [];

  return {
    label: fixture.label,
    message: fixture.message,
    triage_case_type: triage.case_type,
    triage_reason: triage.reason,
    selected_policy_ids: selectedPolicyIds,
    selected_policy_refs: selectedPolicyRefs,
    draft_action: fallbackDraft.action,
    draft_reason: fallbackDraft.reason,
    draft_reply_text: replyText,
    safety_flags: safetyFlags,
    checks: {
      classifier_matched_expected_case: triage.case_type === fixture.expectedCaseType,
      grounding_selected_expected_policies: fixture.expectedPolicyIds.every((policyId) => selectedPolicyIds.includes(policyId)),
      draft_references_expected_policies: fixture.expectedPolicyRefs.every((policyRef) => selectedPolicyRefs.includes(policyRef)),
      draft_is_conservative_policy_answer: fallbackDraft.reason === 'knowledge_bank_policy_answer' && fallbackDraft.action === 'draft_only',
      draft_mentions_expected_policy_facts: fixture.expectedReplyIncludes.every((snippet) => includesNormalized(replyText, snippet)),
      draft_keeps_conservative_flag: fixture.expectedSafetyFlags.every((flag) => safetyFlags.includes(flag))
    }
  };
}

function buildKnowledgeAlignmentSummary(policyBank, caseBank) {
  return {
    return_policy_general: summarizeKnowledgeAlignment({
      caseBank,
      policyBank,
      caseId: 'return_policy_general',
      expectedPolicyId: 'return_policy_general'
    }),
    defective_product_policy_general: summarizeKnowledgeAlignment({
      caseBank,
      policyBank,
      caseId: 'defective_product_policy_general',
      expectedPolicyId: 'defective_product_support'
    })
  };
}

function summarizeKnowledgeAlignment({ caseBank, policyBank, caseId, expectedPolicyId }) {
  const caseEntry = caseBank.cases?.find((entry) => entry.case_id === caseId) || null;
  const policyEntry = policyBank.policies?.find((entry) => entry.policy_id === expectedPolicyId) || null;

  return {
    case_exists: Boolean(caseEntry),
    policy_exists: Boolean(policyEntry),
    case_safe_grounding_refs: caseEntry?.reasoning_memory?.safe_grounding_refs || [],
    policy_allowed_case_types: policyEntry?.allowed_case_types || [],
    case_references_expected_policy: (caseEntry?.reasoning_memory?.safe_grounding_refs || []).includes(expectedPolicyId),
    policy_allows_expected_case: (policyEntry?.allowed_case_types || []).includes(caseId),
    policy_fact_ids: (policyEntry?.facts || []).map((fact) => fact.fact_id)
  };
}

function includesNormalized(text, snippet) {
  return normalizeVietnamese(text).includes(normalizeVietnamese(snippet));
}

function normalizeVietnamese(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
