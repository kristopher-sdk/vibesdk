import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, GitBranch, AlertCircle, User, Link as LinkIcon } from 'lucide-react';
import type { TicketWithRelations, TicketType, TicketPriority } from '../../../shared/types/orchestrator';
import { cn } from '@/lib/utils';

interface TicketCardProps {
  ticket: TicketWithRelations;
  onClick: () => void;
  layout?: 'card' | 'list';
}

const TYPE_COLORS: Record<TicketType, string> = {
  feature: 'bg-blue-100 text-blue-800',
  enhancement: 'bg-purple-100 text-purple-800',
  bug: 'bg-red-100 text-red-800',
  refactor: 'bg-yellow-100 text-yellow-800',
  test: 'bg-green-100 text-green-800',
  documentation: 'bg-gray-100 text-gray-800',
  setup: 'bg-orange-100 text-orange-800',
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  critical: 'text-red-600',
  high: 'text-orange-600',
  medium: 'text-yellow-600',
  low: 'text-gray-600',
};

const COMPLEXITY_DOTS = {
  low: 1,
  medium: 2,
  high: 3,
};

export function TicketCard({ ticket, onClick, layout = 'card' }: TicketCardProps) {
  const complexity =
    ticket.estimatedHours && ticket.estimatedHours <= 2
      ? 'low'
      : ticket.estimatedHours && ticket.estimatedHours <= 8
        ? 'medium'
        : 'high';

  if (layout === 'list') {
    return (
      <Card
        className="p-4 hover:shadow-md transition-shadow cursor-pointer group"
        onClick={onClick}
      >
        <div className="flex items-center gap-4">
          {/* Ticket Number */}
          <div className="flex-shrink-0 w-20 text-sm font-mono text-text-tertiary">
            #{ticket.orderIndex + 1}
          </div>

          {/* Title and Type */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-text-primary group-hover:text-primary transition-colors truncate">
                {ticket.title}
              </h4>
              <Badge className={cn('text-xs', TYPE_COLORS[ticket.type])}>
                {ticket.type}
              </Badge>
            </div>
            {ticket.description && (
              <p className="text-sm text-text-tertiary line-clamp-1">
                {ticket.description}
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Assignee */}
            {ticket.assignee && (
              <div className="flex items-center gap-1 text-sm">
                <User className="h-4 w-4 text-text-tertiary" />
                <span className="text-text-secondary">{ticket.assignee.displayName}</span>
              </div>
            )}

            {/* Estimated Hours */}
            {ticket.estimatedHours && (
              <div className="flex items-center gap-1 text-sm">
                <Clock className="h-4 w-4 text-text-tertiary" />
                <span className="text-text-secondary">{ticket.estimatedHours}h</span>
              </div>
            )}

            {/* Dependencies */}
            {ticket.blockedBy && ticket.blockedBy.length > 0 && (
              <div className="flex items-center gap-1 text-sm">
                <LinkIcon className="h-4 w-4 text-orange-500" />
                <span className="text-orange-600">{ticket.blockedBy.length}</span>
              </div>
            )}

            {/* Branch */}
            {ticket.branchName && (
              <GitBranch className="h-4 w-4 text-green-600" />
            )}

            {/* Priority */}
            <AlertCircle className={cn('h-5 w-5', PRIORITY_COLORS[ticket.priority])} />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="p-4 hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-text-tertiary">
                #{ticket.orderIndex + 1}
              </span>
              <Badge className={cn('text-xs', TYPE_COLORS[ticket.type])}>
                {ticket.type}
              </Badge>
            </div>
            <h4 className="font-semibold text-sm text-text-primary group-hover:text-primary transition-colors line-clamp-2">
              {ticket.title}
            </h4>
          </div>
          <AlertCircle className={cn('h-4 w-4 flex-shrink-0', PRIORITY_COLORS[ticket.priority])} />
        </div>

        {/* Description */}
        {ticket.description && (
          <p className="text-xs text-text-tertiary line-clamp-2">{ticket.description}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <div className="flex items-center gap-3">
            {/* Complexity */}
            <div className="flex gap-0.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    i < COMPLEXITY_DOTS[complexity]
                      ? 'bg-primary'
                      : 'bg-gray-300'
                  )}
                />
              ))}
            </div>

            {/* Estimated Hours */}
            {ticket.estimatedHours && (
              <div className="flex items-center gap-1 text-xs text-text-tertiary">
                <Clock className="h-3 w-3" />
                <span>{ticket.estimatedHours}h</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Dependencies */}
            {ticket.blockedBy && ticket.blockedBy.length > 0 && (
              <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                <LinkIcon className="h-3 w-3 mr-1" />
                {ticket.blockedBy.length}
              </Badge>
            )}

            {/* Assignee */}
            {ticket.assignee && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3 text-text-tertiary" />
              </div>
            )}

            {/* Branch */}
            {ticket.branchName && (
              <GitBranch className="h-3 w-3 text-green-600" />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}