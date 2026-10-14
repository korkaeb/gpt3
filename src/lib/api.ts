import { generate, listModels, assistPrompt, type AssistInput, type AssistResult, type RequestInput, type PromptResult } from './gemini';
export const STATIC_MODE = import.meta.env.VITE_STATIC_MODE === 'true';
async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(100_000) });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new Error('Время ожидания ответа истекло (100 сек). Выберите более быструю модель или повторите запрос.');
    }
    throw new Error('Сервер не ответил. Проверьте соединение и запуск сервера.');
  }
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    if (text.includes('Please wait while your application starts') || text.includes('Starting Server')) {
      throw new Error('Сервер приложения сейчас запускается (Warmup). Подождите несколько секунд и повторите запрос.');
    }
    throw new Error(`Сервер вернул ответ не в формате JSON (HTTP ${response.status}). Попробуйте повторить запрос или выбрать другую модель.`);
  }
  if (!response.ok) throw new Error(data?.error || `Ошибка сервера ${response.status}`);
  return data;
}
export function requestPrompt(input: RequestInput, vision: boolean): Promise<PromptResult> {
  return STATIC_MODE ? generate(input, vision) : post(vision ? '/api/vision-prompt' : '/api/sort-prompt', input);
}
export async function requestModels(apiKey: string) {
  return STATIC_MODE ? listModels(apiKey) : (await post<{ models: { value: string; label: string }[] }>('/api/models', { apiKey })).models;
}

export function requestAssist(input: AssistInput): Promise<AssistResult> {
  return STATIC_MODE ? assistPrompt(input) : post('/api/assist-prompt', input);
}
