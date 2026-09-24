import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

const API_TARGET = process.env.API_TARGET ?? 'http://localhost:8000';

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
			}
		]
	}
});
