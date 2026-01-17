/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './rss/templates/**/*.html',
    './static/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        'juno-green': '#00AA48',
        'juno-navy': '#213d6b',
        'juno-amber': '#fbbf24',
        'juno-slate': '#64748b',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 4px rgba(0,0,0,0.05)',
        'card-hover': '0 4px 8px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
