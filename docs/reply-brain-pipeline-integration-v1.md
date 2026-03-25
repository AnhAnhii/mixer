# Reply Brain Pipeline Integration v1

## Mục tiêu
Tài liệu này mô tả cách nối **reply brain reasoning-first** vào pipeline hiện tại của `fanpage-bot/` theo hướng thực dụng, an toàn, và ít phá vỡ hệ thống đang chạy.

Mục tiêu không phải là thay pipeline hiện tại bằng một hệ thống mới hoàn toàn.
Mục tiêu đúng là:
- giữ nguyên các guard vận hành đang có giá trị
- tận dụng pipeline hiện tại làm khung orchestration
- thay phần "grounded input + draft generation" từ mức khá mỏng hiện tại sang một **brain input bundle** giàu ngữ cảnh hơn
- dần chuyển classifier từ "single-case regex router" sang "triage hint provider" cho reasoning engine

---

## 1. Đọc nhanh pipeline hiện tại

Hiện tại `fanpage-bot/src/pipeline.js` đang chạy theo flow:

```text
raw webhook event
-> normalize (`normalize.js`)
-> page allowlist / passive-event ignore / idempotency
-> classify (`classify.js`)
-> build grounded input (`grounding.js`)
-> generate draft (`ai-draft.js`)
-> apply policy guard (`guard.js`)
-> maybe deliver (`facebook-send.js`)
-> audit log / handoff queue (`store.js`)
```

### Điểm mạnh hiện tại
- webhook plumbing ổn
- dedupe/idempotency đã có
- page allowlist, postback ignore, passive-event audit đã có
- support-hours / cooldown / allowlist case / confidence threshold đã có
- send adapter khá cứng cáp
- audit/handoff/version metadata đã có sẵn để rollout an toàn

### Điểm còn mỏng nếu muốn reasoning-first thật sự
- `classify.js` đang đóng vai trò quá lớn, gần như quyết định bản chất case bằng regex cứng
- `grounding.js` mới chỉ nhét toàn bộ grounding file vào input, chưa bundle hóa theo tình huống
- `ai-draft.js` chưa có structured reasoning contract rõ; prompt còn rất mỏng
- `fallback-draft.js` vẫn là reply-by-case nhiều hơn là reasoning-by-case
- chưa có thread memory thực thụ cho ngữ cảnh hội thoại (ngoài cooldown state)

Kết luận: **không cần đập bỏ pipeline**. Chỉ cần thêm một lớp brain bundle + reasoning contract vào đúng chỗ.

---

## 2. Nguyên tắc tích hợp

### 2.1. Không thay guard bằng model
Các file sau vẫn nên giữ vai trò nền tảng, không đẩy sang model:
- `src/pipeline.js`
- `src/guard.js`
- `src/facebook-send.js`
- `src/idempotency.js`
- `src/store.js`
- `src/webhook.js`

Model/reasoning brain chỉ nên quyết định:
- khách đang muốn gì
- cảm xúc / mức độ khó chịu
- dữ liệu còn thiếu
- nên trả lời trực tiếp, hỏi thêm, hay handoff
- viết câu trả lời như thế nào

### 2.2. Classifier nên bị hạ vai trò
`src/classify.js` không nên còn là "single source of truth" cho case.
Trong v1 integration thực dụng, nó nên được giữ như:
- triage hint provider
- detector cho obvious high-risk / low-risk patterns
- fast heuristic fallback nếu model unavailable

### 2.3. Bundle phải giàu nhưng có kiểm soát
Không đẩy cả kho tri thức vào prompt vô tội vạ.
Nên tạo một bước chọn lọc:
- policy snippets liên quan
- case heuristics liên quan
- tone guide phù hợp
- response patterns chỉ làm support
- thread memory summary

### 2.4. Guard quyết định send, không phải model
Model có thể đề xuất `auto_reply`, nhưng quyết định cuối cùng vẫn phải đi qua `guard.js`.

---

## 3. Input bundle mới cần những gì

Đây là phần quan trọng nhất.
Thay vì đưa vào model một object kiểu:
- latest message
- triage hint
- full grounding blob

… ta nên tạo một **reply brain input bundle** rõ contract.

## 3.1. Bundle đề xuất

