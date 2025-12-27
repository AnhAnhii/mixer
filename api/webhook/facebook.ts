// api/webhook/facebook.ts
// Facebook Messenger Webhook Handler với AI Auto-Reply

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Environment Variables
const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'mixer_verify_token_2024';
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

// Auto-reply settings (có thể chuyển sang database sau)
let AUTO_REPLY_ENABLED = process.env.AI_AUTO_REPLY === 'true';

// Training data cache (trong thực tế nên lưu database)
let trainingDataCache: Array<{ customerMessage: string; employeeResponse: string }> = [];

// ==================== TYPES ====================

interface MessagingEvent {
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
        mid: string;
        text?: string;
        attachments?: Array<{
            type: string;
            payload: { url: string };
        }>;
    };
    postback?: {
        title: string;
        payload: string;
    };
}

interface WebhookEntry {
    id: string;
    time: number;
    messaging: MessagingEvent[];
}

interface WebhookBody {
    object: string;
    entry: WebhookEntry[];
}

// ==================== SUPABASE CLIENT ====================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== CART COMMAND HANDLER ====================

interface CartResponse {
    message: string;
    imageUrl?: string;
}

async function handleCartCommand(senderId: string, messageText: string): Promise<CartResponse | null> {
    const lowerText = messageText.toLowerCase();

    // Kiểm tra có phải cart command không - sử dụng regex linh hoạt hơn
    const isAddToCart = /thêm\s+.+\s+vào\s+giỏ/i.test(messageText) || lowerText.includes('add to cart');
    const isViewCart = lowerText.includes('xem giỏ') || lowerText === 'giỏ hàng' || lowerText.includes('giỏ hàng của');
    const isClearCart = lowerText.includes('xóa giỏ') || lowerText.includes('clear cart');
    const isCheckout = lowerText.includes('đặt hàng') || lowerText.includes('checkout') || lowerText.includes('thanh toán giỏ');

    const isCartCmd = isAddToCart || isViewCart || isClearCart || isCheckout;

    if (!isCartCmd) return null;

    console.log('🛒 Cart command detected:', { isAddToCart, isViewCart, isClearCart, isCheckout });

    // Xem giỏ hàng
    if (isViewCart) {
        const cart = await getCart(senderId);
        if (!cart || !cart.items || cart.items.length === 0) {
            return { message: '🛒 Giỏ hàng của bạn đang trống.\nGõ "thêm [tên sản phẩm] vào giỏ" để bắt đầu mua sắm!' };
        }
        return { message: formatCartMessage(cart) };
    }

    // Xóa giỏ hàng
    if (isClearCart) {
        await clearCart(senderId);
        return { message: '🗑️ Đã xóa toàn bộ giỏ hàng!' };
    }

    // Checkout - Đặt hàng
    if (isCheckout) {
        const cart = await getCart(senderId);
        if (!cart || !cart.items || cart.items.length === 0) {
            return { message: '🛒 Giỏ hàng của bạn đang trống!\nHãy thêm sản phẩm trước khi đặt hàng nhé.' };
        }

        const formatCurrency = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
        const total = cart.items.reduce((sum: number, i: any) => sum + i.unit_price * i.quantity, 0);
        const itemsList = cart.items.map((item: any, idx: number) => {
            const sizeColor = [item.size, item.color].filter(Boolean).join(' - ');
            return `${idx + 1}. ${item.product_name}${sizeColor ? ` (${sizeColor})` : ''} x${item.quantity}`;
        }).join('\n');

        return {
            message: `📦 XÁC NHẬN ĐẶT HÀNG

${itemsList}

💰 Tổng cộng: ${formatCurrency(total)}

Để hoàn tất đơn hàng, vui lòng gửi cho mình:
👤 Họ tên:
📱 SĐT:
📍 Địa chỉ nhận hàng:
💳 Thanh toán: (COD / Chuyển khoản)

Mình sẽ tạo đơn ngay sau khi nhận được thông tin ạ! 💕`
        };
    }

    // Thêm vào giỏ
    if (isAddToCart) {
        // Parse size và color trước
        const sizeMatch = messageText.match(/size\s+(\w+)/i);
        const colorMatch = messageText.match(/màu\s+(\w+)/i);

        // Lọc bỏ size, màu, và color keywords khỏi product name
        let cleanedText = messageText
            .replace(/size\s+\w+/gi, '')
            .replace(/màu\s+\w+/gi, '')
            .replace(/\b(đen|trắng|đỏ|xanh|vàng|hồng|tím|nâu|xám)\b/gi, '') // common colors - use word boundary
            .trim();

        // Extract product name từ cleaned text
        const productMatch = cleanedText.match(/thêm\s+(.+?)\s+vào\s+giỏ/i);

        if (productMatch) {
            const productName = productMatch[1].trim();

            console.log('🔍 Searching for product:', productName);
            console.log('📡 Supabase URL configured:', !!SUPABASE_URL);

            // Tìm sản phẩm trong database với variants
            const { data: products, error: searchError } = await supabase
                .from('products')
                .select(`
                    id, 
                    name, 
                    price,
                    variants:product_variants(id, size, color, stock)
                `)
                .ilike('name', `%${productName}%`)
                .limit(1);

            console.log('📦 Search result:', { products, error: searchError });

            if (products && products.length > 0) {
                const product = products[0];
                const variants = product.variants || [];

                // Tìm variant phù hợp với size/color người dùng yêu cầu
                let selectedSize = sizeMatch ? sizeMatch[1].toUpperCase() : null;
                let selectedColor = colorMatch ? colorMatch[1] : null;

                // Nếu có variants, tìm variant phù hợp
                let matchedVariant = null;
                if (variants.length > 0) {
                    matchedVariant = variants.find((v: any) => {
                        const sizeOk = !selectedSize || v.size?.toUpperCase() === selectedSize;
                        const colorOk = !selectedColor || v.color?.toLowerCase().includes(selectedColor.toLowerCase());
                        return sizeOk && colorOk;
                    });

                    // Nếu không tìm thấy exact match, lấy variant đầu tiên
                    if (!matchedVariant) {
                        matchedVariant = variants[0];
                    }

                    selectedSize = matchedVariant.size || 'M';
                    selectedColor = matchedVariant.color || '';
                } else {
                    selectedSize = selectedSize || 'M';
                    selectedColor = selectedColor || '';
                }

                await addToCart(senderId, {
                    product_id: product.id,
                    product_name: product.name,
                    size: selectedSize,
                    color: selectedColor,
                    quantity: 1,
                    unit_price: product.price
                });

                const cart = await getCart(senderId);
                const total = cart?.items?.reduce((sum: number, i: any) => sum + i.unit_price * i.quantity, 0) || 0;
                const itemCount = cart?.items?.reduce((sum: number, i: any) => sum + i.quantity, 0) || 0;
                const formatCurrency = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

                return {
                    message: `✅ Đã thêm vào giỏ hàng!

📦 ${product.name} (${selectedSize}${selectedColor ? ' - ' + selectedColor : ''}) x1
💰 ${formatCurrency(product.price)}

🛒 Giỏ hàng: ${itemCount} sản phẩm - ${formatCurrency(total)}

📝 Gõ "xem giỏ" để xem chi tiết
📝 Gõ "đặt hàng" để checkout`
                };
            } else {
                return { message: `❌ Không tìm thấy sản phẩm "${productName}".\nVui lòng kiểm tra lại tên sản phẩm!` };
            }
        }

        return { message: `📝 Để thêm vào giỏ, gõ:\n"Thêm [tên sản phẩm] size [S/M/L/XL] màu [màu] vào giỏ"\n\nVí dụ: "Thêm áo hoodie size L màu đen vào giỏ"` };
    }

    return null;
}

