/**
 * Serverless proxy for all Gemini AI requests.
 * Keeps the API key on the server — never exposed to the client.
 *
 * POST /api/ai/generate
 * Body: { prompt: string, model?: string, responseFormat?: 'json' | 'text', thinkingBudget?: number }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

interface GenerateRequest {
    prompt: string;
    model?: string;
    responseFormat?: 'json' | 'text';
    thinkingBudget?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API key not configured on server' });
    }

    const { prompt, model, responseFormat, thinkingBudget } = req.body as GenerateRequest;

    if (!prompt) {
        return res.status(400).json({ error: 'prompt is required' });
    }

    try {
        const { GoogleGenAI } = await import('@google/genai');
        const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        const modelId = model || 'gemini-2.5-flash';

        const response = await client.models.generateContent({
            model: modelId,
            contents: prompt,
            config: {
                responseMimeType: responseFormat === 'json' ? 'application/json' : undefined,
                thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined,
            },
        });

        return res.status(200).json({
            success: true,
            text: response.text || '',
        });
    } catch (error) {
        console.error('AI Generate Error:', error);
        return res.status(500).json({
            success: false,
            error: 'AI processing failed',
        });
    }
}
