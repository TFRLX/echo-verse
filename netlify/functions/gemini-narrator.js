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

**Règles Générales du MJ :**

* **Réactivité :** Réagis directement à l'action du joueur en tenant compte de tout l'état de l'aventure.
* **Conséquences :** Chaque action a des conséquences directes ou différées.
* **Tests d'Attributs :** Si une action est risquée, simule la réussite/l'échec en te basant sur les attributs du joueur.
* **Dynamisme du Monde :** L'univers doit être vivant et réactif aux actions du joueur et aux événements globaux.
* **Format Strict :** Utilise toujours le format de sortie demandé.

**État Actuel de l'Aventure :**

* Nom du Joueur : ${storyState.playerName}
* Archétype du Joueur : ${storyState.playerArchetype}
* Mode de Jeu : ${storyState.gameMode}
* Attributs du Joueur : Vigueur ${storyState.attributes.vigor}, Ingéniosité ${storyState.attributes.ingenuity}, Adaptation ${storyState.attributes.adaptation}, Influence ${storyState.attributes.influence}.
* Lieu Actuel : ${storyState.location}
* Inventaire du Joueur : ${currentInventoryNames}
* Relations Factionnelles : ${factionRelationsList}
* PNJ Rencontrés et Relations : ${npcsList}
* Quêtes Actives : ${questsList}
* Événements Mondiaux Majeurs : ${eventsList}
* Historique des Interactions Récentes :
${historyContext}

**Action Récente du Joueur :** "${playerAction}"

**Directives Spécifiques au Mode de Jeu "${storyState.gameMode}" :**
`;

    switch (storyState.gameMode) {
        case "Echo de la Fracture":
            prompt += `
**Contexte :** La Grande Fracture a fusionné des réalités. Attendez-vous à l'imprévisible : anomalies temporelles, créatures mutées, et les factions en guerre. C'est un mélange de science-fiction, de fantastique et de survie.
**Ton :** Épique, mystérieux, parfois sombre.
**Défis :** Combats, survie en milieu hostile, exploration d'anomalies, interactions avec les factions (Garde Chronique, Flux Libres, Résonances Obscures).
**Attributs :** Vigueur pour les combats/efforts physiques. Ingéniosité pour comprendre les anomalies/technologies. Adaptation pour la survie et la discrétion. Influence pour les interactions avec PNJ/factions.
`;
            break;
        case "Chronique Urbaine Fracturée":
            prompt += `
**Contexte :** L'Echo Verse a envahi des villes modernes. Métropoles où les gratte-ciel côtoient ruines antiques ou vaisseaux spatiaux. Thriller cyberpunk teinté de surnaturel ou drame de survie urbaine.
**Ton :** Sombre, nerveux, mystérieux, urbain.
**Défis :** Enquêtes, infiltrations, survie dans un environnement corrompu, confrontations avec gangs/corporations/entités cachées.
**Attributs :** Ingéniosité pour la technologie/résolution d'énigmes. Adaptation pour la furtivité urbaine. Influence pour les interactions sociales/négociations. Vigueur pour les affrontements sporadiques.
`;
            break;
        case "Frontière Sauvage Fracturée":
            prompt += `
**Contexte :** Explorez des étendues sauvages déchirées par la Fracture : forêts spectrales, déserts cristallins, océans de brume éthérée. Mode axé sur l'exploration et la survie.
**Ton :** Aventureux, contemplatif, parfois dangereux.
**Défis :** Recherche de ressources, gestion de la météo, créatures primitives/mutées, découverte de ruines isolées, rencontres avec petites communautés.
**Attributs :** Adaptation pour la survie et la navigation. Vigueur pour les longs trajets. Ingéniosité pour la fabrication/l'interprétation des signes.
`;
            break;
        case "Récit de Vie / Drame Personnel":
            prompt += `
