/**
 * GitHubOrchestratorService
 * Handles GitHub operations specifically for orchestration projects
 * Wraps GitHubService for orchestration-specific workflows
 */

import { GitHubService } from '../github/GitHubService';
import { Octokit } from '@octokit/rest';
import { createLogger } from '../../logger';
import type {
    CreateRepositoryResult,
} from '../github/types';
import type { Project, Ticket } from '../../../shared/types/orchestrator';

export interface CreateRepositoryFromProjectOptions {
    project: Project;
    githubToken: string;
    files: Array<{ filePath: string; fileContents: string }>;
}

export interface CreateRepositoryFromProjectResult {
    success: boolean;
    repositoryUrl?: string;
    cloneUrl?: string;
    defaultBranch?: string;
    error?: string;
}

export interface CreateBranchForTicketOptions {
    ticket: Ticket;
    project: Project;
    githubToken: string;
}

export interface CreateBranchForTicketResult {
    success: boolean;
    branchName?: string;
    branchUrl?: string;
    baseSha?: string;
    error?: string;
}

export interface CreatePullRequestOptions {
    ticket: Ticket;
    project: Project;
    githubToken: string;
}

export interface CreatePullRequestResult {
    success: boolean;
    prUrl?: string;
    prNumber?: number;
    error?: string;
}

export interface LinkCommitToTicketOptions {
    commitSha: string;
    ticketId: string;
    project: Project;
    githubToken: string;
}

export interface SetupWebhooksOptions {
    repoUrl: string;
    githubToken: string;
    webhookUrl: string;
}

export interface SetupWebhooksResult {
    success: boolean;
    webhookId?: number;
    error?: string;
}

export class GitHubOrchestratorService {
    private static readonly logger = createLogger('GitHubOrchestratorService');

