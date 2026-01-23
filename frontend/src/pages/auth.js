import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
export function AuthSetup({ onSuccess }) {
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
        onError: (error) => {
            const message = error instanceof Error ? error.message : null;
            toast({
                title: 'Setup failed',
                description: message ?? 'Unable to configure authentication',
                variant: 'destructive',
            });
        },
    });
    const handleSubmit = (event) => {
        event.preventDefault();
        setupMutation.mutate();
    };
    return (_jsx(AuthShell, { title: "Secure your workspace", description: "Create a local password to keep your data safe. This stays on your device.", children: _jsxs("form", { className: "space-y-4", onSubmit: handleSubmit, children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "email", children: "Email (optional)" }), _jsx(Input, { id: "email", type: "email", placeholder: "you@example.com", value: email, onChange: (e) => setEmail(e.target.value) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "password", children: "Password" }), _jsx(Input, { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true, minLength: 6 })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "confirmPassword", children: "Confirm Password" }), _jsx(Input, { id: "confirmPassword", type: "password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), required: true, minLength: 6 })] }), _jsx(Button, { className: "w-full", type: "submit", disabled: setupMutation.isLoading, children: setupMutation.isLoading ? 'Setting up...' : 'Create Password' })] }) }));
}
export function AuthLogin({ onSuccess }) {
    const { toast } = useToast();
    const [password, setPassword] = useState('');
    const loginMutation = useMutation({
        mutationFn: async () => authApi.login(password),
        onSuccess: () => {
            toast({ title: 'Welcome back', description: 'You are now logged in.' });
            onSuccess();
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : null;
            toast({
                title: 'Login failed',
                description: message ?? 'Invalid password',
                variant: 'destructive',
            });
        },
    });
    const handleSubmit = (event) => {
        event.preventDefault();
        loginMutation.mutate();
    };
    return (_jsx(AuthShell, { title: "Enter your workspace", description: "This protects your scraped jobs and applications on this device.", children: _jsxs("form", { className: "space-y-4", onSubmit: handleSubmit, children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "login-password", children: "Password" }), _jsx(Input, { id: "login-password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true })] }), _jsx(Button, { className: "w-full", type: "submit", disabled: loginMutation.isLoading, children: loginMutation.isLoading ? 'Signing in...' : 'Unlock' })] }) }));
}
function AuthShell({ title, description, children, }) {
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-background via-muted/50 to-background flex items-center justify-center px-4", children: _jsxs(Card, { className: "max-w-md w-full shadow-xl", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: title }), _jsx(CardDescription, { children: description })] }), _jsx(CardContent, { children: children })] }) }));
}
