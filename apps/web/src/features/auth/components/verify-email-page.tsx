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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(221_83%_53%_/_0.1),_transparent_30%),radial-gradient(circle_at_bottom_right,_hsl(190_95%_45%_/_0.08),_transparent_28%)]" />
      <Card className="relative w-full max-w-md border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <CardHeader className="space-y-2 text-center pb-8">
          <CardTitle className="text-2xl font-bold tracking-tight">Email verification</CardTitle>
          <CardDescription>We’re checking your account link right now.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-6 py-8">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-center text-muted-foreground">{message || 'Verifying your email...'}</p>
            </div>
          )}
          {status === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="h-12 w-12 text-emerald-500" />
              <p className="text-center font-medium text-foreground">{message}</p>
              <p className="text-center text-sm text-muted-foreground">Redirecting to your dashboard...</p>
            </div>
          )}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-center font-medium text-foreground">{message}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {status === 'error' && (
            <>
              <Link to="/" className="w-full">
                <Button variant="outline" className="w-full">
                  Go to home
                </Button>
              </Link>
              <Link to="/auth/login" className="w-full">
                <Button variant="outline" className="w-full">
                  Back to login
                </Button>
              </Link>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
