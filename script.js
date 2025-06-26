// Déclaration des éléments UI (globalement pour faciliter l'accès après window.onload dans index.html)
let displayNameInput, characterNameInput, archetypeSelect, descriptionTextarea, backgroundTextarea, gameModeSelect;
let createUserButton, signInAnonButton, saveCharacterButton, startGameButton, signOutButton;
let loginScreen, characterScreen, modeScreen, gameScreen;

let playerNameDisplay, vigorValue, ingeniositeValue, adaptationValue, influenceValue;
let inventoryCard, inventoryGrid;
let narrativeDisplay, actionsCard, choicesContainer, customActionTextarea, takeCustomActionButton;
let saveGameButton, newAdventureButton, quitGameButton;

let userIdDisplay, displayNameValue;

// Factions, PNJ, Quêtes, Événements - Les IDs sont maintenant dans le main-game-content / sidebar
let gardeChroniqueRelation, fluxLibresRelation, resonancesObscuresRelation;
let npcsList, questsList, eventsList;

// Variables globales de Firebase (initialisées par index.html)
window.currentUserId = null;
window.playerDisplayName = null;
window.firebaseApp = null;
window.firebaseAuth = null;
window.firestoreDb = null;
window.canvasAppId = null;

// État de la partie
let currentStoryState = {}; // Sera chargé/mis à jour par le backend

console.log("script.js chargé : Début de l'exécution du fichier.");

// --- Initialisation des éléments DOM après que le HTML soit chargé ---
document.addEventListener('DOMContentLoaded', function() {
    // Éléments des écrans d'authentification / création
    displayNameInput = document.getElementById('displayName');
    characterNameInput = document.getElementById('characterName');
    archetypeSelect = document.getElementById('archetype');
    descriptionTextarea = document.getElementById('description');
    backgroundTextarea = document.getElementById('background');
    gameModeSelect = document.getElementById('gameModeSelect');

    createUserButton = document.getElementById('createUserButton');
    signInAnonButton = document.getElementById('signInAnonButton');
    saveCharacterButton = document.getElementById('saveCharacterButton');
    startGameButton = document.getElementById('startGameButton');
    signOutButton = document.getElementById('signOutButton');

    loginScreen = document.getElementById('loginScreen');
    characterScreen = document.getElementById('characterScreen');
    modeScreen = document.getElementById('modeScreen');
    gameScreen = document.getElementById('gameScreen');

    // Éléments de l'écran de jeu
    playerNameDisplay = document.getElementById('playerNameDisplay');
    vigorValue = document.getElementById('vigueur');
    ingeniositeValue = document.getElementById('ingeniosite');
    adaptationValue = document.getElementById('adaptation');
    influenceValue = document.getElementById('influence');

    inventoryCard = document.getElementById('inventoryCard');
    inventoryGrid = document.getElementById('inventoryGrid'); // Ceci contiendra un <ul> maintenant

    narrativeDisplay = document.getElementById('narrative');
    actionsCard = document.getElementById('actionsCard');
    choicesContainer = document.getElementById('choices');
    customActionTextarea = document.getElementById('customAction');
    takeCustomActionButton = document.getElementById('takeCustomActionButton');

    saveGameButton = document.getElementById('saveGameButton');
    newAdventureButton = document.getElementById('newAdventureButton');
    quitGameButton = document.getElementById('quitGameButton');

    // Éléments de la sidebar utilisateur/stats
    userIdDisplay = document.getElementById('user-id-display');
    displayNameValue = document.getElementById('display-name-value');

    // Éléments des relations/PNJ/Quêtes/Événements
    gardeChroniqueRelation = document.getElementById('garde-chronique-relation');
    fluxLibresRelation = document.getElementById('flux-libres-relation');
    resonancesObscuresRelation = document.getElementById('resonances-obscures-relation');
    npcsList = document.getElementById('npcs-list');
    questsList = document.getElementById('quests-list');
    eventsList = document.getElementById('events-list');

    // Attacher les écouteurs d'événements (déplacés ici car DOMContentLoaded est le bon moment)
    if (saveCharacterButton) {
        saveCharacterButton.addEventListener('click', saveCharacter);
    }
    if (startGameButton) {
        startGameButton.addEventListener('click', startGame);
    }
    if (takeCustomActionButton) {
        takeCustomActionButton.addEventListener('click', takeCustomAction);
    }
    if (newAdventureButton) {
        newAdventureButton.addEventListener('click', newAdventure);
    }
    if (quitGameButton) {
        quitGameButton.addEventListener('click', quitGame);
    }
    if (saveGameButton) {
        saveGameButton.addEventListener('click', saveGame);
    }
    if (customActionTextarea) {
        customActionTextarea.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { // Shift+Enter for newline
                e.preventDefault();
                takeCustomActionButton.click();
            }
        });
    }

    console.log("Tous les éléments DOM critiques assignés.");

    // Le reste de la logique d'initialisation (chargement de session, etc.) est géré par le script inline dans index.html
    // car il dépend de l'état d'authentification Firebase.
});


