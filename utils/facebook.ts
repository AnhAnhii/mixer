/**
 * Facebook Messenger utilities — single source of truth.
 * Handles message sending, VietQR generation, and order status messages.
 */

import type { Order, BankInfo } from '../types';
import { formatCurrency, formatDate, formatOrderId } from './formatters';

// ==================== MESSAGING ====================

export async function sendMessage(message: string, recipientId: string): Promise<boolean> {
    try {
        const response = await fetch('/api/facebook/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientId, message, messageType: 'text' }),
        });
        if (!response.ok) throw new Error('Failed to send message');
        return true;
    } catch (err) {
        console.error('Facebook send error:', err);
        return false;
    }
}

export async function sendImage(imageUrl: string, recipientId: string): Promise<boolean> {
    try {
        const response = await fetch('/api/facebook/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientId, imageUrl, messageType: 'image' }),
        });
        return response.ok;
    } catch (err) {
        console.error('Facebook send image error:', err);
        return false;
    }
}

export async function markSeen(recipientId: string): Promise<boolean> {
    try {
        const response = await fetch('/api/facebook/mark-seen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientId }),
        });
        return response.ok;
    } catch (err) {
        console.error('Facebook mark-seen error:', err);
        return false;
    }
}

// ==================== VIETQR ====================

export function getVietQRUrl(
    amount: number,
    orderId: string,
    bankInfo: BankInfo | null,
): string {
    if (!bankInfo) return '';
    const content = encodeURIComponent(`Mixer ${orderId}`);
    return `https://img.vietqr.io/image/${bankInfo.bin}-${bankInfo.accountNumber}-compact2.png?amount=${amount}&addInfo=${content}&accountName=${encodeURIComponent(bankInfo.accountName)}`;
}

// ==================== ORDER STATUS MESSAGES ====================

type OrderStatusKey = 'Chờ xử lý' | 'Đang xử lý' | 'Đã gửi hàng' | 'Đã giao hàng';

export function generateOrderStatusMessage(order: Order, status: OrderStatusKey): string {
    const orderId = formatOrderId(order.id);
    const productList = order.items
        .map((item) => `- ${item.productName} (${item.size} - ${item.color}) x ${item.quantity}`)
        .join('\n');

    if (status === 'Chờ xử lý') {
        const baseMessage = `📦 Dạ cho mình xác nhận lại thông tin đơn hàng bạn đã đặt nha
🆔 Mã đơn hàng #${orderId} được đặt vào lúc ${formatDate(order.orderDate)}

👤 Tên người nhận: ${order.customerName}
📱 Số điện thoại: ${order.customerPhone}
📍 Địa chỉ: ${order.shippingAddress}

🛒 Sản phẩm bao gồm:
${productList}
💰 Tổng trị giá đơn hàng: ${formatCurrency(order.totalAmount)}`;

        if (order.paymentMethod === 'cod') {
            return `${baseMessage}

💵 Đơn hàng của bạn sẽ được giao COD (thanh toán khi nhận hàng) ♥
Cảm ơn bạn đã tin tưởng Mixer! 💕`;
        }

        return `${baseMessage}

💳 Bạn xác nhận lại thông tin nhận hàng, sản phẩm, size, màu sắc, số lượng rồi quét mã QR bên dưới để chuyển khoản giúp mình nhé ♥
⏰ Đơn hàng sẽ được giữ trong vòng 24h, sau 24h sẽ tự động huỷ nếu chưa chuyển khoản ạ.`;
    }

    if (status === 'Đang xử lý') {
        return `✅ Mixer xác nhận đã nhận được thanh toán cho đơn hàng #${orderId}.
📦 Đơn hàng của bạn đang được chuẩn bị và sẽ sớm được gửi đi.
💕 Cảm ơn bạn đã mua sắm tại Mixer!`;
    }

    if (status === 'Đã gửi hàng') {
        const shippingDetails =
            order.shippingProvider && order.trackingCode
                ? `🚚 Đơn vị vận chuyển: ${order.shippingProvider}\n📋 Mã vận đơn: ${order.trackingCode}`
                : `🚚 Đơn vị vận chuyển: [Đang cập nhật]`;
        return `🎉 Mixer xin thông báo: Đơn hàng #${orderId} của bạn đã được gửi đi!
${shippingDetails}
📞 Bạn vui lòng để ý điện thoại để nhận hàng nhé. Cảm ơn bạn! 💕`;
    }

    if (status === 'Đã giao hàng') {
        return `🎊 Mixer xin thông báo: Đơn hàng #${orderId} đã được giao thành công!
💕 Cảm ơn bạn đã tin tưởng và mua sắm tại Mixer.
🛍️ Hẹn gặp lại bạn ở những đơn hàng tiếp theo nhé!`;
    }

    return '';
}

/**
 * Send order status notification to customer via Facebook.
 * Includes VietQR image for bank transfer orders.
 */
export async function sendOrderStatusToCustomer(
    order: Order,
    status: OrderStatusKey,
    bankInfo: BankInfo | null,
): Promise<void> {
    if (!order.facebookUserId) return;

    const message = generateOrderStatusMessage(order, status);
    if (!message) return;

    await sendMessage(message, order.facebookUserId);

    // Send QR code for bank transfer pending orders
    if (status === 'Chờ xử lý' && order.paymentMethod !== 'cod' && bankInfo) {
        const qrUrl = getVietQRUrl(order.totalAmount, formatOrderId(order.id), bankInfo);
        if (qrUrl) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await sendImage(qrUrl, order.facebookUserId);
        }
    }
}
