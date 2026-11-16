import {
  OkResponseSchema,
  VendorListResponseSchema,
  VendorOptionsQuerySchema,
  VendorOptionsResponseSchema,
  VendorRequestSchema,
  VendorResponseSchema,
  VendorUpdateRequestSchema,
  type VendorListResponse,
  type VendorOptionsQuery,
  type VendorOptionsResponse,
  type VendorRequest,
  type VendorResponse,
  type VendorUpdateRequest,
} from '@bmi/shared';
import {
  Catch,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';
import {
  VendorConflictError,
  VendorNotFoundError,
  VendorService,
} from '../../core/inventory/vendor-service.js';
import {
  actorOf,
  CurrentSession,
  RequireCapability,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ValidBody, ValidQuery } from '../contract.js';

const One = { name: 'VendorResponse', schema: VendorResponseSchema };
const Ok = { name: 'OkResponse', schema: OkResponseSchema };

/** REQ-INV-014, DEC-134: Settings › Vendors (masterdata.manage) and the pick list of later screens. */
@Controller('vendors')
@UseGuards(SessionGuard)
export class VendorsController {
  constructor(@Inject(VendorService) private readonly vendors: VendorService) {}

  @Get()
  @RequireCapability('masterdata.manage')
  @ApiContract({
    operationId: 'listVendors',
    summary: 'Every vendor, the inactive marked (DEC-134)',
    response: { name: 'VendorListResponse', schema: VendorListResponseSchema },
  })
  list(@CurrentSession() session: SignedIn): Promise<VendorListResponse> {
    return this.vendors.list(actorOf(session));
  }

  // Declared before the :id routes. The screens that will pick a vendor (Goods Receipt, Part
  // Purchase, External workshop service, retread dispatch) hold one of these codes.
  @Get('options')
  @RequireCapability(
    'masterdata.manage',
    'inventory.manage',
    'tyre.manage',
    'purchase.line',
    'mechanic.execute',
  )
  @ApiContract({
    operationId: 'vendorOptions',
    summary: 'The active vendors to pick from, of one kind when asked',
    query: { name: 'VendorOptionsQuery', schema: VendorOptionsQuerySchema },
    response: { name: 'VendorOptionsResponse', schema: VendorOptionsResponseSchema },
  })
  options(@ValidQuery() query: VendorOptionsQuery): Promise<VendorOptionsResponse> {
    return this.vendors.options(query);
  }

  @Post()
  @RequireCapability('masterdata.manage')
  @ApiContract({
    operationId: 'createVendor',
    summary: 'New vendor with a typed code (C-31)',
    body: { name: 'VendorRequest', schema: VendorRequestSchema },
    response: One,
  })
  async create(
    @CurrentSession() session: SignedIn,
    @ValidBody() body: VendorRequest,
  ): Promise<VendorResponse> {
    return { vendor: await this.vendors.create(actorOf(session), body) };
  }

  @Patch(':id')
  @RequireCapability('masterdata.manage')
  @ApiContract({
    operationId: 'updateVendor',
    summary: 'Save a vendor; the code is fixed once saved (C-17)',
    body: { name: 'VendorUpdateRequest', schema: VendorUpdateRequestSchema },
    response: One,
  })
  async update(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
    @ValidBody() body: VendorUpdateRequest,
  ): Promise<VendorResponse> {
    return { vendor: await this.vendors.update(actorOf(session), id, body) };
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequireCapability('masterdata.manage')
  @ApiContract({
    operationId: 'deactivateVendor',
    summary: 'Deactivate a vendor (C-32)',
    response: Ok,
  })
  async deactivate(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<z.infer<typeof OkResponseSchema>> {
    await this.vendors.deactivate(actorOf(session), id);
    return { ok: true };
  }

  @Post(':id/activate')
  @HttpCode(200)
  @RequireCapability('masterdata.manage')
  @ApiContract({
    operationId: 'activateVendor',
    summary: 'Activate a vendor again (DEC-134)',
    response: Ok,
  })
  async activate(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<z.infer<typeof OkResponseSchema>> {
    await this.vendors.activate(actorOf(session), id);
    return { ok: true };
  }
}

/** 404 and 409 of the vendor routes, each with one sentence. */
@Catch(VendorNotFoundError, VendorConflictError)
export class VendorErrorFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    const status =
      error instanceof VendorNotFoundError ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
