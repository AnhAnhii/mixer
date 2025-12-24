
import React, { useState } from 'react';
import type { User, Role, Permission } from '../types';
import { PlusIcon, PencilIcon, TrashIcon, ShieldCheckIcon, UserCircleIcon, ExclamationTriangleIcon } from './icons';
import Modal from './Modal';

interface StaffManagementProps {
  users: User[];
  roles: Role[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onAddRole: (role: Role) => void;
  onUpdateRole: (role: Role) => void;
  onDeleteRole: (roleId: string) => void;
}

const allPermissions: { id: Permission; label: string }[] = [
  { id: 'view_dashboard', label: 'Xem Tổng quan' },
  { id: 'manage_orders', label: 'Quản lý Đơn hàng' },
  { id: 'manage_inventory', label: 'Quản lý Kho' },
  { id: 'manage_customers', label: 'Quản lý Khách hàng' },
  { id: 'manage_marketing', label: 'Marketing & Voucher' },
  { id: 'manage_staff', label: 'Quản lý Nhân sự' },
  { id: 'view_reports', label: 'Xem Báo cáo' },
  { id: 'manage_settings', label: 'Cấu hình Hệ thống' },
];

const StaffManagement: React.FC<StaffManagementProps> = ({ users, roles, onAddUser, onUpdateUser, onDeleteUser, onAddRole, onUpdateRole, onDeleteRole }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Delete States
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  // --- User Form State ---
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userError, setUserError] = useState('');

  // --- Role Form State ---
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [rolePerms, setRolePerms] = useState<Set<Permission>>(new Set());

  const handleOpenUserModal = (user?: User) => {
      setUserError('');
      if (user) {
          setEditingUser(user);
          setUserName(user.name);
          setUserEmail(user.email);
          setUserPassword(user.password || '');
          setUserRole(user.roleId);
      } else {
          setEditingUser(null);
          setUserName('');
          setUserEmail('');
          setUserPassword('');
          // Select first role by default if available
          setUserRole(roles.length > 0 ? roles[0].id : '');
      }
      setIsUserModalOpen(true);
  }

  const handleOpenRoleModal = (role?: Role) => {
      if (role) {
          setEditingRole(role);
          setRoleName(role.name);
          setRoleDesc(role.description);
          setRolePerms(new Set(role.permissions));
      } else {
          setEditingRole(null);
          setRoleName('');
          setRoleDesc('');
          setRolePerms(new Set());
      }
      setIsRoleModalOpen(true);
  }

  const handleSaveUser = (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!userRole) {
          setUserError("Vui lòng chọn vai trò cho nhân viên.");
          return;
      }
      if (!userName || !userEmail) {
          setUserError("Vui lòng điền đầy đủ thông tin.");
          return;
      }
      if (!editingUser && !userPassword) {
          setUserError("Vui lòng tạo mật khẩu cho nhân viên mới.");
          return;
      }

      const newUser: User = {
          id: editingUser?.id || crypto.randomUUID(),
          name: userName,
          email: userEmail,
          password: userPassword || (editingUser ? editingUser.password : '123456'),
          roleId: userRole,
          avatar: editingUser?.avatar || userName.substring(0, 2).toUpperCase(),
          joinDate: editingUser?.joinDate || new Date().toISOString(),
          status: 'active',
          bio: editingUser?.bio,
          phone: editingUser?.phone
      };

