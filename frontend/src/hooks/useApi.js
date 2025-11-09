import { useState, useCallback } from 'react';
export function useApi(apiFunction, options = {}) {
    const { initialData, onSuccess } = options;
    const [data, setData] = useState(initialData || null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const execute = useCallback(async (...args) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await apiFunction(...args);
            setData(result);
            onSuccess?.(result);
            return { data: result };
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error('An unknown error occurred');
            setError(error);
            return { error: error.message };
        }
        finally {
            setIsLoading(false);
        }
    }, [apiFunction, onSuccess]);
    return { data, error, isLoading, execute };
}
// Example usage:
// const { data: jobs, isLoading, error, execute: fetchJobs } = useApi(api.jobs.list);
// fetchJobs();
export function useApiMutation(apiFunction, options = {}) {
    const { onSuccess } = options;
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const mutate = useCallback(async (...args) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await apiFunction(...args);
            onSuccess?.(result);
            return { data: result };
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error('An unknown error occurred');
            setError(error);
            return { error: error.message };
        }
        finally {
            setIsLoading(false);
        }
    }, [apiFunction, onSuccess]);
    return { isLoading, error, mutate };
}
// Example usage:
// const { isLoading, error, mutate: createJob } = useApiMutation(api.jobs.create);
// createJob(newJobData);
