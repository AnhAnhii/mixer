// api/ai/settings.ts
// API endpoint để quản lý AI auto-reply settings - SHARED giữa UI và Webhook

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Global state (shared trong cùng process)
// NOTE: Trên Vercel, mỗi request có thể là process khác nhau
// Để persistent, cần dùng database hoặc KV store
// Tạm thời dùng env var làm default, API override khi cần

interface AISettings {
    autoReplyEnabled: boolean;
    confidenceThreshold: number;
    lastUpdated: string;
}

// Initialize từ env var
let globalSettings: AISettings = {
    autoReplyEnabled: process.env.AI_AUTO_REPLY === 'true',
    confidenceThreshold: 0.6,
    lastUpdated: new Date().toISOString()
};

let trainingData: Array<{ customerMessage: string; employeeResponse: string; category?: string }> = [];

// Export để webhook có thể import
export function getSettings(): AISettings {
    return globalSettings;
}

export function setAutoReplyEnabled(enabled: boolean): void {
    globalSettings.autoReplyEnabled = enabled;
    globalSettings.lastUpdated = new Date().toISOString();
}

export function getTrainingData() {
    return trainingData;
}

export function setTrainingData(data: typeof trainingData) {
    trainingData = data;
}

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
            settings: globalSettings,
            trainingDataCount: trainingData.length
        });
    }

    // POST - Cập nhật settings
    if (req.method === 'POST') {
        const { action, data } = req.body;

        switch (action) {
            case 'toggle':
                globalSettings.autoReplyEnabled = !globalSettings.autoReplyEnabled;
                globalSettings.lastUpdated = new Date().toISOString();
                console.log(`🤖 AI Auto-reply ${globalSettings.autoReplyEnabled ? 'ENABLED' : 'DISABLED'}`);
                break;

            case 'setEnabled':
                globalSettings.autoReplyEnabled = !!data?.enabled;
                globalSettings.lastUpdated = new Date().toISOString();
                console.log(`🤖 AI Auto-reply set to ${globalSettings.autoReplyEnabled ? 'ENABLED' : 'DISABLED'}`);
                break;

            case 'updateSettings':
                if (data?.confidenceThreshold !== undefined) {
                    globalSettings.confidenceThreshold = data.confidenceThreshold;
                }
                globalSettings.lastUpdated = new Date().toISOString();
                break;

            case 'setTrainingData':
                if (Array.isArray(data)) {
                    trainingData = data;
                    console.log(`📚 Training data updated: ${data.length} pairs`);
                }
                break;

            default:
                return res.status(400).json({ error: 'Unknown action' });
        }

        return res.status(200).json({
            success: true,
            settings: globalSettings,
            trainingDataCount: trainingData.length
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
