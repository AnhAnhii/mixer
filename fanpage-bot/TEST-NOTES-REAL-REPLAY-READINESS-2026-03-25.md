# Real replay readiness notes — 2026-03-25

## Goal
Chuẩn bị một đường chạy thực dụng để khi có payload/event production sample thì có thể replay ngay vào `mixer/fanpage-bot` và nhìn được shape/decision mới của reasoning-first pipeline.

## Audit hiện trạng
- `src/replay-webhook.js` trước đó chỉ nhận **full webhook payload JSON**.
- Pipeline đã có raw-event logging qua `appendRawEventLog()` vào `RAW_EVENT_STORE_PATH`.
- Raw log record hiện chứa đủ dữ liệu để dựng lại event replay:
  - `page_id`
  - `sender_psid`
  - `timestamp`
  - `raw_event_type`
  - `raw_event`
- `mixer/api/webhook/facebook.ts` đã giữ raw request body cho production POST path; tức là nếu deploy thật đang ghi raw-events thì sau này có sample thật là replay local được.

## Gap đã vá
`src/replay-webhook.js` giờ nhận được 4 kiểu input:
1. **Full webhook payload JSON**
2. **`raw-events.jsonl`** của pipeline
3. **Một raw-event-log record JSON** (`{ raw_event: ... }`)
4. **Một bare Messenger event JSON** (`{ sender, recipient, message/postback/... }`)

Ngoài replay decision như cũ, replay giờ mặc định chạy trên một bộ store cách ly trong `.tmp/replay-runs/<timestamp>/` để không làm bẩn audit/dedupe/thread-state thật.

Output giờ có thêm:
- `input_mode`
- `selected_event_count`
- `available_event_count`
- `selection`
- `event_shape_summary`
  - breakdown theo `event_types`
  - có text hay không
  - có attachment hay không
  - loại attachment
  - quick reply count
  - sample message ids
  - sample texts

## Cách dùng ngay khi có sample thật
### 1) Replay nguyên payload Facebook
```bash
cd mixer/fanpage-bot
npm run replay -- ../../tmp/facebook-webhook-prod.json
npm run replay -- ../../tmp/facebook-webhook-prod.json 5
```

### 2) Replay từ raw log JSONL
```bash
cd mixer/fanpage-bot
npm run replay -- ../data/logs/raw-events.jsonl 10
```

### 3) Chỉ replay một MID cụ thể từ raw log
```bash
cd mixer/fanpage-bot
npm run replay -- ../data/logs/raw-events.jsonl 5 --mid <facebook_mid>
```

### 4) Chỉ replay event của một PSID hoặc type cụ thể
```bash
cd mixer/fanpage-bot
npm run replay -- ../data/logs/raw-events.jsonl 10 --psid <sender_psid>
npm run replay -- ../data/logs/raw-events.jsonl 10 --event-type message
```

### 5) Nếu chỉ export được `raw_event` đơn lẻ
```bash
cd mixer/fanpage-bot
npm run replay -- ../../tmp/one-event.json
```

## Checklist khi xin / lưu production sample
- Ưu tiên lấy **payload JSON gốc** của webhook POST nếu có.
- Nếu không có payload gốc, lấy **`raw-events.jsonl` record** là đủ để replay.
- Giữ lại các field sau:
  - `entry.id` / `page_id`
  - `sender.id`
  - `recipient.id`
  - `timestamp`
  - `message.mid` nếu có
  - `message.text` / `attachments` / `quick_reply`
  - `postback` / `referral` / `delivery` / `read` nếu đang audit shape ngoài text flow
- Trước khi share sample cho debug:
  - redact token/secret nếu lẫn vào artifact khác
  - có thể thay `sender_psid` bằng placeholder cố định, nhưng **đừng làm mất tính nhất quán thread/page**
  - giữ nguyên structure JSON; không “tóm tắt lại bằng tay”

## Checklist đánh giá sau replay
- `event_shape_summary.event_types` có đúng loại event production đang đổ vào không?
- `normalized_message.event_type` có khớp kỳ vọng không?
- Với message thật:
  - `triage.case_type` có hợp lý không?
  - `triage.risk_level` có đang quá hung hăng hoặc quá lỏng không?
  - `delivery.decision` có đúng triết lý reasoning-first rollout không?
- Với event không phải message:
  - có được `ignore` + audit reason rõ ràng không?
- Có field mới nào từ production chưa được normalize / preserve không?
  - ví dụ metadata lạ trong attachment, quick reply payload, referral context, sticker, reaction, reply-to, app metadata

## Khuyến nghị bước tiếp theo khi có sample thật
1. Chạy replay trên sample thô.
2. Ghi lại các field production mới chưa được normalize.
3. Nếu cần, thêm fixture tối giản vào smoke để khóa regression shape mới.
4. Chỉ sau đó mới tune policy / reasoning prompt theo dữ liệu thật.
