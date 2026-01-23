import { useState, useCallback } from 'react';
import { testingApi, TestResult, SystemTestResults, ClassifiedEmail } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  XCircle,
  Play,
  Loader2,
  Mail,
  Zap,
  Database,
  FileText,
  Bot,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

export default function Testing() {
  const [systemResults, setSystemResults] = useState<SystemTestResults | null>(null);
  const [pipelineResult, setPipelineResult] = useState<any | null>(null);
  const [emailResult, setEmailResult] = useState<TestResult | null>(null);
  const [classifyResult, setClassifyResult] = useState<ClassifiedEmail | null>(null);
  
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
    } catch (error) {
      console.error('System tests failed:', error);
    } finally {
      setIsRunningSystem(false);
    }
  }, []);

  const runPipelineTest = useCallback(async () => {
    setIsRunningPipeline(true);
    try {
      const result = await testingApi.testAutomationPipeline(pipelineQuery || undefined);
      setPipelineResult(result);
    } catch (error) {
      console.error('Pipeline test failed:', error);
      setPipelineResult({ error: String(error) });
    } finally {
      setIsRunningPipeline(false);
    }
  }, [pipelineQuery]);

  const testEmailSending = useCallback(async () => {
    if (!emailTo) return;
    setIsRunningEmail(true);
    try {
      const result = await testingApi.testEmailSending(emailTo);
      setEmailResult(result);
    } catch (error) {
      console.error('Email test failed:', error);
      setEmailResult({
        name: 'Email Sending',
        passed: false,
        message: String(error),
        duration_ms: 0,
      });
    } finally {
      setIsRunningEmail(false);
    }
  }, [emailTo]);

  const classifyEmail = useCallback(async () => {
    if (!classifySubject && !classifyBody) return;
    setIsClassifying(true);
    try {
      const result = await testingApi.testClassifyEmail(classifySubject, classifyBody);
      setClassifyResult(result);
    } catch (error) {
      console.error('Email classification failed:', error);
    } finally {
      setIsClassifying(false);
    }
  }, [classifySubject, classifyBody]);

  const TestResultCard = ({ result }: { result: TestResult }) => (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
      result.passed ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 
                      'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
    }`}>
      {result.passed ? (
        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{result.name}</span>
          <Badge variant="outline" className="text-xs">
            {result.duration_ms}ms
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
        {result.details && (
          <pre className="text-xs mt-2 p-2 bg-background rounded overflow-x-auto">
            {JSON.stringify(result.details, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Testing</h1>
          <p className="text-muted-foreground">
            Verify all components of the automation system are working correctly
          </p>
        </div>
        <Button 
          onClick={runSystemTests} 
          disabled={isRunningSystem}
          size="lg"
        >
          {isRunningSystem ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Tests...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run All Tests
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="system" className="space-y-4">
        <TabsList>
          <TabsTrigger value="system" className="gap-2">
            <Database className="h-4 w-4" />
            System Tests
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-2">
            <Zap className="h-4 w-4" />
            Pipeline Test
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email Tests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-4">
          {systemResults ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {systemResults.overall_passed ? (
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      ) : (
                        <XCircle className="h-8 w-8 text-red-600" />
                      )}
                      <div>
                        <CardTitle>
                          {systemResults.overall_passed ? 'All Tests Passed' : 'Some Tests Failed'}
                        </CardTitle>
                        <CardDescription>{systemResults.summary}</CardDescription>
                      </div>
                    </div>
                    <Button variant="outline" onClick={runSystemTests} disabled={isRunningSystem}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${isRunningSystem ? 'animate-spin' : ''}`} />
                      Re-run
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {systemResults.tests.map((test, idx) => (
                      <TestResultCard key={idx} result={test} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Test Results Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Click "Run All Tests" to verify your system is configured correctly
                </p>
                <Button onClick={runSystemTests} disabled={isRunningSystem}>
                  <Play className="mr-2 h-4 w-4" />
                  Run All Tests
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Automation Pipeline Test
              </CardTitle>
              <CardDescription>
                Run a dry-run test of the full automation pipeline (discovery → matching → filtering → docs → application)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search query (e.g., 'software engineer remote')"
                  value={pipelineQuery}
                  onChange={(e) => setPipelineQuery(e.target.value)}
                />
                <Button onClick={runPipelineTest} disabled={isRunningPipeline}>
                  {isRunningPipeline ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Test
                    </>
                  )}
                </Button>
              </div>

              {pipelineResult && (
                <div className="mt-4">
                  {pipelineResult.error ? (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-medium">Pipeline Error</span>
                      </div>
                      <p className="mt-2 text-sm">{pipelineResult.error}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <div className="text-2xl font-bold">{pipelineResult.jobs_discovered || 0}</div>
                          <div className="text-sm text-muted-foreground">Jobs Discovered</div>
                        </div>
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <div className="text-2xl font-bold">{pipelineResult.jobs_matched || 0}</div>
                          <div className="text-sm text-muted-foreground">Jobs Matched</div>
                        </div>
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <div className="text-2xl font-bold">{pipelineResult.documents_generated || 0}</div>
                          <div className="text-sm text-muted-foreground">Docs Generated</div>
                        </div>
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <div className="text-2xl font-bold">{pipelineResult.applications_submitted || 0}</div>
                          <div className="text-sm text-muted-foreground">Applications</div>
                        </div>
                      </div>

                      {pipelineResult.stages && (
                        <ScrollArea className="h-64 border rounded-lg p-4">
                          <pre className="text-xs">
                            {JSON.stringify(pipelineResult.stages, null, 2)}
                          </pre>
                        </ScrollArea>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Test Email Sending
                </CardTitle>
                <CardDescription>
                  Send a test email to verify SMTP configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                  />
                  <Button onClick={testEmailSending} disabled={isRunningEmail || !emailTo}>
                    {isRunningEmail ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Send'
                    )}
                  </Button>
                </div>
                
                {emailResult && (
                  <TestResultCard result={emailResult} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Email Classifier Test
                </CardTitle>
                <CardDescription>
                  Test how the system classifies recruiter emails
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Email subject"
                  value={classifySubject}
                  onChange={(e) => setClassifySubject(e.target.value)}
                />
                <Textarea
                  placeholder="Email body"
                  value={classifyBody}
                  onChange={(e) => setClassifyBody(e.target.value)}
                  rows={3}
                />
                <Button 
                  onClick={classifyEmail} 
                  disabled={isClassifying || (!classifySubject && !classifyBody)}
                  className="w-full"
                >
                  {isClassifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Classifying...
                    </>
                  ) : (
                    'Classify Email'
                  )}
                </Button>

                {classifyResult && (
                  <div className="mt-4 p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Category:</span>
                      <Badge variant={
                        classifyResult.category === 'Interview' ? 'default' :
                        classifyResult.category === 'Offer' ? 'default' :
                        classifyResult.category === 'Rejection' ? 'destructive' :
                        'secondary'
                      }>
                        {classifyResult.category}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Confidence:</span>
                      <span>{(classifyResult.confidence * 100).toFixed(0)}%</span>
                    </div>
                    {classifyResult.requires_action && (
                      <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm">
                          {classifyResult.suggested_action || 'Action required'}
                        </span>
                      </div>
                    )}
                    {Object.keys(classifyResult.extracted_data).length > 0 && (
                      <div>
                        <span className="font-medium text-sm">Extracted Data:</span>
                        <pre className="text-xs mt-1 p-2 bg-muted rounded">
                          {JSON.stringify(classifyResult.extracted_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Example emails for testing */}
          <Card>
            <CardHeader>
              <CardTitle>Example Test Emails</CardTitle>
              <CardDescription>Click to auto-fill the classifier with common email types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                {[
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
                ].map((example, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    className="h-auto py-3"
                    onClick={() => {
                      setClassifySubject(example.subject);
                      setClassifyBody(example.body);
                    }}
                  >
                    {example.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
