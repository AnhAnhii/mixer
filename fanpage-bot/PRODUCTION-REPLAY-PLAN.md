# Production replay execution plan

Mục tiêu: ngay khi có payload/event thật từ webhook Facebook, có thể replay local qua đúng pipeline hiện tại trong vài phút, đối chiếu hành vi, và chốt ngay fixture regression nếu phát hiện lệch.

## Current readiness
- Có `npm run replay -- <payload.json> [limit]` để chạy nguyên pipeline trên một webhook body đã lưu.
- Có raw event logging JSONL tại `data/logs/raw-events.jsonl`.
- Có thêm `npm run replay:extract -- <raw-events.jsonl> <output.json> [limit]` để dựng lại webhook payload từ raw event log khi chỉ có JSONL append-only.
- Có audit JSONL + handoff queue để đọc kết quả replay sau khi chạy.

## Reality check in workspace
- Hiện **chưa có production payload thật** trong workspace.
- Raw event logs hiện có đều là test/smoke (`mid.local.*`, `test-psid-*`), hữu ích để chứng minh tooling nhưng **không đủ** để gọi là production sample.

## Fast path when a real payload arrives

### Path A — đã có full webhook body JSON
1. Lưu body nguyên gốc vào file, ví dụ:
   - `tmp/replay/facebook-webhook-2026-03-25T1105Z.json`
2. Chạy replay shadow-safe:
```bash
cd /root/.openclaw/workspace/fanpage-bot
AUTO_REPLY_ENABLED=false \
AUTO_REPLY_SHADOW_MODE=true \
LOG_STORE_PATH=./tmp/replay/audit.replay.jsonl \
HANDOFF_STORE_PATH=./tmp/replay/pending-handoffs.replay.jsonl \
RAW_EVENT_STORE_PATH=./tmp/replay/raw-events.replay.jsonl \
DEDUPE_STORE_PATH=./tmp/replay/processed-message-ids.replay.json \
THREAD_STATE_STORE_PATH=./tmp/replay/thread-state.replay.json \
npm run replay -- ../tmp/replay/facebook-webhook-2026-03-25T1105Z.json
```
3. Đọc kết quả chính:
   - summary stdout: `processed`, `delivery_decisions`, `case_types`
   - `tmp/replay/audit.replay.jsonl`: chi tiết triage/guard/delivery từng event
   - `tmp/replay/pending-handoffs.replay.jsonl`: các case bị hold/handoff

### Path B — chỉ có raw event JSONL từ log
1. Trích payload replay từ JSONL:
```bash
cd /root/.openclaw/workspace/fanpage-bot
npm run replay:extract -- ../mixer/data/logs/raw-events.jsonl ../tmp/replay/extracted-webhook.json 20
```
2. Replay với sandbox log riêng:
```bash
cd /root/.openclaw/workspace/fanpage-bot
AUTO_REPLY_ENABLED=false \
AUTO_REPLY_SHADOW_MODE=true \
LOG_STORE_PATH=./tmp/replay/audit.replay.jsonl \
HANDOFF_STORE_PATH=./tmp/replay/pending-handoffs.replay.jsonl \
RAW_EVENT_STORE_PATH=./tmp/replay/raw-events.replay.jsonl \
DEDUPE_STORE_PATH=./tmp/replay/processed-message-ids.replay.json \
THREAD_STATE_STORE_PATH=./tmp/replay/thread-state.replay.json \
npm run replay -- ../tmp/replay/extracted-webhook.json
```

## Expected outputs to verify

### Healthy replay
- stdout có dạng:
```json
{
  "processed": 1,
  "delivery_decisions": { "would_auto_send": 1 },
  "case_types": { "shipping_eta_general": 1 }
}
```
- audit record có đủ các lớp:
  - `normalized_message`
  - `triage` + `triage_hint`
  - `grounding_bundle`
  - `ai_reasoning_draft` / `ai_draft`
  - `guarded_draft`
  - `delivery`
  - `send_result`

### Expected production-safe behavior right now
- Với replay production sample ban đầu, mặc định nên giữ:
  - `AUTO_REPLY_ENABLED=false`
  - `AUTO_REPLY_SHADOW_MODE=true`
- Nghĩa là case low-risk đủ chuẩn sẽ ra `would_auto_send`, không gửi thật.
- Case medium/high-risk hoặc thiếu dữ liệu phải ra `handoff` / `draft_only`.
- Duplicate cùng `message_id` khi replay lại payload giống nhau có thể ra `ignore` nếu dùng chung dedupe store; vì vậy nên dùng file dedupe riêng cho mỗi run như command phía trên.

## How to turn replay findings into smoke regression fixtures

### Nếu replay pass đúng kỳ vọng
- Tạo fixture nhỏ nhất tái hiện case:
  - 1 webhook body JSON trong `tmp/` hoặc tốt hơn là chuyển thành object sample trong `src/cli-smoke.js`
  - Chỉ giữ field thật sự cần cho bug/behavior
- Ghi note ngắn:
  - source event type
  - expected `case_type`
  - expected `delivery.decision`
  - expected safety flag / reason nếu có

### Nếu replay lộ bug
1. Lưu payload gốc đã sanitize PII:
   - thay PSID/message id/text nhạy cảm nếu cần, nhưng giữ nguyên cấu trúc và tín hiệu ngôn ngữ gây bug
2. Thêm regression vào `src/cli-smoke.js` theo một trong 2 kiểu:
   - thêm message sample mới cạnh các case hiện có
   - hoặc thêm block assertion mới nếu bug nằm ở guard/dedupe/signature/page filtering
3. Assertion tối thiểu nên khóa:
   - `triage.case_type`
   - `delivery.decision`
   - `guarded_draft.action`
   - `send_result.status` nếu liên quan send flow
4. Re-run:
```bash
cd /root/.openclaw/workspace/fanpage-bot
npm run smoke
```
5. Chỉ commit khi smoke xanh lại.

## Recommended naming convention for real captures
- `tmp/replay/facebook-webhook-<UTC timestamp>.json`
- `tmp/replay/replay-result-<UTC timestamp>.json`
- `tmp/replay/notes-<UTC timestamp>.md`

## What I ran now
- Dò workspace để tìm payload/log dùng được.
- Xác nhận raw logs hiện có là smoke/test chứ chưa phải production thật.
- Chuẩn bị thêm script extraction từ raw-events JSONL để khi có log append-only vẫn replay được ngay.

## Next operator move when Saram drops a real event
1. Save raw webhook body or append-only raw-event lines.
2. Run exact command ở Path A hoặc Path B.
3. Compare stdout summary + audit record.
4. Nếu lệch, biến ngay thành smoke regression fixture trước khi sửa code.