**Contexte :** Un monde réaliste contemporain. Pas de magie, pas de monstres, pas de fracture temporelle. Les défis sont humains : relations, travail, émotions, dilemmes personnels.
**Ton :** Réaliste, émotionnel, psychologique, intime.
**Défis :** Interactions sociales, résolution de conflits personnels, objectifs de carrière, gestion des émotions.
**Attributs :** Influence pour les dialogues et relations. Adaptation pour gérer le stress/les imprévus. Ingéniosité pour les solutions créatives aux problèmes. Vigueur pour l'énergie quotidienne.
**Note :** Les factions sont des groupes sociaux (famille, amis, collègues), les PNJ sont des personnes normales, les quêtes sont des objectifs de vie, les événements mondiaux sont des actualités/événements locaux.
`;
            break;
        case "Romance Inattendue":
            prompt += `
**Contexte :** Un monde réaliste contemporain. L'histoire est centrée sur le développement d'une relation amoureuse.
**Ton :** Romantique, léger, passionné, parfois dramatique.
**Défis :** Gérer les sentiments, les malentendus, les rendez-vous, les interactions avec les proches des partenaires, les décisions de couple.
**Attributs :** Influence pour la séduction/communication. Adaptation pour gérer les imprévus relationnels. Ingéniosité pour les idées de rendez-vous/solutions aux problèmes.
**Note :** Focus sur les PNJ liés à la romance (le partenaire potentiel, ses amis, sa famille).
`;
            break;
        case "Tour du Monde à Ma Manière":
            prompt += `
**Contexte :** Un monde réaliste contemporain. Le joueur voyage autour du globe.
**Ton :** Aventureux, découverte, parfois humoristique ou contemplatif.
**Défis :** Logistique de voyage (transports, visas, budget), rencontres culturelles, situations inattendues à l'étranger, survie légère.
**Attributs :** Adaptation pour les nouvelles cultures/situations. Vigueur pour l'endurance physique du voyage. Ingéniosité pour résoudre les problèmes de voyage. Influence pour interagir avec les locaux.
**Note :** Le "Lieu" doit décrire des villes, pays, monuments. L'inventaire peut inclure des objets de voyage.
`;
            break;
        case "Enquête Mystérieuse":
            prompt += `
**Contexte :** Un monde réaliste ou légèrement fantastique, axé sur la résolution d'une enquête. Crime, disparition, secret.
**Ton :** Suspens, déduction, atmosphère sombre ou intrigante.
**Défis :** Rassembler des indices, interroger des suspects/témoins, analyser des preuves, faire des déductions, démasquer des coupables.
**Attributs :** Ingéniosité pour l'analyse et la logique. Influence pour les interrogatoires. Adaptation pour les situations dangereuses.
**Note :** PNJ sont des suspects, témoins, victimes. Les quêtes sont les étapes de l'enquête. L'inventaire contient les preuves.
`;
            break;
        case "Le Pacte de l'Ombre":
            prompt += `
**Contexte :** Un environnement où l'horreur psychologique prédomine. Le surnaturel peut être réel ou perçu. Le danger est souvent interne ou suggéré.
**Ton :** Horreur, oppressant, psychologique, angoissant, mystérieux.
**Défis :** Gérer la peur, la santé mentale, le doute, résoudre des énigmes macabres, survivre à des rencontres effrayantes sans nécessairement combattre.
**Attributs :** Adaptation pour résister au stress/à la folie. Ingéniosité pour comprendre les rituels/phénomènes. Vigueur pour fuir.
**Note :** Le "Lieu" est souvent isolé ou hanté. Les "Événements Mondiaux" peuvent être des phénomènes paranormaux croissants.
`;
            break;
        case "Gestionnaire de Micro-Monde":
            prompt += `
**Contexte :** Un monde réaliste. Le joueur gère une petite entité (entreprise, ferme, communauté, magasin).
**Ton :** Stratégique, économique, axé sur les défis quotidiens de gestion.
**Défis :** Gestion des ressources (financières, humaines), prise de décisions stratégiques, événements aléatoires impactant la gestion, équilibrer les besoins des personnages/employés.
**Attributs :** Ingéniosité pour la stratégie et la planification. Influence pour le leadership et la négociation. Adaptation pour gérer les crises.
**Note :** Les "factions" sont des concurrents, des fournisseurs, des syndicats. Les "PNJ" sont des employés, des clients. L'inventaire sont des ressources ou produits.
`;
            break;
        case "Odyssée Stellaire Fracturée":
            prompt += `