```json
{
  "message": {
    "channel": "facebook_messenger",
    "page_id": "...",
    "thread_key": "facebook:page:psid",
    "message_id": "mid...",
    "timestamp": 1711111111111,
    "customer_text": "shop ơi đơn mình sao lâu quá vậy",
    "attachments": []
  },
  "conversation_context": {
    "recent_messages": [],
    "thread_memory": {
      "active_issue": null,
      "customer_sentiment": null,
      "last_agent_action": null,
      "last_requested_fields": [],
      "open_questions": [],
      "promises": []
    }
  },
  "triage_hints": {
    "case_candidates": [
      {
        "case_type": "order_status_request",
        "confidence": 0.9,
        "reason": "matched_order_status_rule"
      },
      {
        "case_type": "complaint_or_negative_feedback",
        "confidence": 0.68,
        "reason": "shipping_delay_language"
      }
    ],
    "risk_hints": ["requires_internal_data", "possible_frustration"],
    "missing_info_hints": ["order_code"],
    "has_attachments": false
  },
  "knowledge_context": {
    "policy_facts": [],
    "case_memory": [],
    "tone_profile": {},
    "response_patterns": [],
    "forbidden_claims": []
  },
  "operating_context": {
    "support_hours": {
      "start": 8,
      "end": 23,
      "timezone_offset_minutes": 420,
      "within_window": true
    },
    "automation_mode": {
      "auto_reply_enabled": false,
      "shadow_mode": true,
      "allowed_cases": ["shipping_carrier", "support_hours"]
    },
    "processing_meta": {
      "pipeline_version": "...",
      "policy_version": "...",
      "prompt_version": "...",
      "grounded_data_version": "..."
    }
  }
}
```

## 3.2. Ý nghĩa từng nhóm input

### `message`
Phần bất biến của inbound event.
Giữ gần với `normalized_message` hiện tại để không làm pipeline rối.

### `conversation_context`
Là chỗ bắt đầu để hệ thống có continuity thật.
Trong v1 có thể vẫn dùng `recentMessages` từ `pipeline.js`, nhưng nên chuẩn bị contract cho `thread_memory` ngay từ đầu.

### `triage_hints`
Đây là vai trò mới của classifier.
Không ép một nhãn duy nhất quá sớm.
Nên trả về:
- top case candidates
- risk hints
- missing info hints
- ambiguity flags

### `knowledge_context`
Là phần được chọn lọc từ các bank mới:
- `policy-bank.json`
- `case-bank.json`
- `tone-guide.json`
- `response-pattern-bank.json`
- reasoning playbook hoặc bản JSON hóa một phần

### `operating_context`
Không cho model quyết định mù.
Nó phải biết:
- đang trong support hours hay ngoài giờ
- chế độ deploy hiện tại là shadow hay live
- case nào được auto-send
- version hiện tại của policy/prompt/data

---

## 4. Cần tạo thêm knowledge files nào

Trong `fanpage-bot/knowledge/`, v1 nên có tối thiểu:

### 4.1. `policy-bank.json`
Chứa facts vận hành đã xác nhận, có id rõ ràng.

Ví dụ tối thiểu:
- support hours
- shipping ETA theo vùng
- carrier
- exchange/return window
- defective item support
- những gì bot không được tự khẳng định nếu không có data thật

### 4.2. `case-bank.json`
Mỗi case phải encode cách suy nghĩ, không chỉ phrase.

Mỗi record nên có:
- case id
- customer goal interpretation
- common emotions
- risk level
- required real-world data
- common missing info
- decision defaults
- escalation signals
- unsafe behaviors

### 4.3. `tone-guide.json`
Không phải prompt dài dòng; nên là rulebook ngắn, cụ thể:
- professional but warm
- gen Z vừa đủ, không lố
- apology style
- ask-for-info style
- no overpromise
- no robotic repetition

### 4.4. `response-pattern-bank.json`
Chỉ giữ các pattern hỗ trợ:
- greeting opener
- empathy opener
- ask-for-order-code phrasing variants
- concise policy explanation patterns
- soft closing patterns

Pattern này **không được đóng vai trò quyết định case**.

### 4.5. `reasoning-playbook.md` hoặc `reasoning-playbook.json`
Nếu muốn dùng trực tiếp trong prompt, JSON tiện hơn.
Nếu muốn dùng cho người đọc và maintain dễ hơn, MD tiện hơn.

Khuyến nghị thực dụng:
- viết nguồn thật ở `.md`
- nếu cần prompt injection có cấu trúc, tạo thêm bản rút gọn `.json`

---

## 5. File nào cần sửa

## 5.1. Sửa chính

### `fanpage-bot/src/classify.js`
Mục tiêu sửa:
- từ single-label classifier sang triage hint provider
- giữ backward compatibility với pipeline hiện tại trong giai đoạn đầu

