
import React, { useState, useMemo } from 'react';
import type { Order, Product, Customer, Voucher, BankInfo, OrderItem } from '../types';
import { OrderStatus } from '../types';
import {
    PlusIcon, ChatBubbleLeftEllipsisIcon, QrCodeIcon, ShoppingBagIcon,
    ClockIcon, SparklesIcon, Cog6ToothIcon, PhoneIcon, MapPinIcon,
    ClipboardDocumentIcon, BanknotesIcon
} from './icons';
import ConversationParser from './ConversationParser';
import QuickCopyButton from './QuickCopyButton';
import Modal from './Modal';
import FacebookInbox from './FacebookInbox';

interface InboxCommandCenterProps {
    products: Product[];
    customers: Customer[];
    orders: Order[];
    vouchers: Voucher[];
    bankInfo: BankInfo | null;
    onCreateOrder: (order: Partial<Order>) => void;
    onViewOrder: (order: Order) => void;
    onOpenOrderForm: (order: Partial<Order> | null) => void;
}

// Default message templates
const defaultTemplates = [
    {
        id: 'greeting',
        name: '👋 Chào hàng',
        template: 'Dạ chào {{customer_name}}! Cảm ơn bạn đã quan tâm đến sản phẩm của shop ạ. Bên em hiện có {{product_name}} với giá {{price}}. Bạn cần size/màu gì để em kiểm tra tồn kho ạ?',
        category: 'sales'
    },
    {
        id: 'confirm_order',
        name: '✅ Xác nhận đơn',
        template: `Dạ em xác nhận đơn hàng của {{customer_name}}:

📦 Sản phẩm: {{items_list}}
💰 Tổng tiền: {{total}}
📍 Địa chỉ: {{shipping_address}}
📱 SĐT: {{customer_phone}}

Bạn kiểm tra lại giúp em nhé! Em sẽ ship trong 1-2 ngày ạ 🚚`,
        category: 'order'
    },
    {
        id: 'payment_guide',
        name: '💳 Hướng dẫn CK',
        template: `Dạ bạn chuyển khoản theo thông tin sau ạ:

🏦 Ngân hàng: {{bank_name}}
💳 STK: {{account_number}}
👤 Chủ TK: {{account_name}}
💰 Số tiền: {{amount}}
📝 Nội dung: {{transfer_content}}

Sau khi CK xong bạn gửi em bill để em xác nhận nhé ạ! 🙏`,
        category: 'payment'
    },
    {
        id: 'shipped',
        name: '🚚 Đã ship',
        template: `Dạ {{customer_name}} ơi, đơn hàng của bạn đã được gửi đi rồi ạ!

📦 Đơn vị VC: {{shipping_provider}}
🔢 Mã vận đơn: {{tracking_code}}

Bạn có thể tra cứu tại website của đơn vị vận chuyển nhé! Dự kiến 2-3 ngày sẽ nhận được hàng ạ 📦✨`,
        category: 'shipping'
    },
    {
        id: 'payment_reminder',
        name: '⏰ Nhắc thanh toán',
        template: `Dạ {{customer_name}} ơi, em thấy đơn hàng #{{order_id}} chưa được thanh toán ạ.

💰 Tổng tiền: {{total}}

Bạn CK giúp em để em gửi hàng sớm nhé! Nếu có thắc mắc gì cứ inbox em ạ 🙏`,
        category: 'payment'
    },
    {
        id: 'thank_you',
        name: '🙏 Cảm ơn',
        template: `Cảm ơn {{customer_name}} đã mua hàng tại shop ạ! 💕

Nếu hài lòng với sản phẩm, bạn để lại đánh giá 5⭐ giúp shop nhé! Hẹn gặp lại bạn trong những đơn hàng tiếp theo ạ 🥰`,
        category: 'after_sale'
    },
    {
        id: 'ask_feedback',
        name: '📝 Hỏi feedback',
        template: `Dạ {{customer_name}} ơi, bạn đã nhận được {{product_name}} chưa ạ? 

Sản phẩm có vừa ý bạn không ạ? Nếu có vấn đề gì cứ inbox em để được hỗ trợ nhé! 🙏`,
        category: 'after_sale'
    }
];

