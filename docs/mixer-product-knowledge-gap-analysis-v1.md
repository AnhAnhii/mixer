# Mixer Fanpage Reply Brain — Product Knowledge Gap Analysis v1

_Date: 2026-03-25_

## 1. Mục tiêu
Audit xem trong workspace hiện tại Rambu **đã có gì** và **còn thiếu gì** để tư vấn + chốt đơn trên Fanpage Mixer tốt hơn theo hướng reasoning-first.

Tài liệu này tập trung vào năng lực bán hàng / tư vấn sản phẩm, không chỉ FAQ vận hành.

---

## 2. Kết luận ngắn gọn
Hiện workspace đã có:
- khung reply brain / case memory / policy memory khá tốt cho **FAQ vận hành**
- model dữ liệu app cho `product`, `variant`, `price`, `stock`, `voucher`, `order`
- sample data UI để demo quản lý kho / đơn / voucher

Nhưng workspace **chưa có knowledge thật đủ để bán hàng tốt**.

Cụ thể: Rambu hiện có thể trả lời khá an toàn các câu như:
- ship mấy ngày
- ship đơn vị nào
- giờ hỗ trợ
- đổi trả / lỗi sản phẩm ở mức policy chung

Rambu **chưa đủ dữ liệu để tư vấn và chốt đơn mạnh** ở các câu như:
- mẫu này chất liệu gì, dày hay mỏng, mặc nóng không
- form rộng hay vừa, cao 1m72 nặng 68kg mặc size gì
- màu nào còn, size nào hết
- áo này khác mẫu kia ở đâu
- giá hiện tại bao nhiêu, có sale/mã giảm giá gì không
- sản phẩm này hợp đi học / đi chơi / mùa nào
- nếu hết size này thì nên đổi sang mẫu nào gần nhất

Nói thẳng: hiện hệ thống có **khung CSKH**, nhưng thiếu **catalog knowledge + selling knowledge + live commercial data**.

---

## 3. Những gì workspace đang có thật

### 3.1. Knowledge vận hành đã có
Nguồn đã thấy:
- `scripts/mixer-grounded-ai-data-v1.json`
- `scripts/mixer-knowledge-base-v0.json`
- `fanpage-bot/knowledge/policy-bank.json`
- `fanpage-bot/knowledge/case-bank.json`
- `scripts/reasoning-playbook-v1.md`

Coverage hiện có:
- support hours
- shipping ETA chung
- carrier
- return / defect policy
- order lookup requirements
- một phần triage risk cho order, complaint, stock, pricing

### 3.2. Data model/app fields đã có nhưng chưa được nạp thành knowledge bán hàng
Nguồn đã thấy:
- `mixer/types.ts`
- `mixer/components/ProductForm.tsx`
- `mixer/components/VoucherForm.tsx`
- `mixer/data/sampleData.ts`

Trường hiện có trong app:
- Product: `name`, `price`, `costPrice`, `description`, ảnh
- Variant: `size`, `color`, `stock`, `lowStockThreshold`
- Voucher: `code`, `discountType`, `discountValue`, `minOrderValue`, `isActive`
- Order: `paymentMethod`, `discount`, `shippingProvider`, `trackingCode`

Ý nghĩa:
- Hệ thống **có chỗ chứa** dữ liệu thương mại cơ bản
- Nhưng knowledge bot hiện tại **chưa có lớp canonical để đọc / reasoning / trả lời** từ các dữ liệu này

### 3.3. Dữ liệu hiện có nhưng không nên xem là knowledge thật
- `mixer/data/sampleData.ts` chỉ là sample/demo
- sample products hiện là generic/fake catalog, không phải catalog thật của Mixer
- sample inventory / orders / vouchers cũng không nên dùng để tư vấn khách thật

---

## 4. Gap analysis theo nhóm năng lực

## 4.1. P0 — Live commercial facts để trả lời câu chốt đơn
Đây là nhóm thiếu lớn nhất.

