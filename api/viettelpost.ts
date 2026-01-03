// api/viettelpost.ts
// API tích hợp Viettel Post - Tạo vận đơn, tra cứu, webhook
// Sử dụng ?action= để gọi các chức năng khác nhau

import type { VercelRequest, VercelResponse } from '@vercel/node';

const VTP_BASE_URL = 'https://partner.viettelpost.vn/v2';
const VTP_USERNAME = process.env.VIETTELPOST_USERNAME;
const VTP_PASSWORD = process.env.VIETTELPOST_PASSWORD;

// Token cache (trong memory - sẽ reset khi cold start)
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

// Helper: Đăng nhập lấy token
async function getToken(): Promise<string> {
    // Return cached token nếu còn hạn
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    if (!VTP_USERNAME || !VTP_PASSWORD) {
        throw new Error('Viettel Post credentials not configured');
    }

    // Step 1: Login lấy token tạm
    const loginRes = await fetch(`${VTP_BASE_URL}/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            USERNAME: VTP_USERNAME,
            PASSWORD: VTP_PASSWORD
        })
    });
    const loginData = await loginRes.json();

    if (!loginData.data?.token) {
        console.error('VTP Login failed:', loginData);
        throw new Error(loginData.message || 'Login failed');
    }

    // Step 2: ownerconnect lấy token dài hạn
    const connectRes = await fetch(`${VTP_BASE_URL}/user/ownerconnect`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Token': loginData.data.token
        },
        body: JSON.stringify({
            USERNAME: VTP_USERNAME,
            PASSWORD: VTP_PASSWORD
        })
    });
    const connectData = await connectRes.json();

    if (!connectData.data?.token) {
        // Nếu không có ownerconnect, dùng token từ login
        cachedToken = loginData.data.token;
    } else {
        cachedToken = connectData.data.token;
    }

    // Cache token 23 giờ
    tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
    console.log('✅ Viettel Post token obtained');

    return cachedToken!;
}

// Safe JSON parse helper
async function safeJsonParse(response: Response, context: string) {
    const text = await response.text();
    console.log(`📤 VTP ${context} response:`, text.substring(0, 500));

    if (!text || text.trim() === '') {
        console.error(`❌ VTP ${context}: Empty response`);
        return { error: true, message: 'Viettel Post returned empty response' };
    }

    try {
        return JSON.parse(text);
    } catch (e) {
        console.error(`❌ VTP ${context}: Invalid JSON:`, text.substring(0, 200));
        return { error: true, message: 'Invalid JSON response from Viettel Post', raw: text.substring(0, 200) };
    }
}

// Lấy danh sách kho
async function getInventories(token: string) {
    const res = await fetch(`${VTP_BASE_URL}/user/listInventory`, {
        headers: { 'Token': token }
    });
    return await safeJsonParse(res, 'listInventory');
}

// Tính phí vận chuyển
async function calculateShipping(token: string, data: any) {
    const res = await fetch(`${VTP_BASE_URL}/order/getPriceAll`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Token': token
        },
        body: JSON.stringify(data)
    });
    return await safeJsonParse(res, 'getPriceAll');
}

// Tạo vận đơn - thử nhiều endpoints
async function createOrder(token: string, orderData: any) {
    console.log('📤 VTP createOrder request:', JSON.stringify(orderData, null, 2));

    // Thử endpoint createOrder trước (không phải NLP)
    const endpoints = [
        '/order/createOrder',
        '/order/createOrderNlp'
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`🔄 Trying VTP endpoint: ${endpoint}`);
            const res = await fetch(`${VTP_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Token': token
                },
                body: JSON.stringify(orderData)
            });

            console.log(`📊 VTP ${endpoint} HTTP status: ${res.status}`);

            const result = await safeJsonParse(res, endpoint);

            // Nếu có response thành công, return ngay
            if (result && !result.error && result.status === 200) {
                return result;
            }

            // Nếu có lỗi cụ thể từ VTP, cũng return
            if (result && result.message && result.message !== 'Viettel Post returned empty response') {
                return result;
            }

            console.log(`⚠️ VTP ${endpoint} returned:`, JSON.stringify(result));
        } catch (e) {
            console.error(`❌ VTP ${endpoint} error:`, e);
        }
    }

    // Nếu tất cả đều fail
    return {
        error: true,
        message: 'Không thể kết nối API Viettel Post. Vui lòng liên hệ VTP để kiểm tra tài khoản API.',
        suggestion: 'Gọi 1900 8095 và thông báo: Token hoạt động, listInventory OK, nhưng createOrder trả về empty.'
    };
}

