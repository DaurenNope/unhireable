import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopyFieldProps {
    label: string;
    value: string;
    className?: string;
    showLabel?: boolean;
}

export function CopyField({ label, value, className, showLabel = true }: CopyFieldProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    if (!value) return null;

    return (
        <div className={cn('flex items-center gap-2 group', className)}>
            {showLabel && (
                <span className="text-sm text-muted-foreground min-w-[80px]">{label}:</span>
            )}
            <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-sm font-medium truncate flex-1">{value}</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        'h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity',
                        copied && 'opacity-100'
                    )}
                    onClick={handleCopy}
                >
                    {copied ? (
                        <>
                            <Check className="h-3.5 w-3.5 text-green-500 mr-1" />
                            <span className="text-xs text-green-500">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            <span className="text-xs">Copy</span>
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