// ==================== ORDER INFO HANDLER ====================

// Kiểm tra xem message có vẻ là thông tin đặt hàng không (chứa SĐT)
function looksLikeOrderInfo(messageText: string): boolean {
    // Có số điện thoại Việt Nam
    const hasPhone = /\b(0[0-9]{9}|84[0-9]{9}|\+84[0-9]{9})\b/.test(messageText);
    // Có pattern địa chỉ (số + đường/phố/quận)
    const hasAddress = /(đường|phố|quận|huyện|phường|xã|tp\.|tỉnh|số\s*\d+|p\.\s*\d+|q\.\s*\d+)/i.test(messageText);

    return hasPhone && (hasAddress || messageText.length > 30);
}

// Parse thông tin khách hàng từ message bằng AI
async function parseOrderInfoWithAI(messageText: string): Promise<{
    name: string;
    phone: string;
    address: string;
    paymentMethod: 'cod' | 'bank_transfer';
} | null> {
    if (!GEMINI_API_KEY) return null;

    try {
        const { GoogleGenAI } = await import('@google/genai');
        const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY! });

        const prompt = `Trích xuất thông tin đặt hàng từ tin nhắn sau. Trả về JSON thuần túy (không markdown).

Tin nhắn: "${messageText}"

Format JSON cần trả về:
{"name": "Họ tên", "phone": "0901234567", "address": "Địa chỉ đầy đủ", "paymentMethod": "cod" hoặc "bank_transfer"}

Quy tắc:
- phone: chỉ số, bỏ dấu cách, starting with 0
- paymentMethod: "cod" nếu có COD/tiền mặt/nhận hàng, "bank_transfer" nếu có CK/chuyển khoản
- Nếu không rõ paymentMethod, mặc định "cod"
- Nếu không tìm thấy đủ thông tin, trả về null

Chỉ trả về JSON, không giải thích:`;

        const response = await client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt
        });

        const text = (response.text || '').trim();
        console.log('🤖 AI parsed order info:', text);

        // Parse JSON từ response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.name || !parsed.phone || !parsed.address) return null;

        return {
            name: parsed.name,
            phone: parsed.phone.replace(/\s+/g, ''),
            address: parsed.address,
            paymentMethod: parsed.paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'cod'
        };
    } catch (error) {
        console.error('❌ Error parsing order info:', error);
        return null;
    }
}

