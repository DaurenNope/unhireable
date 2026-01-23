import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Info, Lightbulb, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AtsSuggestion {
  ats_type: string | null;
  confidence: string;
  tips: string[];
  known_quirks: string[];
  automation_support: string;
}

interface AtsSuggestionsProps {
  jobUrl: string;
}

export function AtsSuggestions({ jobUrl }: AtsSuggestionsProps) {
  const [suggestion, setSuggestion] = useState<AtsSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobUrl) {
      setLoading(false);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await api.ats.getSuggestions(jobUrl);
        setSuggestion(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load ATS suggestions';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [jobUrl]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">ATS Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !suggestion) {
    return null;
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getAutomationColor = (support: string) => {
    switch (support) {
      case 'full':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'partial':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'manual':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getAutomationIcon = (support: string) => {
    switch (support) {
      case 'full':
        return <Zap className="h-4 w-4" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4" />;
      case 'manual':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">ATS Information</CardTitle>
            <CardDescription className="mt-1">
              Application system details and automation tips
            </CardDescription>
          </div>
          {suggestion.ats_type && (
            <Badge variant="outline" className="font-medium">
              {suggestion.ats_type}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Confidence and Automation Support */}
        <div className="flex gap-2 flex-wrap">
          <Badge className={cn('text-xs', getConfidenceColor(suggestion.confidence))}>
            {suggestion.confidence === 'high' ? 'High' : suggestion.confidence === 'medium' ? 'Medium' : 'Low'} Confidence
          </Badge>
          <Badge className={cn('text-xs flex items-center gap-1', getAutomationColor(suggestion.automation_support))}>
            {getAutomationIcon(suggestion.automation_support)}
            {suggestion.automation_support === 'full' ? 'Full Automation' : suggestion.automation_support === 'partial' ? 'Partial Automation' : 'Manual Review'}
          </Badge>
        </div>

        {/* Tips */}
        {suggestion.tips.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <h4 className="text-sm font-semibold">Helpful Tips</h4>
            </div>
            <ul className="space-y-1.5 text-sm">
              {suggestion.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Known Quirks */}
        {suggestion.known_quirks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <h4 className="text-sm font-semibold">Things to Watch For</h4>
            </div>
            <ul className="space-y-1.5 text-sm">
              {suggestion.known_quirks.map((quirk, index) => (
                <li key={index} className="flex items-start gap-2 text-muted-foreground">
                  <Info className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                  <span>{quirk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!suggestion.ats_type && (
          <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <Info className="h-4 w-4 inline mr-2" />
            This appears to be a custom application form. Review the form structure carefully before automating.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

