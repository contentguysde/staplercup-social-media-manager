import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, LogIn } from 'lucide-react';
import { authApi } from '../../services/authApi';

type VerificationState = 'loading' | 'success' | 'error';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<VerificationState>('loading');
  const [error, setError] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setState('error');
      setError('Kein Verifizierungstoken gefunden. Bitte überprüfe den Link in deiner E-Mail.');
      return;
    }

    // Verify the email
    authApi.verifyEmail(token)
      .then((response) => {
        setState('success');
        setUserName(response.user.name);
      })
      .catch((err) => {
        setState('error');
        // Extract error message from axios error
        const errorMessage = err.response?.data?.error || err.message || 'Verifizierung fehlgeschlagen';
        setError(errorMessage);
      });
  }, [searchParams]);

  const goToLogin = () => {
    navigate('/');
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
            <p className="text-gray-500 mt-2">E-Mail Verifizierung</p>
          </div>

          {/* Loading State */}
          {state === 'loading' && (
            <div className="text-center py-8">
              <Loader2 size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">E-Mail wird verifiziert...</p>
            </div>
          )}

          {/* Success State */}
          {state === 'success' && (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full">
                <CheckCircle size={40} className="text-green-600" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  E-Mail verifiziert!
                </h3>
                <p className="text-gray-600">
                  Willkommen, <strong>{userName}</strong>!<br />
                  Dein Konto wurde erfolgreich aktiviert.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700">
                  Du kannst dich jetzt mit deiner E-Mail-Adresse und deinem Passwort anmelden.
                </p>
              </div>

              <button
                type="button"
                onClick={goToLogin}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all"
              >
                <LogIn size={18} />
                Zur Anmeldung
              </button>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full">
                <XCircle size={40} className="text-red-600" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Verifizierung fehlgeschlagen
                </h3>
                <p className="text-gray-600">
                  {error}
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
                <p className="text-sm text-amber-700">
                  <strong>Mögliche Ursachen:</strong>
                </p>
                <ul className="text-sm text-amber-700 mt-2 list-disc list-inside space-y-1">
                  <li>Der Link ist abgelaufen (nach 24 Stunden)</li>
                  <li>Der Link wurde bereits verwendet</li>
                  <li>Der Link ist ungültig oder unvollständig</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={goToLogin}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Zur Anmeldung
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
