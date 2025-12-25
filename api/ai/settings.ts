// api/ai/settings.ts
// API endpoint để quản lý AI auto-reply settings

import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-memory settings (trong thực tế nên lưu database)
let aiSettings = {
    autoReplyEnabled: false,
    confidenceThreshold: 0.6,
    handoffKeywords: ['nhân viên', 'người', 'real person', 'staff'],
    responseDelay: 1000, // ms
};

let trainingData: Array<{ customerMessage: string; employeeResponse: string; category?: string }> = [];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GET - Lấy settings hiện tại
    if (req.method === 'GET') {
        return res.status(200).json({
            success: true,
            settings: aiSettings,
            trainingDataCount: trainingData.length
        });
    }

    // POST - Cập nhật settings
    if (req.method === 'POST') {
        const { action, data } = req.body;

        switch (action) {
            case 'toggle':
                aiSettings.autoReplyEnabled = !aiSettings.autoReplyEnabled;
                console.log(`🤖 AI Auto-reply ${aiSettings.autoReplyEnabled ? 'ENABLED' : 'DISABLED'}`);
                break;

            case 'setEnabled':
                aiSettings.autoReplyEnabled = !!data.enabled;
                break;

            case 'updateSettings':
                aiSettings = { ...aiSettings, ...data };
                break;

            case 'setTrainingData':
                if (Array.isArray(data)) {
                    trainingData = data;
                    console.log(`📚 Training data updated: ${data.length} pairs`);
                }
                break;

            case 'addTrainingPair':
                if (data?.customerMessage && data?.employeeResponse) {
                    trainingData.push({
                        customerMessage: data.customerMessage,
                        employeeResponse: data.employeeResponse,
                        category: data.category
                    });
                }
                break;

            default:
                return res.status(400).json({ error: 'Unknown action' });
        }

        return res.status(200).json({
            success: true,
            settings: aiSettings,
            trainingDataCount: trainingData.length
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

// Export for use in webhook
export function getAISettings() {
    return aiSettings;
}

export function getTrainingData() {
    return trainingData;
}
