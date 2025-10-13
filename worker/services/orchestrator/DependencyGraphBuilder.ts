/**
 * DependencyGraphBuilder - Manages ticket dependencies and ordering
 * Handles dependency graph construction, cycle detection, and topological sorting
 */

import { StructuredLogger } from '../../logger';
import type {
    Ticket,
    TicketDependency,
    TicketType,
    TicketPriority,
} from '../../../shared/types/orchestrator';

// ========================================
// TYPES
// ========================================

export interface DependencyGraph {
    nodes: Map<string, GraphNode>;
    edges: Map<string, Set<string>>; // ticketId -> Set of ticketIds it depends on
}

export interface GraphNode {
    ticketId: string;
    title: string;
    type: TicketType;
    files: string[];
    dependencies: string[]; // IDs of tickets this depends on
    dependents: string[]; // IDs of tickets that depend on this
}

export interface DependencyAnalysisResult {
    graph: DependencyGraph;
    sortedTickets: string[]; // Topologically sorted ticket IDs
    criticalPath: string[]; // Longest dependency chain
    hasCircularDependencies: boolean;
    circularDependencies?: string[][]; // Groups of tickets in circular dependency
}

// ========================================
// DEPENDENCY GRAPH BUILDER
// ========================================

export class DependencyGraphBuilder {
    constructor(private logger: StructuredLogger) {}

    /**
     * Build complete dependency graph from tickets
     */
    buildGraph(tickets: Ticket[]): DependencyGraph {
        this.logger.info('Building dependency graph', { ticketCount: tickets.length });

        const nodes = new Map<string, GraphNode>();
        const edges = new Map<string, Set<string>>();

        // Initialize nodes
        tickets.forEach(ticket => {
            nodes.set(ticket.id, {
                ticketId: ticket.id,
                title: ticket.title,
                type: ticket.type,
                files: (ticket.affectedFiles || []).map(f => f.path),
                dependencies: [],
                dependents: [],
            });
            edges.set(ticket.id, new Set());
        });

        // Build edges based on rules
        this.addSetupDependencies(tickets, nodes, edges);
        this.addFileDependencies(tickets, nodes, edges);
        this.addLogicalDependencies(tickets, nodes, edges);

        // Update node dependencies/dependents
        edges.forEach((deps, ticketId) => {
            const node = nodes.get(ticketId)!;
            node.dependencies = Array.from(deps);

            // Update dependents for each dependency
            deps.forEach(depId => {
                const depNode = nodes.get(depId);
                if (depNode && !depNode.dependents.includes(ticketId)) {
                    depNode.dependents.push(ticketId);
                }
            });
        });

        this.logger.info('Dependency graph built', {
            nodes: nodes.size,
            edges: Array.from(edges.values()).reduce((sum, set) => sum + set.size, 0),
        });

        return { nodes, edges };
    }

    /**
     * Detect circular dependencies in the graph
     */
    detectCycles(graph: DependencyGraph): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const currentPath: string[] = [];

        const dfs = (ticketId: string): boolean => {
            visited.add(ticketId);
            recursionStack.add(ticketId);
            currentPath.push(ticketId);

            const dependencies = graph.edges.get(ticketId) || new Set();
            for (const depId of dependencies) {
                if (!visited.has(depId)) {
                    if (dfs(depId)) {
                        return true;
                    }
                } else if (recursionStack.has(depId)) {
                    // Found a cycle - extract it from currentPath
                    const cycleStart = currentPath.indexOf(depId);
                    const cycle = currentPath.slice(cycleStart);
                    cycles.push([...cycle, depId]); // Include the repeated node
                    return true;
                }
            }

            recursionStack.delete(ticketId);
            currentPath.pop();
            return false;
        };

        // Check all nodes
        for (const ticketId of graph.nodes.keys()) {
            if (!visited.has(ticketId)) {
                dfs(ticketId);
            }
        }

        if (cycles.length > 0) {
            this.logger.warn('Circular dependencies detected', {
                cycleCount: cycles.length,
                cycles: cycles.map(c => c.map(id => graph.nodes.get(id)?.title)),
            });
        }

