import { useState } from 'react';
import { MessageSquare, AtSign, Mail, LayoutDashboard, Settings, ChevronDown, ChevronRight, Archive, UserCheck } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  showSettings?: boolean;
}

const interactionTypes = [
  { id: 'comments', label: 'Kommentare', icon: MessageSquare },
  { id: 'messages', label: 'Nachrichten', icon: Mail },
  { id: 'mentions', label: 'Erwähnungen', icon: AtSign },
];

const channels = [
  { id: 'instagram', label: 'Instagram', icon: '📸', active: true },
  { id: 'facebook', label: 'Facebook', icon: '📘', active: false },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', active: false },
];

export function Sidebar({ activeView, onViewChange, showSettings = true }: SidebarProps) {
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
              <span>Dashboard</span>
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
            <span>Alle Interaktionen</span>
          </button>

          {/* Channel submenu */}
          <div className="ml-4 mt-1">
            <button
              onClick={() => setChannelsExpanded(!channelsExpanded)}
              className="flex items-center gap-2 text-gray-400 text-xs py-1 px-2 hover:text-gray-300 transition-colors"
            >
              {channelsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>Kanäle</span>
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
                        <span className="text-[10px] text-gray-600 ml-auto">Bald</span>
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
          <p className="text-xs text-gray-500 px-2 mb-2 uppercase tracking-wide">Nach Typ</p>
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
                  <span>{item.label}</span>
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
            <span>Mir zugewiesen</span>
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
            <span>Archiv</span>
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
            <span>Einstellungen</span>
          </button>
        </div>
      )}
    </aside>
  );
}
