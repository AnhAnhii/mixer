
import React, { useState } from 'react';
import type { Order, BankInfo, ActivityLog, User, DiscussionEntry } from '../types';
import Modal from './Modal';
import { OrderStatus } from '../types';
import { TruckIcon, ClipboardDocumentIcon, CheckCircleIcon, ArrowUturnLeftIcon, CreditCardIcon, ChatBubbleLeftEllipsisIcon, PencilIcon, PhoneIcon, MapPinIcon, QrCodeIcon } from './icons';
import QuickCopyButton from './QuickCopyButton';
import { useToast } from './Toast';
import ActivityFeed from './ActivityFeed';
import DiscussionInput from './DiscussionInput';
import { banks } from '../data/banks';

interface OrderDetailModalProps {
  order: Order | null;
  bankInfo: BankInfo | null;
  activityLog: ActivityLog[];
  users: User[];
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (order: Order) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onUpdateShipping: (orderId: string, provider: string, code: string) => void;
  onOpenMessageTemplates: (order: Order) => void;
  onAddDiscussion: (orderId: string, text: string) => void;
  onConfirmPayment: (orderId: string) => void;
  onOpenReturnRequest: (order: Order) => void;
  onPrintInvoice: (order: Order) => void;
  onGeneratePaymentLink: (order: Order) => void;
}

