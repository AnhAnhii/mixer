
import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { FacebookPost, Product, SocialPostConfig, CommentReply, ProductVariant } from '../types';
import { PaperClipIcon, PlusIcon, TrashIcon, XMarkIcon, SparklesIcon, ChatBubbleLeftEllipsisIcon } from './icons';
import Modal from './Modal';
import { GEMINI_API_KEY } from '../config';

interface SocialPageProps {
  posts: FacebookPost[];
  products: Product[];
  configs: SocialPostConfig[];
  setConfigs: React.Dispatch<React.SetStateAction<SocialPostConfig[]>>;
}

const SocialPage: React.FC<SocialPageProps> = ({ posts, products, configs, setConfigs }) => {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);

  // AI Reply Simulation State
  const [simulatedComment, setSimulatedComment] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);

  const updateConfig = (postId: string, newConfig: Partial<SocialPostConfig>) => {
    const existingIndex = configs.findIndex(c => c.postId === postId);
    if (existingIndex > -1) {
      const newConfigs = [...configs];
      newConfigs[existingIndex] = { ...newConfigs[existingIndex], ...newConfig };
      setConfigs(newConfigs);
    } else {
      const defaultConfig: SocialPostConfig = {
        postId: postId,
        isEnabled: false,
        commentReplies: [{ id: crypto.randomUUID(), text: 'Shop đã inbox bạn rồi ạ. Check tin nhắn chờ nhé!'}],
        inboxMessage: 'Chào {{customer_name}}, cảm ơn bạn đã quan tâm đến sản phẩm của Mixer. Shop xin gửi bạn thông tin chi tiết về sản phẩm này ạ.',
      };
      setConfigs([...configs, { ...defaultConfig, ...newConfig }]);
    }
  };

  const currentConfig = useMemo(() => {
    if (!selectedPostId) return null;
    return configs.find(c => c.postId === selectedPostId) || {
        postId: selectedPostId,
        isEnabled: false,
        commentReplies: [{ id: crypto.randomUUID(), text: 'Shop đã inbox bạn rồi ạ. Check tin nhắn chờ nhé!'}],
        inboxMessage: 'Chào {{customer_name}}, cảm ơn bạn đã quan tâm đến sản phẩm của Mixer. Shop xin gửi bạn thông tin chi tiết về sản phẩm này ạ.',
    };
  }, [selectedPostId, configs]);

  const allVariants = useMemo(() => {
      return products.flatMap(p => p.variants.map(v => ({
          ...v,
          productId: p.id,
          productName: p.name,
          price: p.price
      })));
  }, [products]);

  const handleAttachProduct = (variantId: string) => {
      if (!selectedPostId) return;
      updateConfig(selectedPostId, { attachedProductVariantId: variantId });
      setIsProductPickerOpen(false);
  }
  
  const handleRemoveAttachment = () => {
       if (!selectedPostId) return;
       updateConfig(selectedPostId, { attachedProductVariantId: undefined });
  }

  const attachedVariant = useMemo(() => {
      if (!currentConfig || !currentConfig.attachedProductVariantId) return null;
      return allVariants.find(v => v.id === currentConfig.attachedProductVariantId);
  }, [currentConfig, allVariants]);

  // AI Generation Logic
  const handleGenerateSmartReply = async () => {
      if (!simulatedComment.trim() || !GEMINI_API_KEY) return;
      
      setIsGeneratingReply(true);
      setAiReply('');

      try {
          const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
          const postContent = posts.find(p => p.id === selectedPostId)?.content || '';
          const productName = attachedVariant ? attachedVariant.productName : "Sản phẩm thời trang";
          const productPrice = attachedVariant ? attachedVariant.price : "inbox";
          
          const prompt = `
            Bạn là nhân viên CSKH của shop thời trang Mixer. Hãy viết câu trả lời ngắn gọn, thân thiện và chốt sale cho bình luận sau của khách.
            Bài viết gốc: "${postContent}"
            Sản phẩm liên quan: ${productName} - Giá: ${productPrice}
            Bình luận của khách: "${simulatedComment}"
            
            Yêu cầu:
            - Giọng điệu vui vẻ, dùng icon.
            - Nếu khách hỏi giá, hãy báo giá (nếu có) hoặc mời inbox.
            - Khuyến khích mua ngay.
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
          });
          
          setAiReply(response.text || "Không thể tạo câu trả lời.");

      } catch (error) {
          console.error(error);
          setAiReply("Lỗi khi gọi AI.");
      } finally {
          setIsGeneratingReply(false);
      }
  }


  return (
    <div className="space-y-8">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-semibold text-gray-700">Quản lý Social</h2>
        <p className="text-sm text-gray-500 mt-1">Chọn bài viết để thiết lập trả lời tự động cho bình luận và tin nhắn.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map(post => (
          <div key={post.id} onClick={() => setSelectedPostId(post.id === selectedPostId ? null : post.id)} className={`bg-white rounded-xl shadow-sm border-2 transition-all cursor-pointer ${selectedPostId === post.id ? 'border-primary shadow-lg' : 'border-transparent hover:border-gray-300'}`}>
            <img src={post.imageUrl} alt="Post image" className="aspect-video w-full object-cover rounded-t-lg" />
            <div className="p-4">
              <p className="text-sm text-gray-600 line-clamp-2">{post.content}</p>
              <div className="flex justify-between items-center mt-3 text-xs text-gray-400">
                <span>{post.likesCount} likes</span>
                <span>{post.commentsCount} comments</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedPostId && currentConfig && (
        <div className="bg-white p-6 rounded-xl shadow-lg border animate-fade-in">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">Cấu hình cho bài viết</h3>
              <p className="text-sm text-gray-500 line-clamp-1">{posts.find(p=>p.id === selectedPostId)?.content}</p>
            </div>
            <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${currentConfig.isEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                    {currentConfig.isEnabled ? 'Đang hoạt động' : 'Đã tắt'}
                </span>
                <div onClick={() => updateConfig(selectedPostId, { isEnabled: !currentConfig.isEnabled })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${currentConfig.isEnabled ? 'bg-primary' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${currentConfig.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Comment Replies */}
            <div className="p-4 bg-slate-50 rounded-lg border">
              <h4 className="font-semibold text-gray-700 mb-2">Mẫu trả lời bình luận</h4>
              <p className="text-xs text-gray-500 mb-3">Hệ thống sẽ chọn ngẫu nhiên một trong các mẫu dưới đây để trả lời bình luận của khách hàng.</p>
              <div className="space-y-2">
                {currentConfig.commentReplies.map((reply, index) => (
                  <div key={reply.id} className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={reply.text}
                      onChange={e => {
                          const newReplies = [...currentConfig.commentReplies];
                          newReplies[index].text = e.target.value;
                          updateConfig(selectedPostId, { commentReplies: newReplies });
                      }}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                    />
                    <button 
                        onClick={() => {
                            const newReplies = currentConfig.commentReplies.filter(r => r.id !== reply.id);
                            updateConfig(selectedPostId, { commentReplies: newReplies });
                        }}
                        className="text-red-500 p-1.5 rounded-full hover:bg-red-100"
                        disabled={currentConfig.commentReplies.length <= 1}
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => {
                    const newReplies = [...currentConfig.commentReplies, { id: crypto.randomUUID(), text: '' }];
                    updateConfig(selectedPostId, { commentReplies: newReplies });
                }}
                className="mt-3 flex items-center gap-1 text-sm font-medium text-primary hover:text-indigo-700"
              >
                <PlusIcon className="w-4 h-4" /> Thêm mẫu
              </button>
            </div>

            {/* Inbox Message */}
            <div className="p-4 bg-slate-50 rounded-lg border">
              <h4 className="font-semibold text-gray-700 mb-2">Mẫu tin nhắn Inbox</h4>
              {/* FIX: Use a JSX expression with a template literal to avoid potential parsing issues with backticks and curly braces. */}
              <p className="text-xs text-gray-500 mb-3">Tin nhắn này sẽ được tự động gửi cho khách hàng. Dùng <code>{`{{customer_name}}`}</code> để cá nhân hóa.</p>
              <textarea 
                rows={5} 
                value={currentConfig.inboxMessage}
                onChange={e => updateConfig(selectedPostId, { inboxMessage: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md text-sm"
              />
              <div className="mt-3">
                 {attachedVariant ? (
                     <div className="p-2 bg-indigo-100 border border-indigo-200 rounded-md flex items-center justify-between">
                         <div className="text-sm">
                             <p className="font-semibold text-primary">{attachedVariant.productName}</p>
                             <p className="text-xs text-gray-600">{attachedVariant.size} - {attachedVariant.color} - {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(attachedVariant.price)}</p>
                         </div>
                         <button onClick={handleRemoveAttachment} className="text-red-500 p-1 rounded-full hover:bg-red-100">
                             <XMarkIcon className="w-4 h-4" />
                         </button>
                     </div>
                 ) : (
                    <button onClick={() => setIsProductPickerOpen(true)} className="flex items-center gap-2 text-sm font-medium text-primary hover:text-indigo-700">
                        <PaperClipIcon className="w-4 h-4" /> Đính kèm sản phẩm
                    </button>
                 )}
                 <p className="text-xs text-gray-500 mt-1">Thông tin sản phẩm đính kèm sẽ được tự động thêm vào cuối tin nhắn.</p>
              </div>
            </div>

            {/* AI Sandbox */}
            <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-indigo-100">
                <h4 className="font-semibold text-indigo-800 mb-2 flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4" />
                    Mô phỏng Trả lời (AI)
                </h4>
                <p className="text-xs text-gray-600 mb-3">Thử nghiệm cách Gemini phản hồi khách hàng.</p>
                
                <div className="space-y-3">
                    <input 
                        type="text" 
                        placeholder="Nhập bình luận của khách (VD: Giá bao nhiêu?)" 
                        className="w-full p-2 text-sm border border-indigo-200 rounded-md focus:ring-indigo-500"
                        value={simulatedComment}
                        onChange={e => setSimulatedComment(e.target.value)}
                    />
                    <button 
                        onClick={handleGenerateSmartReply}
                        disabled={isGeneratingReply}
                        className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-md hover:bg-indigo-700 disabled:bg-indigo-300"
                    >
                        {isGeneratingReply ? 'Đang suy nghĩ...' : 'Tạo câu trả lời'}
                    </button>
                </div>
                
                {aiReply && (
                    <div className="mt-3 p-3 bg-white rounded-md border border-indigo-100">
                        <div className="flex items-start gap-2">
                             <div className="mt-0.5 p-1 bg-indigo-100 rounded-full text-indigo-600">
                                 <ChatBubbleLeftEllipsisIcon className="w-3 h-3" />
                             </div>
                             <p className="text-sm text-gray-700 italic">"{aiReply}"</p>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
      
      {/* Product Picker Modal */}
      <Modal isOpen={isProductPickerOpen} onClose={() => setIsProductPickerOpen(false)} title="Chọn sản phẩm để đính kèm">
          <div className="max-h-96 overflow-y-auto space-y-2">
              {allVariants.map(variant => (
                  <div key={variant.id} onClick={() => handleAttachProduct(variant.id)} className="p-3 border rounded-md hover:bg-primary hover:text-white cursor-pointer transition-colors">
                      <p className="font-semibold">{variant.productName}</p>
                      <p className="text-sm">{variant.size} - {variant.color}</p>
                  </div>
              ))}
          </div>
      </Modal>

    </div>
  );
};

export default SocialPage;
