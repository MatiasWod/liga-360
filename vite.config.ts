import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
	server: {
		proxy: {
			'/api/graphql': {
				target: 'http://localhost:4000',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api\/graphql/, '/graphql'),
			},
			'/api/teams/profiles': {
				target: 'http://localhost:4002',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api\/teams/, ''),
			},
			'/api/teams/participants': {
				target: 'http://localhost:4002',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api\/teams/, ''),
			},
			'/api/teams': {
				target: 'http://localhost:4002',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api\/teams/, '/teams'),
			},
			'/api/auth': {
				target: 'http://localhost:4003',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api\/auth/, ''),
			},
			'/api/inscriptions': {
				target: 'http://localhost:4004',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api\/inscriptions/, ''),
			},
		},
	},
});
