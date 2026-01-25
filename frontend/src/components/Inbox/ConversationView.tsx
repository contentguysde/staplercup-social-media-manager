import { useState, useRef, useEffect } from 'react';
import { Send, ExternalLink, Heart, User, UserPlus, UserMinus, ChevronDown, Loader2, Film, Image } from 'lucide-react';
import { SuggestionPanel } from '../AIAssistant/SuggestionPanel';
import { instagramApi, type DMMessage } from '../../services/api';
import type { Interaction, AssignmentInfo, AssignableUser } from '../../types';

interface ConversationViewProps {
  interaction: Interaction;
  onSendReply: (message: string) => Promise<void>;
  // Assignment props
  assignableUsers?: AssignableUser[];
  assignment?: AssignmentInfo;
  onAssign?: (interactionId: string, userId: number, interactionData: {
    content: string;
    type: string;
    from: string;
    timestamp: string;
    platform: string;
  }) => void;
  onUnassign?: (interactionId: string) => void;
  canAssign?: boolean;
}

// Helper to format caption with hashtags and mentions
function formatCaption(caption: string, platform: string = 'instagram') {
  if (!caption) return null;

  const parts = caption.split(/(\s+)/);

  return parts.map((part, index) => {
    if (part.startsWith('#')) {
      return (
        <span key={index} className="text-blue-600 hover:underline cursor-pointer">
          {part}
        </span>
      );
    }
    if (part.startsWith('@')) {
      // Link to the appropriate platform profile
      const profileUrl = platform === 'facebook'
        ? `https://facebook.com/search/top?q=${encodeURIComponent(part.slice(1))}`
        : `https://instagram.com/${part.slice(1)}`;
      return (
        <a
          key={index}
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export function ConversationView({
  interaction,
  onSendReply,
  assignableUsers = [],
  assignment,
  onAssign,
  onUnassign,
  canAssign = false,
}: ConversationViewProps) {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const assignDropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // DM conversation state
  const [dmMessages, setDmMessages] = useState<DMMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // Check if this is a DM with a conversation ID
  const isDM = interaction.type === 'dm';
  const conversationId = (interaction as any).conversationId as string | undefined;

  // Load DM messages when conversation changes
  useEffect(() => {
    if (isDM && conversationId) {
      loadDMMessages();
    } else {
      setDmMessages([]);
    }
  }, [interaction.id, conversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (dmMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dmMessages]);

  const loadDMMessages = async () => {
    if (!conversationId) return;

    try {
      setLoadingMessages(true);
      setMessagesError(null);
      const messages = await instagramApi.getConversationMessages(conversationId);
      // Sort messages by timestamp (oldest first for chat view)
      setDmMessages(messages.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ));
    } catch (err) {
      console.error('Failed to load DM messages:', err);
      setMessagesError(err instanceof Error ? err.message : 'Fehler beim Laden der Nachrichten');
    } finally {
      setLoadingMessages(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(event.target as Node)) {
        setShowAssignDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = async () => {
    if (!replyText.trim() || sending) return;

    try {
      setSending(true);
      await onSendReply(replyText);
      setReplyText('');
    } finally {
      setSending(false);
    }
  };

  // Open Instagram to like the comment (API doesn't support liking comments)
  const handleOpenToLike = () => {
    if (interaction.context?.mediaPermalink) {
      window.open(interaction.context.mediaPermalink, '_blank');
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setReplyText(suggestion);
  };

  // Platform-specific profile URL
  const userProfileUrl = interaction.platform === 'facebook'
    ? `https://facebook.com/${interaction.from.id}`
    : `https://instagram.com/${interaction.from.username}`;
  const postUrl = interaction.context?.mediaPermalink || '#';

  const formattedTime = new Date(interaction.timestamp).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href={userProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5 hover:opacity-80 transition-opacity"
            >
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                <User size={20} className="text-gray-600" />
              </div>
            </a>
            <div>
              <div className="flex items-center gap-2">
                <a
                  href={userProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                >
                  @{interaction.from.username}
                </a>
                {/* Assignment Button */}
                {canAssign && (
                  <div className="relative" ref={assignDropdownRef}>
                    {assignment ? (
                      <button
                        onClick={() => onUnassign?.(interaction.id)}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
                        title={`Zuweisung von ${assignment.user_name} entfernen`}
                      >
                        <UserMinus size={12} />
                        {assignment.user_name}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full hover:bg-purple-100 hover:text-purple-700 transition-colors"
                          title="Zuweisen"
                        >
                          <UserPlus size={12} />
                          Zuweisen
                          <ChevronDown size={12} />
                        </button>
                        {showAssignDropdown && (
                          <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                            <p className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">
                              Zuweisen an:
                            </p>
                            {assignableUsers.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => {
                                  onAssign?.(interaction.id, user.id, {
                                    content: interaction.content,
                                    type: interaction.type,
                                    from: interaction.from.username,
                                    timestamp: interaction.timestamp,
                                    platform: interaction.platform,
                                  });
                                  setShowAssignDropdown(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                              >
                                {user.name}
                              </button>
                            ))}
                            {assignableUsers.length === 0 && (
                              <p className="px-3 py-2 text-sm text-gray-400">Keine Benutzer verfügbar</p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {/* Show assignment indicator for non-assigners */}
                {!canAssign && assignment && (
                  <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                    <UserPlus size={12} />
                    {assignment.user_name}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 capitalize">
                {interaction.type === 'comment' ? 'Kommentar' : interaction.type === 'dm' ? 'Direktnachricht' : 'Erwähnung'}
              </p>
            </div>
          </div>
          {interaction.context?.mediaPermalink && (
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <ExternalLink size={14} />
              Post öffnen
            </a>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {/* DM Chat View - Full conversation history */}
        {isDM && (
          <>
            {loadingMessages ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Lade Nachrichten...</span>
              </div>
            ) : messagesError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-700">{messagesError}</p>
                <button
                  onClick={loadDMMessages}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Erneut versuchen
                </button>
              </div>
            ) : dmMessages.length > 0 ? (
              /* Full DM conversation */
              dmMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.fromMe
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md shadow-sm'
                    }`}
                  >
                    {!msg.fromMe && (
                      <p className="text-xs font-medium text-gray-500 mb-1">@{msg.from.username}</p>
                    )}
                    <p className="text-sm whitespace-pre-line">{msg.content}</p>
                    <p className={`text-xs mt-1.5 ${msg.fromMe ? 'text-blue-200' : 'text-gray-400'}`}>
                      {new Date(msg.timestamp).toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              /* Fallback: Show single DM if no conversation history loaded */
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-white border border-gray-200 text-gray-900 rounded-bl-md shadow-sm">
                  <p className="text-xs font-medium text-gray-500 mb-1">@{interaction.from.username}</p>
                  <p className="text-sm whitespace-pre-line">{interaction.content}</p>
                  <p className="text-xs mt-1.5 text-gray-400">{formattedTime}</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Comment/Mention View - Original layout */}
        {!isDM && (
          <>
            {/* Comment Section - Now ABOVE the post */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  {/* Comment content */}
                  <div className="flex-1 min-w-0">
                    {/* Header row with username, time, and labels */}
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <a
                        href={userProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-gray-900 hover:text-blue-600 text-sm"
                      >
                        @{interaction.from.username}
                      </a>
                      <span className="text-xs text-gray-400">{formattedTime}</span>

                      {/* Labels inline after username: Channel -> Language -> Urgency -> Topic */}
                      {/* Channel label (always shown) */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700">
                        {interaction.platform === 'facebook' ? '📘' : interaction.platform === 'tiktok' ? '🎵' : '📸'}
                        {interaction.platform === 'facebook' ? 'Facebook' : interaction.platform === 'tiktok' ? 'TikTok' : 'Instagram'}
                      </span>

                      {interaction.labels && (
                        <>
                          {/* Language label */}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            {interaction.labels.language === 'de' ? '🇩🇪' : interaction.labels.language === 'en' ? '🇬🇧' : '🌍'}
                            {interaction.labels.language === 'de'
                              ? 'Deutsch'
                              : interaction.labels.language === 'en'
                              ? 'Englisch'
                              : 'Andere'}
                          </span>

                          {/* Urgency label */}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              interaction.labels.urgency === 'high'
                                ? 'bg-red-100 text-red-700'
                                : interaction.labels.urgency === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                interaction.labels.urgency === 'high'
                                  ? 'bg-red-500'
                                  : interaction.labels.urgency === 'medium'
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                            />
                            {interaction.labels.urgency === 'high'
                              ? 'Hoch'
                              : interaction.labels.urgency === 'medium'
                              ? 'Mittel'
                              : 'Niedrig'}
                          </span>

                          {/* Topic label */}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-white">
                            {interaction.labels.topic === 'participation_request'
                              ? '🎯 Teilnahme'
                              : interaction.labels.topic === 'praise'
                              ? '👏 Lob'
                              : interaction.labels.topic === 'criticism'
                              ? '⚠️ Kritik'
                              : interaction.labels.topic === 'question'
                              ? '❓ Frage'
                              : interaction.labels.topic === 'sponsor_inquiry'
                              ? '💼 Sponsoring'
                              : interaction.labels.topic === 'media_request'
                              ? '📸 Medien'
                              : interaction.labels.topic === 'spam'
                              ? '🚫 Spam'
                              : '💬 Allgemein'}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Comment text */}
                    <p className="text-gray-800 whitespace-pre-line">{interaction.content}</p>
                  </div>

                  {/* Like button - opens Instagram since API doesn't support liking comments */}
                  {interaction.type === 'comment' && interaction.context?.mediaPermalink && (
                    <button
                      onClick={handleOpenToLike}
                      className="flex-shrink-0 p-2 rounded-full transition-all text-gray-400 hover:text-red-500 hover:bg-red-50"
                      title="Auf Instagram öffnen um zu liken"
                    >
                      <Heart size={20} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Instagram-Style Post Preview - Now BELOW the comment */}
            {interaction.context?.mediaUrl && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Post Header */}
                <div className="flex items-center gap-3 p-3 border-b border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5">
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-600">SC</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">staplercup_official</p>
                  </div>
                  {/* Media type indicator */}
                  {interaction.context?.mediaProductType && (
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      interaction.context.mediaProductType === 'REELS'
                        ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {interaction.context.mediaProductType === 'REELS' ? (
                        <>
                          <Film size={12} />
                          Reel
                        </>
                      ) : (
                        <>
                          <Image size={12} />
                          Post
                        </>
                      )}
                    </span>
                  )}
                  {interaction.context?.mediaPermalink && (
                    <a
                      href={postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>

                {/* Post Image */}
                <div className="relative">
                  <img
                    src={interaction.context.mediaUrl}
                    alt="Post"
                    className="w-full aspect-square object-cover"
                  />
                </div>

                {/* Post Actions */}
                <div className="p-3 border-b border-gray-100">
                  <div className="flex items-center gap-4">
                    <Heart size={24} className="text-gray-700 cursor-pointer hover:text-red-500 transition-colors" />
                    <svg className="w-6 h-6 text-gray-700 cursor-pointer hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <svg className="w-6 h-6 text-gray-700 cursor-pointer hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </div>
                </div>

                {/* Post Caption */}
                {interaction.context.mediaCaption && (
                  <div className="p-3">
                    <p className="text-sm text-gray-800 whitespace-pre-line">
                      {formatCaption(interaction.context.mediaCaption, interaction.platform)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Replies */}
            {interaction.replies?.map((reply) => (
              <div key={reply.id} className={`flex ${reply.isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    reply.isOwn
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{reply.content}</p>
                  <p className={`text-xs mt-1 ${reply.isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                    {new Date(reply.timestamp).toLocaleString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* AI Suggestions */}
      <SuggestionPanel
        interaction={interaction}
        onSelectSuggestion={handleSuggestionSelect}
      />

      {/* Reply Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Deine Antwort schreiben..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) {
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim() || sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send size={18} />
            <span>Senden</span>
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">⌘ + Enter zum Senden</p>
      </div>
    </div>
  );
}
