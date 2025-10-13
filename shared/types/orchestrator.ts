/**
 * Orchestration Layer Type Definitions
 * Phase 2: Development Ticket Management System
 */

// ========================================
// ENUMS
// ========================================

/**
 * Project status lifecycle
 */
export enum ProjectStatus {
    ANALYZING = 'analyzing',       // AI is analyzing prototype
    REVIEW = 'review',              // Awaiting stakeholder review
    APPROVED = 'approved',          // Stakeholder approved ticket plan
    IN_PROGRESS = 'in_progress',    // Development in progress
    COMPLETED = 'completed',        // All tickets completed
    ARCHIVED = 'archived',          // Project archived
}

/**
 * Ticket status lifecycle
 */
export enum TicketStatus {
    PENDING = 'pending',           // Not yet started
    READY = 'ready',               // Dependencies met, ready to start
    ASSIGNED = 'assigned',         // Assigned to developer
    IN_PROGRESS = 'in_progress',   // Being worked on
    REVIEW = 'review',             // In code review
    BLOCKED = 'blocked',           // Blocked by dependencies
    COMPLETED = 'completed',       // Finished
    CANCELLED = 'cancelled',       // Cancelled by stakeholder
}

/**
 * Ticket priority levels
 */
export enum TicketPriority {
    CRITICAL = 'critical',
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low',
}

/**
 * Ticket type classifications
 */
export enum TicketType {
    FEATURE = 'feature',               // New feature implementation
    ENHANCEMENT = 'enhancement',       // Enhancement to existing feature
    BUG = 'bug',                      // Bug fix
    REFACTOR = 'refactor',            // Code refactoring
    TEST = 'test',                    // Test implementation
    DOCUMENTATION = 'documentation',   // Documentation
    SETUP = 'setup',                  // Project setup/configuration
}

/**
 * Activity action types
 */
export enum ActivityType {
    CREATED = 'created',
    STATUS_CHANGED = 'status_changed',
    ASSIGNED = 'assigned',
    UNASSIGNED = 'unassigned',
    COMMENT_ADDED = 'comment_added',
    PRIORITY_CHANGED = 'priority_changed',
    DESCRIPTION_UPDATED = 'description_updated',
    BRANCH_CREATED = 'branch_created',
    PR_OPENED = 'pr_opened',
    PR_MERGED = 'pr_merged',
    COMPLETED = 'completed',
    REOPENED = 'reopened',
}

/**
 * Dependency types between tickets
 */
export enum DependencyType {
    BLOCKS = 'blocks',               // Must complete before starting
    RELATED = 'related',             // Loosely related
    FILE_CONFLICT = 'file_conflict', // Works on same files
}

/**
 * Assignment status
 */
export enum AssignmentStatus {
    ASSIGNED = 'assigned',       // Currently assigned
    UNASSIGNED = 'unassigned',   // Was assigned, now released
    COMPLETED = 'completed',     // Assignment completed
}

/**
 * Context types for project analysis
 */
export enum ContextType {
    TECH_STACK = 'tech_stack',           // Technologies used
    FILE_STRUCTURE = 'file_structure',   // Project file organization
    DEPENDENCIES = 'dependencies',       // NPM/package dependencies
    API_ENDPOINTS = 'api_endpoints',     // API routes defined
    DATABASE_SCHEMA = 'database_schema', // Database tables/fields
    ENVIRONMENT_VARS = 'environment_vars', // Required env variables
    FEATURES = 'features',               // High-level features list
}

/**
 * Activity source (where the action originated)
 */
export enum ActivitySource {
    WEB = 'web',         // Byte Platform web UI
    VSCODE = 'vscode',   // VS Code extension
    API = 'api',         // Direct API call
    SYSTEM = 'system',   // Automated system action
}

/**
 * WebSocket client types
 */
export enum ClientType {
    WEB = 'web',
    VSCODE = 'vscode',
}

// ========================================
// INTERFACES
// ========================================

/**
 * Project - Main orchestration project entity
 */
