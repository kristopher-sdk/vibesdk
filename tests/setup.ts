/**
 * Test Setup and Utilities
 * Provides mock data generators, database seeding, and cleanup utilities
 */

import { generateId } from '../worker/utils/idGenerator';
import type {
    Project,
    Ticket,
    TicketDependency,
    TicketAssignment,
    ProjectStatus,
    TicketStatus,
    TicketType,
    TicketPriority,
    DependencyType,
} from '../shared/types/orchestrator';

// ========================================
// MOCK DATA GENERATORS
// ========================================

export function createMockUser(overrides?: Partial<any>) {
    return {
        id: generateId(),
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: null,
        ...overrides,
    };
}

export function createMockApp(overrides?: Partial<any>) {
    return {
        id: generateId(),
        userId: generateId(),
        title: 'Test Todo App',
        description: 'A simple todo application for testing',
        visibility: 'private',
        tags: ['test', 'todo'],
        ...overrides,
    };
}

export function createMockProject(overrides?: Partial<Omit<Project, 'createdAt' | 'analyzedAt' | 'approvedAt' | 'completedAt'>>) {
    return {
        id: generateId(),
        appId: generateId(),
        title: 'Test Project',
        description: 'A test orchestration project',
        status: 'analyzing' as ProjectStatus,
        githubRepoUrl: null,
        githubRepoName: null,
        githubDefaultBranch: 'main',
        stakeholderUserId: null,
        analysisResult: null,
        totalTickets: 0,
        completedTickets: 0,
        createdAt: new Date(),
        analyzedAt: null,
        approvedAt: null,
        completedAt: null,
        ...overrides,
    };
}

export function createMockTicket(overrides?: Partial<Omit<Ticket, 'createdAt' | 'updatedAt' | 'startedAt' | 'completedAt'>>) {
    return {
        id: generateId(),
        projectId: generateId(),
        title: 'Test Ticket',
        description: 'Test ticket description',
        type: 'feature' as TicketType,
        priority: 'medium' as TicketPriority,
        estimatedHours: 4,
        actualHours: null,
        status: 'pending' as TicketStatus,
        orderIndex: 0,
        category: 'Development',
        tags: ['test'],
        branchName: null,
        prUrl: null,
        commitCount: 0,
        affectedFiles: [
            { path: 'src/test.ts', reason: 'Implementation', type: 'modify' as const }
        ],
        acceptanceCriteria: [
            { criterion: 'Feature works correctly', completed: false }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
        ...overrides,
    };
}

export function createMockTicketDependency(overrides?: Partial<Omit<TicketDependency, 'createdAt'>>) {
    return {
        id: generateId(),
        ticketId: generateId(),
        dependsOnTicketId: generateId(),
        dependencyType: 'blocks' as DependencyType,
        createdAt: new Date(),
        ...overrides,
    };
}

export function createMockTicketAssignment(overrides?: Partial<Omit<TicketAssignment, 'assignedAt' | 'unassignedAt' | 'completedAt'>>) {
    return {
        id: generateId(),
        ticketId: generateId(),
        userId: generateId(),
        status: 'assigned' as const,
        assignedAt: new Date(),
        unassignedAt: null,
        completedAt: null,
        ...overrides,
    };
}

// ========================================
// SAMPLE PROTOTYPE DATA
// ========================================

export function createSamplePrototype() {
    return {
        title: 'Todo Application',
        description: 'A simple todo list application with user authentication',
        files: [
            {
                path: 'src/index.html',
                content: `<!DOCTYPE html>
<html>
<head><title>Todo App</title></head>
<body>
  <div id="app"></div>
  <script src="app.js"></script>
</body>
</html>`,
            },
            {
                path: 'src/app.js',
                content: `// Todo App
const todos = [];
function addTodo(text) {
  todos.push({ id: Date.now(), text, completed: false });
}
function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (todo) todo.completed = !todo.completed;
}`,
            },
            {
                path: 'src/styles.css',
                content: `.todo { padding: 10px; }
.todo.completed { text-decoration: line-through; }`,
            },
            {
                path: 'package.json',
                content: JSON.stringify({
                    name: 'todo-app',
                    version: '1.0.0',
                    dependencies: {},
                }, null, 2),
            },
        ],
    };
}

// ========================================
// MOCK CLOUDFLARE BINDINGS
// ========================================

export function createMockEnv(): Record<string, any> {
    return {
        DB: null as any, // D1Database mock
        KV: null as any, // KVNamespace mock
        AI: null as any, // AI binding mock
        GITHUB_WEBHOOK_SECRET: 'test-webhook-secret',
        JWT_SECRET: 'test-jwt-secret',
    };
}

// ========================================
// TEST UTILITIES
// ========================================

/**
 * Wait for a condition to be true
 */
export async function waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100
): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (await condition()) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Create a mock JWT token
 */
export function createMockJWT(userId: string, email: string): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
        sub: userId,
        email,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    }));
    const signature = 'mock-signature';
    return `${header}.${payload}.${signature}`;
}

/**
 * Clean up test data
 */
export async function cleanupTestData(db: any, projectIds: string[]) {
    // This would delete test projects and all related data
    // Implementation depends on your database setup
    console.log('Cleaning up test data for projects:', projectIds);
}

// ========================================
// MOCK AI RESPONSES
// ========================================

export const mockAIAnalysisResponse = {
    overallComplexity: 5,
    techStack: {
        framework: 'vanilla-js',
        languages: ['javascript', 'html', 'css'],
        libraries: [],
        tools: [],
    },
    features: [
        {
            id: 'feat-1',
            name: 'Todo CRUD Operations',
            description: 'Create, read, update, and delete todo items',
            complexity: 5,
            estimatedHours: 4,
            isUserFacing: true,
            files: ['src/app.js', 'src/index.html'],
        },
        {
            id: 'feat-2',
            name: 'Todo Persistence',
            description: 'Save todos to local storage',
            complexity: 3,
            estimatedHours: 2,
            isUserFacing: false,
            files: ['src/app.js'],
        },
        {
            id: 'feat-3',
            name: 'UI Styling',
            description: 'Style the todo list interface',
            complexity: 2,
            estimatedHours: 2,
            isUserFacing: true,
            files: ['src/styles.css', 'src/index.html'],
        },
    ],
};

// ========================================
// GITHUB WEBHOOK PAYLOADS
// ========================================

export function createMockPullRequestWebhook(action: string, prNumber: number) {
    return {
        action,
        number: prNumber,
        pull_request: {
            number: prNumber,
            title: 'Test PR',
            html_url: `https://github.com/test/repo/pull/${prNumber}`,
            state: 'open',
            merged: false,
            head: {
                ref: 'feat/test-feature',
                sha: 'abc123',
            },
            base: {
                ref: 'main',
            },
        },
        repository: {
            full_name: 'test/repo',
            html_url: 'https://github.com/test/repo',
        },
        sender: {
            login: 'testuser',
        },
    };
}

export function createMockPushWebhook(branchName: string, commits: number) {
    return {
        ref: `refs/heads/${branchName}`,
        commits: Array.from({ length: commits }, (_, i) => ({
            id: `commit-${i}`,
            message: `Test commit ${i}`,
            author: {
                name: 'Test User',
                email: 'test@example.com',
            },
        })),
        repository: {
            full_name: 'test/repo',
            html_url: 'https://github.com/test/repo',
        },
        sender: {
            login: 'testuser',
        },
    };
}