import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, CheckCircle, Play, Archive } from 'lucide-react';
import type { ProjectStatus } from '../../../shared/types/orchestrator';
import { cn } from '@/lib/utils';

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; color: string; icon: React.ReactNode; animated?: boolean }
> = {
  analyzing: {
    label: 'Analyzing',
    color: 'bg-blue-500',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    animated: true,
  },
  review: {
    label: 'Review',
    color: 'bg-yellow-500',
    icon: <Eye className="h-3 w-3" />,
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-500',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-blue-600',
    icon: <Play className="h-3 w-3" />,
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-600',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  archived: {
    label: 'Archived',
    color: 'bg-gray-500',
    icon: <Archive className="h-3 w-3" />,
  },
};

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge
      className={cn(
        'flex items-center gap-1.5 text-white border-0',
        config.color,
        className
      )}
    >
      {config.icon}
      <span className="text-xs font-medium">{config.label}</span>
    </Badge>
  );
}