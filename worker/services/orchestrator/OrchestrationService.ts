/**
 * OrchestrationService - Business logic for orchestration layer
 * Handles project and ticket operations for Phase 2
 */

import { BaseService } from '../../database/services/BaseService';
import * as schema from '../../database/orchestrator-schema';
import * as mainSchema from '../../database/schema';
import { eq, and, or, desc, asc, inArray } from 'drizzle-orm';
import { generateId } from '../../utils/idGenerator';
import { TicketGeneratorService } from './TicketGeneratorService';
import { GitHubOrchestratorService } from './GitHubOrchestratorService';
import { InferenceContext } from '../../agents/inferutils/config.types';
import type {
    Project,
    Ticket,
    TicketWithRelations,
    ProjectWithRelations,
    CreateProjectRequest,
    UpdateTicketRequest,
    ListTicketsQuery,
    ProjectStatus,
    TicketStatus,
    ActivitySource,
    ProjectSource,
} from '../../../shared/types/orchestrator';
import type { OrchestratorWebSocket } from './OrchestratorWebSocket';

export class OrchestrationService extends BaseService {
    constructor(env: Env, private context?: InferenceContext) {
        super(env);
    }
    // ========================================
    // PROJECT OPERATIONS
    // ========================================

    /**
     * Create a new orchestration project from multiple sources
     * Supports: GitHub repos, saved apps, or new blank projects
     */
    async createProject(data: CreateProjectRequest, userId: string): Promise<Project> {
        const { source, appId, title, description, githubRepoUrl } = data;

        let projectTitle = title || '';
        let projectDescription = description || null;
        let projectAppId = appId || '';
        let projectGithubUrl = githubRepoUrl || null;
        let projectGithubRepoName = null;

        // Handle different project sources
        switch (source) {
            case 'app' as ProjectSource:
                // Verify app exists and user has access
                if (!appId) {
                    throw new Error('App ID is required for app source');
                }
                
                const app = await this.database
                    .select()
                    .from(mainSchema.apps)
                    .where(eq(mainSchema.apps.id, appId))
                    .get();

                if (!app) {
                    throw new Error('App not found');
                }

                projectTitle = title || app.title;
                projectDescription = description || app.description;
                projectAppId = appId;
                break;

            case 'github' as ProjectSource:
                // Validate GitHub URL
                if (!githubRepoUrl) {
                    throw new Error('GitHub repository URL is required for GitHub source');
                }

                // Extract repo name from URL
                projectGithubUrl = githubRepoUrl;
                projectGithubRepoName = this.extractRepoName(githubRepoUrl);
                projectTitle = title || projectGithubRepoName || 'GitHub Project';
                projectDescription = description || null;
                
                // Use a special appId to indicate this is from GitHub
                projectAppId = `github-${generateId()}`;
                break;

            case 'new' as ProjectSource:
                // New blank project
                if (!title) {
                    throw new Error('Title is required for new projects');
                }

                projectTitle = title;
                projectDescription = description || null;
                
                // Use a special appId to indicate this is a new project
                projectAppId = `new-${generateId()}`;
                break;

            default:
                throw new Error(`Unsupported project source: ${source}`);
        }

        // Create project
        const projectId = generateId();
        const [project] = await this.database
            .insert(schema.orchestrationProjects)
            .values({
                id: projectId,
                appId: projectAppId,
                title: projectTitle,
                description: projectDescription,
                status: 'analyzing' as ProjectStatus,
                stakeholderUserId: userId,
                githubRepoUrl: projectGithubUrl,
                githubRepoName: projectGithubRepoName,
                totalTickets: 0,
                completedTickets: 0,
            })
            .returning();

        this.logger.info('Project created', {
            projectId,
            source,
            title: projectTitle,
            userId,
        });

        // TODO: Phase 2.3 - Trigger ticket generation algorithm
        // await this.triggerTicketGeneration(projectId);

        return this.mapProjectFromDb(project);
    }

