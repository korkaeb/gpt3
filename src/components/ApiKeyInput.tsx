import React, { useState, useEffect } from 'react';
import { requestModels, STATIC_MODE } from '../lib/api';
interface Props { apiKey: string; onApiKeyChange: (s: string) => void; selectedModel: string; onModelChange: (s: string) => void; disabled?: boolean }
export const GEMINI_MODEL_OPTIONS = [
  { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (флагман)' },
  { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (быстрый)' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { value: 'gemini-flash-lite-latest', label: 'Flash Lite · latest (быстрый)' },
  { value: 'gemini-flash-latest', label: 'Flash · latest (алиас)' },
  { value: 'gemini-pro-latest', label: 'Pro · latest (алиас)' },
  { value: 'gemini-omni-1.1-flash', label: 'Gemini Omni 1.1 Flash' },
  { value: 'gemini-omni-flash-preview', label: 'Gemini Omni Flash Preview' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
];
export function ApiKeyInput({ apiKey, onApiKeyChange, selectedModel, onModelChange, disabled }: Props) {
  const [serverStatus, setServerStatus] = useState('Проверяю ключ среды…');
  const [models, setModels] = useState(GEMINI_MODEL_OPTIONS);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Список моделей Gemini загружен. Выберите подходящую модель.');
  const [custom, setCustom] = useState(!GEMINI_MODEL_OPTIONS.some(m => m.value === selectedModel));

  useEffect(() => {
    if (STATIC_MODE) return;
    const controller = new AbortController();
    fetch('/api/status', { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error();
      const data = await r.json();
      setServerStatus(data.configured ? 'Ключ среды Google AI Studio / сервера найден. Поле ключа можно оставить пустым.' : 'Ключ среды не задан. Добавьте GEMINI_API_KEY в Secrets AI Studio или введите свой ключ.');
    }).catch(() => { if (!controller.signal.aborted) setServerStatus('Сервер недоступен. Запустите приложение через npm run dev.'); });
    return () => controller.abort();
  }, []);

  // Auto-fetch full list of available models from API on mount or apiKey change
  useEffect(() => {
    let active = true;
    requestModels(apiKey).then(result => {
      if (!active || !result?.length) return;
      setModels(prev => {
        const map = new Map<string, { value: string; label: string }>();
        GEMINI_MODEL_OPTIONS.forEach(m => map.set(m.value, m));
        result.forEach(m => map.set(m.value, m));
        return Array.from(map.values());
      });
      setMessage(`Доступно моделей: ${result.length}. Выберите подходящую модель.`);
    }).catch(() => {
      // Keep static list if API request fails
    });
    return () => { active = false; };
  }, [apiKey]);

  const input = 'w-full bg-[#17161b] border border-[#4f4958] rounded-lg p-3 text-sm text-[#efe8da]';
  async function refresh() {
    setLoading(true);
    try {
      const result = await requestModels(apiKey);
      if (!result.length) throw new Error('API не вернул моделей с generateContent.');
      const map = new Map<string, { value: string; label: string }>();
      GEMINI_MODEL_OPTIONS.forEach(m => map.set(m.value, m));
      result.forEach(m => map.set(m.value, m));
      const combined = Array.from(map.values());
      setModels(combined);
      setCustom(!combined.some(m => m.value === selectedModel));
      setMessage(`Найдено ${result.length} моделей. Наличие в списке не гарантирует квоту или поддержку фото и JSON.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Ошибка загрузки списка'); }
    finally { setLoading(false); }
  }
  return <section className="bg-[#201e26] border border-[#3a3641] rounded-xl p-4 mb-6 space-y-4">
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-2"><label htmlFor="api-key">Gemini API key</label>
        <div className="flex gap-2"><input autoComplete="off" spellCheck={false} id="api-key" className={input} type={show ? 'text' : 'password'} value={apiKey} disabled={disabled} onChange={e => onApiKeyChange(e.target.value)} placeholder={STATIC_MODE ? 'Введите свой ключ Gemini' : 'Пусто — использовать GEMINI_API_KEY сервера'} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Скрыть ключ' : 'Показать ключ'}>{show ? 'Скрыть' : 'Показать'}</button></div>
        <button disabled={disabled || !apiKey} type="button" onClick={() => onApiKeyChange('')} className="text-xs text-[#c06e88]">Удалить ключ из вкладки</button>
      </div>
      <div className="space-y-2"><label htmlFor="model">Модель Gemini</label>
        <select id="model" className={input} disabled={disabled || loading} value={custom ? '__custom' : selectedModel} onChange={e => { setCustom(e.target.value === '__custom'); if (e.target.value !== '__custom') onModelChange(e.target.value); }}>
          {models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}<option value="__custom">Свой ID модели…</option>
        </select>
        {custom && <input aria-label="ID модели" className={input} value={selectedModel} disabled={disabled} onChange={e => onModelChange(e.target.value.trim())} placeholder="gemini-…" />}
        <button type="button" disabled={disabled || loading} onClick={refresh} className="text-sm text-[#d6a63f] disabled:opacity-50">{loading ? 'Загружаю…' : 'Обновить список из Gemini API'}</button>
      </div>
    </div>
    {!STATIC_MODE && <p className="text-xs text-[#d6a63f]">{apiKey.trim() ? 'Используется введённый вами ключ; он имеет приоритет над ключом среды.' : serverStatus}</p>}
    <p role="status" className="text-xs text-[#a49d90]">{message}</p>
    <p className="text-xs text-[#a49d90]">{STATIC_MODE ? 'GitHub Pages: фото и текст отправляются прямо в Google Gemini с вашим ключом.' : 'Серверный режим: фото и текст проходят через сервер приложения в Google Gemini.'} Ключ хранится только до закрытия вкладки (sessionStorage). В репозиторий он не попадает.</p>
  </section>;
}
