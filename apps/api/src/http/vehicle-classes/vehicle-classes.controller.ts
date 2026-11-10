import {
  LayoutVersionRequestSchema,
  VehicleClassListResponseSchema,
  VehicleClassRequestSchema,
  VehicleClassResponseSchema,
  type LayoutVersionRequest,
  type VehicleClassListResponse,
  type VehicleClassRequest,
  type VehicleClassResponse,
} from '@bmi/shared';
import {
  Catch,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  VehicleClassConflictError,
  VehicleClassNotFoundError,
  VehicleClassService,
} from '../../core/fleet/vehicle-class-service.js';
import {
  actorOf,
  CurrentSession,
  RequireCapability,
  SessionGuard,
  type SignedIn,
} from '../auth/auth-http.js';
import { ApiContract, ValidBody } from '../contract.js';

const One = { name: 'VehicleClassResponse', schema: VehicleClassResponseSchema };

/** REQ-PLC-013, REQ-PLC-017, DEC-120: Settings › Vehicle classes and chassis layouts (masterdata.manage). */
@Controller('vehicle-classes')
@UseGuards(SessionGuard)
@RequireCapability('masterdata.manage')
export class VehicleClassesController {
  constructor(@Inject(VehicleClassService) private readonly classes: VehicleClassService) {}

  @Get()
  @ApiContract({
    operationId: 'listVehicleClasses',
    summary: 'Vehicle classes, each with its current layout version',
    response: { name: 'VehicleClassListResponse', schema: VehicleClassListResponseSchema },
  })
  list(@CurrentSession() session: SignedIn): Promise<VehicleClassListResponse> {
    return this.classes.list(actorOf(session));
  }

  @Post()
  @ApiContract({
    operationId: 'createVehicleClass',
    summary: 'New class with its first layout; saving generates the positions',
    body: { name: 'VehicleClassRequest', schema: VehicleClassRequestSchema },
    response: One,
  })
  async create(
    @CurrentSession() session: SignedIn,
    @ValidBody() body: VehicleClassRequest,
  ): Promise<VehicleClassResponse> {
    return { vehicleClass: await this.classes.create(actorOf(session), body) };
  }

  @Post(':id/layouts')
  @ApiContract({
    operationId: 'saveLayoutVersion',
    summary: 'Save as new layout version; existing vehicles keep theirs (DEC-120)',
    body: { name: 'LayoutVersionRequest', schema: LayoutVersionRequestSchema },
    response: One,
  })
  async newLayoutVersion(
    @CurrentSession() session: SignedIn,
    @Param('id', ParseIntPipe) id: number,
    @ValidBody() body: LayoutVersionRequest,
  ): Promise<VehicleClassResponse> {
    return { vehicleClass: await this.classes.newLayoutVersion(actorOf(session), id, body) };
  }
}

/** 404 and 409 of the class routes, each with one sentence. */
@Catch(VehicleClassNotFoundError, VehicleClassConflictError)
export class VehicleClassErrorFilter implements ExceptionFilter<Error> {
  catch(error: Error, host: ArgumentsHost): void {
    const status =
      error instanceof VehicleClassNotFoundError ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
