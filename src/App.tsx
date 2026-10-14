import { PromptOutput } from './components/PromptOutput';
import { AnimaSettings } from './components/AnimaSettings';
import { DEFAULT_FIDELITY, type Fidelity, type AnimaVariant } from './lib/gemini';
import { PromptAssistant } from './components/PromptAssistant';
import { requestPrompt } from './lib/api';
import type { PromptResult } from './lib/gemini';
import { AnalysisPanel } from './components/AnalysisPanel';
import React, { useState, useEffect, useMemo } from 'react';
import {
  CATEGORIES_CONFIG,
  CategoryKey,
  PromptCategories,
  RECOMMENDED_QUALITY_PREFIX,
  DEFAULT_NEGATIVE_PROMPT,
  OutputFormatMode,
  NSFW_KEYWORDS,
  parseTagWeight,
  formatTagWithWeight,
} from './types';
import { sortGeneralTags } from './utils/generalSorter';
import { Header } from './components/Header';
import { ApiKeyInput } from './components/ApiKeyInput';
import { CategoryDrawer } from './components/CategoryDrawer';
import { Toast, ToastMessage } from './components/Toast';
import {
  Wand2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  FileText,
  Sliders,
  ShieldCheck,
  AlertCircle,
  Zap,
  ArrowDown,
  Layers,
  Info,
  AlignLeft,
  LayoutList,
  Compass,
  Crosshair,
  Upload,
  Camera,
  Trash2,
  X,
  Image as ImageIcon,
} from 'lucide-react';

const SAMPLE_PROMPTS = [
  {
    title: 'Hatsune Miku Stage',
    text: '1girl, hatsune miku, vocaloid, artist:keisin, masterpiece, best quality, score_8, highres, blue twin tails, teal hair, futuristic concert stage, neon lights, microphone, energetic pose, floating ribbons, year 2024, safe',
  },
  {
    title: 'Genshin Raiden Pose Test',
    text: '1girl, sitting, raiden shogun, genshin impact, solo, purple hair, kimono, cherry blossoms, peaceful',
  },
  {
    title: 'Asuna NSFW / Explicit',
    text: 'asuna yuuki, sword art online, 1girl, solo, explicit, nsfw, nude, breasts, blush, long chestnut hair, hazel eyes, bedroom, soft lighting, masterpiece, score_8, 2024',
  },
];

