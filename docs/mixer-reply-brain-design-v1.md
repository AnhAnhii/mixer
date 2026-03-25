# Mixer Reply Brain Design v1

## 1. Đính chính mục tiêu
Tài liệu này thay cho cách hiểu sai kiểu "reply memory bank = kho kịch bản trả lời sẵn".

Mục tiêu đúng đã chốt với Saram:
- Rambu sẽ là **bộ não của một nhân viên chăm sóc khách hàng rất giỏi**
- Rambu phải **tự hiểu câu khách đang nói gì**, tự suy nghĩ trong phạm vi policy và dữ liệu thật
- Rambu phải **tự tạo câu trả lời phù hợp với ngữ cảnh hội thoại cụ thể**
- hệ thống **không được phụ thuộc vào script cứng** như kiểu regex -> câu trả lời chết
- template/pattern chỉ là **vật liệu hỗ trợ**, không phải trung tâm quyết định

Nói ngắn gọn:
> Đây là hệ thống reasoning-first, không phải script-first.

---

## 2. Hệ thống đích
Hệ thống đích không phải là:
- khách nói A -> trả lời bằng câu mẫu A1
- khách nói B -> trả lời bằng câu mẫu B2
- bot sống bằng các macro hardcode

Hệ thống đích là:
- đọc tin nhắn thật của khách
- hiểu ý định, cảm xúc, mức độ rủi ro, dữ liệu còn thiếu
- đối chiếu policy và trạng thái hội thoại
- tự soạn câu trả lời mới phù hợp nhất cho đúng tình huống
- biết khi nào cần hỏi thêm
- biết khi nào cần dừng và handoff

Nói theo ngôn ngữ vận hành:

```text
customer message
  -> understand
  -> reason
  -> ground with policy + context + memory
  -> decide next action
  -> write reply naturally
  -> safety guard
```

---

## 3. Core principle: Brain, not script

### 3.1. Điều trung tâm là năng lực suy luận
"Reply brain" phải có các năng lực chính:
- hiểu ngôn ngữ tự nhiên của khách
- suy ra khách thực sự muốn gì
- phát hiện thông tin còn thiếu
- đánh giá case này low/medium/high risk
- chọn cách trả lời phù hợp nhất với bối cảnh
- giữ tone thương hiệu Mixer
- không bịa thông tin
- biết tự dừng khi vượt dữ liệu được phép

### 3.2. Script chỉ là fallback
Các pattern trả lời mẫu vẫn hữu ích, nhưng vai trò của chúng là:
- cung cấp phong cách viết ổn định
- cung cấp các mảnh phrasing an toàn
- làm fallback khi model yếu hoặc context thiếu
- hỗ trợ test/regression

Script **không phải** nơi chứa "trí thông minh" của hệ thống.

### 3.3. Trí thông minh phải đến từ 5 nguồn
1. **message understanding** — khách đang hỏi gì, đang cảm thấy gì
2. **policy grounding** — Mixer thực sự cho phép gì
3. **conversation memory** — trước đó trong thread đã nói gì
4. **operational judgment** — case này nên trả lời, hỏi thêm, hay handoff
5. **natural language generation** — viết câu trả lời mới, tự nhiên, đúng tone

---

## 4. Reply brain gồm những lớp nào

## 4.1. Perception layer
Đầu vào không chỉ là text thô.

Mỗi inbound message nên được hiểu thành một object giàu ngữ nghĩa hơn:

```json
{
  "customer_message": "đơn mình sao lâu quá vậy shop",
  "intent_hypotheses": ["order_status_request", "complaint_or_negative_feedback"],
  "primary_need": "wants_order_progress_explanation",
  "sentiment": "frustrated",
  "urgency": "medium",
  "confidence": 0.82,
  "missing_information": ["order_code"],
  "risk_level": "high"
}
```

Lớp này không trả lời thay khách.
Nó chỉ giúp bộ não hiểu khách trước khi suy nghĩ tiếp.

## 4.2. Grounding layer
Đây là phần cung cấp "thực tế" cho bộ não:
- policy CSKH Mixer
- thông tin vận hành đã xác nhận
- giới hạn những gì được phép nói
- dữ liệu hội thoại trước đó
- trạng thái thread
- dữ liệu nội bộ nếu sau này tích hợp thật

Không có grounding thì model sẽ dễ nói nghe hay nhưng sai.