// Fallback: Parse thông tin bằng regex (không cần AI)
function parseOrderInfoWithRegex(messageText: string): {
    name: string;
    phone: string;
    address: string;
    paymentMethod: 'cod' | 'bank_transfer';
} | null {
    // Extract phone number
    const phoneMatch = messageText.match(/\b(0[0-9]{9,10})\b/);
    if (!phoneMatch) return null;
    const phone = phoneMatch[1];

    // Tách payment method
    const lowerText = messageText.toLowerCase();
    let paymentMethod: 'cod' | 'bank_transfer' = 'cod';
    if (/ck|chuyển khoản|banking|bank/i.test(messageText)) {
        paymentMethod = 'bank_transfer';
    }

    // Bỏ phone, payment keywords khỏi text
    let cleanedText = messageText
        .replace(phoneMatch[0], '')
        .replace(/\b(cod|ck|chuyển khoản|thanh toán|banking?)\b/gi, '')
        .replace(/[,\n]+/g, ',')
        .trim();

    // Tách bằng dấu phẩy
    const parts = cleanedText.split(',').map(p => p.trim()).filter(p => p.length > 0);

    if (parts.length >= 2) {
        // Giả định: phần đầu là tên, phần còn lại là địa chỉ
        const name = parts[0];
        const address = parts.slice(1).join(', ');

        if (name.length > 1 && address.length > 5) {
            console.log('📝 Parsed with regex:', { name, phone, address, paymentMethod });
            return { name, phone, address, paymentMethod };
        }
    }

    // Nếu không tách được bằng phẩy, thử cách khác
    // Tìm địa chỉ bằng pattern (số + tên đường/phố)
    const addressMatch = cleanedText.match(/(\d+[A-Za-z]?\s+.{10,})/);
    if (addressMatch) {
        const address = addressMatch[1].trim();
        const name = cleanedText.replace(address, '').trim() || 'Khách';

        if (address.length > 5) {
            console.log('📝 Parsed with regex (method 2):', { name, phone, address, paymentMethod });
            return { name, phone, address, paymentMethod };
        }
    }

    return null;
}

