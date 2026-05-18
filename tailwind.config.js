/** @type {import('tailwindcss').Config} */
export default {
	content: [
		'./index.html',
		'./src/**/*.{ts,tsx}'
	],
	theme: {
		extend: {
			fontFamily: {
				sans: [
					'"Plus Jakarta Sans"',
					'Inter',
					'ui-sans-serif',
					'system-ui',
					'-apple-system',
					'"Segoe UI"',
					'Roboto',
					'sans-serif'
				]
			},
			colors: {
				surface: {
					0: '#0B1B22',
					1: '#102A33',
					2: '#173742',
					3: '#1E4654'
				},
				text: {
					primary: '#F4F7F8',
					muted: '#A6B6BD',
					subtle: '#6F8089'
				},
				border: {
					subtle: '#1E3A45',
					strong: '#2A4F5C'
				},
				accent: {
					primary: '#2E7D32',
					hover: '#256628',
					soft: 'rgba(102, 187, 106, 0.18)'
				},
				danger: {
					base: '#E5484D',
					soft: 'rgba(229, 72, 77, 0.16)'
				},
				warning: {
					base: '#F5A524',
					soft: 'rgba(245, 165, 36, 0.18)'
				},
				success: {
					base: '#3DD68C',
					soft: 'rgba(61, 214, 140, 0.18)'
				},
				brand: {
					dark: '#102A33',
					blueDark: '#102A33',
					blue: '#102A33',
					blueLight: '#66BB6A',
					green: '#2E7D32',
					greenDark: '#256628',
					greenAccent: '#66BB6A',
					bg: '#0B1B22',
					white: '#F4F7F8'
				}
			}
		}
	},
	plugins: []
};
