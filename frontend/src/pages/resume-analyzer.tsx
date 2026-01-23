import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { resumeAnalyzerApi, type ResumeJobTarget } from '@/api/client';
import type {
  HrSignalStatus,
  ResumeAnalysis,
  ResumeEnvironmentStatus,
} from '@/types/models';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  FileText,
  User,
  Briefcase,
  GraduationCap,
  Code,
  Lightbulb,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';

type TauriDialog = {
  open: (options: {
    multiple?: boolean;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<string | string[] | null>;
};

type TauriWindow = Window & {
  __TAURI__?: {
    dialog?: TauriDialog;
  };
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

const formSchema = z.object({
  pdfPath: z.string().trim().min(1, 'PDF path is required'),
  jobTitle: z.string().max(120, 'Job title is too long').optional(),
  jobDescription: z.string().max(5000, 'Job description is too long').optional(),
});

type AnalyzerFormValues = z.infer<typeof formSchema>;

export function ResumeAnalyzer() {
  const form = useForm<AnalyzerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pdfPath: '',
      jobTitle: '',
      jobDescription: '',
    },
  });
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const { errors } = form.formState;
  const noTextExtracted = analysis ? analysis.raw_text.trim().length === 0 : false;
  const atsBreakdown = analysis?.insights?.ats_breakdown ?? [];
  const hrSignals = analysis?.insights?.hr_signals ?? [];
  const keywordGaps = analysis?.insights?.keyword_gaps ?? [];
  const jobAlignment = analysis?.insights?.job_alignment;
  const pdfPathValue = form.watch('pdfPath') || '';

  const {
    data: dependencyStatus,
    isLoading: dependencyLoading,
    refetch: refetchDependencies,
  } = useQuery<ResumeEnvironmentStatus>({
    queryKey: ['resume-env-status'],
    queryFn: () => resumeAnalyzerApi.environmentStatus(),
    staleTime: 5 * 60 * 1000,
  });

  const dependencyChecks = [
    {
      key: 'pdftotext',
      label: 'Poppler (pdftotext)',
      description: 'Text extraction fallback',
      available: dependencyStatus?.pdftotext_available ?? null,
    },
    {
      key: 'pdftoppm',
      label: 'Poppler (pdftoppm)',
      description: 'Page rendering for OCR',
      available: dependencyStatus?.pdftoppm_available ?? null,
    },
    {
      key: 'tesseract',
      label: 'Tesseract OCR',
      description: 'Scanned PDF support',
      available: dependencyStatus?.tesseract_available ?? null,
    },
  ];

  const missingDependencies = dependencyChecks.filter((dep) => dep.available === false);

  const signalBadgeClasses: Record<HrSignalStatus, string> = {
    positive: 'bg-green-50 text-green-700 border border-green-100',
    warning: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
    critical: 'bg-red-50 text-red-700 border border-red-100',
  };

  const formatPercent = (value?: number | null, decimals = 0) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return 'N/A';
    }
    return `${(value * 100).toFixed(decimals)}%`;
  };

  const analyzeMutation = useMutation({
    mutationFn: (payload: { pdfPath: string; jobTarget?: ResumeJobTarget }) =>
      resumeAnalyzerApi.analyze(payload.pdfPath, payload.jobTarget),
    onSuccess: (data) => {
      setAnalysis(data);
      toast({
        title: 'Resume analyzed successfully',
        description: 'Your resume has been analyzed and insights are ready.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Analysis failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const handleAnalyze = form.handleSubmit((values) => {
    const trimmedPath = values.pdfPath.trim();
    const title = values.jobTitle?.trim() ?? '';
    const description = values.jobDescription?.trim() ?? '';
    const hasJobContext = title.length > 0 || description.length > 0;
    const jobTarget = hasJobContext
      ? {
          title: title || undefined,
          description: description || undefined,
        }
      : undefined;

    analyzeMutation.mutate({
      pdfPath: trimmedPath,
      jobTarget,
    });
  });

  const handleSelectFile = async () => {
    try {
      if (typeof window === 'undefined') {
        toast({
          title: 'File dialog unavailable',
          description: 'Please enter the file path manually when running outside the Tauri shell.',
          variant: 'destructive',
        });
        return;
      }

      const tauriDialog = (window as TauriWindow).__TAURI__?.dialog;
      if (!tauriDialog?.open) {
        toast({
          title: 'File dialog unavailable',
          description: 'Tauri dialog API is not accessible. Please enter the file path manually.',
          variant: 'destructive',
        });
        return;
      }

      const selected = await tauriDialog.open({
        multiple: false,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      const picked =
        typeof selected === 'string'
          ? selected
          : Array.isArray(selected) && selected.length > 0
          ? selected[0]
          : null;

      if (picked) {
        form.setValue('pdfPath', picked, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
      }
    } catch (error: unknown) {
      toast({
        title: 'Failed to open file dialog',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Resume Analyzer</h1>
          <p className="text-muted-foreground mt-2">
            Upload and analyze your resume to get insights and recommendations
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Resume</CardTitle>
          <CardDescription>
            Enter the path to your PDF resume file to analyze it
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAnalyze} className="space-y-3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  type="text"
                  placeholder="/path/to/resume.pdf"
                  className="flex-1 px-3 py-2 border rounded-md"
                  aria-invalid={errors.pdfPath ? 'true' : 'false'}
                  {...form.register('pdfPath')}
                />
                <div className="flex gap-2">
                  <Button onClick={handleSelectFile} variant="outline" type="button">
                    <Upload className="h-4 w-4 mr-2" />
                    Select File
                  </Button>
                  <Button type="submit" disabled={analyzeMutation.isPending || !pdfPathValue.trim()}>
                    {analyzeMutation.isPending ? 'Analyzing...' : 'Analyze Resume'}
                  </Button>
                </div>
              </div>
              {errors.pdfPath && (
                <p className="text-sm text-destructive">{errors.pdfPath.message}</p>
              )}
            </div>
            {pdfPathValue && (
              <p className="text-sm text-muted-foreground">
                Current path: <code className="bg-muted px-1 rounded">{pdfPathValue}</code>
              </p>
            )}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Target Job (optional)</CardTitle>
          <CardDescription>Paste the job title and description you want to tailor this resume toward.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="text"
            placeholder="e.g., Senior Platform Engineer at AstroCorp"
            className="w-full px-3 py-2 border rounded-md"
            aria-invalid={errors.jobTitle ? 'true' : 'false'}
            {...form.register('jobTitle')}
          />
          {errors.jobTitle && (
            <p className="text-sm text-destructive">{errors.jobTitle.message}</p>
          )}
          <textarea
            placeholder="Paste the job description here to get exact keyword gaps..."
            rows={6}
            className="w-full px-3 py-2 border rounded-md"
            aria-invalid={errors.jobDescription ? 'true' : 'false'}
            {...form.register('jobDescription')}
          />
          {errors.jobDescription && (
            <p className="text-sm text-destructive">{errors.jobDescription.message}</p>
          )}
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Tip: For scanned/image-based PDFs you&apos;ll need OCR helpers installed. The checker below
        keeps tabs on Tesseract and Poppler so you know when fallbacks are ready.
      </p>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Local prerequisites</CardTitle>
          <CardDescription>We look for Poppler utilities and Tesseract automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {dependencyChecks.map((dep) => (
              <div
                key={dep.key}
                className="rounded-xl border bg-muted/30 p-3"
                aria-live="polite"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{dep.label}</p>
                  <Badge
                    className={
                      dep.available === null
                        ? 'bg-muted text-muted-foreground'
                        : dep.available
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }
                  >
                    {dep.available === null
                      ? 'Checking'
                      : dep.available
                      ? 'Ready'
                      : 'Missing'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{dep.description}</p>
              </div>
            ))}
          </div>
          {missingDependencies.length > 0 && (
            <Alert variant="warning">
              <AlertTitle>Install dependencies</AlertTitle>
              <AlertDescription>
                Run <code className="bg-muted px-1 rounded">brew install poppler tesseract</code> (or
                use your package manager) to unlock OCR fallbacks.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => refetchDependencies()}
              disabled={dependencyLoading}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${dependencyLoading ? 'animate-spin text-muted-foreground' : 'text-muted-foreground'}`}
              />
              {dependencyLoading ? 'Re-checking...' : 'Re-check'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <Tabs defaultValue="overview" className="space-y-4">
          {noTextExtracted && (
            <Alert variant="warning">
              <AlertTitle>No text detected</AlertTitle>
              <AlertDescription>
                We couldn&apos;t extract text from this PDF. Make sure the file contains selectable text or install the
                OCR prerequisites (Tesseract + Poppler) and try again.
              </AlertDescription>
            </Alert>
          )}
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="personal">Personal Info</TabsTrigger>
            <TabsTrigger value="experience">Experience</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">ATS Score</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analysis.insights.ats_score?.toFixed(0) ?? 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">out of 100</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Experience</CardTitle>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analysis.insights.total_years_experience?.toFixed(1) ?? 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">years</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Skills</CardTitle>
                  <Code className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analysis.skills.length}</div>
                  <p className="text-xs text-muted-foreground">identified</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Positions</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analysis.experience.length}</div>
                  <p className="text-xs text-muted-foreground">work experiences</p>
                </CardContent>
              </Card>
            </div>

            {analysis.summary && (
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{analysis.summary}</p>
                </CardContent>
              </Card>
            )}

          {atsBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>ATS Systems</CardTitle>
                <CardDescription>How major ATS engines are expected to score this resume.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {atsBreakdown.map((ats) => (
                  <div key={ats.system} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{ats.system}</span>
                      <span>{ats.score.toFixed(0)} / 100</span>
                    </div>
                    <Progress value={ats.score} />
                    <p className="text-xs text-muted-foreground">{ats.verdict}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          </TabsContent>

          <TabsContent value="personal" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysis.personal_info.name && (
                  <div>
                    <span className="font-medium">Name: </span>
                    <span>{analysis.personal_info.name}</span>
                  </div>
                )}
                {analysis.personal_info.email && (
                  <div>
                    <span className="font-medium">Email: </span>
                    <span>{analysis.personal_info.email}</span>
                  </div>
                )}
                {analysis.personal_info.phone && (
                  <div>
                    <span className="font-medium">Phone: </span>
                    <span>{analysis.personal_info.phone}</span>
                  </div>
                )}
                {analysis.personal_info.location && (
                  <div>
                    <span className="font-medium">Location: </span>
                    <span>{analysis.personal_info.location}</span>
                  </div>
                )}
                {analysis.personal_info.linkedin && (
                  <div>
                    <span className="font-medium">LinkedIn: </span>
                    <a href={analysis.personal_info.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {analysis.personal_info.linkedin}
                    </a>
                  </div>
                )}
                {analysis.personal_info.github && (
                  <div>
                    <span className="font-medium">GitHub: </span>
                    <a href={analysis.personal_info.github} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {analysis.personal_info.github}
                    </a>
                  </div>
                )}
                {analysis.personal_info.portfolio && (
                  <div>
                    <span className="font-medium">Portfolio: </span>
                    <a href={analysis.personal_info.portfolio} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {analysis.personal_info.portfolio}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="experience" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Work Experience
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {analysis.experience.map((exp, idx) => (
                  <div key={idx} className="border-l-2 pl-4 space-y-2">
                    {exp.position && (
                      <h3 className="font-semibold text-lg">{exp.position}</h3>
                    )}
                    {exp.company && (
                      <p className="text-muted-foreground">{exp.company}</p>
                    )}
                    {exp.duration && (
                      <p className="text-sm text-muted-foreground">{exp.duration}</p>
                    )}
                    {exp.description.length > 0 && (
                      <ul className="list-disc list-inside space-y-1">
                        {exp.description.map((desc, i) => (
                          <li key={i} className="text-sm">{desc}</li>
                        ))}
                      </ul>
                    )}
                    {exp.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {exp.technologies.map((tech, i) => (
                          <Badge key={i} variant="secondary">{tech}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {analysis.education.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    Education
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysis.education.map((edu, idx) => (
                    <div key={idx} className="space-y-1">
                      {edu.degree && (
                        <h3 className="font-semibold">{edu.degree}</h3>
                      )}
                      {edu.institution && (
                        <p className="text-muted-foreground">{edu.institution}</p>
                      )}
                      {edu.year && (
                        <p className="text-sm text-muted-foreground">{edu.year}</p>
                      )}
                      {edu.details && (
                        <p className="text-sm">{edu.details}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="skills" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.skills.map((skill, idx) => (
                    <Badge key={idx} variant="default">{skill}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {analysis.insights.skill_categories.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Skill Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {analysis.insights.skill_categories.map((cat, idx) => (
                      <Badge key={idx} variant="outline">{cat}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {analysis.projects.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Projects</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysis.projects.map((project, idx) => (
                    <p key={idx} className="text-sm">{project}</p>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            {analysis.insights.strengths.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.insights.strengths.map((strength, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {analysis.insights.recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.insights.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Primary Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.insights.primary_skills.map((skill, idx) => (
                    <Badge key={idx} variant="default">{skill}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {atsBreakdown.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>ATS Emulator</CardTitle>
                  <CardDescription>How popular ATS engines would parse this resume.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {atsBreakdown.map((ats, idx) => (
                    <div key={ats.system} className={idx < atsBreakdown.length - 1 ? 'pb-4 border-b' : ''}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{ats.system}</p>
                          <p className="text-sm text-muted-foreground">{ats.verdict}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{ats.score.toFixed(0)}</p>
                          <p className="text-xs text-muted-foreground">out of 100</p>
                        </div>
                      </div>
                      {ats.highlights.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-medium text-green-600">Highlights</p>
                          <ul className="text-sm space-y-1">
                            {ats.highlights.map((msg, msgIdx) => (
                              <li key={msgIdx} className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                                <span>{msg}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {ats.risks.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-medium text-red-600">Risks</p>
                          <ul className="text-sm space-y-1">
                            {ats.risks.map((msg, msgIdx) => (
                              <li key={msgIdx} className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                                <span>{msg}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {hrSignals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>HR Reviewer Signals</CardTitle>
                  <CardDescription>Quick checks recruiters run before forwarding a candidate.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hrSignals.map((signal, idx) => (
                    <div key={idx} className="space-y-1">
                      <Badge className={signalBadgeClasses[signal.status]}>
                        {signal.label}
                      </Badge>
                      <p className="text-sm">{signal.detail}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {keywordGaps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Keyword Opportunities</CardTitle>
                  <CardDescription>High-leverage phrases to mirror from job descriptions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {keywordGaps.map((gap, idx) => (
                    <div key={idx} className="space-y-2">
                      <p className="font-medium">{gap.category}</p>
                      <div className="flex flex-wrap gap-2">
                        {gap.missing.map((keyword) => (
                          <Badge key={keyword} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {jobAlignment && (
              <Card>
                <CardHeader>
                  <CardTitle>Role Alignment</CardTitle>
                  <CardDescription>Where this resume currently shines and what to add next.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs uppercase text-muted-foreground">Target role</p>
                    <p className="text-lg font-semibold">
                      {jobAlignment.dominant_role ?? 'Generalist Software Engineer'}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground mb-2">Role confidence</p>
                      <Progress value={(jobAlignment.role_confidence ?? 0) * 100} />
                      <p className="text-sm mt-1">{formatPercent(jobAlignment.role_confidence, 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground mb-2">Keyword coverage</p>
                      <Progress value={(jobAlignment.keyword_match ?? 0) * 100} />
                      <p className="text-sm mt-1">{formatPercent(jobAlignment.keyword_match, 0)}</p>
                    </div>
                  </div>
                  {jobAlignment.matched_keywords.length > 0 && (
                    <div>
                      <p className="text-xs uppercase text-muted-foreground mb-2">Matched keywords</p>
                      <div className="flex flex-wrap gap-2">
                        {jobAlignment.matched_keywords.map((kw) => (
                          <Badge key={kw} variant="secondary">{kw}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {jobAlignment.missing_keywords.length > 0 && (
                    <div>
                      <p className="text-xs uppercase text-muted-foreground mb-2">Add next</p>
                      <div className="flex flex-wrap gap-2">
                        {jobAlignment.missing_keywords.map((kw) => (
                          <Badge key={kw} variant="outline">{kw}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

