import React, { useState, useEffect } from 'react';
import type { Order } from '../types';
import { OrderStatus } from '../types';
import { EyeIcon, CheckCircleIcon, XMarkIcon, ClipboardDocumentIcon } from './icons';

interface QuickPaymentConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: Order[];
    onConfirmPayment: (orderId: string) => void;
}

const QuickPaymentConfirmModal: React.FC<QuickPaymentConfirmModalProps> = ({
    isOpen,
    onClose,
    orders,
    onConfirmPayment,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [foundOrder, setFoundOrder] = useState<Order | null>(null);
    const [notFound, setNotFound] = useState(false);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
            setFoundOrder(null);
            setNotFound(false);
        }
    }, [isOpen]);

    // Search for order when searchTerm changes
    useEffect(() => {
        if (searchTerm.length < 3) {
            setFoundOrder(null);
            setNotFound(false);
            return;
        }

        const term = searchTerm.toLowerCase().trim();

        // Search by order ID (full or partial), customer name, or phone
        const order = orders.find(o =>
            o.id.toLowerCase().includes(term) ||
            o.customerName.toLowerCase().includes(term) ||
            o.customerPhone.includes(term)
        );

        if (order) {
            setFoundOrder(order);
            setNotFound(false);
        } else {
            setFoundOrder(null);
            setNotFound(true);
        }
    }, [searchTerm, orders]);

    const handleConfirm = () => {
        if (foundOrder) {
            onConfirmPayment(foundOrder.id);
            onClose();
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            // Extract order code from notification text
            // Pattern: "MIXER be0648e9" or just "be0648e9"
            const match = text.match(/(?:MIXER\s+)?([a-f0-9]{6,8})/i);
            if (match) {
                setSearchTerm(match[1]);
            } else {
                setSearchTerm(text.trim().substring(0, 20));
            }
        } catch (e) {
            console.error('Failed to paste:', e);
        }
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    const getStatusBadge = (order: Order) => {
        if (order.paymentStatus === 'Paid') {
            return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Đã thanh toán ✓</span>;
        }
        if (order.paymentMethod === 'cod') {
            return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Thu hộ (COD)</span>;
        }
        return <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">Đợi chuyển khoản</span>;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card w-full max-w-md mx-4 rounded-xl shadow-2xl border border-border overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
                    <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                        <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        Xác nhận thanh toán nhanh
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
                        <XMarkIcon className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Search Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                            Nhập mã đơn hàng hoặc thông tin khách
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="VD: be0648e9 hoặc 0962885194"
                                    className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-background text-card-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={handlePaste}
                                className="px-3 py-2 bg-muted hover:bg-muted/80 text-muted-foreground rounded-lg transition-colors flex items-center gap-1"
                                title="Dán từ clipboard"
                            >
                                <ClipboardDocumentIcon className="w-4 h-4" />
                                Dán
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Copy mã đơn từ thông báo MB Bank rồi bấm "Dán"
                        </p>
                    </div>

                    {/* Found Order */}
                    {foundOrder && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                                    Tìm thấy đơn hàng!
                                </span>
                                {getStatusBadge(foundOrder)}
                            </div>

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Mã đơn:</span>
                                    <span className="font-mono font-medium">#{foundOrder.id.substring(0, 8)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Khách hàng:</span>
                                    <span className="font-medium">{foundOrder.customerName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">SĐT:</span>
                                    <span className="font-medium">{foundOrder.customerPhone}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tổng tiền:</span>
                                    <span className="font-bold text-primary">{formatCurrency(foundOrder.totalAmount)}</span>
                                </div>
                            </div>

                            {foundOrder.paymentStatus !== 'Paid' && (
                                <button
                                    onClick={handleConfirm}
                                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <CheckCircleIcon className="w-5 h-5" />
                                    Xác nhận đã thanh toán
                                </button>
                            )}

                            {foundOrder.paymentStatus === 'Paid' && (
                                <div className="text-center py-2 text-green-700 dark:text-green-300 text-sm">
                                    ✅ Đơn này đã được xác nhận thanh toán
                                </div>
                            )}
                        </div>
                    )}

                    {/* Not Found */}
                    {notFound && (
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                            <p className="text-sm text-orange-800 dark:text-orange-200">
                                ⚠️ Không tìm thấy đơn hàng với thông tin "{searchTerm}"
                            </p>
                            <p className="text-xs text-orange-600 dark:text-orange-300 mt-1">
                                Thử nhập mã đơn khác hoặc số điện thoại khách hàng
                            </p>
                        </div>
                    )}

                    {/* Hint when empty */}
                    {!foundOrder && !notFound && searchTerm.length < 3 && (
                        <div className="p-4 bg-muted/50 rounded-lg text-center">
                            <p className="text-sm text-muted-foreground">
                                Nhập ít nhất 3 ký tự để tìm kiếm
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-muted/30">
                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-muted hover:bg-muted/80 text-muted-foreground font-medium rounded-lg transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickPaymentConfirmModal;