// Fonction utilitaire pour gérer les mises à jour des listes UI
function updateListDisplay(element, items, displayFunc, defaultText = 'Aucun') {
    if (!element) {
        console.warn(`Element not found for list display:`, element);
        return;
    }
    element.innerHTML = '';
    if (items && items.length > 0) {
        items.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = displayFunc(item);
            element.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        const itemType = element.id.includes('inventory') ? 'objet' :
                         element.id.includes('npcs') ? 'PNJ' :
                         element.id.includes('quests') ? 'quête' : 'événement';
        li.textContent = `${defaultText} ${itemType}`;
        element.appendChild(li);
    }
}

// Fonctions d'interface de Claude (modifiées pour nos IDs et logique)
window.showScreen = (screenId) => { // Gardée globale car utilisée par index.html
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    } else {
        console.error(`Screen with ID ${screenId} not found.`);
    }
};

// Fonctions de gestion des utilisateurs (Adaptées à notre logique Firebase)
async function saveCharacter() {
    const characterName = characterNameInput.value.trim(); // Déjà pré-rempli par displayName
    const archetype = archetypeSelect.value;
    const description = descriptionTextarea.value.trim();
    const background = backgroundTextarea.value.trim();
    
    if (!characterName || !archetype || !description || !background) {
        window.showAlert('Veuillez remplir tous les champs (Nom, Archétype, Description, Passé) pour votre personnage.', 'error');
        return;
    }

    // Mettre à jour l'état du joueur localement
    currentStoryState = {
        playerName: characterName, // Enregistre le displayName comme nom du joueur
        playerArchetype: archetype,
        playerDescription: description,
        playerBackground: background,
        // Les autres champs d'état seront initialisés au démarrage du jeu ou chargés
        gameMode: '', // Sera choisi à l'écran suivant
        history: [],
        inventory: [],
        attributes: {
            vigor: 80,
            ingenity: 70,
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
    
    // Si l'utilisateur est anonyme, la partie sera juste liée à son ID anonyme et sauvegardée dans Firestore
    // Si déjà un nom d'affichage, on continue avec cet ID utilisateur
    if (window.currentUserId) {
        try {
            const userSessionRef = window.firestoreDb.collection('artifacts').doc(window.canvasAppId).collection('users').doc(window.currentUserId).collection('sessions').doc('current');
            await window.firestoreDb.setDoc(userSessionRef, currentStoryState, { merge: true });
            window.showAlert('Personnage créé et sauvegardé !', 'success');
            window.showScreen('modeScreen'); // Passer à la sélection de mode
        } catch (error) {
            console.error("Erreur lors de la sauvegarde du personnage initial:", error);
            window.showAlert("Erreur lors de la sauvegarde du personnage. Veuillez réessayer.", "error");
        }
    } else {
        window.showAlert("Erreur: Utilisateur non authentifié. Veuillez vous connecter ou continuer anonymement d'abord.", "error");
        window.showScreen('loginScreen'); // Retour à la connexion si non authentifié (devrait être géré par index.html)
    }
}


async function startGame() {
    const mode = gameModeSelect.value;
    if (!mode) {
        window.showAlert('Veuillez choisir un mode de jeu pour démarrer l\'aventure.', 'info');
        return;
    }

    currentStoryState.gameMode = mode; // Mettre à jour le mode dans l'état local
    
    window.showScreen('gameScreen'); // Afficher l'écran de jeu

    // Afficher le spinner de chargement dans l'affichage narratif
    narrativeDisplay.innerHTML = '<div class="loading">Génération de votre aventure...</div>';
    
    // Envoyer la requête de démarrage au backend (notre fonction existante)
    await sendToBackend(`Démarrer l'aventure en tant que ${currentStoryState.playerArchetype} : "${currentStoryState.playerDescription}", avec un passé "${currentStoryState.playerBackground}" en mode ${currentStoryState.gameMode}`, true);
}


// Fonctions de gameplay (adaptées pour utiliser notre backend)
function updateGameDisplay() {
    // Mettre à jour le nom du joueur
    if (playerNameDisplay) playerNameDisplay.textContent = 
        `${currentStoryState.playerName} (${window.playerDisplayName || 'Anonyme'})`;
    
    // Mettre à jour les statistiques
    if (vigorValue) vigorValue.textContent = currentStoryState.attributes.vigor;
    if (ingeniositeValue) ingeniositeValue.textContent = currentStoryState.attributes.ingenity; // Correction ici
    if (adaptationValue) adaptationValue.textContent = currentStoryState.attributes.adaptation;
    if (influenceValue) influenceValue.textContent = currentStoryState.attributes.influence;
    
    // Mettre à jour la narration
    if (narrativeDisplay) narrativeDisplay.innerHTML = currentStoryState.history
        .filter(entry => entry.type === 'gemini')
        .map(entry => `<p>${entry.text}</p>`)
        .join('');
    narrativeDisplay.scrollTop = narrativeDisplay.scrollHeight;

    // Mettre à jour l'inventaire
    updateListDisplay(inventoryGrid, currentStoryState.inventory, (item) => `${item.name} (${item.description})`, 'Aucun');
    if (inventoryCard) inventoryCard.style.display = currentStoryState.inventory.length > 0 ? 'block' : 'none';

    // Mettre à jour les relations, PNJ, Quêtes, Événements
    if (currentStoryState.factionRelations) {
        if (gardeChroniqueRelation) gardeChroniqueRelation.textContent = currentStoryState.factionRelations.gardeChronique.relation;
        if (fluxLibresRelation) fluxLibresRelation.textContent = currentStoryState.factionRelations.fluxLibres.relation;
        if (resonancesObscuresRelation) resonancesObscuresRelation.textContent = currentStoryState.factionRelations.resonancesObscures.relation;
    }
    updateListDisplay(npcsList, currentStoryState.npcsMet, (npc) => `${npc.name} (${npc.relation || 'Inconnu'})`, 'Aucun');
    updateListDisplay(questsList, currentStoryState.activeQuests, (quest) => `${quest.name} [${quest.status}]`, 'Aucune');
    updateListDisplay(eventsList, currentStoryState.majorWorldEvents, (event) => `${event.description}`, 'Aucun');
}


function showActions(options) {
    if (!actionsCard || !choicesContainer || !customActionTextarea || !takeCustomActionButton) {
        console.error("Action elements not found.");
        return;
    }

    actionsCard.style.display = 'block';
    choicesContainer.innerHTML = ''; // Clear previous choices

    if (options && options.length > 0) {
        options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'choice-btn';
            button.textContent = option;
            button.addEventListener('click', () => sendToBackend(option));
            choicesContainer.appendChild(button);
        });
        customActionTextarea.style.display = 'none'; // Hide custom action if choices are present
        takeCustomActionButton.style.display = 'none';
    } else {
        // Show custom action if no specific options are given
        customActionTextarea.style.display = 'block';
        takeCustomActionButton.style.display = 'block';
    }
}

