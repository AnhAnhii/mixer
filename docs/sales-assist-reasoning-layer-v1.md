# Sales-assist reasoning layer v1 cho Mixer

## Mục tiêu sprint 1 giờ
Tạo một lớp suy luận bán hàng đủ thực dụng để bot không chỉ trả lời FAQ, mà còn:
- nhận ra **buyer intent** trong inbox
- hỏi thêm đúng dữ kiện để hiểu nhu cầu
- đề xuất **hướng chốt đơn an toàn**
- không bịa thông tin sản phẩm / tồn kho / giá / ưu đãi

Lớp này là **reasoning contract** cho AI draft và triage, chưa bắt buộc thay pipeline chính ngay.

---

## 1) North star
Bot phải hành xử như một nhân sự sales-assist cẩn thận:
1. Hiểu khách đang ở giai đoạn nào của hành trình mua
2. Ưu tiên kéo hội thoại về **nhu cầu cụ thể**
3. Chỉ chốt khi có đủ dữ liệu thật
4. Nếu thiếu dữ liệu catalog / tồn kho / biến thể / giá / chương trình hiện hành thì **hỏi tiếp hoặc handoff**, không đoán

---

## 2) Framework đề xuất: Intent -> Need -> Fit -> Close -> Guard
Đây là framework ngắn, hợp với inbox fanpage hơn kiểu script dài.

### A. Intent
Phân loại tín hiệu mua hàng hiện tại của khách.

**Các intent chính đề xuất cho v1:**
- `browse_general`: hỏi vu vơ, đang xem thử
- `product_discovery`: muốn tìm sản phẩm phù hợp nhu cầu
- `variant_check`: hỏi size / màu / mẫu / phiên bản
- `price_promo_check`: hỏi giá / deal / combo / freeship / ưu đãi
- `availability_check`: hỏi còn hàng không
- `purchase_ready`: có dấu hiệu muốn đặt ngay
- `comparison_help`: đang phân vân giữa 2+ lựa chọn
- `fit_consultation`: cần tư vấn theo nhu cầu sử dụng / body / hoàn cảnh
- `trust_barrier`: còn lăn tăn về chất lượng, chính sách, độ uy tín
- `post_purchase_ops`: trạng thái đơn / đổi trả / khiếu nại (không thuộc sales-close, ưu tiên handoff)

### B. Need
Nếu intent có giá trị mua hàng nhưng dữ liệu chưa đủ, bot phải hỏi **1-2 câu ngắn nhất có thể** để mở khóa tư vấn.

**Nhóm dữ liệu cần gom:**
- sản phẩm khách đang nhắm tới là gì
- mục đích sử dụng / dịp dùng
- ràng buộc chính: size, màu, ngân sách, thời gian cần hàng
- mức độ sẵn sàng mua: xem thử / cân nhắc / muốn chốt hôm nay

**Nguyên tắc hỏi:**
- chỉ hỏi câu cần thiết nhất cho bước tiếp theo
- tránh dồn 4-5 câu một lúc
- nếu khách đã rất nóng mua, ưu tiên hỏi dữ kiện chốt đơn trước

### C. Fit
Sau khi hiểu nhu cầu, bot phải chọn 1 trong 3 hướng:
- `recommend`: gợi ý phương án phù hợp nhất
- `narrow_down`: rút gọn lựa chọn nếu khách đang mơ hồ
- `qualify_for_handoff`: nếu cần dữ liệu live mà bot không có

**Logic fit nên bám:**
- nêu vì sao gợi ý này hợp nhu cầu
- nếu chưa chắc vì thiếu dữ liệu, nói rõ còn thiếu gì
- không khẳng định "mẫu này chắc chắn còn" hoặc "đang giảm giá" khi không có nguồn thật

### D. Close
Chốt đơn trong inbox không nhất thiết là “ép mua”, mà là đẩy khách sang bước ra quyết định.

**Close actions cho v1:**
- `soft_close`: mời khách gửi nhu cầu còn thiếu để tư vấn tiếp
- `choice_close`: đưa 1-2 hướng chọn rõ ràng
- `urgency_close`: nhắc giữ hàng / kiểm tra nhanh khi khách đã muốn mua, nhưng chỉ khi có dữ liệu thật
- `order_capture`: xin thông tin cần thiết hoặc chuyển cho người phụ trách chốt đơn
- `handoff_close`: báo sẽ nhờ nhân sự kiểm tra tồn kho / giá / ưu đãi / mã hàng ngay

### E. Guard
Mọi bước trên đều bị chặn nếu đụng dữ liệu chưa được grounding.

---

## 3) Buyer intent signals thực dụng
Dùng các dấu hiệu này cho reasoning layer hoặc enrich triage sau này.

