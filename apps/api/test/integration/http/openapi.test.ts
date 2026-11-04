import { Body, Controller, Post, type INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { HealthResponseSchema } from '@bmi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppModule } from '../../../src/app.module.js';
import { buildOpenApiDocument } from '../../../src/http/openapi/document.js';
import { ZodValidationPipe } from '../../../src/http/zod-validation.pipe.js';

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'all'];

function normalizePath(...parts: string[]): string {
  const joined = parts.join('/').replace(/\/+/g, '/').replace(/\/$/, '');
  const withSlash = joined.startsWith('/') ? joined : `/${joined}`;
  return withSlash.replace(/:(\w+)/g, '{$1}');
}

/** Every route the running application really serves, as `get /health`. */
function servedRoutes(app: INestApplication): string[] {
  const routes: string[] = [];
  for (const module of app.get(ModulesContainer).values()) {
    for (const { metatype } of module.controllers.values()) {
      const controllerPath = Reflect.getMetadata(PATH_METADATA, metatype as object) as string;
      const prototype = (metatype as { prototype: Record<string, unknown> }).prototype;
      for (const key of Object.getOwnPropertyNames(prototype)) {
        const handler = prototype[key] as object;
        const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        if (key === 'constructor' || methodPath === undefined) continue;
        const method = HTTP_METHODS[Reflect.getMetadata(METHOD_METADATA, handler) as number];
        routes.push(`${method ?? ''} ${normalizePath(controllerPath, methodPath)}`);
      }
    }
  }
  return routes;
}

function documentedRoutes(): string[] {
  const paths = buildOpenApiDocument().paths ?? {};
  return Object.entries(paths).flatMap(([path, item]) =>
    Object.keys(item).map((method) => `${method} ${path}`),
  );
}

describe('DEC-66 API contract', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('DEC-66 every route the API serves is in the OpenAPI document, and nothing else is', () => {
    expect(documentedRoutes().sort()).toEqual(servedRoutes(app).sort());
  });

  it('DEC-66 the document takes its response schema from the shared Zod schema', () => {
    const document = buildOpenApiDocument();
    expect(document.components?.schemas?.HealthResponse).toMatchObject({
      type: 'object',
      properties: { status: { const: 'ok' } },
    });
  });

  it('DEC-66 the real /health response satisfies the contract', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(HealthResponseSchema.safeParse(await response.json()).success).toBe(true);
  });
});

const ProbeBodySchema = z.object({ quantity: z.number().int().positive() });

@Controller('probe')
class ValidationProbeController {
  @Post()
  echo(@Body(new ZodValidationPipe(ProbeBodySchema)) body: z.infer<typeof ProbeBodySchema>) {
    return body;
  }
}

describe('NFR-04 request validation from Zod', () => {
  let app: INestApplication;
  let baseUrl: string;

  const post = (body: unknown): Promise<Response> =>
    fetch(`${baseUrl}/probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ValidationProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('NFR-04 a valid body reaches the handler as the parsed value', async () => {
    const response = await post({ quantity: 3, ignored: 'field' });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ quantity: 3 });
  });

  it('NFR-04 an invalid body answers 400 and names the field', async () => {
    const response = await post({ quantity: -1 });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      statusCode: 400,
      message: 'Validation failed',
      issues: [{ path: 'quantity' }],
    });
  });
});