        return cycles;
    }

    /**
     * Perform topological sort on the dependency graph
     * Returns tickets ordered by dependencies (dependencies first)
     */
    topologicalSort(graph: DependencyGraph): string[] {
        // Check for cycles first
        const cycles = this.detectCycles(graph);
        if (cycles.length > 0) {
            throw new Error(`Cannot sort graph with circular dependencies: ${cycles.length} cycle(s) detected`);
        }

        const sorted: string[] = [];
        const visited = new Set<string>();
        const temp = new Set<string>();

        const visit = (ticketId: string) => {
            if (temp.has(ticketId)) {
                // This should not happen if detectCycles worked correctly
                throw new Error(`Circular dependency detected at ${ticketId}`);
            }
            if (visited.has(ticketId)) {
                return;
            }

            temp.add(ticketId);

            // Visit all dependencies first
            const deps = graph.edges.get(ticketId) || new Set();
            for (const depId of deps) {
                visit(depId);
            }

            temp.delete(ticketId);
            visited.add(ticketId);
            sorted.push(ticketId);
        };

        // Visit all nodes
        for (const ticketId of graph.nodes.keys()) {
            if (!visited.has(ticketId)) {
                visit(ticketId);
            }
        }

        this.logger.info('Topological sort completed', { ticketCount: sorted.length });
        return sorted;
    }

    /**
     * Calculate the critical path (longest dependency chain)
     */
    calculateCriticalPath(graph: DependencyGraph): string[] {
        // Use dynamic programming to find longest path
        const memo = new Map<string, string[]>();

        const getLongestPath = (ticketId: string): string[] => {
            if (memo.has(ticketId)) {
                return memo.get(ticketId)!;
            }

            const deps = graph.edges.get(ticketId) || new Set();
            if (deps.size === 0) {
                // Leaf node
                memo.set(ticketId, [ticketId]);
                return [ticketId];
            }

            // Find longest path among dependencies
            let longestPath: string[] = [];
            for (const depId of deps) {
                const depPath = getLongestPath(depId);
                if (depPath.length > longestPath.length) {
                    longestPath = depPath;
                }
            }

            const path = [...longestPath, ticketId];
            memo.set(ticketId, path);
            return path;
        };

        // Find the overall longest path
        let criticalPath: string[] = [];
        for (const ticketId of graph.nodes.keys()) {
            const path = getLongestPath(ticketId);
            if (path.length > criticalPath.length) {
                criticalPath = path;
            }
        }

        this.logger.info('Critical path calculated', {
            length: criticalPath.length,
            tickets: criticalPath.map(id => graph.nodes.get(id)?.title),
        });

        return criticalPath;
    }

    /**
     * Perform complete dependency analysis
     */
    analyzeDependencies(tickets: Ticket[]): DependencyAnalysisResult {
        const graph = this.buildGraph(tickets);
        const cycles = this.detectCycles(graph);
        const hasCircularDependencies = cycles.length > 0;

        let sortedTickets: string[] = [];
        let criticalPath: string[] = [];

        if (!hasCircularDependencies) {
            sortedTickets = this.topologicalSort(graph);
            criticalPath = this.calculateCriticalPath(graph);
        }

        return {
            graph,
            sortedTickets,
            criticalPath,
            hasCircularDependencies,
            circularDependencies: cycles.length > 0 ? cycles : undefined,
        };
    }

    // ========================================
    // DEPENDENCY RULE IMPLEMENTATIONS
    // ========================================

    /**
     * Rule 1: Setup ticket must be first
     */
    private addSetupDependencies(
        tickets: Ticket[],
        nodes: Map<string, GraphNode>,
        edges: Map<string, Set<string>>
    ): void {
        const setupTicket = tickets.find(t => t.type === 'setup');
        if (!setupTicket) return;

        tickets.forEach(ticket => {
            if (ticket.id !== setupTicket.id) {
                edges.get(ticket.id)!.add(setupTicket.id);
            }
        });
    }

    /**
     * Rule 2: File-based dependencies
     * If ticket A modifies files that ticket B depends on, B depends on A
     */
    private addFileDependencies(
        tickets: Ticket[],
        nodes: Map<string, GraphNode>,
        edges: Map<string, Set<string>>
    ): void {
        // Build file modification map
        const fileModifiers = new Map<string, string[]>(); // filePath -> ticket IDs that modify it
        
        tickets.forEach(ticket => {
            const files = (ticket.affectedFiles || []).map(f => f.path);
            files.forEach(file => {
                if (!fileModifiers.has(file)) {
                    fileModifiers.set(file, []);
                }
                fileModifiers.get(file)!.push(ticket.id);
            });
        });

        // Add dependencies based on file modifications
        tickets.forEach(ticket => {
            const files = (ticket.affectedFiles || []).map(f => f.path);
            
            files.forEach(file => {
                const modifiers = fileModifiers.get(file) || [];
                modifiers.forEach(modifierId => {
                    if (modifierId !== ticket.id) {
                        // Check if there's a logical ordering (e.g., create before modify)
                        const modifier = tickets.find(t => t.id === modifierId);
                        if (modifier && this.shouldDependOn(ticket, modifier)) {
                            edges.get(ticket.id)!.add(modifierId);
                        }
                    }
                });
            });
        });
    }

    /**
     * Rule 3: Logical dependencies based on ticket types and content
     */
    private addLogicalDependencies(
        tickets: Ticket[],
        nodes: Map<string, GraphNode>,
        edges: Map<string, Set<string>>
    ): void {
        tickets.forEach(ticket => {
            tickets.forEach(otherTicket => {
                if (ticket.id === otherTicket.id) return;

                // Test tickets depend on the features they test
                if (ticket.type === 'test' && otherTicket.type === 'feature') {
                    if (this.ticketsAreRelated(ticket, otherTicket)) {
                        edges.get(ticket.id)!.add(otherTicket.id);
                    }
                }

                // Documentation depends on feature implementation
                if (ticket.type === 'documentation' && otherTicket.type === 'feature') {
                    if (this.ticketsAreRelated(ticket, otherTicket)) {
                        edges.get(ticket.id)!.add(otherTicket.id);
                    }
                }

                // Refactors typically come after initial implementation
                if (ticket.type === 'refactor' && otherTicket.type === 'feature') {
                    if (this.ticketsAreRelated(ticket, otherTicket)) {
                        edges.get(ticket.id)!.add(otherTicket.id);
                    }
                }
            });
        });
    }

    /**
     * Determine if ticket A should depend on ticket B based on their types and content
     */
    private shouldDependOn(ticketA: Ticket, ticketB: Ticket): boolean {
        // Setup always comes first
        if (ticketB.type === 'setup') return true;

        // Features come before enhancements
        if (ticketA.type === 'enhancement' && ticketB.type === 'feature') {
            return this.ticketsAreRelated(ticketA, ticketB);
        }

        // Features come before refactors
        if (ticketA.type === 'refactor' && ticketB.type === 'feature') {
            return this.ticketsAreRelated(ticketA, ticketB);
        }

        // Check if they work on related files
        const filesA = (ticketA.affectedFiles || []).map(f => f.path);
        const filesB = (ticketB.affectedFiles || []).map(f => f.path);
        
        return filesA.some(fileA => filesB.includes(fileA));
    }

    /**
     * Check if two tickets are related by analyzing their content
     */
    private ticketsAreRelated(ticket1: Ticket, ticket2: Ticket): boolean {
        // Check if they share files
        const files1 = (ticket1.affectedFiles || []).map(f => f.path);
        const files2 = (ticket2.affectedFiles || []).map(f => f.path);
        
        if (files1.some(f => files2.includes(f))) {
            return true;
        }

        // Check if titles/descriptions contain similar keywords
        const words1 = this.extractKeywords(ticket1.title + ' ' + ticket1.description);
        const words2 = this.extractKeywords(ticket2.title + ' ' + ticket2.description);
        
        const commonWords = words1.filter(w => words2.includes(w));
        return commonWords.length >= 2; // At least 2 common keywords
    }

    /**
     * Extract meaningful keywords from text
     */
    private extractKeywords(text: string): string[] {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
            'implement', 'add', 'create', 'update', 'fix', 'refactor',
        ]);

        return text
            .toLowerCase()
            .split(/\W+/)
            .filter(word => word.length > 3 && !stopWords.has(word));
    }
}