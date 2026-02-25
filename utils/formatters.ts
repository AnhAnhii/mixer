/**
 * Shared formatting utilities for the Mixer application.
 * Single source of truth — import from here instead of re-declaring.
 */

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export const formatCurrencyShort = (amount: number): string => {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toLocaleString('vi-VN');
};

export const formatCurrencyCompact = (amount: number): string =>
  new Intl.NumberFormat('vi-VN').format(amount) + 'đ';

export const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatDateShort = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });

export const formatOrderId = (id: string): string => id.substring(0, 8);