export default function App() {
  const [apiKey, setApiKey] = useState<string>(() => {
    try { localStorage.removeItem('anima_gemini_api_key'); return sessionStorage.getItem('anima_gemini_api_key') || ''; } catch { return ''; }
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try { return localStorage.getItem('anima_gemini_model') || 'gemini-flash-latest'; } catch { return 'gemini-flash-latest'; }
  });

  const [result, setResult] = useState<PromptResult | null>(null);
  const [requestError, setRequestError] = useState('');
  const [animaVariant, setAnimaVariant] = useState<AnimaVariant>('aesthetic');
  const [fidelity, setFidelity] = useState<Fidelity>({ ...DEFAULT_FIDELITY });
  const [rawPrompt, setRawPrompt] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [addQualityPrefix, setAddQualityPrefix] = useState<boolean>(true);
  const [formatMode, setFormatMode] = useState<OutputFormatMode>('blocks');
  const [loadingMode, setLoadingMode] = useState<'sort' | 'enrich' | 'vision' | 'assist' | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [categories, setCategories] = useState<PromptCategories>({
    quality: [],
    count: [],
    character: [],
    series: [],
    artist: [],
    general: [],
  });

  const [precisionPromptText, setPrecisionPromptText] = useState('');
  const [hybridPromptText, setHybridPromptText] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>(DEFAULT_NEGATIVE_PROMPT);
  const [hasProcessed, setHasProcessed] = useState<boolean>(false);
  const [copiedAnima, setCopiedAnima] = useState<boolean>(false);

  useEffect(() => {
    try {
      if (apiKey) sessionStorage.setItem('anima_gemini_api_key', apiKey);
      else sessionStorage.removeItem('anima_gemini_api_key');
    } catch { /* Storage disabled: key stays in memory. */ }
  }, [apiKey]);
  useEffect(() => {
    try { localStorage.setItem('anima_gemini_model', selectedModel); } catch { /* optional */ }
  }, [selectedModel]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({
      id: Date.now().toString(),
      type,
      text,
    });
  };

  // Calculate tag counts for input
  const inputTagCount = useMemo(() => {
    if (!rawPrompt.trim()) return 0;
    return rawPrompt
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean).length;
  }, [rawPrompt]);

  // Detect NSFW tags across raw prompt and all categories
  const isNsfwDetected = useMemo(() => {
    const allTags = [
      ...categories.quality,
      ...categories.count,
      ...categories.character,
      ...categories.series,
      ...categories.artist,
      ...categories.general,
      ...rawPrompt.toLowerCase().split(/[,\n]/),
    ].map((t) => t.trim().toLowerCase());

    return allTags.some((tag) =>
      NSFW_KEYWORDS.some((kw) => tag.includes(kw))
    );
  }, [categories, rawPrompt]);

  // Quality prefixes are optional. Ratings are never inferred by keyword matching.
  const activeQualityTags = useMemo(() => {
    const list = [...categories.quality];
    if (addQualityPrefix && hasProcessed) list.unshift(...RECOMMENDED_QUALITY_PREFIX);
    return Array.from(new Set(list));
  }, [categories.quality, addQualityPrefix, hasProcessed]);

  // Get structured category lines for display and formatting
  const categoryLines = useMemo(() => {
    const lines: { key: CategoryKey; info: typeof CATEGORIES_CONFIG[0]; tags: string[]; text: string }[] = [];

    CATEGORIES_CONFIG.forEach((config) => {
      let tags = config.key === 'quality' ? activeQualityTags : categories[config.key];
      if (config.key === 'general') {
        tags = sortGeneralTags(tags);
      }
      const cleanTags = tags.filter((t) => t && t.trim().length > 0);
      if (cleanTags.length > 0) {
        lines.push({
          key: config.key,
          info: config,
          tags: cleanTags,
          text: cleanTags.join(', '),
        });
      }
    });

    return lines;
  }, [categories, activeQualityTags]);

  // Construct final output text depending on format mode (blocks vs single line)
  const finalMergedPrompt = useMemo(() => {
    if (categoryLines.length === 0) return '';

    if (formatMode === 'single') {
      return categoryLines.map((l) => l.text).join(', ');
    } else {
      // 'blocks' mode: Each category on a new line, each line except last ends with a comma
      return categoryLines
        .map((item, index) => {
          const isLast = index === categoryLines.length - 1;
          const cleanText = item.text.endsWith(',') ? item.text.slice(0, -1) : item.text;
          return isLast ? cleanText : `${cleanText},`;
        })
        .join('\n');
    }
  }, [categoryLines, formatMode]);

  const totalCategorizedTags = useMemo(() => {
    return (
      activeQualityTags.length +
      categories.count.length +
      categories.character.length +
      categories.series.length +
      categories.artist.length +
      categories.general.length
    );
  }, [categories, activeQualityTags]);

  // Handle Sort / Pose Enrich Prompt API call
  const handleSortPrompt = async (enrichPose = false) => {
    if (!rawPrompt.trim()) {
      showToast('Пожалуйста, вставьте исходные теги или промпт для обработки.', 'error');
      return;
    }

    setRequestError('');
    setLoadingMode(enrichPose ? 'enrich' : 'sort');

    try {
      const data = await requestPrompt({ prompt: rawPrompt, apiKey: apiKey.trim(), selectedModel, enrichPose, animaVariant, fidelity }, false);
      setResult(data);
      setNegativePrompt(data.negativePrompt);

      const fetchedCategories: PromptCategories = {
        ...data.categories,
        general: sortGeneralTags(data.categories?.general || []),
      };
      setCategories(fetchedCategories);

      setHybridPromptText(data.hybridPrompt);
      setPrecisionPromptText(data.precisionPrompt);

      setHasProcessed(true);
      if (enrichPose) {
        showToast('✨ Поза достроена анатомическими деталями и обогащена!');
      } else {
        showToast('Промпт успешно разложен по 6 категориям Anima!');
      }
    } catch (err: any) {
      setRequestError(err.message || 'Ошибка запроса');

      showToast(err.message || 'Произошла ошибка при обращении к Gemini API', 'error');
    } finally {
      setLoadingMode(null);
    }
  };

  // Image Upload and Vision Handlers
  const handleImageSelect = (file: File) => {
    if (loadingMode) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      showToast('Пожалуйста, выберите файл изображения (PNG, JPG, WebP).', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('Размер файла превышает 8 МБ.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
      setResult(null);
      setHybridPromptText('');
      setPrecisionPromptText('');
      setCategories({ quality: [], count: [], character: [], series: [], artist: [], general: [] });
      setHasProcessed(false);
      showToast('Изображение загружено! Нажмите "Анализировать фото" для генерации промптов.', 'info');
    };
    reader.onerror = () => showToast('Не удалось прочитать файл.', 'error');
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setResult(null);
      setHybridPromptText('');
      setPrecisionPromptText('');
      setCategories({ quality: [], count: [], character: [], series: [], artist: [], general: [] });
      setHasProcessed(false);
    showToast('Фото удалено', 'info');
  };

  // Vision Prompt API call (Image-to-Prompt)
  const handleVisionPrompt = async () => {
    if (!imagePreview) {
      showToast('Пожалуйста, загрузите картинку для анализа.', 'error');
      return;
    }

    setRequestError('');
    setLoadingMode('vision');

    try {
      const match = imagePreview.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (!match) {
        throw new Error('Некорректный формат файла изображения.');
      }

      const mimeType = match[1];
      const dataBase64 = match[2];

      const data = await requestPrompt({ image: { mimeType, data: dataBase64 }, prompt: rawPrompt, apiKey: apiKey.trim(), selectedModel, animaVariant, fidelity }, true);
      setResult(data);
      setNegativePrompt(data.negativePrompt);

      const fetchedCategories: PromptCategories = {
        ...data.categories,
        general: sortGeneralTags(data.categories?.general || []),
      };
      setCategories(fetchedCategories);

      setHybridPromptText(data.hybridPrompt);
      setPrecisionPromptText(data.precisionPrompt);

      setHasProcessed(true);
      showToast('Фото разобрано. Короткий полный промпт для Anima готов.');
    } catch (err: any) {
      setRequestError(err.message || 'Ошибка запроса');

      showToast(err.message || 'Произошла ошибка при анализе фото через Gemini Vision', 'error');
    } finally {
      setLoadingMode(null);
    }
  };

  // Tag removal handler
  const handleRemoveTag = (categoryKey: string, index: number) => {
    setCategories((prev) => {
      let currentList = [...prev[categoryKey as CategoryKey]];
      currentList.splice(index, 1);
      if (categoryKey === 'general') {
        currentList = sortGeneralTags(currentList);
      }
      return {
        ...prev,
        [categoryKey]: currentList,
      };
    });
  };

  // Tag addition handler
  const handleAddTag = (categoryKey: string, newTag: string) => {
    const cleanTag = newTag.trim().toLowerCase();
    if (!cleanTag) return;

    setCategories((prev) => {
      let currentList = [...prev[categoryKey as CategoryKey]];
      if (!currentList.includes(cleanTag)) {
        currentList.push(cleanTag);
      }
      if (categoryKey === 'general') {
        currentList = sortGeneralTags(currentList);
      }
      return {
        ...prev,
        [categoryKey]: currentList,
      };
    });
    showToast(`Тег "${cleanTag}" добавлен в категорию.`);
  };

  // Tag weight update handler
  const handleUpdateTagWeight = (categoryKey: string, index: number, newWeight: number) => {
    setCategories((prev) => {
      const list = [...prev[categoryKey as CategoryKey]];
      if (index >= 0 && index < list.length) {
        const { text } = parseTagWeight(list[index]);
        list[index] = formatTagWithWeight(text, newWeight);
      }
      const updatedList = categoryKey === 'general' ? sortGeneralTags(list) : list;
      return {
        ...prev,
        [categoryKey]: updatedList,
      };
    });
  };

  // Copy individual category tags (resolves active quality tags if quality drawer)
  const handleCopyCategory = (categoryKey: string) => {
    const categoryTags = categoryKey === 'quality' ? activeQualityTags : categories[categoryKey as CategoryKey];
    if (!categoryTags || categoryTags.length === 0) return;
    const text = categoryTags.join(', ');
    navigator.clipboard.writeText(text);
    showToast(`Теги категории скопированы в буфер обмена!`);
  };

  // Copy Anima prompt format
  const handleCopyAnimaPrompt = () => {
    if (!finalMergedPrompt) {
      showToast('Нет тегов для копирования Anima.', 'info');
      return;
    }
    navigator.clipboard.writeText(finalMergedPrompt);
    setCopiedAnima(true);
    showToast(
      formatMode === 'blocks'
        ? 'Промпт Anima скопирован (по категориям с новой строки)!'
        : 'Промпт Anima скопирован одной строкой!'
    );
    setTimeout(() => setCopiedAnima(false), 2000);
  };

  // Load sample prompt
  const handleLoadSample = (sampleText: string) => {
    setRawPrompt(sampleText);
    showToast('Пример промпта загружен.');
  };


  return (
    <div className="min-h-screen bg-[#17161b] text-[#efe8da] font-sans pb-16 px-4 sm:px-6 lg:px-8">
      {/* Background Radial Overlay */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#28252f]/40 via-[#17161b]/80 to-[#17161b] z-0" />

      <div className="relative z-10 max-w-7xl mx-auto pt-8">
        {/* Header */}
        <Header selectedModel={selectedModel} />

        {/* API Key & Model Selector Input Box */}
        <ApiKeyInput
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          disabled={Boolean(loadingMode)}
        />

        {requestError && <div role="alert" className="mb-6 rounded-xl border border-[#c06e88] bg-[#201e26] p-4 text-[#efe8da]">{requestError}<button className="ml-4 underline" onClick={() => setRequestError('')}>Закрыть</button></div>}
        <div className="mb-6"><AnimaSettings variant={animaVariant} fidelity={fidelity} disabled={Boolean(loadingMode)} onVariant={setAnimaVariant} onFidelity={setFidelity} /></div>
        {/* Main Content Layout */}
        <div className="space-y-8">
          {/* Input Area Card */}
          <section className="bg-[#201e26] border border-[#3a3641] rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
            {/* Vision Mode Drag & Drop / Upload Area */}
            <div className="bg-[#17161b]/80 border border-[#3a3641] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#d6a63f]" />
                  <span className="font-mono text-xs font-semibold text-[#efe8da] uppercase tracking-wider">
                    📸 Загрузить картинку / Перетащить фото (Vision Mode)
                  </span>
                </div>
                {imagePreview && (
                  <button
                    type="button"
                    disabled={Boolean(loadingMode)}
                    onClick={handleRemoveImage}
                    className="text-xs font-mono text-[#c06e88] hover:text-[#d67b96] transition-colors flex items-center gap-1 bg-[#201e26] px-2.5 py-1 rounded-md border border-[#3a3641]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Удалить фото</span>
                  </button>
                )}
              </div>

              {!imagePreview ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`relative border-2 border-dashed rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                    isDragging
                      ? 'border-[#d6a63f] bg-[#d6a63f]/10 scale-[1.005]'
                      : 'border-[#3a3641] hover:border-[#d6a63f]/60 bg-[#201e26]/50 hover:bg-[#201e26]'
                  }`}
                >
                  <input
                    type="file"
                    disabled={Boolean(loadingMode)}
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImageSelect(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  <div className="p-2.5 rounded-full bg-[#28252f] text-[#d6a63f] shadow-inner">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-mono text-[#efe8da] font-medium">
                      Перетащите изображение сюда или <span className="text-[#d6a63f] underline">выберите файл</span>
                    </p>
                    <p className="text-[11px] font-sans text-[#a49d90] mt-1">
                      Gemini Vision детализирует позу, анатомию, персонажа, одежду и фон (PNG, JPG, WebP)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-[#201e26] border border-[#3a3641] rounded-xl p-3 flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative group shrink-0">
                    <img
                      src={imagePreview}
                      alt="Vision Preview"
                      className="w-28 h-28 object-cover rounded-lg border border-[#3a3641] shadow-md"
                    />
                    <button
                      type="button"
                      disabled={Boolean(loadingMode)}
                    onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 p-1.5 rounded-full bg-[#c06e88] text-[#17161b] hover:bg-[#d67b96] transition-colors shadow-lg"
                      title="Удалить фото"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-2.5 text-center sm:text-left">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-[#7fa06a]/20 text-[#7fa06a] border border-[#7fa06a]/40 uppercase tracking-wider">
                      <Camera className="w-3 h-3" /> Фото загружено
                    </div>
                    <p className="text-xs font-mono text-[#a49d90]">
                      Изображение готово к анализу. Вы можете нажать кнопку ниже или добавить текстовые пожелания в поле ввода.
                    </p>
                    <button
                      type="button"
                      onClick={handleVisionPrompt}
                      disabled={Boolean(loadingMode)}
                      className="px-4 py-2.5 rounded-xl font-mono text-xs sm:text-sm font-semibold text-[#17161b] bg-[#7fa06a] hover:bg-[#8eb079] active:scale-[0.98] transition-all flex items-center justify-center sm:justify-start gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingMode === 'vision' ? (
                        <>
                          <Zap className="w-4 h-4 animate-spin" />
                          <span>Анализируем изображение...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          <span>Разобрать фото и собрать промпт Anima</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#d6a63f]" />
                <h2 className="font-mono font-semibold text-[#efe8da] text-lg">
                  Исходный промпт (Raw Prompt Input)
                </h2>
                {inputTagCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#3a3641] text-[#d6a63f]">
                    ~{inputTagCount} тегов
                  </span>
                )}
              </div>

              {/* Sample Prompts */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#a49d90] hidden md:inline">
                  Примеры:
                </span>
                {SAMPLE_PROMPTS.map((sample) => (
                  <button
                    key={sample.title}
                    type="button"
                    onClick={() => handleLoadSample(sample.text)}
                    className="px-2.5 py-1 text-xs font-mono rounded-md bg-[#28252f] border border-[#3a3641] hover:border-[#d6a63f] text-[#efe8da] hover:text-[#d6a63f] transition-colors"
                  >
                    {sample.title}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={rawPrompt}
              onChange={(e) => setRawPrompt(e.target.value)}
              rows={4}
              placeholder="Вставьте необработанные теги Danbooru или естественный текст, например: 1girl, hatsune miku, vocaloid, masterpiece, best quality, blue hair, school uniform, detailed stage background..."
              className="w-full bg-[#17161b] border border-[#3a3641] focus:border-[#d6a63f] rounded-xl p-4 text-sm font-mono text-[#efe8da] placeholder-[#a49d90]/40 outline-none transition-colors resize-y leading-relaxed"
            />

            <PromptAssistant prompt={rawPrompt} apiKey={apiKey} model={selectedModel}
              busy={Boolean(loadingMode)} onBusy={busy => setLoadingMode(busy ? 'assist' : null)}
              onApply={setRawPrompt} />

            {/* Control Bar */}
            <div className="mt-4 pt-4 border-t border-[#3a3641]/60 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={addQualityPrefix}
                    onChange={(e) => setAddQualityPrefix(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#17161b] border-[#3a3641] text-[#d6a63f] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#d6a63f]"
                  />
                  <span className="text-xs sm:text-sm font-sans text-[#efe8da] group-hover:text-[#d6a63f] transition-colors">
                    Добавить префикс к дополнительным тегам (
                    <code className="font-mono text-[#d6a63f]">
                      masterpiece, best quality
                    </code>
                    )
                  </span>
                </label>

                {isNsfwDetected && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-[#c06e88]/20 text-[#c06e88] border border-[#c06e88]/40 shadow-xs">
                    <AlertCircle className="w-3.5 h-3.5" /> В тексте есть чувствительные теги
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {rawPrompt && (
                  <button
                    type="button"
                    onClick={() => {
                      setRawPrompt('');
                      showToast('Поле ввода очищено', 'info');
                    }}
                    className="px-3 py-2 rounded-xl border border-[#3a3641] text-xs font-mono text-[#a49d90] hover:text-[#efe8da] hover:bg-[#3a3641] transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Очистить</span>
                  </button>
                )}

                {/* Standard Sort Button */}
                <button
                  type="button"
                  onClick={() => handleSortPrompt(false)}
                  disabled={Boolean(loadingMode) || !rawPrompt.trim()}
                  className="px-4 py-2.5 rounded-xl font-mono text-xs sm:text-sm font-semibold border border-[#d6a63f]/60 text-[#d6a63f] bg-[#28252f] hover:bg-[#d6a63f]/10 active:scale-[0.98] transition-all flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMode === 'sort' ? (
                    <>
                      <Zap className="w-4 h-4 animate-spin text-[#d6a63f]" />
                      <span>Сортировка...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 text-[#d6a63f]" />
                      <span>Собрать промпт Anima</span>
                    </>
                  )}
                </button>

                {/* Pose Enhancer Button (WD14 Enhancer) */}
                <button
                  type="button"
                  onClick={() => handleSortPrompt(true)}
                  disabled={Boolean(loadingMode) || !rawPrompt.trim()}
                  className="px-5 py-2.5 rounded-xl font-mono text-xs sm:text-sm font-semibold text-[#17161b] bg-gradient-to-r from-[#d6a63f] via-[#e2b44f] to-[#c7912a] hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMode === 'enrich' ? (
                    <>
                      <Zap className="w-4 h-4 animate-spin text-[#17161b]" />
                      <span>Достраиваем позу...</span>
                    </>
                  ) : (
                    <>
                      <Compass className="w-4 h-4 text-[#17161b]" />
                      <span>✨ Достроить позу и обогатить промпт</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          <PromptOutput result={result} prompt={hybridPromptText} detailed={precisionPromptText} onDetailedChange={setPrecisionPromptText} negative={negativePrompt} onPromptChange={setHybridPromptText} onNegativeChange={setNegativePrompt} />
          {result && <details open className="rounded-xl border border-[#3a3641] p-4"><summary className="cursor-pointer text-[#d6a63f]">Расшифровка всех деталей: персонажи, одежда, поза, камера и контакты</summary><div className="mt-4"><AnalysisPanel result={result} /></div></details>}
          <details className="rounded-xl border border-[#3a3641] p-4"><summary className="cursor-pointer text-[#a49d90]">Дополнительно: редактируемые теги по категориям</summary>
          {/* 6 Category Drawers (Card Catalog Style) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#d6a63f]" />
                <h2 className="font-display font-semibold text-xl text-[#efe8da]">
                  Теги сцены по категориям
                </h2>
              </div>
              {hasProcessed && (
                <span className="text-xs font-mono text-[#a49d90]">
                  Всего отсортировано: <strong className="text-[#efe8da]">{totalCategorizedTags}</strong> тегов
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {CATEGORIES_CONFIG.map((info) => (
                <CategoryDrawer
                  key={info.key}
                  info={info}
                  tags={
                    info.key === 'quality'
                      ? activeQualityTags
                      : info.key === 'general'
                      ? sortGeneralTags(categories.general)
                      : categories[info.key]
                  }
                  onRemoveTag={handleRemoveTag}
                  onAddTag={handleAddTag}
                  onCopyCategory={handleCopyCategory}
                  onUpdateTagWeight={handleUpdateTagWeight}
                />
              ))}
            </div>
          </section>

          <div className="mt-4 space-y-3">
            <p className="text-xs text-[#a49d90]">Теги — дополнительное представление сцены. Их редактирование не переписывает основной промпт; для этого отредактируйте основной текст напрямую или обработайте изменённый исходный текст.</p>
            <label className="text-sm">Формат тегов <select value={formatMode} onChange={e => setFormatMode(e.target.value as OutputFormatMode)} className="bg-[#17161b] border rounded p-2 ml-2"><option value="single">Одной строкой</option><option value="blocks">По категориям</option></select></label>
            <textarea aria-label="Теги для Anima" readOnly rows={4} value={finalMergedPrompt} className="w-full bg-[#17161b] border border-[#4f4958] rounded-lg p-3 text-sm" />
            <button type="button" disabled={!finalMergedPrompt} onClick={handleCopyAnimaPrompt} className="text-sm underline">{copiedAnima ? 'Скопировано' : 'Скопировать теги'}</button>
          </div>
          </details>

        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-xs font-mono text-[#a49d90]/60 border-t border-[#3a3641] pt-6">
          Anima Checkpoint Prompt Sorter · Powered by Google AI Studio & Gemini 3.6 Flash
        </footer>
      </div>

      {/* Floating Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