export interface Project {
    id: string;
    appId: string;
    title: string;
    description: string | null;
    status: ProjectStatus;
    githubRepoUrl: string | null;
    githubRepoName: string | null;
    githubDefaultBranch: string | null;
    stakeholderUserId: string | null;
    analysisResult: AnalysisResult | null;
    totalTickets: number;
    completedTickets: number;
    createdAt: Date;
    analyzedAt: Date | null;
    approvedAt: Date | null;
    completedAt: Date | null;
}

/**
 * Analysis result structure (stored as JSON)
 */
export interface AnalysisResult {
    complexity: {
        overall: number; // 1-10 scale
        frontend: number;
        backend: number;
        database: number;
    };
    features: Array<{
        name: string;
        description: string;
        complexity: number;
    }>;
    techStack: {
        framework: string;
        languages: string[];
        libraries: string[];
        tools: string[];
    };
    estimatedTotalHours: number;
}

/**
 * Ticket - Individual development task
 */
export interface Ticket {
    id: string;
    projectId: string;
    title: string;
    description: string;
    type: TicketType;
    priority: TicketPriority;
    estimatedHours: number | null;
    actualHours: number | null;
    status: TicketStatus;
    orderIndex: number;
    category: string | null;
    tags: string[] | null;
    branchName: string | null;
    prUrl: string | null;
    commitCount: number;
    affectedFiles: AffectedFile[] | null;
    acceptanceCriteria: AcceptanceCriterion[] | null;
    createdAt: Date;
    updatedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
}

/**
 * Affected file structure
 */
export interface AffectedFile {
    path: string;
    reason: string;
    type: 'create' | 'modify' | 'delete';
}

/**
 * Acceptance criterion structure
 */
export interface AcceptanceCriterion {
    criterion: string;
    completed: boolean;
}

/**
 * Ticket Dependency - Relationships between tickets
 */
export interface TicketDependency {
    id: string;
    ticketId: string;
    dependsOnTicketId: string;
    dependencyType: DependencyType;
    createdAt: Date;
}

/**
 * Ticket Assignment - Assigns tickets to developers
 */
export interface TicketAssignment {
    id: string;
    ticketId: string;
    userId: string;
    status: AssignmentStatus;
    assignedAt: Date;
    unassignedAt: Date | null;
    completedAt: Date | null;
}

/**
 * Ticket Activity - Audit log for ticket changes
 */
export interface TicketActivity {
    id: string;
    ticketId: string;
    userId: string | null;
    action: ActivityType;
    details: ActivityDetails | null;
    source: ActivitySource;
    createdAt: Date;
}

/**
 * Activity details structure (stored as JSON)
 */
export interface ActivityDetails {
    from?: string | number | boolean;
    to?: string | number | boolean;
    comment?: string;
    prUrl?: string;
    branchName?: string;
    [key: string]: unknown;
}

/**
 * Project Context - Analyzed context about the project
 */
