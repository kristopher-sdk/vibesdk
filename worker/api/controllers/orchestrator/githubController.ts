/**
 * GitHub Controller - Handles GitHub integration endpoints for orchestration
 */

import { Context } from 'hono';
import { OrchestrationService } from '../../../services/orchestrator/OrchestrationService';
import { createHmac } from 'crypto';

/**
 * Create GitHub repository for a project
 * POST /api/orchestrator/projects/:id/github/create-repo
 */
export async function createRepository(c: Context) {
    try {
        const projectId = c.req.param('id');
        const { githubToken } = await c.req.json();

        if (!githubToken) {
            return c.json({ error: 'GitHub token is required' }, 400);
        }

        // Get user from context
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        // Create service
        const service = new OrchestrationService(c.env as Env);

        // Create repository
        const result = await service.createGitHubRepository(projectId, githubToken);

        if (!result.success) {
            return c.json({ error: result.error }, 400);
        }

        return c.json({
            success: true,
            message: 'GitHub repository created successfully',
        });
    } catch (error) {
        console.error('Error creating GitHub repository:', error);
        return c.json(
            {
                error: 'Failed to create GitHub repository',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            500
        );
    }
}

/**
 * Create GitHub branch for a ticket
 * POST /api/orchestrator/tickets/:id/github/create-branch
 */
export async function createBranch(c: Context) {
    try {
        const ticketId = c.req.param('id');
        const { githubToken } = await c.req.json();

        if (!githubToken) {
            return c.json({ error: 'GitHub token is required' }, 400);
        }

        // Get user from context
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        // Create service
        const service = new OrchestrationService(c.env as Env);

        // Create branch
        const result = await service.createGitHubBranch(ticketId, githubToken);

        if (!result.success) {
            return c.json({ error: result.error }, 400);
        }

        return c.json({
            success: true,
            branchName: result.branchName,
            message: 'GitHub branch created successfully',
        });
    } catch (error) {
        console.error('Error creating GitHub branch:', error);
        return c.json(
            {
                error: 'Failed to create GitHub branch',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            500
        );
    }
}

/**
 * Create GitHub pull request for a ticket
 * POST /api/orchestrator/tickets/:id/github/create-pr
 */
export async function createPullRequest(c: Context) {
    try {
        const ticketId = c.req.param('id');
        const { githubToken } = await c.req.json();

        if (!githubToken) {
            return c.json({ error: 'GitHub token is required' }, 400);
        }

        // Get user from context
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        // Create service
        const service = new OrchestrationService(c.env as Env);

        // Create pull request
        const result = await service.createGitHubPullRequest(ticketId, githubToken);

        if (!result.success) {
            return c.json({ error: result.error }, 400);
        }

        return c.json({
            success: true,
            prUrl: result.prUrl,
            message: 'GitHub pull request created successfully',
        });
    } catch (error) {
        console.error('Error creating GitHub pull request:', error);
        return c.json(
            {
                error: 'Failed to create GitHub pull request',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            500
        );
    }
}

/**
 * Handle GitHub webhook events
 * POST /api/orchestrator/github/webhook
 */
export async function handleWebhook(c: Context) {
    try {
        // Verify webhook signature
        const signature = c.req.header('X-Hub-Signature-256');
        const event = c.req.header('X-GitHub-Event');
        
        if (!signature || !event) {
            return c.json({ error: 'Missing GitHub webhook headers' }, 400);
        }

        const body = await c.req.text();
        const webhookSecret = c.env.GITHUB_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('GITHUB_WEBHOOK_SECRET not configured');
            return c.json({ error: 'Webhook secret not configured' }, 500);
        }

        // Verify signature
        const isValid = verifyGitHubSignature(body, signature, webhookSecret);
        if (!isValid) {
            return c.json({ error: 'Invalid signature' }, 401);
        }

        // Parse webhook payload
        const payload = JSON.parse(body);

        // Handle different webhook events
        switch (event) {
            case 'pull_request':
                await handlePullRequestEvent(c, payload);
                break;
            case 'push':
                await handlePushEvent(c, payload);
                break;
            case 'pull_request_review':
                await handlePullRequestReviewEvent(c, payload);
                break;
            default:
                // Acknowledge but don't process
                console.log('Unhandled webhook event:', event);
        }

        return c.json({ success: true, message: 'Webhook processed' });
    } catch (error) {
        console.error('Error handling GitHub webhook:', error);
        return c.json(
            {
                error: 'Failed to process webhook',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            500
        );
    }
}

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    try {
        const hmac = createHmac('sha256', secret);
        hmac.update(payload);
        const digest = 'sha256=' + hmac.digest('hex');
        
        // Use timing-safe comparison
        return signature === digest;
    } catch (error) {
        console.error('Error verifying signature:', error);
        return false;
    }
}

/**
 * Handle pull request webhook event
 */
async function handlePullRequestEvent(c: Context, payload: any) {
    const action = payload.action;
    const prNumber = payload.number;
    const prUrl = payload.pull_request?.html_url;
    const branchName = payload.pull_request?.head?.ref;

    console.log('Pull request event:', { action, prNumber, branchName });

    // Handle PR merged
    if (action === 'closed' && payload.pull_request?.merged) {
        // TODO: Find ticket by branch name and update status to completed
        // const service = new OrchestrationService(c.env as Env, context);
        // await service.updateTicketStatusByBranch(branchName, 'completed');
        console.log('PR merged:', { prNumber, branchName });
    }

    // Handle PR opened
    if (action === 'opened') {
        // TODO: Update ticket with PR URL
        console.log('PR opened:', { prNumber, prUrl, branchName });
    }
}

/**
 * Handle push webhook event
 */
async function handlePushEvent(c: Context, payload: any) {
    const ref = payload.ref;
    const commits = payload.commits || [];
    
    console.log('Push event:', { ref, commitCount: commits.length });

    // TODO: Update ticket commit count
    // Extract branch name from ref (refs/heads/feat/xyz -> feat/xyz)
    const branchName = ref.replace('refs/heads/', '');
    
    for (const commit of commits) {
        // TODO: Link commits to tickets based on commit message
        // Look for ticket IDs in commit messages
        console.log('Commit:', { sha: commit.id, message: commit.message, branchName });
    }
}

/**
 * Handle pull request review webhook event
 */
async function handlePullRequestReviewEvent(c: Context, payload: any) {
    const action = payload.action;
    const reviewState = payload.review?.state;
    const prNumber = payload.pull_request?.number;
    
    console.log('PR review event:', { action, reviewState, prNumber });

    // TODO: Update ticket status based on review state
    if (reviewState === 'approved') {
        // Mark ticket as ready to merge
        console.log('PR approved:', prNumber);
    }
}