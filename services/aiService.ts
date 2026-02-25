/**
 * Client-side AI service — proxies all Gemini calls through the server.
 * Never exposes API keys to the client bundle.
 */

interface GenerateOptions {
    prompt: string;
    model?: string;
    responseFormat?: 'json' | 'text';
    thinkingBudget?: number;
}

interface GenerateResult {
    success: boolean;
    text: string;
    error?: string;
}

export async function generateAI(options: GenerateOptions): Promise<GenerateResult> {
    try {
        const response = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('AI Service Error:', error);
        return {
            success: false,
            text: '',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Parse JSON response from AI, with fallback.
 */
export async function generateAIJson<T>(options: Omit<GenerateOptions, 'responseFormat'>): Promise<T | null> {
    const result = await generateAI({ ...options, responseFormat: 'json' });
    if (!result.success || !result.text) return null;

    try {
        return JSON.parse(result.text) as T;
    } catch {
        console.error('Failed to parse AI JSON response:', result.text);
        return null;
    }
}
