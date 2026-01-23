import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  return (
    <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
      <WifiOff className="h-4 w-4" />
      <AlertTitle>You're offline</AlertTitle>
      <AlertDescription>
        Some features may not be available. Please check your internet connection.
      </AlertDescription>
    </Alert>
  );
}