**Contexte :** La Fracture a étendu son influence aux confins de l'espace. Voyagez entre des planètes altérées, des stations spatiales à la dérive et des anomalies cosmiques. Science-fiction épique avec des touches de fantastique.
**Ton :** Grandiose, aventureux, parfois claustrophobe ou existentiel.
**Défis :** Exploration de l'espace, diplomatie inter-espèces, combats spatiaux, survie dans des environnements extraterrestres, découverte de secrets anciens.
**Attributs :** Ingéniosité pour la navigation et la technologie spatiale. Adaptation pour les environnements à gravité zéro ou les contacts alien. Influence pour les négociations avec des empires galactiques. Vigueur pour les missions d'abordage.
`;
            break;
        case "Apocalypse Temporelle":
            prompt += `
**Contexte :** Le temps lui-même est fracturé. Le passé, le présent et le futur se mélangent, créant des anachronismes et des dangers imprévus. Chaque pas peut vous faire sauter dans une autre époque.
**Ton :** Désorientant, urgent, post-apocalyptique.
**Défis :** Naviguer à travers des époques instables, survivre aux paradoxes temporels, réparer le flux temporel ou s'adapter à une nouvelle chronologie.
**Attributs :** Adaptation pour les changements soudains d'environnement. Ingéniosité pour comprendre les anomalies temporelles.
`;
            break;
        case "Carrière Ambitieuse":
            prompt += `
**Contexte :** Le monde moderne, l'ascension sociale et professionnelle.
**Ton :** Compétitif, stratégique, parfois cynique.
**Défis :** Négociations, intrigues de bureau, gestion de projet, équilibre vie pro/vie perso, atteindre des objectifs ambitieux.
**Attributs :** Influence pour le réseautage et la persuasion. Ingéniosité pour la stratégie et la résolution de problèmes complexes.
`;
            break;
        case "Défis Familiaux":
            prompt += `
**Contexte :** La vie quotidienne, mais les relations familiales sont au cœur des enjeux.
**Ton :** Dramatique, intime, chaleureux, parfois conflictuel.
**Défis :** Résoudre des disputes, gérer des héritages, soutenir des proches, organiser des événements familiaux, faire face à des secrets.
**Attributs :** Influence pour la médiation et la communication. Adaptation pour les changements au sein de la famille.
`;
            break;
        case "Survie en Milieu Hostile":
            prompt += `
**Contexte :** Un environnement naturel sauvage et impitoyable, sans éléments surnaturels.
**Ton :** Tendu, réaliste, aventureux.
**Défis :** Trouver de la nourriture, de l'eau, un abri, éviter les prédateurs, s'orienter, gérer les blessures et la maladie.
**Attributs :** Vigueur pour la résistance physique. Adaptation pour les compétences de survie et la résilience. Ingéniosité pour la fabrication d'outils et la chasse.
`;
            break;
        case "Course Contre la Montre":
            prompt += `
**Contexte :** Une situation urgente où chaque action doit être rapide et efficace. Une bombe à désamorcer, une personne à sauver avant qu'il ne soit trop tard.
**Ton :** Pressant, intense, nerveux, plein d'adrénaline.
**Défis :** Prendre des décisions rapides, effectuer des tâches sous pression, gérer des contraintes de temps strictes, faire face à des échecs ayant des conséquences immédiates.
**Attributs :** Adaptation pour la gestion du stress et la rapidité d'exécution. Ingéniosité pour trouver des solutions créatives sous contrainte.
`;
            break;
        case "Légendes Oubliées":
            prompt += `