## 4.3. Reasoning layer
Đây là lớp quan trọng nhất.

Bộ não phải quyết định:
- khách cần câu trả lời trực tiếp hay cần được hỏi thêm
- có thể trả lời ngay hay phải handoff
- case này trọng tâm là giải thích, xoa dịu, hay xin thông tin
- câu trả lời nên ngắn gọn đến đâu
- có cần xin lỗi không
- có cần tránh khẳng định cứng không

Reasoning layer phải tạo ra một quyết định có cấu trúc, ví dụ:

```json
{
  "customer_goal": "check_order_status",
  "assistant_strategy": "empathize_then_request_order_code",
  "action": "handoff",
  "why": [
    "customer_is_frustrated",
    "needs_internal_order_lookup",
    "order_code_missing"
  ]
}
```

## 4.4. Response composition layer
Từ quyết định ở reasoning layer, hệ thống mới viết câu trả lời.

Mục tiêu:
- câu trả lời tự nhiên như nhân viên giỏi tự viết
- không lộ cảm giác lắp ghép máy móc
- ngắn, đúng trọng tâm, đúng vibe Mixer

Lớp này có thể dùng pattern hỗ trợ, nhưng output cuối phải là câu phù hợp với tình huống thật.

## 4.5. Safety / policy guard
Lớp cuối cùng để chặn các lỗi nguy hiểm:
- bịa đơn hàng
- bịa tồn kho
- hứa ngoại lệ
- trả lời quá tự tin khi thiếu dữ liệu
- tự xử lý complaint nặng
- auto-send case đáng ra phải handoff

---

## 5. Từ "memory bank" sang "brain memory system"
Nếu vẫn dùng chữ "memory bank" thì phải hiểu lại cho đúng.

Nó không phải kho câu trả lời.
Nó là hệ thống nhớ phục vụ suy luận, gồm 4 loại nhớ:

### 5.1. Policy memory
Nhớ các sự thật vận hành đã được xác nhận.
Ví dụ:
- đổi trả trong 3 ngày từ giao thành công
- ship Bắc 2-5 ngày
- Trung/Nam 5-7 ngày
- carrier là Viettel Post
- hỗ trợ 08:00-23:00

### 5.2. Case memory
Nhớ các dạng tình huống từng gặp và cách nhìn nhận chúng.
Nhưng không lưu kiểu "gặp case này thì đọc đúng câu này".
Thay vào đó lưu:
- bản chất case
- risk level
- dữ liệu thường thiếu
- loại quyết định thường cần
- tín hiệu cần handoff

### 5.3. Thread memory
Nhớ theo từng cuộc hội thoại:
- khách đang hỏi về vấn đề nào
- trước đó đã xin mã đơn chưa
- khách đang khó chịu hay bình thường
- đã hứa follow-up gì chưa
- bot/người đã trả lời gần nhất ra sao

### 5.4. Language memory
Nhớ các nguyên tắc phrasing tốt:
- cách xin lỗi tự nhiên
- cách hỏi thêm thông tin ngắn gọn
- cách giải thích policy không khô cứng
- cách chốt câu mềm mại

Language memory là stylistic guidance, không phải kịch bản cứng.

---

## 6. Kiến trúc dữ liệu đề xuất

## 6.1. policy-bank.json
Chứa sự thật đã xác nhận.

## 6.2. case-bank.json
Chứa tri thức về từng nhóm case:
- typical intents
- risk profile
- common missing info
- recommended decision patterns
- escalation signals

## 6.3. reasoning-playbook.md
Không phải script.
Là tài liệu mô tả cách một nhân viên CSKH giỏi nên suy nghĩ:
- khi nào cần trấn an trước
- khi nào hỏi thêm ngay
- khi nào tránh trả lời quá sớm
- khi nào phải chuyển người thật

## 6.4. tone-guide.json
Chứa các quy tắc về giọng điệu, mức lịch sự, từ vựng nên/tránh.

## 6.5. thread-memory store
Lưu trạng thái động của từng khách/thread.

## 6.6. response-pattern-bank.json
Chỉ lưu các mảnh phrasing và pattern viết hữu ích.
Không để file này điều khiển toàn bộ hệ thống.

---

## 7. Schema tư duy cho từng case
Mỗi case nên được mô hình hóa theo hướng suy luận, ví dụ:

