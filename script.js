// Importations Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variables globales de l'environnement Canvas (seront injectées au runtime)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialiser Firebase (une seule fois pour toute l'application)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variables d'état pour le frontend
let currentUserId = null;
let playerDisplayName = null;
let currentStoryState = {}; // L'état du jeu sera stocké ici

// Références aux éléments DOM (déclarées globalement, initialisées dans DOMContentLoaded)
let displayNameInput, characterNameInput, archetypeSelect, descriptionTextarea, backgroundTextarea, gameModeSelect;
let createUserButton, signInAnonButton, saveCharacterButton, startGameButton, signOutButton;
let loginScreen, characterScreen, modeScreen, gameScreen;

let userIdDisplay, displayNameValue;
let playerNameDisplay, vigorValue, ingenuityValue, adaptationValue, influenceValue;
let inventoryCard, inventoryGrid, narrativeDisplay, actionsCard, choicesContainer, customActionTextarea, takeCustomActionButton;
let saveGameButton, newAdventureButton, quitGameButton;
let gardeChroniqueRelation, fluxLibresRelation, resonancesObscuresRelation, npcsList, questsList, eventsList;


// --- Fonctions d'interface utilisateur (Globales car utilisées par l'Auth et le jeu) ---

// Fonction pour afficher la modal d'alerte personnalisée
window.showAlert = (message, type = 'info') => {
    const customAlertModal = document.getElementById('custom-alert-modal');
    const modalMessage = document.getElementById('modal-message');
    const modalOkButton = document.getElementById('modal-ok-button');
    const closeButton = document.querySelector('#custom-alert-modal .close-button');

    if (!customAlertModal || !modalMessage || !modalOkButton || !closeButton) {
        console.error("Custom alert modal elements not found, falling back to native alert.");
        alert(message);
        return;
    }

    modalMessage.textContent = message;
    customAlertModal.classList.add('active');
    
    modalMessage.parentNode.classList.remove('error', 'success', 'info');
    modalMessage.parentNode.classList.add(type);

    customAlertModal.style.display = 'flex';

    const closeModal = () => {
        customAlertModal.style.display = 'none';
        customAlertModal.classList.remove('active');
    };

    modalOkButton.onclick = closeModal;
    closeButton.onclick = closeModal;
    customAlertModal.onclick = (event) => {
        if (event.target === customAlertModal) {
            closeModal();
        }
    };
};

// Fonction pour gérer l'affichage des différents écrans du jeu
window.showScreen = (screenId) => {
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


// --- Initialisation du DOM et Attachement des Écouteurs d'Événements ---
document.addEventListener('DOMContentLoaded', function() {
    // Récupération de tous les éléments DOM
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

    userIdDisplay = document.getElementById('user-id-display');
    displayNameValue = document.getElementById('display-name-value');
    playerNameDisplay = document.getElementById('playerNameDisplay');
    vigorValue = document.getElementById('vigueur');
    ingenuityValue = document.getElementById('ingeniosite');
    adaptationValue = document.getElementById('adaptation');
    influenceValue = document.getElementById('influence');

    inventoryCard = document.getElementById('inventoryCard');
    inventoryGrid = document.getElementById('inventoryGrid');
    narrativeDisplay = document.getElementById('narrative');
    actionsCard = document.getElementById('actionsCard');
    choicesContainer = document.getElementById('choices');
    customActionTextarea = document.getElementById('customAction');
    takeCustomActionButton = document.getElementById('takeCustomActionButton');

    saveGameButton = document.getElementById('saveGameButton');
    newAdventureButton = document.getElementById('newAdventureButton');
    quitGameButton = document.getElementById('quitGameButton');

    gardeChroniqueRelation = document.getElementById('garde-chronique-relation');
    fluxLibresRelation = document.getElementById('flux-libres-relation');
    resonancesObscuresRelation = document.getElementById('resonances-obscures-relation');
    npcsList = document.getElementById('npcs-list');
    questsList = document.getElementById('quests-list');
    eventsList = document.getElementById('events-list');

    console.log("DOM Loaded. All elements retrieved.");

    // Attacher les écouteurs d'événements
    if (createUserButton) createUserButton.addEventListener('click', createUser);
    if (signInAnonButton) signInAnonButton.addEventListener('click', signInAnonymouslyUser);
    if (saveCharacterButton) saveCharacterButton.addEventListener('click', saveCharacter);
    if (startGameButton) startGameButton.addEventListener('click', startGame);
    if (takeCustomActionButton) takeCustomActionButton.addEventListener('click', takeCustomAction);
    if (newAdventureButton) newAdventureButton.addEventListener('click', newAdventure);
    if (quitGameButton) quitGameButton.addEventListener('click', quitGame);
    if (saveGameButton) saveGameButton.addEventListener('click', saveGame);
    if (customActionTextarea) {
        customActionTextarea.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                takeCustomActionButton.click();
            }
        });
    }

    // Lancement initial de l'authentification Firebase
    initFirebaseAuth();
});

