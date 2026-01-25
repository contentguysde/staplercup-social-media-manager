import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, Eye, EyeOff, CheckCircle, XCircle, Loader2, ExternalLink, ChevronDown, Link2, Unlink } from 'lucide-react';
import { settingsApi, oauthApi, type Settings as SettingsType, type OpenAIModel, type OAuthStatus } from '../../services/api';
import { UserManagement } from './UserManagement';

export function Settings() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [_settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [testingAnthropic, setTestingAnthropic] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [openaiResult, setOpenaiResult] = useState<{ connected: boolean; models?: number; error?: string } | null>(null);
  const [anthropicResult, setAnthropicResult] = useState<{ connected: boolean; model?: string; error?: string } | null>(null);
  const [openaiModels, setOpenaiModels] = useState<OpenAIModel[]>([]);
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);

  // Form state for AI settings only
  const [formData, setFormData] = useState({
    ai: {
      anthropicApiKey: '',
      openaiApiKey: '',
      openaiModel: 'gpt-4-turbo-preview',
    },
  });

  // Show/hide password fields
  const [showFields, setShowFields] = useState({
    anthropicApiKey: false,
    openaiApiKey: false,
  });

  useEffect(() => {
    loadSettings();
    loadOpenAIModels();
    loadOAuthStatus();

    // Handle OAuth callback params
    const oauthSuccess = searchParams.get('oauth_success');
    const oauthError = searchParams.get('oauth_error');
    const username = searchParams.get('username');

    if (oauthSuccess === 'true') {
      setMessage({
        type: 'success',
        text: username
          ? t('settings.instagram.connectedAsSuccess', { username })
          : t('settings.instagram.connectedSuccess'),
      });
      // Clear the URL params
      setSearchParams({});
    } else if (oauthError) {
      setMessage({
        type: 'error',
        text: t('settings.instagram.connectionFailed', { error: oauthError }),
      });
      // Clear the URL params
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const loadOAuthStatus = async () => {
    try {
      const status = await oauthApi.getStatus();
      setOauthStatus(status);
    } catch (error) {
      console.error('Failed to load OAuth status:', error);
      setOauthStatus(null);
    }
  };

  const handleConnectInstagram = () => {
    // Redirect to OAuth authorize endpoint
    window.location.href = oauthApi.getAuthorizeUrl();
  };

  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnectInstagram = async () => {
    if (!confirm(t('settings.instagram.disconnectConfirm'))) {
      return;
    }

    try {
      setDisconnecting(true);
      await oauthApi.disconnect();
      setMessage({ type: 'success', text: t('settings.instagram.disconnectSuccess') });
      setOauthStatus({ connected: false, source: null });
      await loadOAuthStatus();
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.instagram.disconnectFailed') });
    } finally {
      setDisconnecting(false);
    }
  };

  const loadOpenAIModels = async () => {
    try {
      const models = await settingsApi.getOpenAIModels();
      setOpenaiModels(models);
    } catch (error) {
      console.error('Failed to load OpenAI models:', error);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Load full (unmasked) settings to populate form fields
      const data = await settingsApi.get(true);
      setSettings(data);
      // Pre-fill form with current values (AI settings only)
      setFormData({
        ai: {
          anthropicApiKey: data.ai.anthropicApiKey || '',
          openaiApiKey: data.ai.openaiApiKey || '',
          openaiModel: data.ai.openaiModel || 'gpt-4-turbo-preview',
        },
      });
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.loadError') });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      // Only send non-empty AI values
      const dataToSave: Partial<SettingsType> = {};

      if (formData.ai.anthropicApiKey || formData.ai.openaiApiKey || formData.ai.openaiModel) {
        dataToSave.ai = {} as SettingsType['ai'];
        if (formData.ai.anthropicApiKey) dataToSave.ai.anthropicApiKey = formData.ai.anthropicApiKey;
        if (formData.ai.openaiApiKey) dataToSave.ai.openaiApiKey = formData.ai.openaiApiKey;
        if (formData.ai.openaiModel) dataToSave.ai.openaiModel = formData.ai.openaiModel;
      }

      const result = await settingsApi.save(dataToSave);

      if (result.updated) {
        setMessage({ type: 'success', text: result.message || t('settings.savedSuccess') });
        // Reload settings to reflect saved values
        await loadSettings();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : t('settings.saveError') });
    } finally {
      setSaving(false);
    }
  };

  const handleTestOpenAI = async () => {
    try {
      setTestingOpenAI(true);
      setOpenaiResult(null);
      const result = await settingsApi.testOpenAI();
      setOpenaiResult(result);
    } catch (error) {
      setOpenaiResult({ connected: false, error: t('settings.ai.connectionFailed') });
    } finally {
      setTestingOpenAI(false);
    }
  };

  const handleTestAnthropic = async () => {
    try {
      setTestingAnthropic(true);
      setAnthropicResult(null);
      const result = await settingsApi.testAnthropic();
      setAnthropicResult(result);
    } catch (error) {
      setAnthropicResult({ connected: false, error: t('settings.ai.connectionFailed') });
    } finally {
      setTestingAnthropic(false);
    }
  };

  const toggleShowField = (field: keyof typeof showFields) => {
    setShowFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('settings.title')}</h2>
        <p className="text-gray-500">{t('settings.subtitle')}</p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Instagram/Meta Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">📸</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{t('settings.instagram.title')}</h3>
            <p className="text-sm text-gray-500">{t('settings.instagram.subtitle')}</p>
          </div>
        </div>

        {/* OAuth Connection Status */}
        <div className="mb-6 p-4 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {oauthStatus?.connected ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle size={20} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {oauthStatus.username
                        ? t('settings.instagram.connectedAs', { username: oauthStatus.username })
                        : t('settings.instagram.connected')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {oauthStatus.source === 'oauth' ? (
                        oauthStatus.daysUntilExpiry !== undefined ? (
                          <span className={oauthStatus.daysUntilExpiry <= 7 ? 'text-amber-600' : ''}>
                            {t('settings.instagram.tokenValidFor', { days: oauthStatus.daysUntilExpiry })}
                          </span>
                        ) : (
                          t('settings.instagram.oauthConnected')
                        )
                      ) : (
                        t('settings.instagram.envConnected')
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Unlink size={20} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{t('settings.instagram.notConnected')}</p>
                    <p className="text-sm text-gray-500">{t('settings.instagram.connectPrompt')}</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {oauthStatus?.connected && oauthStatus.source === 'oauth' && (
                <button
                  onClick={handleDisconnectInstagram}
                  disabled={disconnecting}
                  className="px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  {disconnecting ? <Loader2 size={18} className="animate-spin" /> : <Unlink size={18} />}
                  {t('settings.instagram.disconnect')}
                </button>
              )}
              <button
                onClick={handleConnectInstagram}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${
                  oauthStatus?.connected
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
                }`}
              >
                <Link2 size={18} />
                {oauthStatus?.connected ? t('settings.instagram.reconnect') : t('settings.instagram.connect')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Services Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🤖</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{t('settings.ai.title')}</h3>
            <p className="text-sm text-gray-500">{t('settings.ai.subtitle')}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.ai.anthropicKey')}
            </label>
            <div className="relative">
              <input
                type={showFields.anthropicApiKey ? 'text' : 'password'}
                value={formData.ai.anthropicApiKey}
                onChange={(e) => setFormData((prev) => ({ ...prev, ai: { ...prev.ai, anthropicApiKey: e.target.value } }))}
                placeholder="sk-ant-..."
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => toggleShowField('anthropicApiKey')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showFields.anthropicApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.ai.openaiKey')}
            </label>
            <div className="relative">
              <input
                type={showFields.openaiApiKey ? 'text' : 'password'}
                value={formData.ai.openaiApiKey}
                onChange={(e) => setFormData((prev) => ({ ...prev, ai: { ...prev.ai, openaiApiKey: e.target.value } }))}
                placeholder="sk-..."
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => toggleShowField('openaiApiKey')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showFields.openaiApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.ai.openaiModel')}
            </label>
            <div className="relative">
              <select
                value={formData.ai.openaiModel}
                onChange={(e) => setFormData((prev) => ({ ...prev, ai: { ...prev.ai, openaiModel: e.target.value } }))}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                {openaiModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t('settings.ai.modelHint')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <button
              onClick={handleTestAnthropic}
              disabled={testingAnthropic}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {testingAnthropic ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {t('settings.ai.testClaude')}
            </button>

            {anthropicResult && (
              <div className={`flex items-center gap-2 ${anthropicResult.connected ? 'text-green-600' : 'text-red-600'}`}>
                {anthropicResult.connected ? (
                  <>
                    <CheckCircle size={16} />
                    <span>{t('settings.ai.connected')} ({anthropicResult.model})</span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    <span>{anthropicResult.error || t('settings.ai.connectionFailed')}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={handleTestOpenAI}
              disabled={testingOpenAI}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {testingOpenAI ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {t('settings.ai.testOpenai')}
            </button>

            {openaiResult && (
              <div className={`flex items-center gap-2 ${openaiResult.connected ? 'text-green-600' : 'text-red-600'}`}>
                {openaiResult.connected ? (
                  <>
                    <CheckCircle size={16} />
                    <span>{t('settings.ai.connectedModels', { count: openaiResult.models })}</span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    <span>{openaiResult.error || t('settings.ai.connectionFailed')}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100 flex gap-4">
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <ExternalLink size={14} />
              Anthropic Console
            </a>
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <ExternalLink size={14} />
              OpenAI Platform
            </a>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 font-medium"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          {saving ? t('settings.saving') : t('settings.saveSettings')}
        </button>
      </div>

      {/* User Management Section */}
      <div className="mt-6">
        <UserManagement />
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>{t('settings.note')}:</strong> {t('settings.noteText')}
        </p>
      </div>
    </div>
  );
}
