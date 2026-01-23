import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Sparkles, Loader2, AlertCircle, FileText, Eye, Package } from 'lucide-react';
import { generatorApi } from '@/api/client';
import type { UserProfile, GeneratedDocument, Job } from '@/types/models';
import { useQuery } from '@tanstack/react-query';

interface DocumentGeneratorProps {
  job: Job;
  userProfile: UserProfile;
  onDocumentGenerated?: (document: GeneratedDocument) => void;
}

export function DocumentGenerator({ job, userProfile, onDocumentGenerated }: DocumentGeneratorProps) {
  const [documentType, setDocumentType] = useState<'resume' | 'cover_letter' | 'email'>('cover_letter');
  const [template, setTemplate] = useState<string>('');
  const [improveWithAI, setImproveWithAI] = useState(false);
  const [generatedDocument, setGeneratedDocument] = useState<GeneratedDocument | null>(null);
  const [previewDocument, setPreviewDocument] = useState<GeneratedDocument | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: resumeTemplates = [] } = useQuery({
    queryKey: ['resume-templates'],
    queryFn: () => generatorApi.getResumeTemplates(),
  });

  const { data: coverLetterTemplates = [] } = useQuery({
    queryKey: ['cover-letter-templates'],
    queryFn: () => generatorApi.getCoverLetterTemplates(),
  });

  const templates = documentType === 'resume' ? resumeTemplates : coverLetterTemplates;

  // Auto-select first template when templates are loaded or document type changes
  useEffect(() => {
    if (templates.length > 0 && templates[0]) {
      setTemplate(templates[0]);
    } else {
      setTemplate('');
    }
  }, [templates]);

  const handleGenerate = async () => {
    if (!template && templates.length > 0) {
      setError('Please select a template');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedDocument(null);

    try {
      let document: GeneratedDocument;
      const templateName = template || templates[0] || undefined;

      switch (documentType) {
        case 'resume':
          document = await generatorApi.generateResume(userProfile, job.id!, templateName, improveWithAI);
          break;
        case 'cover_letter':
          document = await generatorApi.generateCoverLetter(userProfile, job.id!, templateName, improveWithAI);
          break;
        case 'email':
          document = await generatorApi.generateEmailVersion(userProfile, job.id!, templateName, improveWithAI);
          break;
        default:
          throw new Error('Invalid document type');
      }

      setGeneratedDocument(document);
      onDocumentGenerated?.(document);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate document';
      setError(message);
      console.error('Document generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    if (!generatedDocument) return;

    try {
      // Generate a default filename
      const sanitizedTitle = job.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${sanitizedTitle}_${documentType}.pdf`;
      
      const filePath = await generatorApi.exportToPDF(generatedDocument, filename);
      alert(`✅ PDF exported successfully!\n\nSaved to: ${filePath}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Export error:', err);
      alert(`Failed to export PDF: ${message}\n\nCheck the console for details.`);
    }
  };

  const handleExportDOCX = async () => {
    if (!generatedDocument) return;

    try {
      // Generate a default filename
      const sanitizedTitle = job.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${sanitizedTitle}_${documentType}.docx`;
      
      const filePath = await generatorApi.exportToDOCX(generatedDocument, filename);
      alert(`✅ DOCX exported successfully!\n\nSaved to: ${filePath}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Export error:', err);
      alert(`Failed to export DOCX: ${message}\n\nCheck the console for details.`);
    }
  };

  const handlePreviewTemplate = async () => {
    if (!template) {
      setError('Please select a template');
      return;
    }

    setIsPreviewing(true);
    setError(null);
    setPreviewDocument(null);

    try {
      let preview: GeneratedDocument;
      if (documentType === 'resume') {
        preview = await generatorApi.previewResumeTemplate(template);
      } else {
        preview = await generatorApi.previewCoverLetterTemplate(template);
      }
      setPreviewDocument(preview);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to preview template';
      setError(message);
      console.error('Preview error:', err);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleBulkExport = async (format: 'pdf' | 'docx') => {
    if (!generatedDocument) {
      alert('Please generate a document first');
      return;
    }

    try {
      const exportedPaths = await generatorApi.bulkExport([generatedDocument], format);
      alert(`✅ ${format.toUpperCase()} exported successfully!\n\nSaved to: ${exportedPaths[0]}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Bulk export error:', err);
      alert(`Failed to export: ${message}`);
    }
  };

  const renderPreview = () => {
    if (!generatedDocument) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Preview</h3>
            <p className="text-sm text-muted-foreground">
              Template: {generatedDocument.metadata.template_used} • 
              Words: {generatedDocument.metadata.word_count}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button onClick={handleExportDOCX} variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Export DOCX
            </Button>
            <Button onClick={() => handleBulkExport('pdf')} variant="outline" size="icon" title="Bulk export PDF">
              <Package className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="border rounded-lg p-6 bg-white dark:bg-gray-900 max-h-[600px] overflow-auto">
          {generatedDocument.format === 'HTML' ? (
            <div dangerouslySetInnerHTML={{ __html: generatedDocument.content }} />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm">
              {generatedDocument.content}
            </pre>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Documents</CardTitle>
        <CardDescription>
          Create tailored resume, cover letter, or email for this job
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          value={documentType}
          onValueChange={(value) => {
            setDocumentType(value as 'resume' | 'cover_letter' | 'email');
            setGeneratedDocument(null);
            // Template will be auto-selected by useEffect when templates load
          }}
        >
          <TabsList>
            <TabsTrigger value="resume">Resume</TabsTrigger>
            <TabsTrigger value="cover_letter">Cover Letter</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>

          <TabsContent value={documentType} className="space-y-4">
            <div className="space-y-4">
              {templates.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="template">Template</Label>
                  <div className="flex gap-2">
                    <Select value={template || templates[0] || ''} onValueChange={(value) => {
                      setTemplate(value);
                      setPreviewDocument(null); // Clear preview when template changes
                    }}>
                      <SelectTrigger id="template" className="flex-1">
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((tpl) => (
                          <SelectItem key={tpl} value={tpl}>
                            {tpl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handlePreviewTemplate}
                      disabled={isPreviewing || !template}
                      variant="outline"
                      size="icon"
                      title="Preview template"
                    >
                      {isPreviewing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-4 border rounded-lg">
                  Loading available templates...
                </div>
              )}

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="ai-improve">Improve with AI</Label>
                  <p className="text-sm text-muted-foreground">
                    Use AI to enhance and tailor the content
                  </p>
                </div>
                <Switch
                  id="ai-improve"
                  checked={improveWithAI}
                  onCheckedChange={setImproveWithAI}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || templates.length === 0}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate {documentType === 'resume' ? 'Resume' : documentType === 'cover_letter' ? 'Cover Letter' : 'Email'}
                  </>
                )}
              </Button>

              {previewDocument && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Template Preview</h3>
                      <p className="text-sm text-muted-foreground">
                        Template: {previewDocument.metadata.template_used} • 
                        Words: {previewDocument.metadata.word_count}
                      </p>
                    </div>
                    <Button
                      onClick={() => setPreviewDocument(null)}
                      variant="ghost"
                      size="sm"
                    >
                      Close Preview
                    </Button>
                  </div>
                  <div className="border rounded-lg p-6 bg-white dark:bg-gray-900 max-h-[400px] overflow-auto">
                    {previewDocument.format === 'HTML' ? (
                      <div dangerouslySetInnerHTML={{ __html: previewDocument.content }} />
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans text-sm">
                        {previewDocument.content}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {generatedDocument && renderPreview()}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

