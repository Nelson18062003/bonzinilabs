import { cn } from '@/lib/utils';
import { LucideIcon, Check, Clock, AlertCircle, Upload, Send, FileText } from 'lucide-react';
import { formatDate } from '@/data/mockData';

interface TimelineStep {
  id: string;
  title: string;
  description?: string;
  timestamp?: Date;
  status: 'completed' | 'current' | 'pending';
  actor?: string;
  icon?: LucideIcon;
}

interface AdminTimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export function AdminTimeline({ steps, className }: AdminTimelineProps) {
  const getDefaultIcon = (status: TimelineStep['status']) => {
    switch (status) {
      case 'completed':
        return Check;
      case 'current':
        return Clock;
      default:
        return Clock;
    }
  };

  return (
    <div className={cn('admin-timeline', className)}>
      {steps.map((step, index) => {
        const Icon = step.icon || getDefaultIcon(step.status);
        
        return (
          <div key={step.id} className="admin-timeline-item">
            <div className="admin-timeline-line" />
            <div className={cn(
              'admin-timeline-indicator',
              step.status === 'completed' && 'completed',
              step.status === 'current' && 'current',
              step.status === 'pending' && 'pending',
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="admin-timeline-content">
              <p className="admin-timeline-title">{step.title}</p>
              {step.description && (
                <p className="admin-timeline-description">{step.description}</p>
              )}
              {(step.timestamp || step.actor) && (
                <p className="admin-timeline-timestamp">
                  {step.timestamp && formatDate(step.timestamp, 'datetime')}
                  {step.timestamp && step.actor && ' • '}
                  {step.actor}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Helper to convert deposit timeline events to timeline steps
export function mapDepositTimelineToSteps(events: Array<{
  step: string;
  description: string;
  createdAt: Date;
  performedBy: 'CLIENT' | 'ADMIN' | 'SYSTEM';
}>): TimelineStep[] {
  const iconMap: Record<string, LucideIcon> = {
    SUBMITTED: Send,
    PROOF_UPLOADED: Upload,
    UNDER_VERIFICATION: AlertCircle,
    VALIDATED: Check,
    REJECTED: AlertCircle,
  };

  const actorMap: Record<string, string> = {
    CLIENT: 'Client',
    ADMIN: 'Admin',
    SYSTEM: 'Système',
  };

  return events.map((event, index) => ({
    id: `${event.step}-${index}`,
    title: event.description,
    timestamp: event.createdAt,
    status: index === events.length - 1 ? 'current' : 'completed',
    actor: actorMap[event.performedBy],
    icon: iconMap[event.step],
  }));
}

// Helper to convert payment timeline events to timeline steps
export function mapPaymentTimelineToSteps(events: Array<{
  step: string;
  description: string;
  createdAt: Date;
  performedBy: 'CLIENT' | 'ADMIN' | 'SYSTEM';
}>): TimelineStep[] {
  const iconMap: Record<string, LucideIcon> = {
    SUBMITTED: Send,
    INFO_RECEIVED: FileText,
    PROCESSING: Clock,
    COMPLETED: Check,
    PROOF_AVAILABLE: Upload,
    CANCELLED: AlertCircle,
  };

  const actorMap: Record<string, string> = {
    CLIENT: 'Client',
    ADMIN: 'Admin',
    SYSTEM: 'Système',
  };

  return events.map((event, index) => ({
    id: `${event.step}-${index}`,
    title: event.description,
    timestamp: event.createdAt,
    status: index === events.length - 1 ? 'current' : 'completed',
    actor: actorMap[event.performedBy],
    icon: iconMap[event.step],
  }));
}
