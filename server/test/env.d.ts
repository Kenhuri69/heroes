// Import Vite `?raw` du schéma D1 dans les tests du Worker (revue 2026-09, R8).
declare module '*.sql?raw' {
  const content: string;
  export default content;
}
