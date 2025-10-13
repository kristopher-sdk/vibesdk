import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './schema';
import { apps } from './schema';

// ========================================
// ORCHESTRATION LAYER SCHEMAS
// ========================================

/**
 * Orchestration Projects table - Manages development projects created from apps
 */
export const orchestrationProjects = sqliteTable('orchestration_projects', {
    id: text('id').primaryKey(),
    
    // Relationship to Byte Platform app
    appId: text('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
    
    // Project Identity
    title: text('title').notNull(),
    description: text('description'),
    
    // Status Management
    status: text('status', { 
        enum: ['analyzing', 'review', 'approved', 'in_progress', 'completed', 'archived'] 
    }).notNull().default('analyzing'),
    
    // GitHub Integration
    githubRepoUrl: text('github_repo_url'),
    githubRepoName: text('github_repo_name'),
    githubDefaultBranch: text('github_default_branch').default('main'),
    
    // Ownership
    stakeholderUserId: text('stakeholder_user_id').references(() => users.id, { onDelete: 'set null' }),
    
    // Analysis Results (JSON)
    analysisResult: text('analysis_result', { mode: 'json' }), // JSON: complexity, features, tech stack
    
    // Statistics (cached for performance)
    totalTickets: integer('total_tickets').default(0),
    completedTickets: integer('completed_tickets').default(0),
    
    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    analyzedAt: integer('analyzed_at', { mode: 'timestamp' }),
    approvedAt: integer('approved_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
    appIdIdx: uniqueIndex('orchestration_projects_app_id_idx').on(table.appId),
    statusIdx: index('idx_projects_status').on(table.status),
    stakeholderIdx: index('idx_projects_stakeholder').on(table.stakeholderUserId),
    createdIdx: index('idx_projects_created').on(table.createdAt),
}));

/**
 * Orchestration Tickets table - Individual development tasks
 */
export const orchestrationTickets = sqliteTable('orchestration_tickets', {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => orchestrationProjects.id, { onDelete: 'cascade' }),
    
    // Ticket Identity
    title: text('title').notNull(),
    description: text('description').notNull(), // Markdown format
    
    // Classification
    type: text('type', { 
        enum: ['feature', 'enhancement', 'bug', 'refactor', 'test', 'documentation', 'setup'] 
    }).notNull(),
    
    // Priority & Estimation
    priority: text('priority', { 
        enum: ['critical', 'high', 'medium', 'low'] 
    }).notNull().default('medium'),
    estimatedHours: integer('estimated_hours'),
    actualHours: integer('actual_hours'),
    
    // Status Management
    status: text('status', { 
        enum: ['pending', 'ready', 'assigned', 'in_progress', 'review', 'blocked', 'completed', 'cancelled'] 
    }).notNull().default('pending'),
    
    // Order and Organization
    orderIndex: integer('order_index').notNull(),
    category: text('category'),
    tags: text('tags', { mode: 'json' }), // JSON array of tags
    
    // Git Integration
    branchName: text('branch_name'),
    prUrl: text('pr_url'),
    commitCount: integer('commit_count').default(0),
    
    // File References (JSON)
    affectedFiles: text('affected_files', { mode: 'json' }), // JSON: [{path, reason, type}]
    
    // Acceptance Criteria (JSON)
    acceptanceCriteria: text('acceptance_criteria', { mode: 'json' }), // JSON: [{criterion, completed}]
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
    projectIdx: index('idx_tickets_project').on(table.projectId),
    statusIdx: index('idx_tickets_status').on(table.status),
    priorityIdx: index('idx_tickets_priority').on(table.priority),
    orderIdx: index('idx_tickets_order').on(table.projectId, table.orderIndex),
    branchIdx: index('idx_tickets_branch').on(table.branchName),
}));

/**
 * Orchestration Ticket Dependencies table - Tracks dependencies between tickets
 */
