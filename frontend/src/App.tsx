import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AlertTriangle, Settings as SettingsIcon, X, Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/Auth/LoginPage';
import { VerifyEmailPage } from './components/Auth/VerifyEmailPage';
import { Sidebar } from './components/common/Sidebar';
import { Header } from './components/common/Header';
import { Dashboard } from './components/Dashboard/Dashboard';
import { InboxList } from './components/Inbox/InboxList';
import { ConversationView } from './components/Inbox/ConversationView';
import { Settings } from './components/Settings/Settings';
import { useInstagram } from './hooks/useInstagram';
import type { Interaction, InteractionType, Platform } from './types';

const viewTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  all: 'Alle Interaktionen',
  comments: 'Kommentare',
  messages: 'Nachrichten',
  mentions: 'Erwähnungen',
  'my-assigned': 'Mir zugewiesen',
  archive: 'Archiv',
  settings: 'Einstellungen',
  // Channel views
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

// Filter by interaction type
const typeFilters: Record<string, InteractionType | undefined> = {
  all: undefined,
  comments: 'comment',
  messages: 'dm',
  mentions: 'mention',
};

// Filter by platform/channel
const platformFilters: Record<string, Platform | undefined> = {
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
};

function MainApp() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);

  const {
    interactions,
    archivedInteractions,
    loading,
    error,
    connectionStatus,
    refresh,
    replyToComment,
    sendMessage,
    markAsRead,
    markAsUnread,
    archiveInteraction,
    unarchiveInteraction,
    assignableUsers,
    allAssignments,
    assignInteraction,
    unassignInteraction,
    getMyAssignedInteractions,
  } = useInstagram({
    autoRefresh: true,
    refreshInterval: 60000,
  });

  // Only show settings for admin users
  const canAccessSettings = user?.role === 'admin';
  // Only managers and admins can assign
  const canAssign = user?.role === 'admin' || user?.role === 'manager';

  // Reset error dismissed state when error changes
  const showError = error && !errorDismissed && activeView !== 'settings';

  const handleSendReply = async (message: string) => {
    if (!selectedInteraction) return;

    if (selectedInteraction.type === 'comment') {
      await replyToComment(selectedInteraction.id, message);
    } else if (selectedInteraction.type === 'dm') {
      await sendMessage(selectedInteraction.from.id, message);
    }
  };

  // Filter interactions based on active view
  const filteredInteractions = (() => {
    // Filter by platform (channel views)
    if (platformFilters[activeView]) {
      return interactions.filter((i) => i.platform === platformFilters[activeView]);
    }
    // Filter by interaction type
    if (typeFilters[activeView]) {
      return interactions.filter((i) => i.type === typeFilters[activeView]);
    }
    // No filter (all interactions)
    return interactions;
  })();

  const isInboxView = ['all', 'comments', 'messages', 'mentions', 'instagram', 'facebook', 'tiktok'].includes(activeView);
  const isArchiveView = activeView === 'archive';
  const isMyAssignedView = activeView === 'my-assigned';

  // Handle interaction selection and mark as read
  const handleSelectInteraction = async (interaction: Interaction) => {
    setSelectedInteraction(interaction);
    if (interaction.status === 'unread') {
      try {
        await markAsRead(interaction.id);
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    }
  };

  // Handle archive/unarchive
  const handleArchive = async (interactionId: string) => {
    try {
      await archiveInteraction(interactionId);
      if (selectedInteraction?.id === interactionId) {
        setSelectedInteraction(null);
      }
    } catch (err) {
      console.error('Failed to archive:', err);
    }
  };

  const handleUnarchive = async (interactionId: string) => {
    try {
      await unarchiveInteraction(interactionId);
      if (selectedInteraction?.id === interactionId) {
        setSelectedInteraction(null);
      }
    } catch (err) {
      console.error('Failed to unarchive:', err);
    }
  };

  // Handle mark as read/unread
  const handleMarkAsRead = async (interactionId: string) => {
    try {
      await markAsRead(interactionId);
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAsUnread = async (interactionId: string) => {
    try {
      await markAsUnread(interactionId);
    } catch (err) {
      console.error('Failed to mark as unread:', err);
    }
  };

  // Handle assignment
  const handleAssign = async (interactionId: string, userId: number) => {
    try {
      await assignInteraction(interactionId, userId);
    } catch (err) {
      console.error('Failed to assign:', err);
    }
  };

  const handleUnassign = async (interactionId: string) => {
    try {
      await unassignInteraction(interactionId);
    } catch (err) {
      console.error('Failed to unassign:', err);
    }
  };

  // Handle view change - prevent non-admins from accessing settings
  const handleViewChange = (view: string) => {
    if (view === 'settings' && !canAccessSettings) {
      return;
    }
    setActiveView(view);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        showSettings={canAccessSettings}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={viewTitles[activeView] || 'StaplerCup Social'}
          onRefresh={isInboxView || isArchiveView || isMyAssignedView ? refresh : undefined}
          loading={loading}
        />

        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Error Banner */}
          {showError && (
            <div className={`border-b px-6 py-4 flex-shrink-0 ${
              connectionStatus?.errorType === 'token_expired'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={20}
                  className={connectionStatus?.errorType === 'token_expired' ? 'text-amber-500 flex-shrink-0 mt-0.5' : 'text-red-500 flex-shrink-0 mt-0.5'}
                />
                <div className="flex-1">
                  <p className={`font-medium ${connectionStatus?.errorType === 'token_expired' ? 'text-amber-800' : 'text-red-800'}`}>
                    {connectionStatus?.errorType === 'token_expired'
                      ? 'Instagram-Verbindung abgelaufen'
                      : connectionStatus?.errorType === 'token_invalid'
                      ? 'Instagram nicht verbunden'
                      : 'Verbindungsproblem'}
                  </p>
                  <p className={`text-sm mt-1 ${connectionStatus?.errorType === 'token_expired' ? 'text-amber-700' : 'text-red-700'}`}>
                    {error}
                  </p>
                  {connectionStatus?.usingMockData && (
                    <p className="text-sm mt-2 text-gray-600">
                      Es werden Demo-Daten angezeigt.
                    </p>
                  )}
                  {canAccessSettings && (
                    <button
                      onClick={() => setActiveView('settings')}
                      className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        connectionStatus?.errorType === 'token_expired'
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      <SettingsIcon size={14} />
                      Zu den Einstellungen
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setErrorDismissed(true)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Schließen"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          {activeView === 'dashboard' && (
            <div className="flex-1 overflow-y-auto">
              <Dashboard interactions={interactions} />
            </div>
          )}

          {activeView === 'settings' && canAccessSettings && (
            <div className="flex-1 overflow-y-auto bg-gray-50">
              <Settings />
            </div>
          )}

          {isInboxView && (
            <div className="flex flex-1 min-h-0">
              {/* Inbox List */}
              <div className="w-96 border-r border-gray-200 bg-white overflow-y-auto">
                <InboxList
                  interactions={filteredInteractions}
                  selectedId={selectedInteraction?.id || null}
                  onSelect={handleSelectInteraction}
                  filter={typeFilters[activeView]}
                  onArchive={handleArchive}
                  onMarkAsRead={handleMarkAsRead}
                  onMarkAsUnread={handleMarkAsUnread}
                  assignableUsers={assignableUsers}
                  allAssignments={allAssignments}
                  onAssign={handleAssign}
                  onUnassign={handleUnassign}
                  canAssign={canAssign}
                />
              </div>

              {/* Conversation View */}
              <div className="flex-1 bg-white overflow-hidden">
                {selectedInteraction ? (
                  <ConversationView
                    interaction={selectedInteraction}
                    onSendReply={handleSendReply}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <p className="text-lg mb-2">Wähle eine Konversation</p>
                      <p className="text-sm">Klicke auf eine Interaktion links, um sie anzuzeigen</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {isArchiveView && (
            <div className="flex flex-1 min-h-0">
              {/* Archive List */}
              <div className="w-96 border-r border-gray-200 bg-white overflow-y-auto">
                <InboxList
                  interactions={archivedInteractions}
                  selectedId={selectedInteraction?.id || null}
                  onSelect={handleSelectInteraction}
                  isArchiveView={true}
                  onUnarchive={handleUnarchive}
                  onMarkAsRead={handleMarkAsRead}
                  onMarkAsUnread={handleMarkAsUnread}
                  assignableUsers={assignableUsers}
                  allAssignments={allAssignments}
                  onAssign={handleAssign}
                  onUnassign={handleUnassign}
                  canAssign={canAssign}
                />
              </div>

              {/* Conversation View */}
              <div className="flex-1 bg-white overflow-hidden">
                {selectedInteraction ? (
                  <ConversationView
                    interaction={selectedInteraction}
                    onSendReply={handleSendReply}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <p className="text-lg mb-2">Archivierte Interaktionen</p>
                      <p className="text-sm">Klicke auf eine Interaktion links, um sie anzuzeigen</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {isMyAssignedView && (
            <div className="flex flex-1 min-h-0">
              {/* My Assigned List */}
              <div className="w-96 border-r border-gray-200 bg-white overflow-y-auto">
                <InboxList
                  interactions={getMyAssignedInteractions()}
                  selectedId={selectedInteraction?.id || null}
                  onSelect={handleSelectInteraction}
                  onArchive={handleArchive}
                  onMarkAsRead={handleMarkAsRead}
                  onMarkAsUnread={handleMarkAsUnread}
                  assignableUsers={assignableUsers}
                  allAssignments={allAssignments}
                  onAssign={handleAssign}
                  onUnassign={handleUnassign}
                  canAssign={canAssign}
                />
              </div>

              {/* Conversation View */}
              <div className="flex-1 bg-white overflow-hidden">
                {selectedInteraction ? (
                  <ConversationView
                    interaction={selectedInteraction}
                    onSendReply={handleSendReply}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <p className="text-lg mb-2">Mir zugewiesene Interaktionen</p>
                      <p className="text-sm">Hier erscheinen Interaktionen, die dir zugewiesen wurden</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 size={24} className="animate-spin" />
          <span>Laden...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <MainApp />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
