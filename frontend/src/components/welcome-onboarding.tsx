import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CheckCircle2, 
  ArrowRight, 
  User, 
  Briefcase, 
  FileText, 
  Sparkles,
  Rocket,
  Settings,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HowItWorks } from './how-it-works';

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  action: {
    label: string;
    href: string;
    variant?: "default" | "outline" | "ghost";
  };
  completed?: boolean;
}

const steps: Step[] = [
  {
    id: 'profile',
    title: 'Create Your Profile',
    description: 'Add your skills, experience, and career goals to enable job matching and resume generation',
    icon: User,
    action: {
      label: 'Go to Settings → Profile',
      href: '/settings?tab=profile',
    },
  },
  {
    id: 'scrape',
    title: 'Find Jobs',
    description: 'Scrape jobs from multiple sources (hh.kz, Wellfound, LinkedIn) or add them manually',
    icon: Search,
    action: {
      label: 'Scrape Jobs',
      href: '/jobs',
    },
  },
  {
    id: 'match',
    title: 'Calculate Match Scores',
    description: 'Let AI analyze which jobs match your profile based on skills and experience',
    icon: Sparkles,
    action: {
      label: 'Calculate Matches',
      href: '/jobs',
    },
  },
  {
    id: 'apply',
    title: 'Create Applications',
    description: 'Track your applications and manage the entire hiring process in one place',
    icon: Briefcase,
    action: {
      label: 'Create Application',
      href: '/applications',
    },
  },
  {
    id: 'documents',
    title: 'Generate Documents',
    description: 'Create tailored resumes and cover letters for each job application',
    icon: FileText,
    action: {
      label: 'Generate Resume',
      href: '/jobs',
    },
  },
];

export function WelcomeOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    // Check if user has dismissed before (stored in localStorage)
    return localStorage.getItem('unhireable-onboarding-dismissed') === 'true';
  });

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('unhireable-onboarding-dismissed', 'true');
  };

  if (dismissed) {
    return null;
  }

  const currentStepData = steps[currentStep];
  
  if (!currentStepData) {
    return null;
  }

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-card/80 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Welcome to Unhireable!</CardTitle>
              <CardDescription className="text-base mt-1">
                Your Neural Career System - Let's get you started
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground"
          >
            Skip
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      "rounded-full p-2 transition-all",
                      isActive && "bg-primary text-primary-foreground scale-110",
                      isCompleted && "bg-primary/20 text-primary",
                      !isActive && !isCompleted && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs mt-2 text-center max-w-[80px]",
                    isActive && "font-semibold text-foreground",
                    !isActive && "text-muted-foreground"
                  )}>
                    {step.title.split(' ')[0]}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "h-0.5 flex-1 mx-2 -mt-6",
                    isCompleted ? "bg-primary" : "bg-muted"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Current Step Content */}
        <div className="bg-muted/30 rounded-lg p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <currentStepData.icon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">{currentStepData.title}</h3>
              <p className="text-muted-foreground">{currentStepData.description}</p>
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button asChild className="flex-1">
              <Link to={currentStepData.action.href}>
                {currentStepData.action.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {currentStep < steps.length - 1 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(currentStep + 1)}
              >
                Next
              </Button>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/jobs">
              <Briefcase className="mr-2 h-4 w-4" />
              Jobs
            </Link>
          </Button>
        </div>
      </CardContent>
      
      {/* How It Works Guide */}
      <div className="mt-6">
        <HowItWorks />
      </div>
    </Card>
  );
}

