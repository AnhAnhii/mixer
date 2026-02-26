import { logger } from '../utils/logger';
import { BankInfo, Order } from '../types';

export function useFacebookMessenger(bankInfo: BankInfo | null) {
    // Gửi tin nhắn qua Facebook Messenger
    const sendMessageToFacebook = async (message: string, recipientId: string): Promise<boolean> => {
        try {
            const response = await fetch('/api/facebook/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipientId, message, messageType: 'text' })
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            return true;
        } catch (err) {
            logger.error('Facebook send error:', err);
            return false;
        }
    };

    // Gửi ảnh qua Facebook Messenger
    const sendImageToFacebook = async (imageUrl: string, recipientId: string): Promise<boolean> => {
        try {
            const response = await fetch('/api/facebook/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipientId, imageUrl, messageType: 'image' })
            });
            return response.ok;
        } catch (err) {
            logger.error('Facebook send image error:', err);
            return false;
        }
    };

    // Generate VietQR URL
    const getVietQRUrl = (amount: number, orderId: string) => {
        if (!bankInfo) return '';
        const content = encodeURIComponent(`Mixer ${orderId}`);
        return `https://img.vietqr.io/image/${bankInfo.bin}-${bankInfo.accountNumber}-compact2.png?amount=${amount}&addInfo=${content}&accountName=${encodeURIComponent(bankInfo.accountName)}`;
    };

    // Tạo tin nhắn trạng thái đơn hàng chi tiết
    const generateOrderStatusMessage = (order: Order, status: 'Chờ xử lý' | 'Đang xử lý' | 'Đã gửi hàng' | 'Đã giao hàng') => {
        const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
        const formatDate = (dateString: string) => new Date(dateString).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const orderId = order.id.substring(0, 8);
        const productList = order.items.map(item => `- ${item.productName} (${item.size} - ${item.color}) x ${item.quantity}`).join('\n');

        if (status === 'Chờ xử lý') {
            if (order.paymentMethod === 'cod') {
                return `📦 Dạ cho mình xác nhận lại thông tin đơn hàng bạn đã đặt nha\n🆔 Mã đơn hàng #${orderId} được đặt vào lúc ${formatDate(order.orderDate)}\n\n👤 Tên người nhận: ${order.customerName}\n📱 Số điện thoại: ${order.customerPhone}\n📍 Địa chỉ: ${order.shippingAddress}\n\n🛒 Sản phẩm bao gồm:\n${productList}\n💰 Tổng trị giá đơn hàng: ${formatCurrency(order.totalAmount)}\n\n💵 Đơn hàng của bạn sẽ được giao COD (thanh toán khi nhận hàng) ♥\nCảm ơn bạn đã tin tưởng Mixer! 💕`;
            } else {
                return `📦 Dạ cho mình xác nhận lại thông tin đơn hàng bạn đã đặt nha\n🆔 Mã đơn hàng #${orderId} được đặt vào lúc ${formatDate(order.orderDate)}\n\n👤 Tên người nhận: ${order.customerName}\n📱 Số điện thoại: ${order.customerPhone}\n📍 Địa chỉ: ${order.shippingAddress}\n\n🛒 Sản phẩm bao gồm:\n${productList}\n💰 Tổng trị giá đơn hàng: ${formatCurrency(order.totalAmount)}\n\n💳 Bạn xác nhận lại thông tin nhận hàng, sản phẩm, size, màu sắc, số lượng rồi quét mã QR bên dưới để chuyển khoản giúp mình nhé ♥\n⏰ Đơn hàng sẽ được giữ trong vòng 24h, sau 24h sẽ tự động huỷ nếu chưa chuyển khoản ạ.`;
            }
        }

        if (status === 'Đang xử lý') {
            return `✅ Mixer xác nhận đã nhận được thanh toán cho đơn hàng #${orderId}.\n📦 Đơn hàng của bạn đang được chuẩn bị và sẽ sớm được gửi đi.\n💕 Cảm ơn bạn đã mua sắm tại Mixer!`;
        }

        if (status === 'Đã gửi hàng') {
            const shippingDetails = order.shippingProvider && order.trackingCode
                ? `🚚 Đơn vị vận chuyển: ${order.shippingProvider}\n📋 Mã vận đơn: ${order.trackingCode}`
                : `🚚 Đơn vị vận chuyển: [Đang cập nhật]`;
            return `🎉 Mixer xin thông báo: Đơn hàng #${orderId} của bạn đã được gửi đi!\n${shippingDetails}\n📞 Bạn vui lòng để ý điện thoại để nhận hàng nhé. Cảm ơn bạn! 💕`;
        }

        if (status === 'Đã giao hàng') {
            return `🎊 Mixer xin thông báo: Đơn hàng #${orderId} đã được giao thành công!\n💕 Cảm ơn bạn đã tin tưởng và mua sắm tại Mixer.\n🛍️ Hẹn gặp lại bạn ở những đơn hàng tiếp theo nhé!`;
        }

        return '';
    };

    // Gửi trạng thái đơn hàng đến khách (bao gồm QR nếu cần)
    const sendOrderStatusToCustomer = async (order: Order, status: 'Chờ xử lý' | 'Đang xử lý' | 'Đã gửi hàng' | 'Đã giao hàng') => {
        if (!order.facebookUserId) return;

        const message = generateOrderStatusMessage(order, status);
        if (message) {
            // Gửi tin nhắn text trước
            await sendMessageToFacebook(message, order.facebookUserId);

            // Nếu là Chờ xử lý + chuyển khoản → gửi QR
            if (status === 'Chờ xử lý' && order.paymentMethod !== 'cod' && bankInfo) {
                const qrUrl = getVietQRUrl(order.totalAmount, order.id.substring(0, 8));
                if (qrUrl) {
                    // Đợi 1 giây để đảm bảo text gửi xong
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await sendImageToFacebook(qrUrl, order.facebookUserId);
                }
            }
        }
    };

    return {
        sendMessageToFacebook,
        sendImageToFacebook,
        sendOrderStatusToCustomer
    };
}