### Mức nóng thấp
- “shop có bán ... không”
- “mẫu nào hợp ...”
- “cho mình xin mẫu / ảnh / bảng size”

### Mức nóng trung bình
- “mình cao ... nặng ... mặc size nào”
- “mẫu này khác mẫu kia sao”
- “giá bao nhiêu / có deal gì không”
- “còn màu ... không”

### Mức nóng cao
- “chốt mẫu này”
- “đặt sao bạn”
- “lấy 1 cái size M”
- “ib mình giá + phí ship để mình ck”
- “còn hàng không để mình đặt luôn”

### Tín hiệu cản trở chốt
- hỏi đi hỏi lại về chất lượng
- nghi ngờ size / form / hợp nhu cầu hay không
- sợ giao chậm
- cần so sánh nhiều mẫu
- đòi thông tin live mà grounding chưa có

---

## 4) Reasoning contract đề xuất
Output của sales-assist layer v1 nên có cấu trúc như sau:

```json
{
  "buyer_stage": "discover|consider|ready_to_buy|post_purchase",
  "buyer_intent": "product_discovery",
  "intent_confidence": 0.82,
  "need_slots": {
    "product_name": null,
    "category": null,
    "use_case": "đi làm / đi chơi / tập luyện / quà tặng",
    "size": null,
    "color": null,
    "budget": null,
    "timeline": null
  },
  "missing_slots": ["product_name", "size"],
  "sales_strategy": "ask_need_then_recommend",
  "close_path": "soft_close",
  "reply_goal": "lấy thêm dữ kiện để tư vấn đúng",
  "allowed_claims": ["support_hours", "shipping_eta_general"],
  "required_grounding": ["catalog", "size_guide", "inventory", "pricing"],
  "guard_flags": ["inventory_unverified"],
  "needs_human": true
}
```

### Các `sales_strategy` nên có
- `ask_need_then_recommend`
- `recommend_best_fit`
- `compare_options`
- `handle_objection_then_close`
- `capture_order_intent`
- `handoff_for_live_check`

### Các `close_path` nên có
- `soft_close`
- `choice_close`
- `order_capture`
- `handoff_close`
- `no_close_support_only`

---

## 5) Playbook theo tình huống

### 5.1 Khách hỏi chung chung, chưa rõ mặt hàng
**Ví dụ:** “shop tư vấn giúp mình với”  
**Mục tiêu:** mở nhu cầu thật nhanh

**Reasoning:**
- chưa nên nhảy vào giới thiệu bừa
- phải hỏi 1 câu neo vào use case hoặc loại sản phẩm

**Reply shape:**
- xác nhận sẵn sàng hỗ trợ
- hỏi 1 câu định hướng: đang tìm đồ cho nhu cầu nào / mẫu nào / khoảng giá nào

---

### 5.2 Khách hỏi size / độ hợp
**Ví dụ:** “1m62 52kg mặc size nào”  
**Mục tiêu:** giảm rào cản ra quyết định

**Reasoning:**
- đây là tín hiệu mua khá mạnh
- nhưng nếu chưa biết mã sản phẩm / form / bảng size thì không được chốt size bừa

**Reply shape:**
- xin thêm mã/mẫu ảnh hoặc tên sản phẩm
- nếu có size guide thật thì mới gợi ý theo guide
- nếu chưa có guide đáng tin cậy, handoff hoặc nói rõ cần kiểm tra

---

### 5.3 Khách hỏi giá / deal
**Ví dụ:** “mẫu này bao nhiêu”, “có sale không”  
**Mục tiêu:** giữ nhịp mua nhưng không bịa giá

**Reasoning:**
- nếu giá không có trong grounding, phải tránh trả số đoán
- có thể chuyển sang lấy mã/mẫu cụ thể để kiểm tra nhanh

**Reply shape:**
- xin mã / ảnh / tên mẫu
- nếu có pricing thật thì trả giá + điều kiện áp dụng
- nếu không có thì `handoff_close`

---

### 5.4 Khách hỏi còn hàng không
**Ví dụ:** “còn size M màu đen không”  
**Mục tiêu:** tránh claim tồn kho sai

**Reasoning:**
- đây là intent gần chốt đơn
- nhưng tồn kho là dữ liệu live, mặc định không được khẳng định nếu chưa sync

**Reply shape:**
- xin tên/mã sản phẩm nếu chưa có
- nói rõ sẽ kiểm tra nhanh tồn kho giúp
- chuyển `needs_human=true` hoặc chỉ auto khi inventory grounding là live và đáng tin

---

### 5.5 Khách đã muốn chốt
**Ví dụ:** “ok lấy mẫu này”, “đặt luôn giúp mình”  
**Mục tiêu:** đưa sang bước capture đơn

