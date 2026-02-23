/** @type {import('tailwindcss').Config} */
export default {
	content: [
		'./index.html',
		'./src/**/*.{ts,tsx}'
	],
	theme: {
		extend: {
			colors: {
				brand: {
					dark: '#0F2A33',
					green: '#2E7D32',
					greenAccent: '#66BB6A',
					bg: '#F5F7F9',
					white: '#FFFFFF',
					blueDark: '#0F2A33',
					blue: '#0F2A33',
					blueLight: '#66BB6A',
					greenDark: '#256628'
				}
			}
		}
	},
	plugins: []
}; 