```json
{
  "case_id": "order_status_request",
  "goal_interpretation": "customer_wants_status_update_for_specific_order",
  "risk_level": "medium_to_high",
  "common_emotions": ["neutral", "impatient", "frustrated"],
  "required_real_world_data": ["order_code_or_phone", "internal_order_lookup"],
  "common_missing_info": ["order_code"],
  "reasoning_defaults": {
    "if_missing_required_data": "ask_for_order_identifier",
    "if_customer_is_upset": "empathize_briefly_before_requesting_info",
    "if_internal_lookup_needed": "handoff_or_queue_for_human"
  },
  "unsafe_behaviors": [
    "invent_order_status",
    "promise_delivery_time_without_data"
  ]
}
```

Điểm quan trọng ở đây là:
- case record mô tả **cách suy nghĩ**
- không phải chỉ mô tả **câu cần trả lời**

---

## 8. Response generation contract
Output của reply brain nên có 3 tầng:

### 8.1. Thinking result
```json
{
  "understanding": {
    "intent": "order_status_request",
    "sentiment": "frustrated",
    "missing_info": ["order_code"]
  },
  "decision": {
    "action": "handoff",
    "strategy": "brief_empathy_then_request_order_code",
    "reason": "requires_internal_data"
  }
}
```

### 8.2. Customer-facing reply
```json
{
  "reply_text": "Dạ em xin lỗi anh/chị vì đơn đang làm mình sốt ruột ạ. Anh/chị gửi giúp em mã đơn hoặc số điện thoại nhận hàng để bên em kiểm tra và hỗ trợ mình nhanh hơn nha.",
  "tone_profile": "mixer_support_default"
}
```

### 8.3. Operational metadata
```json
{
  "needs_human": true,
  "confidence": 0.86,
  "policy_refs": ["support_hours", "order_lookup_rule"],
  "safety_flags": ["requires_internal_data", "customer_negative_sentiment"]
}
```

---

## 9. Cách đánh giá đúng/sai của hệ thống
Một reply brain tốt không chỉ được đánh giá bằng "đúng policy".
Nó còn phải đạt:

- **Correctness**: thông tin không sai
- **Relevance**: trúng đúng điều khách đang cần
- **Judgment**: chọn đúng hành động tiếp theo
- **Tone quality**: nói như nhân viên giỏi, không robot
- **Context continuity**: không hỏi lại vô nghĩa, không quên điều vừa nói
- **Safety**: không bịa, không over-promise

---

## 10. Roadmap xây đúng hướng

### Phase 1 — Brain spec
- chốt triết lý hệ thống là reasoning-first
- chuẩn hóa policy / case / tone / thread memory
- viết reasoning playbook

### Phase 2 — Structured brain context
- biến policy và case thành file dữ liệu có cấu trúc
- chuẩn hóa input bundle cho model
- chuẩn hóa output reasoning + reply + metadata

### Phase 3 — Better thread memory
- lưu active issue, missing info, sentiment, previous asks, promises
- tránh hỏi lại và tránh trả lời lạc mạch

### Phase 4 — Model-led response
- cho model tự viết reply dựa trên grounded context
- pattern bank chỉ làm support/fallback

### Phase 5 — Controlled automation
- chỉ auto-send khi case low-risk, context rõ, confidence cao, guard pass
- medium/high-risk vẫn draft_only hoặc handoff

---

## 11. Quyết định chốt ở v1
Chốt rõ để tránh drift sau này:

1. **Reply memory bank không được hiểu là kho script**
2. Trung tâm hệ thống là **reply brain / reasoning engine**
3. Pattern bank chỉ là phụ trợ cho phrasing và fallback
4. Mỗi case phải mô tả cách suy nghĩ, không chỉ mẫu câu
5. Thread memory là bắt buộc nếu muốn trả lời như nhân viên giỏi thật
6. Đích đến là trả lời tự nhiên, theo ngữ cảnh thật, không lộ cảm giác bot đọc kịch bản

---

## 12. Câu mô tả chuẩn để giữ định hướng
Có thể dùng câu này làm north star cho dự án:

> Rambu là bộ não của một nhân viên chăm sóc khách hàng rất giỏi: hiểu khách đang muốn gì, suy nghĩ trong phạm vi policy và dữ liệu thật, rồi tự tạo ra câu trả lời phù hợp nhất cho từng tình huống; không vận hành như một máy đọc kịch bản có sẵn.
