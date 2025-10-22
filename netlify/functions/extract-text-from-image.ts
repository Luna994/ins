import { Handler } from "@netlify/functions";

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    const { image } = JSON.parse(event.body || "{}");

    if (!image) {
      return {
        statusCode: 400,
        body: "Missing image data in request body.",
      };
    }

    // Placeholder for OCR logic
    // In a real implementation, you would use an OCR library or API here.
    // For example, Google Cloud Vision API, Tesseract.js, etc.
    const extractedText = "Это пример текста, извлеченного из изображения. Здесь будет текст вашего рецепта.";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ extractedText }),
    };
  } catch (error) {
    console.error("Error extracting text from image:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to extract text from image." }),
    };
  }
};
