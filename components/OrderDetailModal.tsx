
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
  const [shippingProvider, setShippingProvider] = useState(order?.shippingProvider || 'Viettel Post');
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
      setShippingProvider(order.shippingProvider || 'Viettel Post');
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
      [OrderStatus.Pending]: 'bg-status-warning/10 text-status-warning border-status-warning/20',
      [OrderStatus.Processing]: 'bg-status-info/10 text-status-info border-status-info/20',
      [OrderStatus.Shipped]: 'bg-primary/10 text-primary border-primary/20',
      [OrderStatus.Delivered]: 'bg-status-success/10 text-status-success border-status-success/20',
      [OrderStatus.Cancelled]: 'bg-status-danger/10 text-status-danger border-status-danger/20',
    };
    return colors[status] || 'bg-muted text-muted-foreground border-border';
  };

  const getPaymentStatusInfo = (order: Order) => {
    if (order.paymentMethod === 'cod') {
      return { text: 'Thu hộ (COD)', color: 'bg-muted text-muted-foreground border-border/50' };
    }

    if (order.paymentStatus === 'Paid') {
      return { text: 'Đã thanh toán', color: 'bg-status-success/10 text-status-success border-status-success/20' };
    }

    return { text: 'Chờ thanh toán', color: 'bg-status-warning/10 text-status-warning border-status-warning/20' };
  };

  const handleCreateShippingOrder = async () => {
    if (!order) return;

    setIsCreatingShipping(true);
    try {
      // Gọi Viettel Post API để tạo vận đơn
      const response = await fetch('/api/viettelpost?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id.substring(0, 8),
          receiverName: order.customerName,
          receiverPhone: order.customerPhone,
          receiverAddress: order.shippingAddress,
          productName: order.items.map(i => i.productName).join(', '),
          productWeight: 500, // gram - mặc định
          productValue: order.totalAmount,
          moneyCollection: order.paymentMethod === 'cod' ? order.totalAmount : 0, // COD
          note: order.notes || ''
        })
      });

      const data = await response.json();

      if (data.success && data.trackingCode) {
        setTrackingCode(data.trackingCode);
        onUpdateShipping(order.id, 'Viettel Post', data.trackingCode);
        toast.success(`✅ Tạo vận đơn thành công! Mã: ${data.trackingCode}`);
      } else {
        toast.error(data.error || 'Không thể tạo vận đơn. Vui lòng thử lại.');
        console.error('VTP Error:', data);
      }
    } catch (error) {
      console.error('Error creating VTP order:', error);
      toast.error('Lỗi kết nối Viettel Post. Vui lòng thử lại.');
    } finally {
      setIsCreatingShipping(false);
    }
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
    <Modal isOpen={isOpen} onClose={onClose} title={`Đơn hàng #${order.id.substring(0, 8)}`}>
      <div className="space-y-8">
        {/* Header section - Soft Modern Box */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 p-6 bg-muted/20 border border-border/50 rounded-[24px] animate-in fade-in slide-in-from-top-4 duration-500">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border-2 ${getStatusColor(order.status)}`}>{order.status}</span>
              <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border-2 ${paymentStatusInfo.color}`}>{paymentStatusInfo.text}</span>
            </div>
            <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Ngày khởi tạo: {formatDate(order.orderDate)}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {order.status === OrderStatus.Delivered && (
              <button
                onClick={() => onOpenReturnRequest(order)}
                className="px-4 py-2.5 bg-accent-pink/5 text-accent-pink hover:bg-accent-pink hover:text-white rounded-xl transition-all font-black text-[12px] flex items-center gap-2 border border-accent-pink/20"
              >
                <ArrowUturnLeftIcon className="w-4 h-4" /> Đổi/Trả hàng
              </button>
            )}

            <button
              onClick={() => onOpenMessageTemplates(order)}
              className="px-4 py-2.5 bg-primary text-white hover:bg-primary-dark rounded-xl transition-all font-black text-[12px] flex items-center gap-2 shadow-soft-sm active:scale-95"
            >
              <ChatBubbleLeftEllipsisIcon className="w-4 h-4" /> Mẫu tin nhắn
            </button>

            <button
              onClick={() => onEdit(order)}
              className="px-4 py-2.5 bg-white text-foreground hover:bg-muted border border-border rounded-xl transition-all font-black text-[12px] flex items-center gap-2 shadow-soft-sm"
            >
              <PencilIcon className="w-4 h-4" /> Chỉnh sửa
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px] animate-in slide-in-from-left-4 duration-700">
            <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
              Khách hàng
            </h3>
            <div className="space-y-3">
              <p className="text-[16px] font-black text-foreground">{order.customerName}</p>
              <p className="text-[14px] font-bold text-muted-foreground/70">{order.customerPhone}</p>
              <div className="flex gap-2 items-start mt-2">
                <MapPinIcon className="w-4 h-4 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                <p className="text-[13px] font-bold text-muted-foreground opacity-80 leading-relaxed">{order.shippingAddress}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-border/50">
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
          <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px] animate-in slide-in-from-right-4 duration-700">
            <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-secondary rounded-full"></div>
              Sản phẩm
            </h3>
            <div className="space-y-4 max-h-[160px] overflow-y-auto custom-scrollbar pr-2 font-mono">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between items-start group">
                  <div className="flex gap-3">
                    <span className="text-[12px] font-black text-primary opacity-40">x{item.quantity}</span>
                    <div>
                      <p className="text-[14px] font-black text-foreground leading-none mb-1 group-hover:text-primary transition-colors">{item.productName}</p>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{item.size} • {item.color}</p>
                    </div>
                  </div>
                  <p className="text-[13px] font-black text-foreground">{formatCurrency(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-border/50 space-y-2">
              {order.discount && (
                <div className="flex justify-between items-center text-status-success">
                  <span className="text-[11px] font-black uppercase tracking-wider opacity-60">Ưu đãi ({order.discount.code}):</span>
                  <span className="text-[13px] font-black">- {formatCurrency(order.discount.amount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2">
                <span className="text-[12px] font-black uppercase tracking-[0.2em] text-muted-foreground">Tổng cộng:</span>
                <span className="text-[20px] font-black text-primary tracking-tight">{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bank Transfer Info - Re-styled */}
        {order.paymentMethod === 'bank_transfer' && bankInfo && (
          <div className="p-8 bg-muted/20 border border-border/50 rounded-[32px] animate-in fade-in duration-700">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-status-info rounded-full"></div>
                Thanh toán chuyển khoản
              </h3>
              {order.paymentStatus === 'Paid' && (
                <div className="px-3 py-1 bg-status-success/10 text-status-success text-[10px] font-black uppercase tracking-widest rounded-full border border-status-success/20">
                  Đã xác nhận
                </div>
              )}
            </div>

            {order.paymentStatus === 'Unpaid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <button
                  onClick={() => onGeneratePaymentLink(order)}
                  className="p-5 bg-white border-2 border-primary/20 rounded-2xl flex flex-col items-center gap-3 hover:bg-primary hover:text-white group transition-all duration-500 shadow-soft-sm hover:shadow-primary/20"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-white text-primary transition-all">
                    <CreditCardIcon className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-black uppercase tracking-wider">Tạo link thanh toán</p>
                    <p className="text-[10px] font-bold opacity-60">Gửi link VNPAY cho khách</p>
                  </div>
                </button>
                <button
                  onClick={() => onConfirmPayment(order.id)}
                  className="p-5 bg-white border-2 border-status-success/20 rounded-2xl flex flex-col items-center gap-3 hover:bg-status-success hover:text-white group transition-all duration-500 shadow-soft-sm hover:shadow-status-success/20"
                >
                  <div className="w-10 h-10 rounded-full bg-status-success/10 flex items-center justify-center group-hover:bg-white text-status-success transition-all">
                    <CheckCircleIcon className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-black uppercase tracking-wider">Xác nhận đơn</p>
                    <p className="text-[10px] font-bold opacity-60">Xác nhận tiền đã về túi</p>
                  </div>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center border border-border/30 bg-white/50 p-6 rounded-2xl backdrop-blur-sm shadow-soft-sm">
              <div className="md:col-span-12 lg:col-span-7 space-y-6">
                <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">Ngân hàng</p>
                    <p className="text-[14px] font-black text-foreground">{getBankName(bankInfo.bin)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">Chủ tài khoản</p>
                    <p className="text-[14px] font-black text-foreground">{bankInfo.accountName}</p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">Số tài khoản</p>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50 group hover:border-primary/30 transition-all">
                      <p className="text-[16px] font-black text-foreground font-mono tracking-tighter">{bankInfo.accountNumber}</p>
                      <CopyButton textToCopy={bankInfo.accountNumber} />
                    </div>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">Nội dung chuyển</p>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50 group hover:border-primary/30 transition-all">
                      <p className="text-[16px] font-black text-foreground font-mono tracking-tighter">{`Mixer ${order.id.substring(0, 8)}`}</p>
                      <CopyButton textToCopy={`Mixer ${order.id.substring(0, 8)}`} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="md:col-span-12 lg:col-span-5 flex flex-col items-center justify-center p-4 bg-white rounded-3xl border-2 border-primary/5 shadow-soft-lg">
                <img
                  src={`https://img.vietqr.io/image/${bankInfo.bin}-${bankInfo.accountNumber}-compact2.png?amount=${order.totalAmount}&addInfo=${encodeURIComponent(`Mixer ${order.id.substring(0, 8)}`)}&accountName=${encodeURIComponent(bankInfo.accountName)}`}
                  alt="VietQR Code"
                  className="w-48 h-48 rounded-xl"
                />
                <div className="mt-4 flex items-center gap-1.5">
                  <QrCodeIcon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Scan to Pay via VietQR</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Shipping - Mobile/Soft Modern Style */}
        <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px] animate-in fade-in duration-700 delay-100">
          <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-accent-pink rounded-full"></div>
            Vận chuyển (Viettel Post)
          </h3>

          {!order.trackingCode ? (
            <div className="space-y-6">
              {/* Nút tạo vận đơn tự động - Premium Card */}
              <div className="p-5 bg-primary/5 border border-primary/20 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shadow-soft-sm">
                    <TruckIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[14px] font-black text-primary uppercase tracking-tight">Tạo vận đơn tự động</p>
                    <p className="text-[10px] font-bold text-primary/60">Gửi thông tin cho Viettel Post chỉ với 1 click</p>
                  </div>
                </div>

                <button
                  onClick={handleCreateShippingOrder}
                  disabled={isCreatingShipping}
                  className="w-full py-4 bg-primary text-white rounded-xl flex items-center justify-center gap-2 font-black text-[14px] shadow-soft-lg active:scale-95 disabled:opacity-50 transition-all"
                >
                  {isCreatingShipping ? (
                    <>⏳ Đang tạo vận đơn...</>
                  ) : (
                    <>📦 Bắt đầu tạo Vận đơn</>
                  )}
                </button>
              </div>

              {/* Hoặc nhập thủ công - Clean Divider */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50"></div></div>
                <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 bg-muted/5 px-2">Hoặc nhập thủ công</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Đơn vị VC</label>
                  <select
                    value={shippingProvider}
                    onChange={e => setShippingProvider(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-border rounded-xl text-sm font-bold outline-none cursor-pointer appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25rem' }}
                  >
                    <option value="Viettel Post">Viettel Post</option>
                    <option value="GHTK">Giao Hàng Tiết Kiệm</option>
                    <option value="GHN">Giao Hàng Nhanh</option>
                    <option value="J&T Express">J&T Express</option>
                    <option value="Shopee Express">Shopee Express</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Mã vận đơn</label>
                  <input
                    type="text"
                    value={trackingCode}
                    onChange={e => setTrackingCode(e.target.value)}
                    placeholder="VD: 123456789"
                    className="w-full px-4 py-3 bg-white border border-border rounded-xl text-sm font-black font-mono outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                  />
                </div>
                <button
                  onClick={() => {
                    if (trackingCode.trim()) {
                      onUpdateShipping(order.id, shippingProvider, trackingCode.trim());
                    } else {
                      toast.error('Vui lòng nhập mã vận đơn');
                    }
                  }}
                  disabled={!trackingCode.trim()}
                  className="md:col-span-2 py-3.5 bg-secondary text-white rounded-xl flex items-center justify-center gap-2 font-black text-[13px] active:scale-95 disabled:opacity-50 transition-all shadow-soft-sm"
                >
                  Lưu thông tin vận chuyển
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-5 bg-white border border-border/50 rounded-2xl flex items-center justify-between shadow-soft-sm">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">Đối tác vận chuyển</p>
                  <p className="text-[15px] font-black text-primary capitalize">{order.shippingProvider}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">Mã vận đơn</p>
                  <div className="flex items-center gap-2 justify-end">
                    <p className="text-[15px] font-black text-foreground font-mono">{order.trackingCode}</p>
                    <CopyButton textToCopy={order.trackingCode || ''} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleFetchShippingStatus}
                  disabled={isFetchingStatus}
                  className="flex-1 py-3 bg-muted text-foreground rounded-xl flex items-center justify-center gap-2 font-black text-[12px] hover:bg-muted/80 transition-all border border-border/30 disabled:opacity-50"
                >
                  <div className={`w-2 h-2 rounded-full ${isFetchingStatus ? 'bg-primary animate-pulse' : 'bg-primary'}`}></div>
                  {isFetchingStatus ? 'Đang cập nhật...' : 'Cập nhật hành trình'}
                </button>
                <button className="flex-1 py-3 bg-muted text-foreground rounded-xl flex items-center justify-center gap-2 font-black text-[12px] hover:bg-muted/80 transition-all border border-border/30">
                  <ClipboardDocumentIcon className="w-4 h-4 text-muted-foreground/60" />
                  In nhãn vận đơn
                </button>
              </div>

              {shippingHistory && (
                <div className="p-5 bg-white rounded-2xl border border-border/50 shadow-soft-sm max-h-56 overflow-y-auto custom-scrollbar">
                  <div className="space-y-6 relative">
                    <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-border/40"></div>
                    {shippingHistory.map((item, index) => (
                      <div key={index} className="flex gap-4 relative pl-6">
                        <div className={`absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm transition-all ${index === 0 ? 'bg-primary animate-bounce' : 'bg-muted-foreground/30'}`}></div>
                        <div className="space-y-1">
                          <p className="text-[13px] font-black text-foreground leading-tight">{item.status}</p>
                          <p className="text-[11px] font-bold text-muted-foreground opacity-60 leading-none">{item.location} • {item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Discussion & History */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 p-6 bg-muted/20 border border-border/50 rounded-[28px]">
            <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-status-info rounded-full"></div>
              Thảo luận nội bộ
            </h3>
            <div className="space-y-6">
              {order.discussion && order.discussion.length > 0 && (
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-3 custom-scrollbar">
                  {order.discussion.map(entry => (
                    <div key={entry.id} className="flex items-start gap-3 animate-in fade-in duration-500">
                      <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-[14px] flex-shrink-0 border border-primary/20">{entry.authorAvatar}</div>
                      <div className="flex-grow bg-white p-4 rounded-2xl border border-border/30 shadow-soft-sm">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-black text-[13px] text-foreground">{entry.authorName}</p>
                          <p className="text-[10px] font-bold text-muted-foreground opacity-50 uppercase tracking-wider">{new Date(entry.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {new Date(entry.timestamp).toLocaleDateString('vi-VN')}</p>
                        </div>
                        <p className="text-[14px] font-bold text-muted-foreground/80 leading-relaxed whitespace-pre-wrap">{entry.text}</p>
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

          <div className="lg:col-span-5 max-h-[480px] overflow-y-auto custom-scrollbar p-6 bg-muted/20 border border-border/50 rounded-[28px]">
            <ActivityFeed logs={orderActivity} title="Lịch sử vận hành" />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default OrderDetailModal;