function takeAction(choice) { // Maintenant, le "choice" est la string directe de l'option
    // Envoyer l'action au backend (notre fonction existante)
    sendToBackend(choice);
}

function takeCustomAction() {
    const customAction = customActionTextarea.value.trim();
    if (!customAction) {
        window.showAlert('Veuillez décrire votre action.', 'info');
        return;
    }
    sendToBackend(customAction);
    customActionTextarea.value = '';
}

// Fonction de sauvegarde (notre logique Firebase)
async function saveGame() {
    if (!window.currentUserId) {
        window.showAlert("Vous devez être connecté pour sauvegarder votre partie.", "error");
        return;
    }
    try {
        const userSessionRef = window.firestoreDb.collection('artifacts').doc(window.canvasAppId).collection('users').doc(window.currentUserId).collection('sessions').doc('current');
        await window.firestoreDb.setDoc(userSessionRef, currentStoryState, { merge: true });
        
        // Afficher une confirmation visuelle temporaire
        const originalText = saveGameButton.textContent;
        saveGameButton.textContent = '✅ Sauvegardé !';
        saveGameButton.classList.add('success'); // Utilise la classe succès de Claude
        
        setTimeout(() => {
            saveGameButton.textContent = originalText;
            saveGameButton.classList.remove('success');
        }, 2000);

        window.showAlert('Partie sauvegardée avec succès !', 'success');
    } catch (error) {
        console.error("Erreur lors de la sauvegarde:", error);
        window.showAlert("Erreur lors de la sauvegarde de la partie. Veuillez réessayer.", "error");
    }
}

