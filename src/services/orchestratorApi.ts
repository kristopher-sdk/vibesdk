/**
 * Orchestrator API Client
 * Handles all API calls to the orchestration system
 */

import type {
  Project,
  Ticket,
  CreateProjectRequest,
  UpdateProjectRequest,
  UpdateTicketRequest,
  ProjectWithRelations,
  TicketWithRelations,
} from '../../shared/types/orchestrator';

const API_BASE = '/api/orchestrator';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * Get authorization header with JWT token
 */
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  const data = await response.json() as { data: T };
  return data.data;
}

/**
 * Create a new project from an existing app/prototype
 */
export async function createProject(
  appId: string,
  title?: string
): Promise<{ project: Project; message: string }> {
  const response = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ appId, title } as CreateProjectRequest),
  });
  return handleResponse(response);
}

/**
 * Get all projects for the current user
 */
export async function getProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/projects`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{ projects: Project[] }>(response);
  return data.projects;
}

/**
 * Get a single project with tickets and dependencies
 */
export async function getProject(projectId: string): Promise<ProjectWithRelations> {
  const response = await fetch(`${API_BASE}/projects/${projectId}`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse<{ project: ProjectWithRelations }>(response);
  return data.project;
}

/**
 * Generate tickets for a project
 */
export async function generateTickets(
  projectId: string,
  guidance?: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/generate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ guidance }),
  });
  return handleResponse(response);
}

/**
 * Update project (approve, regenerate, archive)
 */
export async function updateProject(
  projectId: string,
  data: UpdateProjectRequest
): Promise<{ success: boolean; project: Project }> {
  const response = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Get tickets for a project
 */
export async function getProjectTickets(
  projectId: string
): Promise<{ tickets: TicketWithRelations[]; dependencies: any[] }> {
  const response = await fetch(`${API_BASE}/tickets?projectId=${projectId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

/**
 * Get all tickets (with optional filters)
 */
export async function getTickets(params?: {
  projectId?: string;
  status?: string[];
  assignedToMe?: boolean;
  ready?: boolean;
}): Promise<{ tickets: TicketWithRelations[]; pagination: any }> {
  const searchParams = new URLSearchParams();
  if (params?.projectId) searchParams.append('projectId', params.projectId);
  if (params?.status) params.status.forEach(s => searchParams.append('status', s));
  if (params?.assignedToMe) searchParams.append('assignedToMe', 'true');
  if (params?.ready) searchParams.append('ready', 'true');

  const response = await fetch(`${API_BASE}/tickets?${searchParams}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
}

/**
 * Assign a ticket to a developer
 */
export async function assignTicket(
  ticketId: string,
  developerId?: string
): Promise<{ success: boolean; ticket: Ticket; branchName: string }> {
  const response = await fetch(`${API_BASE}/tickets/${ticketId}/assign`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ developerId }),
  });
  return handleResponse(response);
}

/**
 * Update ticket status or other fields
 */
export async function updateTicket(
  ticketId: string,
  data: UpdateTicketRequest
): Promise<{ success: boolean; ticket: Ticket }> {
  const response = await fetch(`${API_BASE}/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Create GitHub repository for a project
 */
export async function createGitHubRepo(
  projectId: string
): Promise<{ repositoryUrl: string; cloneUrl: string; defaultBranch: string }> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/github/create-repo`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({}),
  });
  return handleResponse(response);
}

/**
 * Create GitHub branch for a ticket
 */
export async function createGitHubBranch(
  ticketId: string
): Promise<{ branchName: string; branchUrl: string }> {
  const response = await fetch(`${API_BASE}/tickets/${ticketId}/github/create-branch`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({}),
  });
  return handleResponse(response);
}

/**
 * Create GitHub pull request for a ticket
 */
export async function createGitHubPR(
  ticketId: string
): Promise<{ prUrl: string; prNumber: number }> {
  const response = await fetch(`${API_BASE}/tickets/${ticketId}/github/create-pr`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({}),
  });
  return handleResponse(response);
}