export const orchestrationTicketDependencies = sqliteTable('orchestration_ticket_dependencies', {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id').notNull().references(() => orchestrationTickets.id, { onDelete: 'cascade' }),
    dependsOnTicketId: text('depends_on_ticket_id').notNull().references(() => orchestrationTickets.id, { onDelete: 'cascade' }),
    
    // Dependency Type
    dependencyType: text('dependency_type', { 
        enum: ['blocks', 'related', 'file_conflict'] 
    }).notNull().default('blocks'),
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => ({
    ticketDependsIdx: uniqueIndex('orchestration_ticket_dependencies_unique_idx').on(table.ticketId, table.dependsOnTicketId),
    ticketIdx: index('idx_dependencies_ticket').on(table.ticketId),
    blocksIdx: index('idx_dependencies_blocks').on(table.dependsOnTicketId),
}));

/**
 * Orchestration Ticket Assignments table - Tracks ticket assignments to developers
 */
export const orchestrationTicketAssignments = sqliteTable('orchestration_ticket_assignments', {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id').notNull().references(() => orchestrationTickets.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    // Assignment Status
    status: text('status', { 
        enum: ['assigned', 'unassigned', 'completed'] 
    }).notNull().default('assigned'),
    
    // Timestamps
    assignedAt: integer('assigned_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    unassignedAt: integer('unassigned_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
    ticketUserStatusIdx: uniqueIndex('orchestration_ticket_assignments_unique_idx').on(table.ticketId, table.userId, table.status),
    ticketIdx: index('idx_assignments_ticket').on(table.ticketId),
    userIdx: index('idx_assignments_user').on(table.userId, table.status),
    activeIdx: index('idx_assignments_active').on(table.status),
}));

/**
 * Orchestration Ticket Activity table - Audit log for ticket changes
 */
export const orchestrationTicketActivity = sqliteTable('orchestration_ticket_activity', {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id').notNull().references(() => orchestrationTickets.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    
    // Activity Details
    action: text('action', { 
        enum: [
            'created', 'status_changed', 'assigned', 'unassigned', 
            'comment_added', 'priority_changed', 'description_updated',
            'branch_created', 'pr_opened', 'pr_merged', 'completed', 'reopened'
        ] 
    }).notNull(),
    
    // Change Details (JSON)
    details: text('details', { mode: 'json' }), // JSON: {from, to, comment, etc.}
    
    // Context
    source: text('source', { 
        enum: ['web', 'vscode', 'api', 'system'] 
    }).default('web'),
    
    // Timestamp
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => ({
    ticketIdx: index('idx_activity_ticket').on(table.ticketId, table.createdAt),
    userIdx: index('idx_activity_user').on(table.userId, table.createdAt),
}));

/**
 * Orchestration Project Context table - Stores analyzed context about the project
 */
export const orchestrationProjectContext = sqliteTable('orchestration_project_context', {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => orchestrationProjects.id, { onDelete: 'cascade' }),
    
    // Context Type
    contextType: text('context_type', { 
        enum: ['tech_stack', 'file_structure', 'dependencies', 'api_endpoints', 'database_schema', 'environment_vars', 'features'] 
    }).notNull(),
    
    // Context Data (JSON)
    data: text('data', { mode: 'json' }).notNull(), // JSON object with context-specific structure
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (table) => ({
    projectContextTypeIdx: uniqueIndex('orchestration_project_context_unique_idx').on(table.projectId, table.contextType),
    projectIdx: index('idx_context_project').on(table.projectId),
    typeIdx: index('idx_context_type').on(table.contextType),
}));

/**
 * Orchestration WebSocket Connections table - Tracks active WebSocket connections
 */
export const orchestrationWsConnections = sqliteTable('orchestration_ws_connections', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => orchestrationProjects.id, { onDelete: 'cascade' }),
    
    // Connection Details
    connectionId: text('connection_id').notNull().unique(),
    clientType: text('client_type', { enum: ['web', 'vscode'] }).notNull(),
    
    // State
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    
    // Metadata
    connectedAt: integer('connected_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    lastHeartbeat: integer('last_heartbeat', { mode: 'timestamp' }).default(sql`(unixepoch())`),
    
    // Cleanup
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
    connectionIdIdx: uniqueIndex('orchestration_ws_connections_connection_id_idx').on(table.connectionId),
    userIdx: index('idx_ws_user').on(table.userId),
    projectIdx: index('idx_ws_project').on(table.projectId),
    activeIdx: index('idx_ws_active').on(table.isActive, table.expiresAt),
}));

// ========================================
// TYPE EXPORTS FOR APPLICATION USE
// ========================================

export type OrchestrationProject = typeof orchestrationProjects.$inferSelect;
export type NewOrchestrationProject = typeof orchestrationProjects.$inferInsert;

export type OrchestrationTicket = typeof orchestrationTickets.$inferSelect;
export type NewOrchestrationTicket = typeof orchestrationTickets.$inferInsert;

export type OrchestrationTicketDependency = typeof orchestrationTicketDependencies.$inferSelect;
export type NewOrchestrationTicketDependency = typeof orchestrationTicketDependencies.$inferInsert;

export type OrchestrationTicketAssignment = typeof orchestrationTicketAssignments.$inferSelect;
export type NewOrchestrationTicketAssignment = typeof orchestrationTicketAssignments.$inferInsert;

export type OrchestrationTicketActivity = typeof orchestrationTicketActivity.$inferSelect;
export type NewOrchestrationTicketActivity = typeof orchestrationTicketActivity.$inferInsert;

export type OrchestrationProjectContext = typeof orchestrationProjectContext.$inferSelect;
export type NewOrchestrationProjectContext = typeof orchestrationProjectContext.$inferInsert;

export type OrchestrationWsConnection = typeof orchestrationWsConnections.$inferSelect;
export type NewOrchestrationWsConnection = typeof orchestrationWsConnections.$inferInsert;