### Thiếu gì
1. **Catalog sản phẩm thật**
   - product_id / product_slug / tên hiển thị chuẩn
   - trạng thái active / hidden / archive
   - link ảnh chuẩn / link PDP / link bài post nếu có

2. **Variant thật**
   - variant_id / SKU
   - màu
   - size
   - barcode/SKU nội bộ nếu team dùng

3. **Giá bán hiện tại**
   - giá niêm yết
   - giá đang áp dụng
   - có đang sale không
   - thời điểm hiệu lực

4. **Tồn kho khả dụng**
   - stock theo từng variant
   - reserved / available nếu có tách
   - last_updated_at

5. **Voucher / promo hiện hành**
   - mã nào đang active
   - điều kiện đơn tối thiểu
   - áp dụng cho toàn shop hay SKU cụ thể
   - ngày bắt đầu / kết thúc

### Tại sao critical
Nếu thiếu nhóm này, bot không thể chốt đơn tốt vì các câu có purchase intent cao thường xoay quanh:
- còn size không
- giá nhiêu
- đang có ưu đãi gì
- mẫu nào hợp ngân sách này

### Tác động hiện tại
- `stock_or_product_availability` phải handoff là đúng, nhưng làm giảm tốc độ chốt đơn
- `pricing_or_promotion` mới ở mức draft_only vì chưa có dữ liệu current đáng tin

---

## 4.2. P0 — Product attributes để tư vấn như nhân viên bán hàng thật
### Thiếu gì
1. **Chất liệu / composition**
   - cotton / nỉ / dù / kaki / denim...
   - tỷ lệ chất liệu nếu có
   - độ dày / co giãn / bề mặt / cảm giác mặc

2. **Form / fit**
   - regular / oversize / slim / boxy...
   - rộng hay vừa so với form thường
   - unisex / nam / nữ nếu có

3. **Size guide chuẩn hóa**
   - bảng size theo số đo cơ thể / số đo áo
   - chiều cao / cân nặng tham khảo
   - lưu ý fit rộng/chật
   - quy tắc khi đứng giữa 2 size

4. **Use case / style positioning**
   - mặc đi học / đi làm / đi chơi / layering / mùa lạnh...
   - item nào basic, item nào nổi bật

5. **Care instructions**
   - giặt máy hay tay
   - có dễ nhăn / xù / ra màu không
   - lưu ý sấy / ủi

### Tại sao critical
Đây là phần tạo khác biệt giữa:
- bot chỉ “trả lời câu hỏi”
- và bot “tư vấn để khách mua”

Một nhân viên chốt đơn giỏi thường thắng ở các câu:
- anh mặc 1m70 65kg nên lấy size nào
- mẫu này chất có nóng không
- áo này form ôm hay rộng
- nếu thích mặc thoải mái thì tăng size không

### Dấu hiệu thiếu trong workspace
- `Product.description` có tồn tại nhưng chỉ là field tự do, chưa có schema knowledge
- chưa thấy canonical size chart / fit notes / material notes / care notes cho catalog thật
- có file ảnh `edited-size-chart-no-xl.jpg` nhưng chưa thấy mapping rõ vào product knowledge dùng được cho bot

---

## 4.3. P1 — Product FAQ & objection handling
### Thiếu gì
1. FAQ theo từng product line / collection
   - có ra màu không
   - có nhăn không
   - có túi không
   - có lót không
   - dày/mỏng mức nào
   - có phù hợp thời tiết nóng không

2. FAQ theo nhóm nhu cầu
   - mặc đi gym / đi học / đi chơi được không
   - người mập/bụng to/vai rộng nên chọn form nào
   - da nhạy cảm mặc có ổn không (nếu có cơ sở)

3. Objection handling đã grounded
   - giá hơi cao → phản hồi theo value nhưng không sáo rỗng
   - phân vân size → xin số đo đúng cách
   - hết màu/hết size → gợi ý phương án thay thế

4. Comparison knowledge
   - mẫu A khác mẫu B ở form, chất, vibe, giá như nào
   - item thay thế gần nhất khi variant hết

