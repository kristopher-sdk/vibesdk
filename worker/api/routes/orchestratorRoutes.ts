/**
 * Orchestrator API Routes
 * Phase 2: Development Ticket Management System
 */

import { Hono } from 'hono';
import { AppEnv } from '../../types/appenv';
import { OrchestratorController } from '../controllers/orchestrator/controller';
import * as GitHubController from '../controllers/orchestrator/githubController';
import { adaptController } from '../honoAdapter';
import { AuthConfig, setAuthLevel } from '../../middleware/auth/routeAuth';

export function setupOrchestratorRoutes(app: Hono<AppEnv>): void {
    // All orchestrator routes require authentication
    const orchestratorRouter = new Hono<AppEnv>();

    // ========================================
    // PROJECT ROUTES
    // ========================================

    /**
     * POST /api/orchestrator/projects
     * Create a new project from a prototype/app
     */
    orchestratorRouter.post('/projects',
        setAuthLevel(AuthConfig.authenticated),
        adaptController(OrchestratorController, OrchestratorController.createProject)
    );

    /**
     * GET /api/orchestrator/projects/:id
     * Get project details with all tickets
     */
    orchestratorRouter.get('/projects/:id',
        setAuthLevel(AuthConfig.authenticated),
        adaptController(OrchestratorController, OrchestratorController.getProject)
    );

    /**
     * POST /api/orchestrator/projects/:id/generate
     * Generate tickets for a project
     */
    orchestratorRouter.post('/projects/:id/generate',
        setAuthLevel(AuthConfig.authenticated),
        adaptController(OrchestratorController, OrchestratorController.generateTickets)
    );

    /**
     * PATCH /api/orchestrator/projects/:id
     * Update project (approve, regenerate, archive)
     */
    orchestratorRouter.patch('/projects/:id',
        setAuthLevel(AuthConfig.authenticated),
        adaptController(OrchestratorController, OrchestratorController.updateProject)
    );

    // ========================================
    // TICKET ROUTES
    // ========================================

    /**
     * GET /api/orchestrator/tickets
     * List tickets with filters
     */
    orchestratorRouter.get('/tickets',
        setAuthLevel(AuthConfig.authenticated),
        adaptController(OrchestratorController, OrchestratorController.listTickets)
    );

    /**
     * GET /api/orchestrator/tickets/:id
     * Get ticket details
     */
    orchestratorRouter.get('/tickets/:id',
        setAuthLevel(AuthConfig.authenticated),
        adaptController(OrchestratorController, OrchestratorController.getTicket)
    );

    /**
     * PATCH /api/orchestrator/tickets/:id
     * Update ticket status and metadata
     */
    orchestratorRouter.patch('/tickets/:id',
        setAuthLevel(AuthConfig.authenticated),
        adaptController(OrchestratorController, OrchestratorController.updateTicket)
    );

    /**
     * POST /api/orchestrator/tickets/:id/assign
     * Assign ticket to developer (or claim for self)
     */
    orchestratorRouter.post('/tickets/:id/assign',
        setAuthLevel(AuthConfig.authenticated),
        adaptController(OrchestratorController, OrchestratorController.assignTicket)
    );

    // ========================================
    // GITHUB INTEGRATION ROUTES
    // ========================================

    /**
     * POST /api/orchestrator/projects/:id/github/create-repo
     * Create GitHub repository for a project
     */
    orchestratorRouter.post('/projects/:id/github/create-repo',
        setAuthLevel(AuthConfig.authenticated),
        GitHubController.createRepository
    );

    /**
     * POST /api/orchestrator/tickets/:id/github/create-branch
     * Create GitHub branch for a ticket
     */
    orchestratorRouter.post('/tickets/:id/github/create-branch',
        setAuthLevel(AuthConfig.authenticated),
        GitHubController.createBranch
    );

    /**
     * POST /api/orchestrator/tickets/:id/github/create-pr
     * Create GitHub pull request for a ticket
     */
    orchestratorRouter.post('/tickets/:id/github/create-pr',
        setAuthLevel(AuthConfig.authenticated),
        GitHubController.createPullRequest
    );

    /**
     * POST /api/orchestrator/github/webhook
     * Handle GitHub webhook events
     * Note: This endpoint does not require authentication as it uses signature verification
     */
    orchestratorRouter.post('/github/webhook',
        GitHubController.handleWebhook
    );

    // ========================================
    // WEBSOCKET ROUTE
    // ========================================

    /**
     * GET /api/orchestrator/ws
     * WebSocket upgrade endpoint for real-time updates
     */
    orchestratorRouter.get('/ws', async (c) => {
        // Get the Durable Object stub
        const id = c.env.OrchestratorWebSocket.idFromName('global');
        const stub = c.env.OrchestratorWebSocket.get(id);
        
        // Forward the WebSocket upgrade request to the Durable Object
        return stub.fetch(c.req.raw);
    });

    // Mount all orchestrator routes under /api/orchestrator
    app.route('/api/orchestrator', orchestratorRouter);
}