Hướng practical:
- vẫn export `classifyMessage()` để không vỡ pipeline
- nhưng object trả về nên giàu hơn dần, ví dụ thêm:
  - `case_candidates`
  - `risk_hints`
  - `sentiment_hint`
  - `ambiguity_hints`
- `case_type` hiện tại có thể giữ làm `primary_case_type`

Nếu muốn tránh sửa diện rộng ngay, có thể thêm hàm mới:
- `buildTriageHints(normalizedMessage)`

Rồi cho `classifyMessage()` gọi lại hàm này và map về shape cũ.

### `fanpage-bot/src/grounding.js`
Đây là file nên đổi mạnh nhất.
Hiện tại file này chỉ đọc một blob `mixer-grounded-ai-data-v1.json` rồi nhét vào input.

Nên refactor thành:
- load nhiều knowledge source
- chọn policy facts liên quan theo triage hint
- chọn case memory theo case candidates
- nhét tone guide mặc định
- chọn pattern snippets hỗ trợ theo strategy
- gộp `recent_messages` + `thread_memory`

Nên đổi tên logic nội bộ từ `buildGroundedInput()` sang kiểu:
- `buildReplyBrainInput()`

Có thể vẫn giữ export `buildGroundedInput` để tương thích, nhưng bên trong trả về bundle mới.

### `fanpage-bot/src/ai-draft.js`
Cần sửa prompt và output contract.

Hiện tại model chỉ được yêu cầu trả:
- `reply_text`
- `action`
- `confidence`
- `needs_human`
- `missing_info`
- `reason`
- `policy_refs`
- `safety_flags`

Nên nâng lên contract reasoning-first:

```json
{
  "understanding": {
    "intent": "...",
    "sentiment": "neutral|positive|confused|impatient|frustrated|angry",
    "missing_info": []
  },
  "decision": {
    "action": "draft_only|handoff|auto_reply",
    "strategy": "...",
    "reason": "..."
  },
  "reply": {
    "reply_text": "...",
    "tone_profile": "mixer_support_default"
  },
  "ops_meta": {
    "needs_human": true,
    "confidence": 0.88,
    "policy_refs": [],
    "safety_flags": []
  }
}
```

Sau đó map output này về shape hiện tại để `guard.js` chưa phải sửa lớn.

### `fanpage-bot/src/fallback-draft.js`
Nên chuyển từ hardcoded canned replies sang:
- deterministic safe fallback by strategy
- vẫn ngắn gọn nhưng có ý thức reasoning

Ví dụ thay vì chỉ dựa vào `case_type`, có thể dựa vào:
- case type
- sentiment hint
- missing info
- risk hint

Không cần model hóa quá sâu, nhưng nên bớt cảm giác macro cứng.

### `fanpage-bot/src/pipeline.js`
Chỉ cần sửa nhỏ, chủ yếu ở chỗ:
- gọi triage builder giàu hơn
- gọi brain input builder mới
- lưu thêm `reasoning_result` / `brain_bundle_summary` vào audit nếu cần

Không nên rewrite orchestration.

## 5.2. Có thể sửa nhẹ sau đó

### `fanpage-bot/src/guard.js`
Không cần rewrite ngay.
Nhưng về sau nên đọc thêm:
- `decision.strategy`
- `understanding.sentiment`
- `ops_meta.safety_flags`
- `required_real_world_data_missing`

### `fanpage-bot/src/store.js`
Chỉ cần nếu muốn log thêm:
- `reasoning_summary`
- `brain_context_refs`
- `thread_memory_snapshot`

### `fanpage-bot/src/thread-state.js`
Hiện file này chỉ phục vụ cooldown.
Nếu muốn continuity thật, nên mở rộng thành store cho:
- active issue
- last requested fields
- customer sentiment trend
- unresolved topic
- last agent promise

Nhưng đây nên là phase sau, không nên làm ngay nếu chưa có replay dataset đủ tốt.

---

## 6. Flow xử lý mới đề xuất

## 6.1. Flow khuyến nghị cho v1 integration

```text
webhook event
-> normalize
-> ignore/page/dedupe guards
-> heuristic triage hints
-> build reply brain input bundle
-> generate reasoning result + reply draft
-> map reasoning result -> legacy draft shape
-> policy guard
-> auto_send / draft_only / handoff
-> audit + handoff queue
```

## 6.2. Chi tiết từng bước

### Bước 1: heuristic triage hints
Không quyết định cuối cùng, chỉ cung cấp:
- case candidates
- sentiment hints
- risk hints
- missing info hints
- obvious blockers