### Tại sao quan trọng
Chốt đơn thường chết ở đoạn khách do dự, không phải ở đoạn hỏi policy.

---

## 4.4. P1 — Operational selling flow knowledge
### Thiếu gì
1. **Thông tin cần xin khi khách muốn đặt hàng qua inbox**
   - tên người nhận
   - SĐT
   - địa chỉ
   - sản phẩm + màu + size + số lượng
   - hình thức thanh toán

2. **Payment guidance thật, canonical**
   - COD có áp dụng mọi đơn không
   - chuyển khoản áp dụng thế nào
   - giữ đơn trong bao lâu
   - xác nhận bill ra sao

3. **Order capture rules**
   - khi nào đủ info để tạo đơn
   - khi nào cần confirm lại size/màu
   - khi nào nên upsell thêm item / voucher

4. **Reservation / giữ hàng / ưu tiên thanh toán**
   - có giữ hàng không
   - giữ bao lâu
   - có giữ theo bill/CK không

### Tín hiệu hiện có
- `mixer/hooks/useFacebookMessenger.ts` có message cho COD/chuyển khoản
- có thông tin QR / bank flow trong app

### Nhưng vẫn thiếu
- chưa có canonical bank/payment policy file cho bot reasoning
- chưa có standardized “order capture checklist” làm knowledge
- chưa có rules rõ để bot biết khi nào được coi là đủ thông tin chốt đơn

---

## 4.5. P1 — Data freshness / source-of-truth governance
### Thiếu gì
1. **Source of truth rõ ràng cho product/inventory/pricing/promo**
2. **timestamp / last_updated_at** cho dữ liệu bot dùng
3. **confidence + stale handling rule**
4. **mapping giữa app data và fanpage-bot knowledge**

### Vì sao quan trọng
Có data mà không có freshness rule vẫn nguy hiểm:
- bot báo còn hàng nhưng data cũ
- bot báo còn mã giảm giá nhưng voucher đã tắt
- bot báo giá cũ sau khi sale đổi

---

## 4.6. P2 — Rich customer-facing recommendation knowledge
### Thiếu gì
1. product tags / style tags
2. seasonal tags
3. budget bands
4. cross-sell / bundle suggestions
5. best-seller / new arrival / restock labels

### Giá trị
Giúp bot không chỉ trả lời mà còn gợi ý mua thêm, thay thế thông minh.

---

## 5. Bảng đánh giá coverage hiện tại

| Nhóm knowledge | Tình trạng hiện tại | Dùng để auto tư vấn/chốt đơn được chưa? | Ghi chú |
|---|---|---:|---|
| Shipping/support/return policy | Có cơ bản | Một phần | Khá ổn cho FAQ low-risk |
| Order lookup requirements | Có | Có cho intake/handoff | Chưa có integration tra cứu thật |
| Product catalog thật | Gần như chưa có | Chưa | Sample data không dùng được |
| Variant SKU thật | Chưa | Chưa | Thiếu mapping variant rõ ràng |
| Live inventory | Chưa | Chưa | Đây là blocker lớn |
| Current pricing | Chưa ở knowledge layer | Chưa | App có field nhưng chưa có canonical feed |
| Promo/voucher current | Chưa ở knowledge layer | Chưa | App có model nhưng chưa có nguồn thật |
| Material/form/fit | Chưa | Chưa | Blocker lớn cho tư vấn bán hàng |
| Size guide chuẩn | Chưa đủ cấu trúc | Chưa | Có dấu hiệu tồn tại rời rạc nhưng chưa usable |
| Product FAQ | Chưa | Chưa | Cần cho objection handling |
| Payment/order capture rules | Rời rạc | Chưa ổn | Có tín hiệu trong app nhưng chưa chuẩn hóa |
| Product comparison / alternatives | Chưa | Chưa | Hữu ích mạnh cho chốt đơn |

---

## 6. Top gaps cần nhìn nhận thẳng

### Gap 1 — Không có catalog knowledge thật cho bot
Workspace chưa có một file canonical kiểu “đây là danh sách sản phẩm thật, variant thật, giá thật, trạng thái thật”.

