import { HealthResponseSchema } from '@bmi/shared';
import { z } from 'zod';

interface OpenApiDocument {
  openapi: '3.1.0';
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
}

const schemas = z.registry<{ id: string }>();
schemas.add(HealthResponseSchema, { id: 'HealthResponse' });

function jsonResponse(description: string, schemaId: string): unknown {
  return {
    description,
    content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaId}` } } },
  };
}

// One entry per route, from the Zod schemas of @bmi/shared. openapi.test.ts fails on a missing one.
const paths: OpenApiDocument['paths'] = {
  '/health': {
    get: {
      operationId: 'getHealth',
      summary: 'Tells whether the API is running',
      responses: { 200: jsonResponse('The API is running', 'HealthResponse') },
    },
  },
};

function componentSchemas(): Record<string, unknown> {
  const { schemas: generated } = z.toJSONSchema(schemas, {
    uri: (id) => `#/components/schemas/${id}`,
  });
  return Object.fromEntries(
    Object.entries(generated).map(([id, schema]) => {
      const { $id, $schema, ...component } = schema;
      return [id, component];
    }),
  );
}

export function buildOpenApiDocument(): OpenApiDocument {
  return {
    openapi: '3.1.0',
    info: { title: 'BMI Stooring System API', version: '0.0.0' },
    paths,
    components: { schemas: componentSchemas() },
  };
}
