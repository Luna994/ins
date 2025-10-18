import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import type { Handler, HandlerEvent } from "@netlify/functions";

// Constants are included here to make the function self-contained.
const SYSTEM_PROMPT = `
# Роль: Ты — копирайтер и иллюстратор проекта «Вкусно. Просто. Полезно.»
Твоя задача — перерабатывать рецепт диетического питания из предоставленного текста или изображений (скриншотов из книги) в пост для Инстаграма.

# Главный принцип:
Используй только данные из предоставленных материалов. Не догадывайся и не выдумывай детали, за исключением КБЖУ, которое нужно рассчитать.

# Стиль и язык:
- Пиши простым, тёплым и спокойным языком.
- Избегай медицинских терминов и канцелярита. Вместо них используй мягкие формулировки: «если важно следить за сахаром», «для лёгкого рациона», «подходит тем, кто снижает нагрузку на ЖКТ», «вариант для тех, кто избегает жареного».
- НЕ упоминай номера диет в тексте рецепта.

# Структура рецепта:
- Раздели приготовление на 3–4 чётких шага.
- Добавь полезный совет или лайфхак.
- Упомяни пользу блюда и призови сохранить рецепт.

# Формат результата:
Твой ответ ДОЛЖЕН БЫТЬ строго в формате JSON, соответствующем предоставленной схеме. Не добавляй никаких приветствий, вступлений или markdown-форматирования (например, звездочек) в значения полей JSON.

# Описание полей JSON:
1.  **Номер**: Номер рецепта из источника.
2.  **Заголовок**: Название рецепта.
3.  **Рецепт**: Готовый текст поста, включающий ингредиенты и шаги приготовления. **Важно:** Каждый пункт в списках (ингредиенты, шаги приготовления) должен начинаться с новой строки. Используй \`\n\` для разделения пунктов.
4.  **Совет**: Совет или лайфхак по приготовлению.
5.  **ДопИнфа**: Рассчитанный КБЖУ на одну порцию. Ты ДОЛЖЕН рассчитать это значение на основе ингредиентов, предоставленных в рецепте. Ответ "по запросу" или любой другой уклончивый ответ недопустим. Если в источнике нет точных данных, сделай оценку на основе стандартных пищевых ценностей ингредиентов.
6.  **Диеты**: Номера диет и медицинские показания (например: "диеты: 5,8,1; «при диабете», «при заболеваниях ЖКТ», «при гипертонии»").
7.  **Промпт**: Промпт для генерации визуала. Формат 1080×1350 (4:5). Стиль — минимализм, дневной свет, уютная домашняя кухня, мягкие оттенки (белый, бежевый, серо-зелёный, оливковый). Блюдо крупным планом, с названием и подстрокой на изображении, написанными хорошо читаемым шрифтом.
8.  **Хэштеги**: Обязательные хэштеги: #ВкусноПростоПолезно #щадящеепитание #вкуснополезно, а также хэштег с номером диеты (например, #диета5).
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    post_content: {
      type: Type.OBJECT,
      properties: {
        Номер: { type: Type.STRING, description: "Номер рецепта из источника." },
        Заголовок: { type: Type.STRING, description: "Название рецепта." },
        Рецепт: { type: Type.STRING, description: "Готовый текст поста, включающий ингредиенты и шаги приготовления." },
        Совет: { type: Type.STRING, description: "Совет или лайфхак по приготовлению." },
        ДопИнфа: { type: Type.STRING, description: "Рассчитанный КБЖУ на одну порцию. Обязательно должен содержать числовые значения, а не текст 'по запросу'." },
        Диеты: { type: Type.STRING, description: "Номера диет и медицинские показания." },
        Промпт: { type: Type.STRING, description: "Промпт для генерации визуала для поста в инстаграм." },
        Хэштеги: { type: Type.STRING, description: "Хэштеги для поста." },
      },
      required: ["Номер", "Заголовок", "Рецепт", "Совет", "ДопИнфа", "Диеты", "Промпт", "Хэштеги"],
    },
  },
  required: ["post_content"],
};


const handler: Handler = async (event: HandlerEvent) => {
  const { API_KEY } = process.env;

  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API_KEY environment variable not set on the server." }),
    };
  }
  
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }
  
  try {
    if (!event.body) {
      throw new Error("Request body is missing.");
    }

    const { text, images } = JSON.parse(event.body);
    
    const model = 'gemini-2.5-flash';

    const imageParts = images.map((image: { mimeType: string; data: string; }) => ({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data,
      },
    }));

    const textPart = {
      text: `Вот текст и/или скриншот рецепта. Извлеки из него номер рецепта и все остальные данные для поста.\n\n${text}`,
    };
    
    const contentParts = [...imageParts, textPart];
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: { parts: contentParts },
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const jsonString = response.text;
    const parsedJson = JSON.parse(jsonString);

    if (parsedJson && parsedJson.post_content) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedJson.post_content),
      };
    } else {
      throw new Error("Invalid JSON structure in AI response.");
    }

  } catch (error) {
    console.error("Error in Netlify function:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Failed to generate post: ${errorMessage}` }),
    };
  }
};

export { handler };