### Gap 2 — Không có size/material/fit knowledge để tư vấn bán hàng
Đây là khoảng thiếu lớn nhất nếu mục tiêu là “tư vấn như nhân viên giỏi”, vì khách hỏi nhiều nhất quanh size, form, chất liệu.

### Gap 3 — Không có live inventory + pricing + promo feed đáng tin
Không có lớp dữ liệu current thì bot khó chốt đơn an toàn.

### Gap 4 — Payment/order-capture knowledge còn nằm rải rác trong UI logic
Có message flow nhưng chưa được canonical hóa thành brain memory.

### Gap 5 — Chưa có freshness/governance rule cho commercial data
Sau này có data mà không có `last_updated_at`, `source`, `confidence`, `stale_after` thì vẫn dễ trả lời sai.

---

## 7. Khuyến nghị ưu tiên nạp knowledge

## Ưu tiên 1 — Tạo canonical product sales knowledge source
Nạp một nguồn canonical cho bot, tối thiểu gồm:
- product
- variant
- size
- color
- price_current
- stock_available
- last_updated_at
- active

Nguồn có thể là:
- export từ app / DB
- Google Sheet chuẩn hóa
- JSON build step sinh ra từ source nội bộ

## Ưu tiên 2 — Nạp size/material/fit notes theo product line
Tối thiểu cho mỗi product hoặc collection:
- material_summary
- fit_summary
- size_advice_rules
- care_notes
- faq snippets grounded theo thực tế

## Ưu tiên 3 — Nạp promo/voucher current
Tách riêng data khuyến mãi để bot không phải suy diễn từ câu chữ marketing.

## Ưu tiên 4 — Chuẩn hóa order-capture & payment knowledge
Tạo file riêng cho:
- required fields để lên đơn
- COD / chuyển khoản
- giữ đơn / xác nhận bill
- escalation rule khi khách muốn sửa/hủy

## Ưu tiên 5 — Thêm freshness + uncertainty handling
Mọi commercial fact nên có:
- `source`
- `last_updated_at`
- `confidence`
- `stale_after_minutes` hoặc `is_live`

---

## 8. Đề xuất ingestion roadmap rất thực dụng

### Phase A — đủ để bot trả lời câu mua hàng cơ bản
Nạp trước:
- product master
- variants
- live/current price
- live/current stock
- active vouchers

### Phase B — đủ để bot tư vấn size/chất liệu tốt hơn
Nạp thêm:
- material
- fit
- size chart / size advice
- care notes
- product FAQs

### Phase C — đủ để bot gợi ý và upsell
Nạp thêm:
- alternative products
- cross-sell/bundle
- style tags / use case tags
- best seller / new arrival flags

---

## 9. Đề xuất mapping knowledge layer

### Nên tách ít nhất 4 lớp
1. `policy-bank.json`
   - shipping, return, support, complaint constraints

2. `product-sales-knowledge.json`
   - catalog + product/variant/commercial knowledge

3. `payment-order-ops-knowledge.json`
   - order capture, payment, holding, confirmation rules

4. `response-pattern-bank.json`
   - chỉ là phrasing support, không chứa truth source

---

## 10. Thực tế nhất cho sprint kế tiếp
Nếu chỉ có thêm 1 giờ nữa, việc đáng làm nhất không phải viết thêm pattern trả lời, mà là:
1. chốt schema canonical cho product-sales knowledge
2. xác định source thật để đổ dữ liệu vào
3. nạp thử 3-5 SKU thật đầu tiên
4. test các câu hỏi mua hàng phổ biến quanh size / giá / tồn / promo

---

## 11. Artifact đi kèm
Tài liệu này đi kèm skeleton file:
- `fanpage-bot/knowledge/product-sales-knowledge-skeleton-v1.json`

Mục đích:
- không bịa dữ liệu sản phẩm
- chỉ định nghĩa cấu trúc tối thiểu + metadata freshness + cách mapping source
- sẵn sàng cho bước nạp data thật sau
