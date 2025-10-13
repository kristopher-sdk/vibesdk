// import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';

import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
// import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vite.dev/config/
export default defineConfig({
	optimizeDeps: {
		exclude: ['format', 'editor.all'],
		include: ['monaco-editor/esm/vs/editor/editor.api'],
		force: true, // Force re-optimization on every start
	},

	build: {
		sourcemap: true,
		rollupOptions: {
			output: {
				manualChunks(id) {
					// Monaco Editor and its workers (largest dependency)
					if (id.includes('monaco-editor')) {
						return 'monaco-editor';
					}
					
					// React core libraries
					if (id.includes('node_modules/react') ||
					    id.includes('node_modules/react-dom') ||
					    id.includes('node_modules/react-router')) {
						return 'react-vendor';
					}
					
					// Radix UI components (large collection)
					if (id.includes('@radix-ui')) {
						return 'radix-ui';
					}
					
					// Charts library (heavy visualization)
					if (id.includes('recharts')) {
						return 'recharts';
					}
					
					// Markdown rendering
					if (id.includes('react-markdown') ||
					    id.includes('remark-gfm') ||
					    id.includes('rehype-external-links')) {
						return 'markdown';
					}
					
					// Animation libraries
					if (id.includes('framer-motion')) {
						return 'animations';
					}
					
					// Form handling
					if (id.includes('react-hook-form') || id.includes('zod')) {
						return 'forms';
					}
					
					// Other heavy dependencies
					if (id.includes('date-fns') ||
					    id.includes('lucide-react') ||
					    id.includes('html2canvas-pro')) {
						return 'utilities';
					}
				},
			},
		},
	},
	plugins: [
		react(),
		svgr(),
		cloudflare({
			configPath: 'wrangler.jsonc',
			experimental: { remoteBindings: true },
		}), // Add the node polyfills plugin here
		// nodePolyfills({
		//     exclude: [
		//       'tty', // Exclude 'tty' module
		//     ],
		//     // We recommend leaving this as `true` to polyfill `global`.
		//     globals: {
		//         global: true,
		//     },
		// })
		tailwindcss(),
		// sentryVitePlugin({
		// 	org: 'cloudflare-0u',
		// 	project: 'javascript-react',
		// }),
	],

	resolve: {
		alias: {
			// 'path': 'path-browserify',
			// Add this line to fix the 'debug' package issue
			debug: 'debug/src/browser',
			// "@": path.resolve(__dirname, "./src"),
			'@': path.resolve(__dirname, './src'),
            'shared': path.resolve(__dirname, './shared'),
            'worker': path.resolve(__dirname, './worker'),
		},
	},

	// Configure for Prisma + Cloudflare Workers compatibility
	define: {
		// Ensure proper module definitions for Cloudflare Workers context
		'process.env.NODE_ENV': JSON.stringify(
			process.env.NODE_ENV || 'development',
		),
		global: 'globalThis',
		// '__filename': '""',
		// '__dirname': '""',
	},

	worker: {
		// Handle Prisma in worker context for development
		format: 'es',
	},

	server: {
		allowedHosts: true,
	},

	// Clear cache more aggressively
	cacheDir: 'node_modules/.vite',
});
