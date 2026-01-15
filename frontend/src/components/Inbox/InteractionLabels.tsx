import { AlertCircle, Globe, Hash, MessageCircle } from 'lucide-react';
import type { InteractionLabels as Labels, Urgency, Language, Topic } from '../../types';

interface InteractionLabelsProps {
  labels: Labels;
  compact?: boolean;
}

const urgencyConfig: Record<Urgency, { label: string; className: string }> = {
  high: { label: 'Dringend', className: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: 'Mittel', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low: { label: 'Niedrig', className: 'bg-green-100 text-green-700 border-green-200' },
};

const languageConfig: Record<Language, { label: string; flag: string }> = {
  de: { label: 'Deutsch', flag: '🇩🇪' },
  en: { label: 'Englisch', flag: '🇬🇧' },
  other: { label: 'Andere', flag: '🌍' },
};

const topicConfig: Record<Topic, { label: string; className: string }> = {
  participation_request: { label: 'Teilnahme-Anfrage', className: 'bg-purple-100 text-purple-700' },
  praise: { label: 'Lob', className: 'bg-green-100 text-green-700' },
  criticism: { label: 'Kritik', className: 'bg-orange-100 text-orange-700' },
  question: { label: 'Frage', className: 'bg-blue-100 text-blue-700' },
  sponsor_inquiry: { label: 'Sponsoring', className: 'bg-indigo-100 text-indigo-700' },
  media_request: { label: 'Medien-Anfrage', className: 'bg-pink-100 text-pink-700' },
  general: { label: 'Allgemein', className: 'bg-gray-100 text-gray-700' },
  spam: { label: 'Spam', className: 'bg-red-100 text-red-700' },
};

export function InteractionLabels({ labels, compact = false }: InteractionLabelsProps) {
  const urgency = urgencyConfig[labels.urgency];
  const language = languageConfig[labels.language];
  const topic = topicConfig[labels.topic];

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${urgency.className}`}
          title={`Dringlichkeit: ${urgency.label}`}
        >
          <AlertCircle size={10} className="mr-0.5" />
          {urgency.label.charAt(0)}
        </span>
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
          title={`Sprache: ${language.label}`}
        >
          {language.flag}
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${topic.className}`}
          title={`Thema: ${topic.label}`}
        >
          {topic.label}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${urgency.className}`}
      >
        <AlertCircle size={12} />
        {urgency.label}
      </span>
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
        <Globe size={12} />
        {language.flag} {language.label}
      </span>
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${topic.className}`}
      >
        <Hash size={12} />
        {topic.label}
      </span>
      {labels.confidence < 0.7 && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
          <MessageCircle size={12} />
          {Math.round(labels.confidence * 100)}% Konfidenz
        </span>
      )}
    </div>
  );
}
