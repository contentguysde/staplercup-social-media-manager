import { useState, useEffect } from 'react';
import { Sparkles, Check, Loader2, ChevronLeft, Send, Edit3, Globe, MessageSquare } from 'lucide-react';
import { ProviderSelector } from './ProviderSelector';
import { useAI } from '../../hooks/useAI';
import { translateApi } from '../../services/api';
import type { Interaction } from '../../types';

interface TranslationInfo {
  germanText: string;
  translatedText: string;
  targetLanguage: string;
}

interface SuggestionPanelProps {
  interaction: Interaction;
  onSelectSuggestion: (suggestion: string, translationInfo?: TranslationInfo) => void;
}

type WorkflowState =
  | 'idle'
  | 'generating'
  | 'reviewing_suggestions'
  | 'editing_german'
  | 'translating'
  | 'reviewing_translated'
  | 'ready_to_send';

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

  const [workflowState, setWorkflowState] = useState<WorkflowState>('idle');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [germanResponse, setGermanResponse] = useState('');
  const [translatedResponse, setTranslatedResponse] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  // Determine if the comment is in a language that needs translation
  const needsTranslation = interaction.labels?.language === 'other';

  // Reset state when interaction changes
  useEffect(() => {
    setWorkflowState('idle');
    setSelectedIndex(null);
    setGermanResponse('');
    setTranslatedResponse('');
    setTargetLanguage('');
    setCustomPrompt('');
    setShowPromptInput(false);
    setTranslationError(null);
  }, [interaction.id]);

  // Update workflow state based on loading/suggestions/error
  useEffect(() => {
    if (loading) {
      setWorkflowState('generating');
    } else if (suggestions.length > 0) {
      setWorkflowState('reviewing_suggestions');
    } else if (error && workflowState === 'generating') {
      // Reset to idle on error so user can retry
      setWorkflowState('idle');
    }
  }, [loading, suggestions.length, error, workflowState]);

  const handleGenerate = async () => {
    setSelectedIndex(null);
    setGermanResponse('');
    setTranslatedResponse('');
    setTranslationError(null);
    await generateSuggestions(interaction, customPrompt || undefined);
  };

  const handleSelectSuggestion = (suggestion: string, index: number) => {
    setSelectedIndex(index);
    setGermanResponse(suggestion);

    if (needsTranslation) {
      // For non-DE/EN: go to editing/reviewing German response
      setWorkflowState('editing_german');
    } else {
      // For DE/EN: directly use the suggestion
      onSelectSuggestion(suggestion);
    }
  };

  const handleConfirmGerman = async () => {
    if (!germanResponse.trim()) return;

    try {
      setWorkflowState('translating');
      setTranslationError(null);

      // Get the target language from the comment's detected language
      const detectionResult = await translateApi.detect(interaction.content);
      const detectedLanguage = detectionResult.language;
      setTargetLanguage(detectedLanguage);

      // Translate the German response to the target language
      const result = await translateApi.translate(germanResponse, detectedLanguage, 'de');
      setTranslatedResponse(result.translatedText);
      setWorkflowState('reviewing_translated');
    } catch (err) {
      console.error('Translation error:', err);
      setTranslationError(err instanceof Error ? err.message : 'Übersetzung fehlgeschlagen');
      setWorkflowState('editing_german');
    }
  };

  const handleConfirmTranslated = () => {
    // Use the translated response and pass translation info for storage
    onSelectSuggestion(translatedResponse, {
      germanText: germanResponse,
      translatedText: translatedResponse,
      targetLanguage,
    });
    setWorkflowState('ready_to_send');
  };

  const handleBackToGerman = () => {
    setWorkflowState('editing_german');
    setTranslatedResponse('');
  };

  const handleBackToSuggestions = () => {
    setWorkflowState('reviewing_suggestions');
    setGermanResponse('');
    setTranslatedResponse('');
    setSelectedIndex(null);
  };

  const handleReset = () => {
    setWorkflowState('idle');
    setSelectedIndex(null);
    setGermanResponse('');
    setTranslatedResponse('');
    setTargetLanguage('');
    setCustomPrompt('');
    setShowPromptInput(false);
    setTranslationError(null);
  };

  return (
    <div className="border-t border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-600" />
          <span className="text-sm font-medium text-gray-700">AI-Assistent</span>
          {needsTranslation && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              <Globe size={10} />
              Übersetzungs-Workflow
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
          {/* Toggle for prompt mode */}
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
            {needsTranslation
              ? 'Wähle einen Vorschlag (wird dann in die Zielsprache übersetzt):'
              : 'Wähle einen Vorschlag:'}
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

      {/* EDITING GERMAN STATE (only for non-DE/EN) */}
      {workflowState === 'editing_german' && needsTranslation && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBackToSuggestions}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ChevronLeft size={16} />
              Zurück
            </button>
            <span className="text-xs font-medium text-gray-500">Schritt 1 von 2</span>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-gray-600">Deutsche Antwort prüfen & bearbeiten</span>
              <Edit3 size={12} className="text-gray-400" />
            </div>
            <textarea
              value={germanResponse}
              onChange={(e) => setGermanResponse(e.target.value)}
              className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={4}
            />
          </div>

          {translationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
              <p className="text-xs text-red-600">{translationError}</p>
            </div>
          )}

          <button
            onClick={handleConfirmGerman}
            disabled={!germanResponse.trim()}
            className="w-full py-2 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Globe size={16} />
            Bestätigen & Übersetzen
          </button>
        </div>
      )}

      {/* TRANSLATING STATE */}
      {workflowState === 'translating' && (
        <div className="flex items-center justify-center py-4 text-gray-500">
          <Loader2 size={20} className="animate-spin mr-2" />
          <span className="text-sm">Übersetze in Zielsprache...</span>
        </div>
      )}

      {/* REVIEWING TRANSLATED STATE */}
      {workflowState === 'reviewing_translated' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBackToGerman}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ChevronLeft size={16} />
              Zurück
            </button>
            <span className="text-xs font-medium text-gray-500">Schritt 2 von 2</span>
          </div>

          {/* German original (collapsed) */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-500 mb-1">Deutsche Version:</p>
            <p className="text-sm text-gray-600">{germanResponse}</p>
          </div>

          {/* Translated version */}
          <div className="bg-white rounded-lg border border-blue-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={12} className="text-blue-500" />
              <span className="text-xs font-medium text-blue-600">Übersetzte Antwort:</span>
            </div>
            <p className="text-sm text-gray-800">{translatedResponse}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleBackToGerman}
              className="flex-1 py-2 px-4 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Bearbeiten
            </button>
            <button
              onClick={handleConfirmTranslated}
              className="flex-1 py-2 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Send size={16} />
              Übernehmen
            </button>
          </div>
        </div>
      )}

      {/* READY TO SEND STATE */}
      {workflowState === 'ready_to_send' && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Check size={14} className="text-green-600" />
              <span className="text-xs font-medium text-green-700">Antwort übernommen</span>
            </div>
            <p className="text-xs text-green-600">
              Die übersetzte Antwort wurde in das Antwortfeld übernommen.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="w-full py-2 px-4 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Neue Antwort generieren
          </button>
        </div>
      )}
    </div>
  );
}
