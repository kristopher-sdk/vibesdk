/**
 * Orchestrator Controller - HTTP handlers for orchestration endpoints
 */

import { BaseController } from '../baseController';
import { ApiResponse, ControllerResponse } from '../types';
import type { RouteContext } from '../../types/route-context';
import { OrchestrationService } from '../../../services/orchestrator/OrchestrationService';
import { createLogger } from '../../../logger';
import {
    CreateProjectRequestSchema,
    GenerateTicketsRequestSchema,
    UpdateTicketRequestSchema,
    AssignTicketRequestSchema,
    ListTicketsQuerySchema,
    UpdateProjectRequestSchema,
    CreateProjectData,
    GetProjectData,
    GenerateTicketsData,
    ListTicketsData,
    GetTicketData,
    UpdateTicketData,
    AssignTicketData,
    UpdateProjectData,
} from './types';
import type { Project } from '../../../../shared/types/orchestrator';

export class OrchestratorController extends BaseController {
    static logger = createLogger('OrchestratorController');

    // ========================================
    // PROJECT ENDPOINTS
    // ========================================

    /**
     * POST /api/orchestrator/projects
     * Create a new project from a prototype/app
     */
    static async createProject(
        request: Request,
        env: Env,
        _ctx: ExecutionContext,
        context: RouteContext
    ): Promise<ControllerResponse<ApiResponse<CreateProjectData>>> {
        try {
            const user = context.user!;

            // Parse and validate request body
            const bodyResult = await OrchestratorController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<CreateProjectData>>;
            }

            const validation = CreateProjectRequestSchema.safeParse(bodyResult.data);
            if (!validation.success) {
                return OrchestratorController.createErrorResponse<CreateProjectData>(
                    'Invalid request data: ' + validation.error.errors.map(e => e.message).join(', '),
                    400
                );
            }

            const service = new OrchestrationService(env);
            const project = await service.createProject(validation.data, user.id);

            const responseData: CreateProjectData = {
                project: {
                    id: project.id,
                    appId: project.appId,
                    title: project.title,
                    description: project.description,
                    status: project.status,
                    source: validation.data.source,
                    createdAt: project.createdAt,
                },
                message: 'Project created and analysis started',
            };

            // Return 201 Created
            return new Response(JSON.stringify({
                success: true,
                data: responseData,
            }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' }
            }) as ControllerResponse<ApiResponse<CreateProjectData>>;
        } catch (error) {
            OrchestratorController.logger.error('Error creating project:', error);
            const message = error instanceof Error ? error.message : 'Failed to create project';
            return OrchestratorController.createErrorResponse<CreateProjectData>(message, 500);
        }
    }

    /**
     * GET /api/orchestrator/projects
     * List all projects for the current user
     */
    static async listProjects(
        _request: Request,
        env: Env,
        _ctx: ExecutionContext,
        context: RouteContext
    ): Promise<ControllerResponse<ApiResponse<{ projects: Project[] }>>> {
        try {
            // NOTE: User is optional for testing when auth is disabled
            const userId = context.user?.id;
            const service = new OrchestrationService(env);
            const projects = await service.listProjects(userId);

            return OrchestratorController.createSuccessResponse({ projects });
        } catch (error) {
            OrchestratorController.logger.error('Error listing projects:', error);
            return OrchestratorController.createErrorResponse<{ projects: Project[] }>(
                'Failed to list projects',
                500
            );
        }
    }

    /**
     * GET /api/orchestrator/projects/:id
     * Get project details with all tickets
     */
    static async getProject(
        _request: Request,
        env: Env,
        _ctx: ExecutionContext,
        context: RouteContext
    ): Promise<ControllerResponse<ApiResponse<GetProjectData>>> {
        try {
            const projectId = context.pathParams.id;
            if (!projectId) {
                return OrchestratorController.createErrorResponse<GetProjectData>(
                    'Project ID is required',
                    400
                );
            }

            const service = new OrchestrationService(env);
            const project = await service.getProject(projectId, false);

            if (!project) {
                return OrchestratorController.createErrorResponse<GetProjectData>(
                    'Project not found',
                    404
                );
            }

            const responseData: GetProjectData = {
                project: {
                    id: project.id,
                    appId: project.appId,
                    title: project.title,
                    description: project.description,
                    status: project.status,
                    githubRepoUrl: project.githubRepoUrl,
                    totalTickets: project.totalTickets,
                    completedTickets: project.completedTickets,
                    createdAt: project.createdAt,
                    approvedAt: project.approvedAt,
                },
                tickets: project.tickets || [],
                dependencies: [],
            };

            return OrchestratorController.createSuccessResponse(responseData);
        } catch (error) {
            OrchestratorController.logger.error('Error fetching project:', error);
            return OrchestratorController.createErrorResponse<GetProjectData>(
                'Failed to fetch project',
                500
            );
        }
    }

    /**
     * POST /api/orchestrator/projects/:id/generate
     * Generate tickets for a project
     */
    static async generateTickets(
        request: Request,
        env: Env,
        _ctx: ExecutionContext,
        context: RouteContext
    ): Promise<ControllerResponse<ApiResponse<GenerateTicketsData>>> {
        try {
            const projectId = context.pathParams.id;
            if (!projectId) {
                return OrchestratorController.createErrorResponse<GenerateTicketsData>(
                    'Project ID is required',
                    400
                );
            }

            // Parse and validate request body (optional guidance)
            const bodyResult = await OrchestratorController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<GenerateTicketsData>>;
            }

            const validation = GenerateTicketsRequestSchema.safeParse(bodyResult.data);
            if (!validation.success) {
                return OrchestratorController.createErrorResponse<GenerateTicketsData>(
                    'Invalid request data',
                    400
                );
            }

            const service = new OrchestrationService(env);
            await service.generateTickets(projectId);

            const responseData: GenerateTicketsData = {
                success: true,
                message: 'Ticket generation started',
            };

            // Return 202 Accepted
            return new Response(JSON.stringify({
                success: true,
                data: responseData,
            }), {
                status: 202,
                headers: { 'Content-Type': 'application/json' }
            }) as ControllerResponse<ApiResponse<GenerateTicketsData>>;
        } catch (error) {
            OrchestratorController.logger.error('Error generating tickets:', error);
            const message = error instanceof Error ? error.message : 'Failed to generate tickets';
            return OrchestratorController.createErrorResponse<GenerateTicketsData>(message, 500);
        }
    }

    /**
     * PATCH /api/orchestrator/projects/:id
     * Update project (approve, regenerate, archive)
     */
    static async updateProject(
        request: Request,
        _env: Env,
        _ctx: ExecutionContext,
        context: RouteContext
    ): Promise<ControllerResponse<ApiResponse<UpdateProjectData>>> {
        try {
            const projectId = context.pathParams.id;
            if (!projectId) {
                return OrchestratorController.createErrorResponse<UpdateProjectData>(
                    'Project ID is required',
                    400
                );
            }

            const bodyResult = await OrchestratorController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<UpdateProjectData>>;
            }

            const validation = UpdateProjectRequestSchema.safeParse(bodyResult.data);
            if (!validation.success) {
                return OrchestratorController.createErrorResponse<UpdateProjectData>(
                    'Invalid request data',
                    400
                );
            }

            // TODO: Phase 2.3 - Implement project update logic
            // For now, return placeholder response
            const responseData: UpdateProjectData = {
                success: true,
                message: `Project ${validation.data.action} action initiated`,
            };

            return OrchestratorController.createSuccessResponse(responseData);
        } catch (error) {
            OrchestratorController.logger.error('Error updating project:', error);
            return OrchestratorController.createErrorResponse<UpdateProjectData>(
                'Failed to update project',
                500
            );
        }
    }

    // ========================================
    // TICKET ENDPOINTS
    // ========================================

    /**
     * GET /api/orchestrator/tickets
     * List tickets with filters
     */
    static async listTickets(
        request: Request,
        env: Env,
        _ctx: ExecutionContext,
        context: RouteContext
    ): Promise<ControllerResponse<ApiResponse<ListTicketsData>>> {
        try {
            const user = context.user!;
            const url = new URL(request.url);

            // Parse query parameters
            const queryParams = {
                projectId: url.searchParams.get('projectId') || undefined,
                status: url.searchParams.get('status')?.split(',') || undefined,
                assignedToMe: url.searchParams.get('assignedToMe') || undefined,
                ready: url.searchParams.get('ready') || undefined,
                limit: url.searchParams.get('limit') || undefined,
                offset: url.searchParams.get('offset') || undefined,
            };

            const validation = ListTicketsQuerySchema.safeParse(queryParams);
            if (!validation.success) {
                return OrchestratorController.createErrorResponse<ListTicketsData>(
                    'Invalid query parameters',
                    400
                );
            }

            const service = new OrchestrationService(env);
            const tickets = await service.listTickets(
                {
                    projectId: validation.data.projectId,
                    status: validation.data.status as any,
                    assignedToMe: validation.data.assignedToMe === 'true',
                    ready: validation.data.ready === 'true',
                },
                user.id
            );

            const responseData: ListTicketsData = {
                tickets,
                pagination: {
                    limit: parseInt(validation.data.limit || '50'),
                    offset: parseInt(validation.data.offset || '0'),
                    total: tickets.length,
                    hasMore: false,
                },
            };

            return OrchestratorController.createSuccessResponse(responseData);
        } catch (error) {
            OrchestratorController.logger.error('Error listing tickets:', error);
            return OrchestratorController.createErrorResponse<ListTicketsData>(
                'Failed to list tickets',
                500
            );
        }
    }

    /**
     * GET /api/orchestrator/tickets/:id
     * Get ticket details
     */
    static async getTicket(
        _request: Request,
        env: Env,
        _ctx: ExecutionContext,
        context: RouteContext
    ): Promise<ControllerResponse<ApiResponse<GetTicketData>>> {
        try {
            const ticketId = context.pathParams.id;
            if (!ticketId) {
                return OrchestratorController.createErrorResponse<GetTicketData>(
                    'Ticket ID is required',
                    400
                );
            }

            const service = new OrchestrationService(env);
            const tickets = await service.listTickets({}, undefined);
            const ticket = tickets.find(t => t.id === ticketId);

            if (!ticket) {
                return OrchestratorController.createErrorResponse<GetTicketData>(
                    'Ticket not found',
                    404
                );
            }

            const responseData: GetTicketData = { ticket };
            return OrchestratorController.createSuccessResponse(responseData);
        } catch (error) {
            OrchestratorController.logger.error('Error fetching ticket:', error);
            return OrchestratorController.createErrorResponse<GetTicketData>(
                'Failed to fetch ticket',
                500
            );
        }
    }

    /**
     * PATCH /api/orchestrator/tickets/:id
     * Update ticket status and metadata
     */
    static async updateTicket(
        request: Request,
        env: Env,
        _ctx: ExecutionContext,
        context: RouteContext
    ): Promise<ControllerResponse<ApiResponse<UpdateTicketData>>> {
        try {
            const user = context.user!;
            const ticketId = context.pathParams.id;
            if (!ticketId) {
                return OrchestratorController.createErrorResponse<UpdateTicketData>(
                    'Ticket ID is required',
                    400
                );
            }

            const bodyResult = await OrchestratorController.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<UpdateTicketData>>;
            }

            const validation = UpdateTicketRequestSchema.safeParse(bodyResult.data);
            if (!validation.success) {
                return OrchestratorController.createErrorResponse<UpdateTicketData>(
                    'Invalid request data',
                    400
                );
            }

            const service = new OrchestrationService(env);
            const ticket = await service.updateTicketStatus(ticketId, validation.data as any, user.id);

            const responseData: UpdateTicketData = {
                success: true,
                ticket,
            };

            return OrchestratorController.createSuccessResponse(responseData);
        } catch (error) {
            OrchestratorController.logger.error('Error updating ticket:', error);
            const message = error instanceof Error ? error.message : 'Failed to update ticket';
            return OrchestratorController.createErrorResponse<UpdateTicketData>(message, 500);
        }
    }

    /**
     * POST /api/orchestrator/tickets/:id/assign
     * Assign ticket to developer (or claim for self)
     */
    static async assignTicket(
        request: Request,
        env: Env,
        _ctx: ExecutionContext,
        context: RouteContext
    ): Promise<ControllerResponse<ApiResponse<AssignTicketData>>> {
        try {
            const user = context.user!;
            const ticketId = context.pathParams.id;
            if (!ticketId) {
                return OrchestratorController.createErrorResponse<AssignTicketData>(
                    'Ticket ID is required',
                    400
                );
            }

            // Parse body (optional developer ID, defaults to current user)
            const bodyResult = await OrchestratorController.parseJsonBody(request);
            let developerId = user.id;

            if (bodyResult.success) {
                const validation = AssignTicketRequestSchema.safeParse(bodyResult.data);
                if (validation.success && validation.data.developerId) {
                    developerId = validation.data.developerId;
                }
            }

            const service = new OrchestrationService(env);
            const result = await service.assignTicket(ticketId, developerId);

            const responseData: AssignTicketData = {
                success: true,
                ticket: result.ticket,
                branchName: result.branchName,
            };

            return OrchestratorController.createSuccessResponse(responseData);
        } catch (error) {
            OrchestratorController.logger.error('Error assigning ticket:', error);
            const message = error instanceof Error ? error.message : 'Failed to assign ticket';
            const statusCode = message.includes('already assigned') ? 409 : 500;
            return OrchestratorController.createErrorResponse<AssignTicketData>(message, statusCode);
        }
    }
}