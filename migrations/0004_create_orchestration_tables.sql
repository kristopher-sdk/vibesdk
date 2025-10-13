-- ========================================
-- ORCHESTRATION LAYER - PHASE 2
-- Migration: Create orchestration tables
-- ========================================

-- ========================================
-- PROJECTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS orchestration_projects (
    id TEXT PRIMARY KEY,
    
    -- Relationship to Byte Platform app
    app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    
    -- Project Identity
    title TEXT NOT NULL,
    description TEXT,
    
    -- Status Management
    status TEXT NOT NULL DEFAULT 'analyzing' CHECK (status IN (
        'analyzing',      -- AI is analyzing prototype
        'review',         -- Awaiting stakeholder review
        'approved',       -- Stakeholder approved ticket plan
        'in_progress',    -- Development in progress
        'completed',      -- All tickets completed
        'archived'        -- Project archived
    )),
    
    -- GitHub Integration
    github_repo_url TEXT,
    github_repo_name TEXT,
    github_default_branch TEXT DEFAULT 'main',
    
    -- Ownership
    stakeholder_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    
    -- Analysis Results (JSON)
    analysis_result TEXT, -- JSON: complexity, features, tech stack
    
    -- Statistics (cached for performance)
    total_tickets INTEGER DEFAULT 0,
    completed_tickets INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    analyzed_at INTEGER, -- When AI analysis completed
    approved_at INTEGER, -- When stakeholder approved
    completed_at INTEGER, -- When all tickets completed
    
    -- Indexes
    UNIQUE(app_id)
);

CREATE INDEX idx_projects_status ON orchestration_projects(status);
CREATE INDEX idx_projects_stakeholder ON orchestration_projects(stakeholder_user_id);
CREATE INDEX idx_projects_created ON orchestration_projects(created_at DESC);

-- ========================================
-- TICKETS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS orchestration_tickets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES orchestration_projects(id) ON DELETE CASCADE,
    
    -- Ticket Identity
    title TEXT NOT NULL,
    description TEXT NOT NULL, -- Markdown format
    
    -- Classification
    type TEXT NOT NULL CHECK (type IN (
        'feature',        -- New feature implementation
        'enhancement',    -- Enhancement to existing feature
        'bug',           -- Bug fix
        'refactor',      -- Code refactoring
        'test',          -- Test implementation
        'documentation', -- Documentation
        'setup'          -- Project setup/configuration
    )),
    
    -- Priority & Estimation
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN (
        'critical',
        'high',
        'medium',
        'low'
    )),
    estimated_hours INTEGER, -- AI-estimated effort in hours
    actual_hours INTEGER,    -- Developer-reported time
    
    -- Status Management
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',       -- Not yet started
        'ready',         -- Dependencies met, ready to start
        'assigned',      -- Assigned to developer
        'in_progress',   -- Being worked on
        'review',        -- In code review
        'blocked',       -- Blocked by dependencies
        'completed',     -- Finished
        'cancelled'      -- Cancelled by stakeholder
    )),
    
    -- Order and Organization
    order_index INTEGER NOT NULL, -- Display order
    category TEXT, -- Optional grouping (e.g., "Frontend", "Backend")
    tags TEXT,     -- JSON array of tags
    
    -- Git Integration
    branch_name TEXT,
    pr_url TEXT,
    commit_count INTEGER DEFAULT 0,
    
    -- File References (JSON)
    affected_files TEXT, -- JSON: [{path, reason, type}]
    
    -- Acceptance Criteria (JSON)
    acceptance_criteria TEXT, -- JSON: [{criterion, completed}]
    
    -- Metadata
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    started_at INTEGER,   -- When developer started work
    completed_at INTEGER  -- When marked complete
);

CREATE INDEX idx_tickets_project ON orchestration_tickets(project_id);
CREATE INDEX idx_tickets_status ON orchestration_tickets(status);
CREATE INDEX idx_tickets_priority ON orchestration_tickets(priority);
CREATE INDEX idx_tickets_order ON orchestration_tickets(project_id, order_index);
CREATE INDEX idx_tickets_branch ON orchestration_tickets(branch_name) WHERE branch_name IS NOT NULL;