const InboxCommandCenter: React.FC<InboxCommandCenterProps> = ({
    products,
    customers,
    orders,
    vouchers,
    bankInfo,
    onCreateOrder,
    onViewOrder,
    onOpenOrderForm
}) => {
    // Quick Order Form State
    const [quickOrderData, setQuickOrderData] = useState({
        customerName: '',
        customerPhone: '',
        shippingAddress: '',
        selectedProductId: '',
        selectedVariantId: '',
        quantity: 1,
        paymentMethod: 'cod' as 'cod' | 'bank_transfer'
    });

    // Template State
    const [templates, setTemplates] = useState(defaultTemplates);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
    const [isTemplateSettingsOpen, setIsTemplateSettingsOpen] = useState(false);

    // QR State
    const [showQR, setShowQR] = useState(false);
    const [qrAmount, setQrAmount] = useState('');
    const [qrContent, setQrContent] = useState('');

    // Active Tab State
    const [activeTab, setActiveTab] = useState<'tools' | 'messenger'>('tools');

    // Recent orders (last 10, pending first)
    const recentOrders = useMemo(() => {
        return [...orders]
            .sort((a, b) => {
                // Pending/Processing first
                const statusOrder = { 'Chờ xử lý': 0, 'Đang xử lý': 1, 'Đã gửi hàng': 2, 'Đã giao hàng': 3, 'Đã hủy': 4 };
                const statusDiff = (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
                if (statusDiff !== 0) return statusDiff;
                return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
            })
            .slice(0, 10);
    }, [orders]);

    // Pending orders count
    const pendingCount = useMemo(() => {
        return orders.filter(o => o.status === OrderStatus.Pending || o.status === OrderStatus.Processing).length;
    }, [orders]);

    // Selected product info
    const selectedProduct = useMemo(() => {
        return products.find(p => p.id === quickOrderData.selectedProductId);
    }, [products, quickOrderData.selectedProductId]);

    const selectedVariant = useMemo(() => {
        return selectedProduct?.variants.find(v => v.id === quickOrderData.selectedVariantId);
    }, [selectedProduct, quickOrderData.selectedVariantId]);

    // Format currency
    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    // Handle quick order submit
    const handleQuickOrder = () => {
        if (!quickOrderData.customerName || !quickOrderData.customerPhone || !selectedProduct || !selectedVariant) {
            return;
        }

        const orderItem: OrderItem = {
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            variantId: selectedVariant.id,
            size: selectedVariant.size,
            color: selectedVariant.color,
            quantity: quickOrderData.quantity,
            price: selectedProduct.price,
            costPrice: selectedProduct.costPrice
        };

        const newOrder: Partial<Order> = {
            customerName: quickOrderData.customerName,
            customerPhone: quickOrderData.customerPhone,
            shippingAddress: quickOrderData.shippingAddress,
            items: [orderItem],
            paymentMethod: quickOrderData.paymentMethod,
        };

        onOpenOrderForm(newOrder);

        // Reset form
        setQuickOrderData({
            customerName: '',
            customerPhone: '',
            shippingAddress: '',
            selectedProductId: '',
            selectedVariantId: '',
            quantity: 1,
            paymentMethod: 'cod'
        });
    };

    // Handle AI parser result
    const handleAIOrderData = (orderData: Partial<Order>, customerData: Partial<Customer>) => {
        onOpenOrderForm(orderData);
    };

    // Get template with variables replaced
    const getFilledTemplate = (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (!template) return '';

        let filled = template.template;

        // Replace variables
        Object.entries(templateVars).forEach(([key, value]) => {
            filled = filled.replace(new RegExp(`{{${key}}}`, 'g'), value || `[${key}]`);
        });

        // Replace remaining variables with placeholders
        filled = filled.replace(/{{(\w+)}}/g, '[$1]');

        return filled;
    };

    // Generate VietQR URL
    const getVietQRUrl = () => {
        if (!bankInfo) return '';
        const amount = qrAmount ? parseInt(qrAmount.replace(/\D/g, '')) : 0;
        const content = encodeURIComponent(qrContent || 'Thanh toan');
        return `https://img.vietqr.io/image/${bankInfo.bin}-${bankInfo.accountNumber}-compact2.png?amount=${amount}&addInfo=${content}&accountName=${encodeURIComponent(bankInfo.accountName)}`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-card-foreground flex items-center gap-2">
                        <ChatBubbleLeftEllipsisIcon className="w-7 h-7 text-primary" />
                        Inbox Command Center
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        Tất cả công cụ bạn cần khi đang inbox với khách hàng
                    </p>
                </div>

                {pendingCount > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-full">
                        <ClockIcon className="w-5 h-5 text-yellow-600" />
                        <span className="text-yellow-700 dark:text-yellow-400 font-medium text-sm">
                            {pendingCount} đơn chờ xử lý
                        </span>
                    </div>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-border">
                <button
                    onClick={() => setActiveTab('tools')}
                    className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 -mb-px ${activeTab === 'tools'
                            ? 'text-primary border-primary'
                            : 'text-muted-foreground border-transparent hover:text-foreground'
                        }`}
                >
                    🛠️ Công cụ bán hàng
                </button>
                <button
                    onClick={() => setActiveTab('messenger')}
                    className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 -mb-px ${activeTab === 'messenger'
                            ? 'text-primary border-primary'
                            : 'text-muted-foreground border-transparent hover:text-foreground'
                        }`}
                >
                    💬 Facebook Messenger
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'messenger' ? (
                <FacebookInbox />
            ) : (

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Quick Order & AI Parser */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Quick Order Form */}
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <h3 className="font-semibold text-card-foreground mb-4 flex items-center gap-2">
                                <PlusIcon className="w-5 h-5 text-primary" />
                                Tạo đơn nhanh
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Tên khách *</label>
                                    <input
                                        type="text"
                                        value={quickOrderData.customerName}
                                        onChange={(e) => setQuickOrderData(prev => ({ ...prev, customerName: e.target.value }))}
                                        className="w-full p-2.5 border border-input rounded-lg bg-card"
                                        placeholder="Nguyễn Văn A"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Số điện thoại *</label>
                                    <input
                                        type="tel"
                                        value={quickOrderData.customerPhone}
                                        onChange={(e) => setQuickOrderData(prev => ({ ...prev, customerPhone: e.target.value }))}
                                        className="w-full p-2.5 border border-input rounded-lg bg-card"
                                        placeholder="0901234567"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Địa chỉ giao hàng</label>
                                    <input
                                        type="text"
                                        value={quickOrderData.shippingAddress}
                                        onChange={(e) => setQuickOrderData(prev => ({ ...prev, shippingAddress: e.target.value }))}
                                        className="w-full p-2.5 border border-input rounded-lg bg-card"
                                        placeholder="123 Đường ABC, Quận 1, TP.HCM"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Sản phẩm *</label>
                                    <select
                                        value={quickOrderData.selectedProductId}
                                        onChange={(e) => setQuickOrderData(prev => ({
                                            ...prev,
                                            selectedProductId: e.target.value,
                                            selectedVariantId: ''
                                        }))}
                                        className="w-full p-2.5 border border-input rounded-lg bg-card"
                                    >
                                        <option value="">-- Chọn sản phẩm --</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} - {formatCurrency(p.price)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Size / Màu *</label>
                                    <select
                                        value={quickOrderData.selectedVariantId}
                                        onChange={(e) => setQuickOrderData(prev => ({ ...prev, selectedVariantId: e.target.value }))}
                                        className="w-full p-2.5 border border-input rounded-lg bg-card"
                                        disabled={!selectedProduct}
                                    >
                                        <option value="">-- Chọn biến thể --</option>
                                        {selectedProduct?.variants.map(v => (
                                            <option key={v.id} value={v.id} disabled={v.stock === 0}>
                                                {v.size} - {v.color} (Còn {v.stock})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Số lượng</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={quickOrderData.quantity}
                                        onChange={(e) => setQuickOrderData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                                        className="w-full p-2.5 border border-input rounded-lg bg-card"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Thanh toán</label>
                                    <select
                                        value={quickOrderData.paymentMethod}
                                        onChange={(e) => setQuickOrderData(prev => ({ ...prev, paymentMethod: e.target.value as 'cod' | 'bank_transfer' }))}
                                        className="w-full p-2.5 border border-input rounded-lg bg-card"
                                    >
                                        <option value="cod">COD - Thu hộ</option>
                                        <option value="bank_transfer">Chuyển khoản</option>
                                    </select>
                                </div>
                            </div>

                            {selectedProduct && selectedVariant && (
                                <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                                    <p className="text-sm font-medium text-primary">
                                        Tổng: {formatCurrency(selectedProduct.price * quickOrderData.quantity)}
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={handleQuickOrder}
                                disabled={!quickOrderData.customerName || !quickOrderData.customerPhone || !selectedVariant}
                                className="mt-4 w-full py-3 bg-primary text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                <SparklesIcon className="w-5 h-5" />
                                Tạo đơn hàng
                            </button>
                        </div>

                        {/* AI Conversation Parser */}
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <ConversationParser
                                products={products}
                                onOrderDataReady={handleAIOrderData}
                            />
                        </div>
                    </div>

                    {/* Right Column - Templates, QR, Recent Orders */}
                    <div className="space-y-6">
                        {/* Message Templates */}
                        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-card-foreground flex items-center gap-2">
                                    <ClipboardDocumentIcon className="w-5 h-5 text-primary" />
                                    Mẫu tin nhắn
                                </h3>
                                <button
                                    onClick={() => setIsTemplateSettingsOpen(true)}
                                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                                >
                                    <Cog6ToothIcon className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {templates.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => {
                                            setSelectedTemplate(t.id);
                                            setTemplateVars({});
                                        }}
                                        className={`p-2 text-xs font-medium rounded-lg border transition-all text-left ${selectedTemplate === t.id
                                            ? 'bg-primary text-white border-primary'
                                            : 'bg-muted/50 border-border hover:bg-muted hover:border-primary/50'
                                            }`}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>

                            {selectedTemplate && (
                                <div className="space-y-3 animate-fade-in">
                                    <div className="space-y-2">
                                        <label className="text-xs text-muted-foreground">Điền thông tin:</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['customer_name', 'customer_phone', 'total', 'order_id'].map(v => (
                                                <input
                                                    key={v}
                                                    type="text"
                                                    placeholder={v.replace('_', ' ')}
                                                    value={templateVars[v] || ''}
                                                    onChange={(e) => setTemplateVars(prev => ({ ...prev, [v]: e.target.value }))}
                                                    className="p-2 text-xs border border-input rounded-md bg-card"
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                                        {getFilledTemplate(selectedTemplate)}
                                    </div>

                                    <QuickCopyButton
                                        text={getFilledTemplate(selectedTemplate)}
                                        label="Copy tin nhắn"
                                        className="w-full justify-center"
                                    />
                                </div>
                            )}
                        </div>

                        {/* QR Code Generator */}
                        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
                            <h3 className="font-semibold text-card-foreground mb-4 flex items-center gap-2">
                                <QrCodeIcon className="w-5 h-5 text-primary" />
                                QR Thanh toán (MB Bank)
                            </h3>

                            {bankInfo ? (
                                <div className="space-y-3">
                                    <div className="text-sm text-muted-foreground">
                                        <p><span className="font-medium">STK:</span> {bankInfo.accountNumber}</p>
                                        <p><span className="font-medium">Chủ TK:</span> {bankInfo.accountName}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            placeholder="Số tiền"
                                            value={qrAmount}
                                            onChange={(e) => setQrAmount(e.target.value)}
                                            className="p-2 text-sm border border-input rounded-md bg-card"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Nội dung CK"
                                            value={qrContent}
                                            onChange={(e) => setQrContent(e.target.value)}
                                            className="p-2 text-sm border border-input rounded-md bg-card"
                                        />
                                    </div>

                                    <button
                                        onClick={() => setShowQR(true)}
                                        className="w-full py-2 bg-primary/10 text-primary rounded-lg font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <QrCodeIcon className="w-4 h-4" />
                                        Tạo mã QR
                                    </button>

                                    <div className="flex gap-2">
                                        <QuickCopyButton
                                            text={bankInfo.accountNumber}
                                            label="STK"
                                            variant="compact"
                                            className="flex-1 justify-center"
                                        />
                                        <QuickCopyButton
                                            text={qrContent || 'Thanh toan'}
                                            label="Nội dung"
                                            variant="compact"
                                            className="flex-1 justify-center"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    Chưa cấu hình thông tin ngân hàng
                                </p>
                            )}
                        </div>

                        {/* Recent Orders */}
                        <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
                            <h3 className="font-semibold text-card-foreground mb-4 flex items-center gap-2">
                                <ShoppingBagIcon className="w-5 h-5 text-primary" />
                                Đơn hàng gần đây
                            </h3>

                            <div className="space-y-2 max-h-80 overflow-y-auto">
                                {recentOrders.length > 0 ? recentOrders.map(order => (
                                    <div
                                        key={order.id}
                                        onClick={() => onViewOrder(order)}
                                        className="p-3 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-medium text-sm text-card-foreground">{order.customerName}</p>
                                                <p className="text-xs text-muted-foreground">#{order.id.substring(0, 8)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold text-primary">{formatCurrency(order.totalAmount)}</p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === OrderStatus.Pending ? 'bg-yellow-100 text-yellow-700' :
                                                    order.status === OrderStatus.Processing ? 'bg-blue-100 text-blue-700' :
                                                        order.status === OrderStatus.Shipped ? 'bg-purple-100 text-purple-700' :
                                                            order.status === OrderStatus.Delivered ? 'bg-green-100 text-green-700' :
                                                                'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {order.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-2 flex gap-2">
                                            <QuickCopyButton
                                                text={order.customerPhone}
                                                icon={<PhoneIcon className="w-3 h-3" />}
                                                variant="compact"
                                            />
                                            <QuickCopyButton
                                                text={order.shippingAddress}
                                                icon={<MapPinIcon className="w-3 h-3" />}
                                                variant="compact"
                                            />
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">Chưa có đơn hàng nào</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Modal */}
            <Modal isOpen={showQR} onClose={() => setShowQR(false)} title="Mã QR Thanh toán - MB Bank">
                <div className="text-center space-y-4">
                    {bankInfo && (
                        <>
                            <img
                                src={getVietQRUrl()}
                                alt="VietQR"
                                className="mx-auto rounded-xl shadow-lg max-w-[280px]"
                            />
                            <div className="text-sm">
                                <p className="font-medium">{bankInfo.accountName}</p>
                                <p className="text-muted-foreground">{bankInfo.accountNumber} - MB Bank</p>
                                {qrAmount && <p className="text-primary font-bold text-lg mt-2">{formatCurrency(parseInt(qrAmount.replace(/\D/g, '')) || 0)}</p>}
                                {qrContent && <p className="text-muted-foreground">Nội dung: {qrContent}</p>}
                            </div>
                            <div className="flex gap-2 justify-center">
                                <QuickCopyButton text={bankInfo.accountNumber} label="Copy STK" />
                                <QuickCopyButton text={qrContent || 'Thanh toan'} label="Copy ND" />
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            {/* Template Settings Modal */}
            <Modal isOpen={isTemplateSettingsOpen} onClose={() => setIsTemplateSettingsOpen(false)} title="Cài đặt mẫu tin nhắn">
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Tính năng tùy chỉnh mẫu tin nhắn sẽ được thêm trong phiên bản tiếp theo.
                    </p>
                    <div className="bg-muted/50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Các biến có thể sử dụng:</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <code className="bg-muted p-1 rounded">{'{{customer_name}}'}</code>
                            <code className="bg-muted p-1 rounded">{'{{customer_phone}}'}</code>
                            <code className="bg-muted p-1 rounded">{'{{total}}'}</code>
                            <code className="bg-muted p-1 rounded">{'{{order_id}}'}</code>
                            <code className="bg-muted p-1 rounded">{'{{shipping_address}}'}</code>
                            <code className="bg-muted p-1 rounded">{'{{items_list}}'}</code>
                            <code className="bg-muted p-1 rounded">{'{{tracking_code}}'}</code>
                            <code className="bg-muted p-1 rounded">{'{{bank_name}}'}</code>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default InboxCommandCenter;
