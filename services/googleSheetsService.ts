
import { retryWithBackoff } from '../utils/retry';

export const syncToGoogleSheets = async (scriptUrl: string, data: any): Promise<boolean> => {
  return retryWithBackoff(async () => {
    if (!scriptUrl) throw new Error("URL Script chưa được cấu hình");

    // Use 'text/plain' to avoid CORS preflight issues with Google Apps Script
    // Note: User prompt suggested application/json but text/plain is safer for GAS Web Apps to prevent OPTIONS preflight failure.
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.status === 'success') {
      return true;
    } else {
      console.error("Sync error:", result);
      throw new Error(result.message || "Lỗi không xác định từ Google Sheet");
    }
  }, 3, 1000);
};

export const fetchFromGoogleSheets = async (scriptUrl: string): Promise<any> => {
    return retryWithBackoff(async () => {
        if (!scriptUrl) throw new Error("URL Script chưa được cấu hình");
        
        const response = await fetch(scriptUrl, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        return data;
    }, 3, 1000);
}
