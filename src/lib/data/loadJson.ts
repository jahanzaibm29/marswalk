export async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load data: ${path} (${response.status})`);
  }
  return response.json() as Promise<T>;
}