// Tra cứu vận đơn
async function trackOrder(token: string, orderNumber: string) {
    const res = await fetch(`${VTP_BASE_URL}/order/getOrderByOrderNumber`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Token': token
        },
        body: JSON.stringify({ ORDER_NUMBER: orderNumber })
    });
    return await safeJsonParse(res, 'trackOrder');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const action = req.query.action as string || req.body?.action;

    try {
        // Test connection
        if (action === 'test') {
            const token = await getToken();
            return res.status(200).json({
                success: true,
                message: 'Viettel Post connected successfully',
                tokenPreview: token.substring(0, 20) + '...'
            });
        }

        // Lấy danh sách kho
        if (action === 'inventories') {
            const token = await getToken();
            const data = await getInventories(token);
            return res.status(200).json({ success: true, data });
        }

        // Tính phí ship
        if (action === 'calculate') {
            const token = await getToken();
            const { senderProvince, senderDistrict, receiverProvince, receiverDistrict, weight, orderValue } = req.body;

            const data = await calculateShipping(token, {
                SENDER_PROVINCE: senderProvince || 79, // HCM default
                SENDER_DISTRICT: senderDistrict || 760, // Q1 default
                RECEIVER_PROVINCE: receiverProvince,
                RECEIVER_DISTRICT: receiverDistrict,
                PRODUCT_WEIGHT: weight || 500, // gram
                PRODUCT_PRICE: orderValue || 0,
                MONEY_COLLECTION: orderValue || 0, // COD
                PRODUCT_TYPE: 'HH', // Hàng hóa
            });
            return res.status(200).json({ success: true, data });
        }

        // Tạo vận đơn
        if (action === 'create') {
            const token = await getToken();
            const {
                orderId,
                receiverName,
                receiverPhone,
                receiverAddress,
                receiverProvince,
                receiverDistrict,
                receiverWard,
                productName,
                productWeight,
                productValue,
                moneyCollection, // COD amount (0 if prepaid)
                note
            } = req.body;

            // Lấy thông tin kho gửi
            const inventoryData = await getInventories(token);
            const inventory = inventoryData.data?.[0];

            if (!inventory) {
                return res.status(400).json({
                    success: false,
                    error: 'Không tìm thấy kho gửi hàng. Vui lòng cấu hình kho trên Viettel Post.'
                });
            }

            // Format theo chuẩn VTP API v2
            const orderData = {
                ORDER_NUMBER: orderId || `MIX${Date.now()}`,
                GROUPADDRESS_ID: inventory.groupaddressId,
                CUS_ID: inventory.cusId,
                DELIVERY_DATE: new Date().toISOString().split('T')[0] + ' 08:00:00',
                SENDER_FULLNAME: inventory.name || 'MIXER SHOP',
                SENDER_ADDRESS: inventory.address || '',
                SENDER_PHONE: inventory.phone || VTP_USERNAME,
                SENDER_EMAIL: '',
                SENDER_WARD: inventory.wardsId || 0,
                SENDER_DISTRICT: inventory.districtId || 0,
                SENDER_PROVINCE: inventory.provinceId || 0,
                RECEIVER_FULLNAME: receiverName,
                RECEIVER_ADDRESS: receiverAddress,
                RECEIVER_PHONE: receiverPhone,
                RECEIVER_EMAIL: '',
                RECEIVER_PROVINCE: receiverProvince || 0,
                RECEIVER_DISTRICT: receiverDistrict || 0,
                RECEIVER_WARDS: receiverWard || '',
                RECEIVER_WARD: 0,
                PRODUCT_NAME: productName || 'Quần áo thời trang',
                PRODUCT_DESCRIPTION: note || '',
                PRODUCT_QUANTITY: 1,
                PRODUCT_PRICE: productValue || 0,
                PRODUCT_WEIGHT: productWeight || 500,
                PRODUCT_LENGTH: 20,
                PRODUCT_WIDTH: 15,
                PRODUCT_HEIGHT: 5,
                PRODUCT_TYPE: 'HH',
                ORDER_PAYMENT: moneyCollection > 0 ? 2 : 1, // 2 = COD, 1 = Prepaid
                ORDER_SERVICE: 'VCN', // Chuyển phát nhanh
                ORDER_SERVICE_ADD: '',
                ORDER_VOUCHER: '',
                ORDER_NOTE: note || '',
                MONEY_COLLECTION: moneyCollection || 0,
                MONEY_TOTALFEE: 0,
                MONEY_FEECOD: 0,
                MONEY_FEEVAS: 0,
                MONEY_FEEINSURANCE: 0,
                MONEY_FEE: 0,
                MONEY_FEEOTHER: 0,
                MONEY_TOTALVAT: 0,
                MONEY_TOTAL: 0,
                NOTE: note || '',
                LIST_ITEM: [{
                    PRODUCT_NAME: productName || 'Quần áo thời trang',
                    PRODUCT_PRICE: productValue || 0,
                    PRODUCT_WEIGHT: productWeight || 500,
                    PRODUCT_QUANTITY: 1
                }]
            };

            const result = await createOrder(token, orderData);

            if (result.status === 200 && result.data) {
                return res.status(200).json({
                    success: true,
                    orderNumber: result.data.ORDER_NUMBER,
                    trackingCode: result.data.ORDER_NUMBER,
                    fee: result.data.MONEY_TOTAL_FEE,
                    message: 'Tạo vận đơn thành công!'
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: result.message || 'Không thể tạo vận đơn',
                    details: result
                });
            }
        }

        // Tra cứu vận đơn
        if (action === 'track') {
            const token = await getToken();
            const { orderNumber } = req.body;

            if (!orderNumber) {
                return res.status(400).json({ error: 'orderNumber is required' });
            }

            const data = await trackOrder(token, orderNumber);
            return res.status(200).json({ success: true, data });
        }

        // Webhook nhận cập nhật từ Viettel Post
        if (action === 'webhook') {
            // Parse webhook data từ VTP
            const webhookData = req.body;
            console.log('📦 VTP Webhook received:', JSON.stringify(webhookData));

            // TODO: Cập nhật trạng thái đơn hàng trong hệ thống
            // TODO: Gửi thông báo cho khách hàng

            return res.status(200).json({ success: true, message: 'Webhook received' });
        }

        return res.status(400).json({
            error: 'Missing action parameter',
            availableActions: ['test', 'inventories', 'calculate', 'create', 'track', 'webhook']
        });

    } catch (error) {
        console.error('Viettel Post API Error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
