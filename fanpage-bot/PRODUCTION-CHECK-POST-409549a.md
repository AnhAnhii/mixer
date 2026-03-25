# Post-409549a production readiness check

Mục tiêu: sau khi `origin/main` đã ở `409549a`, có một artifact ngắn và thực dụng để validate đúng 3 thay đổi production-facing mới nhất:

- `f147d41` — pricing follow-up: khi khách đã bổ sung mẫu/link/detail, bot phải **acknowledge đã nhận thông tin** thay vì hỏi lại y nguyên
- `409549a` — cross-followup: từ thread shipping FAQ, nếu khách chuyển sang hỏi **đơn cụ thể của mình** thì lane phải **escalate sang `order_status_request`**
- `0e7ab06` — operator readback: helper phải cho readback/reporting gọn, dùng được ngay

## 1) Lệnh nhanh nhất

```bash
cd /root/.openclaw/workspace/mixer/fanpage-bot
npm run production:check -- data/logs/audit.jsonl 120
```

Script hiện đã có thêm 2 lane focus mới:
- `C. Pricing detail acknowledgement`
- `E. Shipping → order follow-up escalation`

Ngoài ra vẫn giữ các lane cũ để không mất coverage cho shipping / order / complaint.

## 2) Test matrix cực ngắn cho vòng này

### A. Pricing detail acknowledgement
**Thread setup**
1. Khách hỏi giá/promo mơ hồ
2. Bot xin mẫu cụ thể / link / ảnh
3. Khách gửi lại chi tiết sản phẩm

**Tin nhắn gợi ý**
- lượt 1: `áo này giá sao shop`
- lượt 2: `mẫu polo basic đen size L nha`

**Pass khi**
- `case_type = pricing_or_promotion`
- decision vẫn là `handoff` hoặc `draft_only`
- reply có ý kiểu:
  - `đã nhận thông tin mẫu...`
  - `để bên em kiểm tra lại giá/ưu đãi...`
- không hỏi lại kiểu `anh/chị gửi tên mẫu/link/ảnh...` nếu khách vừa mới cung cấp đúng detail đó

**Fail signs**
- rơi về `unknown`
- nhảy sang low-risk auto path
- vẫn re-ask `tên mẫu cụ thể hoặc ảnh/link sản phẩm`

---

### B. Shipping → order follow-up escalation
**Thread setup**
1. Khách hỏi shipping FAQ chung
2. Bot trả FAQ shipping ETA bình thường
3. Khách follow-up về **đơn cụ thể của họ**

**Tin nhắn gợi ý**
- lượt 1: `shop ơi ship mấy ngày vậy`
- lượt 2: `còn đơn mình thì bao lâu nhận vậy shop`

**Pass khi**
- active issue trước đó là shipping (`shipping_eta_general` hoặc `shipping_carrier`)
- follow-up mới chuyển lane sang `order_status_request`
- decision là `handoff` hoặc `draft_only`
- bot bắt đầu xin `mã đơn` / dữ liệu tra đơn thay vì tiếp tục trả FAQ ETA chung

**Fail signs**
- vẫn giữ lane shipping FAQ
- bị `auto_send` / `would_auto_send`
- không xin `mã đơn`

---

### C. Operator readback
Không cần gửi message riêng. Chỉ cần chạy helper sau khi log mới đổ về.

**Pass khi**
- output có đủ:
  - `operator_readback[]`
  - `operator_report_lines[]`
  - `report_markdown`
- mỗi lane mới đều có verdict rõ: `pass` / `fail` / `not_observed_yet`
- sample tóm tắt đủ để copy báo cáo nhanh (`customer_text`, `reply_preview`, continuity bits)

## 3) Cách đọc kết quả cho đúng

### `C. Pricing detail acknowledgement`
Muốn tin lane này là pass thì nhìn 3 thứ cùng lúc:
- `observed_case_type = pricing_or_promotion`
- `observed_decision = handoff|draft_only`
- `fail_reasons` **không có**:
  - `pricing_followup_reasked_product_detail`
  - `product_name_still_missing_after_customer_detail`
  - `pricing_acknowledgement_wording_not_observed`

### `E. Shipping → order follow-up escalation`
Muốn tin lane này là pass thì nhìn 3 thứ:
- `active_issue_before = shipping_eta_general|shipping_carrier`
- `observed_case_type = order_status_request`
- `fail_reasons` **không có**:
  - `shipping_thread_did_not_escalate_to_order_status`
  - `order_code_not_requested_after_shipping_to_order_followup`

## 4) Readback mẫu nếu pass

```text
Pricing detail acknowledgement: PASS — vẫn ở pricing_or_promotion / handoff, reply đã acknowledge khách vừa gửi mẫu thay vì hỏi lại.
Shipping -> order escalation: PASS — thread shipping cũ đã chuyển đúng sang order_status_request và bắt đầu xin mã đơn.
Operator readback: PASS — helper trả đủ readback ngắn + report lines + markdown để copy báo cáo.
```

Nếu fail:

```text
Pricing detail acknowledgement: FAIL — khách đã gửi detail sản phẩm nhưng bot vẫn hỏi lại tên mẫu/link; chưa safe để tin lane follow-up này.
Shipping -> order escalation: FAIL — follow-up về đơn cụ thể vẫn bị giữ ở shipping FAQ; continuity escalation chưa ổn.
```

## 5) Gợi ý thao tác thực dụng

1. Gửi 2 thread test đúng như trên, cách nhau vài phút
2. Chạy:
   ```bash
   npm run production:check -- data/logs/audit.jsonl 80
   ```
3. Nếu lane mới ra `not_observed_yet`, tăng cửa sổ lên `120`
4. Nếu ra `fail`, mở `latest_sample` của lane đó trước khi kết luận regression thật

## 6) Vì sao artifact này đáng dùng ngay

Vòng check cũ chủ yếu bảo vệ shipping / pricing continuity / order follow-up / complaint. Sau `f147d41` và `409549a`, thứ đáng kiểm nhất ngoài đời không còn là “bot có trả lời được không” nữa, mà là:
- khách vừa bổ sung detail thì bot có **acknowledge đúng ngữ cảnh** không
- thread shipping cũ có biết **leo sang lane order-specific** đúng lúc không

Artifact này bám đúng 2 điểm đó, nên là vòng readback ngắn nhất và sát production nhất sau `409549a`.
