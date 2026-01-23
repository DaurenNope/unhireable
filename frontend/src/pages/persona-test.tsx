import { useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, User, Play, CheckCircle2, XCircle } from 'lucide-react';

export function PersonaTest() {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [personas, setPersonas] = useState<Array<{ slug: string; display_name: string; description: string; target_role: string }>>([]);
  const [activationResult, setActivationResult] = useState<unknown>(null);
  const [dryRunResult, setDryRunResult] = useState<unknown>(null);

  const loadPersonas = async () => {
    setLoading('catalog');
    try {
      const result = await api.persona.listCatalog();
      setPersonas(result);
      toast({
        title: 'Personas loaded',
        description: `Found ${result.length} persona(s)`,
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: (error instanceof Error ? error.message : String(error)) || 'Failed to load personas',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const loadPersona = async (slug: string = 'atlas') => {
    setLoading(`load-${slug}`);
    try {
      const result = await api.persona.loadTestPersona(slug);
      setActivationResult(result);
      const displayName = typeof result === 'object' && result !== null && 'display_name' in result
        ? String((result as { display_name?: unknown }).display_name ?? '')
        : 'Persona';
      toast({
        title: 'Persona loaded',
        description: `${displayName} profile and preferences installed`,
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: (error instanceof Error ? error.message : String(error)) || 'Failed to load persona',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  const runDryRun = async (slug: string = 'atlas', autoSubmit: boolean = true) => {
    setLoading(`dryrun-${slug}`);
    try {
      const result = await api.persona.dryRun(slug, autoSubmit);
      setDryRunResult(result);
      const success = typeof result === 'object' && result !== null && 'success' in result
        ? Boolean((result as { success?: unknown }).success)
        : false;
      const message = typeof result === 'object' && result !== null && 'message' in result
        ? String((result as { message?: unknown }).message ?? '')
        : 'Dry-run completed';
      toast({
        title: success ? 'Dry-run successful' : 'Dry-run completed',
        description: message,
        variant: success ? 'default' : 'destructive',
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: (error instanceof Error ? error.message : String(error)) || 'Failed to run dry-run',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Persona Testing</h1>
        <p className="text-muted-foreground mt-2">
          Load test personas and run automated application dry-runs
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Persona Catalog */}
        <Card>
          <CardHeader>
            <CardTitle>Available Personas</CardTitle>
            <CardDescription>List and load test personas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={loadPersonas}
              disabled={loading === 'catalog'}
              className="w-full"
            >
              {loading === 'catalog' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <User className="mr-2 h-4 w-4" />
                  List Personas
                </>
              )}
            </Button>

            {personas.length > 0 && (
              <div className="space-y-2">
                {personas.map((persona) => (
                  <div
                    key={persona.slug}
                    className="p-3 border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{persona.display_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {persona.target_role}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadPersona(persona.slug)}
                        disabled={loading?.startsWith('load-')}
                      >
                        {loading === `load-${persona.slug}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Load'
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {persona.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activation Result */}
        {activationResult && typeof activationResult === 'object' && activationResult !== null && 'display_name' in activationResult && (
          <Card>
            <CardHeader>
              <CardTitle>Persona Activated</CardTitle>
              <CardDescription>{String((activationResult as { display_name?: unknown }).display_name)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Resume:</span>{' '}
                <span className="text-muted-foreground">
                  {String((activationResult as { resume_path?: unknown }).resume_path ?? '')}
                </span>
              </div>
              <div>
                <span className="font-medium">Cover Letter:</span>{' '}
                <span className="text-muted-foreground">
                  {String((activationResult as { cover_letter_path?: unknown }).cover_letter_path ?? '')}
                </span>
              </div>
              <div>
                <span className="font-medium">Saved Search:</span>{' '}
                <span className="text-muted-foreground">
                  {String((activationResult as { saved_search_name?: unknown }).saved_search_name ?? '')} (ID: {String((activationResult as { saved_search_id?: unknown }).saved_search_id ?? '')})
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dry Run */}
        <Card>
          <CardHeader>
            <CardTitle>Dry Run Test</CardTitle>
            <CardDescription>Test automated application flow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={() => runDryRun('atlas', true)}
                disabled={loading?.startsWith('dryrun-')}
                className="flex-1"
              >
                {loading === 'dryrun-atlas' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Dry-Run (Auto-Submit)
                  </>
                )}
              </Button>
              <Button
                onClick={() => runDryRun('atlas', false)}
                disabled={loading?.startsWith('dryrun-')}
                variant="outline"
                className="flex-1"
              >
                {loading === 'dryrun-atlas' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Dry-Run (Manual)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Dry Run Result */}
        {dryRunResult && typeof dryRunResult === 'object' && dryRunResult !== null && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {(dryRunResult as { success?: boolean }).success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Dry-Run Result
              </CardTitle>
              <CardDescription>{String((dryRunResult as { job_title?: unknown }).job_title ?? '')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Status:</span>{' '}
                <span className={(dryRunResult as { success?: boolean }).success ? 'text-green-600' : 'text-red-600'}>
                  {(dryRunResult as { success?: boolean }).success ? 'Success' : 'Failed'}
                </span>
              </div>
              <div>
                <span className="font-medium">Message:</span>{' '}
                <span className="text-muted-foreground">{String((dryRunResult as { message?: unknown }).message ?? '')}</span>
              </div>
              <div>
                <span className="font-medium">Test Endpoint:</span>{' '}
                <a
                  href={String((dryRunResult as { test_endpoint?: unknown }).test_endpoint ?? '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {String((dryRunResult as { test_endpoint?: unknown }).test_endpoint ?? '')}
                </a>
              </div>
              <div>
                <span className="font-medium">Job ID:</span>{' '}
                <span className="text-muted-foreground">{String((dryRunResult as { job_id?: unknown }).job_id ?? '')}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

