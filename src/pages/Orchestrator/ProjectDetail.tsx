import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Github,
  AlertCircle,
  LayoutGrid,
  List,
} from 'lucide-react';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import { TicketCard } from './TicketCard';
import { TicketDetailModal } from './TicketDetailModal';
import {
  getProject,
  generateTickets,
  createGitHubRepo,
  updateProject,
} from '@/services/orchestratorApi';
import { useOrchestratorWebSocket } from '@/hooks/useOrchestratorWebSocket';
import type { ProjectWithRelations, TicketWithRelations, TicketStatus } from '../../shared/types/orchestrator';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TICKET_STATUSES: TicketStatus[] = [
  'pending',
  'ready',
  'assigned',
  'in_progress',
  'review',
  'blocked',
  'completed',
  'cancelled',
];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectWithRelations | null>(null);
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketWithRelations | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // WebSocket for real-time updates
  const { connected } = useOrchestratorWebSocket({
    projectId: id,
    onTicketUpdated: (message) => {
      // Update ticket in state
      setTickets((prev) =>
        prev.map((t) => (t.id === message.ticketId ? { ...t, ...message.changes } : t))
      );
      toast.info('Ticket updated');
    },
    onTicketStatusChanged: (message) => {
      setTickets((prev) =>
        prev.map((t) =>
          t.id === message.ticketId ? { ...t, status: message.newStatus } : t
        )
      );
      toast.info(`Ticket status changed to ${message.newStatus}`);
    },
    onProjectStatusChanged: (message) => {
      if (project && message.projectId === project.id) {
        setProject({ ...project, status: message.newStatus });
        toast.info(`Project status changed to ${message.newStatus}`);
      }
    },
  });

  useEffect(() => {
    if (id) {
      loadProject();
    }
  }, [id]);

  const loadProject = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getProject(id);
      setProject(data);
      setTickets(data.tickets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTickets = async () => {
    if (!id) return;
    try {
      setGenerating(true);
      await generateTickets(id);
      toast.success('Ticket generation started');
      setTimeout(() => loadProject(), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate tickets');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateRepo = async () => {
    if (!id) return;
    try {
      setCreatingRepo(true);
      const result = await createGitHubRepo(id);
      toast.success('GitHub repository created');
      if (project) {
        setProject({
          ...project,
          githubRepoUrl: result.repositoryUrl,
          githubDefaultBranch: result.defaultBranch,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create repository');
    } finally {
      setCreatingRepo(false);
    }
  };

  const handleApproveProject = async () => {
    if (!id) return;
    try {
      await updateProject(id, { action: 'approve' });
      toast.success('Project approved');
      loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve project');
    }
  };

  const groupTicketsByStatus = () => {
    const grouped: Record<TicketStatus, TicketWithRelations[]> = {
      pending: [],
      ready: [],
      assigned: [],
      in_progress: [],
      review: [],
      blocked: [],
      completed: [],
      cancelled: [],
    };

    tickets.forEach((ticket) => {
      grouped[ticket.status].push(ticket);
    });

    return grouped;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-3 p-8">
        <div className="container mx-auto">
          <Skeleton className="h-12 w-48 mb-8" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-bg-3 p-8">
        <div className="container mx-auto">
          <div className="text-center py-12">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
            <h3 className="text-xl font-semibold mb-2">Failed to load project</h3>
            <p className="text-text-tertiary mb-4">{error}</p>
            <Button onClick={() => navigate('/orchestrator')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const groupedTickets = groupTicketsByStatus();

  return (
    <div className="min-h-screen bg-bg-3">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/orchestrator')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-4xl font-bold text-text-primary">
                    {project.title}
                  </h1>
                  <ProjectStatusBadge status={project.status} />
                  {connected && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      ● Live
                    </Badge>
                  )}
                </div>
                {project.description && (
                  <p className="text-text-tertiary text-lg">{project.description}</p>
                )}
                <div className="flex items-center gap-4 mt-3 text-sm text-text-tertiary">
                  <span>
                    {project.totalTickets} tickets ({project.completedTickets} completed)
                  </span>
                  {project.githubRepoUrl && (
                    <a
                      href={project.githubRepoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Github className="h-4 w-4" />
                      Repository
                    </a>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {project.status === 'analyzing' && (
                  <Button onClick={handleGenerateTickets} disabled={generating}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {generating ? 'Generating...' : 'Generate Tickets'}
                  </Button>
                )}
                {project.status === 'review' && (
                  <Button onClick={handleApproveProject}>Approve Project</Button>
                )}
                {project.status === 'approved' && !project.githubRepoUrl && (
                  <Button onClick={handleCreateRepo} disabled={creatingRepo}>
                    <Github className="h-4 w-4 mr-2" />
                    {creatingRepo ? 'Creating...' : 'Create GitHub Repo'}
                  </Button>
                )}
                <Button variant="outline" size="icon" onClick={loadProject}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <div className="flex gap-1 border border-gray-300 rounded-md overflow-hidden">
                  <Button
                    variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('kanban')}
                    className="rounded-none"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Tickets */}
          {tickets.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <Sparkles className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">No tickets yet</h3>
              <p className="text-text-tertiary mb-4">
                {project.status === 'analyzing'
                  ? 'Click "Generate Tickets" to analyze your project'
                  : 'Tickets are being generated...'}
              </p>
            </div>
          ) : viewMode === 'kanban' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {TICKET_STATUSES.filter(
                (status) => groupedTickets[status].length > 0 || status === 'pending'
              ).map((status) => (
                <div key={status} className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="font-semibold text-sm uppercase text-text-secondary">
                      {status.replace('_', ' ')}
                    </h3>
                    <Badge variant="secondary">{groupedTickets[status].length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {groupedTickets[status].map((ticket) => (
                      <TicketCard
                        key={ticket.id}
                        ticket={ticket}
                        onClick={() => setSelectedTicket(ticket)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => setSelectedTicket(ticket)}
                  layout="list"
                />
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          open={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={loadProject}
        />
      )}
    </div>
  );
}