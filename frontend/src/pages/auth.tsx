import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

interface AuthGateProps {
  onSuccess: () => void;
}

export function AuthSetup({ onSuccess }: AuthGateProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const setupMutation = useMutation({
    mutationFn: async () => {
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      return authApi.setup(email ? email : undefined, password);
    },
    onSuccess: () => {
      toast({ title: 'Authentication enabled', description: 'You are now logged in.' });
      onSuccess();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : null;
      toast({
        title: 'Setup failed',
        description: message ?? 'Unable to configure authentication',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setupMutation.mutate();
  };

  return (
    <AuthShell
      title="Secure your workspace"
      description="Create a local password to keep your data safe. This stays on your device."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email (optional)</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <Button className="w-full" type="submit" disabled={setupMutation.isLoading}>
          {setupMutation.isLoading ? 'Setting up...' : 'Create Password'}
        </Button>
      </form>
    </AuthShell>
  );
}

export function AuthLogin({ onSuccess }: AuthGateProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: async () => authApi.login(password),
    onSuccess: () => {
      toast({ title: 'Welcome back', description: 'You are now logged in.' });
      onSuccess();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : null;
      toast({
        title: 'Login failed',
        description: message ?? 'Invalid password',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    loginMutation.mutate();
  };

  return (
    <AuthShell
      title="Enter your workspace"
      description="This protects your scraped jobs and applications on this device."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button className="w-full" type="submit" disabled={loginMutation.isLoading}>
          {loginMutation.isLoading ? 'Signing in...' : 'Unlock'}
        </Button>
      </form>
    </AuthShell>
  );
}

function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full shadow-xl">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

