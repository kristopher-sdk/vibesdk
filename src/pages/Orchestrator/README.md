# Orchestrator Frontend UI

This directory contains the complete frontend user interface for the Byte Platform orchestration system.

## Features Implemented

### ✅ Core Functionality
- **Project Management**: Create, view, and manage development projects
- **Ticket Visualization**: Kanban board and list views for tickets
- **Real-time Updates**: WebSocket integration for live status changes
- **GitHub Integration**: Create repositories, branches, and pull requests
- **Ticket Assignment**: Assign tickets to developers
- **Status Management**: Update ticket and project statuses
- **Filtering**: Filter projects by status and search by name

### 📁 Components

#### Pages
- **OrchestratorPage.tsx**: Main orchestrator page with project list
- **ProjectDetail.tsx**: Detailed project view with tickets
- **ProjectList.tsx**: Grid view of all projects with filters
- **CreateProjectModal.tsx**: Modal to create new projects from apps

#### Components
- **TicketCard.tsx**: Individual ticket display (card and list layouts)
- **TicketDetailModal.tsx**: Expanded ticket view with full details
- **ProjectStatusBadge.tsx**: Visual status indicator for projects

### 🔌 Services & Hooks

#### API Client (`src/services/orchestratorApi.ts`)
- `createProject()` - Create new project from app
- `getProjects()` - Fetch all user projects
- `getProject()` - Get single project with tickets
- `generateTickets()` - Trigger AI ticket generation
- `updateProject()` - Approve/regenerate/archive project
- `getProjectTickets()` - Fetch project tickets
- `assignTicket()` - Assign ticket to developer
- `updateTicket()` - Update ticket status/details
- `createGitHubRepo()` - Create GitHub repository
- `createGitHubBranch()` - Create feature branch
- `createGitHubPR()` - Create pull request

#### WebSocket Hook (`src/hooks/useOrchestratorWebSocket.ts`)
- Real-time connection management
- Automatic reconnection on disconnect
- Heartbeat mechanism
- Event handlers for:
  - Ticket updates
  - Status changes
  - Project updates
- Environment-aware WebSocket URL

## Design System

### Colors
- **Primary Blue**: `#2563eb` (buttons, links, actions)
- **Hover Blue**: `#3b82f6`
- **Light Blue**: `#60a5fa`
- **Gray Backgrounds**: `#f3f4f6`, `#e5e7eb`

### Status Colors
- **Analyzing**: Blue (animated spinner)
- **Review**: Yellow
- **Approved**: Green
- **In Progress**: Blue
- **Completed**: Green
- **Blocked**: Red
- **Archived**: Gray

### Ticket Type Colors
- **Feature**: Blue
- **Bug**: Red
- **Enhancement**: Purple
- **Refactor**: Yellow
- **Test**: Green
- **Documentation**: Gray
- **Setup**: Orange

## Routes

```typescript
/orchestrator - Main orchestrator page
/orchestrator/projects/:id - Project detail page
```

## Usage Examples

### Creating a Project
```typescript
import { createProject } from '@/services/orchestratorApi';

const result = await createProject('app-id', 'Optional Project Title');
// Returns: { project: Project, message: string }
```

### Using WebSocket Updates
```typescript
import { useOrchestratorWebSocket } from '@/hooks/useOrchestratorWebSocket';

const { connected, authenticated } = useOrchestratorWebSocket({
  projectId: 'proj-123',
  onTicketUpdated: (message) => {
    console.log('Ticket updated:', message.ticketId);
  },
  onTicketStatusChanged: (message) => {
    console.log('Status changed:', message.newStatus);
  },
});
```

## TypeScript Types

All types are imported from `shared/types/orchestrator.ts`:
- `Project`, `ProjectWithRelations`
- `Ticket`, `TicketWithRelations`
- `ProjectStatus`, `TicketStatus`
- `TicketType`, `TicketPriority`
- `AcceptanceCriterion`, `AffectedFile`
- `CreateProjectRequest`, `UpdateProjectRequest`
- And more...

## Navigation

The Orchestrator link is added to the main sidebar navigation (after Apps section) using the Network icon.

## Responsive Design

- Mobile-friendly layouts
- Responsive grid systems
- Collapsible sidebars
- Touch-optimized interactions

## Loading States

- Skeleton loaders for project list
- Spinners for async operations
- Progress indicators for long operations
- Optimistic UI updates

## Error Handling

- User-friendly error messages
- Toast notifications for actions
- Graceful fallbacks
- Retry mechanisms

## Testing

Reference `docs/PHASE_2_TESTING_GUIDE.md` for:
- API endpoint testing
- WebSocket connection testing
- Expected response formats
- Error scenarios

## Future Enhancements

- Drag-and-drop for ticket status changes
- Ticket comments/activity timeline
- Team member management
- Advanced filtering and sorting
- Analytics dashboard
- Ticket templates
- Bulk operations
- Export functionality