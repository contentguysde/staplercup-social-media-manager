import { useState, useEffect, type FormEvent } from 'react';
import { LogIn, AlertCircle, Loader2, UserPlus, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/authApi';

type View = 'login' | 'register' | 'register-success';

export function LoginPage() {
  const { login } = useAuth();
  const [view, setView] = useState<View>('login');
  const [registrationEnabled, setRegistrationEnabled] = useState(false);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Register form state
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    // Check if registration is enabled
    authApi.isRegistrationEnabled().then(setRegistrationEnabled).catch(() => setRegistrationEnabled(false));
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    // Validate passwords match
    if (registerPassword !== registerPasswordConfirm) {
      setRegisterError('Die Passwörter stimmen nicht überein');
      return;
    }

    // Validate password length
    if (registerPassword.length < 8) {
      setRegisterError('Das Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    setIsRegistering(true);

    try {
      await authApi.registerPublic(registerEmail, registerPassword, registerName);
      setView('register-success');
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen');
    } finally {
      setIsRegistering(false);
    }
  };

  const switchToRegister = () => {
    setView('register');
    setError(null);
    setRegisterError(null);
  };

  const switchToLogin = () => {
    setView('login');
    setError(null);
    setRegisterError(null);
    setRegisterName('');
    setRegisterEmail('');
    setRegisterPassword('');
    setRegisterPasswordConfirm('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-8 h-8 text-white"
              >
                <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                <line x1="6" x2="6" y1="2" y2="4" />
                <line x1="10" x2="10" y1="2" y2="4" />
                <line x1="14" x2="14" y1="2" y2="4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">StaplerCup Social</h1>
            <p className="text-gray-500 mt-2">
              {view === 'login' && 'Melde dich an, um fortzufahren'}
              {view === 'register' && 'Erstelle ein neues Konto'}
              {view === 'register-success' && 'Registrierung erfolgreich!'}
            </p>
          </div>

          {/* Login Form */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle size={18} />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="name@beispiel.de"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Passwort
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Anmeldung...
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    Anmelden
                  </>
                )}
              </button>

              {registrationEnabled && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={switchToRegister}
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Noch kein Konto? Jetzt registrieren
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Register Form */}
          {view === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5">
              {registerError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle size={18} />
                  <span className="text-sm">{registerError}</span>
                </div>
              )}

              <div>
                <label htmlFor="register-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  id="register-name"
                  type="text"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Max Mustermann"
                />
              </div>

              <div>
                <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail
                </label>
                <input
                  id="register-email"
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="name@beispiel.de"
                />
              </div>

              <div>
                <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Passwort
                </label>
                <input
                  id="register-password"
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Mindestens 8 Zeichen"
                />
              </div>

              <div>
                <label htmlFor="register-password-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                  Passwort bestätigen
                </label>
                <input
                  id="register-password-confirm"
                  type="password"
                  value={registerPasswordConfirm}
                  onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Passwort wiederholen"
                />
              </div>

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isRegistering ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Registrierung...
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Registrieren
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={switchToLogin}
                  className="text-sm text-gray-600 hover:text-gray-700 flex items-center justify-center gap-1 mx-auto"
                >
                  <ArrowLeft size={14} />
                  Zurück zur Anmeldung
                </button>
              </div>
            </form>
          )}

          {/* Registration Success */}
          {view === 'register-success' && (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                <CheckCircle size={32} className="text-green-600" />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Fast geschafft!
                </h3>
                <p className="text-gray-600">
                  Wir haben dir eine E-Mail an <strong>{registerEmail}</strong> geschickt.
                  Bitte klicke auf den Link in der E-Mail, um dein Konto zu aktivieren.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <p className="text-sm text-blue-700">
                  <strong>Tipp:</strong> Überprüfe auch deinen Spam-Ordner, falls du die E-Mail nicht findest.
                </p>
              </div>

              <button
                type="button"
                onClick={switchToLogin}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft size={18} />
                Zurück zur Anmeldung
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          StaplerCup Social Media Manager
        </p>
      </div>
    </div>
  );
}
