import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, resultSchema } from '../src/lib/gemini';
function fixture(schema: any): any {
  if (schema.type === 'string') return '';
  if (schema.type === 'array') return [];
  return Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, fixture(value)]));
}
test('full subject breakdown and expanded prompt survive the structured generation response', async () => {
  const response = fixture(resultSchema);
  const subject = fixture((resultSchema.properties.analysis as any).properties.subjects.items);
  subject.id = 'A';
  subject.expression = 'Лёгкая улыбка';
  subject.framePosition = 'Слева, на переднем плане';
  subject.clothingDetails = ['Белый воротник поверх тёмного платья', 'Рукава закреплены отдельно'];
  subject.accessories = ['Красная лента в волосах'];
  subject.poseDetails.leftHand = 'Ладонь лежит на спинке стула';
  subject.poseDetails.rightLeg = 'Согнута в колене';
  subject.poseDetails.weightDistribution = 'Вес перенесён на левую ногу';
  response.analysis.subjects = [subject];
  response.analysis.style = 'Аниме-иллюстрация';
  response.analysis.colorPalette = 'Тёплый фон и тёмная одежда';
  response.precisionPrompt = 'A woman stands in the foreground on the left. A white collar lies over her dark dress, with detached sleeves. Her left palm rests on the chair back, her right knee is bent and her weight rests on the left leg. A red ribbon decorates her hair.';
  response.hybridPrompt = '1woman, dark dress, indoors. She stands beside a chair with a slight smile.';
  const result = await generate({ apiKey: 'test-only', selectedModel: 'gemini-test', prompt: 'a woman beside a chair' }, false,
    (async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(response) }] } }] }))) as typeof fetch);
  assert.deepEqual(result.analysis.subjects[0], subject);
  assert.equal(result.precisionPrompt, response.precisionPrompt);
  assert.notEqual(result.hybridPrompt, result.precisionPrompt);
  assert.equal(result.analysis.style, response.analysis.style);
});