type ShippingStatusHistory = {
  time: string;
  status: string;
  location: string;
};

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, bankInfo, activityLog, users, currentUser, isOpen, onClose, onEdit, onUpdateStatus, onUpdateShipping, onOpenMessageTemplates, onAddDiscussion, onConfirmPayment, onOpenReturnRequest, onPrintInvoice, onGeneratePaymentLink }) => {
  const [shippingProvider, setShippingProvider] = useState(order?.shippingProvider || 'GHTK');
  const [trackingCode, setTrackingCode] = useState(order?.trackingCode || '');
  const toast = useToast();

  // State for shipping simulation
  const [isCreatingShipping, setIsCreatingShipping] = useState(false);
  const [isFetchingStatus, setIsFetchingStatus] = useState(false);
  const [shippingHistory, setShippingHistory] = useState<ShippingStatusHistory[] | null>(null);

  const orderActivity = React.useMemo(() => {
    if (!order) return [];
    return activityLog.filter(log => log.entityId === order.id);
  }, [activityLog, order]);

  React.useEffect(() => {
    if (order) {
      setShippingProvider(order.shippingProvider || 'GHTK');
      setTrackingCode(order.trackingCode || '');
      // Reset simulation state when a new order is viewed
      setShippingHistory(null);
      setIsCreatingShipping(false);
      setIsFetchingStatus(false);
    }
  }, [order]);

  const CopyButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
    const handleCopy = () => {
      navigator.clipboard.writeText(textToCopy);
      toast.success('Đã sao chép!');
    };
    return (
      <button onClick={handleCopy} className="text-muted-foreground hover:text-primary transition-colors p-1">
        <ClipboardDocumentIcon className="w-4 h-4" />
      </button>
    );
  };

  if (!isOpen || !order) return null;

  const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getStatusColor = (status: OrderStatus) => {
    const colors = {
      [OrderStatus.Pending]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      [OrderStatus.Processing]: 'bg-blue-100 text-blue-800 border-blue-300',
      [OrderStatus.Shipped]: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      [OrderStatus.Delivered]: 'bg-green-100 text-green-800 border-green-300',
      [OrderStatus.Cancelled]: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentStatusInfo = (order: Order) => {
    if (order.paymentMethod === 'cod') {
      return { text: 'Thu hộ (COD)', color: 'bg-gray-100 text-gray-800' };
    }

    if (order.paymentStatus === 'Paid') {
      return { text: 'Đã thanh toán', color: 'bg-green-100 text-green-800' };
    }

    return { text: 'Chờ thanh toán', color: 'bg-yellow-100 text-yellow-800' };
  };

  const handleCreateShippingOrder = () => {
    setIsCreatingShipping(true);
    setTimeout(() => {
      const newTrackingCode = `GHTK${Math.floor(100000000 + Math.random() * 900000000)}`;
      setTrackingCode(newTrackingCode);
      onUpdateShipping(order.id, shippingProvider, newTrackingCode);
      setIsCreatingShipping(false);
      toast.success(`Đã tạo đơn hàng thành công trên ${shippingProvider} với mã: ${newTrackingCode}`);
    }, 1500);
  };

  const handleFetchShippingStatus = () => {
    setIsFetchingStatus(true);
    setTimeout(() => {
      setShippingHistory([
        { time: '10:30 25/07/2024', status: 'Đã lấy hàng', location: 'Kho Cầu Giấy' },
        { time: '22:15 25/07/2024', status: 'Đang trung chuyển', location: 'Kho HNI SOC' },
        { time: '08:45 26/07/2024', status: 'Đang giao hàng', location: 'Bưu cục Quận 1' },
      ]);
      setIsFetchingStatus(false);
      toast.info('Đã lấy trạng thái đơn hàng thành công.');
    }, 1500);
  };

  const getBankName = (bin: string | undefined) => {
    if (!bin) return 'Không rõ';
    const bank = banks.find(b => b.bin === bin);
    return bank ? bank.shortName : 'Ngân hàng';
  }

  const paymentStatusInfo = getPaymentStatusInfo(order);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Chi tiết đơn hàng #${order.id.substring(0, 8)}`}>
      <div className="space-y-6">
        {/* Header section */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 p-4 bg-muted rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Ngày đặt: {formatDate(order.orderDate)}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-sm font-bold px-3 py-1 rounded-full border-2 ${getStatusColor(order.status)}`}>{order.status}</span>
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${paymentStatusInfo.color}`}>{paymentStatusInfo.text}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {order.status === OrderStatus.Delivered && (
              <button onClick={() => onOpenReturnRequest(order)} className="btn-muted px-3 py-2 text-sm flex items-center gap-2">
                <ArrowUturnLeftIcon className="w-4 h-4" /> Xử lý Đổi/Trả
              </button>
            )}

            {/* Message Template Button - Highlighted */}
            <button onClick={() => onOpenMessageTemplates(order)} className="btn-primary px-3 py-2 text-sm flex items-center gap-2 shadow-sm">
              <ChatBubbleLeftEllipsisIcon className="w-4 h-4" /> Mẫu tin nhắn
            </button>

            <button onClick={() => onEdit(order)} className="btn-muted px-3 py-2 text-sm flex items-center gap-2">
              <PencilIcon className="w-4 h-4" /> Sửa
            </button>
          </div>
        </div>

        {/* Customer & Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-card-foreground">Thông tin khách hàng</h3>
            <div className="text-sm space-y-1">
              <p className="font-bold text-card-foreground">{order.customerName}</p>
              <p className="text-muted-foreground">{order.customerPhone}</p>
              <p className="text-muted-foreground">{order.shippingAddress}</p>
            </div>
            {/* Quick Actions Bar */}
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
              <QuickCopyButton
                text={order.customerPhone}
                label="SĐT"
                icon={<PhoneIcon className="w-4 h-4" />}
                variant="compact"
              />
              <QuickCopyButton
                text={order.shippingAddress}
                label="Địa chỉ"
                icon={<MapPinIcon className="w-4 h-4" />}
                variant="compact"
              />
              <QuickCopyButton
                text={order.id.substring(0, 8)}
                label="Mã đơn"
                icon={<QrCodeIcon className="w-4 h-4" />}
                variant="compact"
              />
              <QuickCopyButton
                text={`${order.customerName}\n${order.customerPhone}\n${order.shippingAddress}`}
                label="Tất cả"
                variant="compact"
              />
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="font-semibold text-card-foreground">Sản phẩm đã đặt</h3>
            <div className="text-sm space-y-2">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-card-foreground">{item.productName} <span className="text-muted-foreground">x {item.quantity}</span></p>
                    <p className="text-xs text-muted-foreground">{item.size} - {item.color}</p>
                  </div>
                  <p className="font-medium text-card-foreground">{formatCurrency(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="p-4 bg-muted rounded-lg text-sm space-y-2">
          {order.discount && (
            <div className="flex justify-between text-green-600">
              <span>Giảm giá ({order.discount.code}):</span>
              <span>- {formatCurrency(order.discount.amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg text-card-foreground border-t border-border pt-2 mt-2">
            <span>Thành tiền:</span>
            <span className="text-primary">{formatCurrency(order.totalAmount)}</span>
          </div>
        </div>

        {/* Bank Transfer Info */}
        {order.paymentMethod === 'bank_transfer' && bankInfo && (
          <div>
            <h3 className="text-lg font-semibold text-card-foreground mb-4 border-t pt-6">Thông tin thanh toán</h3>
            {order.paymentStatus === 'Unpaid' && (
              <>
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Gửi link cho khách hàng để thanh toán online tiện lợi qua cổng VNPAY.
                  </p>
                  <button onClick={() => onGeneratePaymentLink(order)} className="btn-primary px-4 py-2 flex items-center gap-2 flex-shrink-0">
                    <CreditCardIcon className="w-5 h-5" />
                    Tạo link thanh toán VNPAY
                  </button>
                </div>
                <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Hoặc, sau khi nhận được tiền từ khách hàng, hãy nhấn nút xác nhận thủ công.
                  </p>
                  <button onClick={() => onConfirmPayment(order.id)} className="btn-secondary px-4 py-2 flex items-center gap-2 flex-shrink-0">
                    <CheckCircleIcon className="w-5 h-5" />
                    Xác nhận đã thanh toán
                  </button>
                </div>
              </>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted p-4 rounded-lg">
              <div className="space-y-4">
                <div className="text-sm">
                  <p className="font-medium text-muted-foreground">Ngân hàng</p>
                  <p className="text-card-foreground font-semibold">{getBankName(bankInfo.bin)}</p>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-muted-foreground">Số tài khoản</p>
                  <div className="flex items-center gap-2">
                    <p className="text-card-foreground font-semibold font-mono">{bankInfo.accountNumber}</p>
                    <CopyButton textToCopy={bankInfo.accountNumber} />
                  </div>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-muted-foreground">Chủ tài khoản</p>
                  <p className="text-card-foreground font-semibold">{bankInfo.accountName}</p>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-muted-foreground">Nội dung chuyển khoản</p>
                  <div className="flex items-center gap-2">
                    <p className="text-card-foreground font-semibold font-mono">{`Mixer ${order.id.substring(0, 8)}`}</p>
                    <CopyButton textToCopy={`Mixer ${order.id.substring(0, 8)}`} />
                  </div>
                </div>
              </div>
              <div className="flex justify-center items-center">
                <img
                  src={`https://img.vietqr.io/image/${bankInfo.bin}-${bankInfo.accountNumber}-compact2.png?amount=${order.totalAmount}&addInfo=${encodeURIComponent(`Mixer ${order.id.substring(0, 8)}`)}&accountName=${encodeURIComponent(bankInfo.accountName)}`}
                  alt="VietQR Code"
                  className="w-48 h-48 rounded-md border"
                />
              </div>
            </div>
          </div>
        )}

        {/* Shipping */}
        <div>
          <h3 className="text-lg font-semibold text-card-foreground mb-4 border-t pt-6">Tự động hoá Vận chuyển (Mô phỏng)</h3>

          {!order.trackingCode ? (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">Đơn hàng này chưa được tạo trên hệ thống của đơn vị vận chuyển.</p>
              <div className="flex items-center gap-4">
                <select value={shippingProvider} onChange={e => setShippingProvider(e.target.value)} className="input-base px-3 py-2 border">
                  <option value="GHTK">Giao Hàng Tiết Kiệm</option>
                  <option value="GHN">Giao Hàng Nhanh</option>
                  <option value="ViettelPost">Viettel Post</option>
                </select>
                <button onClick={handleCreateShippingOrder} disabled={isCreatingShipping} className="btn-secondary px-4 py-2 flex items-center gap-2 disabled:bg-gray-400">
                  {isCreatingShipping ? 'Đang tạo...' : 'Tạo đơn hàng'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">ĐVVC:</span>
                <span className="font-semibold text-primary">{order.shippingProvider}</span>
                <span className="font-medium">Mã vận đơn:</span>
                <span className="font-semibold text-primary font-mono">{order.trackingCode}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleFetchShippingStatus} disabled={isFetchingStatus} className="btn-muted px-4 py-2 flex items-center gap-2 text-sm disabled:bg-gray-400">
                  {isFetchingStatus ? 'Đang lấy...' : 'Lấy trạng thái đơn hàng'}
                </button>
                <button className="btn-muted px-4 py-2 text-sm">In nhãn vận đơn</button>
              </div>
              {shippingHistory && (
                <div className="p-3 border rounded-md max-h-40 overflow-y-auto">
                  <ul className="space-y-2 text-xs">
                    {shippingHistory.map((item, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <span className="font-mono text-muted-foreground">{item.time}</span>
                        <span className="font-semibold">{item.status}</span>
                        <span className="text-muted-foreground">- {item.location}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Discussion Section */}
        <div>
          <h3 className="text-lg font-semibold text-card-foreground mb-4 border-t pt-6">Thảo luận & Giao việc</h3>
          <div className="space-y-4">
            {order.discussion && order.discussion.length > 0 && (
              <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                {order.discussion.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold flex-shrink-0 mt-1 text-sm">{entry.authorAvatar}</div>
                    <div className="flex-grow bg-muted p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-card-foreground">{entry.authorName}</p>
                        <p className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString('vi-VN')}</p>
                      </div>
                      <p className="text-sm text-card-foreground whitespace-pre-wrap">{entry.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <DiscussionInput
              currentUser={currentUser}
              users={users}
              onAddDiscussion={(text) => onAddDiscussion(order.id, text)}
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          <ActivityFeed logs={orderActivity} title="Lịch sử Hoạt động Đơn hàng" />
        </div>
      </div>
    </Modal>
  );
};

export default OrderDetailModal;
