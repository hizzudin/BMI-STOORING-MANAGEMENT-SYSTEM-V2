import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generatePositions, type ChassisDefinition } from '@bmi/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChassisMap } from './ChassisMap.js';
import { LAUNCH_LAYOUTS, generatedLayouts } from './fixtures.js';
import { POSITION_STATUSES, type PositionStatus } from './statuses.js';

/**
 * §8.3, DEC-73: an image snapshot per layout. Each is a standalone SVG with the map's own style sheet, so
 * it opens as a picture and compares the same on every machine (no font rendering in the comparison).
 */
const CSS = readFileSync(join(import.meta.dirname, '../styles/chassis-map.css'), 'utf8');

/** Every status appears on every map that has five positions or more. */
function statusesOf(definition: ChassisDefinition): Record<string, PositionStatus> {
  return Object.fromEntries(
    generatePositions(definition).map((p, i) => [
      p.code,
      POSITION_STATUSES[i % POSITION_STATUSES.length] as PositionStatus,
    ]),
  );
}

function picture(definition: ChassisDefinition): string {
  const svg = /<svg[\s\S]*<\/svg>/.exec(
    renderToStaticMarkup(
      <ChassisMap definition={definition} statuses={statusesOf(definition)} guide={false} />,
    ),
  )?.[0];
  if (!svg) throw new Error('the map rendered no svg');
  // The standalone file paints a white page under the map, as the card does.
  return svg.replace(
    /^<svg([^>]*)>/,
    `<svg$1><style>${CSS}</style><rect width="100%" height="100%" fill="#fff"/>`,
  );
}

describe('chassis map layout image snapshots (DEC-73)', () => {
  for (const [name, definition] of Object.entries(LAUNCH_LAYOUTS)) {
    it(`DEC-73 launch layout ${name}`, async () => {
      await expect(picture(definition)).toMatchFileSnapshot(
        `./__image_snapshots__/launch/${name}.svg`,
      );
    });
  }

  for (const { name, definition } of generatedLayouts()) {
    it(`DEC-73 generated layout ${name}`, async () => {
      await expect(picture(definition)).toMatchFileSnapshot(
        `./__image_snapshots__/generated/${name}.svg`,
      );
    });
  }
});
