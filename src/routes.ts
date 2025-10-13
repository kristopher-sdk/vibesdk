import type { RouteObject } from 'react-router';
import React, { lazy } from 'react';

import App from './App';
import { ProtectedRoute } from './routes/protected-route';

// Lazy load route components for better code splitting
const Home = lazy(() => import('./routes/home'));
const Chat = lazy(() => import('./routes/chat/chat'));
const Profile = lazy(() => import('./routes/profile'));
const Settings = lazy(() => import('./routes/settings/index'));
const AppsPage = lazy(() => import('./routes/apps'));
const AppView = lazy(() => import('./routes/app'));
const DiscoverPage = lazy(() => import('./routes/discover'));
const OrchestratorPage = lazy(() => import('./pages/Orchestrator/OrchestratorPage'));
const ProjectDetail = lazy(() => import('./pages/Orchestrator/ProjectDetail'));

const routes = [
	{
		path: '/',
		Component: App,
		children: [
			{
				index: true,
				Component: Home,
			},
			{
				path: 'chat/:chatId',
				Component: Chat,
			},
			{
				path: 'profile',
				element: React.createElement(ProtectedRoute, { children: React.createElement(Profile) }),
			},
			{
				path: 'settings',
				element: React.createElement(ProtectedRoute, { children: React.createElement(Settings) }),
			},
			{
				path: 'apps',
				element: React.createElement(ProtectedRoute, { children: React.createElement(AppsPage) }),
			},
			{
				path: 'app/:id',
				Component: AppView,
			},
			{
				path: 'discover',
				Component: DiscoverPage,
			},
			{
				path: 'orchestrator',
				element: React.createElement(ProtectedRoute, { children: React.createElement(OrchestratorPage) }),
			},
			{
				path: 'orchestrator/projects/:id',
				element: React.createElement(ProtectedRoute, { children: React.createElement(ProjectDetail) }),
			},
		],
	},
] satisfies RouteObject[];

export { routes };
