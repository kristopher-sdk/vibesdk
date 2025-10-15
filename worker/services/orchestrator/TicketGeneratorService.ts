/**
 * TicketGeneratorService - Main orchestrator for ticket generation
 * Implements the 9-phase algorithm from architecture document
 */

import { BaseService } from '../../database/services/BaseService';
import * as schema from '../../database/orchestrator-schema';
import * as mainSchema from '../../database/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '../../utils/idGenerator';
import { AIAnalyzer, type Feature, type FileInfo } from './AIAnalyzer';
import { DependencyGraphBuilder } from './DependencyGraphBuilder';
import { InferenceContext } from '../../agents/inferutils/config.types';
import {
    TicketPriority,
    TicketType,
    TicketStatus,
    ProjectStatus,
    DependencyType,
} from '../../../shared/types/orchestrator';
import type {
    Ticket,
    AcceptanceCriterion,
} from '../../../shared/types/orchestrator';

// ========================================
// TYPES
// ========================================

export interface TicketGenerationResult {
    success: boolean;
    tickets: Ticket[];
    totalHours: number;
    error?: string;
}

interface GeneratedTicket extends Omit<Ticket, 'createdAt' | 'updatedAt' | 'startedAt' | 'completedAt'> {
    featureId?: string; // Link back to the feature for dependency analysis
}

// ========================================
// TICKET GENERATOR SERVICE
// ========================================

export class TicketGeneratorService extends BaseService {
    private aiAnalyzer: AIAnalyzer;
    private dependencyBuilder: DependencyGraphBuilder;

    constructor(
        env: Env,
        context: InferenceContext
    ) {
        super(env);
        this.aiAnalyzer = new AIAnalyzer(env, context, this.logger);
        this.dependencyBuilder = new DependencyGraphBuilder(this.logger);
    }

