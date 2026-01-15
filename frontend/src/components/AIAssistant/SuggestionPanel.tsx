import { useState } from 'react';
import { Sparkles, Check, Loader2 } from 'lucide-react';
import { ProviderSelector } from './ProviderSelector';
import { useAI } from '../../hooks/useAI';
import type { Interaction } from '../../types';

interface SuggestionPanelProps {
  interaction: Interaction;
  onSelectSuggestion: (suggestion: string) => void;
}

export function SuggestionPanel({ interaction, onSelectSuggestion }: SuggestionPanelProps) {
  const {
    provider,
    setProvider,
    tone,
    setTone,
    suggestions,
    loading,
    error,
    generateSuggestions,
    availableProviders,
  } = useAI();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    setSelectedIndex(null);
    await generateSuggestions(interaction);
  };

  const handleSelect = (suggestion: string, index: number) => {
    setSelectedIndex(index);
    onSelectSuggestion(suggestion);
  };

  return (
    <div className="border-t border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-600" />
          <span className="text-sm font-medium text-gray-700">AI-Assistent</span>
        </div>

        <ProviderSelector
          provider={provider}
          onProviderChange={setProvider}
          tone={tone}
          onToneChange={setTone}
          availableProviders={availableProviders}
        />
      </div>

      {suggestions.length === 0 && !loading && !error && (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-2 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Sparkles size={16} />
          Antwortvorschläge generieren
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center py-4 text-gray-500">
          <Loader2 size={20} className="animate-spin mr-2" />
          <span className="text-sm">Generiere Vorschläge...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={handleGenerate}
            className="text-sm text-red-700 underline mt-1"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSelect(suggestion, index)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedIndex === index
                  ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium text-gray-400 mt-0.5">
                  {index + 1}
                </span>
                <p className="text-sm text-gray-700 flex-1">{suggestion}</p>
                {selectedIndex === index && (
                  <Check size={16} className="text-green-600 flex-shrink-0" />
                )}
              </div>
            </button>
          ))}

          <button
            onClick={handleGenerate}
            className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1 mt-2"
          >
            <Sparkles size={14} />
            Neue Vorschläge generieren
          </button>
        </div>
      )}
    </div>
  );
}
