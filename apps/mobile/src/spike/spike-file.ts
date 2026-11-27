import { FileSystemUploadType, getInfoAsync, uploadAsync } from 'expo-file-system/legacy';
import type { SpikeFile } from './spike-api';

/**
 * TASK-127 part A on the phone app (DEC-141): the size on disk and a raw PUT of the file. The device
 * run found that fetch(uri).blob() reads "File not found" for a camera photo in Expo Go.
 */
export const spikeFile: SpikeFile = {
  async size(uri) {
    const info = await getInfoAsync(uri);
    if (!info.exists) throw new Error('The photo file was not found on the phone.');
    return info.size;
  },
  async put(url, headers, uri) {
    const result = await uploadAsync(url, uri, {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers,
    });
    return { status: result.status, body: result.body };
  },
};