    /**
     * Main entry point - Generate tickets for a project
     * Implements the 9-phase algorithm
     */
    async generateTickets(projectId: string): Promise<TicketGenerationResult> {
        try {
            this.logger.info('Starting ticket generation', { projectId });

            // Get project and app data
            const project = await this.database
                .select()
                .from(schema.orchestrationProjects)
                .where(eq(schema.orchestrationProjects.id, projectId))
                .get();

            if (!project) {
                throw new Error('Project not found');
            }

            const app = await this.database
                .select()
                .from(mainSchema.apps)
                .where(eq(mainSchema.apps.id, project.appId))
                .get();

            if (!app) {
                throw new Error('App not found');
            }

            // PHASE 1: Prototype Analysis
            this.logger.info('Phase 1: Prototype Analysis');
            const files = await this.fetchAppFiles(project.appId);
            
            if (files.length === 0) {
                throw new Error('No files found in app');
            }

            // PHASE 2: Feature Detection (AI-powered)
            this.logger.info('Phase 2: Feature Detection (AI-powered)');
            const analysis = await this.aiAnalyzer.analyzePrototype(
                files,
                app.description || 'No description provided'
            );

            if (!analysis) {
                // Fallback to basic analysis if AI fails
                this.logger.warn('AI analysis failed, using fallback');
                return await this.generateBasicTickets(projectId, files);
            }

            // PHASE 3: Task Breakdown
            this.logger.info('Phase 3: Task Breakdown');
            const initialTickets = await this.createInitialTickets(
                analysis.features,
                files,
                project
            );

            // PHASE 4 & 5: Dependency Analysis & Conflict Detection
            this.logger.info('Phase 4-5: Dependency Analysis');
            const dependencyAnalysis = this.dependencyBuilder.analyzeDependencies(
                initialTickets.map(t => this.ticketToType(t))
            );

            if (dependencyAnalysis.hasCircularDependencies) {
                this.logger.error('Circular dependencies detected', {
                    cycles: dependencyAnalysis.circularDependencies,
                });
                throw new Error('Circular dependencies detected in ticket plan');
            }

            // PHASE 6: Context Extraction
            this.logger.info('Phase 6: Context Extraction');
            await this.saveProjectContext(projectId, analysis, files);

            // PHASE 7: Topological Sort
            this.logger.info('Phase 7: Topological Sort');
            const sortedTicketIds = dependencyAnalysis.sortedTickets;
            const sortedTickets = sortedTicketIds.map((id, index) => {
                const ticket = initialTickets.find(t => t.id === id)!;
                return { ...ticket, orderIndex: index };
            });

            // PHASE 8: Ticket Finalization
            this.logger.info('Phase 8: Ticket Finalization');
            const finalizedTickets = await this.finalizeTickets(sortedTickets, files);

            // PHASE 9: Database Persistence
            this.logger.info('Phase 9: Database Persistence');
            await this.saveTicketsToDatabase(projectId, finalizedTickets, dependencyAnalysis);

            const totalHours = finalizedTickets.reduce(
                (sum, t) => sum + (t.estimatedHours || 0),
                0
            );

            // Update project status
            await this.database
                .update(schema.orchestrationProjects)
                .set({
                    status: 'review' as ProjectStatus,
                    analyzedAt: new Date(),
                    totalTickets: finalizedTickets.length,
                    analysisResult: JSON.stringify({
                        complexity: {
                            overall: analysis.overallComplexity,
                            frontend: 0,
                            backend: 0,
                            database: 0,
                        },
                        features: analysis.features.map(f => ({
                            name: f.name,
                            description: f.description,
                            complexity: f.complexity,
                        })),
                        techStack: analysis.techStack,
                        estimatedTotalHours: totalHours,
                    }),
                })
                .where(eq(schema.orchestrationProjects.id, projectId));

            this.logger.info('Ticket generation completed', {
                ticketCount: finalizedTickets.length,
                totalHours,
            });

            return {
                success: true,
                tickets: finalizedTickets.map(t => this.ticketToType(t)),
                totalHours,
            };
        } catch (error) {
            this.logger.error('Ticket generation failed', { error });
            return {
                success: false,
                tickets: [],
                totalHours: 0,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // ========================================
    // PHASE IMPLEMENTATIONS
    // ========================================

    /**
     * Phase 1: Fetch app files from database
     */
    private async fetchAppFiles(_appId: string): Promise<FileInfo[]> {
        // In a real implementation, this would fetch from the app's file storage
        // For now, we'll need to add a query to get app files
        // This is a placeholder - you'll need to implement the actual file fetching
        
        // TODO: Implement actual file fetching from app storage
        // For now, return empty array - this will be filled in when file storage is ready
        this.logger.warn('File fetching not yet implemented - using placeholder');
        
        return [];
    }

    /**
     * Phase 3: Create initial tickets from features
     */
    private async createInitialTickets(
        features: Feature[],
        files: FileInfo[],
        _project: typeof schema.orchestrationProjects.$inferSelect
    ): Promise<GeneratedTicket[]> {
        const tickets: GeneratedTicket[] = [];

        // Always add setup ticket first
        tickets.push({
            id: generateId(),
            projectId: _project.id,
            title: 'Project Setup and Configuration',
            description: this.generateSetupDescription(files),
            type: 'setup' as TicketType,
            priority: 'critical' as TicketPriority,
            status: 'pending' as TicketStatus,
            estimatedHours: 2,
            actualHours: null,
            orderIndex: 0,
            category: 'Infrastructure',
            tags: ['setup', 'configuration'],
            branchName: null,
            prUrl: null,
            commitCount: 0,
            affectedFiles: [
                { path: 'package.json', reason: 'Dependencies', type: 'modify' },
                { path: 'README.md', reason: 'Documentation', type: 'modify' },
            ],
            acceptanceCriteria: [
                { criterion: 'All dependencies installed successfully', completed: false },
                { criterion: 'Development server runs without errors', completed: false },
                { criterion: 'README updated with setup instructions', completed: false },
            ],
        });

        // Create tickets for each feature
        for (const feature of features) {
            const ticketId = generateId();
            const priority = this.determinePriority(feature);
            
            tickets.push({
                id: ticketId,
                projectId: _project.id,
                featureId: feature.id,
                title: `Implement ${feature.name}`,
                description: feature.description,
                type: 'feature' as TicketType,
                priority,
                status: 'pending' as TicketStatus,
                estimatedHours: feature.estimatedHours,
                actualHours: null,
                orderIndex: 0, // Will be set during topological sort
                category: feature.isUserFacing ? 'Frontend' : 'Backend',
                tags: [feature.isUserFacing ? 'ui' : 'logic', 'feature'],
                branchName: null,
                prUrl: null,
                commitCount: 0,
                affectedFiles: feature.files.map(path => ({
                    path,
                    reason: 'Feature implementation',
                    type: 'modify' as const,
                })),
                acceptanceCriteria: this.generateAcceptanceCriteria(feature),
            });
        }

        return tickets;
    }

    /**
     * Phase 6: Save project context
     */
    private async saveProjectContext(
        projectId: string,
        analysis: Awaited<ReturnType<AIAnalyzer['analyzePrototype']>>,
        files: FileInfo[]
    ): Promise<void> {
        if (!analysis) return;

        // Save tech stack context
        await this.database.insert(schema.orchestrationProjectContext).values({
            id: generateId(),
            projectId,
            contextType: 'tech_stack',
            data: JSON.stringify(analysis.techStack),
        });

        // Save features context
        await this.database.insert(schema.orchestrationProjectContext).values({
            id: generateId(),
            projectId,
            contextType: 'features',
            data: JSON.stringify({
                features: analysis.features.map(f => ({
                    name: f.name,
                    description: f.description,
                })),
            }),
        });

        // Save file structure context
        await this.database.insert(schema.orchestrationProjectContext).values({
            id: generateId(),
            projectId,
            contextType: 'file_structure',
            data: JSON.stringify({
                directories: [...new Set(files.map(f => f.path.split('/')[0]))],
                fileCount: files.length,
                structure: this.buildFileStructure(files),
            }),
        });
    }

    /**
     * Phase 8: Finalize tickets with AI-generated descriptions
     */
    private async finalizeTickets(
        tickets: GeneratedTicket[],
        _files: FileInfo[]
    ): Promise<GeneratedTicket[]> {
        // For setup ticket and other non-feature tickets, use as-is
        // For feature tickets, optionally enhance with AI
        
        return tickets; // For now, return as-is
        // In a full implementation, you could call AI to enhance descriptions
    }

    /**
     * Phase 9: Save tickets to database
     */
    private async saveTicketsToDatabase(
        _projectId: string,
        tickets: GeneratedTicket[],
        dependencyAnalysis: Awaited<ReturnType<DependencyGraphBuilder['analyzeDependencies']>>
    ): Promise<void> {
        // Save tickets
        for (const ticket of tickets) {
            await this.database.insert(schema.orchestrationTickets).values({
                id: ticket.id,
                projectId: ticket.projectId,
                title: ticket.title,
                description: ticket.description,
                type: ticket.type,
                priority: ticket.priority,
                status: ticket.status,
                estimatedHours: ticket.estimatedHours,
                actualHours: ticket.actualHours,
                orderIndex: ticket.orderIndex,
                category: ticket.category,
                tags: JSON.stringify(ticket.tags),
                branchName: ticket.branchName,
                prUrl: ticket.prUrl,
                commitCount: ticket.commitCount,
                affectedFiles: JSON.stringify(ticket.affectedFiles),
                acceptanceCriteria: JSON.stringify(ticket.acceptanceCriteria),
            });
        }

        // Save dependencies
        for (const [ticketId, deps] of dependencyAnalysis.graph.edges.entries()) {
            for (const depId of deps) {
                await this.database.insert(schema.orchestrationTicketDependencies).values({
                    id: generateId(),
                    ticketId,
                    dependsOnTicketId: depId,
                    dependencyType: 'blocks' as DependencyType,
                });
            }
        }
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    /**
     * Fallback: Generate basic tickets without AI
     */
    private async generateBasicTickets(
        projectId: string,
        _files: FileInfo[]
    ): Promise<TicketGenerationResult> {
        this.logger.info('Generating basic tickets without AI');

        const tickets: GeneratedTicket[] = [];

        // Setup ticket
        tickets.push({
            id: generateId(),
            projectId,
            title: 'Project Setup',
            description: 'Set up the project and install dependencies',
            type: 'setup' as TicketType,
            priority: 'critical' as TicketPriority,
            status: 'pending' as TicketStatus,
            estimatedHours: 2,
            actualHours: null,
            orderIndex: 0,
            category: null,
            tags: null,
            branchName: null,
            prUrl: null,
            commitCount: 0,
            affectedFiles: [{ path: 'package.json', reason: 'Setup', type: 'modify' }],
            acceptanceCriteria: [{ criterion: 'Project runs', completed: false }],
        });

        // Save to database
        for (const ticket of tickets) {
            await this.database.insert(schema.orchestrationTickets).values({
                id: ticket.id,
                projectId: ticket.projectId,
                title: ticket.title,
                description: ticket.description,
                type: ticket.type,
                priority: ticket.priority,
                status: ticket.status,
                estimatedHours: ticket.estimatedHours,
                actualHours: ticket.actualHours,
                orderIndex: ticket.orderIndex,
                category: ticket.category,
                tags: JSON.stringify(ticket.tags),
                branchName: ticket.branchName,
                prUrl: ticket.prUrl,
                commitCount: ticket.commitCount,
                affectedFiles: JSON.stringify(ticket.affectedFiles),
                acceptanceCriteria: JSON.stringify(ticket.acceptanceCriteria),
            });
        }

        // Update project
        await this.database
            .update(schema.orchestrationProjects)
            .set({
                status: 'review' as ProjectStatus,
                analyzedAt: new Date(),
                totalTickets: tickets.length,
            })
            .where(eq(schema.orchestrationProjects.id, projectId));

        return {
            success: true,
            tickets: tickets.map(t => this.ticketToType(t)),
            totalHours: 2,
        };
    }

    private generateSetupDescription(files: FileInfo[]): string {
        return `Initialize the project environment and set up the development workflow.

**Tasks:**
- Install all project dependencies
- Configure development environment
- Set up build tools and scripts
- Verify all tools and dependencies work correctly

**Files to configure:**
${files.filter(f => f.path.includes('config') || f.path.includes('package')).map(f => `- ${f.path}`).join('\n') || '- package.json\n- Configuration files'}

**Deliverables:**
- Working development environment
- All dependencies installed
- Development server runs successfully`;
    }

    private determinePriority(feature: Feature): TicketPriority {
        if (feature.complexity >= 8) return TicketPriority.HIGH;
        if (feature.complexity >= 5) return TicketPriority.MEDIUM;
        return TicketPriority.LOW;
    }

    private generateAcceptanceCriteria(feature: Feature): AcceptanceCriterion[] {
        return [
            {
                criterion: `${feature.name} is fully implemented`,
                completed: false,
            },
            {
                criterion: feature.isUserFacing
                    ? 'UI is responsive and matches design'
                    : 'Logic handles all edge cases',
                completed: false,
            },
            {
                criterion: 'Code is tested and working',
                completed: false,
            },
        ];
    }

    private buildFileStructure(files: FileInfo[]): Record<string, string[]> {
        const structure: Record<string, string[]> = {};
        
        files.forEach(file => {
            const parts = file.path.split('/');
            const dir = parts[0];
            
            if (!structure[dir]) {
                structure[dir] = [];
            }
            structure[dir].push(file.path);
        });

        return structure;
    }

    private ticketToType(ticket: GeneratedTicket): Ticket {
        return {
            ...ticket,
            createdAt: new Date(),
            updatedAt: new Date(),
            startedAt: null,
            completedAt: null,
        };
    }
}