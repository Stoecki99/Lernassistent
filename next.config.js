const fs = require("fs")
const path = require("path")

// Kurzlinks fuer Lernseiten: /mstw -> /lernseiten/mstw (ein Eintrag pro Fachordner).
// Next vergleicht Redirects ohne Gross-/Kleinschreibung, /MSTW funktioniert also auch.
function lernseitenKurzlinks() {
  const basis = path.join(__dirname, "content", "lernseiten")
  if (!fs.existsSync(basis)) return []
  return fs
    .readdirSync(basis, { withFileTypes: true })
    .filter((eintrag) => eintrag.isDirectory() && /^[a-z0-9]+$/.test(eintrag.name))
    .flatMap(({ name }) => [
      { source: `/${name}`, destination: `/lernseiten/${name}`, permanent: true },
      { source: `/${name}/:pfad*`, destination: `/lernseiten/${name}/:pfad*`, permanent: true },
    ])
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async redirects() {
    return lernseitenKurzlinks()
  },
}

module.exports = nextConfig