**Contexte :** Un monde de pure fantasy, inspiré par les mythes et les contes de fées. Magie, créatures mythiques, royaumes anciens.
**Ton :** Épique, merveilleux, parfois sombre et dangereux.
**Défis :** Combattre des bêtes fantastiques, explorer des ruines elfiques, maîtriser la magie, interagir avec des créatures mythologiques, accomplir des prophéties.
**Attributs :** Vigueur pour le combat. Ingéniosité pour les énigmes magiques. Influence pour les interactions avec des rois, sorciers ou créatures.
`;
            break;
        case "Chroniques Vampiriques":
            prompt += `
**Contexte :** Un monde où les vampires existent et où les intrigues de pouvoir et les drames personnels sont monnaie courante dans l'ombre. Ambiance gothique et romantique.
**Ton :** Romantique, sombre, séduisant, dangereux.
**Défis :** Gérer la faim, éviter les chasseurs, s'impliquer dans la politique vampirique, former des alliances, maintenir le secret.
**Attributs :** Influence pour la manipulation et la séduction. Adaptation pour la discrétion et la survie nocturne.
`;
            break;
        case "Quête des Dieux Anciens":
            prompt += `
**Contexte :** La mythologie prend vie. Les dieux de panthéons oubliés ou nouveaux interviennent directement dans le monde, demandant des faveurs ou déclenchant leur colère.
**Ton :** Épique, divin, dramatique.
**Défis :** Accomplir des épreuves divines, intercéder entre les dieux, retrouver des artefacts sacrés, affronter des créatures mythologiques colossales.
**Attributs :** Influence pour interagir avec les dieux et leurs prêtres. Vigueur pour les défis héroïques. Ingéniosité pour comprendre les énigmes divines.
`;
            break;
        case "Conspiration Mondiale":
            prompt += `
**Contexte :** Un thriller d'espionnage moderne où des organisations secrètes tirent les ficelles du monde.
**Ton :** Paranoïaque, haletant, stratégique.
**Défis :** Infiltrer des bases ennemies, récupérer des informations classifiées, démasquer des agents doubles, échapper à la capture, déjouer des complots à l'échelle mondiale.
**Attributs :** Ingéniosité pour la technologie et le piratage. Adaptation pour l'infiltration et l'évasion. Influence pour le renseignement et la manipulation.
`;
            break;
        case "Agent Double":
            prompt += `
**Contexte :** Le joueur est un agent travaillant pour deux factions opposées.
**Ton :** Tendu, moralement ambigu, stratégique.
**Défis :** Maintenir sa couverture, mentir et manipuler les deux camps, choisir des loyautés, gérer les risques de détection, prendre des décisions difficiles avec des conséquences.
**Attributs :** Influence pour la tromperie et la négociation. Adaptation pour gérer le stress et les situations imprévues. Ingéniosité pour la planification complexe.
`;
            break;
        default: // Fallback si le mode n'est pas reconnu (ou pour le mode par défaut si non géré ailleurs)
            prompt += `
**Contexte :** Tu es dans un univers généraliste, sans règles spécifiques. Concentre-toi sur une narration cohérente basée sur l'action du joueur.
**Ton :** Neutre, adaptable.
**Défis :** Basés sur l'action libre du joueur.
`;
    }

    prompt += `
**Ta Tâche Finale :**

1.  **Décrire la suite de l'histoire (2-4 paragraphes) :**
    * Réponds directement à l'action du joueur en tenant compte de tous les éléments de l'état actuel et des directives du mode de jeu.
    * Décris l'environnement, les PNJ, les menaces qui réagissent à l'action.
    * Ajoute du suspense, de l'enjeu, de la découverte ou des obstacles.
    * Si l'action implique un test d'attribut (ex: forcer une porte), décris la réussite ou l'échec.

2.  **Mettre à jour l'État du Monde :** Si des changements majeurs surviennent (nouveau lieu, nouvel objet trouvé, perte d'objet, PNJ disparu, changement de relation de faction/PNJ, changement d'attribut), indique-le clairement via la section \`STATE_UPDATE\`. Pour les attributs, tu peux utiliser \`+X\` ou \`-X\` ou une nouvelle valeur absolue.

