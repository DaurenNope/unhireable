import { useState, useCallback } from 'react';
export function useRetry(fn, maxRetries = 3) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const execute = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fn();
            setRetryCount(0);
            setLoading(false);
            return result;
        }
        catch (err) {
            setError(err);
            if (retryCount < maxRetries) {
                const newRetryCount = retryCount + 1;
                setRetryCount(newRetryCount);
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                return execute();
            }
            setLoading(false);
            throw err;
        }
    }, [fn, maxRetries, retryCount]);
    return { execute, loading, error, retryCount };
}