// Tạo đơn hàng từ giỏ hàng
async function createOrderFromCart(
    senderId: string,
    customerInfo: { name: string; phone: string; address: string; paymentMethod: 'cod' | 'bank_transfer' }
): Promise<{ success: boolean; orderId?: string; total?: number; error?: string }> {
    const cart = await getCart(senderId);
    if (!cart || !cart.items || cart.items.length === 0) {
        return { success: false, error: 'Giỏ hàng trống' };
    }

    const total = cart.items.reduce((sum: number, i: any) => sum + i.unit_price * i.quantity, 0);

    // Tạo order trong Supabase
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            customer_name: customerInfo.name,
            customer_phone: customerInfo.phone,
            shipping_address: customerInfo.address,
            payment_method: customerInfo.paymentMethod,
            payment_status: customerInfo.paymentMethod === 'cod' ? 'Unpaid' : 'Unpaid',
            status: 'Chờ xử lý',
            total_amount: total,
            facebook_user_id: senderId,
            order_date: new Date().toISOString()
        })
        .select()
        .single();

    if (orderError || !order) {
        console.error('❌ Error creating order:', orderError);
        return { success: false, error: 'Không thể tạo đơn hàng' };
    }

    // Tạo order items
    const orderItems = cart.items.map((item: any) => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unit_price: item.unit_price
    }));

    await supabase.from('order_items').insert(orderItems);

    // Xóa giỏ hàng
    await clearCart(senderId);

    console.log('✅ Order created:', order.id);
    return { success: true, orderId: order.id, total };
}

