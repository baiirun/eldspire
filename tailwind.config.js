module.exports = {
	darkMode: "class",
	content: ["./app/**/*.{js,jsx,ts,tsx,md,mdx}"],
	theme: {
		fontFamily: {
			serif: ['"Iowan Old Style"', "Iowan", "Newsreader", "serif"],
			sans: [
				"'Byron', 'Inter', system, -apple-system, '.SFNSText-Regular', 'San Francisco', 'Roboto', 'Segoe UI', 'Helvetica Neue', sans-serif",
			],
		},
		extend: {
			colors: {
				text: "#222220",
				"text-1": "#B5B5B5",
				background: "#f2f2f0",
				"background-1": "#F7F7F6",
			},
		},
	},
	variants: {},
	plugins: [],
};

// breakpoints
// 2188
