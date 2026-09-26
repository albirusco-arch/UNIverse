/** On web the document picker returns blob: URLs, which fetch can read. */
export async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  return (await fetch(uri)).arrayBuffer();
}
