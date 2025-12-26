// services/googleSheetsService.ts
// Service to sync orders to Google Sheets

interface OrderSyncData {
    id: string;
    orderDate: string;
    customerName: string;
    customerPhone: string;
    shippingAddress: string;
    items: Array<{
        productName: string;
        size: string;
        color: string;
        quantity: number;
        price: number;
    }>;
    totalAmount: number;
    paymentStatus: string;
    status: string;
    trackingCode?: string;
    staffName?: string;
    notes?: string;
}

// Get Google Script URL from localStorage settings
const getGoogleScriptUrl = (): string | null => {
    try {
        const settings = localStorage.getItem('googleSheetsSettings');
        if (settings) {
            const parsed = JSON.parse(settings);
            return parsed.scriptUrl || null;
        }
    } catch (e) {
        console.error('Error getting Google Script URL:', e);
    }
    return null;
};

// Save Google Script URL to localStorage
export const saveGoogleScriptUrl = (url: string): void => {
    localStorage.setItem('googleSheetsSettings', JSON.stringify({ scriptUrl: url }));
};

// Get stored Google Script URL
export const getStoredGoogleScriptUrl = (): string => {
    try {
        const settings = localStorage.getItem('googleSheetsSettings');
        if (settings) {
            const parsed = JSON.parse(settings);
            return parsed.scriptUrl || '';
        }
    } catch (e) {
        console.error('Error getting Google Script URL:', e);
    }
    return '';
};

// Sync order to Google Sheets
export const syncOrderToSheet = async (
    order: OrderSyncData,
    action: 'create' | 'update' | 'delete' = 'create'
): Promise<{ success: boolean; error?: string }> => {
    const scriptUrl = getGoogleScriptUrl();

    if (!scriptUrl) {
        console.log('Google Sheets sync skipped: No script URL configured');
        return { success: false, error: 'Google Script URL not configured' };
    }

    try {
        // Call our API endpoint which forwards to Google Apps Script
        const response = await fetch('/api/sheets/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action,
                order,
                googleScriptUrl: scriptUrl,
            }),
        });

        const result = await response.json();

        if (result.success) {
            console.log('Order synced to Google Sheets:', order.id);
            return { success: true };
        } else {
            console.error('Failed to sync order:', result.error);
            return { success: false, error: result.error };
        }
    } catch (error) {
        console.error('Error syncing to Google Sheets:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

// Sync order directly to Google Apps Script (alternative method)
export const syncOrderDirect = async (
    order: OrderSyncData,
    action: 'create' | 'update' | 'delete' = 'create'
): Promise<{ success: boolean; error?: string }> => {
    const scriptUrl = getGoogleScriptUrl();

    if (!scriptUrl) {
        return { success: false, error: 'Google Script URL not configured' };
    }

    try {
        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action,
                order,
            }),
        });

        const result = await response.json();
        return { success: result.success, error: result.error };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

export default {
    syncOrderToSheet,
    syncOrderDirect,
    saveGoogleScriptUrl,
    getStoredGoogleScriptUrl,
};
