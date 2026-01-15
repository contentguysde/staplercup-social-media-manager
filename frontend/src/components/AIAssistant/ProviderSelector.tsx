import type { AIProvider, Tone } from '../../types';

interface ProviderSelectorProps {
  provider: AIProvider;
  onProviderChange: (provider: AIProvider) => void;
  tone: Tone;
  onToneChange: (tone: Tone) => void;
  availableProviders: { claude: boolean; openai: boolean };
}

export function ProviderSelector({
  provider,
  onProviderChange,
  tone,
  onToneChange,
  availableProviders,
}: ProviderSelectorProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">AI:</label>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => onProviderChange('claude')}
            disabled={!availableProviders.claude}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              provider === 'claude'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            } ${!availableProviders.claude ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Claude
          </button>
          <button
            onClick={() => onProviderChange('openai')}
            disabled={!availableProviders.openai}
            className={`px-3 py-1 text-xs font-medium transition-colors border-l border-gray-200 ${
              provider === 'openai'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            } ${!availableProviders.openai ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            GPT-4
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Ton:</label>
        <select
          value={tone}
          onChange={(e) => onToneChange(e.target.value as Tone)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="professional">Professionell</option>
          <option value="friendly">Freundlich</option>
          <option value="casual">Locker</option>
        </select>
      </div>
    </div>
  );
}
