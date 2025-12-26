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

interface GoogleSheetsSettings {
    scriptUrl: string;
    sheetName: string;
}

// Get Google Sheets settings from localStorage
const getGoogleSheetsSettings = (): GoogleSheetsSettings | null => {
    try {
        const settings = localStorage.getItem('googleSheetsSettings');
        if (settings) {
            return JSON.parse(settings);
        }
    } catch (e) {
        console.error('Error getting Google Sheets settings:', e);
    }
    return null;
};

// Save Google Sheets settings to localStorage
export const saveGoogleSheetsSettings = (scriptUrl: string, sheetName: string): void => {
    localStorage.setItem('googleSheetsSettings', JSON.stringify({ scriptUrl, sheetName }));
};

// Get stored Google Script URL (backward compatible)
export const getStoredGoogleScriptUrl = (): string => {
    const settings = getGoogleSheetsSettings();
    return settings?.scriptUrl || '';
};

// Get stored sheet name
export const getStoredSheetName = (): string => {
    const settings = getGoogleSheetsSettings();
    return settings?.sheetName || '';
};

// Legacy function - keep for backward compatibility
export const saveGoogleScriptUrl = (url: string): void => {
    const settings = getGoogleSheetsSettings();
    saveGoogleSheetsSettings(url, settings?.sheetName || '');
};

// Sync order to Google Sheets
export const syncOrderToSheet = async (
    order: OrderSyncData,
    action: 'create' | 'update' | 'delete' = 'create'
): Promise<{ success: boolean; error?: string }> => {
    const settings = getGoogleSheetsSettings();

    if (!settings?.scriptUrl) {
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
                googleScriptUrl: settings.scriptUrl,
                sheetName: settings.sheetName,
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
    const settings = getGoogleSheetsSettings();

    if (!settings?.scriptUrl) {
        return { success: false, error: 'Google Script URL not configured' };
    }

    try {
        const response = await fetch(settings.scriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action,
                order,
                sheetName: settings.sheetName,
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
    saveGoogleSheetsSettings,
    getStoredGoogleScriptUrl,
    getStoredSheetName,
};
