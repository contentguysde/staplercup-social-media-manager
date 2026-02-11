import { useState, useEffect } from 'react';
import { Sparkles, Check, Loader2, MessageSquare } from 'lucide-react';
import { ProviderSelector } from './ProviderSelector';
import { useAI } from '../../hooks/useAI';
import type { Interaction } from '../../types';

interface SuggestionPanelProps {
  interaction: Interaction;
  onSelectSuggestion: (suggestion: string) => void;
  onLanguageDetected?: (detectedLanguage: string, needsTranslation: boolean) => void;
}

type WorkflowState = 'idle' | 'generating' | 'reviewing_suggestions';

export function SuggestionPanel({ interaction, onSelectSuggestion, onLanguageDetected }: SuggestionPanelProps) {
  const {
    provider,
    setProvider,
    tone,
    setTone,
    suggestions,
    languageInfo,
    loading,
    error,
    generateSuggestions,
    clearSuggestions,
    availableProviders,
  } = useAI();

  const [workflowState, setWorkflowState] = useState<WorkflowState>('idle');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);

  // Reset state when interaction changes
  useEffect(() => {
    setWorkflowState('idle');
    setSelectedIndex(null);
    setCustomPrompt('');
    setShowPromptInput(false);
    clearSuggestions(); // Clear AI suggestions from previous interaction
  }, [interaction.id, clearSuggestions]);

  // Update workflow state based on loading/suggestions/error
  useEffect(() => {
    if (loading) {
      setWorkflowState('generating');
    } else if (suggestions.length > 0) {
      setWorkflowState('reviewing_suggestions');
    } else if (error && workflowState === 'generating') {
      setWorkflowState('idle');
    }
  }, [loading, suggestions.length, error, workflowState]);

  // Notify parent about language detection
  useEffect(() => {
    if (languageInfo && onLanguageDetected) {
      onLanguageDetected(languageInfo.detectedLanguage, languageInfo.needsTranslation);
    }
  }, [languageInfo, onLanguageDetected]);

  const handleGenerate = async () => {
    setSelectedIndex(null);
    await generateSuggestions(interaction, customPrompt || undefined);
  };

  const handleSelectSuggestion = (suggestion: string, index: number) => {
    setSelectedIndex(index);
    onSelectSuggestion(suggestion);
  };

  return (
    <div className="border-t border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-600" />
          <span className="text-sm font-medium text-gray-700">AI-Assistent</span>
          {languageInfo && (
            <span className="text-xs text-gray-500">
              ({languageInfo.responseLanguage === 'en' ? 'EN' : 'DE'} Vorschläge)
            </span>
          )}
        </div>

        <ProviderSelector
          provider={provider}
          onProviderChange={setProvider}
          tone={tone}
          onToneChange={setTone}
          availableProviders={availableProviders}
        />
      </div>

      {/* IDLE STATE - Initial buttons */}
      {workflowState === 'idle' && !error && (
        <div className="space-y-3">
          {!showPromptInput ? (
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                className="flex-1 py-2 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Sparkles size={16} />
                Antwortvorschläge generieren
              </button>
              <button
                onClick={() => setShowPromptInput(true)}
                className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
                title="Mit eigenen Anweisungen"
              >
                <MessageSquare size={16} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">Eigene Anweisungen (optional)</label>
                <button
                  onClick={() => {
                    setShowPromptInput(false);
                    setCustomPrompt('');
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Abbrechen
                </button>
              </div>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="z.B. 'Erwähne unsere neue Produktlinie' oder 'Antworte besonders freundlich'"
                className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={2}
              />
              <button
                onClick={handleGenerate}
                className="w-full py-2 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Sparkles size={16} />
                Mit Anweisungen generieren
              </button>
            </div>
          )}
        </div>
      )}

      {/* GENERATING STATE */}
      {workflowState === 'generating' && (
        <div className="flex items-center justify-center py-4 text-gray-500">
          <Loader2 size={20} className="animate-spin mr-2" />
          <span className="text-sm">Generiere Vorschläge...</span>
        </div>
      )}

      {/* ERROR STATE */}
      {error && workflowState !== 'generating' && (
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

      {/* REVIEWING SUGGESTIONS STATE */}
      {workflowState === 'reviewing_suggestions' && suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 mb-2">
            Wähle einen Vorschlag:
          </p>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSelectSuggestion(suggestion, index)}
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
