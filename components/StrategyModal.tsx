
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import Modal from './Modal';
import { SparklesIcon, LightBulbIcon, ChartBarIcon, UserGroupIcon } from './icons';
import type { Order, Product, Customer } from '../types';
import { GEMINI_API_KEY } from '../config';

interface StrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  products: Product[];
  customers: Customer[];
}

const StrategyModal: React.FC<StrategyModalProps> = ({ isOpen, onClose, orders, products, customers }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [strategy, setStrategy] = useState<string | null>(null);

  const handleGenerateStrategy = async () => {
    setIsLoading(true);
    setStrategy(null);

    try {
      if (!GEMINI_API_KEY) {
        setStrategy("Lỗi: Chưa cấu hình API Key trong file .env.local.");
        setIsLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      
      // Prepare data summary to save tokens but provide enough context
      const dataSummary = {
        totalOrders: orders.length,
        recentOrders: orders.slice(0, 20), // Last 20 orders for trend analysis
        inventorySummary: products.map(p => ({
          name: p.name,
          price: p.price,
          cost: p.costPrice,
          totalStock: p.variants.reduce((s, v) => s + v.stock, 0),
          variants: p.variants.map(v => ({ s: v.size, c: v.color, q: v.stock }))
        })),
        customerSegments: {
            total: customers.length,
            newCustomers: customers.slice(0, 10).map(c => ({ name: c.name, tags: c.tags })), // Sample new customers
        }
      };

      const prompt = `
        Đóng vai trò là một Giám đốc Chiến lược Kinh doanh cấp cao (Chief Strategy Officer) cho một cửa hàng thời trang bán lẻ.
        Dựa trên dữ liệu JSON dưới đây, hãy sử dụng khả năng suy luận sâu (thinking process) để phân tích và đưa ra một bản "Báo cáo Chiến lược Tuần tới".
        
        Dữ liệu: ${JSON.stringify(dataSummary)}

        Yêu cầu đầu ra (định dạng Markdown, dùng tiếng Việt chuyên nghiệp, giọng văn quyết đoán, sâu sắc):
        
        1. **🔍 Phân tích Xu hướng & Insight:**
           - Đừng chỉ liệt kê số liệu. Hãy tìm ra "câu chuyện" đằng sau dữ liệu. (Ví dụ: Tại sao sản phẩm A bán chạy? Có phải do giá rẻ hay do xu hướng?).
           - Chỉ ra điểm yếu chết người hiện tại của shop (Về tồn kho, về biên lợi nhuận, hoặc về khách hàng).

        2. **⚠️ Cảnh báo Rủi ro:**
           - Dự báo những sản phẩm sắp "chết" (dead stock) cần xả gấp.
           - Dự báo dòng tiền nếu không nhập hàng kịp.

        3. **🚀 Kế hoạch Hành động Cụ thể (Action Plan):**
           - Đề xuất 1 chiến dịch khuyến mãi cụ thể cho tuần tới (Tên chiến dịch, Sản phẩm key, Mức giảm giá sao cho vẫn có lãi).
           - Đề xuất nhập hàng: Nhập cụ thể món gì, số lượng bao nhiêu?

        4. **💬 Nội dung Marketing (Bonus):**
           - Viết 1 mẫu tin nhắn gửi khách VIP để mời chào chiến dịch trên.

        Lưu ý: Hãy suy nghĩ kỹ về biên lợi nhuận (Giá bán - Giá vốn) khi đề xuất giảm giá.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 16384 }, // Enable thinking for deep reasoning
        }
      });

      setStrategy(response.text || "Không thể tạo báo cáo lúc này.");

    } catch (error) {
      console.error(error);
      setStrategy("Đã xảy ra lỗi khi kết nối với Gemini AI.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Hoạch định Chiến lược Kinh doanh (Gemini 3 Pro)">
      <div className="space-y-6 min-h-[400px]">
        {!strategy && !isLoading && (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <div className="p-4 bg-indigo-100 rounded-full text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                    <SparklesIcon className="w-12 h-12" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Kích hoạt Tư duy Chiến lược</h3>
                <p className="text-gray-600 max-w-md dark:text-gray-300">
                    Sử dụng mô hình <strong>Gemini 3 Pro</strong> với khả năng suy luận sâu để phân tích toàn bộ dữ liệu bán hàng, kho và khách hàng của bạn.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mt-6">
                    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700">
                        <ChartBarIcon className="w-6 h-6 text-blue-500 mb-2 mx-auto" />
                        <p className="text-sm font-medium">Phân tích Xu hướng</p>
                    </div>
                    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700">
                        <LightBulbIcon className="w-6 h-6 text-yellow-500 mb-2 mx-auto" />
                        <p className="text-sm font-medium">Đề xuất Chiến dịch</p>
                    </div>
                    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700">
                        <UserGroupIcon className="w-6 h-6 text-green-500 mb-2 mx-auto" />
                        <p className="text-sm font-medium">Insight Khách hàng</p>
                    </div>
                </div>
                <button 
                    onClick={handleGenerateStrategy}
                    className="mt-8 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center gap-2"
                >
                    <SparklesIcon className="w-5 h-5" />
                    Lập kế hoạch ngay
                </button>
            </div>
        )}

        {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
                <div className="relative w-20 h-20">
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-200 rounded-full animate-pulse"></div>
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
                <div className="text-center space-y-2">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-white">Gemini đang suy nghĩ...</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Đang phân tích hàng nghìn điểm dữ liệu để tìm ra chiến lược tốt nhất.</p>
                    <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full mt-2 animate-pulse">
                        Thinking Process Active
                    </div>
                </div>
            </div>
        )}

        {strategy && (
            <div className="space-y-4 animate-fade-in">
                <div className="prose prose-indigo max-w-none dark:prose-invert bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-border max-h-[60vh] overflow-y-auto">
                    {/* Simple Markdown rendering */}
                    {strategy.split('\n').map((line, index) => {
                        if (line.startsWith('### ')) return <h3 key={index} className="text-lg font-bold mt-4 mb-2 text-indigo-700 dark:text-indigo-300">{line.replace('### ', '')}</h3>;
                        if (line.startsWith('## ')) return <h2 key={index} className="text-xl font-bold mt-6 mb-3 text-gray-900 dark:text-white border-b pb-2">{line.replace('## ', '')}</h2>;
                        if (line.startsWith('**')) return <p key={index} className="font-bold my-2">{line.replace(/\*\*/g, '')}</p>;
                        if (line.startsWith('- ')) return <li key={index} className="ml-4 list-disc my-1">{line.replace('- ', '')}</li>;
                        return <p key={index} className="my-2 leading-relaxed text-gray-700 dark:text-gray-300">{line}</p>;
                    })}
                </div>
                <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={() => setStrategy(null)} className="mr-4 px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Thử lại</button>
                    <button onClick={onClose} className="px-6 py-2 bg-primary text-white rounded-md hover:bg-indigo-700">Đã hiểu</button>
                </div>
            </div>
        )}
      </div>
    </Modal>
  );
};

export default StrategyModal;
