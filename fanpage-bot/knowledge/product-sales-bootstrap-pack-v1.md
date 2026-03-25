# Product Sales Bootstrap Pack v1

_Date: 2026-03-25_

Mục đích: pack bootstrap sẵn để nạp canonical product knowledge vào `fanpage-bot` theo hướng an toàn, không bịa data.

## 1) Nguồn đã audit thấy trong workspace

### Usable ngay cho bootstrap schema/testing
- `mixer/data/sampleData.ts`
  - Có sample products, variants, price, costPrice, stock, lowStockThreshold
  - Không phải catalog thật của Mixer
  - Chỉ nên dùng để test shape/schema/join/downstream pipeline

### Có policy vận hành, không phải product catalog thật
- `scripts/mixer-grounded-ai-data-v1.json`
- `fanpage-bot/knowledge/policy-bank.json`
- `fanpage-bot/knowledge/case-bank.json`

### Đã có contract/skeleton ingestion
- `fanpage-bot/knowledge/product-sales-knowledge-skeleton-v1.json`
- `fanpage-bot/knowledge/product-sales-ingestion-source-map-v1.json`
- `fanpage-bot/knowledge/product-sales-ingestion-checklist-v1.json`
- `scripts/mixer-product-knowledge-gap-analysis-v1.md`
- `scripts/mixer-product-knowledge-ingestion-contract-v1.md`

### Có skeleton reasoning sales phụ trong repo phụ
- `mixer/fanpage-bot/knowledge/sales-layer-v1-skeleton.json`

## 2) Artifact đã build trong bước này
- `fanpage-bot/knowledge/product-sales-knowledge-sample-ui-seed-v1.json`
  - Build từ 5 sample products đầu trong `mixer/data/sampleData.ts`
  - Gắn cờ rất rõ: `sample_only_do_not_use_for_real_customer_claims`
  - Mục đích: validate schema canonical + product/variant joins + inventory status derivation

## 3) Còn thiếu để có canonical knowledge thật

### P0 bắt buộc
1. Product master thật: `product_id`, tên hiển thị, status, active/hidden
2. Variant master thật: `variant_id`, SKU, màu, size
3. Pricing thật: current price + `last_updated_at`
4. Inventory thật: available + `last_updated_at`
5. Promo/voucher thật: scope + start/end + `last_updated_at`

### P0.5 rất nên có
6. Size guide thật cho top SKU / top collection

### P1
7. Material / fit / care / FAQ theo merch review
8. Alternatives / comparison / bundle candidates
9. Payment-order ops knowledge canonical

## 4) Drop-in raw templates cần xin từ team/source system

### A. products-variants.csv (hoặc xlsx/json export)
Tối thiểu các cột:
- `product_id`
- `product_slug`
- `display_name`
- `category`
- `collection`
- `status`
- `active`
- `visible_in_sales`
- `variant_id`
- `sku`
- `color`
- `size`
- `variant_active`
- `allow_sale`
- `last_updated_at`

### B. pricing.csv
- `variant_id` hoặc `sku`
- `current_price`
- `compare_at_price`
- `currency`
- `effective_from`
- `effective_to`
- `source`
- `last_updated_at`

### C. inventory.csv
- `variant_id` hoặc `sku`
- `available`
- `reserved`
- `low_stock_threshold`
- `last_updated_at`
- `source`

### D. promotions.csv
- `promo_id`
- `title`
- `status`
- `voucher_code`
- `discount_type`
- `discount_value`
- `min_order_value`
- `scope`
- `product_ids`
- `variant_ids`
- `collections`
- `start_at`
- `end_at`
- `source`
- `last_updated_at`

### E. merch-enrichment.csv
- `product_id` hoặc `product_slug`
- `primary_material`
- `composition`
- `texture_notes`
- `fit_type`
- `fit_vs_standard`
- `styling_use_cases`
- `sizes`
- `height_weight_rules`
- `between_two_sizes_rule`
- `washing`
- `faq`
- `alternatives`
- `source`
- `confidence`
- `last_updated_at`

## 5) Cách dùng an toàn ngay bây giờ
- Nếu downstream chỉ cần test integration/schema: dùng file sample seed mới tạo
- Nếu định dùng cho reply customer thật: **không dùng** file sample seed
- Khi có export thật, build file đích: `fanpage-bot/knowledge/product-sales-knowledge-v1.json`
- Mọi claim về giá/tồn/promo phải có `source` + `last_updated_at`

## 6) Next step thực dụng nhất
1. Xin 1 export thật cho `products + variants + pricing + inventory`
2. Map 3-5 SKU thật đầu tiên vào canonical schema
3. Bổ sung 1 sheet size/material/fit reviewed cho đúng 3-5 SKU đó
4. Build `product-sales-knowledge-v1.json`
5. Replay các câu buyer intent: giá / còn size / màu / size tư vấn / có sale không