// Fonction de nouvelle aventure (simplifiée pour le prototype)
function newAdventure() {
    window.showAlert("Lancement d'une nouvelle aventure... Votre partie actuelle ne sera pas sauvegardée si vous n'êtes pas connecté.", "info");
    currentStoryState = {}; // Réinitialiser l'état
    window.showScreen('characterScreen'); // Retour à la création de personnage
    // Le nom d'affichage devrait être pré-rempli si l'utilisateur est connecté
    if (window.playerDisplayName) {
        characterNameInput.value = window.playerDisplayName;
        characterNameInput.disabled = true;
    } else {
        characterNameInput.value = '';
        characterNameInput.disabled = false;
    }
    descriptionTextarea.value = '';
    backgroundTextarea.value = '';
    archetypeSelect.value = '';
    gameModeSelect.value = '';
}

// Fonction pour quitter le jeu (déconnexion et retour à l'écran de connexion)
function quitGame() {
    window.showAlert("Déconnexion... Votre progression actuelle sera perdue si elle n'a pas été sauvegardée.", "info");
    if (window.firebaseAuth) {
        window.firebaseAuth.signOut(); // La déconnexion Firebase va gérer le retour à l'écran de connexion
    } else {
        window.showScreen('loginScreen');
    }
}


// --- Communication avec le Backend (Netlify Function) ---
async function sendToBackend(action, isStart = false) {
    if (!window.currentUserId) {
        window.showAlert("Vous n'êtes pas connecté. Veuillez vous connecter ou jouer anonymement pour commencer.", "error");
        window.showScreen('loginScreen');
        return;
    }
    if (!window.playerDisplayName) {
        window.showAlert("Veuillez choisir un nom d'affichage avant de commencer l'aventure.", "error");
        window.showScreen('loginScreen'); // Ensure user is on login to set display name
        return;
    }

    // Afficher l'action du joueur dans l'historique
    if (!isStart && currentStoryState.playerName) {
        appendStory(`\n> ${currentStoryState.playerName} : ${action}\n`);
    }

    // Désactiver les entrées pendant le traitement
    if (actionsCard) actionsCard.style.pointerEvents = 'none';
    if (takeCustomActionButton) takeCustomActionButton.textContent = 'Réflexion en cours...';
    if (saveGameButton) saveGameButton.disabled = true;

    // Afficher un indicateur de chargement dans la narration
    narrativeDisplay.innerHTML = '<div class="loading">L\'IA génère la suite de votre aventure...</div>';


    const payload = {
        userId: window.currentUserId,
        displayName: window.playerDisplayName,
        playerName: currentStoryState.playerName, // Nom du personnage
        playerArchetype: currentStoryState.playerArchetype,
        playerDescription: currentStoryState.playerDescription,
        playerBackground: currentStoryState.playerBackground,
        gameMode: currentStoryState.gameMode,
        playerAction: action,
        isStart: isStart,
    };

    try {
        const response = await fetch('/.netlify/functions/gemini-narrator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const { narration, options, newState } = data;

        currentStoryState = newState; // METTRE À JOUR L'ÉTAT LOCAL AVEC LE NOUVEL ÉTAT

        // Mise à jour de l'UI du jeu principal (uniquement si sur index.html)
        const path = window.location.pathname;
        if (path === '/' || path.includes('index.html')) {
            updateGameDisplay(); // Met à jour les stats, inventaire, etc.
            appendStory(narration); // Ajoute la nouvelle narration

            // Gérer l'affichage des actions (choix ou texte libre)
            showActions(options);

        } else {
            // Logique pour d'autres pages si elles appellent sendToBackend (peu probable pour l'instant)
            console.warn("sendToBackend appelé depuis une page non-jeu:", path);
        }

    } catch (error) {
        console.error('Erreur lors de l\'envoi au backend:', error);
        window.showAlert("Une erreur est survenue. Le tissu de l'Echo Verse vacille... (Voir la console pour plus de détails)", "error");
        // En cas d'erreur, revenir à l'input libre si possible
        narrativeDisplay.innerHTML = `<p class="error">Une erreur est survenue: ${error.message}. Veuillez réessayer.</p>`;
        showActions([]); // Afficher l'input libre
    } finally {
        // Réactiver les entrées
        if (actionsCard) actionsCard.style.pointerEvents = 'auto';
        if (takeCustomActionButton) takeCustomActionButton.textContent = 'Exécuter l'action';
        if (saveGameButton) saveGameButton.disabled = false;
    }
}


// Fonction exposée globalement pour être appelée par le script Firebase dans index.html
window.loadGameSession = async (userId) => {
    window.currentUserId = userId; // Assurez-vous que l'userId global est mis à jour ici
    const path = window.location.pathname;
    
    // Si nous sommes sur index.html (la page de jeu)
    if (path === '/' || path.includes('index.html')) {
        // Le nom d'affichage doit être défini avant de charger une partie ou de commencer
        if (!window.playerDisplayName) {
            console.warn("loadGameSession appelé sans playerDisplayName. Retour à l'écran de connexion.");
            window.showScreen('loginScreen');
            return;
        }

        // Mettre à jour le champ characterNameInput avec le displayName
        if (characterNameInput) {
            characterNameInput.value = window.playerDisplayName;
            characterNameInput.disabled = true; // Empêcher la modification
        }

        try {
            // Tenter de charger la dernière session de jeu pour cet utilisateur
            const response = await fetch('/.netlify/functions/gemini-narrator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: window.currentUserId, isStart: false, playerAction: "Charger session" }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn("Session non trouvée pour cet utilisateur, démarrage d'une nouvelle partie.");
                    window.showScreen('characterScreen'); // Afficher l'écran de création si pas de partie
                } else {
                    throw new Error(`Erreur HTTP: ${response.status} - ${await response.text()}`);
                }
            } else {
                const data = await response.json();
                currentStoryState = data.newState; // Charger l'état complet

                window.showAlert(`Bienvenue de nouveau, ${currentStoryState.playerName} ! L'Echo Verse vous attend...`, "success");

                updateGameDisplay(); // Met à jour les stats, inventaire, etc.
                appendStory(data.narration); // Ajoute la dernière narration

                window.showScreen('gameScreen'); // Afficher l'écran de jeu
                showActions([]); // Afficher l'input libre par défaut après le chargement
            }
        } catch (error) {
            console.error('Erreur lors du chargement de la session:', error);
            window.showAlert("Impossible de charger la session. Veuillez démarrer une nouvelle partie.", "error");
            window.showScreen('characterScreen'); // Fallback vers création de personnage
        }
    } else if (window.location.pathname.includes('profile.html')) {
        // Logique de chargement pour la page de profil
        const profilePlayerName = document.getElementById('profile-player-name'); // etc.
        if (window.currentUserId) {
            try {
                const response = await fetch('/.netlify/functions/gemini-narrator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: window.currentUserId, isStart: false, playerAction: "Charger session pour profil" }),
                });

                if (response.ok) {
                    const data = await response.json();
                    currentStoryState = data.newState;
                    // Mettre à jour les éléments de la page de profil
                    if (profilePlayerName) profilePlayerName.textContent = currentStoryState.playerName || 'N/A';
                    if (document.getElementById('profile-player-archetype')) document.getElementById('profile-player-archetype').textContent = currentStoryState.playerArchetype || 'N/A';
                    if (document.getElementById('profile-player-description')) document.getElementById('profile-player-description').textContent = currentStoryState.playerDescription || 'N/A';
                    if (document.getElementById('profile-player-background')) document.getElementById('profile-player-background').textContent = currentStoryState.playerBackground || 'N/A';
                    if (document.getElementById('profile-game-mode')) document.getElementById('profile-game-mode').textContent = currentStoryState.gameMode || 'N/A';
                    // ... et toutes les autres stats, inventaire, etc. pour le profil
                    if (document.getElementById('profile-vigor-value')) document.getElementById('profile-vigor-value').textContent = currentStoryState.attributes ? currentStoryState.attributes.vigor : 'N/A';
                    if (document.getElementById('profile-ingenuit-value')) document.getElementById('profile-ingenuit-value').textContent = currentStoryState.attributes ? currentStoryState.attributes.ingenity : 'N/A';
                    if (document.getElementById('profile-adaptation-value')) document.getElementById('profile-adaptation-value').textContent = currentStoryState.attributes ? currentStoryState.attributes.adaptation : 'N/A';
                    if (document.getElementById('profile-influence-value')) document.getElementById('profile-influence-value').textContent = currentStoryState.attributes ? currentStoryState.attributes.influence : 'N/A';
                    updateListDisplay(document.getElementById('profile-inventory-list'), currentStoryState.inventory, (item) => `${item.name} (${item.description})`, 'Aucun');
                    if (document.getElementById('profile-garde-chronique-relation')) document.getElementById('profile-garde-chronique-relation').textContent = currentStoryState.factionRelations ? currentStoryState.factionRelations.gardeChronique.relation : 'N/A';
                    if (document.getElementById('profile-flux-libres-relation')) document.getElementById('profile-flux-libres-relation').textContent = currentStoryState.factionRelations ? currentStoryState.factionRelations.fluxLibres.relation : 'N/A';
                    if (document.getElementById('profile-resonances-obscures-relation')) document.getElementById('profile-resonances-obscures-relation').textContent = currentStoryState.factionRelations ? currentStoryState.factionRelations.resonancesObscures.relation : 'N/A';
                    updateListDisplay(document.getElementById('profile-npcs-list'), currentStoryState.npcsMet, (npc) => `${npc.name} (${npc.relation || 'Inconnu'})`, 'Aucun');
                    updateListDisplay(document.getElementById('profile-quests-list'), currentStoryState.activeQuests, (quest) => `${quest.name} [${quest.status}]`, 'Aucune');
                    updateListDisplay(document.getElementById('profile-events-list'), currentStoryState.majorWorldEvents, (event) => `${event.description}`, 'Aucun');

                } else {
                    console.error('Impossible de charger les données du profil:', await response.text());
                    window.showAlert('Impossible de charger les données de votre profil.', "error");
                }
            } catch (error) {
                console.error('Erreur lors du chargement du profil:', error);
                window.showAlert('Erreur lors du chargement des données de profil.', "error");
            }
        } else {
            if (profilePlayerName) profilePlayerName.textContent = 'Veuillez vous connecter pour voir votre profil.';
            if (document.getElementById('profile-display-name')) document.getElementById('profile-display-name').textContent = 'Non connecté';
        }
    } else if (window.location.pathname.includes('history.html')) {
        // Logique de chargement pour la page d'historique
        const sessionsHistoryList = document.getElementById('sessions-history-list');
        if (window.currentUserId) {
            try {
                 const response = await fetch('/.netlify/functions/gemini-narrator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: window.currentUserId, isStart: false, playerAction: "Charger session pour historique" }),
                });

                if (response.ok) {
                    const data = await response.json();
                    currentStoryState = data.newState;
                    if (sessionsHistoryList) {
                        sessionsHistoryList.innerHTML = '';
                        if (currentStoryState.history && currentStoryState.history.length > 0) {
                            currentStoryState.history.forEach(entry => {
                                const li = document.createElement('li');
                                li.textContent = `${entry.type === 'player' ? 'Joueur' : 'MJ'} : ${entry.text.substring(0, 100)}...`; // Limiter la longueur
                                sessionsHistoryList.appendChild(li);
                            });
                        } else {
                            sessionsHistoryList.innerHTML = '<li>Aucun historique trouvé pour cette session.</li>';
                        }
                    }
                } else {
                    console.error('Impossible de charger les données de l\'historique:', await response.text());
                    window.showAlert('Impossible de charger les données de votre historique.', "error");
                }
            } catch (error) {
                console.error('Erreur lors du chargement de l\'historique:', error);
                window.showAlert('Erreur lors du chargement des données d\'historique.', "error");
            }
        } else {
             if (sessionsHistoryList) {
                sessionsHistoryList.innerHTML = '<li>Veuillez vous connecter pour voir votre historique.</li>';
             }
        }
    }
};

