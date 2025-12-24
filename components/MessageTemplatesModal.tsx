import React, { useState, useMemo, useEffect } from 'react';
import type { Order, BankInfo } from '../types';
import Modal from './Modal';

interface MessageTemplatesModalProps {
  order: Order | null;
  bankInfo: BankInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

const MessageTemplatesModal: React.FC<MessageTemplatesModalProps> = ({ order, bankInfo, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

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
Bạn chuyển khoản theo nội dung: TT don hang ${order.id.substring(0, 8)}. Sau đó cho shop xin ảnh bill chuyển tiền, nhận được bên mình sẽ báo lại ngay. Cảm ơn bạn nhiều ❤`
      : `[Vui lòng thêm thông tin tài khoản ngân hàng trong phần Cài đặt]`;

    const shippingDetails = order.shippingProvider && order.trackingCode
      ? `Đơn vị vận chuyển: ${order.shippingProvider} - Mã vận đơn: ${order.trackingCode}`
      : `Đơn vị vận chuyển: [Vui lòng cập nhật trong chi tiết đơn hàng]`;

    return [
      {
        status: 'Chờ xử lý',
        content: `Dạ cho mình xác nhận lại thông tin đơn hàng bạn đã đặt nha
Mã đơn hàng #${order.id.substring(0, 8)} được đặt vào lúc ${formatDate(order.orderDate)}

- Tên người nhận: ${order.customerName}
- Số điện thoại: ${order.customerPhone}
- Địa chỉ: ${order.shippingAddress}

Sản phẩm bao gồm:
${productList}
- Tổng trị giá đơn hàng: ${formatCurrency(order.totalAmount)}

Bạn xác nhận lại thông tin nhận hàng, sản phẩm, size, màu sắc, số lượng sau đó chuyển khoản theo quy định của shop giúp mình ạ.
Đơn hàng sẽ được giữ trong vòng 24h, sau 24h sẽ tự động huỷ nếu chưa chuyển khoản ạ ♥

${bankDetails}`
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
    if(isOpen && order) {
      setSelectedTemplateContent(getTemplateForStatus(order.status));
    }
  }, [isOpen, order]);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedTemplateContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  if (!isOpen || !order) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Mẫu cho trạng thái: ${order.status}`}>
      <div className="space-y-4">
        <textarea
          value={selectedTemplateContent}
          onChange={(e) => setSelectedTemplateContent(e.target.value)}
          rows={15}
          className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary bg-slate-50 text-sm leading-relaxed"
        />

        <div className="flex justify-end">
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