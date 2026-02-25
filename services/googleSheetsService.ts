// services/googleSheetsService.ts
// Service to sync orders to Google Sheets
// Settings stored in Supabase with localStorage fallback

import { settingsService } from './supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';

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

// Local cache for settings (to avoid async in sync functions)
let cachedSettings: GoogleSheetsSettings | null = null;

// Get settings from localStorage (fallback)
const getLocalSettings = (): GoogleSheetsSettings | null => {
    try {
        const settings = localStorage.getItem('googleSheetsSettings');
        if (settings) {
            return JSON.parse(settings);
        }
    } catch (e) {
        console.error('Error getting Google Sheets settings from localStorage:', e);
    }
    return null;
};

// Save settings to localStorage (fallback)
const saveLocalSettings = (config: GoogleSheetsSettings): void => {
    localStorage.setItem('googleSheetsSettings', JSON.stringify(config));
};

// Load settings from Supabase and update cache
export const loadGoogleSheetsSettings = async (): Promise<GoogleSheetsSettings | null> => {
    if (isSupabaseConfigured()) {
        const config = await settingsService.getGoogleSheetsConfig();
        if (config) {
            cachedSettings = config;
            // Also save to localStorage as backup
            saveLocalSettings(config);
            return config;
        }
    }
    // Fallback to localStorage
    cachedSettings = getLocalSettings();
    return cachedSettings;
};

// Save settings to Supabase (and localStorage backup)
export const saveGoogleSheetsSettings = async (scriptUrl: string, sheetName: string): Promise<boolean> => {
    const config = { scriptUrl, sheetName };

    // Always save to localStorage as backup
    saveLocalSettings(config);
    cachedSettings = config;

    if (isSupabaseConfigured()) {
        return await settingsService.setGoogleSheetsConfig(config);
    }
    return true;
};

// Get stored Google Script URL (sync - uses cache)
export const getStoredGoogleScriptUrl = (): string => {
    if (cachedSettings) return cachedSettings.scriptUrl || '';
    const local = getLocalSettings();
    return local?.scriptUrl || '';
};

// Get stored sheet name (sync - uses cache)
export const getStoredSheetName = (): string => {
    if (cachedSettings) return cachedSettings.sheetName || '';
    const local = getLocalSettings();
    return local?.sheetName || '';
};

// Get current settings (sync - uses cache or localStorage)
const getGoogleSheetsSettings = (): GoogleSheetsSettings | null => {
    if (cachedSettings) return cachedSettings;
    return getLocalSettings();
};


// Sync order to Google Sheets via API endpoint (to avoid CORS)
export const syncOrderDirect = async (
    order: OrderSyncData,
    action: 'create' | 'update' | 'delete' = 'create'
): Promise<{ success: boolean; error?: string }> => {
    const settings = getGoogleSheetsSettings();

    if (!settings?.scriptUrl) {
        console.log('Google Sheets sync skipped: No script URL configured');
        return { success: false, error: 'Google Script URL not configured' };
    }

    try {
        // Route through our API endpoint to avoid CORS issues
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

export default {
    syncOrderDirect,
    saveGoogleSheetsSettings,
    loadGoogleSheetsSettings,
    getStoredGoogleScriptUrl,
    getStoredSheetName,
};
