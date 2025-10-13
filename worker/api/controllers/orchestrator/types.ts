/**
 * Request and Response types for Orchestration API
 * Uses Zod for validation
 */

import { z } from 'zod';
import {
    ProjectStatus,
    TicketStatus,
    TicketPriority,
    TicketType,
} from '../../../../shared/types/orchestrator';

// ========================================
// ZOD SCHEMAS FOR VALIDATION
// ========================================

/**
 * Create project request schema
 */
export const CreateProjectRequestSchema = z.object({
    appId: z.string().uuid('Invalid app ID format'),
    title: z.string().min(1).max(200).optional(),
});

/**
 * Generate tickets request schema
 */
export const GenerateTicketsRequestSchema = z.object({
    guidance: z.string().max(5000).optional(),
});

/**
 * Update ticket request schema
 */
export const UpdateTicketRequestSchema = z.object({
    status: z.enum([
        'in_progress',
        'review',
        'blocked',
        'completed',
    ] as const).optional(),
    actualHours: z.number().int().min(0).max(1000).optional(),
    branchName: z.string().max(255).optional(),
    prUrl: z.string().url().optional(),
    notes: z.string().max(5000).optional(),
});

/**
 * Assign ticket request schema
 */
export const AssignTicketRequestSchema = z.object({
    developerId: z.string().uuid('Invalid developer ID format').optional(),
});

/**
 * List tickets query schema
 */
export const ListTicketsQuerySchema = z.object({
    projectId: z.string().uuid().optional(),
    status: z.array(z.string()).optional(),
    assignedToMe: z.enum(['true', 'false']).optional(),
    ready: z.enum(['true', 'false']).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
});

/**
 * Update project request schema
 */
export const UpdateProjectRequestSchema = z.object({
    action: z.enum(['approve', 'regenerate', 'archive']),
    ticketUpdates: z.array(z.object({
        ticketId: z.string().uuid(),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    })).optional(),
    guidance: z.string().max(5000).optional(),
});

// ========================================
// TYPESCRIPT TYPES
// ========================================

export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export type GenerateTicketsRequest = z.infer<typeof GenerateTicketsRequestSchema>;
export type UpdateTicketRequest = z.infer<typeof UpdateTicketRequestSchema>;
export type AssignTicketRequest = z.infer<typeof AssignTicketRequestSchema>;
export type ListTicketsQuery = z.infer<typeof ListTicketsQuerySchema>;
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;

// ========================================
// RESPONSE DATA TYPES
// ========================================

/**
 * Create project response data
 */
export interface CreateProjectData {
    project: {
        id: string;
        appId: string;
        title: string;
        description: string | null;
        status: ProjectStatus;
        createdAt: Date;
    };
    message: string;
}

/**
 * Get project response data
 */
export interface GetProjectData {
    project: any; // ProjectWithRelations from shared types
    tickets: any[]; // TicketWithRelations[]
    dependencies: any[];
}

/**
 * Generate tickets response data
 */
export interface GenerateTicketsData {
    success: boolean;
    message: string;
}

/**
 * List tickets response data
 */
export interface ListTicketsData {
    tickets: any[]; // TicketWithRelations[]
    pagination: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
    };
}

/**
 * Get ticket response data
 */
export interface GetTicketData {
    ticket: any; // TicketWithRelations
}

/**
 * Update ticket response data
 */
export interface UpdateTicketData {
    success: boolean;
    ticket: any; // Ticket
}

/**
 * Assign ticket response data
 */
export interface AssignTicketData {
    success: boolean;
    ticket: any; // Ticket
    branchName: string;
}

/**
 * Update project response data
 */
export interface UpdateProjectData {
    success: boolean;
    project?: any; // Project
    message: string;
}