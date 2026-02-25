import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    generateOrderStatusMessage,
    getVietQRUrl,
} from '../../utils/facebook';
import type { Order, BankInfo } from '../../types';
import { OrderStatus } from '../../types';

const mockOrder: Order = {
    id: 'test-order-123456789',
    customerName: 'Nguyễn Văn A',
    customerPhone: '0901234567',
    customerId: 'cust-1',
    shippingAddress: '123 Đường ABC, Quận 1, TP.HCM',
    items: [
        {
            productId: 'p1',
            variantId: 'v1',
            productName: 'Áo Hoodie Mixer',
            size: 'L',
            color: 'Đen',
            quantity: 2,
            price: 350000,
            costPrice: 150000,
        },
    ],
    totalAmount: 700000,
    status: OrderStatus.Pending,
    paymentStatus: 'Unpaid',
    paymentMethod: 'bank_transfer' as const,
    orderDate: '2024-01-15T14:30:00.000Z',
    facebookUserId: 'fb-user-123',
};

const mockBankInfo: BankInfo = {
    accountNumber: '123456789',
    accountName: 'NGUYEN VAN A',
    bin: '970436',
};

describe('generateOrderStatusMessage', () => {
    it('generates pending COD message', () => {
        const codOrder = { ...mockOrder, paymentMethod: 'cod' as const };
        const message = generateOrderStatusMessage(codOrder, 'Chờ xử lý');
        expect(message).toContain('test-ord'); // first 8 chars
        expect(message).toContain('Nguyễn Văn A');
        expect(message).toContain('COD');
        expect(message).toContain('Áo Hoodie Mixer');
    });

    it('generates pending bank transfer message', () => {
        const message = generateOrderStatusMessage(mockOrder, 'Chờ xử lý');
        expect(message).toContain('QR');
        expect(message).toContain('24h');
        expect(message).not.toContain('COD');
    });

    it('generates processing message', () => {
        const message = generateOrderStatusMessage(mockOrder, 'Đang xử lý');
        expect(message).toContain('thanh toán');
        expect(message).toContain('chuẩn bị');
    });

    it('generates shipped message with tracking', () => {
        const shippedOrder = {
            ...mockOrder,
            shippingProvider: 'ViettelPost',
            trackingCode: 'VP123456',
        };
        const message = generateOrderStatusMessage(shippedOrder, 'Đã gửi hàng');
        expect(message).toContain('ViettelPost');
        expect(message).toContain('VP123456');
    });

    it('generates delivered message', () => {
        const message = generateOrderStatusMessage(mockOrder, 'Đã giao hàng');
        expect(message).toContain('giao thành công');
        expect(message).toContain('Mixer');
    });
});

describe('getVietQRUrl', () => {
    it('generates correct VietQR URL', () => {
        const url = getVietQRUrl(350000, 'test-ord', mockBankInfo);
        expect(url).toContain('img.vietqr.io');
        expect(url).toContain('970436');
        expect(url).toContain('123456789');
        expect(url).toContain('350000');
        expect(url).toContain('Mixer');
    });

    it('returns empty string when no bank info', () => {
        expect(getVietQRUrl(350000, 'test-ord', null)).toBe('');
    });
});
