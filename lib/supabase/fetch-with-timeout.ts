const SUPABASE_REQUEST_TIMEOUT_MS = 12000;

export async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS);

  let removeAbortForwarder: (() => void) | null = null;
  if (init?.signal) {
    const forwardAbort = () => controller.abort();
    if (init.signal.aborted) {
      clearTimeout(timer);
      throw new Error('Requete annulee.');
    }
    init.signal.addEventListener('abort', forwardAbort, { once: true });
    removeAbortForwarder = () => init.signal?.removeEventListener('abort', forwardAbort);
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Delai depasse lors de la communication avec Supabase.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    removeAbortForwarder?.();
  }
}