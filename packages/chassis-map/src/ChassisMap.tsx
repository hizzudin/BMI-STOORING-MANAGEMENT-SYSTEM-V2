import type { ChassisDefinition } from '@bmi/shared';
import type { KeyboardEvent } from 'react';
import { chassisGeometry, RAIL, type TyreShape } from './geometry.js';
import {
  POSITION_STATUSES,
  STATUS_CLASSES,
  STATUS_LABELS,
  STATUS_MEANINGS,
  type PositionStatus,
} from './statuses.js';

export interface ChassisMapProps {
  definition: ChassisDefinition;
  /** Status per position code; a position without one is Empty. */
  statuses?: Readonly<Record<string, PositionStatus>>;
  selected?: string | null;
  /** Given in the Part Replacement step: each position becomes a button (REQ-PLC-010). */
  onSelect?: (code: string) => void;
  /** Accessible name of the map, for example "Chassis map, B 9012 KX". */
  title?: string;
  /** The guide under the map: each tyre colour with its status and meaning; on by default. */
  guide?: boolean;
}

function Tyre({
  shape,
  status,
  selected,
  onSelect,
}: {
  shape: TyreShape;
  status: PositionStatus;
  selected: boolean;
  onSelect: ((code: string) => void) | undefined;
}) {
  const name = `${shape.code}, ${shape.label}, ${STATUS_LABELS[status]}`;
  const classes = ['m-tyre', STATUS_CLASSES[status], selected ? 't-sel' : ''].join(' ').trim();
  const press = onSelect
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': name,
        'aria-pressed': selected,
        onClick: () => onSelect(shape.code),
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(shape.code);
          }
        },
      }
    : {};

  if (shape.kind === 'Spare') {
    return (
      <g className={classes} data-code={shape.code} {...press}>
        <title>{name}</title>
        {/* DEC-119: only the code and the status colour, nothing else in the tyre. */}
        <circle cx={shape.cx} cy={shape.cy} r={shape.r} />
        <text x={shape.cx} y={shape.cy} className="m-code">
          {shape.code}
        </text>
      </g>
    );
  }
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  return (
    <g className={classes} data-code={shape.code} {...press}>
      <title>{name}</title>
      <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={9} />
      {/* The code reads upright along the wheel, centred on it. */}
      <text x={cx} y={cy} className="m-code" transform={`rotate(-90 ${cx} ${cy})`}>
        {shape.code}
      </text>
    </g>
  );
}

/**
 * REQ-PLC-008, REQ-PLC-010, DEC-119: the one chassis map, drawn from the layout only. Read only in Vehicles
 * and the layout preview; with `onSelect`, the positions are buttons for the Part Replacement step.
 */
export function ChassisMap({
  definition,
  statuses = {},
  selected = null,
  onSelect,
  title,
  guide = true,
}: ChassisMapProps) {
  const map = chassisGeometry(definition);
  const name =
    title ?? `Chassis map, ${map.axles.length} ${map.axles.length === 1 ? 'axle' : 'axles'}`;
  return (
    <div className="chassis-map">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="chassis"
        viewBox={`0 0 ${map.width} ${map.height}`}
        role={onSelect ? 'group' : 'img'}
        aria-label={name}
      >
        <text x={map.width / 2} y={12} className="m-front">
          FRONT
        </text>
        {RAIL.x.map((x) => (
          <rect
            key={x}
            className="m-rail"
            x={x}
            y={RAIL.top}
            width={RAIL.width}
            height={map.railBottom - RAIL.top}
            rx={5}
          />
        ))}
        {map.crossmembers.map((y) => (
          <rect key={y} className="m-cross" x={127} y={y} width={46} height={5} rx={2.5} />
        ))}
        {map.front.kind === 'Bumper' ? (
          <rect className="m-bumper" x={90} y={20} width={120} height={9} rx={4.5} />
        ) : (
          <>
            <rect className="m-cross" x={108} y={24} width={84} height={8} rx={4} />
            <circle className="m-pin" cx={map.front.cx} cy={map.front.cy} r={map.front.r}>
              <title>Kingpin</title>
            </circle>
          </>
        )}
        {map.fifthWheel && (
          <>
            <circle
              className="m-fifth"
              cx={map.fifthWheel.cx}
              cy={map.fifthWheel.cy}
              r={map.fifthWheel.r}
            >
              <title>Fifth wheel</title>
            </circle>
            <path
              className="m-fifth-slot"
              d={`M${map.fifthWheel.cx} ${map.fifthWheel.cy + 4} V${map.fifthWheel.cy + 30}`}
            />
          </>
        )}
        {map.axles.map((axle) => (
          <g key={axle.index} className="m-axle-group">
            <rect
              className="m-axle"
              x={axle.x}
              y={axle.y - 4}
              width={axle.width}
              height={8}
              rx={4}
            />
            <text x={2} y={axle.y + 3} className="m-role">
              {axle.role}
            </text>
          </g>
        ))}
        {map.tyres.map((shape) => (
          <Tyre
            key={shape.code}
            shape={shape}
            status={statuses[shape.code] ?? 'Empty'}
            selected={selected === shape.code}
            onSelect={onSelect}
          />
        ))}
        {map.axles.flatMap((axle) =>
          axle.hubX.map((x) => (
            <circle key={`${axle.index}-${x}`} className="m-hubcap" cx={x} cy={axle.y} r={6} />
          )),
        )}
      </svg>
      {guide && (
        <ul className="chassis-guide" aria-label="Tyre colours">
          {POSITION_STATUSES.map((status) => (
            <li key={status}>
              <span className={`chassis-swatch ${STATUS_CLASSES[status]}`} aria-hidden="true" />
              <b>{STATUS_LABELS[status]}</b>
              <span>{STATUS_MEANINGS[status]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
