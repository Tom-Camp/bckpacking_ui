import { defineConfig } from '@playwright/test';

// Runs against the production build (the service worker only exists there) with the preview
// server proxying /api to a locally running API (see README).
export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		reuseExistingServer: false
	},
	use: { baseURL: 'http://localhost:4173' },
	testMatch: '**/*.e2e.{ts,js}'
});
