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
import { Sun, Moon, Monitor, Key, Trash2, Plus, Save, AlertCircle, CheckCircle2 } from "lucide-react"
import { credentialApi } from "@/api/client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { UserProfileForm } from "@/components/user-profile-form"
import type { UserProfile } from "@/types/models"

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
          Customize how JobEz looks on your device.
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