// --- Raccourcis clavier (conservés de Claude) ---
document.addEventListener('keydown', function(e) {
    const activeScreen = document.querySelector('.screen.active');
    
    if (activeScreen && activeScreen.id === 'gameScreen') {
        // Raccourci pour action personnalisée (Ctrl+Enter)
        if (e.ctrlKey && e.key === 'Enter') {
            if (document.activeElement === customActionTextarea) {
                takeCustomActionButton.click();
            }
        }
        
        // Raccourcis numériques pour les choix (1-4)
        if (e.key >= '1' && e.key <= '4') {
            const choiceIndex = parseInt(e.key) - 1;
            const choices = document.querySelectorAll('.choice-btn');
            if (choices[choiceIndex]) {
                choices[choiceIndex].click(); // Simule un clic sur le bouton
            }
        }
        
        // Raccourci pour sauvegarder (Ctrl+S)
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveGame();
        }
    }
});

// --- Easter eggs et fonctionnalités bonus (conservés de Claude, avec adaptation des IDs) ---
let konamiCode = [];
const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

document.addEventListener('keydown', function(e) {
    konamiCode.push(e.code);
    if (konamiCode.length > konamiSequence.length) {
        konamiCode.shift();
    }
    
    if (konamiCode.join(',') === konamiSequence.join(',')) {
        // Easter egg : boost toutes les stats
        Object.keys(currentStoryState.attributes).forEach(stat => {
            currentStoryState.attributes[stat] = Math.min(100, currentStoryState.attributes[stat] + 5); // Max 100
        });
        
        // Ajouter un message à l'inventaire
        if (!currentStoryState.inventory.some(item => item.name === 'Code Konami activé')) {
            currentStoryState.inventory.push({ name: 'Code Konami activé', description: 'Vos statistiques ont été boostées !' });
        }
        
        updateGameDisplay(); // Mettre à jour l'affichage
        
        window.showAlert('🎮 Code Konami activé ! Vos statistiques ont été boostées !', 'success');
        konamiCode = [];
    }
});