// --- Fonctions d'Authentification Firebase ---

async function initFirebaseAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            if (userIdDisplay) userIdDisplay.textContent = currentUserId;
            console.log("Firebase Authentifié:", currentUserId);

            const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
            const userProfileSnap = await getDoc(userProfileRef);

            if (userProfileSnap.exists() && userProfileSnap.data().displayName) {
                playerDisplayName = userProfileSnap.data().displayName;
                if (displayNameValue) displayNameValue.textContent = playerDisplayName;
                if (characterNameInput) {
                    characterNameInput.value = playerDisplayName;
                    characterNameInput.disabled = true;
                }
                await loadGameSession(currentUserId); // Tente de charger la session après l'authentification
            } else {
                playerDisplayName = null;
                if (displayNameValue) displayNameValue.textContent = 'Non défini';
                window.showScreen('loginScreen');
                window.showAlert("Choisissez un nom d'affichage unique pour votre voyage dans l'Echo Verse. Il ne pourra pas être changé ensuite.", "info");
            }
        } else {
            currentUserId = null;
            playerDisplayName = null;
            if (userIdDisplay) userIdDisplay.textContent = 'Non connecté';
            if (displayNameValue) displayNameValue.textContent = 'Non connecté';
            console.log("Firebase Non Authentifié. Affichage de l'écran de connexion.");
            window.showScreen('loginScreen');
            if (characterNameInput) {
                characterNameInput.value = '';
                characterNameInput.disabled = false;
            }
            window.showAlert("Veuillez vous connecter pour sauvegarder votre progression. Vous pouvez également continuer anonymement, mais votre partie ne sera pas sauvegardée.", "info");
        }
    });

    // Tentative d'authentification initiale (avec token Canvas ou anonyme)
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }
    } catch (error) {
        console.error("Erreur d'authentification initiale (tentative):", error);
        // onAuthStateChanged gérera le basculement vers loginScreen en cas d'échec
    }
}

async function createUser() {
    const newDisplayName = displayNameInput.value.trim();
    if (newDisplayName.length < 3 || newDisplayName.length > 20) {
        document.getElementById('loginError').textContent = "Le nom d'affichage doit contenir entre 3 et 20 caractères.";
        document.getElementById('loginError').style.display = 'block';
        return;
    }
    document.getElementById('loginError').style.display = 'none';

    try {
        // Sign in anonymously first if not already (onAuthStateChanged will update currentUserId)
        if (!currentUserId) {
            await signInAnonymously(auth);
            // Wait for onAuthStateChanged to update currentUserId
            await new Promise(resolve => {
                const unsubscribe = onAuthStateChanged(auth, user => {
                    if (user) {
                        unsubscribe();
                        resolve();
                    }
                });
            });
        }
        
        const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        await setDoc(userProfileRef, { displayName: newDisplayName, lastUpdated: new Date() }, { merge: true });
        playerDisplayName = newDisplayName; // Update local state
        if (displayNameValue) displayNameValue.textContent = playerDisplayName;
        if (characterNameInput) {
            characterNameInput.value = playerDisplayName;
            characterNameInput.disabled = true;
        }
        window.showAlert(`Votre nom d'affichage "${newDisplayName}" a été enregistré.`, "success");
        window.showScreen('characterScreen');
    } catch (error) {
        console.error("Erreur lors de la création de l'utilisateur ou de l'enregistrement du nom:", error);
        window.showAlert("Erreur lors de la connexion/enregistrement. Veuillez réessayer.", "error");
    }
}

async function signInAnonymouslyUser() {
    try {
        await signInAnonymously(auth);
        window.showAlert("Vous jouez maintenant en mode anonyme. Votre progression ne sera pas sauvegardée.", "info");
        // onAuthStateChanged gérera la transition d'écran
    } catch (error) {
        console.error("Erreur de connexion anonyme:", error);
        window.showAlert("Erreur de connexion anonyme. Veuillez réessayer.", "error");
    }
}

