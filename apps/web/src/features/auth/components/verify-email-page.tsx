import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, MailOpen } from 'lucide-react';
import { api } from '../../../lib/axios';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useResendVerification } from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';

export function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');
  
  const [resendEmail, setResendEmail] = useState('');
  const resendMutation = useResendVerification();
  const [resendResult, setResendResult] = useState<string | null>(null);

  const handleResend = async () => {
    if (!resendEmail.trim()) return;
    try {
      await resendMutation.mutateAsync(resendEmail.trim());
      setResendResult('A new verification email has been sent if the account exists and is unverified.');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setResendResult(msg || 'Failed to resend verification email.');
    }
  };

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
        
        // Update user state so the unverified email banner disappears immediately
        useAuthStore.getState().updateUser({ isEmailVerified: true });

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
      <Card className="relative w-full max-w-md bg-card/95 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
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
            <div className="flex flex-col items-center gap-4 w-full">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-center font-medium text-foreground">{message}</p>
              
              <div className="w-full mt-4 rounded-2xl border border-border/60 bg-muted/30 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <MailOpen className="h-4 w-4 text-primary" />
                  Resend verification link
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  If your verification link has expired, enter your email below to receive a new one.
                </p>
                <div className="space-y-2">
                  <Input 
                    type="email" 
                    placeholder="name@example.com" 
                    value={resendEmail} 
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="rounded-xl border-border/60 bg-card focus-visible:border-primary"
                  />
                  <Button 
                    type="button" 
                    onClick={handleResend}
                    disabled={resendMutation.isPending || !resendEmail.trim()}
                    className="w-full rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {resendMutation.isPending ? 'Sending...' : 'Send Link'}
                  </Button>
                </div>
                {resendResult && (
                  <p className="text-center text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {resendResult}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {status === 'error' && (
            <>
              <Link to="/" className="w-full">
                <Button variant="outline" className="w-full rounded-xl">
                  Go to home
                </Button>
              </Link>
              <Link to="/login" className="w-full">
                <Button variant="outline" className="w-full rounded-xl">
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
