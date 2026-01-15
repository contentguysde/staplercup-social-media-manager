import { MessageSquare, Mail, AtSign, TrendingUp } from 'lucide-react';
import type { Interaction } from '../../types';

interface DashboardProps {
  interactions: Interaction[];
}

export function Dashboard({ interactions }: DashboardProps) {
  const comments = interactions.filter((i) => i.type === 'comment');
  const messages = interactions.filter((i) => i.type === 'dm');
  const mentions = interactions.filter((i) => i.type === 'mention');
  const unread = interactions.filter((i) => i.status === 'unread');

  const stats = [
    {
      label: 'Gesamt Interaktionen',
      value: interactions.length,
      icon: TrendingUp,
      color: 'bg-blue-500',
    },
    {
      label: 'Kommentare',
      value: comments.length,
      icon: MessageSquare,
      color: 'bg-purple-500',
    },
    {
      label: 'Nachrichten',
      value: messages.length,
      icon: Mail,
      color: 'bg-green-500',
    },
    {
      label: 'Erwähnungen',
      value: mentions.length,
      icon: AtSign,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h2>
        <p className="text-gray-500">Übersicht deiner Instagram-Interaktionen</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon size={24} className="text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Unread Alert */}
      {unread.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📬</span>
            <div>
              <p className="font-medium text-yellow-800">
                {unread.length} ungelesene Interaktion{unread.length !== 1 ? 'en' : ''}
              </p>
              <p className="text-sm text-yellow-600">
                Schau dir die neuen Nachrichten an und antworte mit AI-Unterstützung
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Letzte Aktivitäten</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {interactions.slice(0, 5).map((interaction) => (
            <div key={interaction.id} className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                {interaction.type === 'comment' && <MessageSquare size={18} className="text-gray-500" />}
                {interaction.type === 'dm' && <Mail size={18} className="text-gray-500" />}
                {interaction.type === 'mention' && <AtSign size={18} className="text-gray-500" />}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">@{interaction.from.username}</p>
                <p className="text-sm text-gray-500 truncate">{interaction.content}</p>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(interaction.timestamp).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}

          {interactions.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
              <p>Noch keine Interaktionen vorhanden</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
