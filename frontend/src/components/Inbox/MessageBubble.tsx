interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isOwn: boolean;
  username?: string;
  userProfileUrl?: string;
}

export function MessageBubble({ content, timestamp, isOwn, username, userProfileUrl }: MessageBubbleProps) {
  const formattedTime = new Date(timestamp).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isOwn
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        }`}
      >
        {!isOwn && username && (
          userProfileUrl ? (
            <a
              href={userProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-blue-600 hover:underline mb-1 block"
            >
              @{username}
            </a>
          ) : (
            <p className="text-xs font-medium text-gray-500 mb-1">@{username}</p>
          )
        )}
        <p className="text-sm whitespace-pre-line">{content}</p>
        <p
          className={`text-xs mt-1 ${
            isOwn ? 'text-blue-200' : 'text-gray-400'
          }`}
        >
          {formattedTime}
        </p>
      </div>
    </div>
  );
}
