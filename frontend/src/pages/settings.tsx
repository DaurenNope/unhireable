import { useState, useEffect, useMemo } from "react"
import type { KeyboardEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { useTheme } from "next-themes"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Switch } from "../components/ui/switch"
import { Separator } from "../components/ui/separator"
import { Badge } from "../components/ui/badge"
import { Alert, AlertDescription } from "../components/ui/alert"
import { Sun, Moon, Monitor, Key, Trash2, Plus, Save, AlertCircle, CheckCircle2, Mail, Send, Rocket, Shield, Zap, Search, Play } from "lucide-react"
import { credentialApi, schedulerApi, profileApi, savedSearchApi, automationApi } from "@/api/client"
import { restApi, type AnswerPatternsConfig } from "@/api/rest"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { UserProfileForm } from "@/components/user-profile-form"
import type { UserProfile, SchedulerConfig, ApplicationMode, AutomationHealth, AlertFrequency } from "@/types/models"
import { cn } from "@/lib/utils"
// Saved searches functionality moved to simplified UI
import { invoke } from "@tauri-apps/api/core"
import { Clock, Square, RefreshCw, Loader2 } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useNavigate } from "react-router-dom"
import { useToast } from "@/components/ui/use-toast"

export function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'profile';


  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Configure your profile, automation, and preferences.
        </p>
      </div>

      <Tabs
        value={defaultTab}
        onValueChange={(value) => {
          setSearchParams({ tab: value });
        }}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="scraper">Job Sources</TabsTrigger>
          <TabsTrigger value="credentials">API Keys</TabsTrigger>
          <TabsTrigger value="patterns">Answer Patterns</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>
                Your skills, experience, and preferences help us match you with the right jobs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Automation</CardTitle>
              <CardDescription>
                Configure automatic job applications, email notifications, and scheduling.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <AutomationHealthCard />
              <ApplicationSettings />
              <Separator />
              <EmailNotificationSettings />
              <Separator />
              <SchedulerSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scraper" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Sources</CardTitle>
              <CardDescription>
                Choose which job boards to scrape and how often to check for new listings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ScraperSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credentials" className="space-y-4">
          <CredentialsSettings />
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <AnswerPatternsSettings />
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <JobPreferences />
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <AppearanceSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}

const DEFAULT_ANSWER_PATTERNS: AnswerPatternsConfig = {
  patterns: [
    { id: "first_name", labelPatterns: ["first name"], source: "profile", profilePath: "personal_info.name", transform: "first_word" },
    { id: "last_name", labelPatterns: ["last name"], source: "profile", profilePath: "personal_info.name", transform: "rest_after_first" },
    { id: "full_name", labelPatterns: ["full name"], source: "profile", profilePath: "personal_info.name" },
    { id: "name", labelPatterns: ["name"], excludePatterns: ["first name", "last name", "full name"], source: "profile", profilePath: "personal_info.name" },
    { id: "email", labelPatterns: ["email"], excludePatterns: ["country"], source: "profile", profilePath: "personal_info.email" },
    { id: "phone", labelPatterns: ["phone", "mobile"], excludePatterns: ["country"], source: "profile", profilePath: "personal_info.phone" },
    { id: "linkedin", labelPatterns: ["linkedin", "linked in"], source: "profile", profilePath: "personal_info.linkedin", fallbackPath: "personal_info.linkedin_url" },
    { id: "work_authorization", labelPatterns: ["authorized", "legally", "right to work"], source: "literal", literalValue: "Yes" },
    { id: "sponsorship", labelPatterns: ["sponsorship", "require visa", "need sponsorship"], source: "profile", profilePath: "personal_info.requires_sponsorship", transform: "sponsorship_yes_no" },
    { id: "relocation", labelPatterns: ["relocat", "willing to move"], source: "literal", literalValue: "Yes" },
    { id: "start_date", labelPatterns: ["start date", "available to start", "when can you start"], source: "literal", literalValue: "Immediately" },
    { id: "how_did_you_hear", labelPatterns: ["how did you hear", "how did you find", "referral source"], source: "literal", literalValue: "LinkedIn" },
    { id: "salary", labelPatterns: ["salary", "compensation", "expected pay"], source: "literal", literalValue: "Open to discussion" },
    { id: "years_experience", labelPatterns: ["years", "experience"], matchType: "all", source: "profile", profilePath: "personal_info.years_experience", default: "5" },
    { id: "years_experience_alt", labelPatterns: ["how many years", "years of experience"], matchType: "any", source: "profile", profilePath: "personal_info.years_experience", default: "5" },
    { id: "consent_checkbox", labelPatterns: ["agree", "consent", "terms", "certify", "acknowledge"], matchType: "any", source: "literal", literalValue: "check" },
    { id: "messaging_app", labelPatterns: ["messaging app", "telegram", "whatsapp", "contact via", "messenger"], matchType: "any", source: "profile", profilePath: "personal_info.messaging", fallbackPath: "personal_info.telegram" },
  ],
};

