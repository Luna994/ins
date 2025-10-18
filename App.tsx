// FIX: Implemented the main application component to provide a user interface for generating Instagram posts from recipes. This resolves module loading errors and provides the application's functionality.
import React, { useState, useEffect } from 'react';
import { PostContent } from './types';
import { generatePostFromRecipe } from './services/geminiService';
import Spinner from './components/Spinner';
import { UploadIcon, SparklesIcon, TableIcon, CheckCircleIcon, ExclamationCircleIcon } from './components/Icons';

function App() {
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [postContent, setPostContent] = useState<PostContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isSendingToSheet, setIsSendingToSheet] = useState(false);
  const [sheetStatus, setSheetStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [sheetError, setSheetError] = useState<string | null>(null);

  useEffect(() => {
    if (sheetStatus === 'success' || sheetStatus === 'error') {
      const timer = setTimeout(() => {
        setSheetStatus('idle');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [sheetStatus]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
    }
  };

  const switchTab = (tab: 'text' | 'image') => {
    setActiveTab(tab);
    setError(null);
    if (tab === 'text') {
      setImages([]);
    } else {
      setText('');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (activeTab === 'text' && !text.trim()) {
      setError('Пожалуйста, введите текст рецепта.');
      return;
    }
     if (activeTab === 'image' && images.length === 0) {
      setError('Пожалуйста, загрузите изображение рецепта.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPostContent(null);
    setSheetStatus('idle');

    try {
      const result = await generatePostFromRecipe(
        activeTab === 'text' ? text : '',
        activeTab === 'image' ? images : []
      );
      setPostContent(result);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Произошла неизвестная ошибка.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFieldChange = (field: keyof PostContent, value: string) => {
    if (postContent) {
      setPostContent({
        ...postContent,
        [field]: value,
      });
    }
  };

  const handleSendToSheet = async () => {
    if (!postContent) return;
    
    setIsSendingToSheet(true);
    setSheetStatus('idle');
    setSheetError(null);

    const webhookUrl = "https://hook.eu2.make.com/jo52w67and9w23pahdk86vdbiaqtzfcd";
    const payload = {
      post_content: postContent
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}. ${errorText}`);
      }
      
      setSheetStatus('success');
    } catch (err) {
      setSheetStatus('error');
      setSheetError(err instanceof Error ? err.message : 'Не удалось отправить данные.');
    } finally {
      setIsSendingToSheet(false);
    }
  };


  return (
    <div className="bg-slate-50 min-h-screen font-sans text-slate-800">
      <main className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-emerald-700">
            Генератор постов
          </h1>
          <p className="text-slate-500 mt-2">
            для проекта «Вкусно. Просто. Полезно.»
          </p>
        </header>

        <div className="bg-white p-6 rounded-2xl shadow-lg mb-8">
          <form onSubmit={handleSubmit}>
            <div className="mb-6 border-b border-slate-200">
              <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                <button
                  type="button"
                  onClick={() => switchTab('text')}
                  className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'text'
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  Вставить текст
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('image')}
                  className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'image'
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  Загрузить скриншот
                </button>
              </nav>
            </div>
          
            <div className="space-y-6">
              {activeTab === 'text' && (
                <div>
                  <label htmlFor="recipe-text" className="block text-sm font-medium text-slate-700 mb-1">
                    Текст рецепта
                  </label>
                  <textarea
                    id="recipe-text"
                    rows={5}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Вставьте сюда текст рецепта."
                    className="w-full bg-white px-4 py-2 border border-slate-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition"
                  ></textarea>
                </div>
              )}
              
              {activeTab === 'image' && (
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">
                    Изображения рецепта
                  </label>
                  <label htmlFor="file-upload" className="cursor-pointer mt-2 flex justify-center items-center w-full px-6 py-10 border-2 border-slate-300 border-dashed rounded-lg text-slate-500 hover:bg-slate-100 hover:border-emerald-400 transition">
                     <div className="text-center">
                      <UploadIcon className="mx-auto h-12 w-12" />
                      <p className="mt-2">Перетащите файлы сюда или нажмите для выбора</p>
                      <p className="text-xs text-slate-400">PNG, JPG</p>
                      <input id="file-upload" name="file-upload" type="file" multiple className="sr-only" onChange={handleImageChange} accept="image/png, image/jpeg" />
                     </div>
                  </label>
                  {images.length > 0 && (
                    <div className="mt-4 text-sm text-slate-600">
                      <p className="font-semibold">Выбранные файлы:</p>
                      <ul className="list-disc list-inside">
                        {images.map((file, index) => (
                          <li key={index}>{file.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center bg-emerald-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Spinner />
                ) : (
                  <>
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    <span>Сгенерировать пост</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-lg min-h-[10rem] flex items-center justify-center">
          {isLoading && <Spinner />}
          {error && <div className="text-red-500 text-center">{error}</div>}
          {postContent && (
             <div className="w-full space-y-6">
                <div>
                  <label htmlFor="post-nomber" className="block text-sm font-medium text-slate-700 mb-1">Номер рецепта</label>
                  <input id="post-nomber" type="text" value={postContent.Номер} onChange={(e) => handleFieldChange('Номер', e.target.value)} className="w-full bg-white px-4 py-2 border border-slate-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition"/>
                </div>
                 <div>
                  <label htmlFor="post-title" className="block text-sm font-medium text-slate-700 mb-1">Заголовок</label>
                  <input id="post-title" type="text" value={postContent.Заголовок} onChange={(e) => handleFieldChange('Заголовок', e.target.value)} className="w-full bg-white px-4 py-2 border border-slate-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition"/>
                </div>
                <div>
                  <label htmlFor="post-recipe" className="block text-sm font-medium text-slate-700 mb-1">Рецепт</label>
                  <textarea id="post-recipe" rows={10} value={postContent.Рецепт} onChange={(e) => handleFieldChange('Рецепт', e.target.value)} className="w-full bg-white px-4 py-2 border border-slate-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition"></textarea>
                </div>
                <div>
                  <label htmlFor="post-advice" className="block text-sm font-medium text-slate-700 mb-1">Совет</label>
                  <textarea id="post-advice" rows={3} value={postContent.Совет} onChange={(e) => handleFieldChange('Совет', e.target.value)} className="w-full bg-white px-4 py-2 border border-slate-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition"></textarea>
                </div>
                <div>
                  <label htmlFor="post-kbju" className="block text-sm font-medium text-slate-700 mb-1">КБЖУ</label>
                  <input id="post-kbju" type="text" value={postContent.ДопИнфа} onChange={(e) => handleFieldChange('ДопИнфа', e.target.value)} className="w-full bg-white px-4 py-2 border border-slate-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition"/>
                </div>
                <div>
                  <label htmlFor="post-diets" className="block text-sm font-medium text-slate-700 mb-1">Показания</label>
                  <input id="post-diets" type="text" value={postContent.Диеты} onChange={(e) => handleFieldChange('Диеты', e.target.value)} className="w-full bg-white px-4 py-2 border border-slate-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition"/>
                </div>
                <div>
                  <label htmlFor="post-hashtags" className="block text-sm font-medium text-slate-700 mb-1">Хэштеги</label>
                  <textarea id="post-hashtags" rows={3} value={postContent.Хэштеги} onChange={(e) => handleFieldChange('Хэштеги', e.target.value)} className="w-full bg-white px-4 py-2 border border-slate-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition"></textarea>
                </div>
                 <div>
                  <label htmlFor="post-prompt" className="block text-sm font-medium text-slate-700 mb-1">Промпт для визуала</label>
                  <textarea id="post-prompt" rows={5} value={postContent.Промпт} onChange={(e) => handleFieldChange('Промпт', e.target.value)} className="w-full bg-white px-4 py-2 border border-slate-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition font-mono text-sm"></textarea>
                </div>

                <div className="pt-4 flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={handleSendToSheet}
                    disabled={isSendingToSheet}
                    className="flex-1 flex items-center justify-center bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSendingToSheet ? (
                      <Spinner />
                    ) : (
                      <>
                        <TableIcon className="h-5 w-5 mr-2" />
                        <span>Отправить в таблицу</span>
                      </>
                    )}
                  </button>
                   <div className="h-8">
                    {sheetStatus === 'success' && (
                        <div className="flex items-center text-green-600">
                            <CheckCircleIcon className="h-6 w-6 mr-2"/>
                            <span>Данные отправлены!</span>
                        </div>
                    )}
                     {sheetStatus === 'error' && (
                        <div className="flex items-center text-red-600">
                             <ExclamationCircleIcon className="h-6 w-6 mr-2"/>
                            <span>Ошибка: {sheetError}</span>
                        </div>
                    )}
                   </div>
                </div>
            </div>
          )}
           {!isLoading && !error && !postContent && (
             <div className="text-center text-slate-500">
               <SparklesIcon className="mx-auto h-12 w-12" />
               <p className="mt-2">Здесь появится результат генерации.</p>
             </div>
           )}
        </div>
      </main>
    </div>
  );
}

export default App;