3.  **Proposer 3 Options d'Action Concrètes OU Indiquer une Action Libre :**
    * Les options doivent être logiques, refléter le déroulement de l'histoire et les possibilités offertes par l'environnement/les PNJ.
    * Si la situation est très ouverte et que plusieurs approches sont possibles, laisse la section \`OPTIONS\` vide pour une action libre.

4.  **Mettre à jour l'Inventaire :** Si le joueur gagne, perd ou modifie un objet, utilise la section \`INVENTAIRE_CHANGES\`.

**Format de Réponse Strictement Obligatoire :**
\`\`\`
NARRATION: Votre texte narratif ici. Utilisez des balises <br> pour les sauts de ligne.
OPTIONS: Option 1 | Option 2 | Option 3 (Laissez vide pour une action libre)
INVENTAIRE_CHANGES: \[ADD: Nom Nouvel Objet, Description Courte\] | \[REMOVE: Nom Objet à Retirer\] (Optionnel, ne listez que les changements)
STATE_UPDATE:
Lieu: Nouvelle description du lieu si changé
Vigueur: \[Nouvelle valeur si changée, ex: -5 pour des dégâts, +10 pour un soin, ou une valeur absolue\]
Ingéniosité: \[Nouvelle valeur si changée\]
Adaptation: \[Nouvelle valeur si changée\]
Influence: \[Nouvelle valeur si changée\]
Garde Chronique Relation: \[Nouvelle relation numérique ou textuelle, ex: +10, -5, "Amical"\]
Flux Libres Relation: \[Nouvelle relation numérique ou textuelle\]
Résonances Obscures Relation: \[Nouvelle relation numérique ou textuelle\]
PNJ Rencontrés: \[ADD: Nom PNJ, Relation, Dernière Interaction\] | \[UPDATE: Nom PNJ, Nouvelle Relation/Dernière Interaction\] | \[REMOVE: Nom PNJ\]
Quêtes Actives: \[ADD: ID, Nom, Statut, Détails\] | \[UPDATE: ID, Statut\] | \[REMOVE: ID\]
Événements Mondiaux Majeurs: \[ADD: ID, Description\] | \[REMOVE: ID\]
\`\`\`
`;
    return prompt;
}

