import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../../../lib/axios';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';

export function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link');
        return;
      }

      try {
        await api.get(`/auth/verify-email/${token}`);
        setStatus('success');
        setMessage('Your email has been verified successfully!');
        // Auto-redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      } catch (error: unknown) {
        setStatus('error');
        if (error instanceof Error) {
          setMessage(error.message || 'Failed to verify email. The link may be expired or invalid.');
        } else {
          setMessage('Failed to verify email. The link may be expired or invalid.');
        }
      }
    };

    verifyEmail();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-lg sm:border sm:shadow-sm">
        <CardHeader className="space-y-2 text-center pb-8">
          <CardTitle className="text-2xl font-bold tracking-tight">Email Verification</CardTitle>
          <CardDescription>Verifying your email address</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-6 py-8">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-center text-muted-foreground">{message || 'Verifying your email...'}</p>
            </div>
          )}
          {status === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
              <p className="text-center text-foreground font-medium">{message}</p>
              <p className="text-center text-sm text-muted-foreground">Redirecting to your dashboard...</p>
            </div>
          )}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <p className="text-center text-foreground font-medium">{message}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          {status === 'error' && (
            <>
              <Link to="/" className="w-full">
                <Button variant="outline" className="w-full">
                  Go to Home
                </Button>
              </Link>
              <Link to="/auth/login" className="w-full">
                <Button variant="outline" className="w-full">
                  Back to Login
                </Button>
              </Link>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
