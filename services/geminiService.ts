import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { PostContent } from '../types';
import { SYSTEM_PROMPT, RESPONSE_SCHEMA } from '../constants';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

export const generatePostFromRecipe = async (
  text: string,
  images: File[]
): Promise<PostContent> => {
  const model = 'gemini-2.5-flash';

  const imageParts = await Promise.all(
    images.map(async (image) => {
      const base64Data = await fileToBase64(image);
      return {
        inlineData: {
          mimeType: image.type,
          data: base64Data,
        },
      };
    })
  );

  const textPart = {
    text: `Вот текст и/или скриншот рецепта. Извлеки из него номер рецепта и все остальные данные для поста.\n\n${text}`,
  };
  
  const contentParts = [...imageParts, textPart];
  
  try {
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
      return parsedJson.post_content as PostContent;
    } else {
      throw new Error("Invalid JSON structure in AI response.");
    }
  } catch (error) {
    console.error("Error generating content:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate post: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the post.");
  }
};