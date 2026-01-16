import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, CheckCircle, XCircle, Loader2, ExternalLink, ChevronDown, RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import { settingsApi, type Settings as SettingsType, type OpenAIModel, type TokenInfo } from '../../services/api';
import { UserManagement } from './UserManagement';

export function Settings() {
  const [_settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [testingAnthropic, setTestingAnthropic] = useState(false);
  const [refreshingToken, setRefreshingToken] = useState(false);
  const [exchangingToken, setExchangingToken] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ connected: boolean; username?: string; error?: string } | null>(null);
  const [openaiResult, setOpenaiResult] = useState<{ connected: boolean; models?: number; error?: string } | null>(null);
  const [anthropicResult, setAnthropicResult] = useState<{ connected: boolean; model?: string; error?: string } | null>(null);
  const [openaiModels, setOpenaiModels] = useState<OpenAIModel[]>([]);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

  // Form state for new values
  const [formData, setFormData] = useState({
    meta: {
      appId: '',
      appSecret: '',
      accessToken: '',
      instagramAccountId: '',
    },
    ai: {
      anthropicApiKey: '',
      openaiApiKey: '',
      openaiModel: 'gpt-4-turbo-preview',
    },
  });

  // Show/hide password fields
  const [showFields, setShowFields] = useState({
    appSecret: false,
    accessToken: false,
    anthropicApiKey: false,
    openaiApiKey: false,
  });

  useEffect(() => {
    loadSettings();
    loadOpenAIModels();
    loadTokenInfo();
  }, []);

  const loadOpenAIModels = async () => {
    try {
      const models = await settingsApi.getOpenAIModels();
      setOpenaiModels(models);
    } catch (error) {
      console.error('Failed to load OpenAI models:', error);
    }
  };

  const loadTokenInfo = async () => {
    try {
      const info = await settingsApi.getTokenInfo();
      setTokenInfo(info);
    } catch (error) {
      console.error('Failed to load token info:', error);
      setTokenInfo(null);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Load full (unmasked) settings to populate form fields
      const data = await settingsApi.get(true);
      setSettings(data);
      // Pre-fill form with current values
      setFormData({
        meta: {
          appId: data.meta.appId || '',
          appSecret: data.meta.appSecret || '',
          accessToken: data.meta.accessToken || '',
          instagramAccountId: data.meta.instagramAccountId || '',
        },
        ai: {
          anthropicApiKey: data.ai.anthropicApiKey || '',
          openaiApiKey: data.ai.openaiApiKey || '',
          openaiModel: data.ai.openaiModel || 'gpt-4-turbo-preview',
        },
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Fehler beim Laden der Einstellungen' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      // Only send non-empty values
      const dataToSave: Partial<SettingsType> = {};

      if (formData.meta.appId || formData.meta.appSecret || formData.meta.accessToken || formData.meta.instagramAccountId) {
        dataToSave.meta = {} as SettingsType['meta'];
        if (formData.meta.appId) dataToSave.meta.appId = formData.meta.appId;
        if (formData.meta.appSecret) dataToSave.meta.appSecret = formData.meta.appSecret;
        if (formData.meta.accessToken) dataToSave.meta.accessToken = formData.meta.accessToken;
        if (formData.meta.instagramAccountId) dataToSave.meta.instagramAccountId = formData.meta.instagramAccountId;
      }

      if (formData.ai.anthropicApiKey || formData.ai.openaiApiKey || formData.ai.openaiModel) {
        dataToSave.ai = {} as SettingsType['ai'];
        if (formData.ai.anthropicApiKey) dataToSave.ai.anthropicApiKey = formData.ai.anthropicApiKey;
        if (formData.ai.openaiApiKey) dataToSave.ai.openaiApiKey = formData.ai.openaiApiKey;
        if (formData.ai.openaiModel) dataToSave.ai.openaiModel = formData.ai.openaiModel;
      }

      const result = await settingsApi.save(dataToSave);

      if (result.updated) {
        setMessage({ type: 'success', text: result.message || 'Einstellungen gespeichert! Server neu starten um Änderungen anzuwenden.' });
        // Reload settings to reflect saved values
        await loadSettings();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestInstagram = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const result = await settingsApi.testInstagram();
      setTestResult(result);
    } catch (error) {
      setTestResult({ connected: false, error: 'Verbindungstest fehlgeschlagen' });
    } finally {
      setTesting(false);
    }
  };

  const handleTestOpenAI = async () => {
    try {
      setTestingOpenAI(true);
      setOpenaiResult(null);
      const result = await settingsApi.testOpenAI();
      setOpenaiResult(result);
    } catch (error) {
      setOpenaiResult({ connected: false, error: 'Verbindungstest fehlgeschlagen' });
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
      setAnthropicResult({ connected: false, error: 'Verbindungstest fehlgeschlagen' });
    } finally {
      setTestingAnthropic(false);
    }
  };

  const toggleShowField = (field: keyof typeof showFields) => {
    setShowFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleExchangeToken = async () => {
    try {
      setExchangingToken(true);
      setMessage(null);
      const result = await settingsApi.exchangeToken();
      setMessage({ type: 'success', text: result.message });
      await loadTokenInfo();
      await loadSettings();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Token-Austausch fehlgeschlagen' });
    } finally {
      setExchangingToken(false);
    }
  };

  const handleRefreshToken = async () => {
    try {
      setRefreshingToken(true);
      setMessage(null);
      const result = await settingsApi.refreshToken();
      setMessage({ type: 'success', text: result.message });
      await loadTokenInfo();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Token-Erneuerung fehlgeschlagen' });
    } finally {
      setRefreshingToken(false);
    }
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
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Einstellungen</h2>
        <p className="text-gray-500">Konfiguriere deine API-Zugangsdaten für Instagram und AI-Services</p>
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
            <h3 className="text-lg font-semibold text-gray-800">Instagram / Meta API</h3>
            <p className="text-sm text-gray-500">Verbinde deinen Instagram Business Account</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta App ID
            </label>
            <input
              type="text"
              value={formData.meta.appId}
              onChange={(e) => setFormData((prev) => ({ ...prev, meta: { ...prev.meta, appId: e.target.value } }))}
              placeholder="App ID eingeben..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta App Secret
            </label>
            <div className="relative">
              <input
                type={showFields.appSecret ? 'text' : 'password'}
                value={formData.meta.appSecret}
                onChange={(e) => setFormData((prev) => ({ ...prev, meta: { ...prev.meta, appSecret: e.target.value } }))}
                placeholder="App Secret eingeben..."
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => toggleShowField('appSecret')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showFields.appSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Access Token
            </label>
            <div className="relative">
              <input
                type={showFields.accessToken ? 'text' : 'password'}
                value={formData.meta.accessToken}
                onChange={(e) => setFormData((prev) => ({ ...prev, meta: { ...prev.meta, accessToken: e.target.value } }))}
                placeholder="Access Token eingeben..."
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => toggleShowField('accessToken')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showFields.accessToken ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instagram Account ID
            </label>
            <input
              type="text"
              value={formData.meta.instagramAccountId}
              onChange={(e) => setFormData((prev) => ({ ...prev, meta: { ...prev.meta, instagramAccountId: e.target.value } }))}
              placeholder="Account ID eingeben..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={handleTestInstagram}
              disabled={testing}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {testing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Verbindung testen
            </button>

            {testResult && (
              <div className={`flex items-center gap-2 ${testResult.connected ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.connected ? (
                  <>
                    <CheckCircle size={16} />
                    <span>Verbunden als @{testResult.username}</span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    <span>{testResult.error || 'Verbindung fehlgeschlagen'}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Token Info & Management */}
          {tokenInfo && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Token Status</span>
              </div>

              <div className={`p-3 rounded-lg mb-3 ${
                !tokenInfo.isValid
                  ? 'bg-red-50 border border-red-200'
                  : tokenInfo.daysUntilExpiry && tokenInfo.daysUntilExpiry <= 7
                  ? 'bg-amber-50 border border-amber-200'
                  : 'bg-green-50 border border-green-200'
              }`}>
                <div className="flex items-start gap-2">
                  {!tokenInfo.isValid ? (
                    <XCircle size={18} className="text-red-500 mt-0.5" />
                  ) : tokenInfo.daysUntilExpiry && tokenInfo.daysUntilExpiry <= 7 ? (
                    <AlertTriangle size={18} className="text-amber-500 mt-0.5" />
                  ) : (
                    <CheckCircle size={18} className="text-green-500 mt-0.5" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${
                      !tokenInfo.isValid
                        ? 'text-red-700'
                        : tokenInfo.daysUntilExpiry && tokenInfo.daysUntilExpiry <= 7
                        ? 'text-amber-700'
                        : 'text-green-700'
                    }`}>
                      {!tokenInfo.isValid
                        ? 'Token ungültig oder abgelaufen'
                        : tokenInfo.daysUntilExpiry && tokenInfo.daysUntilExpiry <= 7
                        ? `Token läuft in ${tokenInfo.daysUntilExpiry} Tagen ab!`
                        : `Token gültig (noch ${tokenInfo.daysUntilExpiry} Tage)`}
                    </p>
                    {tokenInfo.expiresAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Ablaufdatum: {new Date(tokenInfo.expiresAt).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleExchangeToken}
                  disabled={exchangingToken || refreshingToken}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
                  title="Wandelt einen kurzlebigen Token in einen Long-Lived Token (60 Tage) um"
                >
                  {exchangingToken ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  In Long-Lived Token umwandeln
                </button>
                <button
                  onClick={handleRefreshToken}
                  disabled={refreshingToken || exchangingToken || !tokenInfo.isValid}
                  className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
                  title="Erneuert den bestehenden Token für weitere 60 Tage"
                >
                  {refreshingToken ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Token erneuern (60 Tage)
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Tipp: Erneuere den Token regelmäßig bevor er abläuft, um eine Unterbrechung zu vermeiden.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100">
            <a
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <ExternalLink size={14} />
              Meta Developer Portal öffnen
            </a>
          </div>
        </div>
      </div>

      {/* AI Services Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🤖</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">AI Services</h3>
            <p className="text-sm text-gray-500">API-Keys für Claude und OpenAI</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anthropic API Key (Claude)
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
              OpenAI API Key
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
              OpenAI Modell
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
              Wähle das Modell für AI-Antwortvorschläge
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <button
              onClick={handleTestAnthropic}
              disabled={testingAnthropic}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {testingAnthropic ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Claude testen
            </button>

            {anthropicResult && (
              <div className={`flex items-center gap-2 ${anthropicResult.connected ? 'text-green-600' : 'text-red-600'}`}>
                {anthropicResult.connected ? (
                  <>
                    <CheckCircle size={16} />
                    <span>Verbunden ({anthropicResult.model})</span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    <span>{anthropicResult.error || 'Verbindung fehlgeschlagen'}</span>
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
              OpenAI testen
            </button>

            {openaiResult && (
              <div className={`flex items-center gap-2 ${openaiResult.connected ? 'text-green-600' : 'text-red-600'}`}>
                {openaiResult.connected ? (
                  <>
                    <CheckCircle size={16} />
                    <span>Verbunden ({openaiResult.models} Modelle verfügbar)</span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    <span>{openaiResult.error || 'Verbindung fehlgeschlagen'}</span>
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
          Einstellungen speichern
        </button>
      </div>

      {/* User Management Section */}
      <div className="mt-6">
        <UserManagement />
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Hinweis:</strong> Nach dem Speichern muss der Backend-Server neu gestartet werden,
          damit die Änderungen wirksam werden. Die Credentials werden in der Datei <code className="bg-yellow-100 px-1 rounded">.env</code> gespeichert.
        </p>
      </div>
    </div>
  );
}
