import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, AtSign, Mail, LayoutDashboard, Settings, ChevronDown, ChevronRight, Archive, UserCheck } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  showSettings?: boolean;
  myAssignedCount?: number;
}

const interactionTypes = [
  { id: 'comments', labelKey: 'nav.comments', icon: MessageSquare },
  { id: 'messages', labelKey: 'nav.messages', icon: Mail },
  { id: 'mentions', labelKey: 'nav.mentions', icon: AtSign },
];

const channels = [
  { id: 'instagram', label: 'Instagram', icon: '📸', active: true },
  { id: 'facebook', label: 'Facebook', icon: '📘', active: true },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', active: true },
];

export function Sidebar({ activeView, onViewChange, showSettings = true, myAssignedCount = 0 }: SidebarProps) {
  const { t } = useTranslation();
  const [channelsExpanded, setChannelsExpanded] = useState(true);

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-screen">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          StaplerCup
        </h1>
        <p className="text-sm text-gray-400 mt-1">Social Media Manager</p>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        {/* Dashboard */}
        <ul className="space-y-1 mb-4">
          <li>
            <button
              onClick={() => onViewChange('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeView === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <LayoutDashboard size={18} />
              <span>{t('nav.dashboard')}</span>
            </button>
          </li>
        </ul>

        {/* Alle Interaktionen with expandable channels */}
        <div className="mb-4">
          <button
            onClick={() => onViewChange('all')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              activeView === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <MessageSquare size={18} />
            <span>{t('nav.allInteractions')}</span>
          </button>

          {/* Channel submenu */}
          <div className="ml-4 mt-1">
            <button
              onClick={() => setChannelsExpanded(!channelsExpanded)}
              className="flex items-center gap-2 text-gray-400 text-xs py-1 px-2 hover:text-gray-300 transition-colors"
            >
              {channelsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>{t('nav.channels')}</span>
            </button>

            {channelsExpanded && (
              <ul className="space-y-0.5 mt-1">
                {channels.map((channel) => (
                  <li key={channel.id}>
                    <button
                      onClick={() => channel.active && onViewChange(channel.id)}
                      disabled={!channel.active}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                        activeView === channel.id
                          ? 'bg-blue-600/80 text-white'
                          : channel.active
                          ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                          : 'text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      <span>{channel.icon}</span>
                      <span>{channel.label}</span>
                      {!channel.active && (
                        <span className="text-[10px] text-gray-600 ml-auto">{t('common.soon')}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Interaction types */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 px-2 mb-2 uppercase tracking-wide">{t('nav.byType')}</p>
          <ul className="space-y-1">
            {interactionTypes.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    activeView === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <item.icon size={18} />
                  <span>{t(item.labelKey)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* My Assigned */}
        <div className="mb-4">
          <button
            onClick={() => onViewChange('my-assigned')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              activeView === 'my-assigned'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <UserCheck size={18} />
            <span className="flex-1 text-left">{t('nav.myAssigned')}</span>
            <span className={`min-w-[20px] h-5 flex items-center justify-center px-1.5 text-xs font-medium rounded-full ${
              activeView === 'my-assigned'
                ? 'bg-white/20 text-white'
                : myAssignedCount > 0
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400'
            }`}>
              {myAssignedCount}
            </span>
          </button>
        </div>

        {/* Archive */}
        <div className="mb-4">
          <button
            onClick={() => onViewChange('archive')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              activeView === 'archive'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <Archive size={18} />
            <span>{t('nav.archive')}</span>
          </button>
        </div>
      </nav>

      {showSettings && (
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={() => onViewChange('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              activeView === 'settings'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Settings size={18} />
            <span>{t('nav.settings')}</span>
          </button>
        </div>
      )}
    </aside>
  );
}
