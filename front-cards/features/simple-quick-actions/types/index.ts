/**
 * Simple Quick Actions Types
 *
 * Type definitions for the quick actions feature
 */

// Action types for button clicks
export type QuickActionType = 'create-template' | 'import-batch' | 'view-batches';

// Button state based on project selection
export type QuickActionButtonState = 'enabled' | 'disabled' | 'loading';

// Action button configuration
export interface QuickActionButton {
  id: QuickActionType;
  title: string;
  description: string;
  icon: 'template' | 'upload' | 'cards';
  onClick?: () => void;
}

// Feature state
export interface QuickActionsState {
  isProjectSelected: boolean;
  isLoading: boolean;
  buttonState: QuickActionButtonState;
}