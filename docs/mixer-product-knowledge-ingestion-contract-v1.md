# Mixer Product Knowledge Ingestion Contract v1

_Date: 2026-03-25_

## 1. Mục tiêu
Tài liệu này chốt cách **nạp data thật** vào product knowledge layer cho `fanpage-bot` theo hướng reasoning-first.

Mục tiêu không phải build ETL hoàn chỉnh ngay, mà là tạo một contract đủ thực dụng để:
- biết **nạp từ đâu**
- biết **đổ vào schema canonical nào**
- biết **dữ liệu nào phải tươi**
- biết **P0/P1 nên làm theo thứ tự nào**
- tránh tình trạng có data nhưng bot vẫn không dám trả lời vì thiếu `source`, `timestamp`, hoặc mapping không rõ

---

## 2. Phạm vi knowledge layer
Knowledge layer này phục vụ các năng lực bán hàng / tư vấn / chốt đơn trong inbox Fanpage, tách biệt với policy vận hành chung.

### In scope
- catalog sản phẩm thật
- variant thật (size / màu / SKU)
- giá hiện hành
- tồn kho khả dụng
- promo / voucher hiện hành
- material / fit / size guide / care notes / product FAQ
- alternative / bundle / upsell metadata
- freshness + source governance

### Out of scope cho v1
- đồng bộ realtime 2 chiều
- tự động mutate source system
- order management full flow
- recommendation engine học máy
- product image understanding bằng vision

---

## 3. Source-of-truth model đề xuất
Không cố ép mọi thứ vào 1 nguồn duy nhất. Thực tế hơn là chấp nhận **multi-source with clear ownership**.

## 3.1. Source buckets

### A. Commercial master source (P0)
Nguồn ưu tiên nhất cho fact live:
- DB read replica / SQL export
- admin export CSV/XLSX
- API nội bộ từ hệ thống product / inventory / pricing

Nên cover:
- `products`
- `variants`
- `pricing`
- `inventory`
- `status active/hidden`

### B. Merch / ops enrichment source (P0-P1)
Nguồn cho dữ liệu tư vấn mà DB thường không đủ sạch:
- Google Sheet / Airtable / Notion export / CSV curated bởi merch team

Nên cover:
- `material_summary`
- `fit_summary`
- `size_guide`
- `care_guide`
- `faq`
- `comparison_notes`
- `alternatives`
- `bundle_candidates`
- `upsell_notes`

### C. Promotion source (P0)
Nguồn riêng cho voucher / promo hiện hành:
- voucher DB/export
- marketing promo sheet
- internal pricing API

Nên cover:
- `promo_id`
- `voucher_code`
- `discount_type`
- `discount_value`
- `applies_to`
- `start_at`, `end_at`
- `stacking_rule`

### D. Manual override source (P1)
Nguồn nhỏ, được review kỹ, để override một số field có tính customer-facing:
- curated JSON/YAML trong repo
- reviewed sheet riêng cho bot

Chỉ nên dùng cho:
- override wording / display name / fit note rõ ràng
- temporary hotfix khi source chính bị lỗi

Không nên dùng cho:
- inventory live
- pricing live
- promo live

---

## 4. Canonical schema contract
Canonical target hiện bám theo:
- `fanpage-bot/knowledge/product-sales-knowledge-skeleton-v1.json`

### 4.1. Top-level entities
- `products[]`
- `promotions[]`
- `order_capture_rules`
- `sales_reasoning_hints`

### 4.2. Canonical identity rules
Mọi product knowledge record phải có định danh ổn định:

#### Product level
- `product_id`: khóa canonical nội bộ, không đổi theo thời gian
- `product_slug`: slug customer-facing nếu có
- `display_name`: tên hiển thị chuẩn cho bot dùng khi reply
- `status`: `draft|active|archived|hidden`
- `active`: boolean vận hành nội bộ
- `visible_in_sales`: boolean cho phép bot đưa vào tư vấn

#### Variant level
- `variant_id`: khóa canonical cho từng biến thể
- `sku`: mã vận hành ưu tiên cao nhất nếu có
- `label`: nhãn gộp dễ đọc, ví dụ `Đen / M`
- `color`, `size`: normalized string
- `visibility.active`, `visibility.allow_sale`

### 4.3. Canonical commercial fields
#### Pricing
Ít nhất phải có:
- `current_price`
- `currency`
- `effective_from`
- `effective_to` (nullable)
- `source`
- `last_updated_at`

