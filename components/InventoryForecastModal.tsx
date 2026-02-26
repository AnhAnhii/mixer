
import React, { useState } from 'react';
import Modal from './Modal';
import { SparklesIcon, CubeIcon, ArrowUpTrayIcon } from './icons';
import type { Product, Order } from '../types'; // Assuming you can pass orders to analyze history

interface InventoryForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

interface ForecastItem {
  productName: string;
  variantName: string;
  currentStock: number;
  dailySalesRate: number;
  daysUntilStockout: number;
  recommendedReorder: number;
  priority: 'High' | 'Medium' | 'Low';
  reason: string;
}

const InventoryForecastModal: React.FC<InventoryForecastModalProps> = ({ isOpen, onClose, products }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [forecast, setForecast] = useState<ForecastItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleForecast = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: 'gemini-3-pro-preview',
          responseFormat: 'json',
          thinkingBudget: 2048
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'AI Forecast failed');

      const forecastData = JSON.parse(data.text || '[]');
      setForecast(forecastData);

    } catch (err) {
      console.error(err);
      setError("Không thể tạo dự báo. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dự báo Nhập hàng Thông minh (AI)">
      <div className="space-y-6 min-h-[300px]">
        {!forecast && !isLoading && (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            <div className="p-4 bg-teal-100 rounded-full text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
              <CubeIcon className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Tối ưu hóa Tồn kho</h3>
            <p className="text-gray-600 max-w-md dark:text-gray-300">
              Sử dụng <strong>Gemini 3 Pro</strong> để phân tích tồn kho, ước tính tốc độ bán hàng và đề xuất kế hoạch nhập hàng chính xác, giúp bạn không bao giờ bị đứt hàng.
            </p>
            <button
              onClick={handleForecast}
              className="mt-6 px-6 py-2 bg-teal-600 text-white rounded-full font-bold shadow hover:bg-teal-700 flex items-center gap-2"
            >
              <SparklesIcon className="w-5 h-5" />
              Bắt đầu Dự báo
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            <p className="text-gray-600">Đang phân tích dữ liệu kho...</p>
          </div>
        )}

        {forecast && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Đề xuất Nhập hàng</h3>
              <span className="text-xs text-muted-foreground">Dựa trên ước tính AI</span>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Sản phẩm</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Tồn hiện tại</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Ngày còn lại</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Cần nhập</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase">Ưu tiên</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {forecast.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.variantName}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{item.currentStock}</td>
                      <td className={`px-4 py-3 text-sm text-right font-bold ${item.daysUntilStockout < 7 ? 'text-red-600' : 'text-yellow-600'}`}>
                        {Math.floor(item.daysUntilStockout)} ngày
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-primary">
                        +{item.recommendedReorder}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.priority === 'High' ? 'bg-red-100 text-red-800' :
                          item.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                          {item.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Đóng</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default InventoryForecastModal;
