// Prepared for isolated preview. Not deployed.
// Deno runtime declarations limited to the two APIs this Edge entry uses;
// no external Deno typings needed in the Node/TypeScript build.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

import { createDirectorWakeHandler } from '../../../src/autopilot/directorWake.ts';

const handler = createDirectorWakeHandler({
  token: Deno.env.get('AUTOPILOT_DIRECTOR_WAKE_TOKEN'),
});

Deno.serve(handler);
