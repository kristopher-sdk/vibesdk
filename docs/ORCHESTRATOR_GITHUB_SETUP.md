# Orchestrator GitHub Integration Setup

## Overview
The Orchestrator now supports three ways to create projects:
1. **From GitHub Repository** - Clone and analyze existing GitHub repos
2. **From Saved App** - Use apps created in the Byte platform
3. **New Blank Project** - Start fresh (can connect to GitHub later)

## GitHub OAuth Setup

### 1. Create GitHub OAuth Application

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: Byte Platform (or your choice)
   - **Homepage URL**: `http://localhost:5173` (for local dev)
   - **Authorization callback URL**: `http://localhost:5173/api/auth/callback/github`
4. Click "Register application"
5. Note your **Client ID** and generate a **Client Secret**

### 2. Configure Environment Variables

Update `.dev.vars` with your GitHub OAuth credentials:

```env
# GitHub OAuth
GITHUB_CLIENT_ID="your_actual_github_client_id_here"
GITHUB_CLIENT_SECRET="your_actual_github_client_secret_here"
```

**IMPORTANT**: Replace the placeholder values with your actual credentials from step 1.

### 3. Restart Development Server

After updating `.dev.vars`, restart your development server:

```bash
# Stop the current server (Ctrl+C)
npm run dev
```

## Features Implemented

### Frontend (CreateProjectModal)

✅ **Three Project Types**
- Visual selection with icons
- GitHub: Input for repository URL
- Saved App: Dropdown of user's apps  
- New Project: Simple title/description form

✅ **Form Validation**
- Required fields per project type
- GitHub URL validation
- Clear error messages

✅ **User Experience**
- Tab-style type selection
- Context-specific help text
- Success animation on creation

### Backend (OrchestrationService)

✅ **Multi-Source Project Creation**
```typescript
async createProject(data: CreateProjectRequest, userId: string): Promise<Project>
```

Handles three sources:
- `ProjectSource.APP` - From existing Byte apps
- `ProjectSource.GITHUB` - From GitHub repository URL
- `ProjectSource.NEW` - New blank project

✅ **GitHub Repository Analysis**
- Extracts repo name from URL
- Stores GitHub metadata in project
- Ready for future code analysis

✅ **Flexible App Association**
- GitHub/New projects get placeholder app IDs
- Maintains database relationships
- Can be connected to real apps later

### Type Definitions

✅ **New Orchestrator Types**
```typescript
export enum ProjectSource {
    APP = 'app',
    GITHUB = 'github',
    NEW = 'new',
}

export interface CreateProjectRequest {
    source: ProjectSource;
    appId?: string;        // Required for APP source
    title?: string;
    githubRepoUrl?: string; // Required for GITHUB source
    description?: string;
}
```

## User Workflow

### Option 1: GitHub Repository

1. User clicks "Create Project"
2. Selects "GitHub Repo" tab
3. Enters repository URL: `https://github.com/username/repo`
4. Optionally customizes title/description
5. System:
   - Extracts repo information
   - Creates orchestration project
   - (Future) Clones and analyzes code
   - Generates development tickets

### Option 2: Saved App

1. User clicks "Create Project"
2. Selects "Saved App" tab (default)
3. Chooses from dropdown of their apps
4. Optionally customizes project title
5. System:
   - Analyzes app structure
   - Generates development tickets
   - Creates GitHub repo (if requested)

### Option 3: New Project

1. User clicks "Create Project"
2. Selects "New Project" tab
3. Enters title and optional description
4. System:
   - Creates empty orchestration project
   - User can add GitHub repo later
   - Manual ticket creation or AI generation

## Authentication Flow

### With GitHub OAuth Enabled

1. User visits Orchestrator page
2. If not authenticated, login modal appears
3. Modal shows "Continue with GitHub" button
4. User clicks → redirected to GitHub
5. Approves access → redirected back
6. Automatically logged in and can use Orchestrator

### Current State (Testing)

- Authentication temporarily disabled
- Direct access to Orchestrator for development
- Re-enable by uncommenting auth middleware

## Next Steps

### Immediate (Required for Production)

1. **Add Real GitHub Credentials**
   - Replace placeholders in `.dev.vars`
   - Test OAuth flow end-to-end

2. **Re-enable Authentication**
   ```typescript
   // In worker/api/routes/orchestratorRoutes.ts
   orchestratorRouter.get('/projects',
       setAuthLevel(AuthConfig.authenticated), // Uncomment this
       adaptController(...)
   );
   ```

3. **Test Complete Flow**
   - GitHub login
   - Project creation (all 3 types)
   - Ticket generation

### Future Enhancements

1. **GitHub Repository Analysis**
   - Clone repository code
   - Parse file structure
   - Identify technologies used
   - Generate intelligent tickets

2. **Connect Existing Projects to GitHub**
   - Add "Connect to GitHub" button
   - Link new/blank projects to repos
   - Sync code changes

3. **GitHub Integration Features**
   - Auto-create repository from project
   - Create branches for tickets
   - Open pull requests
   - Sync PR status with tickets

4. **Ticket Generation from GitHub**
   - Analyze existing issues
   - Convert issues to tickets
   - Import project board structure

## File Structure

```
worker/
  services/orchestrator/
    OrchestrationService.ts    # Project creation logic
  api/
    routes/orchestratorRoutes.ts  # API endpoints
    controllers/orchestrator/
      controller.ts             # Request handlers
  database/
    services/AuthService.ts     # OAuth implementation

src/
  pages/Orchestrator/
    CreateProjectModal.tsx      # Enhanced UI
    OrchestratorPage.tsx        # Main page
  services/
    orchestratorApi.ts          # API client
  contexts/
    auth-context.tsx            # Auth state management
  components/auth/
    login-modal.tsx             # OAuth login UI

shared/types/
  orchestrator.ts               # Type definitions

migrations/
  0004_create_orchestration_tables.sql  # Database schema
```

## Troubleshooting

### GitHub OAuth Not Working

**Problem**: Login button doesn't redirect to GitHub
**Solution**: 
1. Verify credentials in `.dev.vars`
2. Check callback URL matches GitHub app settings
3. Ensure server restarted after env changes

### "App ID Required" Error

**Problem**: GitHub/New projects fail with appId error
**Solution**: Backend now handles this automatically with placeholder IDs

### Projects Not Appearing

**Problem**: Created projects don't show in list
**Solution**:
1. Check browser console for errors
2. Verify API endpoint responding: `GET /api/orchestrator/projects`
3. Check database migrations applied

## Security Notes

- **Never commit** `.dev.vars` or real credentials to git
- GitHub tokens should be scoped appropriately
- Production setup requires proper secret management
- Use environment variables for all sensitive data

## Support

For issues or questions:
1. Check terminal for error logs
2. Review browser console
3. Verify all environment variables set
4. Ensure database migrations applied