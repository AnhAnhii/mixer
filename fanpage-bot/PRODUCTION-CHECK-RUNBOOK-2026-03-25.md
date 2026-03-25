# Production check runbook — 2026-03-25

Mục tiêu: chạy nhanh một vòng validation production sau các commit continuity mới trên `origin/main` (`dbdaefd` → `033cce6`) để xác nhận bot xử lý đúng 4 nhóm case ưu tiên ngoài đời.

## 1) Những thay đổi production-facing mới nhất cần xác nhận

### `dbdaefd` — lock canonical shipping ETA wording
- Shipping ETA phải ra đúng wording chuẩn/canonical, không drift.
- Đây là case low-risk duy nhất trong vòng check này được kỳ vọng vẫn giữ hành vi FAQ an toàn và nhất quán.

### `3e5b9c8` + `789768b` + `033cce6` — pricing continuity / thread fact continuity
- Thread memory được tăng cường để giữ continuity qua follow-up.
- Pricing follow-up mơ hồ kiểu `check giúp mình`, `báo giúp mình`, `vậy shop tư vấn giúp mình` sau một lượt hỏi giá trước đó phải vẫn bám case `pricing_or_promotion` thay vì rơi về `unknown`.
- Khi chưa có grounded product/commercial data, pricing vẫn phải đi đường bảo thủ: hỏi rõ nhu cầu / sản phẩm và giữ `draft_only` hoặc `handoff`, không bịa giá/promo.

### `1668aca`
- Giảm noise debug runtime; production logs nên dễ đọc hơn, nhưng vẫn cần nhìn được decision cuối cùng.

### `c71c561`
- Chủ yếu là housekeeping (`.vercel/output`) + nới assertion smoke local, không thay đổi policy production.

## 2) Test matrix production

### A. Shipping ETA
**Tin nhắn test**
- `shop ơi ship mấy ngày vậy`

**Kỳ vọng production**
- `case_type`: `shipping_eta_general`
- Decision: low-risk FAQ path (`would_auto_send` nếu đang shadow; `auto_send` nếu live-send được bật + allowlist cho phép)
- Reply dùng wording ETA canonical, không đổi ý sang wording lạ.
- Không xin thêm thông tin nếu khách chỉ hỏi ETA chung.

**Fail signs**
- Bị classify thành `unknown` / greeting / pricing.
- Reply drift khỏi wording ETA chuẩn.
- Bị handoff không cần thiết.

---

### B. Pricing follow-up continuity
**Thread setup**
1. Khách hỏi giá/promo mơ hồ hoặc hỏi sản phẩm chưa đủ rõ.
2. Bot/human đã kéo thread vào trạng thái `pricing_or_promotion` và đang chờ khách làm rõ.
3. Khách follow-up bằng câu mơ hồ.

**Tin nhắn test gợi ý**
- lượt 1: `áo này giá sao shop`
- lượt 2: `check giúp mình`

**Kỳ vọng production**
- Lượt 1: `case_type` = `pricing_or_promotion`, không bịa giá.
- Lượt 2: dù classifier thô có thể yếu, pipeline vẫn recover continuity từ thread memory và giữ active case là `pricing_or_promotion`.
- Không rơi về `unknown`.
- Không gọi low-risk auto-reply path.
- Nếu chưa có grounded data: reply tiếp tục xin rõ mẫu/size/link/ảnh hoặc chuyển human follow-up an toàn.

**Fail signs**
- Lượt 2 bị `unknown`.
- Lượt 2 nhảy sang shipping/FAQ khác.
- Bot tự tin báo giá/promo không grounded.

---

### C. Order status follow-up continuity
**Thread setup**
1. Khách hỏi kiểm tra đơn.
2. Bot xin mã đơn hoặc SĐT.
3. Khách gửi thông tin follow-up.

**Tin nhắn test gợi ý**
- lượt 1: `check đơn giúp mình`
- lượt 2: `mã đơn là 123456` hoặc `sđt 09xxxxxxxx`

**Kỳ vọng production**
- Lượt 1: `case_type` = `order_status_request`, decision `handoff` hoặc `draft_only` an toàn, missing info có `order_code` hoặc dữ liệu cần check đơn.
- Thread memory ghi nhận bot đang chờ khách bổ sung info.
- Lượt 2: pipeline vẫn hiểu đây là follow-up của `order_status_request`, không rơi về `unknown`.
- Slot được coi là đã cung cấp/resolved ở thread state; case vẫn nằm trên đường human follow-up, không tự đóng case như đã tra đơn xong.

**Fail signs**
- Lượt 2 bị classify như tin nhắn mới không liên quan.
- Không giữ continuity theo active issue.
- Bị auto-send như FAQ low-risk.

---

### D. Complaint / negative feedback
**Tin nhắn test**
- `ship lâu quá, mình bực mình rồi`
- hoặc `mình nhận hàng lỗi rồi shop`

**Kỳ vọng production**
- `case_type`: `complaint_or_negative_feedback`
- Decision: `handoff` / draft xin lỗi + tiếp nhận, tuyệt đối không auto-send FAQ như shipping bình thường.
- Tone phải hạ nhiệt, thừa nhận vấn đề, mời khách cung cấp thông tin cần thiết nếu phù hợp.

**Fail signs**
- Bị classify thành `shipping_eta_general`.
- Bị auto-reply như FAQ.
- Tone lạnh/cứng hoặc phủ nhận vấn đề.

## 3) Cách chạy vòng check thực dụng

1. Deploy đang ở `origin/main` commit `033cce6`.
2. Với mỗi case, gửi đúng 1 thread test production rõ ràng, không trộn nhiều ý trong cùng thread trừ case continuity.
3. Sau mỗi tin nhắn, ghi lại 3 thứ:
   - customer text
   - observed reply text
   - observed decision / case trong log nếu có
4. Nếu có Vercel log hoặc audit log:
   - xác nhận `triage.case_type`
   - xác nhận `delivery.decision`
   - với continuity cases, xác nhận thread memory giữ `active_issue.case_type` đúng.
5. Nếu một case fail, dừng rollout decision cho case đó và chốt rõ fail ở classifier, fallback draft, hay thread memory recovery.

## 4) Quyết định cuối cùng cần chốt sau vòng check

### Nếu pass toàn bộ
- Giữ production hiện tại cho:
  - `shipping_eta_general` theo wording canonical
  - `pricing_or_promotion` theo đường bảo thủ + continuity recovery
  - `order_status_request` theo continuity/handoff path
  - `complaint_or_negative_feedback` theo hard-stop handoff
- Bước tiếp theo hợp lý: mở rộng validation sang inventory / product consult / richer pricing grounding.

### Nếu chỉ pass shipping + complaint, nhưng continuity còn yếu
- Không mở rộng thêm live behavior cho pricing/order-status.
- Ưu tiên fix thread memory recovery hoặc slot resolution trước vòng production tiếp theo.

### Nếu pricing continuity còn fail
- Ưu tiên audit lại `thread-state.js` + `pipeline.js recoverThreadAwareTriage()` + fallback pricing follow-up rules.
- Không tin vào classifier stateless cho lượt 2; continuity phải được coi là source of truth.

## 5) Minimal evidence cần lưu sau khi test
- 1 screenshot hoặc copy log cho mỗi case.
- 1 bảng kết quả ngắn:
  - case
  - pass/fail
  - observed case_type
  - observed decision
  - note
- Nếu có fail: chốt luôn commit target/fix target cho vòng sau.
