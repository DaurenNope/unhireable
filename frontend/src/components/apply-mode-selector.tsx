import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import {
  Eye,
  Zap,
  Rocket,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { ApplyModeInfo, ApplyModeStatus } from '@/types/autopilot';

interface ApplyModeSelectorProps {
  currentMode?: ApplyModeStatus;
  onModeChange?: (mode: ApplyModeInfo) => void;
  compact?: boolean;
}

const modeIcons = {
  manual: Eye,
  semiauto: Zap,
  autopilot: Rocket,
};

const modeColors = {
  manual: 'bg-blue-500/10 border-blue-500/30 text-blue-600 hover:bg-blue-500/20',
  semiauto: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/20',
  autopilot: 'bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20',
};

const modeActiveColors = {
  manual: 'bg-blue-500 border-blue-600 text-white',
  semiauto: 'bg-yellow-500 border-yellow-600 text-white',
  autopilot: 'bg-green-500 border-green-600 text-white',
};

export function ApplyModeSelector({ currentMode, onModeChange, compact = false }: ApplyModeSelectorProps) {
  const queryClient = useQueryClient();

  // Fetch available modes
  const { data: modes } = useQuery<ApplyModeInfo[]>({
    queryKey: ['apply-modes'],
    queryFn: () => invoke('get_apply_modes'),
  });

  // Fetch current mode
  const { data: activeMode } = useQuery<ApplyModeInfo>({
    queryKey: ['current-apply-mode'],
    queryFn: () => invoke('get_current_apply_mode'),
    enabled: !currentMode, // Only fetch if not provided via props
  });

  // Set mode mutation
  const setModeMutation = useMutation({
    mutationFn: (mode: string) => invoke<ApplyModeInfo>('set_apply_mode', { mode }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['current-apply-mode'] });
      queryClient.invalidateQueries({ queryKey: ['autopilot-status'] });
      onModeChange?.(data);
    },
  });

  const selectedMode = currentMode?.id || activeMode?.id || 'manual';

  if (!modes) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {modes.map((mode) => {
          const Icon = modeIcons[mode.id as keyof typeof modeIcons] || Eye;
          const isActive = selectedMode === mode.id;

          return (
            <TooltipProvider key={mode.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`transition-all ${
                      isActive 
                        ? modeActiveColors[mode.id as keyof typeof modeActiveColors] 
                        : modeColors[mode.id as keyof typeof modeColors]
                    }`}
                    onClick={() => setModeMutation.mutate(mode.id)}
                    disabled={setModeMutation.isPending}
                  >
                    <Icon className="h-4 w-4 mr-1" />
                    {mode.name}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">{mode.name}</p>
                  <p className="text-sm text-muted-foreground">{mode.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Application Mode
        </CardTitle>
        <CardDescription>
          Choose how automated you want your job applications to be
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {modes.map((mode) => {
            const Icon = modeIcons[mode.id as keyof typeof modeIcons] || Eye;
            const isActive = selectedMode === mode.id;

            return (
              <button
                key={mode.id}
                className={`relative p-4 rounded-lg border-2 text-left transition-all ${
                  isActive 
                    ? modeActiveColors[mode.id as keyof typeof modeActiveColors] 
                    : `${modeColors[mode.id as keyof typeof modeColors]} border-dashed`
                }`}
                onClick={() => setModeMutation.mutate(mode.id)}
                disabled={setModeMutation.isPending}
              >
                {isActive && (
                  <CheckCircle className="absolute top-2 right-2 h-5 w-5" />
                )}
                
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-6 w-6" />
                  <span className="text-lg font-semibold">{mode.name}</span>
                </div>
                
                <p className={`text-sm mb-3 ${isActive ? 'text-white/90' : 'text-muted-foreground'}`}>
                  {mode.description}
                </p>
                
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    {mode.is_headless ? (
                      <Badge variant="outline" className={isActive ? 'bg-white/10 border-white/20' : ''}>
                        Headless
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={isActive ? 'bg-white/10 border-white/20' : ''}>
                        Visible Browser
                      </Badge>
                    )}
                  </div>
                  
                  <div className={`flex items-center gap-1 ${isActive ? 'text-white/80' : 'text-muted-foreground'}`}>
                    {mode.auto_submit ? (
                      <>
                        <AlertTriangle className="h-3 w-3" />
                        <span>Auto-submits</span>
                      </>
                    ) : mode.requires_confirmation ? (
                      <>
                        <Info className="h-3 w-3" />
                        <span>Requires confirmation</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" />
                        <span>You click submit</span>
                      </>
                    )}
                  </div>
                  
                  <div className={`text-xs ${isActive ? 'text-white/70' : 'text-muted-foreground'}`}>
                    Min ATS: {mode.min_reliability}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Mode explanation */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
          {selectedMode === 'manual' && (
            <div className="flex items-start gap-2">
              <Eye className="h-4 w-4 mt-0.5 text-blue-500" />
              <div>
                <p className="font-medium">Manual Review Mode</p>
                <p className="text-muted-foreground">
                  Browser opens visible so you can watch. Form fills automatically, but you 
                  review everything and click Submit yourself. Works with any ATS.
                </p>
              </div>
            </div>
          )}
          {selectedMode === 'semiauto' && (
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 mt-0.5 text-yellow-500" />
              <div>
                <p className="font-medium">Semi-Automatic Mode</p>
                <p className="text-muted-foreground">
                  Browser runs in background. Form fills automatically, then you get a 
                  notification to approve or reject before submission. Good balance of speed and control.
                </p>
              </div>
            </div>
          )}
          {selectedMode === 'autopilot' && (
            <div className="flex items-start gap-2">
              <Rocket className="h-4 w-4 mt-0.5 text-green-500" />
              <div>
                <p className="font-medium">Full Autopilot Mode</p>
                <p className="text-muted-foreground">
                  Completely automatic - form fills and submits without intervention. 
                  Only works with reliable ATS systems (Greenhouse, Lever, etc.) to ensure success.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ApplyModeSelector;
