import React, { useState, useMemo, useEffect } from 'react';
import type { Order, BankInfo } from '../types';
import Modal from './Modal';
import { useToast } from './Toast';

interface MessageTemplatesModalProps {
  order: Order | null;
  bankInfo: BankInfo | null;
  isOpen: boolean;
  onClose: () => void;
  // Thêm prop để gửi qua Facebook
  onSendToFacebook?: (message: string, recipientId: string) => Promise<boolean>;
}

const MessageTemplatesModal: React.FC<MessageTemplatesModalProps> = ({
  order,
  bankInfo,
  isOpen,
  onClose,
  onSendToFacebook
}) => {
  const [copied, setCopied] = useState(false);
  const [isSendingFB, setIsSendingFB] = useState(false);
  const toast = useToast();

  const getTemplateForStatus = (status: string) => {
    const template = templates.find(t => t.status === status);
    return template ? template.content : templates[0].content;
  };

  const templates = useMemo(() => {
    if (!order) return [];

    const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    const formatDate = (dateString: string) => new Date(dateString).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const productList = order.items.map(item => `- ${item.productName} (${item.size} - ${item.color}) x ${item.quantity}`).join('\n');

    const bankDetails = bankInfo
      ? `Thông tin chuyển khoản
MB BANK
${bankInfo.accountNumber}
${bankInfo.accountName}
Bạn chuyển khoản theo nội dung: Mixer ${order.id.substring(0, 8)}. Sau đó cho shop xin ảnh bill chuyển tiền, nhận được bên mình sẽ báo lại ngay. Cảm ơn bạn nhiều ❤`
      : `[Vui lòng thêm thông tin tài khoản ngân hàng trong phần Cài đặt]`;

    const shippingDetails = order.shippingProvider && order.trackingCode
      ? `Đơn vị vận chuyển: ${order.shippingProvider} - Mã vận đơn: ${order.trackingCode}`
      : `Đơn vị vận chuyển: [Vui lòng cập nhật trong chi tiết đơn hàng]`;

    // Template cho COD
    const codTemplate = `Dạ cho mình xác nhận lại thông tin đơn hàng bạn đã đặt nha
Mã đơn hàng #${order.id.substring(0, 8)} được đặt vào lúc ${formatDate(order.orderDate)}

- Tên người nhận: ${order.customerName}
- Số điện thoại: ${order.customerPhone}
- Địa chỉ: ${order.shippingAddress}

Sản phẩm bao gồm:
${productList}
- Tổng trị giá đơn hàng: ${formatCurrency(order.totalAmount)}

Đơn hàng của bạn sẽ được giao COD (thanh toán khi nhận hàng) ♥
Dự kiến giao hàng trong 2-4 ngày. Cảm ơn bạn!`;

    // Template cho chuyển khoản
    const bankTransferTemplate = `Dạ cho mình xác nhận lại thông tin đơn hàng bạn đã đặt nha
Mã đơn hàng #${order.id.substring(0, 8)} được đặt vào lúc ${formatDate(order.orderDate)}

- Tên người nhận: ${order.customerName}
- Số điện thoại: ${order.customerPhone}
- Địa chỉ: ${order.shippingAddress}

Sản phẩm bao gồm:
${productList}
- Tổng trị giá đơn hàng: ${formatCurrency(order.totalAmount)}

Bạn xác nhận lại thông tin nhận hàng, sản phẩm, size, màu sắc, số lượng sau đó chuyển khoản theo quy định của shop giúp mình ạ.
Đơn hàng sẽ được giữ trong vòng 24h, sau 24h sẽ tự động huỷ nếu chưa chuyển khoản ạ ♥

${bankDetails}`;

    return [
      {
        status: 'Chờ xử lý',
        content: order.paymentMethod === 'cod' ? codTemplate : bankTransferTemplate
      },
      {
        status: 'Đang xử lý',
        content: `Mixer xác nhận đã nhận được thanh toán cho đơn hàng #${order.id.substring(0, 8)}.
Đơn hàng của bạn đang được chuẩn bị và sẽ sớm được gửi đi.
Cảm ơn bạn đã mua sắm!`
      },
      {
        status: 'Đã gửi hàng',
        content: `Mixer xin thông báo: Đơn hàng #${order.id.substring(0, 8)} của bạn đã được gửi đi.
${shippingDetails}
Bạn vui lòng để ý điện thoại để nhận hàng trong vài ngày tới nhé. Cảm ơn bạn!`
      },
      {
        status: 'Đã giao hàng',
        content: `Mixer xin thông báo: Đơn hàng #${order.id.substring(0, 8)} đã được giao thành công.
Cảm ơn bạn đã tin tưởng và mua sắm tại Mixer. Hẹn gặp lại bạn ở những đơn hàng tiếp theo nhé!`
      }
    ];
  }, [order, bankInfo]);

  const [selectedTemplateContent, setSelectedTemplateContent] = useState('');

  useEffect(() => {
    if (isOpen && order) {
      setSelectedTemplateContent(getTemplateForStatus(order.status));
    }
  }, [isOpen, order]);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedTemplateContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendToFacebook = async () => {
    if (!order || !onSendToFacebook || !order.facebookUserId) {
      toast.error('Không thể gửi: Đơn hàng này không có thông tin Facebook');
      return;
    }

    setIsSendingFB(true);
    try {
      const success = await onSendToFacebook(selectedTemplateContent, order.facebookUserId);
      if (success) {
        toast.success('📩 Đã gửi tin nhắn qua Facebook!');
        onClose();
      } else {
        toast.error('Gửi tin nhắn thất bại');
      }
    } catch (err) {
      toast.error('Lỗi khi gửi tin nhắn');
    } finally {
      setIsSendingFB(false);
    }
  };

  if (!isOpen || !order) return null;

  const hasFacebookId = !!order.facebookUserId;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Mẫu cho trạng thái: ${order.status}`}>
      <div className="space-y-4">
        {/* Hiển thị thông tin phương thức thanh toán */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.paymentMethod === 'cod'
              ? 'bg-orange-100 text-orange-700'
              : 'bg-blue-100 text-blue-700'
            }`}>
            {order.paymentMethod === 'cod' ? '💵 COD' : '🏦 Chuyển khoản'}
          </span>
          {hasFacebookId && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
              📱 Có FB ID
            </span>
          )}
        </div>

        <textarea
          value={selectedTemplateContent}
          onChange={(e) => setSelectedTemplateContent(e.target.value)}
          rows={15}
          className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary bg-slate-50 text-sm leading-relaxed"
        />

        <div className="flex justify-end gap-2">
          {/* Nút gửi qua Facebook */}
          {hasFacebookId && onSendToFacebook && (
            <button
              onClick={handleSendToFacebook}
              disabled={isSendingFB}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-md hover:from-blue-700 hover:to-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSendingFB ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Đang gửi...
                </>
              ) : (
                <>📩 Gửi qua FB</>
              )}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="px-6 py-2 bg-primary text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            {copied ? 'Đã sao chép!' : 'Chép nội dung'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default MessageTemplatesModal;