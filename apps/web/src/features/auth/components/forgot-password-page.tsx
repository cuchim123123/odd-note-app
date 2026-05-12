import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@odd-note-app/validation';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { api } from '../../../lib/axios';
import { AxiosError } from 'axios';

export function ForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setErrorMsg(null);
    try {
      // Assuming a backend endpoint POST /auth/forgot-password exists
      await api.post('/auth/forgot-password', data);
      setIsSuccess(true);
    } catch (error) {
      if (error instanceof AxiosError) {
        setErrorMsg(error.response?.data?.message || 'Failed to request password reset');
      } else {
        setErrorMsg('An unexpected error occurred');
      }
    }
  };

  return (
    <Card className="border-0 shadow-lg sm:border sm:shadow-sm">
      <CardHeader className="space-y-2 text-center pb-8">
        <CardTitle className="text-2xl font-bold tracking-tight">Forgot password</CardTitle>
        <CardDescription>Enter your email to receive a reset link</CardDescription>
      </CardHeader>
      <CardContent>
        {isSuccess ? (
          <div className="text-center space-y-4">
            <div className="p-4 bg-primary/10 text-primary rounded-lg">
              <p className="font-medium">Check your email</p>
              <p className="text-sm mt-1">We've sent a password reset link to your email address.</p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth/login">Return to login</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="name@example.com" 
                autoComplete="email"
                {...register('email')}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            
            {errorMsg && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
                {errorMsg}
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending link...' : 'Send reset link'}
            </Button>
          </form>
        )}
      </CardContent>
      {!isSuccess && (
        <CardFooter className="flex justify-center text-sm">
          <Link to="/auth/login" className="text-primary hover:underline font-medium">
            Back to login
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}