async function signOutUser() {
    try {
        await signOut(auth);
        window.showAlert("Vous avez été déconnecté.", "info");
        currentStoryState = {};
        playerDisplayName = null;
        if (characterNameInput) {
            characterNameInput.value = '';
            characterNameInput.disabled = false;
        }
        window.showScreen('loginScreen');
        if (displayNameInput) displayNameInput.value = '';
    } catch (error) {
        console.error("Erreur lors de la déconnexion:", error);
        window.showAlert("Erreur lors de la déconnexion. Veuillez réessayer.", "error");
    }
}


// --- Fonctions de Gestion du Jeu ---

async function saveCharacter() {
    const characterName = characterNameInput.value.trim();
    const archetype = archetypeSelect.value;
    const description = descriptionTextarea.value.trim();
    const background = backgroundTextarea.value.trim();
    
    if (!characterName || !archetype || !description || !background) {
        window.showAlert('Veuillez remplir tous les champs (Nom, Archétype, Description, Passé) pour votre personnage.', 'error');
        return;
    }

    currentStoryState = {
        playerName: characterName,
        playerArchetype: archetype,
        playerDescription: description,
        playerBackground: background,
        gameMode: '',
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
    
    if (currentUserId) {
        try {
            const userSessionRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'sessions', 'current');
            await setDoc(userSessionRef, currentStoryState, { merge: true });
            window.showAlert('Personnage créé et sauvegardé !', 'success');
            window.showScreen('modeScreen');
        } catch (error) {
            console.error("Erreur lors de la sauvegarde du personnage initial:", error);
            window.showAlert("Erreur lors de la sauvegarde du personnage. Veuillez réessayer.", "error");
        }
    } else {
        window.showAlert("Erreur: Utilisateur non authentifié. Veuillez vous connecter ou continuer anonymement d'abord.", "error");
        window.showScreen('loginScreen');
    }
}

async function startGame() {
    const mode = gameModeSelect.value;
    if (!mode) {
        window.showAlert('Veuillez choisir un mode de jeu pour démarrer l\'aventure.', 'info');
        return;
    }

    currentStoryState.gameMode = mode;
    
    window.showScreen('gameScreen');

    narrativeDisplay.innerHTML = '<div class="loading">Génération de votre aventure...</div>';
    
    await sendToBackend(`Démarrer l'aventure en tant que ${currentStoryState.playerArchetype} : "${currentStoryState.playerDescription}", avec un passé "${currentStoryState.playerBackground}" en mode ${currentStoryState.gameMode}`, true);
}

function updateGameDisplay() {
    if (playerNameDisplay) playerNameDisplay.textContent = 
        `${currentStoryState.playerName} (${playerDisplayName || 'Anonyme'})`;
    
    if (vigorValue) vigorValue.textContent = currentStoryState.attributes.vigor;
    if (ingenuityValue) ingenuityValue.textContent = currentStoryState.attributes.ingenuity;
    if (adaptationValue) adaptationValue.textContent = currentStoryState.attributes.adaptation;
    if (influenceValue) influenceValue.textContent = currentStoryState.attributes.influence;
    
    if (narrativeDisplay) narrativeDisplay.innerHTML = currentStoryState.history
        .filter(entry => entry.type === 'gemini')
        .map(entry => `<p>${entry.text}</p>`)
        .join('');
    narrativeDisplay.scrollTop = narrativeDisplay.scrollHeight;

    updateListDisplay(inventoryGrid, currentStoryState.inventory, (item) => `${item.name} (${item.description})`, 'Aucun objet');
    if (inventoryCard) inventoryCard.style.display = currentStoryState.inventory.length > 0 ? 'block' : 'none';

    if (currentStoryState.factionRelations) {
        if (gardeChroniqueRelation) gardeChroniqueRelation.textContent = currentStoryState.factionRelations.gardeChronique.relation;
        if (fluxLibresRelation) fluxLibresRelation.textContent = currentStoryState.factionRelations.fluxLibres.relation;
        if (resonancesObscuresRelation) resonancesObscuresRelation.textContent = currentStoryState.factionRelations.resonancesObscures.relation;
    }
    updateListDisplay(npcsList, currentStoryState.npcsMet, (npc) => `${npc.name} (${npc.relation || 'Inconnu'})`, 'Aucun PNJ');
    updateListDisplay(questsList, currentStoryState.activeQuests, (quest) => `${quest.name} [${quest.status}]`, 'Aucune quête');
    updateListDisplay(eventsList, currentStoryState.majorWorldEvents, (event) => `${event.description}`, 'Aucun événement');
}

