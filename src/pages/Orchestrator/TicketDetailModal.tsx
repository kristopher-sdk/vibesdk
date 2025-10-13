import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  GitBranch,
  ExternalLink,
  User,
  Link as LinkIcon,
  FileText,
  CheckCircle2,
  Github,
  Loader2,
} from 'lucide-react';
import type {
  TicketWithRelations,
  TicketStatus,
  AcceptanceCriterion,
  AffectedFile,
} from '../../shared/types/orchestrator';
import {
  assignTicket,
  updateTicket,
  createGitHubBranch,
  createGitHubPR,
} from '@/services/orchestratorApi';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TicketDetailModalProps {
  ticket: TicketWithRelations;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'ready', label: 'Ready' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function TicketDetailModal({
  ticket,
  open,
  onClose,
  onUpdate,
}: TicketDetailModalProps) {
  const [updating, setUpdating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [creatingPR, setCreatingPR] = useState(false);

  const handleStatusChange = async (newStatus: TicketStatus) => {
    try {
      setUpdating(true);
      await updateTicket(ticket.id, { status: newStatus });
      toast.success('Status updated');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignToMe = async () => {
    try {
      setAssigning(true);
      await assignTicket(ticket.id);
      toast.success('Ticket assigned to you');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign ticket');
    } finally {
      setAssigning(false);
    }
  };

  const handleCreateBranch = async () => {
    try {
      setCreatingBranch(true);
      const result = await createGitHubBranch(ticket.id);
      toast.success(`Branch created: ${result.branchName}`);
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create branch');
    } finally {
      setCreatingBranch(false);
    }
  };

  const handleCreatePR = async () => {
    try {
      setCreatingPR(true);
      const result = await createGitHubPR(ticket.id);
      toast.success('Pull request created');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create PR');
    } finally {
      setCreatingPR(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-2xl">{ticket.title}</DialogTitle>
            <Badge
              className={cn(
                'text-xs',
                ticket.type === 'feature' && 'bg-blue-100 text-blue-800',
                ticket.type === 'bug' && 'bg-red-100 text-red-800',
                ticket.type === 'enhancement' && 'bg-purple-100 text-purple-800',
                ticket.type === 'refactor' && 'bg-yellow-100 text-yellow-800',
                ticket.type === 'test' && 'bg-green-100 text-green-800',
                ticket.type === 'documentation' && 'bg-gray-100 text-gray-800',
                ticket.type === 'setup' && 'bg-orange-100 text-orange-800'
              )}
            >
              {ticket.type}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-tertiary">
            <span className="font-mono">#{ticket.orderIndex + 1}</span>
            <span>•</span>
            <span className="capitalize">{ticket.priority} priority</span>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Status and Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <Select
                value={ticket.status}
                onValueChange={(value) => handleStatusChange(value as TicketStatus)}
                disabled={updating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!ticket.assignee && (
              <Button onClick={handleAssignToMe} disabled={assigning}>
                {assigning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <User className="h-4 w-4 mr-2" />
                )}
                Assign to Me
              </Button>
            )}

            {ticket.assignee && !ticket.branchName && (
              <Button onClick={handleCreateBranch} disabled={creatingBranch}>
                {creatingBranch ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <GitBranch className="h-4 w-4 mr-2" />
                )}
                Create Branch
              </Button>
            )}

            {ticket.branchName && !ticket.prUrl && (
              <Button onClick={handleCreatePR} disabled={creatingPR}>
                {creatingPR ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Github className="h-4 w-4 mr-2" />
                )}
                Create PR
              </Button>
            )}
          </div>

          {/* Description */}
          {ticket.description && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Description</h3>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">
                {ticket.description}
              </p>
            </div>
          )}

          <Separator />

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* Assignee */}
            <div>
              <h4 className="font-semibold mb-1 flex items-center gap-2">
                <User className="h-4 w-4" />
                Assignee
              </h4>
              <p className="text-text-secondary">
                {ticket.assignee ? ticket.assignee.displayName : 'Unassigned'}
              </p>
            </div>

            {/* Estimated Hours */}
            <div>
              <h4 className="font-semibold mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Estimated Hours
              </h4>
              <p className="text-text-secondary">
                {ticket.estimatedHours ? `${ticket.estimatedHours}h` : 'Not estimated'}
              </p>
            </div>

            {/* Branch */}
            {ticket.branchName && (
              <div>
                <h4 className="font-semibold mb-1 flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Branch
                </h4>
                <p className="text-text-secondary font-mono text-xs">
                  {ticket.branchName}
                </p>
              </div>
            )}

            {/* PR URL */}
            {ticket.prUrl && (
              <div>
                <h4 className="font-semibold mb-1 flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  Pull Request
                </h4>
                <a
                  href={ticket.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 text-xs"
                >
                  View PR
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          {/* Dependencies */}
          {ticket.blockedBy && ticket.blockedBy.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Dependencies
                </h3>
                <p className="text-sm text-text-tertiary mb-2">
                  This ticket is blocked by {ticket.blockedBy.length} other ticket(s)
                </p>
                <div className="flex flex-wrap gap-2">
                  {ticket.blockedBy.map((depId: string) => (
                    <Badge key={depId} variant="outline">
                      Ticket {depId}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Acceptance Criteria */}
          {ticket.acceptanceCriteria && ticket.acceptanceCriteria.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Acceptance Criteria
                </h3>
                <div className="space-y-2">
                  {ticket.acceptanceCriteria.map((criterion: AcceptanceCriterion, idx: number) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle2
                        className={cn(
                          'h-4 w-4 mt-0.5 flex-shrink-0',
                          criterion.completed ? 'text-green-600' : 'text-gray-400'
                        )}
                      />
                      <span
                        className={cn(
                          'text-sm',
                          criterion.completed
                            ? 'text-text-tertiary line-through'
                            : 'text-text-secondary'
                        )}
                      >
                        {criterion.criterion}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Affected Files */}
          {ticket.affectedFiles && ticket.affectedFiles.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Affected Files ({ticket.affectedFiles.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {ticket.affectedFiles.map((file: AffectedFile, idx: number) => (
                    <div
                      key={idx}
                      className="p-2 rounded-md bg-gray-50 border border-gray-200"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            file.type === 'create' && 'bg-green-50 text-green-700',
                            file.type === 'modify' && 'bg-blue-50 text-blue-700',
                            file.type === 'delete' && 'bg-red-50 text-red-700'
                          )}
                        >
                          {file.type}
                        </Badge>
                        <code className="text-xs font-mono text-text-secondary">
                          {file.path}
                        </code>
                      </div>
                      {file.reason && (
                        <p className="text-xs text-text-tertiary mt-1">{file.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}