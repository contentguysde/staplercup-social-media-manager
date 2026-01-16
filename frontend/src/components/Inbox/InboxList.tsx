import { MessageSquare, Mail, AtSign, Image, Filter, X, Archive, ArchiveRestore, MailOpen, Mail as MailIcon } from 'lucide-react';
import { useState } from 'react';
import type { Interaction, InteractionType, Urgency, Language, Topic, Platform } from '../../types';
import { InteractionLabels } from './InteractionLabels';

interface FilterState {
  urgency: Urgency | null;
  language: Language | null;
  topic: Topic | null;
  channel: Platform | null;
}

interface InboxListProps {
  interactions: Interaction[];
  selectedId: string | null;
  onSelect: (interaction: Interaction) => void;
  filter?: InteractionType;
  isArchiveView?: boolean;
  onArchive?: (interactionId: string) => void;
  onUnarchive?: (interactionId: string) => void;
  onMarkAsRead?: (interactionId: string) => void;
  onMarkAsUnread?: (interactionId: string) => void;
}

const typeIcons = {
  comment: MessageSquare,
  dm: Mail,
  mention: AtSign,
  like: MessageSquare,
};

const typeLabels = {
  comment: 'Kommentar',
  dm: 'Nachricht',
  mention: 'Erwähnung',
  like: 'Like',
};

const urgencyOptions: { value: Urgency; label: string }[] = [
  { value: 'high', label: 'Dringend' },
  { value: 'medium', label: 'Mittel' },
  { value: 'low', label: 'Niedrig' },
];

const languageOptions: { value: Language; label: string }[] = [
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'en', label: '🇬🇧 Englisch' },
  { value: 'other', label: '🌍 Andere' },
];

const topicOptions: { value: Topic; label: string }[] = [
  { value: 'participation_request', label: 'Teilnahme-Anfrage' },
  { value: 'praise', label: 'Lob' },
  { value: 'criticism', label: 'Kritik' },
  { value: 'question', label: 'Frage' },
  { value: 'sponsor_inquiry', label: 'Sponsoring' },
  { value: 'media_request', label: 'Medien-Anfrage' },
  { value: 'general', label: 'Allgemein' },
  { value: 'spam', label: 'Spam' },
];

const channelOptions: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
];