function parseGeminiResponse(responseText) {
    const narrationMatch = responseText.match(/NARRATION: ([\s\S]*?)(?=OPTIONS:|$|INVENTAIRE_CHANGES:|STATE_UPDATE:)/i);
    const optionsMatch = responseText.match(/OPTIONS: (.*)/i);
    const inventoryChangesMatch = responseText.match(/INVENTAIRE_CHANGES: (.*)/i);
    const stateUpdateMatch = responseText.match(/STATE_UPDATE:\n([\s\S]*)/i);

    let narration = narrationMatch ? narrationMatch[1].trim() : "Erreur de narration.";
    let options = optionsMatch && optionsMatch[1].trim() ? optionsMatch[1].split('|').map(o => o.trim()) : [];
    let inventoryChanges = [];
    if (inventoryChangesMatch && inventoryChangesMatch[1].trim()) {
        inventoryChangesMatch[1].split('|').forEach(changeStr => {
            changeStr = changeStr.trim();
            if (changeStr.startsWith('[ADD:')) {
                const parts = changeStr.substring(5, changeStr.length - 1).split(',').map(p => p.trim());
                if (parts.length >= 2) inventoryChanges.push({ type: 'ADD', name: parts[0], description: parts.slice(1).join(', ') });
            } else if (changeStr.startsWith('[REMOVE:')) {
                const name = changeStr.substring(9, changeStr.length - 1).trim();
                inventoryChanges.push({ type: 'REMOVE', name: name });
            }
        });
    }

    let stateUpdates = {};
    if (stateUpdateMatch && stateUpdateMatch[1].trim()) {
        const lines = stateUpdateMatch[1].trim().split('\n');
        lines.forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                let value = parts.slice(1).join(':').trim();

                if (['Vigueur', 'Ingéniosité', 'Adaptation', 'Influence'].includes(key)) {
                    if (value.startsWith('+') || value.startsWith('-')) {
                        stateUpdates[key.toLowerCase()] = { change: parseInt(value) };
                    } else {
                        stateUpdates[key.toLowerCase()] = parseInt(value);
                    }
                } else if (key.endsWith('Relation')) {
                    const factionNameKey = key.replace(' Relation', '');
                    const normalizedFactionName = factionNameKey.charAt(0).toLowerCase() + factionNameKey.slice(1);
                    stateUpdates.factionRelations = stateUpdates.factionRelations || {};
                    stateUpdates.factionRelations[normalizedFactionName] = isNaN(parseInt(value)) ? value : parseInt(value);
                } else if (key === 'PNJ Rencontrés') {
                    stateUpdates.npcsMet = stateUpdates.npcsMet || [];
                    value.split('|').forEach(npcChange => {
                        npcChange = npcChange.trim();
                        if (npcChange.startsWith('[ADD:')) {
                            const npcParts = npcChange.substring(5, npcChange.length - 1).split(',').map(p => p.trim());
                            if (npcParts.length >= 3) stateUpdates.npcsMet.push({ type: 'ADD', name: npcParts[0], relation: npcParts[1], lastInteraction: npcParts[2] });
                        } else if (npcChange.startsWith('[UPDATE:')) {
                            const npcParts = npcChange.substring(9, npcChange.length - 1).split(',').map(p => p.trim());
                            if (npcParts.length >= 3) stateUpdates.npcsMet.push({ type: 'UPDATE', name: npcParts[0], relation: npcParts[1], lastInteraction: npcParts[2] });
                        } else if (npcChange.startsWith('[REMOVE:')) {
                            const name = npcChange.substring(9, npcChange.length - 1).trim();
                            stateUpdates.npcsMet.push({ type: 'REMOVE', name: name });
                        }
                    });
                } else if (key === 'Quêtes Actives') {
                    stateUpdates.activeQuests = stateUpdates.activeQuests || [];
                    value.split('|').forEach(questChange => {
                        questChange = questChange.trim();
                        if (questChange.startsWith('[ADD:')) {
                            const questParts = questChange.substring(5, questChange.length - 1).split(',').map(p => p.trim());
                            if (questParts.length >= 4) stateUpdates.activeQuests.push({ type: 'ADD', id: questParts[0], name: questParts[1], status: questParts[2], details: questParts[3] });
                        } else if (questChange.startsWith('[UPDATE:')) {
                            const questParts = questChange.substring(9, questChange.length - 1).split(',').map(p => p.trim());
                            if (questParts.length >= 2) stateUpdates.activeQuests.push({ type: 'UPDATE', id: questParts[0], status: questParts[1] });
                        } else if (questChange.startsWith('[REMOVE:')) {
                            const id = questChange.substring(9, questChange.length - 1).trim();
                            stateUpdates.activeQuests.push({ type: 'REMOVE', id: id });
                        }
                    });
                } else if (key === 'Événements Mondiaux Majeurs') {
                    stateUpdates.majorWorldEvents = stateUpdates.majorWorldEvents || [];
                    value.split('|').forEach(eventChange => {
                        eventChange = eventChange.trim();
                        if (eventChange.startsWith('[ADD:')) {
                            const eventParts = eventChange.substring(5, eventChange.length - 1).split(',').map(p => p.trim());
                            if (eventParts.length >= 2) stateUpdates.majorWorldEvents.push({ type: 'ADD', id: eventParts[0], description: eventParts[1] });
                        } else if (eventChange.startsWith('[REMOVE:')) {
                            const id = eventChange.substring(9, eventChange.length - 1).trim();
                            stateUpdates.majorWorldEvents.push({ type: 'REMOVE', id: id });
                        }
                    });
                } else if (key === 'Lieu') {
                    stateUpdates.location = value;
                } else if (key === 'playerArchetype' || key === 'gameMode' || key === 'playerName') {
                    currentState[key] = value; // Assurez-vous que ces valeurs sont aussi mises à jour
                }
            }
        });
    }
}

