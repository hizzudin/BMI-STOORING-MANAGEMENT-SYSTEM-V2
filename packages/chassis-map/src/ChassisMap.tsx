import type { ChassisDefinition } from '@bmi/shared';
import type { KeyboardEvent } from 'react';
import { chassisGeometry, RAIL, type TyreShape } from './geometry.js';
import {
  POSITION_STATUSES,
  STATUS_CLASSES,
  STATUS_LABELS,
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
  /** The status legend under the map; on by default. */
  legend?: boolean;
}

/** Tread marks across a wheel, as in the artboards. */
const TREADS = [7, 13, 43, 49];

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
  const missing = status === 'Missing';
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
        <circle cx={shape.cx} cy={shape.cy} r={shape.r} />
        <circle className="m-hub" cx={shape.cx} cy={shape.cy} r={11} />
        <text x={shape.cx} y={shape.cy + 3} className="m-code">
          {shape.code}
        </text>
        {missing && (
          // Between the hub and the rim, under the code.
          <text x={shape.cx} y={shape.cy + 19} className="m-miss m-miss-small">
            ?
          </text>
        )}
      </g>
    );
  }
  const cx = shape.x + shape.width / 2;
  const axleY = shape.y + shape.height / 2;
  // DEC-119: the code reads upright in the tyre; a Missing tyre keeps room for its "?".
  const codeY = missing ? axleY - 6 : axleY;
  return (
    <g className={classes} data-code={shape.code} {...press}>
      <title>{name}</title>
      <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={9} />
      {TREADS.map((offset) => (
        <path key={offset} className="m-tread" d={`M${shape.x + 5} ${shape.y + offset} h12`} />
      ))}
      <text x={cx} y={codeY} className="m-code" transform={`rotate(-90 ${cx} ${codeY})`}>
        {shape.code}
      </text>
      {missing && (
        <text x={cx} y={axleY + 21} className="m-miss">
          ?
        </text>
      )}
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
  legend = true,
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
      {legend && (
        <ul className="chassis-legend" aria-label="Position status">
          {POSITION_STATUSES.map((status) => (
            <li key={status} className={`chassis-legend-item ${STATUS_CLASSES[status]}`}>
              {STATUS_LABELS[status]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