// Handle message có thông tin đặt hàng
async function handleOrderInfo(senderId: string, messageText: string): Promise<CartResponse | null> {
    // Kiểm tra xem có giỏ hàng và message có vẻ là order info không
    const cart = await getCart(senderId);
    if (!cart || !cart.items || cart.items.length === 0) return null;
    if (!looksLikeOrderInfo(messageText)) return null;

    console.log('📋 Detected order info, parsing...');

    // Thử AI trước
    let customerInfo = await parseOrderInfoWithAI(messageText);

    // Nếu AI fail (quota hết, lỗi, etc.), fallback sang regex
    if (!customerInfo) {
        console.log('📝 AI parse failed, trying regex fallback...');
        customerInfo = parseOrderInfoWithRegex(messageText);
    }

    if (!customerInfo) {
        return {
            message: `❓ Mình chưa nhận đủ thông tin. Vui lòng gửi lại theo format:
Họ tên, SĐT, Địa chỉ, COD/CK

Ví dụ: Nguyễn Văn A, 0901234567, 123 ABC Q1 HCM, COD`
        };
    }

    // Tạo đơn hàng (lưu lại cart items trước khi clear)
    const cartItems = cart.items;
    const result = await createOrderFromCart(senderId, customerInfo);
    if (!result.success) {
        return { message: `❌ ${result.error}. Vui lòng thử lại sau!` };
    }

    const formatCurrency = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
    const formatDate = () => new Date().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const orderId = result.orderId?.substring(0, 8);

    // Tạo danh sách sản phẩm
    const productList = cartItems.map((item: any) =>
        `- ${item.product_name} (${item.size}${item.color ? ' - ' + item.color : ''}) x ${item.quantity}`
    ).join('\n');

    if (customerInfo.paymentMethod === 'bank_transfer') {
        // Trả về với QR code - Template chuyển khoản giống hệ thống
        const bankInfo = await supabase.from('settings').select('value').eq('key', 'bank_info').single();
        let qrUrl = '';
        if (bankInfo.data?.value) {
            const bank = bankInfo.data.value;
            qrUrl = `https://img.vietqr.io/image/${bank.bin}-${bank.accountNumber}-compact2.png?amount=${result.total}&addInfo=${encodeURIComponent(`Mixer ${orderId}`)}&accountName=${encodeURIComponent(bank.accountName)}`;
        }

        return {
            message: `📦 Dạ cho mình xác nhận lại thông tin đơn hàng bạn đã đặt nha
🆔 Mã đơn hàng #${orderId} được đặt vào lúc ${formatDate()}

👤 Tên người nhận: ${customerInfo.name}
📱 Số điện thoại: ${customerInfo.phone}
📍 Địa chỉ: ${customerInfo.address}

🛒 Sản phẩm bao gồm:
${productList}
💰 Tổng trị giá đơn hàng: ${formatCurrency(result.total || 0)}

💳 Bạn xác nhận lại thông tin nhận hàng, sản phẩm, size, màu sắc, số lượng rồi quét mã QR bên dưới để chuyển khoản giúp mình nhé ♥
⏰ Đơn hàng sẽ được giữ trong vòng 24h, sau 24h sẽ tự động huỷ nếu chưa chuyển khoản ạ.`,
            imageUrl: qrUrl || undefined
        };
    }

    // Template COD giống hệ thống
    return {
        message: `📦 Dạ cho mình xác nhận lại thông tin đơn hàng bạn đã đặt nha
🆔 Mã đơn hàng #${orderId} được đặt vào lúc ${formatDate()}

👤 Tên người nhận: ${customerInfo.name}
📱 Số điện thoại: ${customerInfo.phone}
📍 Địa chỉ: ${customerInfo.address}

🛒 Sản phẩm bao gồm:
${productList}
💰 Tổng trị giá đơn hàng: ${formatCurrency(result.total || 0)}

💵 Đơn hàng của bạn sẽ được giao COD (thanh toán khi nhận hàng) ♥
Cảm ơn bạn đã tin tưởng Mixer! 💕`
    };
}

// ==================== CART HELPERS ====================

async function getOrCreateCart(facebookUserId: string) {
    const { data: existing } = await supabase
        .from('carts')
        .select('*')
        .eq('facebook_user_id', facebookUserId)
        .single();

    if (existing) return existing;

    const { data: newCart } = await supabase
        .from('carts')
        .insert({ facebook_user_id: facebookUserId })
        .select()
        .single();

    return newCart;
}

async function getCart(facebookUserId: string) {
    const { data } = await supabase
        .from('carts')
        .select('*, items:cart_items(*)')
        .eq('facebook_user_id', facebookUserId)
        .single();
    return data;
}

async function addToCart(facebookUserId: string, item: any) {
    const cart = await getOrCreateCart(facebookUserId);
    if (!cart) return null;

    // Check if item already exists
    const { data: existing } = await supabase
        .from('cart_items')
        .select('*')
        .eq('cart_id', cart.id)
        .eq('product_name', item.product_name)
        .eq('size', item.size || '')
        .single();

    if (existing) {
        await supabase
            .from('cart_items')
            .update({ quantity: existing.quantity + item.quantity })
            .eq('id', existing.id);
    } else {
        await supabase
            .from('cart_items')
            .insert({ cart_id: cart.id, ...item });
    }
}

async function clearCart(facebookUserId: string) {
    const cart = await getCart(facebookUserId);
    if (cart) {
        await supabase.from('cart_items').delete().eq('cart_id', cart.id);
    }
}

