/**
 * Simple Quick Actions Feature
 *
 * Provides a quick actions component for the dashboard that is project-aware.
 * Actions are disabled when no project is selected.
 */

// Export main component
export { QuickActions } from './components/QuickActions';

// Export the props interface for external use
export interface QuickActionsProps {
  onCreateTemplate?: () => void;
  onViewBatches?: () => void;
  className?: string;
}