    /**
     * Create GitHub repository from orchestration project
     * Pushes initial code and sets up branch protection
     */
    static async createRepositoryFromProject(
        options: CreateRepositoryFromProjectOptions
    ): Promise<CreateRepositoryFromProjectResult> {
        const { project, githubToken, files } = options;

        try {
            this.logger.info('Creating GitHub repository for project', {
                projectId: project.id,
                title: project.title,
            });

            // Sanitize repository name
            const repoName = this.sanitizeRepoName(project.title);

            // Create repository
            const createResult: CreateRepositoryResult = await GitHubService.createUserRepository({
                name: repoName,
                description: project.description || `Orchestrated project from ${project.title}`,
                private: true,
                auto_init: true, // Initialize with README
                token: githubToken,
            });

            if (!createResult.success || !createResult.repository) {
                return {
                    success: false,
                    error: createResult.error || 'Failed to create repository',
                };
            }

            const repository = createResult.repository;

            // Push initial files if provided
            if (files.length > 0) {
                this.logger.info('Pushing initial files to repository', {
                    fileCount: files.length,
                    repoUrl: repository.html_url,
                });

                const pushResult = await GitHubService.pushFilesToRepository(
                    files,
                    {
                        repositoryHtmlUrl: repository.html_url,
                        cloneUrl: repository.clone_url,
                        token: githubToken,
                        email: 'noreply@vibesdk.com',
                        username: 'vibesdk-orchestrator',
                        isPrivate: true,
                    }
                );

                if (!pushResult.success) {
                    this.logger.warn('Failed to push initial files', {
                        error: pushResult.error,
                        repoUrl: repository.html_url,
                    });
                    // Don't fail - repository was created
                }
            }

            // Set up branch protection (optional - may fail for free accounts)
            try {
                await this.setupBranchProtection(
                    githubToken,
                    repository.full_name,
                    repository.default_branch
                );
            } catch (error) {
                this.logger.warn('Branch protection setup failed (may require paid account)', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                // Don't fail the operation
            }

            this.logger.info('Repository created successfully', {
                projectId: project.id,
                repoUrl: repository.html_url,
            });

            return {
                success: true,
                repositoryUrl: repository.html_url,
                cloneUrl: repository.clone_url,
                defaultBranch: repository.default_branch,
            };
        } catch (error) {
            this.logger.error('Failed to create repository from project', {
                projectId: project.id,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Create feature branch for ticket
     */
    static async createBranchForTicket(
        options: CreateBranchForTicketOptions
    ): Promise<CreateBranchForTicketResult> {
        const { ticket, project, githubToken } = options;

        try {
            if (!project.githubRepoName) {
                return {
                    success: false,
                    error: 'Project does not have a GitHub repository',
                };
            }

            const [owner, repo] = project.githubRepoName.split('/');
            const branchName = this.generateBranchName(ticket);
            const octokit = new Octokit({ auth: githubToken });

            this.logger.info('Creating branch for ticket', {
                ticketId: ticket.id,
                branchName,
                repo: project.githubRepoName,
            });

            // Get default branch SHA
            const { data: ref } = await octokit.rest.git.getRef({
                owner,
                repo,
                ref: `heads/${project.githubDefaultBranch || 'main'}`,
            });

            // Create new branch
            await octokit.rest.git.createRef({
                owner,
                repo,
                ref: `refs/heads/${branchName}`,
                sha: ref.object.sha,
            });

            const branchUrl = `${project.githubRepoUrl}/tree/${branchName}`;

            this.logger.info('Branch created successfully', {
                ticketId: ticket.id,
                branchName,
                branchUrl,
            });

            return {
                success: true,
                branchName,
                branchUrl,
                baseSha: ref.object.sha,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Check if branch already exists
            if (errorMessage.includes('already exists')) {
                this.logger.warn('Branch already exists', {
                    ticketId: ticket.id,
                    error: errorMessage,
                });
                
                const branchName = this.generateBranchName(ticket);
                return {
                    success: true,
                    branchName,
                    branchUrl: `${project.githubRepoUrl}/tree/${branchName}`,
                };
            }

            this.logger.error('Failed to create branch', {
                ticketId: ticket.id,
                error: errorMessage,
            });

            return {
                success: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Create pull request for completed ticket
     */
    static async createPullRequest(
        options: CreatePullRequestOptions
    ): Promise<CreatePullRequestResult> {
        const { ticket, project, githubToken } = options;

        try {
            if (!project.githubRepoName || !ticket.branchName) {
                return {
                    success: false,
                    error: 'Missing repository name or branch name',
                };
            }

            const [owner, repo] = project.githubRepoName.split('/');
            const octokit = new Octokit({ auth: githubToken });

            this.logger.info('Creating pull request for ticket', {
                ticketId: ticket.id,
                branchName: ticket.branchName,
                repo: project.githubRepoName,
            });

            // Generate PR body
            const body = this.generatePRBody(ticket);

            // Create PR
            const { data: pr } = await octokit.rest.pulls.create({
                owner,
                repo,
                title: ticket.title,
                head: ticket.branchName,
                base: project.githubDefaultBranch || 'main',
                body,
                draft: false,
            });

            // Add labels
            try {
                await octokit.rest.issues.addLabels({
                    owner,
                    repo,
                    issue_number: pr.number,
                    labels: [ticket.type, ticket.priority],
                });
            } catch (error) {
                this.logger.warn('Failed to add labels to PR', {
                    prNumber: pr.number,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                // Don't fail the operation
            }

            this.logger.info('Pull request created successfully', {
                ticketId: ticket.id,
                prUrl: pr.html_url,
                prNumber: pr.number,
            });

            return {
                success: true,
                prUrl: pr.html_url,
                prNumber: pr.number,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            this.logger.error('Failed to create pull request', {
                ticketId: ticket.id,
                error: errorMessage,
            });

            return {
                success: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Link commit to ticket (updates commit count)
     */
    static async linkCommitToTicket(
        options: LinkCommitToTicketOptions
    ): Promise<boolean> {
        const { commitSha, ticketId, project, githubToken } = options;

        try {
            if (!project.githubRepoName) {
                return false;
            }

            const [owner, repo] = project.githubRepoName.split('/');
            const octokit = new Octokit({ auth: githubToken });

            // Verify commit exists
            await octokit.rest.git.getCommit({
                owner,
                repo,
                commit_sha: commitSha,
            });

            this.logger.info('Commit linked to ticket', {
                ticketId,
                commitSha,
            });

            return true;
        } catch (error) {
            this.logger.error('Failed to link commit to ticket', {
                ticketId,
                commitSha,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            return false;
        }
    }

    /**
     * Setup webhooks for repository events
     */
    static async setupWebhooks(
        options: SetupWebhooksOptions
    ): Promise<SetupWebhooksResult> {
        const { repoUrl, githubToken, webhookUrl } = options;

        try {
            const repoInfo = this.extractRepoInfo(repoUrl);
            if (!repoInfo) {
                return {
                    success: false,
                    error: 'Invalid repository URL',
                };
            }

            const { owner, repo } = repoInfo;
            const octokit = new Octokit({ auth: githubToken });

            this.logger.info('Setting up webhooks', {
                repo: `${owner}/${repo}`,
                webhookUrl,
            });

            // Create webhook for PR events
            const { data: webhook } = await octokit.rest.repos.createWebhook({
                owner,
                repo,
                config: {
                    url: webhookUrl,
                    content_type: 'json',
                    insecure_ssl: '0',
                },
                events: ['pull_request', 'push', 'pull_request_review'],
                active: true,
            });

            this.logger.info('Webhooks configured successfully', {
                webhookId: webhook.id,
                repo: `${owner}/${repo}`,
            });

            return {
                success: true,
                webhookId: webhook.id,
            };
        } catch (error) {
            this.logger.error('Failed to setup webhooks', {
                repoUrl,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    /**
     * Sanitize repository name
     */
    private static sanitizeRepoName(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 100);
    }

    /**
     * Generate branch name from ticket
     */
    private static generateBranchName(ticket: Ticket): string {
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
     * Generate PR description from ticket
     */
    private static generatePRBody(ticket: Ticket): string {
        let body = `## ${ticket.title}\n\n`;
        body += `${ticket.description}\n\n`;
        
        if (ticket.acceptanceCriteria && ticket.acceptanceCriteria.length > 0) {
            body += `### Acceptance Criteria\n\n`;
            for (const criterion of ticket.acceptanceCriteria) {
                const checked = criterion.completed ? 'x' : ' ';
                body += `- [${checked}] ${criterion.criterion}\n`;
            }
            body += '\n';
        }

        body += `### Metadata\n\n`;
        body += `- **Type:** ${ticket.type}\n`;
        body += `- **Priority:** ${ticket.priority}\n`;
        if (ticket.estimatedHours) {
            body += `- **Estimated Hours:** ${ticket.estimatedHours}\n`;
        }
        if (ticket.actualHours) {
            body += `- **Actual Hours:** ${ticket.actualHours}\n`;
        }
        body += `- **Ticket ID:** ${ticket.id}\n`;

        return body;
    }

    /**
     * Extract repository info from URL
     */
    private static extractRepoInfo(url: string): { owner: string; repo: string } | null {
        try {
            let cleanUrl = url;
            
            if (url.startsWith('git@github.com:')) {
                cleanUrl = url.replace('git@github.com:', 'https://github.com/');
            }
            
            const urlObj = new URL(cleanUrl);
            const pathParts = urlObj.pathname.split('/').filter(part => part);
            
            if (pathParts.length >= 2) {
                const owner = pathParts[0];
                const repo = pathParts[1].replace('.git', '');
                return { owner, repo };
            }
            
            return null;
        } catch (error) {
            this.logger.error('Failed to parse repository URL', { url, error });
            return null;
        }
    }

    /**
     * Setup branch protection rules
     */
    private static async setupBranchProtection(
        token: string,
        repoFullName: string,
        branch: string
    ): Promise<void> {
        const [owner, repo] = repoFullName.split('/');
        const octokit = new Octokit({ auth: token });

        await octokit.rest.repos.updateBranchProtection({
            owner,
            repo,
            branch,
            required_status_checks: null,
            enforce_admins: false,
            required_pull_request_reviews: {
                required_approving_review_count: 1,
                dismiss_stale_reviews: false,
            },
            restrictions: null,
        });
    }
}