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
  const [extractedText, setExtractedText] = useState(''); // New state for extracted text
  const [postContent, setPostContent] = useState<PostContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtractingText, setIsExtractingText] = useState(false); // New state for OCR loading
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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Failed to get canvas context'));
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setImages([file]);
      setIsExtractingText(true);
      setError(null);
      setExtractedText('');

      try {
        const resizedImage = await resizeImage(file);
        const base64Image = resizedImage.split(',')[1]; // Send only base64 data

        const response = await fetch('/.netlify/functions/extract-text-from-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Image }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to extract text from image.');
        }

        const data = await response.json();
        setExtractedText(data.extractedText);
      } catch (err) {
        console.error('Error during OCR:', err);
        setError(err instanceof Error ? err.message : 'Произошла ошибка при извлечении текста.');
      } finally {
        setIsExtractingText(false);
      }
    }
  };

  const switchTab = (tab: 'text' | 'image') => {
    setActiveTab(tab);
    setError(null);
    setExtractedText(''); // Clear extracted text when switching tabs
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
     if (activeTab === 'image' && !extractedText.trim()) {
      setError('Пожалуйста, загрузите изображение или дождитесь извлечения текста.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPostContent(null);
    setSheetStatus('idle');

    try {
      const result = await generatePostFromRecipe(
        activeTab === 'text' ? text : extractedText,
        [] // Images are now processed by OCR function, so send empty array to generatePostFromRecipe
      );
      setPostContent(result);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('504')) {
          setError('Время ожидания ответа от сервера истекло. Это может случиться со сложными рецептами. Пожалуйста, попробуйте еще раз.');
        } else {
          setError(err.message);
        }
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
            Генератор постов-рецептов
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
                <div className="space-y-4">
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

                   {isExtractingText && (
                     <div className="flex justify-center items-center py-4">
                       <Spinner />
                       <p className="ml-2 text-slate-600">Извлечение текста...</p>
                     </div>
                   )}

                   {extractedText && (
                     <div>
                       <label htmlFor="extracted-recipe-text" className="block text-sm font-medium text-slate-700 mb-1">
                         Извлеченный текст рецепта (можно редактировать)
                       </label>
                       <textarea
                         id="extracted-recipe-text"
                         rows={5}
                         value={extractedText}
                         onChange={(e) => setExtractedText(e.target.value)}
                         placeholder="Извлеченный текст появится здесь."
                         className="w-full bg-white px-4 py-2 border border-slate-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition"
                       ></textarea>
                     </div>
                   )}
                </div>
              )}
            </div>

            <div className="mt-8">
              <button
                type="submit"
                disabled={isLoading || isExtractingText}
                className="w-full flex items-center justify-center bg-emerald-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed transition-colors"
              >
                {(isLoading || isExtractingText) ? (
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
          {(isLoading || isExtractingText) && <Spinner />}
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