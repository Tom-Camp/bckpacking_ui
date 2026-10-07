import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { playwright } from '@vitest/browser-playwright';
import { readFileSync } from 'node:fs';

const API_TARGET = process.env.API_TARGET ?? 'http://localhost:8000';

/**
 * Globs (relative to .svelte-kit/output) for the zxcvbn chunk, so the service worker doesn't
 * precache its ~800 KB: only the register page lazy-loads it, and that page falls back to the
 * API's check without it. SvelteKit names chunks by content hash only, so the file is looked up
 * in the client build's Vite manifest once that build has finished.
 */
function zxcvbnChunks(): string[] {
	const manifestPath = new URL('.svelte-kit/output/client/.vite/manifest.json', import.meta.url);
	const manifest: Record<string, { file: string; src?: string }> = JSON.parse(
		readFileSync(manifestPath, 'utf-8')
	);
	const files = Object.values(manifest)
		.filter((chunk) => chunk.src?.startsWith('node_modules/zxcvbn/'))
		.map((chunk) => `client/${chunk.file}`);
	if (files.length === 0) throw new Error('zxcvbn chunk not found in the client build manifest');
	return files;
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// SPA mode: every route falls back to index.html so the service worker can serve the
			// whole app from cache when offline.
			adapter: adapter({ fallback: 'index.html' })
		}),
		SvelteKitPWA({
			registerType: 'prompt',
			kit: { adapterFallback: 'index.html', spa: true },
			manifest: {
				name: 'bckpack.ing',
				short_name: 'bckpack.ing',
				description: 'Backpacking trip logistics: checklists, gear, food. Works offline.',
				theme_color: '#1c1917',
				background_color: '#fafaf9',
				display: 'standalone',
				start_url: '/',
				scope: '/',
				icons: [
					{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{
						src: '/maskable-icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2,webmanifest}'],
				// API data lives in IndexedDB (Dexie), never in the service worker cache.
				navigateFallbackDenylist: [/^\/api\//]
			},
			integration: {
				// SvelteKit's client build runs as a nested build, so its output is only on disk here.
				beforeBuildServiceWorker(options) {
					options.workbox.globIgnores = [...(options.workbox.globIgnores ?? []), ...zxcvbnChunks()];
				}
			},
			devOptions: { enabled: false }
		})
	],
	server: {
		proxy: { '/api': { target: API_TARGET, changeOrigin: true } }
	},
	preview: {
		proxy: { '/api': { target: API_TARGET, changeOrigin: true } }
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			},
			{
				// Components and pages, rendered in real Chromium (IndexedDB, focus, dialogs).
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						headless: true,
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					setupFiles: ['./src/lib/test/setup-client.ts']
				}
			}
		]
	}
});