function formatCartMessage(cart: any): string {
    const formatCurrency = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
    const items = cart.items || [];
    const total = items.reduce((sum: number, i: any) => sum + i.unit_price * i.quantity, 0);
    const itemCount = items.reduce((sum: number, i: any) => sum + i.quantity, 0);

    const list = items.map((item: any, idx: number) => {
        const sizeColor = [item.size, item.color].filter(Boolean).join(' - ');
        return `${idx + 1}. ${item.product_name}${sizeColor ? ` (${sizeColor})` : ''} x${item.quantity} - ${formatCurrency(item.unit_price * item.quantity)}`;
    }).join('\n');

    return `🛒 Giỏ hàng của bạn (${itemCount} sản phẩm)

${list}

💰 Tổng cộng: ${formatCurrency(total)}

📝 Gõ "đặt hàng" để checkout
🗑️ Gõ "xóa giỏ" để xóa toàn bộ`;
}

// ==================== SEND IMAGE ====================

async function sendImage(recipientId: string, imageUrl: string): Promise<boolean> {
    if (!PAGE_ACCESS_TOKEN) return false;

    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: {
                        attachment: {
                            type: 'image',
                            payload: { url: imageUrl, is_reusable: true }
                        }
                    },
                    messaging_type: 'RESPONSE',
                }),
            }
        );
        return response.ok;
    } catch (error) {
        console.error('❌ Error sending image:', error);
        return false;
    }
}

// ==================== MAIN HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log(`📥 ${req.method} /api/webhook/facebook`);

    // GET request = Facebook verification
    if (req.method === 'GET') {
        return handleVerification(req, res);
    }

    // POST request = Actual webhook events
    if (req.method === 'POST') {
        return handleWebhookEvent(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

// ==================== VERIFICATION ====================

function handleVerification(req: VercelRequest, res: VercelResponse) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('🔐 Verification request received');
    console.log('   Mode:', mode);
    console.log('   Token:', token);

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified successfully!');
        return res.status(200).send(challenge);
    }

    console.log('❌ Verification failed - token mismatch');
    return res.status(403).json({ error: 'Verification failed' });
}

// ==================== WEBHOOK EVENTS ====================

