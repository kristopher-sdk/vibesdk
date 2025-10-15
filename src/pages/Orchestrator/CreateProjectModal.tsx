import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
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
import { Loader2, CheckCircle, Github, AppWindow, Plus } from 'lucide-react';
import { createProject } from '@/services/orchestratorApi';
import { useApps } from '@/hooks/use-apps';
import { ProjectSource } from 'shared/types/orchestrator';
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

type ProjectType = 'github' | 'app' | 'new';

export function CreateProjectModal({
  open,
  onClose,
  onSuccess,
}: CreateProjectModalProps) {
  const navigate = useNavigate();
  const { apps, loading: appsLoading } = useApps();
  const [projectType, setProjectType] = useState<ProjectType>('app');
  const [selectedAppId, setSelectedAppId] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset form when modal opens
      setProjectType('app');
      setSelectedAppId('');
      setProjectTitle('');
      setProjectDescription('');
      setGithubRepoUrl('');
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (projectType === 'app' && !selectedAppId) {
      setError('Please select an app');
      return;
    }
    
    if (projectType === 'github' && !githubRepoUrl) {
      setError('Please enter a GitHub repository URL');
      return;
    }
    
    if (projectType === 'new' && !projectTitle) {
      setError('Please enter a project title');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      
      const request: any = {
        source: projectType === 'app' ? ProjectSource.APP : 
                projectType === 'github' ? ProjectSource.GITHUB : 
                ProjectSource.NEW,
        title: projectTitle || undefined,
        description: projectDescription || undefined,
      };
      
      if (projectType === 'app') {
        request.appId = selectedAppId;
      } else if (projectType === 'github') {
        request.githubRepoUrl = githubRepoUrl;
      }
      
      const result = await createProject(request);
      setSuccess(true);
      
      // Navigate to the new project after short delay
      setTimeout(() => {
        onSuccess();
        navigate(`/orchestrator/projects/${result.project.id}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Choose how you want to create your development project
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
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Type Selection */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setProjectType('github')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  projectType === 'github'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border-hover'
                }`}
              >
                <Github className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm font-medium">GitHub Repo</p>
                <p className="text-xs text-text-tertiary mt-1">
                  From existing repository
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProjectType('app')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  projectType === 'app'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border-hover'
                }`}
              >
                <AppWindow className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm font-medium">Saved App</p>
                <p className="text-xs text-text-tertiary mt-1">
                  From your apps
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProjectType('new')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  projectType === 'new'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border-hover'
                }`}
              >
                <Plus className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm font-medium">New Project</p>
                <p className="text-xs text-text-tertiary mt-1">
                  Start from scratch
                </p>
              </button>
            </div>

            {/* GitHub Repo Form */}
            {projectType === 'github' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="github-url">GitHub Repository URL *</Label>
                  <Input
                    id="github-url"
                    type="url"
                    placeholder="https://github.com/username/repository"
                    value={githubRepoUrl}
                    onChange={(e) => setGithubRepoUrl(e.target.value)}
                    required
                  />
                  <p className="text-xs text-text-tertiary">
                    The repository will be analyzed to generate development tickets
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Project Title (Optional)</Label>
                  <Input
                    id="title"
                    placeholder="Leave empty to use repository name"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    placeholder="Brief project description"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Saved App Form */}
            {projectType === 'app' && (
              <div className="space-y-4">
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

                <div className="space-y-2">
                  <Label htmlFor="title">Project Title (Optional)</Label>
                  <Input
                    id="title"
                    placeholder="Leave empty to use app name"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* New Project Form */}
            {projectType === 'new' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Project Title *</Label>
                  <Input
                    id="title"
                    placeholder="My Awesome Project"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    placeholder="Brief project description"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                  />
                </div>

                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-900 dark:text-blue-100">
                  <p className="font-medium mb-1">Connect Repository Later</p>
                  <p className="text-xs">
                    You can connect this project to a GitHub repository after creation
                  </p>
                </div>
              </div>
            )}

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
              <Button
                type="submit"
                disabled={creating || (projectType === 'app' && appsLoading)}
              >
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