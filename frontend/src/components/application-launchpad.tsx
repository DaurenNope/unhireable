import { useState } from 'react';
import {
    Rocket,
    FileText,
    ExternalLink,
    CheckCircle2,
    User,
    Loader2,
    Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyField } from '@/components/ui/copy-field';
import { DocumentGenerator } from '@/components/document-generator';
import { Job, UserProfile } from '@/types/models';
import { jobApi } from '@/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { open } from '@tauri-apps/plugin-shell';
import { cn } from '@/lib/utils';

interface ApplicationLaunchpadProps {
    job: Job;
    userProfile: UserProfile;
}

export function ApplicationLaunchpad({ job, userProfile }: ApplicationLaunchpadProps) {
    const [isMarkingApplied, setIsMarkingApplied] = useState(false);
    const [hasMarkedApplied, setHasMarkedApplied] = useState(job.status === 'applied');
    const [showDocGenerator, setShowDocGenerator] = useState(false);
    const queryClient = useQueryClient();

    const handleOpenApplication = async () => {
        if (!job.url) return;

        // Check if we're running in Tauri environment
        const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

        if (isTauri) {
            try {
                await open(job.url);
                return;
            } catch (err) {
                console.error('Tauri shell.open failed, falling back to window.open:', err);
            }
        }

        // Fallback for browser mode or if Tauri fails
        window.open(job.url, '_blank', 'noopener,noreferrer');
    };

    const handleMarkApplied = async () => {
        if (!job.id) return;
        setIsMarkingApplied(true);
        try {
            await jobApi.update({ ...job, status: 'applied' });
            queryClient.invalidateQueries({ queryKey: ['job', job.id] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            setHasMarkedApplied(true);
        } catch (err) {
            console.error('Failed to mark as applied:', err);
        } finally {
            setIsMarkingApplied(false);
        }
    };

    const personalInfo = userProfile?.personal_info;

    // Handle missing profile data gracefully
    if (!personalInfo) {
        return (
            <div className="space-y-6">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-full">
                        <Rocket className="h-5 w-5" />
                        <span className="font-semibold">Application Launchpad</span>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        Please complete your profile in Settings to use the Application Launchpad.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-full">
                    <Rocket className="h-5 w-5" />
                    <span className="font-semibold">Application Launchpad</span>
                </div>
                <p className="text-muted-foreground text-sm">
                    Everything you need to apply — copy your info, generate documents, and go!
                </p>
            </div>

            {/* Quick Copy Profile Card */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        Quick Copy Profile
                    </CardTitle>
                    <CardDescription>
                        Click any field to copy to clipboard
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <CopyField
                            label="Name"
                            value={personalInfo.name}
                        />
                        <CopyField
                            label="Email"
                            value={personalInfo.email}
                        />
                        {personalInfo.phone && (
                            <CopyField
                                label="Phone"
                                value={personalInfo.phone}
                            />
                        )}
                        {personalInfo.location && (
                            <CopyField
                                label="Location"
                                value={personalInfo.location}
                            />
                        )}
                    </div>

                    {/* Links Section */}
                    {(personalInfo.linkedin || personalInfo.github || personalInfo.portfolio) && (
                        <div className="pt-3 border-t space-y-3">
                            <span className="text-sm font-medium text-muted-foreground">Links</span>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {personalInfo.linkedin && (
                                    <CopyField
                                        label="LinkedIn"
                                        value={personalInfo.linkedin}
                                    />
                                )}
                                {personalInfo.github && (
                                    <CopyField
                                        label="GitHub"
                                        value={personalInfo.github}
                                    />
                                )}
                                {personalInfo.portfolio && (
                                    <CopyField
                                        label="Portfolio"
                                        value={personalInfo.portfolio}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Documents Card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Application Documents
                    </CardTitle>
                    <CardDescription>
                        Generate a tailored resume and cover letter for this position
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {showDocGenerator ? (
                        <DocumentGenerator
                            job={job}
                            userProfile={userProfile}
                            onDocumentGenerated={(doc) => {
                                console.log('Document generated:', doc);
                            }}
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-4 py-6">
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <div className="p-3 rounded-full bg-muted">
                                    <Sparkles className="h-6 w-6" />
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="font-medium">Ready to generate documents?</p>
                                <p className="text-sm text-muted-foreground">
                                    Create a tailored resume and cover letter for {job.company}
                                </p>
                            </div>
                            <Button onClick={() => setShowDocGenerator(true)} className="gap-2">
                                <FileText className="h-4 w-4" />
                                Generate Documents
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 items-center justify-center">
                        {/* Auto-Apply Button - Primary Action */}
                        <Button
                            size="lg"
                            className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg w-full sm:w-auto animate-pulse"
                            onClick={async () => {
                                // Sync profile to Chrome extension storage
                                try {
                                    localStorage.setItem('unhireable_profile', JSON.stringify(userProfile));
                                    console.log('[Unhireable] Profile synced for extension');
                                } catch (err) {
                                    console.error('Failed to sync profile:', err);
                                }
                                // Open job URL - extension will auto-fill
                                handleOpenApplication();
                            }}
                            disabled={!job.url}
                        >
                            <Sparkles className="h-5 w-5" />
                            ⚡ Auto-Apply (Extension)
                        </Button>

                        <div className="flex flex-row gap-3 w-full sm:w-auto">
                            <Button
                                size="lg"
                                variant="outline"
                                className="gap-2 flex-1 sm:flex-none"
                                onClick={handleOpenApplication}
                                disabled={!job.url}
                            >
                                <ExternalLink className="h-5 w-5" />
                                Open Page
                            </Button>

                            <Button
                                size="lg"
                                variant={hasMarkedApplied ? 'outline' : 'default'}
                                className={cn(
                                    'gap-2 flex-1 sm:flex-none',
                                    hasMarkedApplied && 'border-green-500 text-green-600 bg-green-50 hover:bg-green-100'
                                )}
                                onClick={handleMarkApplied}
                                disabled={isMarkingApplied || hasMarkedApplied}
                            >
                                {isMarkingApplied ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="h-5 w-5" />
                                )}
                                {hasMarkedApplied ? 'Applied!' : 'Mark Applied'}
                            </Button>
                        </div>
                    </div>

                    {hasMarkedApplied && (
                        <p className="text-center text-sm text-green-600 mt-3">
                            ✓ Application tracked! Good luck! 🍀
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Tips */}
            <div className="text-center text-sm text-muted-foreground space-y-1">
                <p>💡 <strong>Tip:</strong> Click "Auto-Apply" → Extension auto-fills form → Review & Submit!</p>
                <p>📦 Install the Unhireable Chrome Extension for one-click applications.</p>
            </div>
        </div>
    );
}
