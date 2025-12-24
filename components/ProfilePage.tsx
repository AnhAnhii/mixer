
import React, { useState } from 'react';
import type { User, ActivityLog } from '../types';
import { CameraIcon, PencilIcon, ClockIcon } from './icons';
import ActivityFeed from './ActivityFeed';

interface ProfilePageProps {
  user: User;
  activityLog: ActivityLog[];
  onUpdateProfile: (data: Partial<User>) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, activityLog, onUpdateProfile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name,
    bio: user.bio || '',
    phone: user.phone || '',
    facebook: user.socialLinks?.facebook || '',
    twitter: user.socialLinks?.twitter || '',
    instagram: user.socialLinks?.instagram || ''
  });

  const handleSave = () => {
    onUpdateProfile({
      name: formData.name,
      bio: formData.bio,
      phone: formData.phone,
      socialLinks: {
        facebook: formData.facebook,
        twitter: formData.twitter,
        instagram: formData.instagram
      }
    });
    setIsEditing(false);
  };

  const userActivities = activityLog.filter(log => log.entityId === user.id || log.description.includes(user.name));

  return (
    <div className="space-y-6">
      {/* Cover Image & Header */}
      <div className="relative mb-20">
        <div className="h-64 w-full rounded-xl overflow-hidden relative group">
           <img 
            src={user.coverImage || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'} 
            alt="Cover" 
            className="w-full h-full object-cover"
           />
           <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
               <button className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white font-medium hover:bg-white/30">
                   <CameraIcon className="w-5 h-5" /> Cập nhật ảnh bìa
               </button>
           </div>
        </div>
        
        <div className="absolute -bottom-16 left-8 flex items-end">
            <div className="relative group">
                <div className="w-32 h-32 rounded-full border-4 border-background bg-muted overflow-hidden flex items-center justify-center text-3xl font-bold text-muted-foreground shadow-lg">
                    {user.avatar.length <= 2 ? user.avatar : <img src={user.avatar} alt={user.name} className="w-full h-full object-cover"/>}
                </div>
                 <button className="absolute bottom-1 right-1 p-2 bg-card rounded-full shadow border border-border opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                    <CameraIcon className="w-4 h-4" />
                </button>
            </div>
            <div className="mb-4 ml-4">
                <h1 className="text-3xl font-bold text-card-foreground drop-shadow-sm">{user.name}</h1>
                <p className="text-card-foreground/80 font-medium bg-background/50 backdrop-blur-sm px-2 py-0.5 rounded-md inline-block text-sm border border-border/50">
                    {user.roleId === 'role-admin' ? 'Quản trị viên' : user.roleId === 'role-manager' ? 'Quản lý' : 'Nhân viên'}
                </p>
            </div>
        </div>
        
        <div className="absolute bottom-4 right-8">
             {isEditing ? (
                 <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="btn-muted px-4 py-2 shadow-lg">Hủy</button>
                    <button onClick={handleSave} className="btn-primary px-4 py-2 shadow-lg">Lưu thay đổi</button>
                 </div>
             ) : (
                <button onClick={() => setIsEditing(true)} className="btn-secondary px-4 py-2 shadow-lg flex items-center gap-2">
                    <PencilIcon className="w-4 h-4" /> Chỉnh sửa hồ sơ
                </button>
             )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Intro */}
        <div className="space-y-6">
            <div className="card-base p-6 border">
                <h3 className="font-bold text-lg mb-4">Giới thiệu</h3>
                {isEditing ? (
                    <div className="space-y-4">
                         <textarea 
                            value={formData.bio} 
                            onChange={e => setFormData({...formData, bio: e.target.value})}
                            className="w-full p-2 border rounded-md bg-transparent"
                            placeholder="Viết đôi dòng về bản thân..."
                            rows={3}
                        />
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-muted-foreground">Liên hệ</label>
                            <input 
                                type="text" 
                                value={formData.phone} 
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                                placeholder="Số điện thoại"
                                className="w-full p-2 border rounded-md bg-transparent text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                             <label className="text-xs font-semibold uppercase text-muted-foreground">Mạng xã hội</label>
                             <input 
                                type="text" 
                                value={formData.facebook} 
                                onChange={e => setFormData({...formData, facebook: e.target.value})}
                                placeholder="Link Facebook"
                                className="w-full p-2 border rounded-md bg-transparent text-sm"
                            />
                            <input 
                                type="text" 
                                value={formData.instagram} 
                                onChange={e => setFormData({...formData, instagram: e.target.value})}
                                placeholder="Link Instagram"
                                className="w-full p-2 border rounded-md bg-transparent text-sm"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 text-sm text-card-foreground">
                        <p className="italic text-muted-foreground">{user.bio || 'Chưa có giới thiệu.'}</p>
                        
                        <div className="pt-4 border-t border-border space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold w-20">Email:</span>
                                <span>{user.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold w-20">Phone:</span>
                                <span>{user.phone || 'Chưa cập nhật'}</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <span className="font-semibold w-20">Tham gia:</span>
                                <span>{new Date(user.joinDate).toLocaleDateString('vi-VN')}</span>
                            </div>
                        </div>
                        
                        {user.socialLinks && (
                            <div className="pt-4 border-t border-border flex gap-3">
                                {user.socialLinks.facebook && <a href={`https://${user.socialLinks.facebook}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Facebook</a>}
                                {user.socialLinks.instagram && <a href={`https://${user.socialLinks.instagram}`} target="_blank" rel="noreferrer" className="text-pink-600 hover:underline">Instagram</a>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Right Column: Activity Feed */}
        <div className="lg:col-span-2">
            <ActivityFeed logs={userActivities} title="Dòng thời gian hoạt động" />
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
