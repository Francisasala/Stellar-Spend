import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Canonical OpenAPI specification file.
 *
 * `openapi.yaml` at the project root is the single source of truth for the
 * API reference. Duplicate `openapi.json` copies must not be committed; the
 * JSON representation is generated on demand by this route handler.
 */
const OPENAPI_SPEC_PATH = path.resolve(process.cwd(), 'openapi.yaml');

/**
 * GET /openapi.json
 *
 * Serves the OpenAPI 3.0 JSON specification for external consumers,
 * Postman import, and tooling integrations. The document is derived from the
 * canonical `openapi.yaml` file so there is exactly one source of truth.
 */
export async function GET() {
  try {
    const content = fs.readFileSync(OPENAPI_SPEC_PATH, 'utf8');
    const doc = yaml.load(content);

    if (!doc || typeof doc !== 'object') {
      return NextResponse.json(
        { error: 'server_error', message: 'OpenAPI specification is empty or invalid' },
        { status: 500 },
      );
    }

    return NextResponse.json(doc, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: 'server_error', message: 'Failed to generate OpenAPI JSON specification' },
      { status: 500 },
    );
  }
}
