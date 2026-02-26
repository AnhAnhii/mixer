
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
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="p-6 bg-primary/5 border border-primary/20 rounded-[24px]">
        <h3 className="text-[15px] font-black text-primary uppercase tracking-[0.1em] mb-1 flex items-center gap-2">
          <SparklesIcon className="w-5 h-5" />
          Trợ lý AI Thông Minh
        </h3>
        <p className="text-[12px] font-bold text-primary/60 leading-relaxed">
          Dán nội dung tin nhắn hoặc đọc thông tin khách hàng. AI sẽ tự động bóc tách tên, SĐT, địa chỉ và sản phẩm để tạo đơn trong 1 giây.
        </p>
      </div>

      <div className="relative group">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="w-full p-5 bg-white border border-border rounded-2xl shadow-soft-sm focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-sm font-bold outline-none pr-14 custom-scrollbar leading-relaxed"
          placeholder={`Ví dụ: "Chị Lan ở 123 Lê Lợi, Quận 1 muốn lấy 2 đầm lụa đen size L. SĐT chị là 0905123456..."`}
        />
        {isSupported && (
          <button
            type="button"
            onClick={toggleListening}
            className={`absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-soft-sm active:scale-90 ${isListening ? 'bg-status-danger text-white animate-pulse ring-4 ring-status-danger/20' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary border border-border/50'}`}
            title={isListening ? "Dừng ghi âm" : "Nhập bằng giọng nói"}
          >
            {isListening ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            )}
          </button>
        )}
        {isListening && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-1 h-3 bg-status-danger animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1 h-4 bg-status-danger animate-bounce" style={{ animationDelay: '100ms' }}></div>
              <div className="w-1 h-2 bg-status-danger animate-bounce" style={{ animationDelay: '200ms' }}></div>
            </div>
            <p className="text-[10px] text-status-danger font-black uppercase tracking-widest">Đang nghe...</p>
          </div>
        )}
      </div>

      <div className={`p-5 rounded-[20px] border transition-all duration-500 group flex items-start gap-4 ${useThinkingMode ? 'bg-indigo-50/50 border-indigo-200/50 shadow-soft-indigo' : 'bg-muted/30 border-border/50'}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border-2 transition-all ${useThinkingMode ? 'bg-indigo-600 text-white border-white/50 shadow-soft-sm' : 'bg-white text-muted-foreground border-border/50'}`}>
          <SparklesIcon className={`w-6 h-6 ${useThinkingMode ? 'animate-pulse' : 'opacity-40'}`} />
        </div>
        <div className="flex-grow">
          <div className="flex items-center gap-2 mb-1">
            <label htmlFor="thinking-mode" className={`text-[14px] font-black cursor-pointer uppercase tracking-tight transition-colors ${useThinkingMode ? 'text-indigo-900' : 'text-muted-foreground'}`}>
              Chế độ suy nghĩ
            </label>
            {useThinkingMode && <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded-lg uppercase shadow-sm">Advanced</span>}
          </div>
          <p className={`text-[11px] font-bold leading-relaxed pr-8 ${useThinkingMode ? 'text-indigo-700/70' : 'text-muted-foreground/50'}`}>
            Tăng độ chính xác bằng cách AI sẽ phân tích đa luồng, phù hợp với tin nhắn dài hoặc nhiều sản phẩm.
          </p>
        </div>
        <div className="relative pt-1 flex-shrink-0">
          <input
            id="thinking-mode"
            type="checkbox"
            checked={useThinkingMode}
            onChange={(e) => setUseThinkingMode(e.target.checked)}
            className="peer sr-only"
          />
          <div
            onClick={() => setUseThinkingMode(!useThinkingMode)}
            className="h-6 w-11 rounded-full bg-border/50 relative cursor-pointer transition-all peer-checked:bg-indigo-600 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all peer-checked:after:translate-x-full peer-checked:after:scale-90"
          ></div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-status-danger/5 border border-status-danger/20 rounded-xl flex items-center gap-3 animate-in shake-sm">
          <div className="w-2 h-2 rounded-full bg-status-danger"></div>
          <p className="text-status-danger text-[13px] font-bold">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-border/30">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-3 bg-white text-muted-foreground hover:bg-muted border border-border rounded-xl font-black text-[13px] transition-all"
        >
          Đóng
        </button>
        <button
          type="button"
          onClick={handleParse}
          disabled={isLoading || !text.trim()}
          className={`px-8 py-3 text-white rounded-xl flex items-center justify-center gap-2 disabled:bg-muted disabled:text-muted-foreground/30 disabled:border-transparent font-black text-[14px] transition-all shadow-soft-lg active:scale-95 min-w-[200px] border-b-4 ${useThinkingMode ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-800' : 'bg-primary hover:bg-primary-dark border-primary-dark/50'}`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{useThinkingMode ? 'Đang suy tưởng...' : 'Đang bóc tách...'}</span>
            </>
          ) : (
            <>
              <SparklesIcon className="w-5 h-5" />
              <span>Bắt đầu phân tích</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default QuickOrderModal;
