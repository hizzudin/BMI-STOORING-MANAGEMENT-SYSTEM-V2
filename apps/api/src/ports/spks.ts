import type { SpkCategory, SpkSource, SpkStatus } from '@bmi/shared';
import type { DocumentNumberGateway } from './numbering.js';

/** The fields a new SPK row is written with (§9.6); later tasks add the steps, parts and sources. */
export interface NewSpk {
  vehicleId: number;
  title: string;
  category: SpkCategory;
  requestSource: SpkSource;
  description: string;
  createdBy: number;
  requiresDowntime?: boolean;
  priority?: string;
  presetId?: number | null;
  breakdownReportId?: number | null;
  findingNote?: string | null;
}

/** §9.6 spks: the header of one SPK. */
export interface SpkRow {
  id: number;
  spkNumber: string;
  vehicleId: number;
  title: string;
  category: SpkCategory;
  requiresDowntime: boolean;
  requestSource: SpkSource;
  priority: string;
  description: string;
  status: SpkStatus;
  createdBy: number;
  version: number;
}

export interface SpkGateway {
  /** A Draft SPK with a number already taken from the sequence (TX-01 adds its steps). */
  insert(spk: NewSpk & { spkNumber: string }): Promise<number>;
  /** Not soft-deleted. */
  findById(id: number): Promise<SpkRow | null>;
  /** REQ-SCH-001: the numbers of the open SPKs of each vehicle, oldest first; no entry when none. */
  openNumbersByVehicle(vehicleIds: readonly number[]): Promise<Map<number, string[]>>;
}

export interface SpkGateways {
  spks: SpkGateway;
  numbers: DocumentNumberGateway;
}
