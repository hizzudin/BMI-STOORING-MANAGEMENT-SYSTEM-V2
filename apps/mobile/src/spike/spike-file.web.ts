import type { SpikeFile } from './spike-api';

/** TASK-127 part A in the phone browser (DEC-142): the picked photo is a blob: URL. */
const read = async (uri: string) => (await fetch(uri)).blob();

export const spikeFile: SpikeFile = {
  async size(uri) {
    return (await read(uri)).size;
  },
  async put(url, headers, uri) {
    const response = await fetch(url, { method: 'PUT', headers, body: await read(uri) });
    return { status: response.status, body: await response.text() };
  },
};