#### Inventory
Ít nhất phải có:
- `available`
- `reserved` (nullable nếu source không có)
- `status`: `in_stock|low_stock|out_of_stock|unknown`
- `last_updated_at`
- `source`

### 4.4. Canonical advisory fields
Các field này có thể đến từ sheet curated, nhưng phải có metadata:
- `confidence`
- `source`
- `last_updated_at`

Áp dụng cho:
- `material_summary`
- `fit_summary`
- `size_guide`
- `care_guide`
- từng item trong `faq[]`

### 4.5. Source metadata tối thiểu bắt buộc
Mọi field quan trọng để bot claim với khách phải truy ngược được nguồn.

Tối thiểu mỗi group record cần:
- `source`: tên source logic, ví dụ `erp_export_daily`, `merch_sheet_manual`, `promo_api`
- `last_updated_at`: timestamp UTC ISO-8601
- `owner`: team/người chịu trách nhiệm review nếu phù hợp

---

## 5. Freshness rules
Không phải field nào cũng cần độ tươi như nhau.

## 5.1. Freshness tiers

### Tier A — Live-sensitive, stale rất nguy hiểm
Áp dụng cho:
- inventory
- current pricing
- active promotion / voucher

Rule đề xuất:
- inventory: stale sau `30-120 phút` tùy cách export
- pricing: stale sau `6-24 giờ`
- promotions: stale sau `30-120 phút` nếu promo thay đổi nhiều; nếu ít thay đổi thì `6 giờ`

Nếu stale:
- không auto-claim mạnh
- downgrade sang `draft_only` hoặc `handoff`
- wording phải thể hiện “đang kiểm tra lại”

### Tier B — Semi-stable advisory facts
Áp dụng cho:
- material
- fit
- size guide
- care guide
- product FAQ grounded

Rule đề xuất:
- stale sau `7-30 ngày`
- cần review lại khi có restock batch mới, đổi supplier, hoặc chỉnh form

Nếu stale:
- vẫn có thể dùng để draft thận trọng nếu confidence cao
- nhưng nên kèm soft hedge nếu source cũ
- nếu liên quan size hoặc fit rất sát quyết định mua, cân nhắc xin thêm ảnh/mã hoặc handoff

### Tier C — Slow-changing metadata
Áp dụng cho:
- tags
- collection
- styling use cases
- alternatives
- bundle candidates

Rule đề xuất:
- stale sau `30-90 ngày`
- cho phép tiếp tục dùng lâu hơn nếu owner chưa update, miễn không mâu thuẫn source khác

---

## 6. Normalization rules

## 6.1. IDs and joins
- Mọi source input phải map được về `product_id` hoặc `variant_id`
- Nếu source merch chỉ có `sku`, ingestion phải lookup ra `variant_id`
- Nếu source sheet chỉ có `product_name`, phải có bảng alias hoặc mapping thủ công trước khi merge
- Không merge fuzzy không kiểm soát vào production knowledge

## 6.2. Status normalization
Nguồn thô có thể có nhiều trạng thái như `published`, `enabled`, `inactive`, `archived`.
Canonical hóa về:
- product: `draft|active|archived|hidden`
- inventory status: `in_stock|low_stock|out_of_stock|unknown`

## 6.3. Size normalization
Chuẩn hóa size về string rõ ràng:
- `S`, `M`, `L`, `XL`, `2XL`...
- nếu có số: `28`, `29`, `30`...
- không trộn `Extra Large`, `XL`, `X-Large` thành nhiều dạng khác nhau

Nên có map chuẩn ở ingestion layer.

## 6.4. Color normalization
- giữ `color` là label customer-facing, ví dụ `đen`, `trắng`, `xám`
- nếu source có color code nội bộ, lưu vào `attributes` thay vì thay cho `color`

## 6.5. Currency and timezone
- `currency = VND`
- timestamp lưu UTC ISO-8601
- business interpretation có thể dùng timezone `Asia/Ho_Chi_Minh`

---

## 7. Merge precedence rules
Khi nhiều nguồn ghi đè lên cùng một fact, dùng thứ tự ưu tiên rõ ràng.

### 7.1. Identity + active status
Ưu tiên:
1. commercial master source
2. manual override reviewed

### 7.2. Inventory / pricing / promo
Ưu tiên:
1. live API / latest DB export
2. admin export cùng ngày
3. manual override chỉ để emergency patch, phải có expiry

