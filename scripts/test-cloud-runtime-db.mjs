// Reuse the reviewed disposable SCRAM/TLS harness; no hosted URL is accepted.
process.env.DIRECTOR_LAB_SUITE='cloud-runtime-v3';
await import('./test-director-supervision-db.mjs');
