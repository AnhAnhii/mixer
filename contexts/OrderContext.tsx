import React, { createContext, useContext, useCallback } from 'react';
import type { Order, Customer, BankInfo } from '../types';
import { OrderStatus } from '../types';
import { useOrdersData } from '../hooks/useData';
import { syncOrderDirect } from '../services/googleSheetsService';
import { sendOrderStatusToCustomer, getVietQRUrl } from '../utils/facebook';
import { formatOrderId } from '../utils/formatters';

interface OrderContextValue {
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    isLoading: boolean;

    saveOrder: (order: Order, customerToSave: Customer, opts: {
        isEditing: boolean;
        currentUserName?: string;
        addCustomer: (c: Omit<Customer, 'id'>) => Promise<Customer | null>;
        updateCustomer: (id: string, c: Partial<Customer>) => Promise<boolean>;
        customers: Customer[];
        logActivity: (desc: string, entityId?: string, entityType?: string) => void;
        runAutomations: (trigger: 'ORDER_CREATED', payload: { order: Order }) => void;
    }) => Promise<void>;

    deleteOrder: (orderId: string, currentUserName?: string, logActivity?: (desc: string, entityId?: string, entityType?: string) => void) => Promise<void>;
    updateStatus: (orderId: string, status: OrderStatus, opts: {
        currentUserName?: string;
        bankInfo: BankInfo | null;
        logActivity: (desc: string, entityId?: string, entityType?: string) => void;
    }) => Promise<void>;

    confirmPayment: (orderId: string, opts: {
        currentUserName?: string;
        bankInfo: BankInfo | null;
        logActivity: (desc: string, entityId?: string, entityType?: string) => void;
    }) => Promise<void>;

    updateShipping: (orderId: string, provider: string, trackingCode: string, opts: {
        currentUserName?: string;
        bankInfo: BankInfo | null;
        logActivity: (desc: string, entityId?: string, entityType?: string) => void;
    }) => Promise<void>;
}

const OrderContext = createContext<OrderContextValue | null>(null);

