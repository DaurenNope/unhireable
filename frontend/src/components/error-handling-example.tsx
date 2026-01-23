// Example component showing how to use the enhanced error handling

import { useState } from 'react';
import { ErrorDisplay, InlineErrorDisplay } from './error-display';
import { LoadingSpinner, LoadingButton } from './loading-states';
import { OfflineBanner } from './offline-banner';
import { useRetry } from '@/hooks/use-retry';
import { useOnline } from '@/hooks/use-online';
import { jobApi } from '@/api/client';

/**
 * Example component demonstrating enhanced error handling
 * This shows best practices for using the error handling utilities
 */
export function ErrorHandlingExample() {
  const [jobs, setJobs] = useState([]);
  const isOnline = useOnline();
  
  // Example: Using retry hook with API call
  const { execute, loading, error, retryCount } = useRetry(
    async () => {
      const result = await jobApi.list();
      setJobs(result);
      return result;
    },
    {
      maxRetries: 3,
      onRetry: (attempt) => {
        console.log(`Retrying... Attempt ${attempt}`);
      },
      onSuccess: () => {
        console.log('Successfully loaded jobs');
      },
      onFailure: (err) => {
        console.error('Failed after all retries:', err);
      },
    }
  );

  return (
    <div className="space-y-4">
      {/* Offline banner */}
      <OfflineBanner />
      
      {/* Error display with retry */}
      {error && (
        <ErrorDisplay
          error={error}
          onRetry={execute}
          showTechnicalDetails={false}
        />
      )}
      
      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2">
          <LoadingSpinner size="sm" />
          <span className="text-sm text-muted-foreground">
            {retryCount > 0 ? `Retrying... (${retryCount}/3)` : 'Loading...'}
          </span>
        </div>
      )}
      
      {/* Action button with loading state */}
      <LoadingButton
        loading={loading}
        onClick={execute}
        disabled={!isOnline}
      >
        {loading ? 'Loading...' : 'Load Jobs'}
      </LoadingButton>
      
      {/* Jobs list */}
      {jobs.length > 0 && (
        <div>
          <h3>Jobs ({jobs.length})</h3>
          {/* Render jobs */}
        </div>
      )}
    </div>
  );
}

/**
 * Example: Inline error display for forms
 */
export function FormWithErrorHandling() {
  const [error, setError] = useState<unknown>(null);
  const { execute, loading } = useRetry(
    async () => {
      // Form submission logic
      await jobApi.create({ /* job data */ });
    },
    { maxRetries: 2 }
  );

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      execute().catch(setError);
    }}>
      {/* Form fields */}
      
      {/* Inline error display */}
      {error && (
        <InlineErrorDisplay
          error={error}
          onRetry={execute}
        />
      )}
      
      <LoadingButton
        type="submit"
        loading={loading}
      >
        Submit
      </LoadingButton>
    </form>
  );
}








