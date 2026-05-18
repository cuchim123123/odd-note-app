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
    <Card className="relative overflow-hidden border border-border/40 bg-card/60 backdrop-blur-xl shadow-2xl shadow-indigo-500/5 rounded-2xl">
      {/* Dynamic top gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-violet-500 to-sky-500" />
      
      <CardHeader className="space-y-1.5 text-center pb-6 pt-8">
        <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/80 bg-clip-text text-transparent">
          Email Verification
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm font-medium">
          Securing and verifying your digital canvas
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col items-center justify-center gap-6 py-6 px-6">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-5 py-6">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-16 w-16 animate-ping rounded-full bg-primary/10" />
              <div className="relative rounded-full bg-primary/10 p-4 text-primary">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            </div>
            <p className="text-center font-semibold text-sm text-foreground/90 animate-pulse tracking-wide">
              {message || 'Verifying your unique access link...'}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-5 py-6">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-16 w-16 animate-pulse rounded-full bg-emerald-500/15" />
              <div className="relative rounded-full bg-emerald-500/10 p-4 text-emerald-500 border border-emerald-500/20">
                <CheckCircle className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1.5 text-center">
              <p className="font-bold text-base text-foreground tracking-tight">{message}</p>
              <p className="text-xs font-medium text-muted-foreground">
                Preparing your private dashboard space...
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-5 w-full">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-16 w-16 animate-pulse rounded-full bg-destructive/15" />
              <div className="relative rounded-full bg-destructive/10 p-4 text-destructive border border-destructive/20">
                <AlertCircle className="h-8 w-8" />
              </div>
            </div>
            
            <p className="text-center text-sm font-semibold text-foreground/90 leading-relaxed max-w-sm">
              {message}
            </p>
            
            <div className="w-full mt-2 rounded-2xl border border-border/50 bg-muted/40 p-5 shadow-sm space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                <MailOpen className="h-4 w-4 text-primary" />
                Resend verification link
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If your link has expired, enter your email below to receive a new one instantly.
              </p>
              <div className="space-y-2">
                <Input 
                  type="email" 
                  placeholder="name@example.com" 
                  value={resendEmail} 
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="rounded-xl border-border/50 bg-background/50 focus-visible:ring-primary focus-visible:border-primary"
                />
                <Button 
                  type="button" 
                  onClick={handleResend}
                  disabled={resendMutation.isPending || !resendEmail.trim()}
                  className="w-full rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/10"
                >
                  {resendMutation.isPending ? 'Sending Link...' : 'Send Activation Link'}
                </Button>
              </div>
              {resendResult && (
                <p className="text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-fade-in mt-1">
                  {resendResult}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2.5 px-6 pb-8 pt-2">
        {status === 'error' && (
          <>
            <Link to="/" className="w-full">
              <Button variant="outline" className="w-full rounded-xl hover:bg-accent/80 font-medium">
                Go to Home
              </Button>
            </Link>
            <Link to="/login" className="w-full">
              <Button variant="outline" className="w-full rounded-xl hover:bg-accent/80 font-medium">
                Back to Login
              </Button>
            </Link>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
