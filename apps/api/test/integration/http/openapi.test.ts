import {
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HealthResponseSchema } from '@bmi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppModule } from '../../../src/app.module.js';
import { ApiContract, ValidBody } from '../../../src/http/contract.js';
import { buildOpenApiDocument } from '../../../src/http/openapi/document.js';

const ItemSchema = z.object({ id: z.string(), quantity: z.number().int() });
const NewItemSchema = z.object({ quantity: z.number().int().positive() });

@Controller('items')
class ItemsController {
  @Get(':id')
  @ApiContract({
    operationId: 'getItem',
    summary: 'Reads one item',
    response: { name: 'Item', schema: ItemSchema },
  })
  read(@Param('id') id: string) {
    return { id, quantity: 1, secret: 'never leaves the server' };
  }

  @Post()
  @ApiContract({
    operationId: 'createItem',
    summary: 'Creates an item',
    body: { name: 'NewItem', schema: NewItemSchema },
    response: { name: 'Item', schema: ItemSchema },
  })
  create(@ValidBody() body: z.infer<typeof NewItemSchema>) {
    return { id: 'new', quantity: body.quantity };
  }

  @Post('count')
  @HttpCode(200)
  @ApiContract({
    operationId: 'countItems',
    summary: 'Counts items',
    response: { name: 'Item', schema: ItemSchema },
  })
  count() {
    // A wrong shape on purpose: only the runtime check can catch a cast.
    return { id: 'count', quantity: 'many' } as unknown as z.infer<typeof ItemSchema>;
  }
}

@Module({ controllers: [ItemsController] })
class ItemsModule {}

@Module({ imports: [ItemsModule] })
class RootProbeModule {}

@Controller('undocumented')
class UndocumentedController {
  @Get()
  read() {
    return {};
  }
}

@Module({ controllers: [UndocumentedController] })
class UndocumentedModule {}

const Other = z.object({ other: z.string() });

@Controller('clash')
class ClashController {
  @Get('a')
  @ApiContract({ operationId: 'a', summary: 'a', response: { name: 'Same', schema: ItemSchema } })
  a() {
    return { id: 'a', quantity: 1 };
  }

  @Get('b')
  @ApiContract({ operationId: 'b', summary: 'b', response: { name: 'Same', schema: Other } })
  b() {
    return { other: 'b' };
  }
}

@Module({ controllers: [ClashController] })
class ClashModule {}

describe('DEC-66 the OpenAPI document is generated from the controllers', () => {
  const document = buildOpenApiDocument(RootProbeModule);

  it('DEC-66 a route of an imported module appears with its method and path parameter', () => {
    expect(document.paths['/items/{id}']?.get).toMatchObject({
      operationId: 'getItem',
      summary: 'Reads one item',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
    });
  });

  it('DEC-66 the request body comes from the contract', () => {
    expect(document.paths['/items']?.post).toMatchObject({
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/NewItem' } } },
      },
    });
    expect(document.components.schemas.NewItem).toMatchObject({ type: 'object' });
  });

  it('DEC-66 the status follows the framework: 201 for a POST, or the @HttpCode of the route', () => {
    expect(Object.keys(document.paths['/items']?.post?.responses ?? {})).toEqual(['201']);
    expect(Object.keys(document.paths['/items/count']?.post?.responses ?? {})).toEqual(['200']);
  });

  it('DEC-66 a route without a contract stops the build of the document', () => {
    expect(() => buildOpenApiDocument(UndocumentedModule)).toThrow(
      'GET /undocumented has no @ApiContract',
    );
  });

  it('DEC-66 two schemas under one name stop the build of the document', () => {
    expect(() => buildOpenApiDocument(ClashModule)).toThrow('Two schemas are named Same');
  });

  it('DEC-66 the API document holds /health with the shared Zod schema', () => {
    const api = buildOpenApiDocument(AppModule);
    expect(api.paths['/health']?.get).toMatchObject({ operationId: 'getHealth' });
    expect(api.components.schemas.HealthResponse).toMatchObject({
      type: 'object',
      properties: { status: { const: 'ok' } },
    });
  });
});

describe('DEC-66 NFR-04 the contract holds at run time', () => {
  let app: INestApplication;
  let baseUrl: string;

  const post = (path: string, body?: unknown): Promise<Response> =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ItemsModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('DEC-66 the real /health response satisfies the contract', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(HealthResponseSchema.safeParse(await response.json()).success).toBe(true);
  });

  it('NFR-04 a field outside the contract never leaves the server', async () => {
    const response = await fetch(`${baseUrl}/items/7`);
    expect(await response.json()).toEqual({ id: '7', quantity: 1 });
  });

  it('DEC-66 a response that breaks its contract answers 500, not the wrong shape', async () => {
    const response = await post('/items/count');
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('many');
  });

  it('NFR-04 a valid body reaches the handler as the parsed value', async () => {
    const response = await post('/items', { quantity: 3, ignored: 'field' });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'new', quantity: 3 });
  });

  it('NFR-04 an invalid body answers 400 and names the field', async () => {
    const response = await post('/items', { quantity: -1 });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      statusCode: 400,
      message: 'Validation failed',
      issues: [{ path: 'quantity' }],
    });
  });
});