    /**
     * Generate tickets for a project (triggers AI analysis)
     * Implements Phase 2.3: AI-Powered Ticket Generation Algorithm
     */
    async generateTickets(projectId: string): Promise<void> {
        // Verify project exists
        const project = await this.database
            .select()
            .from(schema.orchestrationProjects)
            .where(eq(schema.orchestrationProjects.id, projectId))
            .get();

        if (!project) {
            throw new Error('Project not found');
        }

        // Update status to analyzing
        await this.database
            .update(schema.orchestrationProjects)
            .set({ status: 'analyzing' as ProjectStatus })
            .where(eq(schema.orchestrationProjects.id, projectId));

        this.logger.info('Starting ticket generation', { projectId });

        try {
            // Create or use existing inference context
            if (!this.context) {
                throw new Error('Inference context is required for ticket generation');
            }

            // Create ticket generator service
            const ticketGenerator = new TicketGeneratorService(
                this.env,
                this.context
            );

            // Execute the 9-phase algorithm
            const result = await ticketGenerator.generateTickets(projectId);

            if (!result.success) {
                throw new Error(result.error || 'Ticket generation failed');
            }

            this.logger.info('Ticket generation completed', {
                projectId,
                ticketCount: result.tickets.length,
                totalHours: result.totalHours,
            });
        } catch (error) {
            this.logger.error('Ticket generation failed', { projectId, error });
            
            // Update project status to indicate failure
            await this.database
                .update(schema.orchestrationProjects)
                .set({
                    status: 'analyzing' as ProjectStatus,
                    analysisResult: JSON.stringify({
                        error: error instanceof Error ? error.message : 'Unknown error',
                    }),
                })
                .where(eq(schema.orchestrationProjects.id, projectId));
            
            throw error;
        }
    }

    /**
     * List all projects for a user
     */
    async listProjects(userId?: string): Promise<Project[]> {
        const conditions = [];
        
        if (userId) {
            conditions.push(eq(schema.orchestrationProjects.stakeholderUserId, userId));
        }
        
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        
        const projects = await this.database
            .select()
            .from(schema.orchestrationProjects)
            .where(whereClause)
            .orderBy(desc(schema.orchestrationProjects.createdAt));
        
        return projects.map(p => this.mapProjectFromDb(p));
    }

    /**
     * Get project with all tickets and dependencies
     */
    async getProject(projectId: string, _includeActivity: boolean = false): Promise<ProjectWithRelations | null> {
        const project = await this.database
            .select()
            .from(schema.orchestrationProjects)
            .where(eq(schema.orchestrationProjects.id, projectId))
            .get();

        if (!project) {
            return null;
        }

        // Get all tickets for this project
        const tickets = await this.database
            .select()
            .from(schema.orchestrationTickets)
            .where(eq(schema.orchestrationTickets.projectId, projectId))
            .orderBy(asc(schema.orchestrationTickets.orderIndex));

        // Get dependencies
        const dependencies = await this.database
            .select()
            .from(schema.orchestrationTicketDependencies)
            .where(
                inArray(
                    schema.orchestrationTicketDependencies.ticketId,
                    tickets.map(t => t.id)
                )
            );

        // Get assignments
        const assignments = await this.database
            .select({
                assignment: schema.orchestrationTicketAssignments,
                user: mainSchema.users,
            })
            .from(schema.orchestrationTicketAssignments)
            .leftJoin(
                mainSchema.users,
                eq(schema.orchestrationTicketAssignments.userId, mainSchema.users.id)
            )
            .where(
                and(
                    inArray(
                        schema.orchestrationTicketAssignments.ticketId,
                        tickets.map(t => t.id)
                    ),
                    eq(schema.orchestrationTicketAssignments.status, 'assigned')
                )
            );

        // Map tickets with relations
        const ticketsWithRelations: TicketWithRelations[] = tickets.map(ticket => {
            const ticketDeps = dependencies.filter(d => d.ticketId === ticket.id);
            const blockedBy = ticketDeps
                .filter(d => d.dependencyType === 'blocks')
                .map(d => d.dependsOnTicketId);
            
            const blocks = dependencies
                .filter(d => d.dependsOnTicketId === ticket.id && d.dependencyType === 'blocks')
                .map(d => d.ticketId);

            const assignment = assignments.find(a => a.assignment.ticketId === ticket.id);
            const assignee = assignment?.user
                ? {
                      userId: assignment.user.id,
                      displayName: assignment.user.displayName || 'Unknown',
                      avatarUrl: assignment.user.avatarUrl,
                  }
                : null;

            return {
                ...this.mapTicketFromDb(ticket),
                dependencies: ticketDeps.map(d => ({
                    id: d.id,
                    ticketId: d.ticketId,
                    dependsOnTicketId: d.dependsOnTicketId,
                    dependencyType: d.dependencyType as any,
                    createdAt: new Date((d.createdAt as any as number) * 1000),
                })),
                assignee,
                blockedBy,
                blocks,
            };
        });

        return {
            ...this.mapProjectFromDb(project),
            tickets: ticketsWithRelations,
        };
    }

