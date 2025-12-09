
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } from "@google/genai";
import type { AspectRatio } from '../types';

const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
];

export const validateApiKey = async (apiKey: string): Promise<boolean> => {
    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });
        await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: "Test" }] },
            config: {
                maxOutputTokens: 1,
            }
        });
        return true;
    } catch (error) {
        console.error("API Key Validation Failed:", error);
        return false;
    }
};

export const generateImage = async (
    ai: GoogleGenAI, 
    prompt: string, 
    model: string, 
    aspectRatio?: AspectRatio
): Promise<string> => {
    try {
        if (model.includes('gemini') || model.includes('flash') || model.includes('pro-image')) {
            // OPTIMIZATION: Removed systemInstruction. 
            // Sending system instructions to image models increases processing load and can lead to 503 errors 
            // or unexpected text responses instead of images.
            const response = await ai.models.generateContent({
                model: model,
                contents: { parts: [{ text: prompt }] },
                config: {
                    ...(aspectRatio && { 
                        imageConfig: { 
                            aspectRatio: aspectRatio,
                            // REMOVED explicit imageSize constraint. Let the model decide the best resolution.
                        } 
                    }),
                    safetySettings,
                },
            });

            const candidate = response.candidates?.[0];
            
            // Check for Safety Block explicitly
            if (candidate?.finishReason === 'SAFETY') {
                throw new Error("SAFETY_BLOCK: The request was blocked by safety filters.");
            }
            if (candidate?.finishReason === 'PROHIBITED_CONTENT') {
                throw new Error("PROHIBITED_CONTENT: The request was blocked because it contains prohibited content.");
            }
            if (candidate?.finishReason === 'BLOCKLIST') {
                throw new Error("BLOCKLIST: The request was blocked by blocklist.");
            }
            if (candidate?.finishReason === 'RECITATION') {
                 throw new Error("RECITATION: The request was blocked due to recitation.");
            }

            if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData) {
                        return part.inlineData.data;
                    }
                }
            }
             console.error("API response did not contain an image. Full response:", JSON.stringify(response, null, 2));
             throw new Error("No image generated. The model might have returned text instead of an image, or the content was filtered.");

        } else {
            // Imagen models don't support systemInstruction in the same way, so we enhance the prompt.
            const enhancedPrompt = `${prompt} . Photorealistic, 8k, highly detailed, professional photography, natural lighting.`;
            
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: enhancedPrompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/png',
                    ...(aspectRatio && { aspectRatio: aspectRatio }),
                },
            });

            const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;

            if (imageBytes) {
                return imageBytes;
            } else {
                console.error("API response did not contain an image or was blocked. Full response:", JSON.stringify(response, null, 2));
                throw new Error("No images were generated. This might be due to safety filters.");
            }
        }
    } catch (error) {
        console.error("Error calling Gemini API for image generation:", error);
        throw error;
    }
};

export const editImage = async (
    ai: GoogleGenAI, 
    prompt: string, 
    images: { mimeType: string; base64Data: string }[], 
    model: string,
    maskPart?: { mimeType: string; base64Data: string },
    aspectRatio: string = '1:1'
): Promise<string> => {
    try {
        const parts: any[] = [];
        
        // Add prompt first
        parts.push({ text: prompt });

        // Add source images
        images.forEach(image => {
            parts.push({
                inlineData: {
                    mimeType: image.mimeType,
                    data: image.base64Data,
                },
            });
        });

        // Add mask if available (Correctly mapped from App.tsx)
        if (maskPart) {
            parts.push({
                inlineData: {
                    mimeType: maskPart.mimeType,
                    data: maskPart.base64Data,
                }
            });
        }

        // OPTIMIZATION: Removed systemInstruction for editing as well.
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts },
            config: {
                ...(aspectRatio && { 
                    imageConfig: { 
                        aspectRatio: aspectRatio,
                        // REMOVED explicit imageSize constraint. Let the model decide the best resolution.
                    } 
                }),
                safetySettings,
            },
        });
        
        const candidate = response.candidates?.[0];

        // Check for Safety Block explicitly
        if (candidate?.finishReason === 'SAFETY') {
            throw new Error("SAFETY_BLOCK: The request was blocked by safety filters.");
        }
        if (candidate?.finishReason === 'PROHIBITED_CONTENT') {
            throw new Error("PROHIBITED_CONTENT: The request was blocked because it contains prohibited content.");
        }
        if (candidate?.finishReason === 'BLOCKLIST') {
            throw new Error("BLOCKLIST: The request was blocked by blocklist.");
        }
        if (candidate?.finishReason === 'RECITATION') {
             throw new Error("RECITATION: The request was blocked due to recitation.");
        }

        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    return part.inlineData.data;
                }
            }
        }
        
        console.error("API response did not contain an image or was blocked. Full response:", JSON.stringify(response, null, 2));
        throw new Error("No edited image was returned from the API. The model might have been blocked or returned text.");

    } catch (error) {
        console.error("Error calling Gemini API for image editing:", error);
        throw error;
    }
};

