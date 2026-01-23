import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Bell, Edit, X, Play, Plus, Save, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { savedSearchApi } from '@/api/client';
import type { SavedSearch, AlertFrequency, SavedSearchFilters } from '@/types/models';

export function SavedSearchesSettings() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: searches, isLoading, refetch } = useQuery({
    queryKey: ['saved-searches'],
    queryFn: () => savedSearchApi.list(false),
  });

  const defaultFilters: SavedSearchFilters = {
    remote_only: false,
    min_match_score: null,
    status: 'all',
    skill_filter: null,
    preferred_locations: [],
    preferred_titles: [],
    preferred_companies: [],
    avoid_companies: [],
    required_skills: [],
    preferred_skills: [],
    min_salary: null,
    job_types: [],
    industries: [],
    must_have_benefits: [],
    company_size: null,
  };

  const withDefaultFilters = (filters?: SavedSearchFilters): SavedSearchFilters => ({
    ...defaultFilters,
    ...(filters || {}),
  });

  const [formData, setFormData] = useState<Partial<SavedSearch>>({
    name: '',
    query: '',
    sources: ['remotive', 'remoteok', 'wellfound', 'greenhouse'],
    filters: withDefaultFilters(),
    alert_frequency: 'daily',
    min_match_score: 60,
    enabled: true,
  });

  const availableSources = [
    { id: 'remotive', name: 'Remotive' },
    { id: 'remoteok', name: 'RemoteOK' },
    { id: 'wellfound', name: 'Wellfound' },
    { id: 'greenhouse', name: 'Greenhouse' },
  ];

  const alertFrequencies: { value: AlertFrequency; label: string }[] = [
    { value: 'hourly', label: 'Hourly' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'never', label: 'Never' },
  ];

  const resetForm = () => {
    setFormData({
      name: '',
      query: '',
      sources: ['remotive', 'remoteok', 'wellfound', 'greenhouse'],
      filters: withDefaultFilters(),
      alert_frequency: 'daily',
      min_match_score: 60,
      enabled: true,
    });
    setEditingId(null);
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.query) {
      setMessage({ type: 'error', text: 'Name and query are required' });
      return;
    }

    try {
      if (editingId) {
        await savedSearchApi.update({ ...formData, id: editingId } as SavedSearch);
        setMessage({ type: 'success', text: 'Saved search updated successfully' });
      } else {
        await savedSearchApi.create(formData as Omit<SavedSearch, 'id' | 'created_at' | 'updated_at' | 'last_run_at'>);
        setMessage({ type: 'success', text: 'Saved search created successfully' });
      }
      resetForm();
      refetch();
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
    } catch (error: unknown) {
      setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to save search' });
    }
  };

  const handleEdit = (search: SavedSearch) => {
    setFormData({
      ...search,
      filters: withDefaultFilters(search.filters),
    });
    setEditingId(search.id || null);
    setIsCreating(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this saved search?')) return;
    try {
      await savedSearchApi.delete(id);
      setMessage({ type: 'success', text: 'Saved search deleted successfully' });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
    } catch (error: unknown) {
      setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to delete search' });
    }
  };

  const handleRun = async (id: number) => {
    try {
      const jobs = await savedSearchApi.run(id);
      setMessage({ type: 'success', text: `Found ${jobs.length} matching jobs` });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (error: unknown) {
      setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to run search' });
    }
  };

  const handleCheckAndRunAll = async () => {
    try {
      const count = await savedSearchApi.checkAndRun();
      setMessage({ 
        type: 'success', 
        text: `Checked and ran ${count} saved searches. Found ${count} new jobs total.` 
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['saved-searches-status'] });
    } catch (error: unknown) {
      setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to check and run searches' });
    }
  };

  const toggleSource = (sourceId: string) => {
    const current = formData.sources || [];
    if (current.includes(sourceId)) {
      if (current.length > 1) {
        setFormData({ ...formData, sources: current.filter((s) => s !== sourceId) });
      }
    } else {
      setFormData({ ...formData, sources: [...current, sourceId] });
    }
  };

  if (message) {
    setTimeout(() => setMessage(null), 5000);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Saved Searches
          </CardTitle>
          <CardDescription>
            Create automated searches that run periodically and notify you of new high-match jobs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            {!isCreating && (
              <Button onClick={() => setIsCreating(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Saved Search
              </Button>
            )}
            {!isCreating && searches && searches.length > 0 && (
              <Button 
                onClick={handleCheckAndRunAll} 
                variant="outline" 
                className="gap-2"
                title="Check all saved searches and run those that are due"
              >
                <RefreshCw className="h-4 w-4" />
                Check & Run All Due
              </Button>
            )}
          </div>

          {isCreating && (
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">
                  {editingId ? 'Edit Saved Search' : 'Create Saved Search'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search-name">Name</Label>
                  <Input
                    id="search-name"
                    placeholder="e.g., Senior React Developer"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search-query">Search Query</Label>
                  <Input
                    id="search-query"
                    placeholder="e.g., senior react developer"
                    value={formData.query || ''}
                    onChange={(e) => setFormData({ ...formData, query: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sources</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableSources.map((source) => (
                      <Button
                        key={source.id}
                        type="button"
                        variant={formData.sources?.includes(source.id) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleSource(source.id)}
                      >
                        {source.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alert-frequency">Alert Frequency</Label>
                  <select
                    id="alert-frequency"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.alert_frequency || 'daily'}
                    onChange={(e) =>
                      setFormData({ ...formData, alert_frequency: e.target.value as AlertFrequency })
                    }
                  >
                    {alertFrequencies.map((freq) => (
                      <option key={freq.value} value={freq.value}>
                        {freq.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min-match-score">Minimum Match Score</Label>
                  <Input
                    id="min-match-score"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.min_match_score || 60}
                    onChange={(e) =>
                      setFormData({ ...formData, min_match_score: parseInt(e.target.value) || 60 })
                    }
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="remote-only"
                    checked={formData.filters?.remote_only || false}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        filters: { ...formData.filters, remote_only: checked },
                      })
                    }
                  />
                  <Label htmlFor="remote-only">Remote only</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skill-filter">Skill Filter (optional)</Label>
                  <Input
                    id="skill-filter"
                    placeholder="e.g., react, typescript"
                    value={formData.filters?.skill_filter || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        filters: { ...formData.filters, skill_filter: e.target.value || null },
                      })
                    }
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="search-enabled"
                    checked={formData.enabled ?? true}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                  <Label htmlFor="search-enabled">Enabled</Label>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSave} className="gap-2">
                    <Save className="h-4 w-4" />
                    {editingId ? 'Update' : 'Create'}
                  </Button>
                  <Button variant="outline" onClick={resetForm} className="gap-2">
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Your Saved Searches</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !searches || searches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved searches yet. Create one to get started!
              </p>
            ) : (
              <div className="space-y-3">
                {searches.map((search) => (
                  <Card 
                    key={search.id} 
                    className={`transition-all duration-200 hover:shadow-md ${
                      !search.enabled ? 'opacity-60' : 'border-primary/20 hover:border-primary/40'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-lg">{search.name}</h4>
                            {search.enabled ? (
                              <Badge variant="default" className="bg-green-500/90 text-white animate-pulse">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Disabled</Badge>
                            )}
                            <Badge variant="outline" className="gap-1">
                              <Bell className="h-3 w-3" />
                              {search.alert_frequency}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Query: <span className="font-mono">{search.query}</span>
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {search.sources.map((source) => (
                              <Badge key={source} variant="outline" className="text-xs">
                                {source}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>Min score: {search.min_match_score}%</span>
                            {search.filters.remote_only && <span>• Remote only</span>}
                            {search.filters.skill_filter && (
                              <span>• Skill: {search.filters.skill_filter}</span>
                            )}
                            {search.last_run_at && (
                              <span>• Last run: {new Date(search.last_run_at).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRun(search.id!)}
                            className="gap-2 hover:bg-primary/10 transition-colors"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Run Now
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(search)}
                            className="gap-2 hover:bg-primary/10 transition-colors"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(search.id!)}
                            className="gap-2 text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

