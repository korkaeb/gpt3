import React from 'react';
import type { PromptResult, PoseDetails } from '../lib/gemini';
const poseLabels: Record<keyof PoseDetails, string> = {
  torso: 'Торс: наклон и разворот', head: 'Голова: наклон и поворот', hips: 'Таз и бёдра',
  leftArm: 'Левая рука', rightArm: 'Правая рука', leftHand: 'Левая кисть', rightHand: 'Правая кисть',
  leftLeg: 'Левая нога', rightLeg: 'Правая нога', weightDistribution: 'Опора и распределение веса',
};
export function AnalysisPanel({ result }: { result: PromptResult }) {
  const a = result.analysis;
  return <section className="bg-[#201e26] border border-[#3a3641] rounded-xl p-5 space-y-5">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl text-[#d6a63f]">Расшифровка сцены</h2><span className="text-xs text-[#a49d90]">Получено от: {result.model}</span></div>
    <p>{a.summary}</p>
    <div className="grid md:grid-cols-2 gap-4">{[['Камера, ракурс и кадрирование', a.camera], ['Композиция и глубина', a.composition], ['Окружение и объекты', a.environment], ['Свет и тени', a.lighting], ['Стиль изображения', a.style], ['Цветовая палитра', a.colorPalette]].map(([title, text]) => <div key={title}><h3 className="text-[#c06e88]">{title}</h3><p className="text-sm">{text || 'Не видно / не задано'}</p></div>)}</div>
    {a.subjects.map((s, i) => <div key={`${s.id}-${i}`} className="border-t border-[#3a3641] pt-4 space-y-3">
      <h3 className="text-[#d6a63f] text-lg">Объект / персонаж {s.id}</h3>
      <dl className="grid sm:grid-cols-2 gap-3 text-sm">{[['Внешность и отличительные признаки', s.appearance], ['Выражение лица', s.expression], ['Положение в кадре и глубина', s.framePosition], ['Одежда: общий вид', s.clothing], ['Поза: общий вид', s.pose], ['Руки и видимые контакты', s.hands], ['Направление взгляда', s.gaze]].map(([k, v]) => <div key={k}><dt className="text-[#a49d90]">{k}</dt><dd>{v || 'Не видно / не задано'}</dd></div>)}</dl>
      <div className="grid sm:grid-cols-2 gap-3">{[['Конструкция и детали одежды', s.clothingDetails], ['Аксессуары', s.accessories]].map(([label, list]) => <div key={String(label)}><h4 className="text-[#c06e88]">{String(label)}</h4>{(list as string[]).length ? <ul className="list-disc pl-5 text-sm">{(list as string[]).map((t, n) => <li key={n}>{t}</li>)}</ul> : <p className="text-sm text-[#a49d90]">Не видно / не задано</p>}</div>)}</div>
      <h4 className="text-[#c06e88]">Поза по частям тела</h4>
      <p className="text-xs text-[#a49d90]">Левая и правая стороны указаны только если их можно определить. Неясное положение описывается в общем разборе и неопределённых деталях.</p>
      <dl className="grid sm:grid-cols-2 gap-3 text-sm">{(Object.keys(poseLabels) as (keyof PoseDetails)[]).map(key => <div key={key}><dt className="text-[#a49d90]">{poseLabels[key]}</dt><dd>{s.poseDetails[key] || 'Не видно / не задано'}</dd></div>)}</dl>
    </div>)}
    {[['Взаимодействия, контакты и взаимная опора', a.interactions], ['Неопределённые и скрытые детали', a.uncertain], ['Пожелания пользователя и добавленные детали', a.requestedChanges]].map(([label, items]) => <div key={String(label)}><h3 className="text-[#c06e88]">{String(label)}</h3>{(items as string[]).length ? <ul className="list-disc pl-5 text-sm">{(items as string[]).map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="text-sm text-[#a49d90]">Нет</p>}</div>)}
  </section>;
}
