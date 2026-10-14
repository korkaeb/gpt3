import React, { useState } from 'react';
import type { PromptResult } from '../lib/gemini';
interface Props { result: PromptResult | null; prompt: string; detailed: string; onDetailedChange: (s: string) => void; negative: string; onPromptChange: (s: string) => void; onNegativeChange: (s: string) => void }
export function PromptOutput({ result, prompt, detailed, onDetailedChange, negative, onPromptChange, onNegativeChange }: Props) {
  const [notice, setNotice] = useState('');
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice('Скопировано'); }
    catch { setNotice('Не удалось скопировать автоматически. Выделите текст в поле и скопируйте вручную.'); }
  }
  const field = 'w-full bg-[#17161b] border border-[#4f4958] rounded-xl p-4 text-sm text-[#efe8da] leading-relaxed resize-y';
  return <section className="bg-[#201e26] border border-[#d6a63f]/60 rounded-2xl p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold text-[#d6a63f]">Короткий полный промпт для Anima</h2>
      <button type="button" disabled={!prompt.trim()} onClick={() => copy(prompt)} className="bg-[#7fa06a] text-[#17161b] rounded-lg px-4 py-2 font-semibold disabled:opacity-40">Скопировать промпт</button>
    </div>
    <p className="text-xs text-[#a49d90]">Теги для узнаваемых признаков + связный текст для позы, одежды, композиции и взаимодействий. Короткий вариант той же сцены.</p>
    {result && <p className="text-xs text-[#a49d90]">Anima {result.animaVariant === 'base' ? 'Base' : result.animaVariant === 'turbo' ? 'Turbo' : 'Aesthetic'} · Gemini: {result.model}</p>}
    <textarea aria-label="Короткий полный промпт для Anima" rows={7} value={prompt} onChange={e => onPromptChange(e.target.value)} className={field} placeholder="Загрузите фото или напишите свою сцену, затем нажмите генерацию. Здесь появится готовый английский промпт." />
    <div className="border-t border-[#4f4958] pt-4 space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-3"><h2 className="text-xl text-[#c06e88] font-semibold">Подробный промпт для Anima</h2><button type="button" disabled={!detailed.trim()} onClick={() => copy(detailed)} className="bg-[#c06e88] text-[#17161b] rounded-lg px-4 py-2 font-semibold disabled:opacity-40">Скопировать подробный</button></div>
      <p className="text-xs text-[#a49d90]">Та же сцена с полной детализацией внешности, одежды, частей тела, позы, контактов, камеры, света и окружения. Можно отредактировать отдельно от короткого варианта.</p>
      <textarea aria-label="Подробный промпт для Anima" rows={14} value={detailed} onChange={e => onDetailedChange(e.target.value)} className={field} placeholder="После обработки здесь появится развёрнутый английский промпт. Расшифровка наблюдаемых деталей находится в блоке ниже." />
    </div>
    <div className="flex flex-wrap justify-between gap-3"><label htmlFor="negative-prompt" className="text-[#c06e88] font-semibold">Негативный промпт</label><button disabled={!negative.trim()} type="button" className="text-sm underline" onClick={() => copy(negative)}>Скопировать негативный</button></div>
    <textarea id="negative-prompt" rows={2} value={negative} onChange={e => onNegativeChange(e.target.value)} className={field} />
    {notice && <p role="status" className="text-sm">{notice}</p>}

  </section>;
}