### Bước 2: build reply brain input bundle
`grounding.js` nên chọn lọc dữ liệu thay vì nhét full blob.

Ví dụ:
- khách hỏi ship -> lấy shipping facts + low-risk case memory + concise FAQ tone
- khách than phiền ship lâu -> lấy complaint case memory + empathy tone + no-promise guard hints
- khách hỏi đơn -> lấy order-status case memory + required data `order_code` + handoff bias

### Bước 3: reasoning-first generation
Model cần trả ra 3 tầng:
- understanding
- decision
- reply
- ops_meta

### Bước 4: compatibility mapping
Để tránh sửa guard quá nhiều, map về object gần giống hiện tại:

```json
{
  "reply_text": "...",
  "action": "handoff",
  "confidence": 0.88,
  "needs_human": true,
  "missing_info": ["order_code"],
  "reason": "requires_internal_data",
  "policy_refs": ["order_lookup_rule"],
  "safety_flags": ["requires_internal_data"]
}
```

### Bước 5: guard stays final
`guard.js` vẫn là nơi chặn cuối.

---

## 7. Guard / safety points cần giữ hoặc bổ sung

## 7.1. Những guard hiện tại rất đúng, nên giữ nguyên
- page allowlist
- idempotency / duplicate ignore
- support-hours gating
- thread cooldown
- low-confidence downgrade
- auto-reply allowlist per case
- attachment -> handoff
- complaint / exchange / order / stock -> handoff bias

## 7.2. Guard mới nên bổ sung khi nối reply brain

### A. Required real-world data missing
Nếu case memory nói rằng cần dữ liệu thật mà bundle chưa có, không được cho model tự bịa.

Ví dụ:
- order status cần order code/internal lookup
- stock check cần product + size + inventory source
- complaint cần đủ context trước khi hứa cách xử lý

=> nếu thiếu, ép `handoff` hoặc `ask_for_info`, không `auto_send` trừ low-risk case cực rõ.

### B. Unsupported policy claim
Nếu reply có nội dung vượt policy bank:
- hoàn tiền ngay
- đổi ngoài thời hạn
- hứa giao đúng ngày cụ thể
- xác nhận còn hàng khi chưa check

=> downgrade/handoff.

### C. Over-specific promise detection
Auto-send không nên cho phép các câu kiểu:
- "chiều nay nhận được"
- "em chắc chắn còn size"
- "bên em sẽ đổi miễn phí trong mọi trường hợp"

### D. Repetition / loop guard
Nếu thread memory cho thấy bot vừa hỏi mã đơn ở 1-2 turn gần đây mà khách chưa trả lời rõ, đừng lặp y chang câu cũ.
Ít nhất nên downgrade về draft_only để người thật can thiệp.

### E. Frustration escalation guard
Nếu sentiment là `frustrated|angry` và có tín hiệu complaint, auto-send nên bị chặn trừ khi chỉ là lời xin lỗi rất nhẹ và hướng handoff rõ ràng.

---

## 8. Thứ tự triển khai an toàn

## Phase 0 — không đụng runtime behavior nhiều
**Mục tiêu:** chuẩn hóa tri thức trước.

Làm trước:
1. tạo `fanpage-bot/knowledge/policy-bank.json`
2. tạo `fanpage-bot/knowledge/case-bank.json`
3. tạo `fanpage-bot/knowledge/tone-guide.json`
4. tạo `fanpage-bot/knowledge/response-pattern-bank.json`
5. tạo `fanpage-bot/knowledge/reasoning-playbook.md`

Chưa cần đổi logic send.

## Phase 1 — đổi `grounding.js` thành bundle builder
**Mục tiêu:** input vào AI giàu hơn nhưng output hệ thống vẫn như cũ.

Làm:
- `grounding.js` load các bank mới
- build bundle có chọn lọc theo triage
- vẫn trả qua `generateDraft()` như hiện tại

Safe vì:
- guard không đổi
- send logic không đổi
- audit structure gần như không đổi

## Phase 2 — nâng `ai-draft.js` sang reasoning contract
**Mục tiêu:** model trả structured reasoning + reply.

Làm:
- sửa prompt
- parse output contract mới
- map ngược về legacy shape cho `guard.js`

Vẫn giữ fallback cũ/đã cải tiến.

## Phase 3 — hạ vai trò classifier
**Mục tiêu:** classifier chỉ còn là hint layer.

