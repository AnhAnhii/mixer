import { describe, it, expect } from 'vitest';
import {
    formatCurrency,
    formatCurrencyShort,
    formatCurrencyCompact,
    formatDate,
    formatDateShort,
    formatOrderId,
} from '../../utils/formatters';

describe('formatCurrency', () => {
    it('formats VND currency correctly', () => {
        const result = formatCurrency(150000);
        expect(result).toContain('150.000');
        expect(result).toContain('₫');
    });

    it('handles zero', () => {
        const result = formatCurrency(0);
        expect(result).toContain('0');
    });

    it('handles large amounts', () => {
        const result = formatCurrency(1500000);
        expect(result).toContain('1.500.000');
    });
});

describe('formatCurrencyShort', () => {
    it('formats millions as M', () => {
        expect(formatCurrencyShort(1500000)).toBe('1.5M');
    });

    it('formats billions as B', () => {
        expect(formatCurrencyShort(2500000000)).toBe('2.5B');
    });

    it('formats thousands as K', () => {
        expect(formatCurrencyShort(15000)).toBe('15K');
    });

    it('keeps small numbers as is', () => {
        expect(formatCurrencyShort(500)).toBe('500');
    });
});

describe('formatCurrencyCompact', () => {
    it('formats with đ suffix', () => {
        expect(formatCurrencyCompact(150000)).toBe('150.000đ');
    });
});

describe('formatOrderId', () => {
    it('returns first 8 characters', () => {
        expect(formatOrderId('abcdefgh-1234-5678')).toBe('abcdefgh');
    });

    it('handles short IDs', () => {
        expect(formatOrderId('abc')).toBe('abc');
    });
});

describe('formatDate', () => {
    it('formats ISO date to Vietnamese locale', () => {
        const result = formatDate('2024-01-15T14:30:00.000Z');
        // Should contain date components (format varies by locale)
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(5);
    });
});

describe('formatDateShort', () => {
    it('formats to short date', () => {
        const result = formatDateShort('2024-01-15T14:30:00.000Z');
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(3);
    });
});
