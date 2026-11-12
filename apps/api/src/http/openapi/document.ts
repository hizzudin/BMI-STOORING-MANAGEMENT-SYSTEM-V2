import 'reflect-metadata';
import { HttpStatus, RequestMethod, type Type } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants.js';
import { z } from 'zod';
import { contractOf, type NamedSchema } from '../contract.js';

type Operation = Record<string, unknown> & { responses: Record<string, unknown> };

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: { title: string; version: string };
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, unknown> };
}

function controllersOf(root: object, seen = new Set<object>()): Type[] {
  if (seen.has(root)) return [];
  seen.add(root);
  const controllers = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, root) ?? []) as Type[];
  const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, root) ?? []) as (
    object | { module: object }
  )[];
  return [
    ...controllers,
    ...imports.flatMap((item) => controllersOf('module' in item ? item.module : item, seen)),
  ];
}

function joinPath(controllerPath: string, methodPath: string): string {
  const joined = `/${controllerPath}/${methodPath}`.replace(/\/+/g, '/');
  return (joined.length > 1 ? joined.replace(/\/$/, '') : joined).replace(/:(\w+)/g, '{$1}');
}

function ref({ name }: NamedSchema): { $ref: string } {
  return { $ref: `#/components/schemas/${name}` };
}

function componentSchemas(named: Map<string, z.ZodType>): Record<string, unknown> {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of named) registry.add(schema, { id });
  const { schemas } = z.toJSONSchema(registry, { uri: (id) => `#/components/schemas/${id}` });
  return Object.fromEntries(
    Object.entries(schemas).map(([id, schema]) => {
      const { $id, $schema, ...component } = schema;
      return [id, component];
    }),
  );
}

/** PRD §8.2: generated from the controllers of the module tree; a route without a contract stops it. */
export function buildOpenApiDocument(rootModule: object): OpenApiDocument {
  const paths: OpenApiDocument['paths'] = {};
  const named = new Map<string, z.ZodType>();
  const register = (item: NamedSchema): void => {
    if (named.has(item.name) && named.get(item.name) !== item.schema) {
      throw new Error(`Two schemas are named ${item.name}`);
    }
    named.set(item.name, item.schema);
  };

  for (const controller of controllersOf(rootModule)) {
    const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
    const prototype = controller.prototype as Record<string, object>;
    for (const key of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[key];
      if (key === 'constructor' || !handler) continue;
      const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      if (methodPath === undefined) continue;

      const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod;
      const method = RequestMethod[requestMethod].toLowerCase();
      const path = joinPath(base, methodPath);
      const contract = contractOf(handler);
      if (!contract) throw new Error(`${method.toUpperCase()} ${path} has no @ApiContract`);

      register(contract.response);
      if (contract.body) register(contract.body);
      const status =
        (Reflect.getMetadata(HTTP_CODE_METADATA, handler) as number | undefined) ??
        (requestMethod === RequestMethod.POST ? HttpStatus.CREATED : HttpStatus.OK);
      type ParameterObject = {
        name: string;
        in: 'path' | 'query' | 'header' | 'cookie';
        required?: boolean;
        schema?: { type: string } | { $ref: string };
      };

      const pathParamMatches = [...path.matchAll(/\{(\w+)\}/g)];
      const parameters: ParameterObject[] = pathParamMatches.map((match) => {
        const name = match[1];
        if (!name) throw new Error(`Invalid path parameter in ${path}`);
        return {
          name,
          in: 'path' as const,
          required: true,
          schema: { type: 'string' },
        };
      });

      if (contract.query) {
        register(contract.query);
        // Expand query object properties as individual query parameters
        // Zod v4: get shape from schema._def.shape (for object schemas)
        const querySchema = contract.query.schema;
        const shape = (querySchema as { _def?: { shape?: Record<string, z.ZodType> } })._def?.shape;
        if (shape) {
          for (const [key, valueSchema] of Object.entries(shape)) {
            register({ name: `${contract.query.name}_${key}`, schema: valueSchema });
            const refSchema: { $ref: string } = { $ref: `#/components/schemas/${contract.query.name}_${key}` };
            parameters.push({
              name: key,
              in: 'query',
              required: false,
              schema: refSchema,
            });
          }
        }
      }

      paths[path] = {
        ...paths[path],
        [method]: {
          operationId: contract.operationId,
          summary: contract.summary,
          ...(parameters.length ? { parameters } : {}),
          ...(contract.body
            ? {
                requestBody: {
                  required: true,
                  content: { 'application/json': { schema: ref(contract.body) } },
                },
              }
            : {}),
          responses: {
            [status]: {
              description: contract.summary,
              content: { 'application/json': { schema: ref(contract.response) } },
            },
          },
        },
      };
    }
  }

  return {
    openapi: '3.1.0',
    info: { title: 'BMI Stooring System API', version: '0.0.0' },
    paths,
    components: { schemas: componentSchemas(named) },
  };
}
