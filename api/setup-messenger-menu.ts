import type { VercelRequest, VercelResponse } from '@vercel/node';

// API endpoint để setup Persistent Menu cho Facebook Messenger
// Chỉ cần gọi 1 lần để setup menu

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Cho phép cả GET và POST để dễ setup từ browser
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
    }

    if (!PAGE_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'PAGE_ACCESS_TOKEN not configured' });
    }

    try {
        // Setup Persistent Menu
        const menuResponse = await fetch(
            `https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    persistent_menu: [
                        {
                            locale: 'default',
                            composer_input_disabled: false,
                            call_to_actions: [
                                {
                                    type: 'postback',
                                    title: '🛍️ Xem sản phẩm',
                                    payload: 'VIEW_PRODUCTS'
                                },
                                {
                                    type: 'postback',
                                    title: '🛒 Xem giỏ hàng',
                                    payload: 'VIEW_CART'
                                },
                                {
                                    type: 'postback',
                                    title: '📦 Đặt hàng',
                                    payload: 'CHECKOUT'
                                },
                                {
                                    type: 'postback',
                                    title: '📞 Liên hệ Hotline',
                                    payload: 'CONTACT'
                                },
                                {
                                    type: 'web_url',
                                    title: '🛒 Shopee',
                                    url: 'https://s.shopee.vn/VzxlZeu4F',
                                    webview_height_ratio: 'full'
                                }
                            ]
                        }
                    ]
                }),
            }
        );

        const menuResult = await menuResponse.json();

        if (menuResult.error) {
            console.error('❌ Error setting persistent menu:', menuResult.error);
            return res.status(400).json({
                success: false,
                error: menuResult.error
            });
        }

        // Setup Get Started Button
        const getStartedResponse = await fetch(
            `https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    get_started: {
                        payload: 'GET_STARTED'
                    }
                }),
            }
        );

        const getStartedResult = await getStartedResponse.json();

        console.log('✅ Persistent Menu setup complete!');
        console.log('Menu result:', menuResult);
        console.log('Get Started result:', getStartedResult);

        return res.status(200).json({
            success: true,
            message: 'Persistent Menu đã được setup thành công!',
            menu: menuResult,
            getStarted: getStartedResult
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}
