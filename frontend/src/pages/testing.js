import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { testingApi } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Play, Loader2, Mail, Zap, Database, FileText, Bot, AlertTriangle, RefreshCw, } from 'lucide-react';
export default function Testing() {
    const [systemResults, setSystemResults] = useState(null);
    const [pipelineResult, setPipelineResult] = useState(null);
    const [emailResult, setEmailResult] = useState(null);
    const [classifyResult, setClassifyResult] = useState(null);
    const [isRunningSystem, setIsRunningSystem] = useState(false);
    const [isRunningPipeline, setIsRunningPipeline] = useState(false);
    const [isRunningEmail, setIsRunningEmail] = useState(false);
    const [isClassifying, setIsClassifying] = useState(false);
    // Form states
    const [pipelineQuery, setPipelineQuery] = useState('software engineer remote');
    const [emailTo, setEmailTo] = useState('');
    const [classifySubject, setClassifySubject] = useState('');
    const [classifyBody, setClassifyBody] = useState('');
    const runSystemTests = useCallback(async () => {
        setIsRunningSystem(true);
        try {
            const results = await testingApi.runSystemTests();
            setSystemResults(results);
        }
        catch (error) {
            console.error('System tests failed:', error);
        }
        finally {
            setIsRunningSystem(false);
        }
    }, []);
    const runPipelineTest = useCallback(async () => {
        setIsRunningPipeline(true);
        try {
            const result = await testingApi.testAutomationPipeline(pipelineQuery || undefined);
            setPipelineResult(result);
        }
        catch (error) {
            console.error('Pipeline test failed:', error);
            setPipelineResult({ error: String(error) });
        }
        finally {
            setIsRunningPipeline(false);
        }
    }, [pipelineQuery]);
    const testEmailSending = useCallback(async () => {
        if (!emailTo)
            return;
        setIsRunningEmail(true);
        try {
            const result = await testingApi.testEmailSending(emailTo);
            setEmailResult(result);
        }
        catch (error) {
            console.error('Email test failed:', error);
            setEmailResult({
                name: 'Email Sending',
                passed: false,
                message: String(error),
                duration_ms: 0,
            });
        }
        finally {
            setIsRunningEmail(false);
        }
    }, [emailTo]);
    const classifyEmail = useCallback(async () => {
        if (!classifySubject && !classifyBody)
            return;
        setIsClassifying(true);
        try {
            const result = await testingApi.testClassifyEmail(classifySubject, classifyBody);
            setClassifyResult(result);
        }
        catch (error) {
            console.error('Email classification failed:', error);
        }
        finally {
            setIsClassifying(false);
        }
    }, [classifySubject, classifyBody]);
    const TestResultCard = ({ result }) => (_jsxs("div", { className: `flex items-start gap-3 p-3 rounded-lg border ${result.passed ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' :
            'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'}`, children: [result.passed ? (_jsx(CheckCircle, { className: "h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" })) : (_jsx(XCircle, { className: "h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "font-medium", children: result.name }), _jsxs(Badge, { variant: "outline", className: "text-xs", children: [result.duration_ms, "ms"] })] }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: result.message }), result.details && (_jsx("pre", { className: "text-xs mt-2 p-2 bg-background rounded overflow-x-auto", children: JSON.stringify(result.details, null, 2) }))] })] }));
    return (_jsxs("div", { className: "container mx-auto py-6 max-w-6xl", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight", children: "System Testing" }), _jsx("p", { className: "text-muted-foreground", children: "Verify all components of the automation system are working correctly" })] }), _jsx(Button, { onClick: runSystemTests, disabled: isRunningSystem, size: "lg", children: isRunningSystem ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }), "Running Tests..."] })) : (_jsxs(_Fragment, { children: [_jsx(Play, { className: "mr-2 h-4 w-4" }), "Run All Tests"] })) })] }), _jsxs(Tabs, { defaultValue: "system", className: "space-y-4", children: [_jsxs(TabsList, { children: [_jsxs(TabsTrigger, { value: "system", className: "gap-2", children: [_jsx(Database, { className: "h-4 w-4" }), "System Tests"] }), _jsxs(TabsTrigger, { value: "pipeline", className: "gap-2", children: [_jsx(Zap, { className: "h-4 w-4" }), "Pipeline Test"] }), _jsxs(TabsTrigger, { value: "email", className: "gap-2", children: [_jsx(Mail, { className: "h-4 w-4" }), "Email Tests"] })] }), _jsx(TabsContent, { value: "system", className: "space-y-4", children: systemResults ? (_jsx(_Fragment, { children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [systemResults.overall_passed ? (_jsx(CheckCircle, { className: "h-8 w-8 text-green-600" })) : (_jsx(XCircle, { className: "h-8 w-8 text-red-600" })), _jsxs("div", { children: [_jsx(CardTitle, { children: systemResults.overall_passed ? 'All Tests Passed' : 'Some Tests Failed' }), _jsx(CardDescription, { children: systemResults.summary })] })] }), _jsxs(Button, { variant: "outline", onClick: runSystemTests, disabled: isRunningSystem, children: [_jsx(RefreshCw, { className: `mr-2 h-4 w-4 ${isRunningSystem ? 'animate-spin' : ''}` }), "Re-run"] })] }) }), _jsx(CardContent, { children: _jsx("div", { className: "space-y-3", children: systemResults.tests.map((test, idx) => (_jsx(TestResultCard, { result: test }, idx))) }) })] }) })) : (_jsx(Card, { children: _jsxs(CardContent, { className: "py-12 text-center", children: [_jsx(Bot, { className: "h-12 w-12 mx-auto text-muted-foreground mb-4" }), _jsx("h3", { className: "text-lg font-medium mb-2", children: "No Test Results Yet" }), _jsx("p", { className: "text-muted-foreground mb-4", children: "Click \"Run All Tests\" to verify your system is configured correctly" }), _jsxs(Button, { onClick: runSystemTests, disabled: isRunningSystem, children: [_jsx(Play, { className: "mr-2 h-4 w-4" }), "Run All Tests"] })] }) })) }), _jsx(TabsContent, { value: "pipeline", className: "space-y-4", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Zap, { className: "h-5 w-5" }), "Automation Pipeline Test"] }), _jsx(CardDescription, { children: "Run a dry-run test of the full automation pipeline (discovery \u2192 matching \u2192 filtering \u2192 docs \u2192 application)" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { placeholder: "Search query (e.g., 'software engineer remote')", value: pipelineQuery, onChange: (e) => setPipelineQuery(e.target.value) }), _jsx(Button, { onClick: runPipelineTest, disabled: isRunningPipeline, children: isRunningPipeline ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }), "Running..."] })) : (_jsxs(_Fragment, { children: [_jsx(Play, { className: "mr-2 h-4 w-4" }), "Run Test"] })) })] }), pipelineResult && (_jsx("div", { className: "mt-4", children: pipelineResult.error ? (_jsxs("div", { className: "p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg", children: [_jsxs("div", { className: "flex items-center gap-2 text-red-600", children: [_jsx(AlertTriangle, { className: "h-5 w-5" }), _jsx("span", { className: "font-medium", children: "Pipeline Error" })] }), _jsx("p", { className: "mt-2 text-sm", children: pipelineResult.error })] })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsxs("div", { className: "p-4 bg-muted rounded-lg text-center", children: [_jsx("div", { className: "text-2xl font-bold", children: pipelineResult.jobs_discovered || 0 }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Jobs Discovered" })] }), _jsxs("div", { className: "p-4 bg-muted rounded-lg text-center", children: [_jsx("div", { className: "text-2xl font-bold", children: pipelineResult.jobs_matched || 0 }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Jobs Matched" })] }), _jsxs("div", { className: "p-4 bg-muted rounded-lg text-center", children: [_jsx("div", { className: "text-2xl font-bold", children: pipelineResult.documents_generated || 0 }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Docs Generated" })] }), _jsxs("div", { className: "p-4 bg-muted rounded-lg text-center", children: [_jsx("div", { className: "text-2xl font-bold", children: pipelineResult.applications_submitted || 0 }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Applications" })] })] }), pipelineResult.stages && (_jsx(ScrollArea, { className: "h-64 border rounded-lg p-4", children: _jsx("pre", { className: "text-xs", children: JSON.stringify(pipelineResult.stages, null, 2) }) }))] })) }))] })] }) }), _jsxs(TabsContent, { value: "email", className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Mail, { className: "h-5 w-5" }), "Test Email Sending"] }), _jsx(CardDescription, { children: "Send a test email to verify SMTP configuration" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { type: "email", placeholder: "your@email.com", value: emailTo, onChange: (e) => setEmailTo(e.target.value) }), _jsx(Button, { onClick: testEmailSending, disabled: isRunningEmail || !emailTo, children: isRunningEmail ? (_jsx(Loader2, { className: "h-4 w-4 animate-spin" })) : ('Send') })] }), emailResult && (_jsx(TestResultCard, { result: emailResult }))] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(FileText, { className: "h-5 w-5" }), "Email Classifier Test"] }), _jsx(CardDescription, { children: "Test how the system classifies recruiter emails" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx(Input, { placeholder: "Email subject", value: classifySubject, onChange: (e) => setClassifySubject(e.target.value) }), _jsx(Textarea, { placeholder: "Email body", value: classifyBody, onChange: (e) => setClassifyBody(e.target.value), rows: 3 }), _jsx(Button, { onClick: classifyEmail, disabled: isClassifying || (!classifySubject && !classifyBody), className: "w-full", children: isClassifying ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }), "Classifying..."] })) : ('Classify Email') }), classifyResult && (_jsxs("div", { className: "mt-4 p-4 border rounded-lg space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-medium", children: "Category:" }), _jsx(Badge, { variant: classifyResult.category === 'Interview' ? 'default' :
                                                                            classifyResult.category === 'Offer' ? 'default' :
                                                                                classifyResult.category === 'Rejection' ? 'destructive' :
                                                                                    'secondary', children: classifyResult.category })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-medium", children: "Confidence:" }), _jsxs("span", { children: [(classifyResult.confidence * 100).toFixed(0), "%"] })] }), classifyResult.requires_action && (_jsxs("div", { className: "flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded", children: [_jsx(AlertTriangle, { className: "h-4 w-4 text-yellow-600" }), _jsx("span", { className: "text-sm", children: classifyResult.suggested_action || 'Action required' })] })), Object.keys(classifyResult.extracted_data).length > 0 && (_jsxs("div", { children: [_jsx("span", { className: "font-medium text-sm", children: "Extracted Data:" }), _jsx("pre", { className: "text-xs mt-1 p-2 bg-muted rounded", children: JSON.stringify(classifyResult.extracted_data, null, 2) })] }))] }))] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Example Test Emails" }), _jsx(CardDescription, { children: "Click to auto-fill the classifier with common email types" })] }), _jsx(CardContent, { children: _jsx("div", { className: "grid gap-2 md:grid-cols-2 lg:grid-cols-4", children: [
                                                {
                                                    label: 'Interview Invite',
                                                    subject: 'Interview Request - Senior Developer Position',
                                                    body: 'Hi, we reviewed your application and would like to schedule a phone interview. Please let us know your availability next week.'
                                                },
                                                {
                                                    label: 'Rejection',
                                                    subject: 'Update on Your Application',
                                                    body: 'Thank you for your interest in the position. Unfortunately, we have decided to move forward with other candidates whose experience more closely matches our needs.'
                                                },
                                                {
                                                    label: 'Job Offer',
                                                    subject: 'Job Offer - TechCorp Inc.',
                                                    body: 'We are pleased to extend an offer for the Senior Software Engineer position. Your starting salary will be $150,000 per year with a $20,000 signing bonus.'
                                                },
                                                {
                                                    label: 'Assessment',
                                                    subject: 'Technical Assessment',
                                                    body: 'Please complete the attached HackerRank coding challenge within 5 days. Good luck!'
                                                }
                                            ].map((example, idx) => (_jsx(Button, { variant: "outline", className: "h-auto py-3", onClick: () => {
                                                    setClassifySubject(example.subject);
                                                    setClassifyBody(example.body);
                                                }, children: example.label }, idx))) }) })] })] })] })] }));
}
