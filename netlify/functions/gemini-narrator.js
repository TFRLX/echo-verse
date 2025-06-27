// netlify/functions/gemini-narrator.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Assurez-vous de configurer cette variable d'environnement dans Netlify
// Par exemple, via Netlify UI -> Site settings -> Build & deploy -> Environment variables
const API_KEY = process.env.GEMINI_API_KEY; 

// Si la clé n'est pas définie, cela pourrait indiquer une erreur de configuration
if (!API_KEY) {
    console.error("GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

exports.handler = async (event) => {
    // Seules les requêtes POST sont autorisées
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' }),
            headers: { 'Allow': 'POST' },
        };
    }

    try {
        const { type, prompt, action, character, currentStats, currentInventory, storyHistory } = JSON.parse(event.body);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        let chatHistory = [];
        let responsePayload = {};

        // Reconstruire l'historique du chat pour l'IA
        if (storyHistory && storyHistory.length > 0) {
            storyHistory.forEach(entry => {
                const parts = [];
                if (entry.action) {
                    parts.push({ text: `You did: "${entry.action}"` }); // Utiliser l'anglais pour le prompt interne de l'IA
                }
                parts.push({ text: entry.story });
                chatHistory.push({ role: "model", parts: parts });
            });
        }

        if (type === 'initialStory') {
            // Pour l'histoire initiale
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });
            const result = await model.generateContent({ contents: chatHistory });
            const response = await result.response;
            responsePayload = { story: response.text() };

        } else if (type === 'processAction') {
            // Pour le traitement d'une action
            const actionPrompt = `My character: ${JSON.stringify(character)}. Current stats: ${JSON.stringify(currentStats)}. Inventory: ${JSON.stringify(currentInventory)}. I want to: "${action}". Describe the continuation of the story taking my action into account and update the game state (health, energy, gold, inventory) as well as suggested quick actions in a structured JSON format.`;
            
            chatHistory.push({ role: "user", parts: [{ text: actionPrompt }] });

            const generationConfig = {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "story": { "type": "STRING" },
                        "gameStateUpdate": {
                            "type": "OBJECT",
                            "properties": {
                                "stats": {
                                    "type": "OBJECT",
                                    "properties": {
                                        "health": { "type": "NUMBER" },
                                        "energy": { "type": "NUMBER" },
                                        "gold": { "type": "NUMBER" }
                                    }
                                }
                                ,
                                "inventory": {
                                    "type": "ARRAY",
                                    "items": { "type": "STRING" }
                                }
                            }
                        },
                        "quickActions": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "text": { "type": "STRING" },
                                    "icon": { "type": "STRING" }
                                }
                            }
                        }
                    },
                    "required": ["story"]
                }
            };

            const result = await model.generateContent({ contents: chatHistory, generationConfig: generationConfig });
            const response = await result.response;
            const jsonResponse = JSON.parse(response.text());
            responsePayload = {
                story: jsonResponse.story,
                gameStateUpdate: jsonResponse.gameStateUpdate || {},
                quickActions: jsonResponse.quickActions || []
            };

        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Invalid request type' }),
            };
        }

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(responsePayload),
        };

    } catch (error) {
        console.error("Error in Netlify function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
        };
    }
};