### 7.3. Material / fit / size / FAQ
Ưu tiên:
1. merch curated source reviewed
2. product detail export có cấu trúc
3. manual override reviewed
4. raw free-text description chỉ dùng để seed, không dùng trực tiếp làm truth nếu chưa review

---

## 8. Data source candidates cho Mixer
Đây là danh sách pragmatic, không giả định chắc chắn hệ thống nào đang tồn tại, nhưng đủ để team bám vào khi bắt đầu nạp thật.

## 8.1. Candidate source table

| Domain | Source candidate | Format | Priority | Notes |
|---|---|---|---:|---|
| Product master | DB export / admin export | CSV/XLSX/SQL/API | P0 | Nguồn chính cho product + variant IDs |
| Variant inventory | inventory export / stock API | CSV/API | P0 | Cần `available` + `last_updated_at` |
| Price list | pricing export / product DB | CSV/API | P0 | Cần current price + effective dates |
| Promotions | voucher DB/export / promo sheet | CSV/API/Sheet | P0 | Cần active window + scope |
| Material/Fit | merch sheet | Sheet/CSV | P0-P1 | Dữ liệu tư vấn bán hàng quan trọng |
| Size guide | size chart sheet / curated table | Sheet/CSV/JSON | P0-P1 | Không nên để rải rác trong ảnh đơn lẻ |
| Care/FAQ | merch or CS notes export | Sheet/MD/CSV | P1 | Chỉ nạp fact đã review |
| Alternatives/upsell | merch curated sheet | Sheet/CSV | P1 | Dùng sau khi base catalog ổn |

## 8.2. Nếu chỉ có DB/export thô ban đầu
Vẫn triển khai được P0 nếu trước mắt chỉ nạp:
- product master
- variants
- inventory
- pricing
- promotions

Còn `material/fit/size` có thể đi bằng sheet curated song song.

---

## 9. P0 / P1 ingestion roadmap

## 9.1. P0 — unlock basic selling facts
Mục tiêu: bot trả lời an toàn hơn cho các câu hỏi gần chốt đơn.

### P0.1 Product + variant master
Nạp:
- `product_id`, `product_slug`, `display_name`, `category`, `collection`
- `variant_id`, `sku`, `color`, `size`, `visibility`

Done khi:
- mọi variant sellable đều map được vào product canonical
- không còn dùng sample/fake data trong knowledge layer

### P0.2 Current pricing
Nạp:
- `current_price`
- `compare_at_price` nếu có
- `effective_from`, `effective_to`
- `last_updated_at`, `source`

Done khi:
- bot có thể grounded câu hỏi “mẫu này bao nhiêu” nếu product/variant xác định được và record chưa stale

### P0.3 Inventory snapshot/live feed
Nạp:
- `available`
- `reserved` nếu có
- `status`
- `last_updated_at`, `source`

Done khi:
- bot có thể grounded câu “còn size M màu đen không” ở mức draft/handoff có căn cứ
- nếu freshness đủ tốt, có thể cân nhắc rollout auto cho một số flow sau này

### P0.4 Promotions / vouchers current
Nạp:
- promo active
- voucher code
- scope áp dụng
- min order value
- start/end

Done khi:
- bot không còn phải nói mơ hồ với câu “có sale/mã giảm giá gì không”

### P0.5 Size guide foundation
Dù advisory, phần này nên chen vào cuối P0 vì ảnh hưởng cực mạnh tới chốt đơn.

Nạp tối thiểu:
- `size_system`
- `sizes[]`
- `height_weight_rules[]` hoặc body/garment measurements
- `between_two_sizes_rule`
- `source`, `confidence`, `last_updated_at`

Done khi:
- bot biết rõ khi nào đủ căn cứ để tư vấn size và khi nào phải xin thêm mã/mẫu

---

## 9.2. P1 — upgrade from FAQ seller to strong sales assist

### P1.1 Material + fit summaries
Nạp:
- `primary_material`
- composition nếu có
- texture / thickness / stretch / breathability
- `fit_type`, `fit_vs_standard`, `styling_use_cases`

### P1.2 Care guide + grounded product FAQ
Nạp:
- washing / drying / ironing notes
- FAQs kiểu nóng không, có nhăn không, mặc đi đâu hợp

### P1.3 Alternatives + comparison notes
Nạp:
- `comparison_notes`
- `alternatives`
- `bundle_candidates`
- `upsell_notes`

### P1.4 Order capture ops knowledge alignment
Không nằm hoàn toàn trong product catalog nhưng nên khóa song song:
- field nào đủ để nhận đơn
- field nào cần confirm lại
- COD/chuyển khoản/giữ hàng

