import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

export default function MailchimpCallbackPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting to Mailchimp...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Mailchimp authorization failed: ${error}`);
      setTimeout(() => {
        window.location.href = '/settings/email-providers?error=mailchimp';
      }, 2000);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setMessage('Missing authorization parameters');
      setTimeout(() => {
        window.location.href = '/settings/email-providers?error=missing_params';
      }, 2000);
      return;
    }

    // Call the backend API to complete the OAuth flow
    const completeOAuth = async () => {
      try {
        const response = await fetch(`/api/oauth/mailchimp/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setStatus('success');
          setMessage('Mailchimp connected successfully!');
          setTimeout(() => {
            window.location.href = '/settings/email-providers?connected=mailchimp';
          }, 1500);
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to connect Mailchimp');
          setTimeout(() => {
            window.location.href = '/settings/email-providers?error=mailchimp';
          }, 2000);
        }
      } catch (error) {
        setStatus('error');
        setMessage('Connection error. Please try again.');
        setTimeout(() => {
          window.location.href = '/settings/email-providers?error=mailchimp';
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