Làm:
- thêm `case_candidates`
- giảm phụ thuộc vào `case_type` duy nhất
- cho phép model resolve ambiguity tốt hơn

## Phase 4 — thread memory thật
**Mục tiêu:** continuity tốt hơn.

Làm:
- mở rộng `thread-state.js` hoặc tạo `thread-memory.js`
- lưu summary tối giản theo thread
- đưa summary vào input bundle

## Phase 5 — rollout an toàn với replay + metrics
**Mục tiêu:** chứng minh brain mới không phá guard.

Làm:
- replay payload thật qua `npm run replay`
- so decision cũ vs mới trên tập case đại diện
- chỉ khi ổn mới nới `AUTO_REPLY_ALLOWED_CASES`

---

## 9. Đề xuất mapping file cụ thể

### Hiện trạng -> mục tiêu

#### `src/classify.js`
Từ:
- regex -> single case label

Sang:
- regex/heuristic -> ranked hints + risk hints + sentiment hints

#### `src/grounding.js`
Từ:
- full blob grounding loader

Sang:
- selective reply brain bundle builder

#### `src/ai-draft.js`
Từ:
- thin prompt + flat JSON draft

Sang:
- reasoning-first prompt + structured JSON + compatibility mapper

#### `src/fallback-draft.js`
Từ:
- canned reply per case

Sang:
- safe reasoning fallback per scenario archetype

#### `src/pipeline.js`
Từ:
- triage -> grounding -> ai draft

Sang:
- triage hints -> reply brain bundle -> reasoning result -> guard

#### `src/thread-state.js`
Từ:
- cooldown only

Sang:
- cooldown + minimal thread memory summary (phase sau)

---

## 10. Đề xuất contract audit mới

Để rollout dễ kiểm tra, nên log thêm các field sau vào audit record:

```json
{
  "brain_bundle_summary": {
    "policy_fact_ids": ["shipping_eta_v1", "carrier_v1"],
    "case_ids": ["shipping_eta_general"],
    "tone_profile": "mixer_support_default",
    "pattern_ids": ["faq_concise_answer", "soft_close_v1"]
  },
  "reasoning_result": {
    "understanding": {
      "intent": "shipping_eta_general",
      "sentiment": "neutral",
      "missing_info": []
    },
    "decision": {
      "action": "auto_reply",
      "strategy": "direct_grounded_answer",
      "reason": "policy_answer_available"
    }
  }
}
```

Không cần log full prompt/context nếu sợ log phình to.
Chỉ cần đủ để debug tại sao bot nghĩ như vậy.

---

## 11. Mức sửa code thực dụng nhất

Nếu làm thật theo hướng ít rủi ro nhất, tôi đề xuất:

### Đợt 1
- chỉ thêm knowledge files
- chỉ refactor `grounding.js`
- sửa rất nhẹ `pipeline.js` để truyền thêm context nếu cần
- chưa động vào `guard.js`

### Đợt 2
- sửa `ai-draft.js` sang reasoning contract mới
- thêm mapper để guard vẫn dùng object cũ

### Đợt 3
- sửa `classify.js` sang ranked triage hints
- thêm thread memory thật

Đây là thứ tự an toàn nhất vì tránh việc chạm ngay vào phần auto-send/guard.

---

## 12. Kết luận chốt

### Điều nên làm ngay
1. dựng bộ knowledge files mới trong `fanpage-bot/knowledge/`
2. refactor `grounding.js` thành **reply brain bundle builder**
3. nâng `ai-draft.js` để model trả **reasoning + decision + reply**
4. giữ `guard.js` là lớp quyết định cuối
5. rollout bằng replay + audit comparison trước khi nới auto-send

### Điều không nên làm lúc này
- không rewrite toàn bộ pipeline
- không bỏ classifier hoàn toàn ngay lập tức
- không để model trực tiếp điều khiển send/handoff mà không qua guard
- không biến pattern bank thành kho canned replies rồi gọi đó là brain

### Nhận định thực dụng
Pipeline hiện tại đã đủ tốt để làm khung production-safe cho MVP.
Điểm cần nâng cấp không phải là phần webhook/send/logging, mà là **chất lượng input bundle và reasoning contract** trước khi vào `ai-draft.js`.

Nếu làm đúng, `fanpage-bot` sẽ chuyển từ:
- "regex + fallback answer + guard"

sang:
- "heuristic triage hints + grounded reply brain bundle + structured reasoning + guard"

Đó là bước nâng cấp đúng hướng nhất để đạt mục tiêu reasoning-first mà không tự phá sự ổn định đang có.