    /**
     * List tickets with filters
     */
    async listTickets(query: ListTicketsQuery, userId?: string): Promise<TicketWithRelations[]> {
        const { projectId, status, assignedToMe, ready } = query;

        // Build where conditions
        const conditions = [];
        
        if (projectId) {
            conditions.push(eq(schema.orchestrationTickets.projectId, projectId));
        }

        if (status && status.length > 0) {
            conditions.push(
                inArray(schema.orchestrationTickets.status, status as TicketStatus[])
            );
        }

        if (ready) {
            // Only tickets with status 'ready' or 'pending' with no blocking dependencies
            conditions.push(
                or(
                    eq(schema.orchestrationTickets.status, 'ready' as TicketStatus),
                    eq(schema.orchestrationTickets.status, 'pending' as TicketStatus)
                )
            );
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get tickets
        let ticketsQuery = this.database
            .select()
            .from(schema.orchestrationTickets)
            .where(whereClause)
            .orderBy(asc(schema.orchestrationTickets.orderIndex));

        if (assignedToMe && userId) {
            // Join with assignments to filter
            const tickets = await this.database
                .select({ ticket: schema.orchestrationTickets })
                .from(schema.orchestrationTickets)
                .innerJoin(
                    schema.orchestrationTicketAssignments,
                    and(
                        eq(schema.orchestrationTicketAssignments.ticketId, schema.orchestrationTickets.id),
                        eq(schema.orchestrationTicketAssignments.userId, userId),
                        eq(schema.orchestrationTicketAssignments.status, 'assigned')
                    )
                )
                .where(whereClause)
                .orderBy(asc(schema.orchestrationTickets.orderIndex));

            return tickets.map(r => this.mapTicketFromDb(r.ticket));
        }

        const tickets = await ticketsQuery;
        return tickets.map(t => this.mapTicketFromDb(t));
    }

    // ========================================
    // TICKET OPERATIONS
    // ========================================

    /**
     * Update ticket status and metadata
     */
    async updateTicketStatus(
        ticketId: string,
        updates: UpdateTicketRequest,
        userId: string
    ): Promise<Ticket> {
        // Get existing ticket
        const ticket = await this.database
            .select()
            .from(schema.orchestrationTickets)
            .where(eq(schema.orchestrationTickets.id, ticketId))
            .get();

        if (!ticket) {
            throw new Error('Ticket not found');
        }

        // Prepare updates
        const updateData: any = {
            updatedAt: new Date(),
        };

        if (updates.status) {
            updateData.status = updates.status;
            if (updates.status === 'in_progress' && !ticket.startedAt) {
                updateData.startedAt = new Date();
            }
            if (updates.status === 'completed') {
                updateData.completedAt = new Date();
            }
        }

        if (updates.actualHours !== undefined) {
            updateData.actualHours = updates.actualHours;
        }

        if (updates.branchName) {
            updateData.branchName = updates.branchName;
        }

        if (updates.prUrl) {
            updateData.prUrl = updates.prUrl;
        }

        // Update ticket
        const [updatedTicket] = await this.database
            .update(schema.orchestrationTickets)
            .set(updateData)
            .where(eq(schema.orchestrationTickets.id, ticketId))
            .returning();

        // Record activity
        await this.recordActivity(ticketId, {
            action: updates.status ? 'status_changed' : 'description_updated',
            userId,
            details: { ...updates },
        });

        // Broadcast WebSocket event
        await this.notifyTicketUpdate(ticket.projectId, ticketId, ticket, updatedTicket, userId);

        return this.mapTicketFromDb(updatedTicket);
    }

    /**
     * Assign ticket to developer
     */
    async assignTicket(ticketId: string, developerId: string): Promise<{ ticket: Ticket; branchName: string }> {
        // Get ticket
        const ticket = await this.database
            .select()
            .from(schema.orchestrationTickets)
            .where(eq(schema.orchestrationTickets.id, ticketId))
            .get();

        if (!ticket) {
            throw new Error('Ticket not found');
        }

        // Check if already assigned
        const existingAssignment = await this.database
            .select()
            .from(schema.orchestrationTicketAssignments)
            .where(
                and(
                    eq(schema.orchestrationTicketAssignments.ticketId, ticketId),
                    eq(schema.orchestrationTicketAssignments.status, 'assigned')
                )
            )
            .get();

        if (existingAssignment) {
            throw new Error('Ticket already assigned');
        }

        // Generate branch name
        const branchName = this.generateBranchName(ticket);

        // Create assignment
        await this.database
            .insert(schema.orchestrationTicketAssignments)
            .values({
                id: generateId(),
                ticketId,
                userId: developerId,
                status: 'assigned',
            });

        // Update ticket status and branch
        const [updatedTicket] = await this.database
            .update(schema.orchestrationTickets)
            .set({
                status: 'assigned' as TicketStatus,
                branchName,
                updatedAt: new Date(),
            })
            .where(eq(schema.orchestrationTickets.id, ticketId))
            .returning();

        // Record activity
        await this.recordActivity(ticketId, {
            action: 'assigned',
            userId: developerId,
            details: { branchName },
        });

        // Notify WebSocket clients
        await this.notifyTicketAssignment(ticket.projectId, ticketId, developerId);

        return {
            ticket: this.mapTicketFromDb(updatedTicket),
            branchName,
        };
    }

    /**
     * Record activity for a ticket
     */
    async recordActivity(
        ticketId: string,
        activity: {
            action: string;
            userId: string;
            details?: any;
            source?: 'web' | 'vscode' | 'api' | 'system';
        }
    ): Promise<void> {
        await this.database
            .insert(schema.orchestrationTicketActivity)
            .values({
                id: generateId(),
                ticketId,
                userId: activity.userId,
                action: activity.action as any,
                details: activity.details ? JSON.stringify(activity.details) : null,
                source: activity.source || 'api',
            });
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    /**
     * Generate branch name from ticket
     */
    private generateBranchName(ticket: typeof schema.orchestrationTickets.$inferSelect): string {
        const prefix = ticket.type === 'feature' ? 'feat' :
                      ticket.type === 'bug' ? 'fix' :
                      ticket.type === 'refactor' ? 'refactor' : 'chore';

        const slug = ticket.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);

        const shortId = ticket.id.substring(0, 8);

        return `${prefix}/${slug}-${shortId}`;
    }

    /**
     * Map database project to API type
     */
    private mapProjectFromDb(project: typeof schema.orchestrationProjects.$inferSelect): Project {
        return {
            id: project.id,
            appId: project.appId,
            title: project.title,
            description: project.description,
            status: project.status as ProjectStatus,
            githubRepoUrl: project.githubRepoUrl,
            githubRepoName: project.githubRepoName,
            githubDefaultBranch: project.githubDefaultBranch,
            stakeholderUserId: project.stakeholderUserId,
            analysisResult: project.analysisResult as any,
            totalTickets: project.totalTickets || 0,
            completedTickets: project.completedTickets || 0,
            createdAt: new Date((project.createdAt as any as number) * 1000),
            analyzedAt: project.analyzedAt ? new Date((project.analyzedAt as any as number) * 1000) : null,
            approvedAt: project.approvedAt ? new Date((project.approvedAt as any as number) * 1000) : null,
            completedAt: project.completedAt ? new Date((project.completedAt as any as number) * 1000) : null,
        };
    }

    /**
     * Map database ticket to API type
     */
    private mapTicketFromDb(ticket: typeof schema.orchestrationTickets.$inferSelect): Ticket {
        return {
            id: ticket.id,
            projectId: ticket.projectId,
            title: ticket.title,
            description: ticket.description,
            type: ticket.type as any,
            priority: ticket.priority as any,
            estimatedHours: ticket.estimatedHours,
            actualHours: ticket.actualHours,
            status: ticket.status as TicketStatus,
            orderIndex: ticket.orderIndex,
            category: ticket.category,
            tags: ticket.tags as string[] | null,
            branchName: ticket.branchName,
            prUrl: ticket.prUrl,
            commitCount: ticket.commitCount || 0,
            affectedFiles: ticket.affectedFiles as any,
            acceptanceCriteria: ticket.acceptanceCriteria as any,
            createdAt: new Date((ticket.createdAt as any as number) * 1000),
            updatedAt: new Date((ticket.updatedAt as any as number) * 1000),
            startedAt: ticket.startedAt ? new Date((ticket.startedAt as any as number) * 1000) : null,
            completedAt: ticket.completedAt ? new Date((ticket.completedAt as any as number) * 1000) : null,
        };
    }

    // ========================================
    // WEBSOCKET NOTIFICATION METHODS
    // ========================================

    /**
     * Get WebSocket Durable Object stub
     */
    private getWebSocketStub(): DurableObjectStub<OrchestratorWebSocket> {
        const id = this.env.OrchestratorWebSocket.idFromName('global');
        return this.env.OrchestratorWebSocket.get(id);
    }

    /**
     * Notify WebSocket clients of ticket update
     */
    private async notifyTicketUpdate(
        projectId: string,
        ticketId: string,
        oldTicket: typeof schema.orchestrationTickets.$inferSelect,
        newTicket: typeof schema.orchestrationTickets.$inferSelect,
        userId: string
    ): Promise<void> {
        try {
            // Get user info for the update
            const user = await this.database
                .select()
                .from(mainSchema.users)
                .where(eq(mainSchema.users.id, userId))
                .get();

            if (!user) {
                this.logger.warn('User not found for WebSocket notification', { userId });
                return;
            }

            // Build changes array
            const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
            
            if (oldTicket.status !== newTicket.status) {
                changes.push({ field: 'status', oldValue: oldTicket.status, newValue: newTicket.status });
            }
            if (oldTicket.branchName !== newTicket.branchName) {
                changes.push({ field: 'branchName', oldValue: oldTicket.branchName, newValue: newTicket.branchName });
            }
            if (oldTicket.prUrl !== newTicket.prUrl) {
                changes.push({ field: 'prUrl', oldValue: oldTicket.prUrl, newValue: newTicket.prUrl });
            }
            if (oldTicket.actualHours !== newTicket.actualHours) {
                changes.push({ field: 'actualHours', oldValue: oldTicket.actualHours, newValue: newTicket.actualHours });
            }

            if (changes.length === 0) {
                return; // No changes to notify
            }

            const stub = this.getWebSocketStub();
            
            // If status changed, use specific status change notification
            if (oldTicket.status !== newTicket.status) {
                await stub.broadcastTicketStatusChange(
                    projectId,
                    ticketId,
                    oldTicket.status as TicketStatus,
                    newTicket.status as TicketStatus,
                    {
                        userId: user.id,
                        displayName: user.displayName || user.email,
                    }
                );
            } else {
                // General update notification
                await stub.broadcastTicketUpdate(
                    projectId,
                    ticketId,
                    changes,
                    {
                        userId: user.id,
                        displayName: user.displayName || user.email,
                        source: 'api' as ActivitySource,
                    }
                );
            }
        } catch (error) {
            // Don't fail the operation if WebSocket notification fails
            this.logger.error('Failed to send WebSocket notification', { error, projectId, ticketId });
        }
    }

    /**
     * Notify WebSocket clients of ticket assignment
     */
    private async notifyTicketAssignment(
        projectId: string,
        ticketId: string,
        userId: string
    ): Promise<void> {
        try {
            const stub = this.getWebSocketStub();
            
            // Get user info
            const user = await this.database
                .select()
                .from(mainSchema.users)
                .where(eq(mainSchema.users.id, userId))
                .get();

            if (!user) {
                return;
            }

            await stub.broadcastTicketStatusChange(
                projectId,
                ticketId,
                'ready' as TicketStatus,
                'assigned' as TicketStatus,
                {
                    userId: user.id,
                    displayName: user.displayName || user.email,
                }
            );
        } catch (error) {
            this.logger.error('Failed to send assignment notification', { error, projectId, ticketId });
        }
    }

    /**
     * Notify WebSocket clients of project status change
     * NOTE: Reserved for future use - will notify via WebSocket when status changes
     */
    // private async _notifyProjectStatusChange(
    //     projectId: string,
    //     oldStatus: ProjectStatus,
    //     newStatus: ProjectStatus
    // ): Promise<void> {
    //     try {
    //         const stub = this.getWebSocketStub();
    //         await stub.broadcastProjectStatusChange(projectId, oldStatus, newStatus);
    //     } catch (error) {
    //         this.logger.error('Failed to send project status notification', { error, projectId });
    //     }
    // }

    // ========================================
    // GITHUB INTEGRATION METHODS
    // ========================================

    /**
     * Create GitHub repository for project
     */
    async createGitHubRepository(
        projectId: string,
        githubToken: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Get project
            const project = await this.database
                .select()
                .from(schema.orchestrationProjects)
                .where(eq(schema.orchestrationProjects.id, projectId))
                .get();

            if (!project) {
                return { success: false, error: 'Project not found' };
            }

            // Get app files
            const app = await this.database
                .select()
                .from(mainSchema.apps)
                .where(eq(mainSchema.apps.id, project.appId))
                .get();

            if (!app) {
                return { success: false, error: 'App not found' };
            }

            // TODO: Implement file retrieval from app generation system
            // For now, we'll need to either:
            // 1. Fetch files from the app generation/deployment system
            // 2. Pass files as a parameter to this method
            // 3. Store files in a separate table with a relationship to apps
            const fileContents: Array<{ filePath: string; fileContents: string }> = [];

            // Create repository
            const result = await GitHubOrchestratorService.createRepositoryFromProject({
                project: this.mapProjectFromDb(project),
                githubToken,
                files: fileContents,
            });

            if (!result.success) {
                return { success: false, error: result.error };
            }

            // Update project with GitHub info
            await this.database
                .update(schema.orchestrationProjects)
                .set({
                    githubRepoUrl: result.repositoryUrl,
                    githubRepoName: this.extractRepoName(result.repositoryUrl || ''),
                    githubDefaultBranch: result.defaultBranch || 'main',
                })
                .where(eq(schema.orchestrationProjects.id, projectId));

            this.logger.info('GitHub repository created for project', {
                projectId,
                repoUrl: result.repositoryUrl,
            });

            return { success: true };
        } catch (error) {
            this.logger.error('Failed to create GitHub repository', {
                projectId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Create GitHub branch for ticket
     */
    async createGitHubBranch(
        ticketId: string,
        githubToken: string
    ): Promise<{ success: boolean; branchName?: string; error?: string }> {
        try {
            // Get ticket and project
            const ticket = await this.database
                .select()
                .from(schema.orchestrationTickets)
                .where(eq(schema.orchestrationTickets.id, ticketId))
                .get();

            if (!ticket) {
                return { success: false, error: 'Ticket not found' };
            }

            const project = await this.database
                .select()
                .from(schema.orchestrationProjects)
                .where(eq(schema.orchestrationProjects.id, ticket.projectId))
                .get();

            if (!project) {
                return { success: false, error: 'Project not found' };
            }

            // Create branch
            const result = await GitHubOrchestratorService.createBranchForTicket({
                ticket: this.mapTicketFromDb(ticket),
                project: this.mapProjectFromDb(project),
                githubToken,
            });

            if (!result.success) {
                return { success: false, error: result.error };
            }

            // Update ticket with branch info
            await this.database
                .update(schema.orchestrationTickets)
                .set({
                    branchName: result.branchName,
                })
                .where(eq(schema.orchestrationTickets.id, ticketId));

            // Record activity
            await this.recordActivity(ticketId, {
                action: 'branch_created',
                userId: 'system',
                details: { branchName: result.branchName, branchUrl: result.branchUrl },
                source: 'system',
            });

            return { success: true, branchName: result.branchName };
        } catch (error) {
            this.logger.error('Failed to create GitHub branch', {
                ticketId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Create GitHub pull request for ticket
     */
    async createGitHubPullRequest(
        ticketId: string,
        githubToken: string
    ): Promise<{ success: boolean; prUrl?: string; error?: string }> {
        try {
            // Get ticket and project
            const ticket = await this.database
                .select()
                .from(schema.orchestrationTickets)
                .where(eq(schema.orchestrationTickets.id, ticketId))
                .get();

            if (!ticket) {
                return { success: false, error: 'Ticket not found' };
            }

            const project = await this.database
                .select()
                .from(schema.orchestrationProjects)
                .where(eq(schema.orchestrationProjects.id, ticket.projectId))
                .get();

            if (!project) {
                return { success: false, error: 'Project not found' };
            }

            // Create PR
            const result = await GitHubOrchestratorService.createPullRequest({
                ticket: this.mapTicketFromDb(ticket),
                project: this.mapProjectFromDb(project),
                githubToken,
            });

            if (!result.success) {
                return { success: false, error: result.error };
            }

            // Update ticket with PR info
            await this.database
                .update(schema.orchestrationTickets)
                .set({
                    prUrl: result.prUrl,
                })
                .where(eq(schema.orchestrationTickets.id, ticketId));

            // Record activity
            await this.recordActivity(ticketId, {
                action: 'pr_opened',
                userId: 'system',
                details: { prUrl: result.prUrl, prNumber: result.prNumber },
                source: 'system',
            });

            return { success: true, prUrl: result.prUrl };
        } catch (error) {
            this.logger.error('Failed to create GitHub pull request', {
                ticketId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Extract repository name from URL
     */
    private extractRepoName(url: string): string | null {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(part => part);
            
            if (pathParts.length >= 2) {
                return `${pathParts[0]}/${pathParts[1]}`;
            }
            
            return null;
        } catch {
            return null;
        }
    }
}