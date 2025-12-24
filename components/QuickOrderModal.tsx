
import React, { useState, useRef, useEffect } from 'react';
import { SparklesIcon } from './icons';

interface QuickOrderModalProps {
  onClose: () => void;
  onParse: (text: string, useThinkingMode: boolean) => void;
  isLoading: boolean;
  error: string | null;
}

// Helper for Speech Recognition type
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const QuickOrderModal: React.FC<QuickOrderModalProps> = ({ onClose, onParse, isLoading, error }) => {
  const [text, setText] = useState('');
  const [useThinkingMode, setUseThinkingMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    // Safely check for window object
    if (typeof window !== 'undefined') {
        const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
        const SpeechRecognitionConstructor = SpeechRecognition || webkitSpeechRecognition;

        if (SpeechRecognitionConstructor) {
            const recognition = new SpeechRecognitionConstructor();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'vi-VN';

            recognition.onresult = (event: any) => {
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
                }
                
                if (finalTranscript) {
                    setText(prev => prev + ' ' + finalTranscript);
                }
            };

            recognition.onend = () => {
                setIsListening(false);
            };
            
            recognition.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        } else {
            setIsSupported(false);
        }
    }
  }, []);

  const toggleListening = () => {
    if (!isSupported || !recognitionRef.current) {
      alert('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Google Chrome hoặc Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start recognition:", e);
      }
    }
  };

  const handleParse = () => {
    if (text.trim()) {
      onParse(text, useThinkingMode);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Tạo đơn hàng nhanh bằng AI</h3>
        <p className="mt-1 text-sm text-gray-600">
          Nhập văn bản hoặc sử dụng giọng nói để tạo đơn hàng. AI sẽ tự động trích xuất thông tin.
        </p>
      </div>
      
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary pr-12"
          placeholder={`Ví dụ: "Tên người nhận là Nguyễn Văn A, số điện thoại 0987654321. Địa chỉ ở 123 Đường ABC, Quận 1. Lấy 1 áo thun trắng size M và 2 quần jeans size 30."`}
        />
        {isSupported && (
            <button
            type="button"
            onClick={toggleListening}
            className={`absolute top-3 right-3 p-2 rounded-full transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            title={isListening ? "Dừng ghi âm" : "Nhập bằng giọng nói"}
            >
            {isListening ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                </svg>
            )}
            </button>
        )}
        {isListening && <p className="absolute bottom-3 right-3 text-xs text-red-500 font-medium animate-pulse">Đang nghe...</p>}
      </div>
      
      <div className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${useThinkingMode ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800' : 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'}`}>
        <div className={`p-2 rounded-full flex-shrink-0 ${useThinkingMode ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
          <SparklesIcon className="w-6 h-6" />
        </div>
        <div className="flex-grow">
          <div className="flex items-center gap-2">
            <label htmlFor="thinking-mode" className={`font-semibold cursor-pointer ${useThinkingMode ? 'text-indigo-800 dark:text-indigo-200' : 'text-gray-700'}`}>
              Chế độ suy nghĩ (Gemini 3 Pro)
            </label>
            {useThinkingMode && <span className="px-1.5 py-0.5 bg-indigo-200 text-indigo-800 text-[10px] font-bold rounded uppercase animate-pulse">Mới</span>}
          </div>
          <p className={`text-xs ${useThinkingMode ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-500'}`}>
            Sử dụng mô hình <strong>Gemini 3 Pro</strong> mới nhất với khả năng suy luận vượt trội cho các đơn hàng phức tạp.
          </p>
        </div>
        <div className="relative">
             <input
              id="thinking-mode"
              type="checkbox"
              checked={useThinkingMode}
              onChange={(e) => setUseThinkingMode(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 cursor-pointer"></div>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex justify-end gap-4 pt-4 border-t">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
          Hủy
        </button>
        <button
          type="button"
          onClick={handleParse}
          disabled={isLoading || !text.trim()}
          className={`px-6 py-2 text-white rounded-md flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed min-w-[180px] transition-colors ${useThinkingMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-secondary hover:bg-emerald-600'}`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{useThinkingMode ? 'Đang suy nghĩ...' : 'Đang phân tích...'}</span>
            </>
          ) : (
            <>
              <SparklesIcon className="w-5 h-5" />
              <span>{useThinkingMode ? 'Phân tích sâu' : 'Phân tích nhanh'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default QuickOrderModal;