function applyStateUpdates(currentState, inventoryChanges, stateUpdates) {
    inventoryChanges.forEach(change => {
        if (change.type === 'ADD') {
            if (!currentState.inventory.some(item => item.name === change.name)) {
                currentState.inventory.push({ name: change.name, description: change.description });
            }
        } else if (change.type === 'REMOVE') {
            currentState.inventory = currentState.inventory.filter(item => item.name !== change.name);
        }
    });

    for (const key in stateUpdates) {
        if (stateUpdates.hasOwnProperty(key)) {
            const value = stateUpdates[key];

            if (['vigor', 'ingenuity', 'adaptation', 'influence'].includes(key)) {
                if (typeof value === 'object' && value.hasOwnProperty('change')) {
                    currentState.attributes[key] = Math.max(0, Math.min(100, currentState.attributes[key] + value.change));
                } else {
                    currentState.attributes[key] = Math.max(0, Math.min(100, value));
                }
            } else if (key === 'factionRelations') {
                for (const factionKey in value) {
                    if (value.hasOwnProperty(factionKey) && currentState.factionRelations[factionKey]) {
                        currentState.factionRelations[factionKey].relation = value[factionKey];
                    }
                }
            } else if (key === 'npcsMet') {
                value.forEach(npcChange => {
                    if (npcChange.type === 'ADD') {
                        if (!currentState.npcsMet.some(n => n.name === npcChange.name)) {
                            currentState.npcsMet.push({ name: npcChange.name, relation: npcChange.relation, lastInteraction: npcChange.lastInteraction });
                        }
                    } else if (npcChange.type === 'UPDATE') {
                        const existingNpcIndex = currentState.npcsMet.findIndex(n => n.name === npcChange.name);
                        if (existingNpcIndex !== -1) {
                            currentState.npcsMet[existingNpcIndex].relation = npcChange.relation;
                            currentState.npcsMet[existingNpcIndex].lastInteraction = npcChange.lastInteraction;
                        } else {
                            currentState.npcsMet.push({ name: npcChange.name, relation: npcChange.relation, lastInteraction: npcChange.lastInteraction });
                        }
                    } else if (npcChange.type === 'REMOVE') {
                        currentState.npcsMet = currentState.npcsMet.filter(n => n.name !== npcChange.name);
                    }
                });
            } else if (key === 'activeQuests') {
                value.forEach(questChange => {
                    if (questChange.type === 'ADD') {
                        if (!currentState.activeQuests.some(q => q.id === questChange.id)) {
                            currentState.activeQuests.push({ id: questChange.id, name: questChange.name, status: questChange.status, details: questChange.details });
                        }
                    } else if (questChange.type === 'UPDATE') {
                        const existingQuestIndex = currentState.activeQuests.findIndex(q => q.id === questChange.id);
                        if (existingQuestIndex !== -1) {
                            currentState.activeQuests[existingQuestIndex].status = questChange.status;
                            if(questChange.details) currentState.activeQuests[existingQuestIndex].details = questChange.details;
                        }
                    } else if (questChange.type === 'REMOVE') {
                        currentState.activeQuests = currentState.activeQuests.filter(q => q.id !== questChange.id);
                    }
                });
            } else if (key === 'majorWorldEvents') {
                value.forEach(eventChange => {
                    if (eventChange.type === 'ADD') {
                        if (!currentState.majorWorldEvents.some(e => e.id === eventChange.id)) {
                            currentState.majorWorldEvents.push({ id: eventChange.id, description: eventChange.description });
                        }
                    } else if (eventChange.type === 'REMOVE') {
                        currentState.majorWorldEvents = currentState.majorWorldEvents.filter(e => e.id !== eventChange.id);
                    }
                });
            } else if (key === 'location') {
                currentState.location = value;
            } else if (key === 'playerArchetype' || key === 'gameMode' || key === 'playerName') {
                currentState[key] = value; // Assurez-vous que ces valeurs sont aussi mises à jour
            }
        }
    }
}