export interface ProjectContext {
    id: string;
    projectId: string;
    contextType: ContextType;
    data: ContextData;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Context data structures for different context types
 */
export type ContextData = 
    | TechStackContext
    | FileStructureContext
    | DependenciesContext
    | ApiEndpointsContext
    | DatabaseSchemaContext
    | EnvironmentVarsContext
    | FeaturesContext;

export interface TechStackContext {
    framework: string;
    languages: string[];
    libraries: string[];
    tools: string[];
}

export interface FileStructureContext {
    directories: string[];
    fileCount: number;
    structure: Record<string, string[]>;
}

export interface DependenciesContext {
    production: Record<string, string>;
    development: Record<string, string>;
}

export interface ApiEndpointsContext {
    endpoints: Array<{
        method: string;
        path: string;
        description?: string;
    }>;
}

export interface DatabaseSchemaContext {
    tables: Array<{
        name: string;
        columns: Array<{
            name: string;
            type: string;
        }>;
    }>;
}

export interface EnvironmentVarsContext {
    required: string[];
    optional: string[];
}

export interface FeaturesContext {
    features: Array<{
        name: string;
        description: string;
    }>;
}

/**
 * WebSocket Connection - Tracks active connections
 */
export interface WsConnection {
    id: string;
    userId: string;
    projectId: string | null;
    connectionId: string;
    clientType: ClientType;
    isActive: boolean;
    connectedAt: Date;
    lastHeartbeat: Date;
    expiresAt: Date;
}

// ========================================
// EXTENDED TYPES (WITH RELATIONS)
// ========================================

/**
 * Ticket with dependencies and assignment information
 */
export interface TicketWithRelations extends Ticket {
    dependencies?: TicketDependency[];
    assignee?: {
        userId: string;
        displayName: string;
        avatarUrl: string | null;
    } | null;
    blockedBy?: string[]; // Array of ticket IDs this ticket is blocked by
    blocks?: string[];    // Array of ticket IDs this ticket blocks
}

/**
 * Project with tickets and context
 */
export interface ProjectWithRelations extends Project {
    tickets?: TicketWithRelations[];
    context?: ProjectContext[];
}

// ========================================
// API REQUEST/RESPONSE TYPES
// ========================================

/**
 * Create project request
 */
export interface CreateProjectRequest {
    appId: string;
    title?: string;
}

/**
 * Update project request
 */
export interface UpdateProjectRequest {
    action: 'approve' | 'regenerate' | 'archive';
    ticketUpdates?: Array<{
        ticketId: string;
        title?: string;
        description?: string;
        priority?: TicketPriority;
    }>;
    guidance?: string; // For regeneration
}

/**
 * List tickets query parameters
 */
export interface ListTicketsQuery {
    projectId?: string;
    status?: TicketStatus[];
    assignedToMe?: boolean;
    ready?: boolean;
}

/**
 * Update ticket request
 */
export interface UpdateTicketRequest {
    status?: TicketStatus;
    actualHours?: number;
    branchName?: string;
    prUrl?: string;
    notes?: string;
}

/**
 * Claim ticket response
 */
export interface ClaimTicketResponse {
    success: boolean;
    ticket: Ticket;
    branchName: string;
}

// ========================================
// WEBSOCKET MESSAGE TYPES
// ========================================

/**
 * Base WebSocket message
 */
export interface BaseWsMessage {
    type: string;
    timestamp?: string;
}

/**
 * Authentication message
 */
export interface AuthenticateMessage extends BaseWsMessage {
    type: 'authenticate';
    token: string;
    clientType: ClientType;
    projectId?: string;
}

/**
 * Authentication success response
 */
export interface AuthSuccessMessage extends BaseWsMessage {
    type: 'auth_success';
    userId: string;
    connectionId: string;
    subscriptions: string[];
}

/**
 * Ticket updated message
 */
export interface TicketUpdatedMessage extends BaseWsMessage {
    type: 'ticket_updated';
    projectId: string;
    ticketId: string;
    changes: Array<{
        field: string;
        oldValue: unknown;
        newValue: unknown;
    }>;
    updatedBy: {
        userId: string;
        displayName: string;
        source: ActivitySource;
    };
}

/**
 * Ticket status changed message
 */
export interface TicketStatusChangedMessage extends BaseWsMessage {
    type: 'ticket_status_changed';
    projectId: string;
    ticketId: string;
    oldStatus: TicketStatus;
    newStatus: TicketStatus;
    changedBy: {
        userId: string;
        displayName: string;
    };
}

/**
 * Project status changed message
 */
export interface ProjectStatusChangedMessage extends BaseWsMessage {
    type: 'project_status_changed';
    projectId: string;
    oldStatus: ProjectStatus;
    newStatus: ProjectStatus;
}

/**
 * Heartbeat message
 */
export interface HeartbeatMessage extends BaseWsMessage {
    type: 'heartbeat';
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseWsMessage {
    type: 'error';
    error: string;
    message: string;
    recoverable: boolean;
}

/**
 * Union type of all server messages
 */
export type ServerMessage =
    | AuthSuccessMessage
    | TicketUpdatedMessage
    | TicketStatusChangedMessage
    | ProjectStatusChangedMessage
    | HeartbeatMessage
    | ErrorMessage;

/**
 * Union type of all client messages
 */
export type ClientMessage = 
    | AuthenticateMessage
    | { type: 'subscribe'; projectId: string }
    | { type: 'unsubscribe'; projectId: string }
    | { type: 'pong'; timestamp: string };