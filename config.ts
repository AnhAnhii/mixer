
// ============================================================================
// CẤU HÌNH HỆ THỐNG
// ============================================================================

// Helper để lấy biến môi trường an toàn (tránh lỗi crash nếu import.meta.env undefined)
const getEnv = (key: string): string => {
    let value = '';
    
    // 1. Try Vite import.meta.env
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            value = import.meta.env[key];
        }
    } catch (e) {
        // Ignore errors in environments where import.meta is not supported
    }

    // 2. Try process.env (Node.js / Fallback)
    if (!value) {
        try {
            if (typeof process !== 'undefined' && process.env) {
                value = process.env[key] || '';
                
                // Fallback for GEMINI_API_KEY specifically if using standard API_KEY
                if (!value && key === 'VITE_GEMINI_API_KEY' && process.env.API_KEY) {
                    value = process.env.API_KEY;
                }
            }
        } catch (e) {
            // Ignore errors
        }
    }
    
    return value || '';
};

// 1. GEMINI API KEY (Bắt buộc cho các tính năng AI)
export const GEMINI_API_KEY = getEnv('VITE_GEMINI_API_KEY');

// 2. GOOGLE SHEETS CONFIG (Nếu dùng Google Sheets làm backend)
export const GOOGLE_SCRIPT_URL = getEnv('VITE_GOOGLE_SCRIPT_URL'); 

// 3. SUPABASE CONFIG (Nếu dùng Supabase làm backend - Khuyên dùng cho Prod)
export const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY');

// Helper để kiểm tra cấu hình
export const checkSystemConfig = () => {
    const status = {
        hasGemini: !!GEMINI_API_KEY,
        hasGoogleSheet: !!GOOGLE_SCRIPT_URL,
        hasSupabase: !!(SUPABASE_URL && SUPABASE_ANON_KEY)
    };
    // @ts-ignore
    if ((import.meta as any).env.DEV) {
        console.log("System Config Status:", status);
    }
    return status;
};