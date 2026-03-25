# Next production readback — ready-to-run

Mục tiêu của file này: khi Vercel/audit log mới đổ về sau commit `6941b67`, có thể đọc rất nhanh và chốt ngay 4 lane quan trọng:
- shipping pass/fail
- pricing follow-up continuity pass/fail
- order follow-up continuity pass/fail
- complaint continuity/tone pass/fail

## 1) Lệnh đọc nhanh nhất

Từ repo deploy `mixer/`:

```bash
cd /root/.openclaw/workspace/mixer/fanpage-bot
npm run production:check -- data/logs/audit.jsonl 400
```

Nếu chỉ muốn đọc một cửa sổ ngắn ngay sau đợt test mới nhất, giảm `400` xuống `120` hoặc `80`.

## 2) Cách hiểu output

Script giờ trả ra 4 phần chính:
- `overall_pass`: true khi các lane đã quan sát đều pass; lane chưa có evidence sẽ nằm trong `required_retest`
- `lanes[]`: verdict chi tiết cho từng lane
- `quick_table[]`: bảng ngắn để copy vào báo cáo
- `operator_readback[]`: câu readback gọn, đủ để báo người khác

### Status có 3 loại
- `pass`: lane đó đang đúng kỳ vọng
- `fail`: có evidence mới và evidence đó sai kỳ vọng
- `not_observed_yet`: trong cửa sổ log đang scan chưa thấy đúng case đó, cần gửi lại case này ở production

## 3) Lane-by-lane pass/fail rules

### A. Shipping ETA
**Pass khi:**
- `case_type = shipping_eta_general`
- decision nằm trong `would_auto_send | auto_send | draft_only`
- reply vẫn giữ wording canonical Hà Nội / ngoại thành / tỉnh khác

**Fail khi:**
- rơi về `unknown`, `pricing_or_promotion`, hoặc `handoff`
- reply drift khỏi wording canonical

### B. Pricing follow-up continuity
**Pass khi:**
- follow-up kiểu `check giúp mình nha` vẫn giữ `pricing_or_promotion`
- decision vẫn là `handoff` hoặc `draft_only`
- reply vẫn hỏi rõ mẫu/link/ảnh/size thay vì bịa giá

**Fail khi:**
- thread memory trước đang là `pricing_or_promotion` nhưng current record rơi về `unknown`
- nhảy sang low-risk auto path (`would_auto_send` / `auto_send`)

### C. Order status follow-up continuity
**Pass khi:**
- follow-up `sđt ...` hoặc `mã đơn ...` vẫn ở lane `order_status_request`
- decision vẫn `handoff` hoặc `draft_only`
- `asked_slots_after` có slot resolved như `receiver_phone` / `order_code`

**Fail khi:**
- follow-up định danh đi sang lane khác
- không thấy slot resolution cho message kiểu `sđt ...` / `mã đơn ...`
- bị đối xử như low-risk FAQ

### D. Complaint / negative feedback
**Pass khi:**
- `case_type = complaint_or_negative_feedback`
- decision là `handoff` hoặc `draft_only`
- reply có tone xin lỗi / tiếp nhận / mời kiểm tra thêm

**Fail khi:**
- bị classify thành shipping bình thường
- bị auto-send kiểu low-risk FAQ

## 4) Mẫu readback ngắn sau khi scan

```text
Shipping: PASS — shipping_eta_general / auto_send, wording canonical giữ đúng.
Pricing follow-up: PASS — `check giúp mình nha` vẫn bám pricing_or_promotion / handoff.
Order follow-up: PASS — `sđt ...` giữ order_status_request và resolve slot receiver_phone.
Complaint: PASS — complaint_or_negative_feedback / handoff, tone xin lỗi đúng.
```

Nếu fail:

```text
Pricing follow-up: FAIL — thread đang pricing nhưng message follow-up mới rơi về unknown; chưa safe để tin continuity lane này.
```

## 5) Quan sát hiện tại từ audit đang có trong repo

Từ audit log hiện tại của `mixer/fanpage-bot/data/logs/audit.jsonl`:
- shipping: đã có evidence pass lặp lại nhiều lần
- pricing follow-up: đã có cả **fail cũ** (`shop check giúp mình nha` -> `unknown`) lẫn **pass mới** sau fix
- order follow-up: có evidence pass với `sđt 0912 345 678` giữ `order_status_request` + resolve slot
- complaint: có evidence pass rõ

=> Nghĩa là vòng readback kế tiếp nên **ưu tiên nhìn record mới nhất sau test mới**, không kết luận bằng các fail lịch sử cũ.

## 6) Thứ tự thao tác thực dụng khi log mới vào

1. Chạy `npm run production:check -- data/logs/audit.jsonl 120`
2. Nếu lane nào ra `not_observed_yet`, gửi lại đúng tin nhắn test của lane đó
3. Nếu lane nào ra `fail`, mở `latest_sample` của lane đó để xem:
   - `customer_text`
   - `case_type`
   - `decision`
   - `active_issue_before/after`
   - `asked_slots_after`
4. Chỉ khi fail là record mới nhất của đúng case cần test thì mới coi là blocker thực sự

## 7) Tin nhắn test gợi ý cho vòng kế tiếp

- Shipping: `shop ơi ship mấy ngày vậy`
- Pricing continuity thread:
  - lượt 1: `áo này giá sao shop`
  - lượt 2: `check giúp mình nha`
- Order continuity thread:
  - lượt 1: `check đơn giúp mình`
  - lượt 2: `sđt 0912 345 678`
- Complaint: `ship lâu quá, mình bực mình rồi`

## 8) Ghi chú quan trọng

Hiện audit trong repo có nhiều record smoke/replay và lịch sử vòng test trước, nên cửa sổ scan (`80`, `120`, `400`) rất quan trọng. Với vòng production mới, nên đọc cửa sổ nhỏ trước; chỉ mở rộng khi đang điều tra regression cũ/lâu hơn.
