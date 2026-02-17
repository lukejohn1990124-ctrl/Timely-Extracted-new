import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

export default function PayPalCallbackPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting to PayPal...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      setStatus('error');
      setMessage('Missing authorization parameters');
      setTimeout(() => {
        window.location.href = '/settings/integrations?error=missing_params';
      }, 2000);
      return;
    }

    // Call the backend API to complete the OAuth flow
    const completeOAuth = async () => {
      try {
        const response = await fetch(`/api/integrations/paypal/complete-oauth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setStatus('success');
          setMessage('PayPal connected successfully!');
          setTimeout(() => {
            window.location.href = '/?connected=paypal';
          }, 1500);
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to connect PayPal');
          setTimeout(() => {
            window.location.href = '/settings/integrations?error=paypal';
          }, 2000);
        }
      } catch (error) {
        setStatus('error');
        setMessage('Connection error. Please try again.');
        setTimeout(() => {
          window.location.href = '/settings/integrations?error=paypal';
        }, 2000);
      }
    };

    completeOAuth();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center p-8">
        <div className="text-5xl mb-4">
          {status === 'loading' && '⏳'}
          {status === 'success' && '✓'}
          {status === 'error' && '✕'}
        </div>
        <div className="text-gray-700 text-lg mb-2">{message}</div>
        <div className="text-gray-500 text-sm">
          {status === 'loading' ? 'Please wait...' : 'Redirecting...'}
        </div>
      </div>
    </div>
  );
}
