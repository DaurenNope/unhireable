import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type ChecklistAction =
  | { type: 'link'; label: string; to: string }
  | { type: 'button'; label: string; onClick: () => void; disabled?: boolean };

export interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
  action?: ChecklistAction;
}

interface OnboardingChecklistProps {
  steps: ChecklistStep[];
  title?: string;
  description?: string;
}

export function OnboardingChecklist({
  steps,
  title = 'Launch checklist',
  description = 'Step-by-step guide so you always know what to do next.',
}: OnboardingChecklistProps) {
  return (
    <Card className="border bg-card shadow-sm h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-sm">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.id} className="rounded-xl border bg-background/70 p-4 space-y-2">
            <div className="flex items-start gap-3">
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <Badge variant="outline" className="text-[10px]">
                    Step {index + 1}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
            {step.action &&
              (step.action.type === 'link' ? (
                <Button variant="secondary" size="sm" className="w-full" asChild>
                  <Link to={step.action.to}>{step.action.label}</Link>
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={step.action.onClick}
                  disabled={step.action.disabled}
                >
                  {step.action.label}
                </Button>
              ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

