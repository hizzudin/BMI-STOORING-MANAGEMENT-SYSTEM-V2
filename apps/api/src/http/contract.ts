import 'reflect-metadata';
import { BadRequestException, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';
import type { ZodIssue } from 'zod';

type IssuePath = (string | number)[];

const CONTRACT = Symbol('api-contract');

export interface NamedSchema<Schema extends z.ZodType = z.ZodType> {
  /** The name in the OpenAPI document and in the generated client. */
  name: string;
  schema: Schema;
}

export interface RouteContract<Response extends z.ZodType = z.ZodType> {
  operationId: string;
  summary: string;
  response: NamedSchema<Response>;
  body?: NamedSchema;
  query?: NamedSchema;
}

type Handler<Response extends z.ZodType> = (
  ...args: never[]
) => z.infer<Response> | Promise<z.infer<Response>>;

/**
 * PRD §8.2: the API contract sits on the route. The OpenAPI document is generated from it, the
 * compiler checks the handler's return type against it and the interceptor checks the real response.
 */
export function ApiContract<Response extends z.ZodType>(contract: RouteContract<Response>) {
  return <Method extends Handler<Response>>(
    _target: object,
    _key: string | symbol,
    descriptor: TypedPropertyDescriptor<Method>,
  ): void => {
    Reflect.defineMetadata(CONTRACT, contract, descriptor.value as object);
  };
}

export function contractOf(handler: object): RouteContract | undefined {
  return Reflect.getMetadata(CONTRACT, handler) as RouteContract | undefined;
}

/** NFR-04: the request body of the route, parsed with the schema of its contract. */
export const ValidBody = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const contract = contractOf(context.getHandler());
  if (!contract?.body) throw new Error(`${context.getHandler().name} has no body in its contract`);
  const result = contract.body.schema.safeParse(context.switchToHttp().getRequest<Request>().body);
  if (result.success) return result.data;
  throw new BadRequestException({
    statusCode: 400,
    message: 'Validation failed',
    issues: result.error.issues.map((issue: ZodIssue) => ({
      path: (issue.path as IssuePath).join('.'),
      message: issue.message,
    })),
  });
});

/** NFR-04: the request query of the route, parsed with the schema of its contract. */
export const ValidQuery = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const contract = contractOf(context.getHandler());
  if (!contract?.query)
    throw new Error(`${context.getHandler().name} has no query in its contract`);
  const result = contract.query.schema.safeParse(
    context.switchToHttp().getRequest<Request>().query,
  );
  if (result.success) return result.data;
  throw new BadRequestException({
    statusCode: 400,
    message: 'Validation failed',
    issues: result.error.issues.map((issue: ZodIssue) => ({
      path: (issue.path as IssuePath).join('.'),
      message: issue.message,
    })),
  });
});
