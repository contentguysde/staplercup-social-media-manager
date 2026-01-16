import { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Edit2, Loader2, CheckCircle, XCircle, Shield, Eye, Briefcase, X, Save } from 'lucide-react';
import { authApi, type UserPublic, type Role } from '../../services/authApi';
import { useAuth } from '../../context/AuthContext';

const ROLE_CONFIG: Record<Role, { label: string; icon: typeof Shield; color: string; bgColor: string }> = {
  admin: { label: 'Admin', icon: Shield, color: 'text-red-600', bgColor: 'bg-red-50' },
  manager: { label: 'Manager', icon: Briefcase, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  viewer: { label: 'Viewer', icon: Eye, color: 'text-gray-600', bgColor: 'bg-gray-50' },
};

interface AddUserFormData {
  email: string;
  password: string;
  name: string;
  role: Role;
}

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserPublic | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [addFormData, setAddFormData] = useState<AddUserFormData>({
    email: '',
    password: '',
    name: '',
    role: 'viewer',
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    role: 'viewer' as Role,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await authApi.getUsers();
      setUsers(data);
    } catch (error) {
      setMessage({ type: 'error', text: 'Fehler beim Laden der Benutzer' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setMessage(null);

      await authApi.register(addFormData.email, addFormData.password, addFormData.name, addFormData.role);

      setMessage({ type: 'success', text: 'Benutzer erfolgreich angelegt' });
      setShowAddModal(false);
      setAddFormData({ email: '', password: '', name: '', role: 'viewer' });
      await loadUsers();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Fehler beim Anlegen' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setSubmitting(true);
      setMessage(null);

      // Update name if changed
      if (editFormData.name !== editingUser.name) {
        await authApi.updateUserName(editingUser.id, editFormData.name);
      }

      // Update role if changed
      if (editFormData.role !== editingUser.role) {
        await authApi.updateUserRole(editingUser.id, editFormData.role);
      }

      setMessage({ type: 'success', text: 'Benutzer erfolgreich aktualisiert' });
      setEditingUser(null);
      await loadUsers();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Fehler beim Aktualisieren' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      setDeletingUserId(userId);
      setMessage(null);

      await authApi.deleteUser(userId);

      setMessage({ type: 'success', text: 'Benutzer erfolgreich gelöscht' });
      await loadUsers();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Fehler beim Löschen' });
    } finally {
      setDeletingUserId(null);
    }
  };

  const openEditModal = (user: UserPublic) => {
    setEditingUser(user);
    setEditFormData({ name: user.name, role: user.role });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl"><Users size={28} className="text-gray-600" /></span>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Benutzerverwaltung</h3>
            <p className="text-sm text-gray-500">Verwalte Benutzer und deren Berechtigungen</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <UserPlus size={18} />
          Benutzer hinzufügen
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Name</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">E-Mail</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Rolle</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Erstellt</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const roleConfig = ROLE_CONFIG[user.role];
              const RoleIcon = roleConfig.icon;
              const isCurrentUser = currentUser?.id === user.id;

              return (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{user.name}</span>
                      {isCurrentUser && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Du</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{user.email}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm ${roleConfig.bgColor} ${roleConfig.color}`}>
                      <RoleIcon size={14} />
                      {roleConfig.label}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-sm">
                    {new Date(user.created_at).toLocaleDateString('de-DE')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        disabled={isCurrentUser}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={isCurrentUser ? 'Eigenes Profil kann hier nicht bearbeitet werden' : 'Bearbeiten'}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={isCurrentUser || deletingUserId === user.id}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={isCurrentUser ? 'Sie können sich nicht selbst löschen' : 'Löschen'}
                      >
                        {deletingUserId === user.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Keine Benutzer gefunden
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-800">Neuen Benutzer anlegen</h4>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={addFormData.name}
                  onChange={(e) => setAddFormData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Max Mustermann"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input
                  type="email"
                  value={addFormData.email}
                  onChange={(e) => setAddFormData((prev) => ({ ...prev, email: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="max@beispiel.de"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                <input
                  type="password"
                  value={addFormData.password}
                  onChange={(e) => setAddFormData((prev) => ({ ...prev, password: e.target.value }))}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Mindestens 8 Zeichen"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
                <select
                  value={addFormData.role}
                  onChange={(e) => setAddFormData((prev) => ({ ...prev, role: e.target.value as Role }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="viewer">Viewer - Nur lesen</option>
                  <option value="manager">Manager - Interaktionen bearbeiten</option>
                  <option value="admin">Admin - Vollzugriff</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  Anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-800">Benutzer bearbeiten</h4>
              <button onClick={() => setEditingUser(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input
                  type="email"
                  value={editingUser.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, role: e.target.value as Role }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="viewer">Viewer - Nur lesen</option>
                  <option value="manager">Manager - Interaktionen bearbeiten</option>
                  <option value="admin">Admin - Vollzugriff</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
