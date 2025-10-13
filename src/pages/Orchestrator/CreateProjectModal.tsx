import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle } from 'lucide-react';
import { createProject } from '@/services/orchestratorApi';
import { useApps } from '@/hooks/use-apps';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateProjectModal({
  open,
  onClose,
  onSuccess,
}: CreateProjectModalProps) {
  const { apps, loading: appsLoading } = useApps();
  const [selectedAppId, setSelectedAppId] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset form when modal opens
      setSelectedAppId('');
      setProjectTitle('');
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppId) {
      setError('Please select an app');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      await createProject(selectedAppId, projectTitle || undefined);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Select an app to analyze and create development tickets
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold mb-2">Project Created!</h3>
            <p className="text-text-tertiary">
              Your project is being analyzed. Redirecting...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* App Selection */}
            <div className="space-y-2">
              <Label htmlFor="app">Select App *</Label>
              <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                <SelectTrigger id="app" disabled={appsLoading}>
                  <SelectValue
                    placeholder={appsLoading ? 'Loading apps...' : 'Choose an app'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {apps.map((app) => (
                    <SelectItem key={app.id} value={app.id}>
                      {app.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Title (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="title">Project Title (Optional)</Label>
              <Input
                id="title"
                placeholder="Leave empty to use app name"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
              />
              <p className="text-xs text-text-tertiary">
                Customize the project name or leave empty to use the app title
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || appsLoading}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}