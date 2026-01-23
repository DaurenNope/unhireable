import { useState, useCallback } from 'react';

type ApiFunction<T, P extends unknown[]> = (...args: P) => Promise<T>;

interface ApiResult<T> {
  data?: T;
  error?: string;
}

export function useApi<T, P extends unknown[]>(
  apiFunction: ApiFunction<T, P>,
  options: { initialData?: T; onSuccess?: (data: T) => void } = {}
) {
  const { initialData, onSuccess } = options;
  const [data, setData] = useState<T | null>(initialData || null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(
    async (...args: P): Promise<ApiResult<T>> => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await apiFunction(...args);
        setData(result);
        onSuccess?.(result);
        return { data: result };
      } catch (err) {
        const error = err instanceof Error ? err : new Error('An unknown error occurred');
        setError(error);
        return { error: error.message };
      } finally {
        setIsLoading(false);
      }
    },
    [apiFunction, onSuccess]
  );

  return { data, error, isLoading, execute };
}

// Example usage:
// const { data: jobs, isLoading, error, execute: fetchJobs } = useApi(api.jobs.list);
// fetchJobs();

export function useApiMutation<T, P extends unknown[]>(
  apiFunction: ApiFunction<T, P>,
  options: { onSuccess?: (data: T) => void } = {}
) {
  const { onSuccess } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (...args: P): Promise<ApiResult<T>> => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await apiFunction(...args);
        onSuccess?.(result);
        return { data: result };
      } catch (err) {
        const error = err instanceof Error ? err : new Error('An unknown error occurred');
        setError(error);
        return { error: error.message };
      } finally {
        setIsLoading(false);
      }
    },
    [apiFunction, onSuccess]
  );

  return { isLoading, error, mutate };
}

// Example usage:
// const { isLoading, error, mutate: createJob } = useApiMutation(api.jobs.create);
// createJob(newJobData);