export const parsePromptForEntities = async (
  ai: GoogleGenAI,
  prompt: string,
  characterNames: string[],
  backgroundNames: string[]
): Promise<{ characterName: string | null; backgroundName: string | null; }> => {
  if (characterNames.length === 0 || backgroundNames.length === 0) {
    return { characterName: null, backgroundName: null };
  }

  try {
    const systemInstruction = `You are an expert entity extractor. Your task is to analyze the user's prompt and identify one character and one background from the provided lists.
- You must only use names present in the lists.
- If a suitable name is found, return it.
- If no suitable name is found in the prompt for an entity, or if the found name is not in the list, you must return null for that entity.
- Your response must be in JSON format, strictly adhering to the provided schema.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `User Prompt: "${prompt}"\n\nCharacter List: [${characterNames.join(', ')}]\nBackground List: [${backgroundNames.join(', ')}]`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            characterName: {
              type: Type.STRING,
              description: 'The name of the character found in the prompt that exists in the character list. If not found, must be null.',
            },
            backgroundName: {
              type: Type.STRING,
              description: 'The name of the background found in the prompt that exists in the background list. If not found, must be null.',
            },
          },
        },
        safetySettings,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
        return { characterName: null, backgroundName: null };
    }

    const parsed = JSON.parse(jsonText);
    
    const validCharName = parsed.characterName && characterNames.includes(parsed.characterName) ? parsed.characterName : null;
    const validBgName = parsed.backgroundName && backgroundNames.includes(parsed.backgroundName) ? parsed.backgroundName : null;
    
    return { characterName: validCharName, backgroundName: validBgName };

  } catch (error) {
    console.error("Error calling Gemini API for prompt parsing:", error);
    return { characterName: null, backgroundName: null };
  }
};

export const generateVideo = async (
    _ai: GoogleGenAI, 
    prompt: string,
    image: { mimeType: string; base64Data: string },
    aspectRatio: '16:9' | '9:16' = '9:16',
    apiKey: string,
    modelName: string = 'veo-3.1-generate-preview'
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: apiKey, apiVersion: 'v1beta' });
    
    let operation = null;
    
    try {
        operation = await ai.models.generateVideos({
            model: modelName,
            prompt: prompt,
            image: {
                imageBytes: image.base64Data,
                mimeType: image.mimeType,
            },
            config: {
                numberOfVideos: 1,
                aspectRatio: aspectRatio, 
            }
        });
    } catch (error: any) {
        console.error(`Initial video generation failed:`, error);
        throw error;
    }

    if (!operation) {
        throw new Error("Failed to start video generation.");
    }

    try {
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 20000));
            
            let pollRetryCount = 0;
            const maxPollRetries = 3;
            
            while (pollRetryCount < maxPollRetries) {
                try {
                    operation = await ai.operations.getVideosOperation({ operation: operation });
                    break;
                } catch (pollError: any) {
                    const msg = pollError.message || JSON.stringify(pollError);
                    if ((msg.includes('503') || msg.includes("UNAVAILABLE")) && pollRetryCount < maxPollRetries - 1) {
                         pollRetryCount++;
                         console.log(`Polling failed, retrying (${pollRetryCount}/${maxPollRetries})...`);
                         await new Promise(r => setTimeout(r, 5000));
                         continue;
                    }
                    throw pollError;
                }
            }
        }
    } catch (error) {
         console.error("Video polling failed:", error);
         throw error;
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
         throw new Error("Video generation completed but no download link found.");
    }
    
    // Fetch the video bytes using the API Key
    const response = await fetch(`${downloadLink}&key=${apiKey}`);
    if (!response.ok) {
        throw new Error(`Failed to download generated video. Status: ${response.status}`);
    }
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);
};
