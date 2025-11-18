# Simple Quick Actions Feature

## Overview

The Simple Quick Actions feature provides a dashboard component with quick action buttons for common tasks in the E-Cards application. The component is project-aware and disables actions when no project is selected.

## Components

### QuickActions

Main component that displays three primary actions:
- **Create Template**: Opens template designer for new card templates
- **Import Batch**: Initiates batch import workflow for Excel/text data
- **View Batches**: Navigate to batch management interface

## Features

### Project-Based Enabling

The component integrates with the `simple-projects` feature to:
- Check if a project is currently selected
- Disable all action buttons when no project is selected
- Show visual feedback for disabled state (grayed out, reduced opacity)
- Display informative message when actions are disabled

### Visual States

1. **Enabled State** (project selected):
   - Full color icons and text
   - Hover effects (blue border and background)
   - Cursor pointer on hover
   - Full opacity

2. **Disabled State** (no project):
   - Grayed out appearance
   - 50% opacity
   - Cursor not-allowed
   - No hover effects
   - Warning badge: "Select a project to enable actions"

3. **Loading State**:
   - Shows loading spinner while projects are being fetched
   - Actions remain disabled during loading

## Usage

```tsx
import { QuickActions } from '@/features/simple-quick-actions';

function Dashboard() {
  return (
    <QuickActions
      onCreateTemplate={() => router.push('/templates/new')}
      onImportBatch={() => router.push('/batches/import')}
      onViewBatches={() => router.push('/batches')}
      className="mb-6"
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onCreateTemplate` | `() => void` | No | Callback when Create Template is clicked |
| `onImportBatch` | `() => void` | No | Callback when Import Batch is clicked |
| `onViewBatches` | `() => void` | No | Callback when View Batches is clicked |
| `className` | `string` | No | Additional CSS classes for the container |

## Dependencies

- `@/features/simple-projects`: For `useProjects` hook to get selected project state
- React 18+ for client components

## Styling

The component uses Tailwind CSS classes and includes:
- Responsive grid layout (1 column on mobile, 3 on desktop)
- Consistent button styling with dashed borders
- Smooth transitions for hover states
- Accessibility attributes (aria-label, title)

## Accessibility

- Proper ARIA labels for screen readers
- Descriptive title attributes for tooltips
- Disabled state properly communicated
- Keyboard navigation support

## Future Enhancements

Potential improvements for future iterations:
- Add more quick actions (e.g., Recent Templates, Quick Stats)
- Customizable action buttons via props
- Animation for state transitions
- Keyboard shortcuts for quick actions
- Integration with analytics to track usage