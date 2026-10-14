import React from 'react';
import type { AnimaVariant, Fidelity } from '../lib/gemini';
export function AnimaSettings({ variant, fidelity, disabled, onVariant, onFidelity }: { variant: AnimaVariant; fidelity: Fidelity; disabled: boolean; onVariant: (v: AnimaVariant) => void; onFidelity: (v: Fidelity) => void }) {
  const labels: Record<keyof Fidelity, string> = { pose: 'Сохранение позы', outfit: 'Сохранение одежды', composition: 'Сохранение композиции', interaction: 'Сохранение взаимодействий', creativity: 'Свобода деталей' };
  return <div className="rounded-xl border border-[#4f4958] p-4 space-y-3">
    <label className="flex flex-wrap items-center gap-3">Модель для готового промпта
      <select disabled={disabled} value={variant} onChange={e => onVariant(e.target.value as AnimaVariant)} className="bg-[#17161b] border border-[#4f4958] rounded-lg p-2"><option value="aesthetic">Anima Aesthetic</option><option value="base">Anima Base</option><option value="turbo">Anima Turbo</option></select>
    </label>
    <p className="text-xs text-[#a49d90]">Это модель для генерации изображения по промпту. Gemini выше анализирует фото и пишет текст.</p>
    <details><summary className="cursor-pointer text-sm text-[#d6a63f]">Точность и свобода деталей</summary>
      <div className="grid sm:grid-cols-2 gap-4 pt-3">{(Object.keys(labels) as (keyof Fidelity)[]).map(key => <label key={key} className="text-sm">{labels[key]} · {fidelity[key]}<input className="block w-full accent-[#d6a63f]" disabled={disabled} type="range" min={0} max={100} value={fidelity[key]} onChange={e => onFidelity({ ...fidelity, [key]: Number(e.target.value) })} /></label>)}</div>
      <p className="text-xs text-[#a49d90] mt-3">Высокая точность усиливает сохранение исходных деталей. Свобода допускает совместимые изменения только в незаданных деталях окружения и стиля.</p>
    </details>
  </div>;
}
