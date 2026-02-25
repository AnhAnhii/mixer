import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Order, Product, Customer, Voucher, AutomationRule, ReturnRequest } from '../types';

type ModalType =
    | 'orderForm'
    | 'productForm'
    | 'customerForm'
    | 'voucherForm'
    | 'automationForm'
    | 'orderDetail'
    | 'customerDetail'
    | 'quickOrder'
    | 'quickPayment'
    | 'messageTemplate'
    | 'returnRequest'
    | 'returnDetail'
    | 'vnPay'
    | 'strategy'
    | 'commandPalette'
    | 'zenMenu';

interface ModalPayloads {
    orderForm: { order: Partial<Order> | null };
    productForm: { product: Product | null };
    customerForm: { customer: Customer | null };
    voucherForm: { voucher: Voucher | null };
    automationForm: { rule: AutomationRule | null };
    orderDetail: { order: Order };
    customerDetail: { customer: Customer };
    quickOrder: Record<string, never>;
    quickPayment: Record<string, never>;
    messageTemplate: { order: Order };
    returnRequest: { order: Order };
    returnDetail: { request: ReturnRequest };
    vnPay: { order: Order };
    strategy: Record<string, never>;
    commandPalette: Record<string, never>;
    zenMenu: Record<string, never>;
}

interface ModalState {
    openModals: Set<ModalType>;
    payloads: Partial<Record<ModalType, unknown>>;
}

interface ModalContextValue {
    isOpen: (modal: ModalType) => boolean;
    open: <T extends ModalType>(modal: T, payload?: ModalPayloads[T]) => void;
    close: (modal: ModalType) => void;
    toggle: (modal: ModalType) => void;
    getPayload: <T extends ModalType>(modal: T) => ModalPayloads[T] | undefined;
    isAnyModalOpen: boolean;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<ModalState>({
        openModals: new Set(),
        payloads: {},
    });

    const isOpen = useCallback(
        (modal: ModalType) => state.openModals.has(modal),
        [state.openModals],
    );

    const open = useCallback(<T extends ModalType>(modal: T, payload?: ModalPayloads[T]) => {
        setState((prev) => {
            const newOpen = new Set(prev.openModals);
            newOpen.add(modal);
            return {
                openModals: newOpen,
                payloads: { ...prev.payloads, [modal]: payload },
            };
        });
    }, []);

    const close = useCallback((modal: ModalType) => {
        setState((prev) => {
            const newOpen = new Set(prev.openModals);
            newOpen.delete(modal);
            const newPayloads = { ...prev.payloads };
            delete newPayloads[modal];
            return { openModals: newOpen, payloads: newPayloads };
        });
    }, []);

    const toggle = useCallback((modal: ModalType) => {
        setState((prev) => {
            const newOpen = new Set(prev.openModals);
            if (newOpen.has(modal)) {
                newOpen.delete(modal);
            } else {
                newOpen.add(modal);
            }
            return { ...prev, openModals: newOpen };
        });
    }, []);

    const getPayload = useCallback(
        <T extends ModalType>(modal: T) => state.payloads[modal] as ModalPayloads[T] | undefined,
        [state.payloads],
    );

    const isAnyModalOpen = state.openModals.size > 0;

    return (
        <ModalContext.Provider value={{ isOpen, open, close, toggle, getPayload, isAnyModalOpen }}>
            {children}
        </ModalContext.Provider>
    );
}

export function useModal() {
    const context = useContext(ModalContext);
    if (!context) throw new Error('useModal must be used within ModalProvider');
    return context;
}