async function handleWebhookEvent(req: VercelRequest, res: VercelResponse) {
    const body = req.body as WebhookBody;

    console.log('📨 Webhook event received');

    // Validate event type
    if (body.object !== 'page') {
        console.log('⚠️ Not a page event, ignoring');
        return res.status(404).json({ error: 'Not a page event' });
    }

    // Process each entry
    try {
        for (const entry of body.entry) {
            for (const event of entry.messaging) {
                if (event.message) {
                    await handleMessage(event);
                } else if (event.postback) {
                    await handlePostback(event);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
    }

    // Facebook requires 200 response within 20 seconds
    return res.status(200).json({ status: 'EVENT_RECEIVED' });
}

// ==================== AI MESSAGE HANDLER ====================

async function handleMessage(event: MessagingEvent) {
    const senderId = event.sender.id;
    const messageText = event.message?.text || '';

    console.log(`💬 New message from ${senderId}: ${messageText}`);

    // Bỏ qua tin nhắn trống hoặc chỉ có attachments
    if (!messageText.trim()) {
        console.log('⏭️ Empty message, skipping AI response');
        return;
    }

    // ==================== CART COMMANDS (ALWAYS ON) ====================
    const cartResponse = await handleCartCommand(senderId, messageText);
    if (cartResponse) {
        await sendMessage(senderId, cartResponse.message);
        if (cartResponse.imageUrl) {
            await sendImage(senderId, cartResponse.imageUrl);
        }
        console.log(`🛒 Cart command handled: ${messageText.substring(0, 30)}...`);
        return; // Đã xử lý cart command, không cần AI
    }

    // ==================== ORDER INFO DETECTION (FROM CART CHECKOUT) ====================
    const orderResponse = await handleOrderInfo(senderId, messageText);
    if (orderResponse) {
        await sendMessage(senderId, orderResponse.message);
        if (orderResponse.imageUrl) {
            await sendImage(senderId, orderResponse.imageUrl);
        }
        console.log(`📦 Order created from cart: ${messageText.substring(0, 30)}...`);
        return;
    }

    // ==================== AI AUTO-REPLY ====================
    // Kiểm tra xem có bật auto-reply không (gọi API settings)
    try {
        // Trong production, gọi API. Tạm thời dùng env var + global state
        const isEnabled = AUTO_REPLY_ENABLED || process.env.AI_AUTO_REPLY === 'true';
        if (!isEnabled) {
            console.log('⏸️ Auto-reply is disabled');
            return;
        }
    } catch (e) {
        console.log('⏸️ Could not check auto-reply status, skipping');
        return;
    }

    // Kiểm tra xem có Gemini API key không
    if (!GEMINI_API_KEY) {
        console.log('⚠️ Gemini API key not configured, using fallback');
        await sendFallbackResponse(senderId, messageText);
        return;
    }

    try {
        // Gọi AI để tạo response
        const aiResponse = await generateAIResponse(messageText);

        if (aiResponse.shouldHandoff) {
            console.log('🔀 AI suggests handoff to human');
            await sendMessage(senderId, 'Dạ bạn chờ mình xíu, nhân viên sẽ hỗ trợ bạn ngay ạ! 🙏');
            return;
        }

        if (aiResponse.confidence < 0.5) {
            console.log(`⚠️ Low confidence (${aiResponse.confidence}), skipping auto-reply`);
            return;
        }

        // Gửi response
        await sendMessage(senderId, aiResponse.message);
        console.log(`🤖 AI replied: ${aiResponse.message.substring(0, 50)}...`);

    } catch (error) {
        console.error('❌ AI processing error:', error);
    }
}

// ==================== AI RESPONSE GENERATOR ====================

async function generateAIResponse(customerMessage: string): Promise<{
    message: string;
    confidence: number;
    shouldHandoff: boolean;
}> {
    // Dynamic import để tránh lỗi module
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY! });

    // Build training examples
    const examples = trainingDataCache
        .slice(0, 8)
        .map(p => `Khách: "${p.customerMessage}"\nShop: "${p.employeeResponse}"`)
        .join('\n\n');

    const prompt = `Bạn là nhân viên shop MIXER trên Facebook.

📌 CÁCH TRẢ LỜI (học từ ví dụ):
${examples || `Khách: "còn hàng k"
Shop: "Dạ bên mình còn nha bạn ơi! Bạn cần size gì ạ? ♥"

Khách: "ship bao lâu"
Shop: "Dạ ship 2-4 ngày tùy khu vực bạn nhé! ♥"

Khách: "giá bao nhiêu"
Shop: "Dạ bạn cho mình biết sản phẩm cụ thể để mình báo giá nhé ạ! 😊"`}

📌 QUY TẮC:
- Trả lời NGẮN (1-3 câu), thân thiện
- Dùng "mình/bạn" hoặc "em/anh/chị"
- Thêm 1-2 emoji (♥ 😊 🙏)
- Không hiểu → hỏi lại lịch sự
- Phàn nàn/đổi trả/khiếu nại → bắt đầu với "[HANDOFF]"
- KHÔNG nói về chính trị, tôn giáo

📌 TỪ VIẾT TẮT:
ib=inbox, sz=size, đt=điện thoại, ship=giao hàng, cod=thanh toán khi nhận, ck=chuyển khoản, k/ko=không

📌 THÔNG TIN SHOP:
- Tên: MIXER - Quần áo thời trang
- Ship: 2-4 ngày
- Thanh toán: COD/Chuyển khoản

📌 KHÁCH HỎI: "${customerMessage}"

Trả lời ngắn gọn:`;

    const response = await client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt
    });

    const responseText = (response.text || '').trim();

    // Phân tích response
    const shouldHandoff = responseText.startsWith('[HANDOFF]');
    const message = responseText.replace('[HANDOFF]', '').trim();

    // Tính confidence
    let confidence = 0.8;
    if (message.length < 10) confidence -= 0.2;
    if (message.length > 300) confidence -= 0.1;
    if (/không biết|không rõ|chờ.*kiểm tra/i.test(message)) confidence -= 0.2;

    return {
        message,
        confidence: Math.max(0.1, confidence),
        shouldHandoff
    };
}

