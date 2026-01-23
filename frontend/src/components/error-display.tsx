import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { getUserFriendlyError } from '../utils/errors';

interface ErrorDisplayProps {
  error: unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorDisplay({ error, onRetry, onDismiss }: ErrorDisplayProps) {
  const friendlyError = getUserFriendlyError(error);
  
  return (
    <Alert variant="destructive" className="relative">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{friendlyError.title}</AlertTitle>
      <AlertDescription>
        {friendlyError.message}
        {friendlyError.retryable && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {friendlyError.action || 'Retry'}
          </Button>
        )}
      </AlertDescription>
      {onDismiss && (
        <button 
          onClick={onDismiss} 
          className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss error"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </Alert>
  );
}
