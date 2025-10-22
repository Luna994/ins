import { GoogleGenAI } from "@google/genai";
import type { Handler, HandlerEvent } from "@netlify/functions";

const handler: Handler = async (event: HandlerEvent) => {
  const { API_KEY } = process.env;

  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API_KEY environment variable not set." }),
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    if (!event.body) {
      throw new Error("Request body is missing.");
    }

    const { image } = JSON.parse(event.body);
    if (!image) {
      throw new Error("Image data is missing from the request.");
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const model = 'gemini-pro-vision';
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg', // Assuming JPEG, adjust if other types are expected
        data: image,
      },
    };
    const textPart = {
      text: "Извлеки весь текст, который видишь на изображении. Не добавляй ничего от себя, только текст с картинки.",
    };

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [textPart, imagePart] }
    });

    const extractedText = response.text;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extractedText }),
    };
  } catch (error) {
    console.error("Error extracting text from image:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Failed to extract text: ${errorMessage}` }),
    };
  }
};

export { handler };