// ==================== FALLBACK RESPONSE ====================

async function sendFallbackResponse(senderId: string, messageText: string) {
    const lowerText = messageText.toLowerCase();

    if (/chào|hello|hi|hey/.test(lowerText)) {
        await sendMessage(senderId, 'Chào bạn! 👋 Cảm ơn bạn đã liên hệ với shop. Mình sẽ phản hồi sớm nhất có thể ạ! 🛍️');
    } else if (/giá|bao nhiêu|bn/.test(lowerText)) {
        await sendMessage(senderId, 'Dạ bạn cho mình biết sản phẩm cụ thể để mình báo giá nhé ạ! 💰');
    } else if (/size|màu|còn/.test(lowerText)) {
        await sendMessage(senderId, 'Dạ bạn cho mình biết chiều cao cân nặng để tư vấn size phù hợp nhé! 📏');
    }
}

// ==================== POSTBACK HANDLER ====================

async function handlePostback(event: MessagingEvent) {
    const senderId = event.sender.id;
    const payload = event.postback?.payload || '';

    console.log(`🔘 Postback from ${senderId}: ${payload}`);

    switch (payload) {
        case 'GET_STARTED':
            await sendMessage(
                senderId,
                'Chào mừng bạn đến với shop! 🎉\n\nBạn có thể nhắn tin để hỏi về:\n• Sản phẩm & giá cả\n• Size & màu sắc\n• Ship & thanh toán\n\nMình sẽ phản hồi sớm nhất có thể ạ!'
            );
            break;
        default:
            console.log(`⚠️ Unknown postback: ${payload}`);
    }
}

// ==================== SEND MESSAGE ====================

async function sendMessage(recipientId: string, messageText: string): Promise<boolean> {
    if (!PAGE_ACCESS_TOKEN) {
        console.error('❌ PAGE_ACCESS_TOKEN is not configured');
        return false;
    }

    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text: messageText },
                    messaging_type: 'RESPONSE',
                }),
            }
        );

        const result = await response.json();

        if (result.error) {
            console.error('❌ Facebook API error:', result.error);
            return false;
        }

        console.log('📤 Message sent successfully');
        return true;
    } catch (error) {
        console.error('❌ Error sending message:', error);
        return false;
    }
}

// ==================== UTILITY FUNCTIONS ====================

// Update training data cache (gọi từ UI)
export function updateTrainingData(data: Array<{ customerMessage: string; employeeResponse: string }>) {
    trainingDataCache = data;
    console.log(`📚 Training data updated: ${data.length} pairs`);
}

// Toggle auto-reply
export function setAutoReplyEnabled(enabled: boolean) {
    AUTO_REPLY_ENABLED = enabled;
    console.log(`🤖 Auto-reply ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

// Lấy thông tin user profile
export async function getUserProfile(userId: string): Promise<{
    first_name?: string;
    last_name?: string;
    profile_pic?: string;
} | null> {
    if (!PAGE_ACCESS_TOKEN) return null;

    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${userId}?fields=first_name,last_name,profile_pic&access_token=${PAGE_ACCESS_TOKEN}`
        );
        return await response.json();
    } catch (error) {
        console.error('❌ Error fetching user profile:', error);
        return null;
    }
}
