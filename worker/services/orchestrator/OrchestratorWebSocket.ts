/**
 * OrchestratorWebSocket - Durable Object for real-time ticket updates
 * Phase 2.4: WebSocket Real-Time Sync Implementation
 */

import { DurableObject } from 'cloudflare:workers';
import { createLogger } from '../../logger';
import type {
    AuthenticateMessage,
    AuthSuccessMessage,
    ServerMessage,
    ClientMessage,
    TicketUpdatedMessage,
    TicketStatusChangedMessage,
    ProjectStatusChangedMessage,
    ClientType,
    ActivitySource,
    TicketStatus,
    ProjectStatus,
} from '../../../shared/types/orchestrator';

const logger = createLogger('OrchestratorWebSocket');

interface ConnectionInfo {
    userId: string;
    connectionId: string;
    clientType: ClientType;
    subscriptions: Set<string>; // Project IDs
    ws: WebSocket;
    lastHeartbeat: number;
}

interface StoredState {
    connections: Array<{
        userId: string;
        connectionId: string;
        clientType: ClientType;
        subscriptions: string[];
        lastHeartbeat: number;
    }>;
}

/**
 * Durable Object for managing WebSocket connections
 */
export class OrchestratorWebSocket extends DurableObject<Env> {
    private connections: Map<string, ConnectionInfo> = new Map();
    private heartbeatInterval: number | null = null;
    private initialized = false;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
    }

    /**
     * Handle incoming HTTP requests (WebSocket upgrade)
     */
    async fetch(request: Request): Promise<Response> {
        // Only accept WebSocket upgrade requests
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader !== 'websocket') {
            return new Response('Expected WebSocket', { status: 426 });
        }

        await this.ensureInitialized();

        // Create WebSocket pair
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        // Accept the WebSocket connection
        this.ctx.acceptWebSocket(server);

        // Start heartbeat if not already running
        if (!this.heartbeatInterval) {
            this.startHeartbeat();
        }

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
        try {
            if (typeof message !== 'string') {
                this.sendError(ws, 'Invalid message format', true);
                return;
            }

            const data = JSON.parse(message) as ClientMessage;

            switch (data.type) {
                case 'authenticate':
                    await this.handleAuthenticate(ws, data);
                    break;
                case 'subscribe':
                    await this.handleSubscribe(ws, data.projectId);
                    break;
                case 'unsubscribe':
                    await this.handleUnsubscribe(ws, data.projectId);
                    break;
                case 'pong':
                    await this.handlePong(ws);
                    break;
                default:
                    this.sendError(ws, 'Unknown message type', true);
            }
        } catch (error) {
            logger.error('Error handling WebSocket message', { error });
            this.sendError(ws, 'Failed to process message', true);
        }
    }

    /**
     * Handle WebSocket close events
     */
    async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
        try {
            // Find and remove the connection
            let connectionId: string | null = null;
            for (const [id, conn] of this.connections.entries()) {
                if (conn.ws === ws) {
                    connectionId = id;
                    break;
                }
            }

            if (connectionId) {
                this.connections.delete(connectionId);
                await this.persistState();
                logger.info('WebSocket connection closed', { connectionId, code, reason });
            }

            // Stop heartbeat if no more connections
            if (this.connections.size === 0 && this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
            }
        } catch (error) {
            logger.error('Error handling WebSocket close', { error });
        }
    }

    /**
     * Handle WebSocket error events
     */
    async webSocketError(ws: WebSocket, error: Error): Promise<void> {
        logger.error('WebSocket error', { error });
    }

    // ========================================
    // MESSAGE HANDLERS
    // ========================================

    /**
     * Handle authentication message
     */
    private async handleAuthenticate(ws: WebSocket, data: AuthenticateMessage): Promise<void> {
        try {
            // Verify JWT token
            const user = await this.verifyToken(data.token);
            if (!user) {
                this.sendError(ws, 'Invalid token', false);
                ws.close(1008, 'Authentication failed');
                return;
            }

            // Generate connection ID
            const connectionId = crypto.randomUUID();

            // Store connection info
            const conn: ConnectionInfo = {
                userId: user.id,
                connectionId,
                clientType: data.clientType,
                subscriptions: new Set(data.projectId ? [data.projectId] : []),
                ws,
                lastHeartbeat: Date.now(),
            };

            this.connections.set(connectionId, conn);
            await this.persistState();

            // Send success response
            const response: AuthSuccessMessage = {
                type: 'auth_success',
                userId: user.id,
                connectionId,
                subscriptions: Array.from(conn.subscriptions),
                timestamp: new Date().toISOString(),
            };

            this.sendMessage(ws, response);
            logger.info('WebSocket authenticated', { userId: user.id, connectionId, clientType: data.clientType });
        } catch (error) {
            logger.error('Authentication error', { error });
            this.sendError(ws, 'Authentication failed', false);
            ws.close(1008, 'Authentication failed');
        }
    }

    /**
     * Handle subscribe message
     */
    private async handleSubscribe(ws: WebSocket, projectId: string): Promise<void> {
        const conn = this.findConnection(ws);
        if (!conn) {
            this.sendError(ws, 'Not authenticated', true);
            return;
        }

        conn.subscriptions.add(projectId);
        await this.persistState();

        logger.info('Subscribed to project', { connectionId: conn.connectionId, projectId });
    }

    /**
     * Handle unsubscribe message
     */
    private async handleUnsubscribe(ws: WebSocket, projectId: string): Promise<void> {
        const conn = this.findConnection(ws);
        if (!conn) {
            this.sendError(ws, 'Not authenticated', true);
            return;
        }

        conn.subscriptions.delete(projectId);
        await this.persistState();

        logger.info('Unsubscribed from project', { connectionId: conn.connectionId, projectId });
    }

    /**
     * Handle pong message (heartbeat response)
     */
    private async handlePong(ws: WebSocket): Promise<void> {
        const conn = this.findConnection(ws);
        if (conn) {
            conn.lastHeartbeat = Date.now();
        }
    }

    // ========================================
    // BROADCAST METHODS (CALLED BY ORCHESTRATION SERVICE)
    // ========================================

    /**
     * Broadcast ticket update to all subscribers
     */
    async broadcastTicketUpdate(
        projectId: string,
        ticketId: string,
        changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>,
        updatedBy: { userId: string; displayName: string; source: ActivitySource }
    ): Promise<void> {
        await this.ensureInitialized();

        const message: TicketUpdatedMessage = {
            type: 'ticket_updated',
            projectId,
            ticketId,
            changes,
            updatedBy,
            timestamp: new Date().toISOString(),
        };

        await this.broadcastToProject(projectId, message);
    }

    /**
     * Broadcast ticket status change
     */
    async broadcastTicketStatusChange(
        projectId: string,
        ticketId: string,
        oldStatus: TicketStatus,
        newStatus: TicketStatus,
        changedBy: { userId: string; displayName: string }
    ): Promise<void> {
        await this.ensureInitialized();

        const message: TicketStatusChangedMessage = {
            type: 'ticket_status_changed',
            projectId,
            ticketId,
            oldStatus,
            newStatus,
            changedBy,
            timestamp: new Date().toISOString(),
        };

        await this.broadcastToProject(projectId, message);
    }

    /**
     * Broadcast project status change
     */
    async broadcastProjectStatusChange(
        projectId: string,
        oldStatus: ProjectStatus,
        newStatus: ProjectStatus
    ): Promise<void> {
        await this.ensureInitialized();

        const message: ProjectStatusChangedMessage = {
            type: 'project_status_changed',
            projectId,
            oldStatus,
            newStatus,
            timestamp: new Date().toISOString(),
        };

        await this.broadcastToProject(projectId, message);
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    /**
     * Broadcast message to all connections subscribed to a project
     */
    private async broadcastToProject(projectId: string, message: ServerMessage): Promise<void> {
        let sentCount = 0;

        for (const conn of this.connections.values()) {
            if (conn.subscriptions.has(projectId)) {
                try {
                    this.sendMessage(conn.ws, message);
                    sentCount++;
                } catch (error) {
                    logger.error('Failed to send message to connection', {
                        connectionId: conn.connectionId,
                        error,
                    });
                }
            }
        }

        logger.info('Broadcast message to project', {
            projectId,
            messageType: message.type,
            recipientCount: sentCount,
        });
    }

    /**
     * Send message to specific WebSocket
     */
    private sendMessage(ws: WebSocket, message: ServerMessage): void {
        try {
            ws.send(JSON.stringify(message));
        } catch (error) {
            logger.error('Failed to send WebSocket message', { error });
            throw error;
        }
    }

    /**
     * Send error message
     */
    private sendError(ws: WebSocket, message: string, recoverable: boolean): void {
        try {
            ws.send(JSON.stringify({
                type: 'error',
                error: 'WEBSOCKET_ERROR',
                message,
                recoverable,
                timestamp: new Date().toISOString(),
            }));
        } catch (error) {
            logger.error('Failed to send error message', { error });
        }
    }

    /**
     * Find connection by WebSocket
     */
    private findConnection(ws: WebSocket): ConnectionInfo | undefined {
        for (const conn of this.connections.values()) {
            if (conn.ws === ws) {
                return conn;
            }
        }
        return undefined;
    }

    /**
     * Start heartbeat interval
     */
    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeats();
        }, 30000) as unknown as number; // Every 30 seconds
    }

    /**
     * Send heartbeat to all connections
     */
    private async sendHeartbeats(): Promise<void> {
        const now = Date.now();
        const timeout = 60000; // 60 seconds timeout

        const toRemove: string[] = [];

        for (const [connectionId, conn] of this.connections.entries()) {
            // Check if connection has timed out
            if (now - conn.lastHeartbeat > timeout) {
                logger.warn('Connection timed out', { connectionId });
                try {
                    conn.ws.close(1000, 'Timeout');
                } catch (error) {
                    // Ignore errors on close
                }
                toRemove.push(connectionId);
                continue;
            }

            // Send heartbeat
            try {
                const heartbeat: ServerMessage = {
                    type: 'heartbeat',
                    timestamp: new Date().toISOString(),
                };
                this.sendMessage(conn.ws, heartbeat);
            } catch (error) {
                logger.error('Failed to send heartbeat', { connectionId, error });
                toRemove.push(connectionId);
            }
        }

        // Remove timed out connections
        if (toRemove.length > 0) {
            for (const id of toRemove) {
                this.connections.delete(id);
            }
            await this.persistState();
        }
    }

    /**
     * Verify JWT token and extract user info
     */
    private async verifyToken(token: string): Promise<{ id: string; email: string } | null> {
        try {
            // Use the auth verification logic from the existing codebase
            // This is a simplified version - in production, you'd use the actual JWT verification
            const parts = token.split('.');
            if (parts.length !== 3) {
                return null;
            }

            const payload = JSON.parse(atob(parts[1]));
            
            // Check expiration
            if (payload.exp && payload.exp * 1000 < Date.now()) {
                return null;
            }

            return {
                id: payload.sub || payload.userId,
                email: payload.email,
            };
        } catch (error) {
            logger.error('Token verification failed', { error });
            return null;
        }
    }

    /**
     * Ensure Durable Object is initialized
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            const stored = await this.ctx.storage.get<StoredState>('state');
            
            if (stored && stored.connections) {
                // Note: We can't restore WebSocket objects, but we keep the metadata
                // Clients will need to reconnect after DO restart
                logger.info('Durable Object rehydrated', {
                    connectionCount: stored.connections.length,
                });
            }
            
            this.initialized = true;
        }
    }

    /**
     * Persist state to Durable Object storage
     */
    private async persistState(): Promise<void> {
        const state: StoredState = {
            connections: Array.from(this.connections.values()).map(conn => ({
                userId: conn.userId,
                connectionId: conn.connectionId,
                clientType: conn.clientType,
                subscriptions: Array.from(conn.subscriptions),
                lastHeartbeat: conn.lastHeartbeat,
            })),
        };

        await this.ctx.storage.put('state', state);
    }
}