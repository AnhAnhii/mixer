import fs from 'node:fs';
import path from 'node:path';

const fanpageBotRoot = path.resolve(new URL('..', import.meta.url).pathname);
const legacyGroundingPath = path.resolve(fanpageBotRoot, '../scripts/mixer-grounded-ai-data-v1.json');
const knowledgeDir = path.resolve(fanpageBotRoot, 'knowledge');

const knowledgePaths = {
  policy_bank: path.resolve(knowledgeDir, 'policy-bank.json'),
  case_bank: path.resolve(knowledgeDir, 'case-bank.json'),
  tone_guide: path.resolve(knowledgeDir, 'tone-guide.json'),
  response_pattern_bank: path.resolve(knowledgeDir, 'response-pattern-bank.json')
};

let groundingCache = null;
let knowledgeBankCache = null;

export function loadGroundingData() {
  if (!groundingCache) {
    groundingCache = JSON.parse(fs.readFileSync(legacyGroundingPath, 'utf8'));
  }
  return groundingCache;
}

export function loadKnowledgeBanks() {
  if (!knowledgeBankCache) {
    knowledgeBankCache = {
      policy_bank: readJson(knowledgePaths.policy_bank),
      case_bank: readJson(knowledgePaths.case_bank),
      tone_guide: readJson(knowledgePaths.tone_guide),
      response_pattern_bank: readJson(knowledgePaths.response_pattern_bank)
    };
  }

  return knowledgeBankCache;
}