export function InboxList({
  interactions,
  selectedId,
  onSelect,
  filter,
  isArchiveView = false,
  onArchive,
  onUnarchive,
  onMarkAsRead,
  onMarkAsUnread,
}: InboxListProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [labelFilters, setLabelFilters] = useState<FilterState>({
    urgency: null,
    language: null,
    topic: null,
    channel: null,
  });

  const activeFilterCount = Object.values(labelFilters).filter((v) => v !== null).length;

  const clearFilters = () => {
    setLabelFilters({ urgency: null, language: null, topic: null, channel: null });
  };

  let filteredInteractions = filter
    ? interactions.filter((i) => i.type === filter)
    : interactions;

  // Apply label filters
  filteredInteractions = filteredInteractions.filter((interaction) => {
    if (!interaction.labels) return true; // Show items without labels

    if (labelFilters.urgency && interaction.labels.urgency !== labelFilters.urgency) {
      return false;
    }
    if (labelFilters.language && interaction.labels.language !== labelFilters.language) {
      return false;
    }
    if (labelFilters.topic && interaction.labels.topic !== labelFilters.topic) {
      return false;
    }
    if (labelFilters.channel && interaction.labels.channel !== labelFilters.channel) {
      return false;
    }
    return true;
  });

  const FilterPanel = () => (
    <div className="p-3 bg-gray-50 border-b border-gray-200 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Dringlichkeit</label>
          <select
            value={labelFilters.urgency || ''}
            onChange={(e) =>
              setLabelFilters((prev) => ({
                ...prev,
                urgency: (e.target.value as Urgency) || null,
              }))
            }
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Alle</option>
            {urgencyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sprache</label>
          <select
            value={labelFilters.language || ''}
            onChange={(e) =>
              setLabelFilters((prev) => ({
                ...prev,
                language: (e.target.value as Language) || null,
              }))
            }
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Alle</option>
            {languageOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Thema</label>
          <select
            value={labelFilters.topic || ''}
            onChange={(e) =>
              setLabelFilters((prev) => ({
                ...prev,
                topic: (e.target.value as Topic) || null,
              }))
            }
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Alle</option>
            {topicOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Kanal</label>
          <select
            value={labelFilters.channel || ''}
            onChange={(e) =>
              setLabelFilters((prev) => ({
                ...prev,
                channel: (e.target.value as Platform) || null,
              }))
            }
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Alle</option>
            {channelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {activeFilterCount > 0 && (
        <button
          onClick={clearFilters}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <X size={12} />
          Filter zurücksetzen
        </button>
      )}
    </div>
  );

  if (filteredInteractions.length === 0) {
    return (
      <div className="flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeFilterCount > 0
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Filter size={14} />
            Filter {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
        </div>
        {showFilters && <FilterPanel />}
        <div className="flex flex-col items-center justify-center flex-1 text-gray-400 p-8">
          <MessageSquare size={48} className="mb-4 opacity-50" />
          <p className="text-center">Keine Interaktionen gefunden</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
            activeFilterCount > 0
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Filter size={14} />
          Filter {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>
      </div>
      {showFilters && <FilterPanel />}
      <div className="divide-y divide-gray-100 overflow-y-auto flex-1">
      {filteredInteractions.map((interaction) => {
        const Icon = typeIcons[interaction.type];
        const isSelected = selectedId === interaction.id;
        const isUnread = interaction.status === 'unread';
        const formattedTime = new Date(interaction.timestamp).toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <div
            key={interaction.id}
            className={`relative group transition-colors ${
              isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
            } ${isUnread ? 'bg-white' : 'bg-gray-50/50'}`}
          >
            <button
              onClick={() => onSelect(interaction)}
              className="w-full text-left p-4 hover:bg-gray-50/80 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Unread indicator bar */}
                {isUnread && !isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                )}

                {interaction.context?.mediaUrl ? (
                  <img
                    src={interaction.context.mediaUrl}
                    alt="Post"
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                    <Image size={20} className="text-gray-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isUnread ? 'text-gray-900' : 'text-gray-600'}`}>
                        @{interaction.from.username}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Icon size={12} />
                        {typeLabels[interaction.type]}
                      </span>
                      {isUnread && (
                        <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                          Neu
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{formattedTime}</span>
                  </div>

                  <p className={`text-sm truncate ${isUnread ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>
                    {interaction.content}
                  </p>

                  {interaction.labels && (
                    <div className="mt-1.5">
                      <InteractionLabels labels={interaction.labels} compact />
                    </div>
                  )}

                  {interaction.replies && interaction.replies.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ {interaction.replies.length} Antwort(en)
                    </p>
                  )}
                </div>

              </div>
            </button>

            {/* Action buttons - visible on hover */}
            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              {/* Mark as read/unread button */}
              {isUnread ? (
                onMarkAsRead && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkAsRead(interaction.id);
                    }}
                    className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                    title="Als gelesen markieren"
                  >
                    <MailOpen size={14} />
                  </button>
                )
              ) : (
                onMarkAsUnread && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkAsUnread(interaction.id);
                    }}
                    className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                    title="Als ungelesen markieren"
                  >
                    <MailIcon size={14} />
                  </button>
                )
              )}

              {/* Archive/Unarchive button */}
              {isArchiveView ? (
                onUnarchive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnarchive(interaction.id);
                    }}
                    className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-500 hover:text-green-600 hover:border-green-300 transition-colors"
                    title="Aus Archiv wiederherstellen"
                  >
                    <ArchiveRestore size={14} />
                  </button>
                )
              ) : (
                onArchive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive(interaction.id);
                    }}
                    className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-500 hover:text-amber-600 hover:border-amber-300 transition-colors"
                    title="Archivieren"
                  >
                    <Archive size={14} />
                  </button>
                )
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
