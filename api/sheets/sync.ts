// api/sheets/sync.ts
// Sync order to Google Sheets via Apps Script

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { action, order, googleScriptUrl, sheetName } = req.body;

        if (!googleScriptUrl) {
            return res.status(400).json({
                success: false,
                error: 'Google Script URL not configured'
            });
        }

        if (!order) {
            return res.status(400).json({
                success: false,
                error: 'Order data is required'
            });
        }

        // Send to Google Apps Script
        const response = await fetch(googleScriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: action || 'create',
                order: order,
                sheetName: sheetName, // Forward sheet name
            }),
        });

        const result = await response.json();

        return res.status(200).json({
            success: true,
            message: 'Order synced to Google Sheets',
            result,
        });

    } catch (error) {
        console.error('Error syncing to Google Sheets:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