export function buildGroundedInput(normalizedMessage, triage, recentMessages = [], options = {}) {
  const knowledgeBanks = loadKnowledgeBanks();
  const caseType = triage.case_type;
  const selectedKnowledge = selectKnowledgeForCase(caseType, knowledgeBanks);
  const threadMemory = options.threadMemory || null;
  const salesAssist = buildSalesAssistSignals(normalizedMessage, triage, threadMemory);

  return {
    channel: normalizedMessage.source,
    page_id: normalizedMessage.page_id,
    psid: normalizedMessage.sender_psid,
    message_id: normalizedMessage.message_id,
    timestamp: normalizedMessage.timestamp,
    latest_customer_message: normalizedMessage.text,
    recent_messages: recentMessages,
    thread_memory: threadMemory,
    triage: {
      case_type_hint: caseType,
      risk_level_hint: triage.risk_level,
      missing_info_hint: triage.missing_info,
      should_handoff_hint: triage.needs_human,
      classifier_reason: triage.reason,
      suggested_tags: triage.suggested_tags || []
    },
    grounding: {
      source_versions: {
        legacy_grounding_version: loadGroundingData()?.version || null,
        policy_bank_version: knowledgeBanks.policy_bank?.version || null,
        case_bank_version: knowledgeBanks.case_bank?.version || null,
        tone_guide_version: knowledgeBanks.tone_guide?.version || null,
        response_pattern_bank_version: knowledgeBanks.response_pattern_bank?.version || null
      },
      selected: selectedKnowledge,
      legacy_reference: loadGroundingData(),
      reasoning_notes: buildReasoningNotes(caseType, selectedKnowledge),
      sales_assist: salesAssist
    }
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function selectKnowledgeForCase(caseType, knowledgeBanks) {
  const caseEntry = knowledgeBanks.case_bank?.cases?.find((entry) => entry.case_id === caseType) || null;
  const referencedPolicyIds = new Set(caseEntry?.reasoning_memory?.safe_grounding_refs || []);

  const policyEntries = (knowledgeBanks.policy_bank?.policies || []).filter((policy) => {
    return policy.allowed_case_types?.includes(caseType) || referencedPolicyIds.has(policy.policy_id);
  });

  const caseSupportEntry = knowledgeBanks.response_pattern_bank?.case_support?.find((entry) => entry.case_type === caseType) || null;
  const recommendedPatternBlocks = resolveRecommendedPatternBlocks(caseSupportEntry, knowledgeBanks.response_pattern_bank?.blocks || {});

  return {
    case_entry: caseEntry,
    policy_entries: policyEntries,
    tone: {
      tone_profile_id: knowledgeBanks.tone_guide?.tone_profile_id || null,
      core_style: knowledgeBanks.tone_guide?.core_style || [],
      voice_principles: knowledgeBanks.tone_guide?.voice_principles || {},
      register: knowledgeBanks.tone_guide?.register || {},
      style_rules: knowledgeBanks.tone_guide?.style_rules || {},
      emoji_policy: knowledgeBanks.tone_guide?.emoji_policy || {},
      sentence_shape: knowledgeBanks.tone_guide?.sentence_shape || {},
      scenario_adjustment: (knowledgeBanks.tone_guide?.scenario_tone_adjustments || []).find((entry) => entry.scenario === caseType) || null,
      microcopy_preferences: knowledgeBanks.tone_guide?.microcopy_preferences || {},
      response_quality_checks: knowledgeBanks.tone_guide?.response_quality_checks || []
    },
    response_patterns: {
      case_support: caseSupportEntry,
      recommended_blocks: recommendedPatternBlocks,
      anti_patterns: knowledgeBanks.response_pattern_bank?.anti_patterns || [],
      usage_contract: knowledgeBanks.response_pattern_bank?.usage_contract || {},
      quality_bar: knowledgeBanks.response_pattern_bank?.quality_bar || []
    },
    global_constraints: knowledgeBanks.policy_bank?.global_constraints || {},
    known_ambiguities: (knowledgeBanks.policy_bank?.known_ambiguities || []).filter((entry) => entry.topic === caseType),
    cross_case_reasoning_rules: knowledgeBanks.case_bank?.cross_case_reasoning_rules || []
  };
}

function resolveRecommendedPatternBlocks(caseSupportEntry, blocks) {
  const blockPaths = caseSupportEntry?.recommended_blocks || [];
  return blockPaths
    .map((blockPath) => ({
      block_path: blockPath,
      value: getNestedValue(blocks, blockPath)
    }))
    .filter((entry) => entry.value != null);
}

function getNestedValue(source, dottedPath) {
  return dottedPath
    .split('.')
    .reduce((current, key) => (current && Object.prototype.hasOwnProperty.call(current, key) ? current[key] : null), source);
}

function buildReasoningNotes(caseType, selectedKnowledge) {
  return {
    current_case_type: caseType,
    priority: [
      'Follow policy and hard safety constraints first',
      'Use case memory to decide whether to answer, ask focused follow-up, or handoff',
      'Use tone guide and pattern bank only to phrase the response naturally after the decision is clear'
    ],
    safe_grounding_refs: selectedKnowledge.case_entry?.reasoning_memory?.safe_grounding_refs || [],
    preferred_strategy: selectedKnowledge.case_entry?.reasoning_memory?.preferred_strategy || null,
    missing_info_to_request: selectedKnowledge.case_entry?.reasoning_memory?.missing_info_to_request || [],
    unsafe_behaviors: selectedKnowledge.case_entry?.reasoning_memory?.unsafe_behaviors || []
  };
}

function buildSalesAssistSignals(normalizedMessage, triage, threadMemory) {
  const text = String(normalizedMessage?.text || '').trim().toLowerCase();
  const signals = [];

  if (/mua|chốt|lấy|đặt|book|order|đơn|muốn lấy|muốn mua/.test(text)) {
    signals.push('purchase_action_language');
  }
  if (/giá|bao nhiêu|bao tiền|sale|khuyến mãi|voucher|giảm giá|freeship/.test(text)) {
    signals.push('price_or_promo_interest');
  }
  if (/còn hàng|còn size|size nào|màu nào|còn không|sz/.test(text)) {
    signals.push('variant_or_inventory_interest');
  }
  if (/tư vấn|gợi ý|recommend|phối đồ|mặc đi chơi|mặc đi làm|size nào hợp|chọn giúp/.test(text)) {
    signals.push('consultative_help_requested');
  }

  if (threadMemory?.promised_follow_up?.some((entry) => entry?.status === 'open')) {
    signals.push('open_follow_up_in_thread');
  }

  const uniqueSignals = [...new Set(signals)];
  const leadStrength = uniqueSignals.length >= 2 ? 'high' : uniqueSignals.length === 1 ? 'medium' : 'low';
  const buyerIntentHint = uniqueSignals.length
    ? triage?.case_type === 'complaint_or_negative_feedback'
      ? 'mixed_or_blocked_by_support_issue'
      : 'present'
    : 'not_detected';

  return {
    enabled: true,
    buyer_intent_hint: buyerIntentHint,
    lead_strength_hint: leadStrength,
    signals: uniqueSignals,
    recommended_sales_motion: uniqueSignals.length
      ? 'ask focused product/variant need or queue human consult, but do not claim price/inventory/product facts without grounded data'
      : 'no special sales motion',
    product_grounding_status: 'not_loaded_runtime_safe_mode',
    guardrails: [
      'Do not claim product availability without live or grounded inventory data',
      'Do not claim price, promotion, voucher, or freeship unless grounded and current',
      'Use sales signals only as prioritization/context hints, not as product facts',
      'If customer is close to buying, prefer collecting product/size/color intent over improvising catalog details'
    ]
  };
}