function AnswerPatternsSettings() {
  const { toast } = useToast();
  const [jsonText, setJsonText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["answer-patterns"],
    queryFn: () => restApi.answerPatterns.get("default"),
    retry: 1,
  });

  const saveMutation = useMutation({
    mutationFn: (config: AnswerPatternsConfig) => restApi.answerPatterns.save(config, "default"),
    onSuccess: () => {
      toast({ title: "Saved", description: "Answer patterns saved. The extension will use them on next apply." });
      refetch();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (data) {
      setJsonText(JSON.stringify(data, null, 2));
      setParseError(null);
    } else if (!isLoading && !error) {
      setJsonText(JSON.stringify({ patterns: [] }, null, 2));
    }
  }, [data, isLoading, error]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonText) as AnswerPatternsConfig;
      if (!parsed.patterns || !Array.isArray(parsed.patterns)) {
        setParseError("Must have a 'patterns' array");
        return;
      }
      setParseError(null);
      saveMutation.mutate(parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  const handleLoadDefaults = () => {
    setJsonText(JSON.stringify(DEFAULT_ANSWER_PATTERNS, null, 2));
    setParseError(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Answer Patterns</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Answer Patterns</CardTitle>
          <CardDescription>
            Could not load patterns. Is the app running? The extension will use bundled defaults.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} variant="outline">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Answer Patterns</CardTitle>
        <CardDescription>
          Map form questions to your profile or fixed values. Used by the Chrome extension for auto-fill.
          Add patterns for common questions; the extension falls back to LLM or asks you for unknowns.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={handleLoadDefaults} variant="outline" size="sm">
            Load defaults
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </div>
        {parseError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{parseError}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label>Patterns (JSON)</Label>
          <textarea
            className="min-h-[400px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='{"patterns": [...]}'
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-32" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme</CardTitle>
        <CardDescription>
          Customize how Unhireable looks on your device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Button
            variant={theme === "light" ? "default" : "outline"}
            className="w-full justify-start"
            onClick={() => setTheme("light")}
          >
            <Sun className="mr-2 h-4 w-4" />
            Light
          </Button>
          <Button
            variant={theme === "dark" ? "default" : "outline"}
            className="w-full justify-start"
            onClick={() => setTheme("dark")}
          >
            <Moon className="mr-2 h-4 w-4" />
            Dark
          </Button>
          <Button
            variant={theme === "system" ? "default" : "outline"}
            className="w-full justify-start"
            onClick={() => setTheme("system")}
          >
            <Monitor className="mr-2 h-4 w-4" />
            System
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          The "System" setting will match your operating system's appearance settings.
        </p>
      </CardContent>
    </Card>
  )
}

function ScraperSettings() {
  const [firecrawlKey, setFirecrawlKey] = useState("")
  const [, setUseFirecrawl] = useState(false)
  const [useBrowserAutomation, setUseBrowserAutomation] = useState(false)
  const [linkedinEnabled, setLinkedinEnabled] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const queryClient = useQueryClient()

  const { data: firecrawlCred } = useQuery({
    queryKey: ['credential', 'firecrawl'],
    queryFn: () => credentialApi.get('firecrawl'),
  })

  useEffect(() => {
    if (firecrawlCred) {
      setFirecrawlKey(firecrawlCred.tokens || "")
      setUseFirecrawl(!!firecrawlCred.tokens)
    }
  }, [firecrawlCred])

  const saveFirecrawlKey = async () => {
    try {
      if (firecrawlKey.trim()) {
        await credentialApi.create({
          platform: 'firecrawl',
          tokens: firecrawlKey.trim(),
          is_active: true,
        })
        setMessage({ type: 'success', text: 'Firecrawl API key saved' })
      } else {
        await credentialApi.delete('firecrawl')
        setMessage({ type: 'success', text: 'Firecrawl API key removed' })
      }
      queryClient.invalidateQueries({ queryKey: ['credential'] })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: unknown) {
      setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to save API key' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Firecrawl API</CardTitle>
          <CardDescription>
            Configure Firecrawl API key for advanced scraping capabilities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firecrawl-key">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="firecrawl-key"
                type="password"
                placeholder="Enter Firecrawl API key"
                value={firecrawlKey}
                onChange={(e) => setFirecrawlKey(e.target.value)}
                className="flex-1"
              />
              <Button onClick={saveFirecrawlKey}>
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Optional: Used for scraping JavaScript-rendered pages. Get your key at firecrawl.dev
            </p>
          </div>
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Browser Automation</CardTitle>
          <CardDescription>
            Configure browser automation settings for scraping.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Use Browser Automation</Label>
              <p className="text-sm text-muted-foreground">
                Use Playwright/Chrome for JavaScript-heavy sites
              </p>
            </div>
            <Switch
              checked={useBrowserAutomation}
              onCheckedChange={setUseBrowserAutomation}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Requires Playwright or headless Chrome to be installed on your system.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LinkedIn Settings</CardTitle>
          <CardDescription>
            ⚠️ LinkedIn scraping is high-risk and disabled by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable LinkedIn Scraping</Label>
              <p className="text-sm text-muted-foreground">
                Use conservative delays to reduce ban risk
              </p>
            </div>
            <Switch
              checked={linkedinEnabled}
              onCheckedChange={setLinkedinEnabled}
            />
          </div>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              LinkedIn does not allow automated scraping. Enabling this feature may result in account bans.
              Use at your own risk with conservative settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}

function CredentialsSettings() {
  const queryClient = useQueryClient()
  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => credentialApi.list(false),
  })

  const handleDelete = async (platform: string) => {
    if (!confirm(`Delete credentials for ${platform}?`)) return
    try {
      await credentialApi.delete(platform)
      queryClient.invalidateQueries({ queryKey: ['credentials'] })
    } catch (error: unknown) {
      alert(`Failed to delete: ${(error instanceof Error ? error.message : String(error)) || 'Unknown error'}`)
    }
  }

  const platforms = [
    { name: 'Mistral AI', key: 'mistral', description: 'Preferred AI provider for document generation (free tier available)' },
    { name: 'Google Gemini', key: 'gemini', description: 'Google AI — free tier works great for resume & cover letter generation' },
    { name: 'OpenAI', key: 'openai', description: 'GPT-based AI (optional, used as fallback)' },
    { name: 'Firecrawl', key: 'firecrawl', description: 'For advanced web scraping' },
    { name: 'LinkedIn', key: 'linkedin', description: 'For LinkedIn scraping (high risk)' },
    { name: 'Wellfound', key: 'wellfound', description: 'For Wellfound scraping' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys & Credentials</CardTitle>
        <CardDescription>
          Manage API keys and platform credentials securely.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-3">
            {platforms.map((platform) => {
              const cred = credentials.find(c => c.platform === platform.key)
              return (
                <div
                  key={platform.key}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{platform.name}</h4>
                      {cred?.is_active && (
                        <Badge variant="outline" className="text-xs">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {platform.description}
                    </p>
                    {cred?.tokens && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {cred.tokens.substring(0, 8)}...
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {cred ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // TODO: Open edit dialog
                            alert('Edit functionality coming soon')
                          }}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(platform.key)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // TODO: Open add dialog
                          alert('Add credential functionality coming soon')
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EmailNotificationSettings() {
  const [smtpServer, setSmtpServer] = useState("smtp.gmail.com")
  const [smtpPort, setSmtpPort] = useState("587")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [fromEmail, setFromEmail] = useState("")
  const [fromName, setFromName] = useState("Unhireable")
  const [testEmailTo, setTestEmailTo] = useState("")
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [notifyOnNewJobs, setNotifyOnNewJobs] = useState(true)
  const [notifyOnMatches, setNotifyOnMatches] = useState(true)
  const [minMatchScore, setMinMatchScore] = useState("60")
  const [notifyDailySummary, setNotifyDailySummary] = useState(true)
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useState(true)
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false)
  const [quietHoursStart, setQuietHoursStart] = useState("22:00")
  const [quietHoursEnd, setQuietHoursEnd] = useState("08:00")
  const [maxNotificationsPerHour, setMaxNotificationsPerHour] = useState("10")
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    // Load email settings from localStorage
    const savedConfig = localStorage.getItem('emailConfig')
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig)
        setSmtpServer(config.smtp_server || "smtp.gmail.com")
        setSmtpPort(config.smtp_port?.toString() || "587")
        setUsername(config.username || "")
        setPassword(config.password || "")
        setFromEmail(config.from_email || "")
        setFromName(config.from_name || "Unhireable")
        setEmailEnabled(config.email_enabled || false)
        setNotifyOnNewJobs(config.notify_on_new_jobs !== false)
        setNotifyOnMatches(config.notify_on_matches !== false)
        setMinMatchScore(config.min_match_score_for_notification?.toString() || "60")
        setNotifyDailySummary(config.notify_daily_summary !== false)
        setDesktopNotificationsEnabled(config.desktop_notifications_enabled !== false)
        setQuietHoursEnabled(config.quiet_hours_enabled || false)
        setQuietHoursStart(config.quiet_hours_start || "22:00")
        setQuietHoursEnd(config.quiet_hours_end || "08:00")
        setMaxNotificationsPerHour(config.max_notifications_per_hour?.toString() || "10")
      } catch (e) {
        console.error('Failed to load email config:', e)
      }
    }
  }, [])

  const saveEmailConfig = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      const config = {
        smtp_server: smtpServer,
        smtp_port: parseInt(smtpPort) || 587,
        username: username,
        password: password,
        from_email: fromEmail || username,
        from_name: fromName,
        use_tls: smtpPort === "587",
        use_ssl: smtpPort === "465",
        email_enabled: emailEnabled,
        notify_on_new_jobs: notifyOnNewJobs,
        notify_on_matches: notifyOnMatches,
        min_match_score_for_notification: parseFloat(minMatchScore) || 60,
        notify_daily_summary: notifyDailySummary,
        desktop_notifications_enabled: desktopNotificationsEnabled,
        quiet_hours_enabled: quietHoursEnabled,
        quiet_hours_start: quietHoursStart,
        quiet_hours_end: quietHoursEnd,
        max_notifications_per_hour: parseInt(maxNotificationsPerHour) || 10,
      }
      localStorage.setItem('emailConfig', JSON.stringify(config))
      setMessage({ type: 'success', text: 'Email configuration saved successfully' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: unknown) {
      setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to save email configuration' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const testEmailConnection = async () => {
    if (!username || !password) {
      setMessage({ type: 'error', text: 'Please enter username and password first' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    setIsTesting(true)
    setMessage(null)
    try {
      const config = {
        smtp_server: smtpServer,
        smtp_port: parseInt(smtpPort) || 587,
        username: username,
        password: password,
        from_email: fromEmail || username,
        from_name: fromName,
        use_tls: smtpPort === "587",
        use_ssl: smtpPort === "465",
      }
      await invoke<string>('test_email_connection', { config })
      setMessage({ type: 'success', text: 'Email connection test successful!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: unknown) {
      setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Email connection test failed' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setIsTesting(false)
    }
  }

  const sendTestEmail = async () => {
    if (!testEmailTo) {
      setMessage({ type: 'error', text: 'Please enter a test email address' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    if (!username || !password) {
      setMessage({ type: 'error', text: 'Please enter username and password first' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    setIsTesting(true)
    setMessage(null)
    try {
      const config = {
        smtp_server: smtpServer,
        smtp_port: parseInt(smtpPort) || 587,
        username: username,
        password: password,
        from_email: fromEmail || username,
        from_name: fromName,
        use_tls: smtpPort === "587",
        use_ssl: smtpPort === "465",
      }
      const testMode = localStorage.getItem('testMode') === 'true';
      const testEmailEndpoint = localStorage.getItem('testEmailEndpoint') || '';
      await invoke<string>('send_test_email', {
        config,
        to: testEmailTo,
        test_mode: testMode,
        test_email_endpoint: testEmailEndpoint || undefined,
      })
      setMessage({ type: 'success', text: `Test email sent successfully${testMode ? ' (TEST MODE)' : ''} to ${testMode && testEmailEndpoint ? testEmailEndpoint : testEmailTo}!` })
      setTimeout(() => setMessage(null), 5000)
    } catch (error: unknown) {
      setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to send test email' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Configure email notifications for job matches and updates. Many jobs only provide email contacts, so email functionality is crucial.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Send email notifications for job matches and updates
              </p>
            </div>
            <Switch
              checked={emailEnabled}
              onCheckedChange={setEmailEnabled}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp-server">SMTP Server</Label>
                <Input
                  id="smtp-server"
                  type="text"
                  placeholder="smtp.gmail.com"
                  value={smtpServer}
                  onChange={(e) => setSmtpServer(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Gmail: smtp.gmail.com, Outlook: smtp-mail.outlook.com
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-port">SMTP Port</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  placeholder="587"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  587 (TLS) or 465 (SSL)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-username">Email Address / Username</Label>
              <Input
                id="email-username"
                type="email"
                placeholder="your.email@gmail.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your email address (used as username for SMTP)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-password">Password / App Password</Label>
              <Input
                id="email-password"
                type="password"
                placeholder="Enter password or app password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                For Gmail, use an App Password (not your regular password).
                <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                  Learn more
                </a>
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="from-email">From Email</Label>
                <Input
                  id="from-email"
                  type="email"
                  placeholder="your.email@gmail.com"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Defaults to username if empty
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-name">From Name</Label>
                <Input
                  id="from-name"
                  type="text"
                  placeholder="Unhireable"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold">Notification Preferences</h3>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notify on New Jobs</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email when new jobs are found
                  </p>
                </div>
                <Switch
                  checked={notifyOnNewJobs}
                  onCheckedChange={setNotifyOnNewJobs}
                  disabled={!emailEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notify on Job Matches</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email when high-match jobs are found
                  </p>
                </div>
                <Switch
                  checked={notifyOnMatches}
                  onCheckedChange={setNotifyOnMatches}
                  disabled={!emailEnabled}
                />
              </div>

              {notifyOnMatches && (
                <div className="space-y-2">
                  <Label htmlFor="min-match-score">Minimum Match Score</Label>
                  <Input
                    id="min-match-score"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="60"
                    value={minMatchScore}
                    onChange={(e) => setMinMatchScore(e.target.value)}
                    disabled={!emailEnabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Only notify for jobs with match score &gt;= this value (0-100)
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Daily Summary</Label>
                  <p className="text-sm text-muted-foreground">
                    Send daily summary of job search activity
                  </p>
                </div>
                <Switch
                  checked={notifyDailySummary}
                  onCheckedChange={setNotifyDailySummary}
                  disabled={!emailEnabled}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold">Desktop Notifications</h3>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Desktop Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Show desktop notifications when new jobs are found
                  </p>
                </div>
                <Switch
                  checked={desktopNotificationsEnabled}
                  onCheckedChange={setDesktopNotificationsEnabled}
                />
              </div>

              {desktopNotificationsEnabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="max-notifications">Max Notifications Per Hour</Label>
                    <Input
                      id="max-notifications"
                      type="number"
                      min="1"
                      max="60"
                      value={maxNotificationsPerHour}
                      onChange={(e) => setMaxNotificationsPerHour(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Limit the number of notifications to prevent spam (1-60)
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Quiet Hours</Label>
                      <p className="text-sm text-muted-foreground">
                        Disable notifications during specified hours
                      </p>
                    </div>
                    <Switch
                      checked={quietHoursEnabled}
                      onCheckedChange={setQuietHoursEnabled}
                    />
                  </div>

                  {quietHoursEnabled && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                      <div className="space-y-2">
                        <Label htmlFor="quiet-start">Start Time</Label>
                        <Input
                          id="quiet-start"
                          type="time"
                          value={quietHoursStart}
                          onChange={(e) => setQuietHoursStart(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quiet-end">End Time</Label>
                        <Input
                          id="quiet-end"
                          type="time"
                          value={quietHoursEnd}
                          onChange={(e) => setQuietHoursEnd(e.target.value)}
                        />
                      </div>
                      <p className="col-span-2 text-xs text-muted-foreground">
                        Notifications will be suppressed during these hours
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold">Test Email Configuration</h3>

              <div className="space-y-2">
                <Label htmlFor="test-email">Test Email Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="test-email"
                    type="email"
                    placeholder="test@example.com"
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    onClick={testEmailConnection}
                    disabled={isTesting || !username || !password}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Test Connection
                  </Button>
                  <Button
                    onClick={sendTestEmail}
                    disabled={isTesting || !testEmailTo || !username || !password}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {isTesting ? 'Sending...' : 'Send Test Email'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Test your email configuration by sending a test email
                </p>
              </div>
            </div>

            {message && (
              <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
                {message.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button
                onClick={saveEmailConfig}
                disabled={isSaving}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ProfileSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    // Load profile from database
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const savedProfile = await profileApi.get();
        if (savedProfile) {
          setProfile(savedProfile);
          // Also save to localStorage as backup
          localStorage.setItem('userProfile', JSON.stringify(savedProfile));
        } else {
          // Try loading from localStorage as fallback
          const localProfile = localStorage.getItem('userProfile');
          if (localProfile) {
            try {
              const parsed = JSON.parse(localProfile);
              setProfile(parsed);
              // Migrate to database
              await profileApi.save(parsed);
            } catch (e) {
              console.error('Failed to parse local profile:', e);
            }
          }
        }
      } catch (error: unknown) {
        console.error('Failed to load profile:', error);
        // Try loading from localStorage as fallback
        const localProfile = localStorage.getItem('userProfile');
        if (localProfile) {
          try {
            const parsed = JSON.parse(localProfile);
            setProfile(parsed);
          } catch (e) {
            console.error('Failed to parse local profile:', e);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSave = async (newProfile: UserProfile) => {
    setIsLoading(true);
    setMessage(null);
    try {
      // Save to database
      await profileApi.save(newProfile);
      // Also save to localStorage as backup
      localStorage.setItem('userProfile', JSON.stringify(newProfile));
      setProfile(newProfile);

      // Invalidate profile query to trigger refetch and bootstrap
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      setMessage({ type: 'success', text: 'Profile saved successfully! Redirecting to dashboard...' });

      // Redirect to dashboard after a short delay
      // The dashboard will detect the profile and trigger auto-scraping
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error: unknown) {
      console.error('Failed to save profile:', error);
      setMessage({ type: 'error', text: `Failed to save profile: ${(error instanceof Error ? error.message : String(error)) || 'Unknown error'}` });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSampleProfile = () => {
    const sampleProfile: UserProfile = {
      personal_info: {
        name: "Alex Johnson",
        email: "alex.johnson@email.com",
        phone: "+1 (555) 123-4567",
        location: "San Francisco, CA",
        linkedin: "linkedin.com/in/alexjohnson",
        github: "github.com/alexjohnson",
        portfolio: "alexjohnson.dev",
      },
      summary: "Experienced software developer with 5+ years of expertise in full-stack development, specializing in React, TypeScript, and Node.js. Passionate about building scalable web applications and leading technical teams.",
      skills: {
        technical_skills: [
          "React",
          "TypeScript",
          "Node.js",
          "Python",
          "PostgreSQL",
          "MongoDB",
          "Docker",
          "AWS",
          "Git",
          "REST APIs",
          "GraphQL",
          "Next.js"
        ],
        soft_skills: [
          "Team Leadership",
          "Problem Solving",
          "Communication",
          "Agile Methodology",
          "Mentoring"
        ],
        experience_years: {
          "React": 4,
          "TypeScript": 3,
          "Node.js": 5,
          "Python": 3,
        },
        proficiency_levels: {
          "React": "Expert",
          "TypeScript": "Advanced",
          "Node.js": "Advanced",
          "Python": "Intermediate",
        },
      },
      experience: [
        {
          company: "TechCorp Inc.",
          position: "Senior Software Engineer",
          duration: "Jan 2021 - Present",
          description: [
            "Led development of customer-facing web applications using React and TypeScript",
            "Architected and implemented microservices using Node.js and Python",
            "Mentored junior developers and conducted code reviews",
            "Reduced application load time by 40% through optimization"
          ],
          technologies: ["React", "TypeScript", "Node.js", "PostgreSQL", "AWS"]
        },
        {
          company: "StartupXYZ",
          position: "Full Stack Developer",
          duration: "Jun 2019 - Dec 2020",
          description: [
            "Developed and maintained web applications using React and Node.js",
            "Collaborated with cross-functional teams to deliver features on time",
            "Implemented CI/CD pipelines using Docker and AWS"
          ],
          technologies: ["React", "Node.js", "MongoDB", "Docker"]
        },
        {
          company: "WebDev Agency",
          position: "Frontend Developer",
          duration: "Mar 2018 - May 2019",
          description: [
            "Built responsive web applications for various clients",
            "Collaborated with designers to implement UI/UX designs",
            "Optimized applications for performance and SEO"
          ],
          technologies: ["React", "JavaScript", "CSS", "HTML"]
        }
      ],
      education: [
        {
          institution: "University of California, Berkeley",
          degree: "Bachelor of Science in Computer Science",
          year: "2018",
          details: "Graduated with honors. Relevant coursework: Data Structures, Algorithms, Database Systems"
        }
      ],
      projects: [
        "Built a real-time collaboration tool using React, Node.js, and WebSockets",
        "Developed an open-source React component library with 1k+ GitHub stars",
        "Created a task management application with offline support using PWA technologies"
      ],
    };

    setProfile(sampleProfile);
    handleSave(sampleProfile);
    setMessage({ type: 'success', text: 'Sample profile loaded! You can edit it and save.' });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="space-y-4">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      {!profile && (
        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Create your profile or load a sample profile to test the resume generator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadSampleProfile} variant="outline">
              Load Sample Profile
            </Button>
          </CardContent>
        </Card>
      )}
      <UserProfileForm profile={profile} onSave={handleSave} isLoading={isLoading} />
    </div>
  );
}

function ApplicationSettings() {
  const [mode, setMode] = useState<ApplicationMode>(() => {
    const saved = localStorage.getItem('applicationMode');
    return (saved as ApplicationMode) || 'manual';
  });
  const [autoSubmit, setAutoSubmit] = useState(() => {
    const saved = localStorage.getItem('applicationAutoSubmit');
    return saved === 'true';
  });
  const [autoGenerateDocuments, setAutoGenerateDocuments] = useState(() => {
    const saved = localStorage.getItem('applicationAutoGenerateDocuments');
    return saved !== 'false'; // Default to true
  });
  const [minMatchScore, setMinMatchScore] = useState(() => {
    const saved = localStorage.getItem('applicationMinMatchScore');
    return saved ? parseInt(saved) : 70;
  });
  const [batchApply, setBatchApply] = useState(() => {
    const saved = localStorage.getItem('applicationBatchApply');
    return saved === 'true';
  });
  const [batchSize, setBatchSize] = useState(() => {
    const saved = localStorage.getItem('applicationBatchSize');
    return saved ? parseInt(saved) : 10;
  });
  const [delayBetweenApplications, setDelayBetweenApplications] = useState(() => {
    const saved = localStorage.getItem('applicationDelay');
    return saved ? parseInt(saved) : 5;
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const saveSettings = () => {
    localStorage.setItem('applicationMode', mode);
    localStorage.setItem('applicationAutoSubmit', autoSubmit.toString());
    localStorage.setItem('applicationAutoGenerateDocuments', autoGenerateDocuments.toString());
    localStorage.setItem('applicationMinMatchScore', minMatchScore.toString());
    localStorage.setItem('applicationBatchApply', batchApply.toString());
    localStorage.setItem('applicationBatchSize', batchSize.toString());
    localStorage.setItem('applicationDelay', delayBetweenApplications.toString());
    setMessage({ type: 'success', text: 'Application settings saved successfully' });
    setTimeout(() => setMessage(null), 3000);
  };

  // Update autoSubmit based on mode
  useEffect(() => {
    if (mode === 'yolo') {
      setAutoSubmit(true);
    } else if (mode === 'manual') {
      setAutoSubmit(false);
    }
    // semi-auto can have either
  }, [mode]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Application Mode</CardTitle>
          <CardDescription>
            Choose how you want to apply to jobs. Manual mode is safest, YOLO mode applies to all jobs automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={mode} onValueChange={(value) => setMode(value as ApplicationMode)}>
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="manual" id="mode-manual" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="mode-manual" className="flex items-center gap-2 cursor-pointer">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span className="font-semibold">Manual Mode</span>
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Fill forms automatically, but you review and submit manually. Safest option.
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  ✓ Form filled automatically<br />
                  ✓ Browser opens for review<br />
                  ✓ You submit manually<br />
                  ✓ Best for important applications
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="semi-auto" id="mode-semi-auto" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="mode-semi-auto" className="flex items-center gap-2 cursor-pointer">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="font-semibold">Semi-Auto Mode</span>
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Fill forms and show preview, then auto-submit after confirmation.
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  ✓ Form filled automatically<br />
                  ✓ Preview shown before submission<br />
                  ✓ Auto-submit after confirmation<br />
                  ✓ Balance of speed and safety
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border-2 border-red-500/50 rounded-lg hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors">
              <RadioGroupItem value="yolo" id="mode-yolo" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="mode-yolo" className="flex items-center gap-2 cursor-pointer">
                  <Rocket className="h-4 w-4 text-red-500" />
                  <span className="font-semibold">YOLO Mode 🚀</span>
                  <Badge variant="destructive" className="ml-2">AUTO-APPLY</Badge>
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Fully automated. Applies to all jobs matching your criteria without any confirmation.
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  ✓ Forms filled automatically<br />
                  ✓ Applications submitted automatically<br />
                  ✓ Batch apply to multiple jobs<br />
                  ⚠️ No manual review - use with caution
                </div>
                <Alert variant="destructive" className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> YOLO mode will automatically apply to jobs without your review.
                    Make sure your profile and documents are ready. Use at your own risk.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </RadioGroup>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-semibold">Test Mode</h3>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Test Mode:</strong> Use test endpoints to verify functionality without applying to real jobs.
                Applications will be sent to test endpoints where you can verify they were received.
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Test Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Use test endpoints for applications and emails (for testing only)
                </p>
              </div>
              <Switch
                checked={(() => {
                  const testMode = localStorage.getItem('testMode');
                  return testMode === 'true';
                })()}
                onCheckedChange={(checked) => {
                  localStorage.setItem('testMode', checked.toString());
                  setMessage({ type: 'success', text: `Test mode ${checked ? 'enabled' : 'disabled'}` });
                  setTimeout(() => setMessage(null), 2000);
                }}
              />
            </div>

            {(() => {
              const testMode = localStorage.getItem('testMode') === 'true';
              return testMode ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="test-application-endpoint">Test Application Endpoint</Label>
                    <Input
                      id="test-application-endpoint"
                      type="url"
                      placeholder="https://httpbin.org/post"
                      value={localStorage.getItem('testApplicationEndpoint') || 'https://httpbin.org/post'}
                      onChange={(e) => {
                        localStorage.setItem('testApplicationEndpoint', e.target.value);
                        setMessage({ type: 'success', text: 'Test endpoint saved' });
                        setTimeout(() => setMessage(null), 2000);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      URL where test applications will be submitted. Default: httpbin.org/post (shows the submitted data)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="test-email-endpoint">Test Email Address</Label>
                    <Input
                      id="test-email-endpoint"
                      type="email"
                      placeholder="test@example.com"
                      value={localStorage.getItem('testEmailEndpoint') || ''}
                      onChange={(e) => {
                        localStorage.setItem('testEmailEndpoint', e.target.value);
                        setMessage({ type: 'success', text: 'Test email saved' });
                        setTimeout(() => setMessage(null), 2000);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Email address to receive test emails. Leave empty to use your configured email.
                    </p>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                      💡 Test Endpoints Explained:
                    </p>
                    <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                      <li><strong>Application Endpoint:</strong> Applications will be sent here. httpbin.org/post shows all submitted data.</li>
                      <li><strong>Test Email:</strong> All emails will be sent to this address instead of job contacts.</li>
                      <li><strong>Safe Testing:</strong> No real applications will be sent when test mode is enabled.</li>
                    </ul>
                  </div>
                </>
              ) : null;
            })()}

            <Separator />

            <h3 className="font-semibold">Application Settings</h3>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Generate Documents</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically generate resume and cover letter before applying
                </p>
              </div>
              <Switch
                checked={autoGenerateDocuments}
                onCheckedChange={setAutoGenerateDocuments}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min-match-score">Minimum Match Score for Auto-Apply</Label>
              <Input
                id="min-match-score"
                type="number"
                min="0"
                max="100"
                value={minMatchScore}
                onChange={(e) => setMinMatchScore(parseInt(e.target.value) || 70)}
                disabled={mode !== 'yolo'}
              />
              <p className="text-xs text-muted-foreground">
                Only auto-apply to jobs with match score &gt;= this value (YOLO mode only)
              </p>
            </div>

            {mode === 'yolo' && (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Batch Apply</Label>
                    <p className="text-sm text-muted-foreground">
                      Apply to multiple jobs in batch (YOLO mode)
                    </p>
                  </div>
                  <Switch
                    checked={batchApply}
                    onCheckedChange={setBatchApply}
                  />
                </div>

                {batchApply && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="batch-size">Batch Size</Label>
                      <Input
                        id="batch-size"
                        type="number"
                        min="1"
                        max="50"
                        value={batchSize}
                        onChange={(e) => setBatchSize(parseInt(e.target.value) || 10)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Number of jobs to apply to in each batch
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="delay-between">Delay Between Applications (seconds)</Label>
                      <Input
                        id="delay-between"
                        type="number"
                        min="1"
                        max="60"
                        value={delayBetweenApplications}
                        onChange={(e) => setDelayBetweenApplications(parseInt(e.target.value) || 5)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Delay between applications to avoid rate limiting
                      </p>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Submit Applications</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically submit applications without manual review
                </p>
              </div>
              <Switch
                checked={autoSubmit}
                onCheckedChange={setAutoSubmit}
                disabled={mode === 'manual'} // Manual mode always has autoSubmit = false
              />
            </div>
          </div>

          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button onClick={saveSettings}>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AutomationHealthCard() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['automation-health'],
    queryFn: () => automationApi.healthCheck(),
    staleTime: 60 * 1000,
  });

  const health: AutomationHealth | undefined = data;
  const profileReady = !health || (health.profile_configured && (health.missing_fields?.length ?? 0) === 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Automation Health Check</CardTitle>
          <CardDescription>
            Run this before enabling auto-apply to ensure everything is ready.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && !health ? (
          <p className="text-sm text-muted-foreground">Running checks...</p>
        ) : (
          <>
            <HealthRow
              label="Profile completeness"
              ok={profileReady}
              description={
                profileReady
                  ? "Name, email, and phone look good."
                  : `Missing: ${(health?.missing_fields ?? []).join(", ")}`
              }
            />
            <HealthRow
              label="Resume on file"
              ok={(health?.resume_documents ?? 0) > 0}
              description={
                (health?.resume_documents ?? 0) > 0
                  ? `${health?.resume_documents} resume uploaded.`
                  : "Upload at least one resume document."
              }
            />
            <HealthRow
              label="Saved credentials"
              ok={(health?.credential_platforms?.length ?? 0) > 0}
              description={
                (health?.credential_platforms?.length ?? 0) > 0
                  ? `Active for: ${(health?.credential_platforms ?? []).join(", ")}`
                  : "Add credentials under the Credentials tab."
              }
            />
            <HealthRow
              label="Browser automation"
              ok={Boolean(health?.chromium_available || health?.playwright_available)}
              description={
                health
                  ? `Chromium: ${health.chromium_available ? 'ready ✅' : 'missing ❌'}, Playwright: ${health.playwright_available ? 'ready ✅' : 'missing ❌'}`
                  : "Browser runtimes will be detected automatically."
              }
            />
            <HealthRow
              label="PinchTab (external apply)"
              ok={Boolean(health?.pinchtab_available)}
              description={
                health?.pinchtab_available
                  ? "PinchTab running — external ATS forms can be auto-filled."
                  : "Optional: run 'pinchtab' for better external apply support."
              }
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HealthRow({
  label,
  ok,
  description,
}: {
  label: string;
  ok: boolean;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between border rounded-lg p-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Badge variant={ok ? "default" : "destructive"}>
        {ok ? "Ready" : "Needs attention"}
      </Badge>
    </div>
  );
}

type PreferenceFormState = {
  query: string;
  sources: string[];
  remoteOnly: boolean;
  minMatchScore: number;
  alertFrequency: AlertFrequency;
  locations: string[];
  titles: string[];
  preferredCompanies: string[];
  avoidCompanies: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  jobTypes: string[];
  industries: string[];
  benefits: string[];
  companySize: string | null;
  minSalary: string;
};

const defaultPreferenceForm: PreferenceFormState = {
  query: "remote software engineer",
  sources: ["remotive", "remoteok", "wellfound", "greenhouse"],
  remoteOnly: true,
  minMatchScore: 65,
  alertFrequency: "daily",
  locations: [],
  titles: [],
  preferredCompanies: [],
  avoidCompanies: [],
  requiredSkills: [],
  preferredSkills: [],
  jobTypes: [],
  industries: [],
  benefits: [],
  companySize: null,
  minSalary: "",
};

function JobPreferences() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PreferenceFormState>(defaultPreferenceForm);
  const [runLoading, setRunLoading] = useState(false);

  const { data: savedSearches, isLoading } = useQuery({
    queryKey: ["saved-searches"],
    queryFn: () => savedSearchApi.list(false),
  });

  const smartSearch = useMemo(
    () => savedSearches?.find((search) => search.name === "Smart Filter"),
    [savedSearches]
  );

  useEffect(() => {
    if (smartSearch) {
      const filters = {
        remote_only: smartSearch.filters?.remote_only ?? defaultPreferenceForm.remoteOnly,
        preferred_locations: smartSearch.filters?.preferred_locations ?? [],
        preferred_titles: smartSearch.filters?.preferred_titles ?? [],
        preferred_companies: smartSearch.filters?.preferred_companies ?? [],
        avoid_companies: smartSearch.filters?.avoid_companies ?? [],
        required_skills: smartSearch.filters?.required_skills ?? [],
        preferred_skills: smartSearch.filters?.preferred_skills ?? [],
        job_types: smartSearch.filters?.job_types ?? [],
        industries: smartSearch.filters?.industries ?? [],
        must_have_benefits: smartSearch.filters?.must_have_benefits ?? [],
        company_size: smartSearch.filters?.company_size ?? null,
        min_salary: smartSearch.filters?.min_salary ?? null,
      };

      setForm({
        query: smartSearch.query || defaultPreferenceForm.query,
        sources:
          smartSearch.sources?.length > 0
            ? smartSearch.sources
            : defaultPreferenceForm.sources,
        remoteOnly: filters.remote_only,
        minMatchScore: smartSearch.min_match_score || defaultPreferenceForm.minMatchScore,
        alertFrequency: smartSearch.alert_frequency || defaultPreferenceForm.alertFrequency,
        locations: filters.preferred_locations,
        titles: filters.preferred_titles,
        preferredCompanies: filters.preferred_companies,
        avoidCompanies: filters.avoid_companies,
        requiredSkills: filters.required_skills,
        preferredSkills: filters.preferred_skills,
        jobTypes: filters.job_types,
        industries: filters.industries,
        benefits: filters.must_have_benefits,
        companySize: filters.company_size,
        minSalary: filters.min_salary ? String(filters.min_salary) : "",
      });
    }
  }, [smartSearch]);

  const sourceOptions = [
    { id: "remotive", label: "Remotive" },
    { id: "remoteok", label: "RemoteOK" },
    { id: "wellfound", label: "Wellfound" },
    { id: "greenhouse", label: "Greenhouse" },
    { id: "ziprecruiter", label: "ZipRecruiter" },
    { id: "dice", label: "Dice" },
  ];

  const jobTypeOptions = ["full-time", "part-time", "contract", "freelance", "internship"];
  const companySizeOptions = ["startup", "small", "medium", "large", "enterprise"];

  const updateArrayField = (field: keyof Pick<PreferenceFormState, 'sources' | 'jobTypes' | 'industries' | 'benefits'>, value: string) => {
    setForm((prev) => {
      const current = prev[field] as string[];
      const exists = current.includes(value);
      return {
        ...prev,
        [field]: exists ? current.filter((item) => item !== value) : [...current, value],
      };
    });
  };

  const handleTagChange = (field: keyof PreferenceFormState, values: string[]) => {
    setForm((prev) => ({
      ...prev,
      [field]: values,
    }));
  };

  const savePreferences = useMutation({
    mutationFn: async () => {
      const filters = {
        remote_only: form.remoteOnly,
        min_match_score: form.minMatchScore,
        status: smartSearch?.filters?.status || "all",
        skill_filter: smartSearch?.filters?.skill_filter || null,
        preferred_locations: form.locations,
        preferred_titles: form.titles,
        preferred_companies: form.preferredCompanies,
        avoid_companies: form.avoidCompanies,
        required_skills: form.requiredSkills,
        preferred_skills: form.preferredSkills,
        min_salary: form.minSalary ? parseInt(form.minSalary, 10) || null : null,
        job_types: form.jobTypes,
        industries: form.industries,
        must_have_benefits: form.benefits,
        company_size: form.companySize,
      };

      if (smartSearch?.id) {
        return savedSearchApi.update({
          ...smartSearch,
          query: form.query,
          sources: form.sources,
          filters,
          alert_frequency: form.alertFrequency,
          min_match_score: form.minMatchScore,
          enabled: true,
        });
      }

      return savedSearchApi.create({
        name: "Smart Filter",
        query: form.query,
        sources: form.sources,
        filters,
        alert_frequency: form.alertFrequency,
        min_match_score: form.minMatchScore,
        enabled: true,
      });
    },
    onSuccess: () => {
      toast({ title: "Preferences saved", description: "Smart filter updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to save preferences",
        description: (error instanceof Error ? error.message : String(error)) || "Try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const handleRunSmartFilter = async () => {
    if (!smartSearch?.id) {
      toast({
        title: "No saved filter found",
        description: "Save your preferences first before running the filter.",
      });
      return;
    }

    try {
      setRunLoading(true);
      const jobs = await savedSearchApi.run(smartSearch.id);
      toast({
        title: "Smart filter executed",
        description: `Found ${jobs.length} matching job${jobs.length === 1 ? "" : "s"}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch (error: unknown) {
      toast({
        title: "Failed to run filter",
        description: (error instanceof Error ? error.message : String(error)) || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setRunLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Smart Job Preferences</CardTitle>
        <CardDescription>
          Answer a few prompts and we’ll automatically filter jobs and saved searches to match your ideal role.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading existing preferences...
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smart-query">Role / Keyword Focus</Label>
                <Input
                  id="smart-query"
                  value={form.query}
                  onChange={(e) => setForm((prev) => ({ ...prev, query: e.target.value }))}
                  placeholder="e.g. Staff React Engineer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smart-salary">Minimum Salary (USD)</Label>
                <Input
                  id="smart-salary"
                  type="number"
                  min="0"
                  value={form.minSalary}
                  onChange={(e) => setForm((prev) => ({ ...prev, minSalary: e.target.value }))}
                  placeholder="120000"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Sources</Label>
                <div className="flex flex-wrap gap-2">
                  {sourceOptions.map((source) => (
                    <Button
                      key={source.id}
                      type="button"
                      variant={form.sources.includes(source.id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateArrayField("sources", source.id)}
                    >
                      {source.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Alert Frequency</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.alertFrequency}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, alertFrequency: e.target.value as AlertFrequency }))
                  }
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="never">Never</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Match Requirements</Label>
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Remote only</p>
                      <p className="text-xs text-muted-foreground">
                        Filter out onsite roles automatically.
                      </p>
                    </div>
                    <Switch
                      checked={form.remoteOnly}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({ ...prev, remoteOnly: checked }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="smart-min-match" className="text-sm">
                      Minimum match score
                    </Label>
                    <Input
                      id="smart-min-match"
                      type="number"
                      min="0"
                      max="100"
                      value={form.minMatchScore}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          minMatchScore: parseInt(e.target.value) || prev.minMatchScore,
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Jobs below this score will be hidden from the smart feed.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smart-company-size">Preferred company size</Label>
                <select
                  id="smart-company-size"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.companySize || ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, companySize: e.target.value || null }))
                  }
                >
                  <option value="">No preference</option>
                  {companySizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <TagInput
                  label="Preferred locations"
                  values={form.locations}
                  placeholder="Add city or region"
                  onChange={(values) => handleTagChange("locations", values)}
                />
                <TagInput
                  label="Target job titles"
                  values={form.titles}
                  placeholder="Add role (e.g. 'Senior React Engineer')"
                  onChange={(values) => handleTagChange("titles", values)}
                />
                <TagInput
                  label="Required skills"
                  values={form.requiredSkills}
                  placeholder="Add required skill"
                  onChange={(values) => handleTagChange("requiredSkills", values)}
                />
                <TagInput
                  label="Nice-to-have skills"
                  values={form.preferredSkills}
                  placeholder="Add nice-to-have skill"
                  onChange={(values) => handleTagChange("preferredSkills", values)}
                />
              </div>
              <div className="space-y-4">
                <TagInput
                  label="Preferred companies"
                  values={form.preferredCompanies}
                  placeholder="Add company name"
                  onChange={(values) => handleTagChange("preferredCompanies", values)}
                />
                <TagInput
                  label="Avoid companies"
                  values={form.avoidCompanies}
                  placeholder="Add company to avoid"
                  onChange={(values) => handleTagChange("avoidCompanies", values)}
                />
                <TagInput
                  label="Industries"
                  values={form.industries}
                  placeholder="Add industry (e.g. fintech, AI safety)"
                  onChange={(values) => handleTagChange("industries", values)}
                />
                <TagInput
                  label="Must-have benefits"
                  values={form.benefits}
                  placeholder="Add benefit (e.g. visa sponsorship)"
                  onChange={(values) => handleTagChange("benefits", values)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Ideal working style</Label>
              <div className="flex flex-wrap gap-2">
                {jobTypeOptions.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={form.jobTypes.includes(type) ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateArrayField("jobTypes", type)}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => savePreferences.mutate()}
                disabled={savePreferences.isPending}
                className="gap-2"
              >
                {savePreferences.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Save className="h-4 w-4" />
                {smartSearch ? "Update Preferences" : "Save Preferences"}
              </Button>
              <Button
                variant="secondary"
                onClick={handleRunSmartFilter}
                disabled={runLoading}
                className="gap-2"
              >
                {runLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Run Smart Filter
              </Button>
              {smartSearch && smartSearch.last_run_at && (
                <Badge variant="outline" className="text-xs">
                  Last run {new Date(smartSearch.last_run_at).toLocaleString()}
                </Badge>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TagInput({
  label,
  values,
  placeholder,
  onChange,
}: {
  label: string;
  values: string[];
  placeholder?: string;
  onChange: (values: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const addValue = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (!values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInputValue("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addValue();
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <Badge key={value} variant="outline" className="flex items-center gap-1">
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              className="ml-1 text-xs text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
    </div>
  );
}
function SchedulerSettings() {
  const [enabled, setEnabled] = useState(false)
  const [schedule, setSchedule] = useState("0 9 * * *")
  const [query, setQuery] = useState("developer")
  const [sources, setSources] = useState<string[]>([])
  const [minMatchScore, setMinMatchScore] = useState("60")
  const [sendNotifications, setSendNotifications] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null)

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["scheduler-status"],
    queryFn: () => schedulerApi.getStatus(),
    refetchInterval: 5000,
  })

  const { data: savedSearchesStatus } = useQuery({
    queryKey: ["saved-searches-status"],
    queryFn: () => savedSearchApi.getStatus(),
    refetchInterval: 10000,
  })

  useEffect(() => {
    const savedConfig = localStorage.getItem("schedulerConfig")
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig) as SchedulerConfig
        setEnabled(config.enabled)
        setSchedule(config.schedule)
        setQuery(config.query)
        setSources(config.sources || [])
        setMinMatchScore(config.min_match_score?.toString() || "60")
        setSendNotifications(config.send_notifications)
      } catch (e) {
        console.error("Failed to load scheduler config:", e)
      }
    }
  }, [])

  useEffect(() => {
    if (status) {
      setIsRunning(status.running)
      setEnabled(status.enabled)
      setSchedule(status.schedule)
      setQuery(status.query)
      setSources(status.sources || [])
      setMinMatchScore(status.min_match_score?.toString() || "60")
      setSendNotifications(status.send_notifications)
    }
  }, [status])

  const saveSchedulerConfig = async () => {
    setIsLoading(true)
    setMessage(null)
    try {
      const config: SchedulerConfig = {
        enabled,
        schedule,
        query,
        sources: sources || [],
        min_match_score: parseFloat(minMatchScore) || null,
        send_notifications: sendNotifications,
      }
      localStorage.setItem("schedulerConfig", JSON.stringify(config))
      await schedulerApi.updateConfig(config)
      await refetchStatus()
      setMessage({ type: "success", text: "Scheduler configuration saved successfully" })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: unknown) {
      setMessage({ type: "error", text: (error instanceof Error ? error.message : String(error)) || "Failed to save scheduler configuration" })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStart = async () => {
    setIsLoading(true)
    setMessage(null)
    try {
      await schedulerApi.start()
      await refetchStatus()
      setMessage({ type: "success", text: "Scheduler started successfully" })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: unknown) {
      setMessage({ type: "error", text: (error instanceof Error ? error.message : String(error)) || "Failed to start scheduler" })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = async () => {
    setIsLoading(true)
    setMessage(null)
    try {
      await schedulerApi.stop()
      await refetchStatus()
      setMessage({ type: "success", text: "Scheduler stopped successfully" })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: unknown) {
      setMessage({ type: "error", text: (error instanceof Error ? error.message : String(error)) || "Failed to stop scheduler" })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSource = (src: string) => {
    setSources(prev => {
      const current = prev || [];
      return current.includes(src) ? current.filter(s => s !== src) : [...current, src];
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Automated Job Scraping</CardTitle>
          <CardDescription>
            Schedule automatic job scraping at regular intervals. Jobs will be scraped and saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Scheduler</Label>
              <p className="text-sm text-muted-foreground">
                Automatically scrape jobs on a schedule
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={isLoading}
            />
          </div>

          {status && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Clock className="h-4 w-4" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Status: {isRunning ? "Running" : "Stopped"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Schedule: {schedule} | Query: {query}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!isRunning ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStart}
                      disabled={isLoading || !enabled}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Start
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStop}
                      disabled={isLoading}
                    >
                      <Square className="mr-2 h-4 w-4" />
                      Stop
                    </Button>
                  )}
                </div>
              </div>

              {savedSearchesStatus && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                  <Search className="h-4 w-4" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Saved Searches</p>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      <span>Total: {savedSearchesStatus.total}</span>
                      <span>Enabled: {savedSearchesStatus.enabled}</span>
                      {savedSearchesStatus.due_for_run > 0 && (
                        <span className="text-amber-600 font-medium">
                          {savedSearchesStatus.due_for_run} due for run
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schedule">Schedule (Cron Expression)</Label>
              <Input
                id="schedule"
                type="text"
                placeholder="0 9 * * *"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Cron format: "minute hour day month weekday". Example: "0 9 * * *" = Daily at 9 AM
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Common schedules:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>"0 9 * * *" - Daily at 9 AM</li>
                  <li>"0 */6 * * *" - Every 6 hours</li>
                  <li>"0 */12 * * *" - Every 12 hours</li>
                  <li>"0 9 * * 1" - Every Monday at 9 AM</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduler-query">Default Search Query</Label>
              <Input
                id="scheduler-query"
                type="text"
                placeholder="developer"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Default search query to use when scraping jobs
              </p>
            </div>

            <div className="space-y-2">
              <Label>Sources</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select sources to scrape. Leave empty to scrape all sources.
              </p>
              <div className="grid gap-2 md:grid-cols-3">
                {["hhkz", "linkedin", "wellfound"].map(src => (
                  <div key={src} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`scheduler-source-${src}`}
                      checked={(sources || []).includes(src)}
                      onChange={() => toggleSource(src)}
                      disabled={isLoading}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={`scheduler-source-${src}`} className="capitalize cursor-pointer">
                      {src}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduler-min-match">Minimum Match Score</Label>
              <Input
                id="scheduler-min-match"
                type="number"
                min="0"
                max="100"
                placeholder="60"
                value={minMatchScore}
                onChange={(e) => setMinMatchScore(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Only notify for jobs with match score &gt;= this value (0-100). Leave empty for no minimum.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Send Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Send email notifications when new jobs are found
                </p>
              </div>
              <Switch
                checked={sendNotifications}
                onCheckedChange={setSendNotifications}
                disabled={isLoading}
              />
            </div>
          </div>

          {message && (
            <Alert variant={message.type === "error" ? "destructive" : "default"}>
              {message.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => refetchStatus()}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh Status
            </Button>
            <Button
              onClick={saveSchedulerConfig}
              disabled={isLoading}
            >
              <Save className="mr-2 h-4 w-4" />
              {isLoading ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
