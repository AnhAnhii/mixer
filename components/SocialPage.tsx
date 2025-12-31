
import React, { useState, useMemo, useEffect } from 'react';
import type { FacebookPost, Product, SocialPostConfig, CommentReply, ProductVariant } from '../types';
import { PaperClipIcon, PlusIcon, TrashIcon, XMarkIcon, SparklesIcon, ChatBubbleLeftEllipsisIcon } from './icons';
import Modal from './Modal';
import { socialConfigService } from '../services/supabaseService';

interface SocialPageProps {
  products: Product[];
  configs: SocialPostConfig[];
  setConfigs: React.Dispatch<React.SetStateAction<SocialPostConfig[]>>;
}

const SocialPage: React.FC<SocialPageProps> = ({ products, configs, setConfigs }) => {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'facebook' | 'instagram'>('facebook');

  // Facebook Posts state
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);

  // Instagram Posts state
  const [instagramPosts, setInstagramPosts] = useState<FacebookPost[]>([]);
  const [isLoadingInstagram, setIsLoadingInstagram] = useState(false);
  const [instagramError, setInstagramError] = useState<string | null>(null);

  // AI Reply Simulation State
  const [simulatedComment, setSimulatedComment] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);

  // Fetch real Facebook posts from API
  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoadingPosts(true);
      setPostsError(null);
      try {
        const response = await fetch('/api/facebook/posts?limit=20');
        const data = await response.json();

        if (data.error) {
          setPostsError(data.error);
          setPosts([]);
        } else {
          // Transform API response to match FacebookPost type
          const transformedPosts: FacebookPost[] = (data.posts || []).map((p: any) => ({
            id: p.id,
            content: p.content || 'Bài viết không có nội dung',
            imageUrl: p.imageUrl || 'https://via.placeholder.com/400x300?text=No+Image',
            likesCount: p.likesCount || 0,
            commentsCount: p.commentsCount || 0,
          }));
          setPosts(transformedPosts);
        }
      } catch (error) {
        console.error('Error fetching posts:', error);
        setPostsError('Không thể tải bài viết từ Facebook');
        setPosts([]);
      } finally {
        setIsLoadingPosts(false);
      }
    };

    fetchPosts();
  }, []);

  // Fetch Instagram posts when tab changes to instagram
  useEffect(() => {
    if (activeTab !== 'instagram' || instagramPosts.length > 0) return;

    const fetchInstagramPosts = async () => {
      setIsLoadingInstagram(true);
      setInstagramError(null);
      try {
        const response = await fetch('/api/instagram/posts?limit=20');
        const data = await response.json();

        if (data.error) {
          setInstagramError(data.error);
          setInstagramPosts([]);
        } else {
          const transformedPosts: FacebookPost[] = (data.posts || []).map((p: any) => ({
            id: p.id,
            content: p.content || 'Bài viết không có caption',
            imageUrl: p.imageUrl || 'https://via.placeholder.com/400x300?text=No+Image',
            likesCount: p.likesCount || 0,
            commentsCount: p.commentsCount || 0,
          }));
          setInstagramPosts(transformedPosts);
        }
      } catch (error) {
        console.error('Error fetching Instagram posts:', error);
        setInstagramError('Không thể tải bài viết từ Instagram');
        setInstagramPosts([]);
      } finally {
        setIsLoadingInstagram(false);
      }
    };

    fetchInstagramPosts();
  }, [activeTab, instagramPosts.length]);

  const updateConfig = async (postId: string, newConfig: Partial<SocialPostConfig>) => {
    const existingIndex = configs.findIndex(c => c.postId === postId);
    let updatedConfig: SocialPostConfig;

    if (existingIndex > -1) {
      const newConfigs = [...configs];
      newConfigs[existingIndex] = { ...newConfigs[existingIndex], ...newConfig };
      setConfigs(newConfigs);
      updatedConfig = newConfigs[existingIndex];
    } else {
      const defaultConfig: SocialPostConfig = {
        postId: postId,
        isEnabled: false,
        commentReplies: [{ id: crypto.randomUUID(), text: 'Shop đã inbox bạn rồi ạ. Check tin nhắn chờ nhé!' }],
        inboxMessage: 'Chào {{customer_name}}, cảm ơn bạn đã quan tâm đến sản phẩm của Mixer. Shop xin gửi bạn thông tin chi tiết về sản phẩm này ạ.',
      };
      updatedConfig = { ...defaultConfig, ...newConfig };
      setConfigs([...configs, updatedConfig]);
    }

    // Save to Supabase
    try {
      await socialConfigService.upsert({
        postId: updatedConfig.postId,
        isEnabled: updatedConfig.isEnabled,
        commentReplies: updatedConfig.commentReplies,
        inboxMessage: updatedConfig.inboxMessage,
        attachedProductVariantId: updatedConfig.attachedProductVariantId,
      });
      console.log('✅ Config saved to Supabase');
    } catch (error) {
      console.error('❌ Error saving config:', error);
    }
  };

  const currentConfig = useMemo(() => {
    if (!selectedPostId) return null;
    return configs.find(c => c.postId === selectedPostId) || {
      postId: selectedPostId,
      isEnabled: false,
      commentReplies: [{ id: crypto.randomUUID(), text: 'Shop đã inbox bạn rồi ạ. Check tin nhắn chờ nhé!' }],
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

  // Pre-defined smart reply templates (không cần AI)
  const smartReplyTemplates = {
    price: [
      "Dạ giá sản phẩm này là {{price}} ạ! 💰 Inbox shop để đặt hàng ngay nhé! 🛒",
      "Anh/chị ơi, giá {{price}} ạ! 🔥 Đang có khuyến mãi nha, inbox shop ngay đi ạ! 💜",
      "Giá chỉ {{price}} thôi ạ! ✨ Inbox mình để được tư vấn thêm nha!"
    ],
    size: [
      "Dạ còn đủ size ạ! Shop có S, M, L, XL. Inbox mình để kiểm tra size phù hợp nhé! 📏",
      "Còn size nha anh/chị! 👍 Inbox shop để được tư vấn size chuẩn ạ!",
      "Size đầy đủ luôn ạ! Anh/chị cao bao nhiêu để shop tư vấn nha? 💜"
    ],
    color: [
      "Có nhiều màu lắm ạ! 🎨 Inbox shop để xem màu còn hàng nhé!",
      "Màu đen, trắng, be đều có ạ! Anh/chị thích màu nào để shop check hàng nha! 🌈",
      "Còn đủ màu luôn ạ! Inbox mình để xem hình thật các màu nhé! 📸"
    ],
    shipping: [
      "Ship toàn quốc 30-50k ạ! 🚚 Free ship đơn từ 500k nha! Inbox shop đặt hàng ngay đi ạ! 💜",
      "Giao hàng 2-3 ngày ạ! Ship COD được luôn nha anh/chị! 📦",
      "Free ship nội thành, tỉnh 30-50k ạ! Inbox để shop báo phí ship chính xác nha! 🛒"
    ],
    general: [
      "Shop đã inbox bạn rồi ạ! Check tin nhắn để xem chi tiết nha! 💜",
      "Dạ inbox shop để được tư vấn chi tiết ạ! 📩 Cảm ơn anh/chị đã quan tâm! 💜",
      "Cảm ơn anh/chị đã quan tâm! Shop đã nhắn tin cho bạn rồi ạ! 📨✨",
      "Dạ shop vừa inbox bạn ạ! Check tin nhắn nha! Có gì cứ hỏi shop nhé! 💜",
      "Mình vừa nhắn tin cho bạn ạ! 📩 Vào inbox xem chi tiết nha! 🛍️"
    ]
  };

  // Smart Reply Logic - phân tích từ khóa để chọn template phù hợp
  const handleGenerateSmartReply = () => {
    if (!simulatedComment.trim()) return;

    setIsGeneratingReply(true);
    setAiReply('');

    // Giả lập delay như AI (để UI mượt hơn)
    setTimeout(() => {
      const comment = simulatedComment.toLowerCase();
      let templates: string[];

      // Phân tích từ khóa
      if (comment.includes('giá') || comment.includes('bao nhiêu') || comment.includes('bnh') || comment.includes('bnhiu')) {
        templates = smartReplyTemplates.price;
      } else if (comment.includes('size') || comment.includes('số') || comment.includes('cỡ')) {
        templates = smartReplyTemplates.size;
      } else if (comment.includes('màu') || comment.includes('color') || comment.includes('mau')) {
        templates = smartReplyTemplates.color;
      } else if (comment.includes('ship') || comment.includes('giao') || comment.includes('vận chuyển') || comment.includes('phí')) {
        templates = smartReplyTemplates.shipping;
      } else {
        templates = smartReplyTemplates.general;
      }

      // Chọn ngẫu nhiên 1 template
      let reply = templates[Math.floor(Math.random() * templates.length)];

      // Thay thế biến {{price}} nếu có
      if (attachedVariant) {
        const formattedPrice = new Intl.NumberFormat('vi-VN').format(attachedVariant.price) + 'đ';
        reply = reply.replace(/{{price}}/g, formattedPrice);
      } else {
        reply = reply.replace(/{{price}}/g, 'inbox shop để biết giá');
      }

      setAiReply(reply);
      setIsGeneratingReply(false);
    }, 500);
  }


  return (
    <div className="space-y-8">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-semibold text-gray-700">Quản lý Social</h2>
        <p className="text-sm text-gray-500 mt-1">Chọn bài viết để thiết lập trả lời tự động cho bình luận và tin nhắn.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => { setActiveTab('facebook'); setSelectedPostId(null); }}
          className={`px-6 py-3 font-medium transition-all ${activeTab === 'facebook'
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            Facebook
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('instagram'); setSelectedPostId(null); }}
          className={`px-6 py-3 font-medium transition-all ${activeTab === 'instagram'
            ? 'text-pink-600 border-b-2 border-pink-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
            Instagram
          </span>
        </button>
      </div>

      {/* Facebook Tab Content */}
      {activeTab === 'facebook' && (
        <>
          {/* Loading State */}
          {isLoadingPosts && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-500">Đang tải bài viết từ Facebook...</p>
            </div>
          )}

          {/* Error State */}
          {postsError && !isLoadingPosts && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-600">❌ {postsError}</p>
              <p className="text-sm text-gray-500 mt-2">Kiểm tra lại Page Access Token và cấu hình Facebook App.</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingPosts && !postsError && posts.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-600">📭 Không có bài viết nào</p>
              <p className="text-sm text-gray-500 mt-2">Hãy đăng bài viết trên Facebook Page của bạn.</p>
            </div>
          )}

          {/* Posts Grid */}
          {!isLoadingPosts && posts.length > 0 && (
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
          )}

          {selectedPostId && currentConfig && (
            <div className="bg-white p-6 rounded-xl shadow-lg border animate-fade-in">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">Cấu hình cho bài viết</h3>
                  <p className="text-sm text-gray-500 line-clamp-1">{posts.find(p => p.id === selectedPostId)?.content}</p>
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
          )
          }

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
        </>
      )}

      {/* Instagram Tab Content */}
      {activeTab === 'instagram' && (
        <>
          {/* Loading State */}
          {isLoadingInstagram && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto"></div>
              <p className="mt-4 text-gray-500">Đang tải bài viết từ Instagram...</p>
            </div>
          )}

          {/* Error State */}
          {instagramError && !isLoadingInstagram && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-600">❌ {instagramError}</p>
              <p className="text-sm text-gray-500 mt-2">Kiểm tra lại kết nối Instagram và permissions.</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingInstagram && !instagramError && instagramPosts.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-600">📭 Không có bài viết nào</p>
              <p className="text-sm text-gray-500 mt-2">Hãy đăng bài viết trên Instagram của bạn hoặc kiểm tra kết nối.</p>
            </div>
          )}

          {/* Instagram Posts Grid */}
          {!isLoadingInstagram && instagramPosts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {instagramPosts.map(post => (
                <div key={post.id} onClick={() => setSelectedPostId(post.id === selectedPostId ? null : post.id)} className={`bg-white rounded-xl shadow-sm border-2 transition-all cursor-pointer ${selectedPostId === post.id ? 'border-pink-500 shadow-lg' : 'border-transparent hover:border-gray-300'}`}>
                  <img src={post.imageUrl} alt="Post image" className="aspect-square w-full object-cover rounded-t-lg" />
                  <div className="p-4">
                    <p className="text-sm text-gray-600 line-clamp-2">{post.content}</p>
                    <div className="flex justify-between items-center mt-3 text-xs text-gray-400">
                      <span>❤️ {post.likesCount}</span>
                      <span>💬 {post.commentsCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Instagram Config Panel - reuse same UI */}
          {selectedPostId && currentConfig && (
            <div className="bg-white p-6 rounded-xl shadow-lg border animate-fade-in">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">Cấu hình cho bài viết Instagram</h3>
                  <p className="text-sm text-gray-500 line-clamp-1">{instagramPosts.find(p => p.id === selectedPostId)?.content}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${currentConfig.isEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                    {currentConfig.isEnabled ? 'Đang hoạt động' : 'Đã tắt'}
                  </span>
                  <div onClick={() => updateConfig(selectedPostId, { isEnabled: !currentConfig.isEnabled })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${currentConfig.isEnabled ? 'bg-pink-500' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${currentConfig.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </div>
              </div>
              <p className="text-gray-500 text-center py-8">Cấu hình Instagram sẽ hoạt động tương tự Facebook.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SocialPage;
