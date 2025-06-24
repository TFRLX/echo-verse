// netlify/functions/gemini-narrator.js

const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require('firebase-admin');

// Initialisation de Firebase Admin SDK.
// Les credentials proviennent de la variable d'environnement Netlify 'FIREBASE_SERVICE_ACCOUNT_KEY'
try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
        });
    }
} catch (error) {
    console.error("Erreur d'initialisation Firebase Admin:", error);
    // Retourner une erreur qui peut être gérée par Netlify
    // Attention: Ne pas bloquer l'exécution ici pendant le build, mais lors de l'appel de la fonction.
    // Pour le moment, nous allons juste logger l'erreur.
}

const db = admin.firestore();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY n'est pas définie dans les variables d'environnement Netlify.");
    // Le déploiement continuera, mais les appels à Gemini échoueront.
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Méthode non autorisée.' };
    }

    try {
        const { playerName, playerArchetype, gameMode, playerAction, isStart, sessionId } = JSON.parse(event.body);
        const sessionRef = db.collection('sessions').doc(sessionId);
        let currentStoryState;

        if (isStart) {
            currentStoryState = {
                playerName: playerName,
                playerArchetype: playerArchetype,
                gameMode: gameMode, // Conserver le mode de jeu dans l'état
                history: [],
                inventory: [],
                attributes: {
                    vigor: 80,
                    ingenuity: 70,
                    adaptation: 60,
                    influence: 50
                },
                location: "un endroit flou et indéfinissable au moment de la micro-fracture initiale",
                factionRelations: {
                    gardeChronique: { name: "La Garde Chronique", relation: 0 },
                    fluxLibres: { name: "Les Flux Libres", relation: 0 },
                    resonancesObscures: { name: "Les Résonances Obscures", relation: -100 }
                },
                npcsMet: [],
                activeQuests: [],
                majorWorldEvents: [],
            };
        } else {
            const doc = await sessionRef.get();
            if (!doc.exists) {
                 return { statusCode: 404, body: 'Session de jeu non trouvée. Veuillez recommencer une nouvelle partie.' };
            }
            currentStoryState = doc.data();
        }

        if (!isStart) {
            currentStoryState.history.push({ type: 'player', text: playerAction });
        }

        const prompt = buildGeminiPrompt(currentStoryState, playerAction, isStart);
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        const { narration, options, inventoryChanges, stateUpdates } = parseGeminiResponse(responseText);

        applyStateUpdates(currentStoryState, inventoryChanges, stateUpdates);

        currentStoryState.history.push({ type: 'gemini', text: narration });

        await sessionRef.set(currentStoryState);

        return {
            statusCode: 200,
            body: JSON.stringify({ narration, options, newState: currentStoryState }),
        };

    } catch (error) {
        console.error('Erreur dans la fonction Serverless:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erreur interne du serveur', details: error.message }),
        };
    }
};

// --- Fonctions Auxiliaires (buildGeminiPrompt, parseGeminiResponse, applyStateUpdates) ---

function buildGeminiPrompt(storyState, playerAction, isStart) {
    let historyContext = storyState.history.map(entry => {
        if (entry.type === 'player') return `Joueur: ${entry.text}`;
        return `Maître du Jeu: ${entry.text}`;
    }).join('\n');

    const historyLines = historyContext.split('\n');
    if (historyLines.length > 20) {
        historyContext = historyLines.slice(historyLines.length - 20).join('\n');
    }

    const currentInventoryNames = storyState.inventory.map(item => `${item.name} (${item.description})`).join(', ') || 'aucun objet';
    const factionRelationsList = Object.values(storyState.factionRelations).map(f => `${f.name}: ${f.relation}`).join(', ');
    const npcsList = storyState.npcsMet.map(n => `${n.name} (${n.relation}, dernière interaction: ${n.lastInteraction})`).join(', ') || 'aucun PNJ rencontré';
    const questsList = storyState.activeQuests.map(q => `${q.name} (Statut: ${q.status})`).join(', ') || 'aucune quête active';
    const eventsList = storyState.majorWorldEvents.map(e => e.description).join(', ') || 'aucun événement majeur';

    let prompt = `Tu es le Maître du Jeu (MJ) pour une aventure interactive dans l'univers d'Echo Verse.