**Reasoning:**
- đừng quay lại tư vấn lan man
- cần xác định còn thiếu gì để tạo đơn: mẫu, size, màu, SĐT, địa chỉ, phương thức thanh toán, thời gian nhận mong muốn

**Reply shape:**
- xác nhận khách đang muốn chốt
- xin đúng thông tin còn thiếu
- nếu nội bộ có quy trình chốt riêng, dùng `handoff_close`

---

## 6) Guard bắt buộc để không bịa thông tin

### Không được claim nếu chưa có grounding xác thực
- giá hiện tại
- tồn kho hiện tại
- biến thể còn bán
- khuyến mãi đang chạy
- chất liệu / thông số sản phẩm chi tiết nếu catalog chưa có
- thời gian giao cụ thể theo từng khu vực nếu chưa có rule thật
- chính sách đổi trả vượt ngoài policy đã xác nhận

### Nếu thiếu dữ liệu, ưu tiên theo thứ tự
1. hỏi thêm dữ kiện từ khách
2. dùng claim mức an toàn cao (ví dụ khung giờ hỗ trợ, ETA chung nếu có policy)
3. handoff cho người

### Guard wording nên dùng
- “mình cần kiểm tra lại mã này giúp bạn”
- “để mình/đội mình check nhanh tồn kho hiện tại”
- “nếu bạn gửi mình ảnh hoặc mã mẫu, mình định hướng nhanh hơn”

### Guard wording không nên dùng
- “còn nha” khi chưa check tồn
- “size này chắc vừa” khi chưa có bảng size đúng mẫu
- “đang sale 20%” khi không có nguồn thật
- “mai nhận được” nếu chưa có policy đủ chắc

---

## 7) Mapping nhanh sang pipeline hiện tại
Pipeline hiện tại đang mạnh ở `faq + support guard`, chưa có lớp sales reasoning rõ ràng.

### Có thể giữ nguyên trước mắt
- `classify.js`: tiếp tục làm triage an toàn
- `guard.js`: tiếp tục giữ quyền chặn auto-send
- `ai-draft.js`: vẫn là nơi sinh draft

### Chỗ nên mở rộng ở bước sau
- thêm `buyer_intent` và `buyer_stage` vào grounded input
- thêm knowledge bank cho sales facts / objection handling / slot prompts
- thêm rule phân biệt `availability_check`, `price_promo_check`, `purchase_ready`, `fit_consultation`
- thêm decision “ask_to_clarify_for_sale” thay vì gom hết vào unknown/handoff

---

## 8) Dữ liệu tối thiểu cần có để sales layer hữu ích
Không có các data này thì bot chỉ nên tư vấn định hướng, không nên claim sâu.

### P0 - rất cần
- catalog sản phẩm chuẩn hóa: tên, mã, category, mô tả ngắn
- variant matrix: size, màu, option
- pricing source: giá niêm yết, giá sale, combo
- size guide theo từng dòng sản phẩm
- policy xác nhận: ship, đổi trả, hỗ trợ

### P1 - nên có sớm
- tồn kho live hoặc snapshot đủ mới
- FAQ bán hàng: chất liệu, form, cách chọn size, chăm sóc sản phẩm
- objection bank: xử lý lo ngại thường gặp
- CTA / cách nhận đơn nội bộ

### P2 - tăng lực chốt
- best-seller tags
- mapping nhu cầu -> sản phẩm gợi ý
- bundle / combo rules
- customer segments / returning buyer hints

---

## 9) Rollout khuyến nghị
### Giai đoạn 1
- chỉ dùng sales-assist layer để tạo draft tốt hơn
- chưa auto-send các intent cần dữ liệu live

### Giai đoạn 2
- auto-send có điều kiện cho `product_discovery` và `fit_consultation` mức nhẹ, nếu chỉ đang hỏi nhu cầu và chưa claim dữ liệu live

### Giai đoạn 3
- chỉ mở auto cho `availability_check` / `price_promo_check` khi đã có grounding live đủ đáng tin

---

## 10) Kết luận thực dụng
Nếu muốn đẩy mục tiêu **tư vấn + chốt đơn**, Mixer không nên nhảy thẳng sang “bot chốt sale full”. Bước đúng hơn là:
1. bot nhận ra intent mua
2. bot hỏi gọn để lộ nhu cầu
3. bot gợi ý hướng fit / hướng chốt
4. guard chặn mọi claim chưa được grounding
5. phần live-sensitive chuyển người hoặc hệ thống kiểm tra

Đó là phiên bản v1 đủ an toàn nhưng vẫn tăng tốc bán hàng thực tế.
