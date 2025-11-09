import { useState, useEffect } from "react"
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
import { Sun, Moon, Monitor, Key, Trash2, Plus, Save, AlertCircle, CheckCircle2, Mail, Send } from "lucide-react"
import { credentialApi, schedulerApi } from "@/api/client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { UserProfileForm } from "@/components/user-profile-form"
import type { UserProfile, SchedulerConfig } from "@/types/models"
import { invoke } from "@tauri-apps/api/core"
import { Clock, Play, Square, RefreshCw } from "lucide-react"

export function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'appearance';

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
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
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="scraper">Scraper Config</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="email">Email Notifications</TabsTrigger>
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
          <TabsTrigger value="job-prefs">Job Preferences</TabsTrigger>
        </TabsList>
        
        <TabsContent value="appearance" className="space-y-4">
          <AppearanceSettings />
        </TabsContent>
        
        <TabsContent value="profile" className="space-y-4">
          <ProfileSettings />
        </TabsContent>
        
        <TabsContent value="scraper" className="space-y-4">
          <ScraperSettings />
        </TabsContent>
        
        <TabsContent value="credentials" className="space-y-4">
          <CredentialsSettings />
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <EmailNotificationSettings />
        </TabsContent>

        <TabsContent value="scheduler" className="space-y-4">
          <SchedulerSettings />
        </TabsContent>

        <TabsContent value="job-prefs" className="space-y-4">
          <JobPreferences />
        </TabsContent>
      </Tabs>
    </div>
  )
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
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save API key' })
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
    } catch (error: any) {
      alert(`Failed to delete: ${error.message}`)
    }
  }

  const platforms = [
    { name: 'OpenAI', key: 'openai', description: 'For AI-powered document generation' },
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
      }
      localStorage.setItem('emailConfig', JSON.stringify(config))
      setMessage({ type: 'success', text: 'Email configuration saved successfully' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save email configuration' })
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
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Email connection test failed' })
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
      await invoke<string>('send_test_email', { config, to: testEmailTo })
      setMessage({ type: 'success', text: `Test email sent successfully to ${testEmailTo}!` })
      setTimeout(() => setMessage(null), 5000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to send test email' })
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    // Load profile from localStorage
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
      } catch (e) {
        console.error('Failed to parse saved profile:', e);
      }
    }
  }, []);

  const handleSave = async (newProfile: UserProfile) => {
    setIsLoading(true);
    setMessage(null);
    try {
      // Save to localStorage (in a real app, this would be saved to backend)
      localStorage.setItem('userProfile', JSON.stringify(newProfile));
      setProfile(newProfile);
      setMessage({ type: 'success', text: 'Profile saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save profile' });
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

function JobPreferences() {
  const [keywords, setKeywords] = useState<string>(() => localStorage.getItem('prefs.keywords') || '')
  const [location, setLocation] = useState<string>(() => localStorage.getItem('prefs.location') || '')
  const [sources, setSources] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('prefs.sources') || '[]') } catch { return [] }
  })
  const [isRunning, setIsRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const toggleSource = (src: string) => {
    setSources(prev => prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src])
  }

  const savePrefs = () => {
    localStorage.setItem('prefs.keywords', keywords)
    localStorage.setItem('prefs.location', location)
    localStorage.setItem('prefs.sources', JSON.stringify(sources))
    setMessage('Preferences saved')
    setTimeout(() => setMessage(null), 1500)
  }

  const runScrape = async () => {
    try {
      setIsRunning(true)
      setMessage(null)
      const { invoke } = await import("@tauri-apps/api/core")
      const q = [keywords, location].filter(Boolean).join(' ') || 'developer'
      
      if (sources.length === 0) {
        setMessage('Please select at least one source to scrape')
        setIsRunning(false)
        return
      }
      
      console.log('Starting scrape with sources:', sources, 'query:', q)
      const scrapedJobs = await invoke<number>('scrape_jobs_selected', { sources, query: q }) as any
      const jobCount = Array.isArray(scrapedJobs) ? scrapedJobs.length : 0
      
      if (jobCount > 0) {
        setMessage(`Successfully scraped ${jobCount} job(s)! Check Jobs page.`)
      } else {
        setMessage('No new jobs found. Try different keywords or check if jobs already exist.')
      }
      
      // Invalidate jobs query to refresh the jobs list
      const { useQueryClient } = await import("@tanstack/react-query")
      const queryClient = useQueryClient()
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    } catch (e: any) {
      console.error('Scrape error:', e)
      const errorMessage = e?.message || e?.toString() || 'Scrape failed'
      setMessage(`Error: ${errorMessage}`)
      alert(`Failed to scrape: ${errorMessage}`)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Search Preferences</CardTitle>
        <CardDescription>
          Configure your default job search criteria.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords</Label>
            <Input
              id="keywords"
            type="text"
            placeholder="e.g. Rust, React, TypeScript"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
        </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
            type="text"
            placeholder="e.g. Remote, Almaty"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
      </div>
        <div className="space-y-2">
          <Label>Sources</Label>
          <div className="grid gap-2 md:grid-cols-3">
          {['hhkz', 'linkedin', 'wellfound'].map(src => (
              <div key={src} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`source-${src}`}
                  checked={sources.includes(src)}
                  onChange={() => toggleSource(src)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor={`source-${src}`} className="capitalize cursor-pointer">
                  {src}
                </Label>
              </div>
          ))}
        </div>
      </div>
        <Separator />
      <div className="flex items-center gap-2">
          <Button variant="outline" onClick={savePrefs} disabled={isRunning}>
            <Save className="mr-2 h-4 w-4" />
            Save Preferences
          </Button>
          <Button onClick={runScrape} disabled={isRunning}>
            {isRunning ? 'Scraping...' : 'Scrape Now'}
          </Button>
          {message && (
            <span className="text-sm text-muted-foreground">{message}</span>
          )}
      </div>
      </CardContent>
    </Card>
  )
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

  useEffect(() => {
    const savedConfig = localStorage.getItem("schedulerConfig")
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig) as SchedulerConfig
        setEnabled(config.enabled)
        setSchedule(config.schedule)
        setQuery(config.query)
        setSources(config.sources)
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
      setSources(status.sources)
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
        sources,
        min_match_score: parseFloat(minMatchScore) || null,
        send_notifications: sendNotifications,
      }
      localStorage.setItem("schedulerConfig", JSON.stringify(config))
      await schedulerApi.updateConfig(config)
      await refetchStatus()
      setMessage({ type: "success", text: "Scheduler configuration saved successfully" })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to save scheduler configuration" })
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
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to start scheduler" })
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
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to stop scheduler" })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSource = (src: string) => {
    setSources(prev => prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src])
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
                      checked={sources.includes(src)}
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