function showActions(options) {
    if (!actionsCard || !choicesContainer || !customActionTextarea || !takeCustomActionButton) {
        console.error("Action elements not found.");
        return;
    }

    actionsCard.style.display = 'block';
    choicesContainer.innerHTML = '';

    if (options && options.length > 0) {
        options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'choice-btn';
            button.textContent = option;
            button.addEventListener('click', () => sendToBackend(option));
            choicesContainer.appendChild(button);
        });
        customActionTextarea.style.display = 'none';
        takeCustomActionButton.style.display = 'none';
    } else {
        customActionTextarea.style.display = 'block';
        takeCustomActionButton.style.display = 'block';
    }
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

async function saveGame() {
    if (!currentUserId) {
        window.showAlert("Vous devez être connecté pour sauvegarder votre partie.", "error");
        return;
    }
    try {
        const userSessionRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'sessions', 'current');
        await setDoc(userSessionRef, currentStoryState, { merge: true });
        
        const originalText = saveGameButton.textContent;
        saveGameButton.textContent = '✅ Sauvegardé !';
        saveGameButton.classList.add('success');
        
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

function newAdventure() {
    window.showAlert("Lancement d'une nouvelle aventure... Votre partie actuelle ne sera pas sauvegardée si vous n'êtes pas connecté.", "info");
    currentStoryState = {};
    window.showScreen('characterScreen');
    if (playerDisplayName) {
        characterNameInput.value = playerDisplayName;
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

function quitGame() {
    window.showAlert("Déconnexion... Votre progression actuelle sera perdue si elle n'a pas été sauvegardée.", "info");
    if (auth) {
        signOut(auth); // Sign out will trigger onAuthStateChanged, which handles screen transition
    } else {
        window.showScreen('loginScreen');
    }
}

async function sendToBackend(action, isStart = false) {
    if (!currentUserId) {
        window.showAlert("Vous n'êtes pas connecté. Veuillez vous connecter ou jouer anonymement pour commencer.", "error");
        window.showScreen('loginScreen');
        return;
    }
    if (!playerDisplayName) {
        window.showAlert("Veuillez choisir un nom d'affichage avant de commencer l'aventure.", "error");
        window.showScreen('loginScreen');
        return;
    }

    if (!isStart && currentStoryState.playerName) {
        appendStory(`\n> ${currentStoryState.playerName} : ${action}\n`);
    }

    if (actionsCard) actionsCard.style.pointerEvents = 'none';
    if (takeCustomActionButton) takeCustomActionButton.textContent = 'Réflexion en cours...';
    if (saveGameButton) saveGameButton.disabled = true;

    narrativeDisplay.innerHTML = '<div class="loading">L\'IA génère la suite de votre aventure...</div>';


    const payload = {
        userId: currentUserId,
        displayName: playerDisplayName,
        playerName: currentStoryState.playerName,
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

        currentStoryState = newState;

        updateGameDisplay();
        appendStory(narration);
        showActions(options);

    } catch (error) {
        console.error('Erreur lors de l\'envoi au backend:', error);
        window.showAlert("Une erreur est survenue. Le tissu de l'Echo Verse vacille... (Voir la console pour plus de détails)", "error");
        narrativeDisplay.innerHTML = `<p class="error">Une erreur est survenue: ${error.message}. Veuillez réessayer.</p>`;
        showActions([]);
    } finally {
        if (actionsCard) actionsCard.style.pointerEvents = 'auto';
        if (takeCustomActionButton) takeCustomActionButton.textContent = 'Exécuter l\'action';
        if (saveGameButton) saveGameButton.disabled = false;
    }
}

// Fonction pour charger une session de jeu existante
async function loadGameSession(userId) {
    if (!userId) {
        console.warn("loadGameSession called without userId. Cannot load session.");
        window.showScreen('loginScreen');
        return;
    }
    
    // Logic for profile.html and history.html depends on this function.
    // We need to differentiate the call depending on the current page.
    const path = window.location.pathname;

    if (path === '/' || path.includes('index.html')) {
        try {
            const response = await fetch('/.netlify/functions/gemini-narrator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId, isStart: false, playerAction: "Charger session" }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn("Session non trouvée pour cet utilisateur, démarrage d'une nouvelle partie.");
                    window.showScreen('characterScreen');
                } else {
                    throw new Error(`Erreur HTTP: ${response.status} - ${await response.text()}`);
                }
            } else {
                const data = await response.json();
                currentStoryState = data.newState;

                window.showAlert(`Bienvenue de nouveau, ${currentStoryState.playerName} ! L'Echo Verse vous attend...`, "success");

                updateGameDisplay();
                appendStory(data.narration);

                window.showScreen('gameScreen');
                showActions([]); // Show free input by default after load
            }
        } catch (error) {
            console.error('Erreur lors du chargement de la session:', error);
            window.showAlert("Impossible de charger la session. Veuillez démarrer une nouvelle partie.", "error");
            window.showScreen('characterScreen');
        }
    } else if (path.includes('profile.html')) {
        const profilePlayerName = document.getElementById('profile-player-name');
        if (userId) {
            try {
                const response = await fetch('/.netlify/functions/gemini-narrator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId, isStart: false, playerAction: "Charger session pour profil" }),
                });

                if (response.ok) {
                    const data = await response.json();
                    currentStoryState = data.newState;
                    if (profilePlayerName) profilePlayerName.textContent = currentStoryState.playerName || 'N/A';
                    if (document.getElementById('profile-player-archetype')) document.getElementById('profile-player-archetype').textContent = currentStoryState.playerArchetype || 'N/A';
                    if (document.getElementById('profile-player-description')) document.getElementById('profile-player-description').textContent = currentStoryState.playerDescription || 'N/A';
                    if (document.getElementById('profile-player-background')) document.getElementById('profile-player-background').textContent = currentStoryState.playerBackground || 'N/A';
                    if (document.getElementById('profile-game-mode')) document.getElementById('profile-game-mode').textContent = currentStoryState.gameMode || 'N/A';
                    if (document.getElementById('profile-vigor-value')) document.getElementById('profile-vigor-value').textContent = currentStoryState.attributes ? currentStoryState.attributes.vigor : 'N/A';
                    if (document.getElementById('profile-ingenuit-value')) document.getElementById('profile-ingenuit-value').textContent = currentStoryState.attributes ? currentStoryState.attributes.ingenity : 'N/A';
                    if (document.getElementById('profile-adaptation-value')) document.getElementById('profile-adaptation-value').textContent = currentStoryState.attributes ? currentStoryState.attributes.adaptation : 'N/A';
                    if (document.getElementById('profile-influence-value')) document.getElementById('profile-influence-value').textContent = currentStoryState.attributes ? currentStoryState.attributes.influence : 'N/A';
                    updateListDisplay(document.getElementById('profile-inventory-list'), currentStoryState.inventory, (item) => `${item.name} (${item.description})`, 'Aucun objet');
                    if (document.getElementById('profile-garde-chronique-relation')) document.getElementById('profile-garde-chronique-relation').textContent = currentStoryState.factionRelations ? currentStoryState.factionRelations.gardeChronique.relation : 'N/A';
                    if (document.getElementById('profile-flux-libres-relation')) document.getElementById('profile-flux-libres-relation').textContent = currentStoryState.factionRelations ? currentStoryState.factionRelations.fluxLibres.relation : 'N/A';
                    if (document.getElementById('profile-resonances-obscures-relation')) document.getElementById('profile-resonances-obscures-relation').textContent = currentStoryState.factionRelations ? currentStoryState.factionRelations.resonancesObscures.relation : 'N/A';
                    updateListDisplay(document.getElementById('profile-npcs-list'), currentStoryState.npcsMet, (npc) => `${npc.name} (${npc.relation || 'Inconnu'})`, 'Aucun PNJ');
                    updateListDisplay(document.getElementById('profile-quests-list'), currentStoryState.activeQuests, (quest) => `${quest.name} [${quest.status}]`, 'Aucune quête');
                    updateListDisplay(document.getElementById('profile-events-list'), currentStoryState.majorWorldEvents, (event) => `${event.description}`, 'Aucun événement');

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
    } else if (path.includes('history.html')) {
        const sessionsHistoryList = document.getElementById('sessions-history-list');
        if (userId) {
            try {
                 const response = await fetch('/.netlify/functions/gemini-narrator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId, isStart: false, playerAction: "Charger session pour historique" }),
                });

                if (response.ok) {
                    const data = await response.json();
                    currentStoryState = data.newState;
                    if (sessionsHistoryList) {
                        sessionsHistoryList.innerHTML = '';
                        if (currentStoryState.history && currentStoryState.history.length > 0) {
                            currentStoryState.history.forEach(entry => {
                                const li = document.createElement('li');
                                li.textContent = `${entry.type === 'player' ? 'Joueur' : 'MJ'} : ${entry.text.substring(0, 100)}...`;
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
}


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
    
    if (auth) {
        signOut(auth).then(() => {
            localStorage.removeItem('echoVerseSessionId');
            currentStoryState = {};
            window.showAlert('Jeu réinitialisé. Toutes les données ont été supprimées pour cet utilisateur.', 'success');
            window.showScreen('loginScreen');
            if (displayNameInput) displayNameInput.value = '';
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