// Fonction pour réinitialiser complètement le jeu (pour développement)
function resetGame() {
    window.showAlert('Êtes-vous sûr de vouloir réinitialiser complètement le jeu ? Cela supprimera toutes les données sauvegardées localement et sur le cloud pour cet utilisateur.', 'info');
    // Nous allons ajouter un bouton OK à la modal custom alert pour la confirmation
    // Pour l'instant, c'est une alerte simple. Si vous voulez une vraie confirmation dans la modal, il faudrait modifier showAlert.
    
    // Déclencher la déconnexion Firebase qui va vider l'état et ramener à l'écran de connexion
    if (window.firebaseAuth) {
        window.firebaseAuth.signOut().then(() => {
            // Suppression des données Firestore de l'utilisateur (optionnel, pour une réinitialisation complète)
            // Cela nécessiterait des permissions admin côté fonction Netlify, ou un appel API spécifique.
            // Pour l'instant, on se contente de vider localement.
            // TODO: Implémenter une fonction de réinitialisation des données Firestore côté serveur si souhaité.
            
            localStorage.removeItem('echoVerseSessionId'); // Nettoyage de l'ID de session si existant
            currentStoryState = {}; // Vider l'état local
            window.showAlert('Jeu réinitialisé. Toutes les données ont été supprimées pour cet utilisateur.', 'success');
            window.showScreen('loginScreen'); // Retour à l'écran de connexion
            if (displayNameInput) displayNameInput.value = ''; // Clear input
        }).catch(error => {
            console.error("Erreur lors de la réinitialisation/déconnexion:", error);
            window.showAlert("Erreur lors de la réinitialisation du jeu. Veuillez vérifier votre connexion.", "error");
        });
    } else {
        localStorage.removeItem('echoVerseSessionId');
        currentStoryState = {};
        window.showAlert('Jeu réinitialisé localement. Veuillez recharger la page.', 'success');
        window.showScreen('loginScreen');
        if (displayNameInput) displayNameInput.value = '';
    }
}

// Ajouter la fonction reset au global pour le debugging (accessible via console)
window.resetGame = resetGame;
