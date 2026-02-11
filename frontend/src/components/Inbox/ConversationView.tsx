import { useState, useRef, useEffect } from 'react';
import { Send, ExternalLink, Heart, User, UserPlus, UserMinus, ChevronDown, Loader2, Film, Image, MessageCircle, Globe } from 'lucide-react';
import { SuggestionPanel } from '../AIAssistant/SuggestionPanel';
import { instagramApi, tiktokApi, translateApi, type DMMessage, type TikTokComment } from '../../services/api';
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
  const [sendSuccess, setSendSuccess] = useState(false);
  const [localReplies, setLocalReplies] = useState<Array<{
    id: string;
    content: string;
    timestamp: string;
    isOwn: boolean;
    germanText?: string;
  }>>([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);

  // Translation state for comments
  const [showTranslation, setShowTranslation] = useState(false);
  const [translatedComment, setTranslatedComment] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  // Pending translation info (from SuggestionPanel workflow)
  const [pendingTranslation, setPendingTranslation] = useState<{
    germanText: string;
    translatedText: string;
    targetLanguage: string;
  } | null>(null);

  // Toggle state for reply translations
  const [showReplyTranslation, setShowReplyTranslation] = useState<Record<string, boolean>>({});
  const assignDropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // DM conversation state
  const [dmMessages, setDmMessages] = useState<DMMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // Check if this is a DM with a conversation ID
  const isDM = interaction.type === 'dm';
  const conversationId = (interaction as any).conversationId as string | undefined;
  const isTikTok = interaction.platform === 'tiktok';

  // TikTok comments state
  const [tiktokComments, setTiktokComments] = useState<TikTokComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);

  // Reset local state when interaction changes
  useEffect(() => {
    setLocalReplies([]);
    setSendSuccess(false);
    setShowTranslation(false);
    setTranslatedComment(null);
    setPendingTranslation(null);
    setShowReplyTranslation({});
  }, [interaction.id]);

  // Handle suggestion select with optional translation info
  const handleSuggestionSelect = (suggestion: string, translationInfo?: {
    germanText: string;
    translatedText: string;
    targetLanguage: string;
  }) => {
    setReplyText(suggestion);
    if (translationInfo) {
      setPendingTranslation(translationInfo);
    } else {
      setPendingTranslation(null);
    }
  };

  // Handle translation toggle
  const handleTranslateComment = async () => {
    if (showTranslation) {
      // Toggle off - show original
      setShowTranslation(false);
      return;
    }

    // If we already have the translation, just show it
    if (translatedComment) {
      setShowTranslation(true);
      return;
    }

    // Translate the comment to German
    try {
      setTranslating(true);
      const result = await translateApi.translate(interaction.content, 'de');
      setTranslatedComment(result.translatedText);
      setShowTranslation(true);
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setTranslating(false);
    }
  };

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

  // Load TikTok comments when viewing a TikTok post
  useEffect(() => {
    if (isTikTok && interaction.type === 'post' && interaction.context?.mediaId) {
      loadTikTokComments();
    } else if (isTikTok) {
      setTiktokComments([]);
      setReplyToCommentId(null);
    }
  }, [interaction.id]);

  const loadTikTokComments = async () => {
    const videoId = interaction.context?.mediaId;
    if (!videoId) return;

    try {
      setLoadingComments(true);
      const result = await tiktokApi.getComments(videoId);
      setTiktokComments(result.comments || []);
    } catch (err) {
      console.error('Failed to load TikTok comments:', err);
      setTiktokComments([]);
    } finally {
      setLoadingComments(false);
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

    const messageToSend = replyText.trim();

    try {
      setSending(true);
      setSendSuccess(false);

      if (isTikTok && replyToCommentId) {
        // TikTok: reply directly to the selected comment via Business API
        await tiktokApi.replyToComment(
          replyToCommentId,
          messageToSend,
          interaction.context?.mediaId
        );
        setReplyText('');
        setReplyToCommentId(null);
        // Reload comments to show the new reply
        await loadTikTokComments();
        setSendSuccess(true);
      } else {
        await onSendReply(messageToSend);

        // Store translation in DB if this was a translated reply
        if (pendingTranslation) {
          try {
            await translateApi.store({
              originalText: pendingTranslation.germanText,
              translatedText: pendingTranslation.translatedText,
              sourceLanguage: 'de',
              targetLanguage: pendingTranslation.targetLanguage,
              contextType: 'reply',
              contextId: interaction.id,
              platform: interaction.platform,
            });
          } catch (err) {
            console.error('Failed to store translation:', err);
          }
        }

        // Add the reply to local state so it appears in the thread immediately
        const newReply = {
          id: `local_${Date.now()}`,
          content: messageToSend,
          timestamp: new Date().toISOString(),
          isOwn: true,
          germanText: pendingTranslation?.germanText,
        };
        setLocalReplies(prev => [...prev, newReply]);
        setReplyText('');
        setPendingTranslation(null);
        setSendSuccess(true);
      }

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to send reply:', error);
      // Don't clear the text on error so user can retry
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

  // Platform-specific profile URL
  const userProfileUrl = interaction.platform === 'facebook'
    ? `https://facebook.com/${interaction.from.id}`
    : interaction.platform === 'tiktok'
    ? `https://www.tiktok.com/@${interaction.from.username}`
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
                {interaction.type === 'post' ? 'Video' : interaction.type === 'comment' ? 'Kommentar' : interaction.type === 'dm' ? 'Direktnachricht' : 'Erwähnung'}
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
            {/* Comment Section - ABOVE the post (hidden for TikTok posts where content = caption) */}
            {interaction.type !== 'post' && (
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

                    {/* Translation toggle for non-DE/EN comments */}
                    {interaction.labels?.language === 'other' && (
                      <div className="mt-3">
                        <button
                          onClick={handleTranslateComment}
                          disabled={translating}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
                        >
                          {translating ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Übersetze...
                            </>
                          ) : (
                            <>
                              <Globe size={12} />
                              {showTranslation ? 'Original anzeigen' : 'Auf Deutsch anzeigen'}
                            </>
                          )}
                        </button>

                        {/* Translated text */}
                        {showTranslation && translatedComment && (
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                              <Globe size={10} />
                              Deutsche Übersetzung
                            </p>
                            <p className="text-gray-800 whitespace-pre-line">{translatedComment}</p>
                          </div>
                        )}
                      </div>
                    )}
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

              {/* Replies - displayed directly below the comment */}
              {[...(interaction.replies || []), ...localReplies].length > 0 && (
                <div className="border-t border-gray-100">
                  {[...(interaction.replies || []), ...localReplies].map((reply: any) => (
                    <div key={reply.id} className={`p-4 flex items-start gap-3 ${reply.isOwn ? 'bg-blue-50/50' : 'bg-gray-50/50'}`}>
                      {/* Avatar - different for own replies vs others */}
                      {reply.isOwn ? (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-0.5">
                          <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-600">SC</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                          <User size={16} className="text-gray-600" />
                        </div>
                      )}
                      {/* Reply content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 text-sm">
                            {reply.isOwn ? 'staplercup_official' : `@${reply.from?.username || 'Unbekannt'}`}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(reply.timestamp).toLocaleString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${reply.isOwn ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                            Antwort
                          </span>
                        </div>
                        {/* Reply text - show translation toggle for translated replies */}
                        {showReplyTranslation[reply.id] && reply.germanText ? (
                          <div className="space-y-2">
                            <div className="p-2 bg-gray-100 rounded-lg border border-gray-200">
                              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                <Globe size={10} />
                                Deutsche Version
                              </p>
                              <p className="text-gray-800 text-sm whitespace-pre-line">{reply.germanText}</p>
                            </div>
                            <p className="text-gray-600 text-sm whitespace-pre-line">{reply.content}</p>
                          </div>
                        ) : (
                          <p className="text-gray-800 text-sm whitespace-pre-line">{reply.content}</p>
                        )}
                        {/* Translation toggle for own translated replies */}
                        {reply.isOwn && reply.germanText && (
                          <button
                            onClick={() => setShowReplyTranslation(prev => ({
                              ...prev,
                              [reply.id]: !prev[reply.id]
                            }))}
                            className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                          >
                            <Globe size={10} />
                            {showReplyTranslation[reply.id] ? 'Übersetzung ausblenden' : 'Deutsche Version anzeigen'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Post Preview (Video/Image card) */}
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

                {/* Post Caption — for TikTok posts, use interaction.content as caption */}
                {(interaction.context.mediaCaption || interaction.type === 'post') && (
                  <div className="p-3">
                    <p className="text-sm text-gray-800 whitespace-pre-line">
                      {formatCaption(interaction.context.mediaCaption || interaction.content, interaction.platform)}
                    </p>
                  </div>
                )}

                {/* TikTok Video Stats */}
                {isTikTok && interaction.context?.stats && (
                  <div className="px-3 pb-3 flex items-center gap-4 text-sm text-gray-500">
                    <span title="Views">👁 {(interaction.context.stats.views ?? 0).toLocaleString()}</span>
                    <span title="Likes">❤️ {(interaction.context.stats.likes ?? 0).toLocaleString()}</span>
                    <span title="Kommentare">💬 {(interaction.context.stats.comments ?? 0).toLocaleString()}</span>
                    <span title="Shares">🔗 {(interaction.context.stats.shares ?? 0).toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            {/* TikTok Comments Section */}
            {isTikTok && interaction.type === 'post' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle size={16} className="text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-700">Kommentare</h3>
                  </div>
                  <button
                    onClick={loadTikTokComments}
                    className="text-xs text-gray-400 hover:text-gray-600"
                    title="Kommentare aktualisieren"
                  >
                    Aktualisieren
                  </button>
                </div>

                {loadingComments ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Lade Kommentare...</span>
                  </div>
                ) : tiktokComments.length > 0 ? (
                  <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                    {tiktokComments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`p-3 transition-colors ${
                          replyToCommentId === comment.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {comment.profileImage ? (
                            <img src={comment.profileImage} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <User size={14} className="text-gray-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <a
                                href={`https://www.tiktok.com/@${comment.username}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-gray-900 hover:text-blue-600"
                              >
                                @{comment.username}
                              </a>
                              <span className="text-xs text-gray-400">
                                {new Date(comment.createTime * 1000).toLocaleString('de-DE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-gray-800 whitespace-pre-line">{comment.text}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                              {comment.likeCount > 0 && (
                                <span className="text-xs text-gray-400">❤️ {comment.likeCount}</span>
                              )}
                              <button
                                onClick={() =>
                                  setReplyToCommentId(
                                    replyToCommentId === comment.id ? null : comment.id
                                  )
                                }
                                className={`text-xs font-medium transition-colors ${
                                  replyToCommentId === comment.id
                                    ? 'text-blue-600'
                                    : 'text-gray-500 hover:text-blue-600'
                                }`}
                              >
                                Antworten
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Keine Kommentare vorhanden
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* AI Suggestions */}
      {(!isTikTok || replyToCommentId) && (
        <SuggestionPanel
          interaction={interaction}
          onSelectSuggestion={handleSuggestionSelect}
        />
      )}

      {/* Reply Input — TikTok comment reply or fallback */}
      {isTikTok ? (
        <div className="p-4 border-t border-gray-200 bg-white">
          {replyToCommentId ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">
                  Antwort auf @{tiktokComments.find((c) => c.id === replyToCommentId)?.username}
                </span>
                <button
                  onClick={() => setReplyToCommentId(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Antwort schreiben..."
                  disabled={sending}
                  className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
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
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {sendSuccess ? (
                  <span className="text-green-600 font-medium">✓ Nachricht erfolgreich gesendet</span>
                ) : (
                  '⌘ + Enter zum Senden'
                )}
              </p>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {interaction.type === 'post'
                  ? 'Wähle einen Kommentar zum Antworten'
                  : 'Auf TikTok öffnen um zu antworten'}
              </p>
              {interaction.context?.mediaPermalink && (
                <a
                  href={interaction.context.mediaPermalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <ExternalLink size={14} />
                  Auf TikTok öffnen
                </a>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Deine Antwort schreiben..."
              disabled={sending}
              className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
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
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              <span>{sending ? 'Sende...' : 'Senden'}</span>
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {sendSuccess ? (
              <span className="text-green-600 font-medium">✓ Nachricht erfolgreich gesendet</span>
            ) : (
              '⌘ + Enter zum Senden'
            )}
          </p>
        </div>
      )}
    </div>
  );
}
