import { PostContent } from '../types';

// Converts a file to a base64 string with its MIME type, ready for JSON transport.
const fileToBase64 = (file: File): Promise<{ mimeType: string, data: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const result = reader.result as string;
        resolve({
            mimeType: file.type,
            data: result.split(',')[1]
        });
    };
    reader.onerror = (error) => reject(error);
  });
};

export const generatePostFromRecipe = async (
  text: string,
  images: File[]
): Promise<PostContent> => {
  
  // Prepare image data to be sent as JSON to our backend function.
  const imagePayloads = await Promise.all(
    images.map(fileToBase64)
  );

  try {
    // The endpoint for our Netlify function.
    const response = await fetch('/.netlify/functions/generate-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        images: imagePayloads,
      }),
    });
    
    const responseBody = await response.text(); // Read body once as text

    if (!response.ok) {
      let errorMessage = `Server responded with status ${response.status}`;
      try {
        const errorData = JSON.parse(responseBody); // Parse the already read text
        errorMessage = errorData.error || `${errorMessage}: ${responseBody}`;
      } catch (e) {
        if (responseBody) {
          errorMessage = `${errorMessage}: ${responseBody}`;
        } else {
          errorMessage = `${errorMessage} and an empty response body. This could be a timeout.`;
        }
      }
      throw new Error(errorMessage);
    }

    // If the response was successful, parse the already read text as JSON.
    const data: PostContent = JSON.parse(responseBody);
    return data;

  } catch (error) {
    console.error("Error calling Netlify function:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate post: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the post.");
  }
};