export function OrderProvider({ children }: { children: React.ReactNode }) {
    const {
        orders,
        setOrders,
        addOrder,
        updateOrder,
        deleteOrder: deleteOrderFromDb,
        isLoading,
    } = useOrdersData();

    const handleDeleteOrder = useCallback(async (
        orderId: string,
        currentUserName?: string,
        logActivity?: (desc: string, entityId?: string, entityType?: string) => void,
    ) => {
        await deleteOrderFromDb(orderId);
        logActivity?.(
            `<strong>${currentUserName}</strong> đã xóa đơn hàng <strong>#${formatOrderId(orderId)}</strong>.`,
            orderId,
            'order',
        );
        syncOrderDirect({ id: orderId } as Order, 'delete').catch(console.error);
    }, [deleteOrderFromDb]);

    const handleUpdateStatus = useCallback(async (
        orderId: string,
        status: OrderStatus,
        opts: {
            currentUserName?: string;
            bankInfo: BankInfo | null;
            logActivity: (desc: string, entityId?: string, entityType?: string) => void;
        },
    ) => {
        await updateOrder(orderId, { status });
        opts.logActivity(
            `<strong>${opts.currentUserName}</strong> đã cập nhật trạng thái đơn hàng <strong>#${formatOrderId(orderId)}</strong> thành <strong>${status}</strong>.`,
            orderId,
            'order',
        );

        const orderToSync = orders.find((o) => o.id === orderId);
        if (orderToSync) {
            syncOrderDirect({ ...orderToSync, status, staffName: opts.currentUserName } as Order & { staffName?: string }, 'update').catch(console.error);

            if (orderToSync.facebookUserId) {
                const updatedOrder = { ...orderToSync, status };
                if (['Đang xử lý', 'Đã gửi hàng', 'Đã giao hàng'].includes(status)) {
                    sendOrderStatusToCustomer(updatedOrder, status as 'Đang xử lý' | 'Đã gửi hàng' | 'Đã giao hàng', opts.bankInfo);
                }
            }
        }
    }, [orders, updateOrder]);

    const handleConfirmPayment = useCallback(async (
        orderId: string,
        opts: {
            currentUserName?: string;
            bankInfo: BankInfo | null;
            logActivity: (desc: string, entityId?: string, entityType?: string) => void;
        },
    ) => {
        await updateOrder(orderId, { paymentStatus: 'Paid', status: OrderStatus.Processing });
        opts.logActivity(
            `<strong>${opts.currentUserName}</strong> đã xác nhận thanh toán cho đơn hàng <strong>#${formatOrderId(orderId)}</strong>.`,
            orderId,
            'order',
        );

        const orderToSync = orders.find((o) => o.id === orderId);
        if (orderToSync) {
            syncOrderDirect({
                ...orderToSync,
                paymentStatus: 'Paid',
                status: OrderStatus.Processing,
                staffName: opts.currentUserName,
            } as Order & { staffName?: string }, 'update').catch(console.error);

            if (orderToSync.facebookUserId) {
                sendOrderStatusToCustomer(
                    { ...orderToSync, paymentStatus: 'Paid', status: OrderStatus.Processing },
                    'Đang xử lý',
                    opts.bankInfo,
                ).catch(console.error);
            }
        }
    }, [orders, updateOrder]);

    const handleUpdateShipping = useCallback(async (
        orderId: string,
        provider: string,
        trackingCode: string,
        opts: {
            currentUserName?: string;
            bankInfo: BankInfo | null;
            logActivity: (desc: string, entityId?: string, entityType?: string) => void;
        },
    ) => {
        const updates = {
            shippingProvider: provider,
            trackingCode,
            status: OrderStatus.Shipped,
        };

        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)));
        await updateOrder(orderId, updates);

        opts.logActivity(
            `<strong>${opts.currentUserName}</strong> đã cập nhật vận chuyển cho đơn <strong>#${formatOrderId(orderId)}</strong>: ${provider} - ${trackingCode}`,
            orderId,
            'order',
        );

        const orderToSync = orders.find((o) => o.id === orderId);
        if (orderToSync) {
            syncOrderDirect({
                ...orderToSync,
                ...updates,
                staffName: opts.currentUserName,
            } as Order & { staffName?: string }, 'update').catch(console.error);

            if (orderToSync.facebookUserId) {
                sendOrderStatusToCustomer(
                    { ...orderToSync, shippingProvider: provider, trackingCode },
                    'Đã gửi hàng',
                    opts.bankInfo,
                );
            }
        }
    }, [orders, setOrders, updateOrder]);

    const handleSaveOrder = useCallback(async (
        order: Order,
        customerToSave: Customer,
        opts: {
            isEditing: boolean;
            currentUserName?: string;
            addCustomer: (c: Omit<Customer, 'id'>) => Promise<Customer | null>;
            updateCustomer: (id: string, c: Partial<Customer>) => Promise<boolean>;
            customers: Customer[];
            logActivity: (desc: string, entityId?: string, entityType?: string) => void;
            runAutomations: (trigger: 'ORDER_CREATED', payload: { order: Order }) => void;
        },
    ) => {
        const orderIdShort = formatOrderId(order.id);

        // Save/Update customer
        const existingCustomer = opts.customers.find((c) => c.id === customerToSave.id);
        if (existingCustomer) {
            await opts.updateCustomer(customerToSave.id, customerToSave);
        } else {
            const { id: _, ...customerWithoutId } = customerToSave;
            await opts.addCustomer(customerWithoutId);
        }

        // Save/Update order
        if (opts.isEditing) {
            await updateOrder(order.id, order);
            opts.logActivity(
                `<strong>${opts.currentUserName}</strong> đã cập nhật đơn hàng <strong>#${orderIdShort}</strong>.`,
                order.id,
                'order',
            );
            syncOrderDirect({ ...order, staffName: opts.currentUserName } as Order & { staffName?: string }, 'update').catch(console.error);
        } else {
            const { id: _, ...orderWithoutId } = order;
            const newOrder = await addOrder(orderWithoutId);
            if (newOrder) {
                opts.logActivity(
                    `<strong>${opts.currentUserName}</strong> đã tạo đơn hàng mới <strong>#${formatOrderId(newOrder.id)}</strong>.`,
                    newOrder.id,
                    'order',
                );
                opts.runAutomations('ORDER_CREATED', { order: newOrder });
                syncOrderDirect({ ...newOrder, staffName: opts.currentUserName } as Order & { staffName?: string }, 'create').catch(console.error);

                if (newOrder.facebookUserId) {
                    sendOrderStatusToCustomer(newOrder, 'Chờ xử lý', null).catch(console.error);
                }
            }
        }
    }, [addOrder, updateOrder]);

    return (
        <OrderContext.Provider
            value={{
                orders,
                setOrders,
                isLoading,
                saveOrder: handleSaveOrder,
                deleteOrder: handleDeleteOrder,
                updateStatus: handleUpdateStatus,
                confirmPayment: handleConfirmPayment,
                updateShipping: handleUpdateShipping,
            }}
        >
            {children}
        </OrderContext.Provider>
    );
}

export function useOrders() {
    const context = useContext(OrderContext);
    if (!context) throw new Error('useOrders must be used within OrderProvider');
    return context;
}