---

## 10. Ingestion pipeline shape đề xuất

## 10.1. Bronze / Silver / Gold đơn giản
Không cần data warehouse thật, nhưng nên giữ tư duy 3 lớp:

### Bronze — raw dumps
Ví dụ:
- `data-ingestion/raw/products_2026-03-25.csv`
- `data-ingestion/raw/inventory_2026-03-25.csv`
- `data-ingestion/raw/merch_sheet_2026-03-25.xlsx`

### Silver — normalized intermediates
Ví dụ:
- `data-ingestion/normalized/products.json`
- `data-ingestion/normalized/variants.json`
- `data-ingestion/normalized/size-guides.json`

### Gold — bot-ready canonical knowledge
Ví dụ:
- `fanpage-bot/knowledge/product-sales-knowledge-v1.json`
- `fanpage-bot/knowledge/payment-order-ops-knowledge-v1.json`

## 10.2. Practical rule
- raw phải giữ nguyên để debug
- normalized để nhìn mapping dễ hơn
- canonical chỉ chứa dữ liệu bot thực sự dùng

---

## 11. Validation gates trước khi publish vào knowledge layer

## 11.1. Hard fail
Không publish nếu:
- record thiếu `product_id` hoặc `variant_id` mà vẫn định merge vào variant/product
- pricing/inventory/promo thiếu `last_updated_at`
- nhiều variant trùng cùng `sku` nhưng map khác product mà chưa resolve
- `effective_from > effective_to`
- promo có `end_at < start_at`

## 11.2. Soft fail / warning
Publish được nhưng gắn warning nếu:
- product active nhưng thiếu image/url
- material/fit thiếu confidence
- size guide chỉ có note chung, chưa có rule rõ
- alternatives trỏ tới product không active

---

## 12. Bot behavior contract khi data thiếu hoặc stale

### Nếu thiếu product identity
- xin khách gửi ảnh, link, hoặc tên/mã cụ thể hơn

### Nếu thiếu size guide
- không chốt size cứng
- xin thêm mã sản phẩm + chiều cao/cân nặng/sở thích mặc rộng-vừa
- nếu vẫn không có guide, handoff

### Nếu inventory stale
- wording phải chuyển sang “để mình kiểm tra lại tồn hiện tại giúp bạn”
- không claim chắc chắn còn/hết

### Nếu pricing stale
- tránh quote số tuyệt đối như fact live
- có thể nói “mình check lại giá hiện tại cho đúng giúp bạn nhé”

### Nếu promo stale hoặc scope không rõ
- không hứa áp dụng mã
- chỉ nói sẽ kiểm tra ưu đãi hiện hành

---

## 13. Deliverables cần tạo ngay sau contract này

### Bắt buộc
1. `fanpage-bot/knowledge/product-sales-ingestion-source-map-v1.json`
2. `fanpage-bot/knowledge/product-sales-ingestion-checklist-v1.json`

### Nên có tiếp theo
3. `fanpage-bot/knowledge/product-sales-knowledge-v1.json` (khi bắt đầu có data thật)
4. `fanpage-bot/knowledge/payment-order-ops-knowledge-v1.json`
5. script normalize đầu tiên cho 1 nguồn P0

---

## 14. Sprint recommendation thực dụng nhất
Nếu bắt đầu nạp data thật ngay bây giờ, thứ tự nên là:
1. lấy 1 export thật cho `products + variants + price + stock`
2. map vào canonical cho 3-5 SKU đầu tiên
3. lấy 1 sheet curated cho `size/material/fit`
4. merge thử thành `product-sales-knowledge-v1.json`
5. replay 10 câu hỏi bán hàng phổ biến để xem bot đã grounded hơn chưa

Không nên dành sprint kế tiếp để viết thêm pattern reply trước khi có các nguồn data này.

---

## 15. Definition of done cho knowledge ingestion phase đầu
Phase này chỉ nên coi là xong khi đạt đủ các tiêu chí sau:
- có ít nhất 1 nguồn thật P0 được nạp vào canonical knowledge
- mỗi record pricing/inventory/promo đều có `source` + `last_updated_at`
- bot có thể grounded tối thiểu các câu hỏi: giá, còn hàng, size cơ bản, promo cơ bản
- có stale handling rõ ràng, không bluff khi source cũ hoặc thiếu
- có checklist vận hành để lặp lại ingestion theo ngày/ca
