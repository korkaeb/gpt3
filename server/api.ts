import express from 'express';
import { sdkTransport } from './gemini-sdk';
import { generate, listModels, assistPrompt, GeminiError } from '../src/lib/gemini';
export function createApiRouter() {
const app = express();
app.use(express.json({ limit: '12mb' }));
app.use('/', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
// Body-supplied keys take precedence. Server keys are never sent to the browser.
function key(body: any) { return (typeof body?.apiKey === 'string' ? body.apiKey.trim() : '') || process.env.GEMINI_API_KEY || ''; }
app.get('/status', (_req, res) => res.json({ configured: Boolean(process.env.GEMINI_API_KEY?.trim()) }));
app.post('/models', async (req, res, next) => {
  try { res.json({ models: await listModels(key(req.body), undefined, sdkTransport) }); } catch (error) { next(error); }
});
for (const [route, vision] of [['vision-prompt', true], ['sort-prompt', false]] as const) {
  app.post(`/${route}`, async (req, res, next) => {
    try { res.json(await generate({ ...req.body, selectedModel: req.body?.selectedModel?.trim() || req.body?.model?.trim() || process.env.GEMINI_MODEL || 'gemini-flash-latest', apiKey: key(req.body) }, vision, undefined, sdkTransport)); }
    catch (error) { next(error); }
  });
}
app.post('/assist-prompt', async (req, res, next) => {
  try {
    res.json(await assistPrompt({ ...req.body, selectedModel: req.body?.selectedModel || req.body?.model || process.env.GEMINI_MODEL || 'gemini-flash-latest', apiKey: key(req.body) }, undefined, sdkTransport));
  } catch (error) { next(error); }
});
app.use('/', (_req, res) => res.status(404).json({ error: 'API endpoint не найден.' }));
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const rawStatus = err instanceof GeminiError ? err.status : err.type === 'entity.too.large' ? 413 : err instanceof SyntaxError ? 400 : 500;
  // AI Studio reverse proxy intercepts 502, 503, 504 and replaces JSON with an HTML warmup page (= /warmup.html).
  // Map these gateway/overload statuses to 429/422 so the JSON error payload safely reaches the client.
  const status = (rawStatus === 503 || rawStatus === 504) ? 429 : rawStatus === 502 || rawStatus === 500 ? 422 : rawStatus;
  if (err instanceof GeminiError && err.retryAfter) res.set('Retry-After', String(err.retryAfter));
  res.status(status).json({ error: err instanceof GeminiError ? err.message : rawStatus === 413 ? 'Изображение слишком большое (максимум 8 МБ).' : rawStatus === 400 ? 'Некорректный JSON запроса.' : 'Внутренняя ошибка сервера.' });
});
return app;
}