      if (editingUser) onUpdateUser(newUser);
      else onAddUser(newUser);
      setIsUserModalOpen(false);
  };

  const handleSaveRole = (e: React.FormEvent) => {
      e.preventDefault();
      const newRole: Role = {
          id: editingRole?.id || crypto.randomUUID(),
          name: roleName,
          description: roleDesc,
          permissions: Array.from(rolePerms),
          isSystem: editingRole?.isSystem || false
      };
      
      if (editingRole) onUpdateRole(newRole);
      else onAddRole(newRole);
      setIsRoleModalOpen(false);
  }

  const togglePermission = (perm: Permission) => {
      const newSet = new Set(rolePerms);
      if (newSet.has(perm)) newSet.delete(perm);
      else newSet.add(perm);
      setRolePerms(newSet);
  }

  const confirmDeleteUser = () => {
      if (userToDelete) {
          onDeleteUser(userToDelete.id);
          setUserToDelete(null);
      }
  }

  const confirmDeleteRole = () => {
      if (roleToDelete) {
          onDeleteRole(roleToDelete.id);
          setRoleToDelete(null);
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-border pb-4">
        <h2 className="text-2xl font-semibold text-card-foreground">Quản trị Nhân sự & Phân quyền</h2>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-border">
          <button 
            onClick={() => setActiveTab('users')}
            className={`py-2 px-4 font-medium border-b-2 transition-colors ${activeTab === 'users' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-card-foreground'}`}
          >
              Danh sách Nhân viên
          </button>
           <button 
            onClick={() => setActiveTab('roles')}
            className={`py-2 px-4 font-medium border-b-2 transition-colors ${activeTab === 'roles' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-card-foreground'}`}
          >
              Vai trò & Quyền hạn
          </button>
      </div>

      {activeTab === 'users' && (
          <div className="space-y-4 animate-fade-in">
              <div className="flex justify-end">
                  <button onClick={() => handleOpenUserModal()} className="btn-primary px-4 py-2 flex items-center gap-2 shadow-sm">
                      <PlusIcon className="w-5 h-5" /> Thêm nhân viên
                  </button>
              </div>
              <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
                  <table className="min-w-full divide-y divide-border">
                      <thead className="bg-muted/50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Nhân viên</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Email</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Vai trò</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Ngày tham gia</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Thao tác</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                          {users.map(user => {
                              const role = roles.find(r => r.id === user.roleId);
                              return (
                                  <tr key={user.id} className="hover:bg-muted">
                                      <td className="px-6 py-4 flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                              {user.avatar}
                                          </div>
                                          <span className="text-sm font-medium text-card-foreground">{user.name}</span>
                                      </td>
                                      <td className="px-6 py-4 text-sm text-muted-foreground">{user.email}</td>
                                      <td className="px-6 py-4">
                                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${role ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-red-100 text-red-800'}`}>
                                              {role?.name || 'Chưa phân quyền'}
                                          </span>
                                      </td>
                                      <td className="px-6 py-4 text-sm text-muted-foreground">{new Date(user.joinDate).toLocaleDateString('vi-VN')}</td>
                                      <td className="px-6 py-4 text-center">
                                          <div className="flex items-center justify-center gap-2">
                                              <button onClick={() => handleOpenUserModal(user)} className="p-1 text-primary hover:bg-primary/10 rounded"><PencilIcon className="w-4 h-4"/></button>
                                              {user.roleId !== 'role-admin' && (
                                                  <button onClick={() => setUserToDelete(user)} className="p-1 text-red-600 hover:bg-red-100 rounded"><TrashIcon className="w-4 h-4"/></button>
                                              )}
                                          </div>
                                      </td>
                                  </tr>
                              )
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === 'roles' && (
           <div className="space-y-4 animate-fade-in">
              <div className="flex justify-end">
                  <button onClick={() => handleOpenRoleModal()} className="btn-primary px-4 py-2 flex items-center gap-2 shadow-sm">
                      <PlusIcon className="w-5 h-5" /> Tạo vai trò mới
                  </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {roles.map(role => (
                      <div key={role.id} className="card-base border p-5 rounded-xl flex flex-col h-full">
                          <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                  <ShieldCheckIcon className="w-6 h-6 text-primary"/>
                                  <h3 className="font-bold text-lg text-card-foreground">{role.name}</h3>
                              </div>
                              {!role.isSystem && (
                                  <div className="flex gap-1">
                                      <button onClick={() => handleOpenRoleModal(role)} className="p-1 hover:bg-muted rounded"><PencilIcon className="w-4 h-4 text-muted-foreground"/></button>
                                      <button onClick={() => setRoleToDelete(role)} className="p-1 hover:bg-red-100 rounded"><TrashIcon className="w-4 h-4 text-red-500"/></button>
                                  </div>
                              )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-4">{role.description}</p>
                          <div className="mt-auto pt-4 border-t border-border">
                              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Quyền hạn ({role.permissions.length})</p>
                              <div className="flex flex-wrap gap-2">
                                  {role.permissions.slice(0, 5).map(perm => (
                                      <span key={perm} className="text-[10px] px-2 py-1 bg-muted rounded text-muted-foreground border border-border">
                                          {allPermissions.find(p => p.id === perm)?.label}
                                      </span>
                                  ))}
                                  {role.permissions.length > 5 && (
                                      <span className="text-[10px] px-2 py-1 bg-muted rounded text-muted-foreground border border-border">+{role.permissions.length - 5}</span>
                                  )}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
           </div>
      )}
      
      {/* User Modal */}
      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={editingUser ? "Sửa thông tin nhân viên" : "Thêm nhân viên mới"}>
          <form onSubmit={handleSaveUser} className="space-y-4">
              {userError && (
                  <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                      <span className="block sm:inline">{userError}</span>
                  </div>
              )}
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                  <input type="text" required value={userName} onChange={e => setUserName(e.target.value)} className="w-full p-2 border rounded bg-white" />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" required value={userEmail} onChange={e => setUserEmail(e.target.value)} className="w-full p-2 border rounded bg-white" />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu {editingUser && '(Để trống nếu không đổi)'}</label>
                  <input type="password" value={userPassword} onChange={e => setUserPassword(e.target.value)} className="w-full p-2 border rounded bg-white" placeholder="••••••" />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò (Bắt buộc)</label>
                  <select required value={userRole} onChange={e => setUserRole(e.target.value)} className="w-full p-2 border rounded bg-white">
                      <option value="" disabled>Chọn vai trò</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setIsUserModalOpen(false)} className="btn-muted px-4 py-2">Hủy</button>
                  <button type="submit" className="btn-primary px-4 py-2">Lưu</button>
              </div>
          </form>
      </Modal>

       {/* Role Modal */}
       <Modal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} title={editingRole ? "Sửa vai trò" : "Tạo vai trò mới"}>
          <form onSubmit={handleSaveRole} className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên vai trò</label>
                  <input type="text" required value={roleName} onChange={e => setRoleName(e.target.value)} className="w-full p-2 border rounded bg-white" placeholder="Ví dụ: Shipper" />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                  <input type="text" value={roleDesc} onChange={e => setRoleDesc(e.target.value)} className="w-full p-2 border rounded bg-white" placeholder="Mô tả ngắn gọn về trách nhiệm" />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phân quyền</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto border p-2 rounded bg-slate-50">
                      {allPermissions.map(perm => (
                          <label key={perm.id} className="flex items-center gap-2 p-2 hover:bg-slate-200 rounded cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={rolePerms.has(perm.id)}
                                onChange={() => togglePermission(perm.id)}
                                className="rounded text-primary focus:ring-primary"
                              />
                              <span className="text-sm">{perm.label}</span>
                          </label>
                      ))}
                  </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setIsRoleModalOpen(false)} className="btn-muted px-4 py-2">Hủy</button>
                  <button type="submit" className="btn-primary px-4 py-2">Lưu</button>
              </div>
          </form>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal isOpen={!!userToDelete} onClose={() => setUserToDelete(null)} title="Xác nhận xóa nhân viên">
          <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600">
                      <ExclamationTriangleIcon className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className="font-bold text-red-800 dark:text-red-200">Bạn có chắc chắn muốn xóa?</h3>
                      <p className="text-sm text-red-700 dark:text-red-300">
                          Nhân viên <strong>{userToDelete?.name}</strong> sẽ bị xóa vĩnh viễn khỏi hệ thống.
                      </p>
                  </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setUserToDelete(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">Hủy bỏ</button>
                  <button onClick={confirmDeleteUser} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium shadow-sm flex items-center gap-2">
                      <TrashIcon className="w-4 h-4" /> Xóa nhân viên
                  </button>
              </div>
          </div>
      </Modal>

      {/* Delete Role Confirmation Modal */}
      <Modal isOpen={!!roleToDelete} onClose={() => setRoleToDelete(null)} title="Xác nhận xóa vai trò">
          <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600">
                      <ExclamationTriangleIcon className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className="font-bold text-red-800 dark:text-red-200">Bạn có chắc chắn muốn xóa?</h3>
                      <p className="text-sm text-red-700 dark:text-red-300">
                          Vai trò <strong>{roleToDelete?.name}</strong> sẽ bị xóa. Các nhân viên đang giữ vai trò này sẽ mất quyền hạn.
                      </p>
                  </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setRoleToDelete(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">Hủy bỏ</button>
                  <button onClick={confirmDeleteRole} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium shadow-sm flex items-center gap-2">
                      <TrashIcon className="w-4 h-4" /> Xóa vai trò
                  </button>
              </div>
          </div>
      </Modal>
    </div>
  );
};

export default StaffManagement;
