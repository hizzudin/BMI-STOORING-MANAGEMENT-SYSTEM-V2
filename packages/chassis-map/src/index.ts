// @bmi/chassis-map (REQ-PLC-008, REQ-PLC-010, DEC-73, DEC-119): layout → positions → drawing.
// The geometry is pure, so a native renderer for the phone can reuse it; ChassisMap draws it on the web.
export { ChassisMap, type ChassisMapProps } from './ChassisMap.js';
export { LAUNCH_LAYOUTS, generatedLayouts } from './fixtures.js';
export {
  AXLE_GAP,
  MAP_WIDTH,
  chassisGeometry,
  type AxleShape,
  type ChassisGeometry,
  type SpareShape,
  type TyreShape,
  type WheelShape,
} from './geometry.js';
export {
  POSITION_STATUSES,
  STATUS_CLASSES,
  STATUS_LABELS,
  STATUS_MEANINGS,
  type PositionStatus,
} from './statuses.js';