-- ========================================
-- TICKET DEPENDENCIES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS orchestration_ticket_dependencies (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES orchestration_tickets(id) ON DELETE CASCADE,
    depends_on_ticket_id TEXT NOT NULL REFERENCES orchestration_tickets(id) ON DELETE CASCADE,
    
    -- Dependency Type
    dependency_type TEXT NOT NULL DEFAULT 'blocks' CHECK (dependency_type IN (
        'blocks',        -- Must complete before starting
        'related',       -- Loosely related
        'file_conflict'  -- Works on same files
    )),
    
    -- Metadata
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    
    -- Constraints
    UNIQUE(ticket_id, depends_on_ticket_id),
    CHECK(ticket_id != depends_on_ticket_id)
);

CREATE INDEX idx_dependencies_ticket ON orchestration_ticket_dependencies(ticket_id);
CREATE INDEX idx_dependencies_blocks ON orchestration_ticket_dependencies(depends_on_ticket_id);

-- ========================================
-- TICKET ASSIGNMENTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS orchestration_ticket_assignments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES orchestration_tickets(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Assignment Status
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN (
        'assigned',      -- Currently assigned
        'unassigned',    -- Was assigned, now released
        'completed'      -- Assignment completed
    )),
    
    -- Timestamps
    assigned_at INTEGER NOT NULL DEFAULT (unixepoch()),
    unassigned_at INTEGER,
    completed_at INTEGER,
    
    -- Constraints
    UNIQUE(ticket_id, user_id, status)
);

CREATE INDEX idx_assignments_ticket ON orchestration_ticket_assignments(ticket_id);
CREATE INDEX idx_assignments_user ON orchestration_ticket_assignments(user_id, status);
CREATE INDEX idx_assignments_active ON orchestration_ticket_assignments(status) WHERE status = 'assigned';

-- ========================================
-- TICKET ACTIVITY TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS orchestration_ticket_activity (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES orchestration_tickets(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    
    -- Activity Details
    action TEXT NOT NULL CHECK (action IN (
        'created',
        'status_changed',
        'assigned',
        'unassigned',
        'comment_added',
        'priority_changed',
        'description_updated',
        'branch_created',
        'pr_opened',
        'pr_merged',
        'completed',
        'reopened'
    )),
    
    -- Change Details (JSON)
    details TEXT, -- JSON: {from, to, comment, etc.}
    
    -- Context
    source TEXT DEFAULT 'web' CHECK (source IN (
        'web',        -- Byte Platform web UI
        'vscode',     -- VS Code extension
        'api',        -- Direct API call
        'system'      -- Automated system action
    )),
    
    -- Timestamp
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_activity_ticket ON orchestration_ticket_activity(ticket_id, created_at DESC);
CREATE INDEX idx_activity_user ON orchestration_ticket_activity(user_id, created_at DESC);

-- ========================================
-- PROJECT CONTEXT TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS orchestration_project_context (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES orchestration_projects(id) ON DELETE CASCADE,
    
    -- Context Type
    context_type TEXT NOT NULL CHECK (context_type IN (
        'tech_stack',      -- Technologies used
        'file_structure',  -- Project file organization
        'dependencies',    -- NPM/package dependencies
        'api_endpoints',   -- API routes defined
        'database_schema', -- Database tables/fields
        'environment_vars', -- Required env variables
        'features'         -- High-level features list
    )),
    
    -- Context Data (JSON)
    data TEXT NOT NULL, -- JSON object with context-specific structure
    
    -- Metadata
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    
    -- Constraints
    UNIQUE(project_id, context_type)
);

CREATE INDEX idx_context_project ON orchestration_project_context(project_id);
CREATE INDEX idx_context_type ON orchestration_project_context(context_type);

-- ========================================
-- WEBSOCKET CONNECTIONS TABLE (KV Alternative)
-- ========================================
CREATE TABLE IF NOT EXISTS orchestration_ws_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES orchestration_projects(id) ON DELETE CASCADE,
    
    -- Connection Details
    connection_id TEXT NOT NULL UNIQUE,
    client_type TEXT NOT NULL CHECK (client_type IN ('web', 'vscode')),
    
    -- State
    is_active INTEGER NOT NULL DEFAULT 1,
    
    -- Metadata
    connected_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_heartbeat INTEGER NOT NULL DEFAULT (unixepoch()),
    
    -- Cleanup
    expires_at INTEGER NOT NULL
);

CREATE INDEX idx_ws_user ON orchestration_ws_connections(user_id);
CREATE INDEX idx_ws_project ON orchestration_ws_connections(project_id);
CREATE INDEX idx_ws_active ON orchestration_ws_connections(is_active, expires_at);