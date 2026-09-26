import { File } from 'expo-file-system';

/** Reads a local file (e.g. from the document picker) into memory for upload. */
export function readFileBytes(uri: string): Promise<ArrayBuffer> {
  return new File(uri).arrayBuffer();
}
