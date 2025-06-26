// Importations Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variables globales de l'environnement Canvas (seront injectées au runtime)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialiser Firebase (une seule fois pour toute l'application)
let app;
let auth;
let db;

// NOUVELLE VÉRIFICATION DE LA CLÉ API
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.trim() === '') {
    console.error("Firebase API Key is missing or empty in firebaseConfig.");
    window.showAlert("Erreur de configuration Firebase: Clé API manquante ou invalide. Veuillez vérifier la variable '__firebase_config' sur Netlify et assurez-vous que 'apiKey' est correctement configurée dans votre projet Firebase.", "error");
} else {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase initialized successfully.");
    } catch (error) {
        console.error("Failed to initialize Firebase:", error);
        window.showAlert("Erreur d'initialisation de Firebase. Veuillez vérifier votre configuration Firebase sur Netlify. Erreur: " + error.message, "error");
    }
}


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
    
    // Ajoute la classe de type au contenu de la modal pour le stylisme
    modalMessage.parentNode.classList.remove('error', 'success', 'info');
    modalMessage.parentNode.classList.add(type);

    customAlertModal.style.display = 'flex'; // S'assure que l'overlay est visible

    const closeModal = () => {
        customAlertModal.style.display = 'none';
        customAlertModal.classList.remove('active'); // Retire la classe active après la fermeture
    };

    modalOkButton.onclick = closeModal;
    closeButton.onclick = closeModal;
    // Ferme la modal si l'utilisateur clique en dehors du contenu
    customAlertModal.onclick = (event) => {
        if (event.target === customAlertModal) {
            closeModal();
        }
    };
};

// Fonction pour gérer l'affichage des différents écrans du jeu
window.showScreen = (screenId) => {
    console.log(`Attempting to show screen: ${screenId}`);
    // Cache tous les écrans
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none'; // Cacher explicitement pour éviter les chevauchements visuels
    });
    // Affiche l'écran cible
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        targetScreen.style.display = 'flex'; // Afficher explicitement
        console.log(`Screen ${screenId} is now active and visible.`);
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
    element.innerHTML = ''; // Vide la liste existante
    if (items && items.length > 0) {
        items.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = displayFunc(item); // Utilise une fonction de display spécifique pour chaque type d'élément
            element.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        // Détermine le type d'objet pour le texte par défaut
        const itemType = element.id.includes('inventory') ? 'objet' :
                         element.id.includes('npcs') ? 'PNJ' :
                         element.id.includes('quests') ? 'quête' : 'événement';
        li.textContent = `${defaultText} ${itemType}`;
        element.appendChild(li);
    }
}


// --- Initialisation du DOM et Attachement des Écouteurs d'Événements ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOMContentLoaded fired. Retrieving DOM elements...");
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

    // Vérification des éléments cruciaux pour le débogage (avec plus de détails)
    console.log("Status des éléments DOM clés au chargement:");
    console.log(`displayNameInput (ID: displayName): ${displayNameInput ? 'Found' : 'NOT FOUND'}`);
    console.log(`createUserButton (ID: createUserButton): ${createUserButton ? 'Found' : 'NOT FOUND'}`);
    console.log(`signInAnonButton (ID: signInAnonButton): ${signInAnonButton ? 'Found' : 'NOT FOUND'}`);
    console.log(`characterNameInput (ID: characterName): ${characterNameInput ? 'Found' : 'NOT FOUND'}`);
    console.log(`archetypeSelect (ID: archetype): ${archetypeSelect ? 'Found' : 'NOT FOUND'}`);
    console.log(`saveCharacterButton (ID: saveCharacterButton): ${saveCharacterButton ? 'Found' : 'NOT FOUND'}`);
    console.log(`gameModeSelect (ID: gameModeSelect): ${gameModeSelect ? 'Found' : 'NOT FOUND'}`);
    console.log(`startGameButton (ID: startGameButton): ${startGameButton ? 'Found' : 'NOT FOUND'}`);
    console.log(`loginScreen (ID: loginScreen): ${loginScreen ? 'Found' : 'NOT FOUND'}`);
    console.log(`characterScreen (ID: characterScreen): ${characterScreen ? 'Found' : 'NOT FOUND'}`);
    console.log(`modeScreen (ID: modeScreen): ${modeScreen ? 'Found' : 'NOT FOUND'}`);
    console.log(`gameScreen (ID: gameScreen): ${gameScreen ? 'Found' : 'NOT FOUND'}`);


    // Attacher les écouteurs d'événements
    if (createUserButton) {
        createUserButton.addEventListener('click', createUser);
        console.log("Event listener attached to createUserButton.");
    } else {
        console.error("createUserButton not found. Cannot attach listener.");
    }
    if (signInAnonButton) {
        signInAnonButton.addEventListener('click', signInAnonymouslyUser);
        console.log("Event listener attached to signInAnonButton.");
    } else {
        console.error("signInAnonButton not found. Cannot attach listener.");
    }
    if (saveCharacterButton) {
        saveCharacterButton.addEventListener('click', saveCharacter);
        console.log("Event listener attached to saveCharacterButton.");
    } else {
        console.error("saveCharacterButton not found. Cannot attach listener.");
    }
    if (startGameButton) {
        startGameButton.addEventListener('click', startGame);
        console.log("Event listener attached to startGameButton.");
    } else {
        console.error("startGameButton not found. Cannot attach listener.");
    }
    if (takeCustomActionButton) {
        takeCustomActionButton.addEventListener('click', takeCustomAction);
        console.log("Event listener attached to takeCustomActionButton.");
    } else {
        console.error("takeCustomActionButton not found. Cannot attach listener.");
    }
    if (newAdventureButton) {
        newAdventureButton.addEventListener('click', newAdventure);
        console.log("Event listener attached to newAdventureButton.");
    } else {
        console.error("newAdventureButton not found. Cannot attach listener.");
    }
    if (quitGameButton) {
        quitGameButton.addEventListener('click', signOutUser); // Changed to signOutUser for consistency
        console.log("Event listener attached to quitGameButton (signOutUser).");
    } else {
        console.error("quitGameButton not found. Cannot attach listener.");
    }
    if (saveGameButton) {
        saveGameButton.addEventListener('click', saveGame);
        console.log("Event listener attached to saveGameButton.");
    } else {
        console.error("saveGameButton not found. Cannot attach listener.");
    }
    if (signOutButton) { // Ensure signOutButton has a listener
        signOutButton.addEventListener('click', signOutUser);
        console.log("Event listener attached to signOutButton.");
    } else {
        console.error("signOutButton not found. Cannot attach listener.");
    }
    
    if (customActionTextarea) {
        customActionTextarea.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                takeCustomActionButton.click();
            }
        });
        console.log("Event listener attached to customActionTextarea (keypress).");
    } else {
        console.error("customActionTextarea not found. Cannot attach keypress listener.");
    }

    // Lancement initial de l'authentification Firebase
    // Seulement si Firebase a été initialisé avec succès
    if (auth) { 
        initFirebaseAuth();
    } else {
        console.error("Firebase auth is not initialized. Cannot proceed with initFirebaseAuth.");
        // showAlert sera déjà affichée si firebaseConfig.apiKey était manquante
    }
});

// --- Fonctions d'Authentification Firebase ---

async function initFirebaseAuth() {
    console.log("initFirebaseAuth called. Setting up onAuthStateChanged listener.");
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            if (userIdDisplay) userIdDisplay.textContent = currentUserId;
            console.log("Firebase Authentified, User ID:", currentUserId);

            const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
            // On utilise get() pour vérifier si le profil existe
            const userProfileSnap = await getDoc(userProfileRef);

            if (userProfileSnap.exists() && userProfileSnap.data().displayName) {
                playerDisplayName = userProfileSnap.data().displayName;
                if (displayNameValue) displayNameValue.textContent = playerDisplayName;
                if (characterNameInput) {
                    characterNameInput.value = playerDisplayName;
                    characterNameInput.disabled = true; // Empêche de modifier le nom du personnage s'il est déjà défini par le nom d'affichage
                }
                console.log(`User profile found: DisplayName=${playerDisplayName}. Attempting to load game session.`);
                // Tente de charger la session existante, sinon passe à la création de personnage
                await loadGameSession(currentUserId); 
            } else {
                // Si pas de profil ou pas de displayName, on demande le displayName
                playerDisplayName = null;
                if (displayNameValue) displayNameValue.textContent = 'Non défini';
                console.log("User profile or display name not found. Showing loginScreen.");
                window.showScreen('loginScreen');
                window.showAlert("Choisissez un nom d'affichage unique pour votre voyage dans l'Echo Verse. Il ne pourra pas être changé ensuite.", "info");
            }
        } else {
            // Utilisateur déconnecté ou n'a jamais été authentifié
            currentUserId = null;
            playerDisplayName = null;
            if (userIdDisplay) userIdDisplay.textContent = 'Non connecté';
            if (displayNameValue) displayNameValue.textContent = 'Non connecté';
            console.log("Firebase Not Authenticated. Showing loginScreen.");
            window.showScreen('loginScreen');
            if (characterNameInput) {
                characterNameInput.value = '';
                characterNameInput.disabled = false; // Réactive l'input si pas de nom d'affichage
            }
            window.showAlert("Veuillez vous connecter pour sauvegarder votre progression. Vous pouvez également continuer anonymement, mais votre partie ne sera pas sauvegardée.", "info");
        }
    });

    // Tentative d'authentification initiale (avec token Canvas ou anonyme)
    try {
        if (initialAuthToken) {
            console.log("Attempting signInWithCustomToken with initialAuthToken...");
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            console.log("Attempting signInAnonymously if no custom token...");
            await signInAnonymously(auth);
        }
    } catch (error) {
        console.error("Initial authentication attempt failed:", error);
        // onAuthStateChanged gérera le basculement vers loginScreen en cas d'échec
    }
}

async function createUser() {
    console.log("createUser function called (from Commencer l'aventure button).");
    const newDisplayName = displayNameInput.value.trim();
    if (!auth || !db) { // Vérifie que Firebase est initialisé
        window.showAlert("Le service Firebase n'est pas disponible. Impossible de créer l'utilisateur.", "error");
        console.error("Firebase services not initialized in createUser.");
        return;
    }

    if (newDisplayName.length < 3 || newDisplayName.length > 20) {
        const loginErrorElement = document.getElementById('loginError');
        if (loginErrorElement) {
            loginErrorElement.textContent = "Le nom d'affichage doit contenir entre 3 et 20 caractères.";
            loginErrorElement.style.display = 'block';
        }
        console.warn("Display name validation failed.");
        return;
    }
    const loginErrorElement = document.getElementById('loginError');
    if (loginErrorElement) loginErrorElement.style.display = 'none';

    try {
        // Si l'utilisateur n'est pas déjà authentifié (ex: anonyme par défaut du Canvas), on le connecte anonymement.
        // onAuthStateChanged se déclenchera et mettra à jour currentUserId.
        if (!currentUserId) {
            console.log("No currentUserId detected, signing in anonymously before setting display name...");
            await signInAnonymously(auth);
            // Attendre que onAuthStateChanged mette à jour currentUserId
            await new Promise(resolve => {
                const unsubscribe = onAuthStateChanged(auth, user => {
                    if (user) {
                        unsubscribe();
                        resolve();
                    }
                });
            });
            console.log("Anonymous sign-in complete for display name setting. New userId:", currentUserId);
        }
        
        // Maintenant que currentUserId est garanti d'être non-null, sauvegardez le displayName
        const userProfileRef = doc(db, 'artifacts', appId, 'users', currentUserId);
        await setDoc(userProfileRef, { displayName: newDisplayName, lastUpdated: new Date() }, { merge: true });
        
        playerDisplayName = newDisplayName; // Mise à jour de l'état local
        if (displayNameValue) displayNameValue.textContent = playerDisplayName;
        if (characterNameInput) {
            characterNameInput.value = playerDisplayName;
            characterNameInput.disabled = true; // Désactive l'input une fois le nom d'affichage défini
        }
        
        window.showAlert(`Votre nom d'affichage "${newDisplayName}" a été enregistré.`, "success");
        window.showScreen('characterScreen'); // Passe à l'écran de création de personnage
        console.log("User created and display name saved. Transitioning to characterScreen.");
    } catch (error) {
        console.error("Error creating user or saving display name:", error);
        window.showAlert("Erreur lors de la connexion/enregistrement. Veuillez réessayer.", "error");
    }
}

async function signInAnonymouslyUser() {
    console.log("signInAnonymouslyUser function called (from Continuer sans sauvegarder button).");
    if (!auth) { // Vérifie que Firebase Auth est initialisé
        window.showAlert("Le service d'authentification Firebase n'est pas disponible.", "error");
        console.error("Firebase auth not initialized in signInAnonymouslyUser.");
        return;
    }
    try {
        await signInAnonymously(auth);
        window.showAlert("Vous jouez maintenant en mode anonyme. Votre progression ne sera pas sauvegardée.", "info");
        // onAuthStateChanged gérera la transition d'écran après la connexion anonyme
        console.log("Anonymous sign-in successful.");
    } catch (error) {
        console.error("Error signing in anonymously:", error);
        window.showAlert("Erreur de connexion anonyme. Veuillez réessayer.", "error");
    }
}

async function signOutUser() {
    console.log("signOutUser function called.");
    if (!auth) { // Vérifie que Firebase Auth est initialisé
        window.showAlert("Le service d'authentification Firebase n'est pas disponible.", "error");
        console.error("Firebase auth not initialized in signOutUser.");
        return;
    }
    try {
        await signOut(auth);
        window.showAlert("Vous avez été déconnecté.", "info");
        // Réinitialise l'état du jeu et les variables d'affichage
        currentStoryState = {};
        playerDisplayName = null;
        if (characterNameInput) {
            characterNameInput.value = '';
            characterNameInput.disabled = false; // Réactive l'input pour un nouveau personnage
        }
        window.showScreen('loginScreen'); // Retourne à l'écran de connexion
        if (displayNameInput) displayNameInput.value = ''; // Vide l'input du nom d'affichage
        console.log("User signed out. Resetting state and showing loginScreen.");
    } catch (error) {
        console.error("Error signing out:", error);
        window.showAlert("Erreur lors de la déconnexion. Veuillez réessayer.", "error");
    }
}


// --- Fonctions de Gestion du Jeu ---

async function saveCharacter() {
    console.log("saveCharacter function called.");
    if (!db) { // Vérifie que Firestore est initialisé
        window.showAlert("Le service de base de données n'est pas disponible. Impossible de sauvegarder le personnage.", "error");
        console.error("Firestore not initialized in saveCharacter.");
        return;
    }

    const characterName = characterNameInput.value.trim();
    const archetype = archetypeSelect.value;
    const description = descriptionTextarea.value.trim();
    const background = backgroundTextarea.value.trim();
    
    if (!characterName || !archetype || !description || !background) {
        window.showAlert('Veuillez remplir tous les champs (Nom, Archétype, Description, Passé) pour votre personnage.', 'error');
        return;
    }
    console.log("Character data collected. Initializing currentStoryState with provided data.");

    currentStoryState = {
        playerName: characterName,
        playerArchetype: archetype,
        playerDescription: description,
        playerBackground: background,
        gameMode: '', // Le mode de jeu sera défini à l'étape suivante
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
    
    // Seulement sauvegarder si l'utilisateur est authentifié
    if (currentUserId) {
        try {
            console.log("Saving initial character state to Firestore for userId:", currentUserId);
            const userSessionRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'sessions', 'current');
            await setDoc(userSessionRef, currentStoryState, { merge: true });
            window.showAlert('Personnage créé et sauvegardé !', 'success');
            window.showScreen('modeScreen'); // Passe à l'écran de sélection de mode
            console.log("Character saved. Transitioning to modeScreen.");
        } catch (error) {
            console.error("Error saving initial character:", error);
            window.showAlert("Erreur lors de la sauvegarde du personnage. Veuillez réessayer.", "error");
        }
    } else {
        // Cas rare où l'utilisateur n'est plus authentifié après avoir rempli le formulaire
        console.error("Error: currentUserId is null during saveCharacter. User not authenticated?");
        window.showAlert("Erreur: Utilisateur non authentifié. Veuillez vous connecter ou continuer anonymement d'abord.", "error");
        window.showScreen('loginScreen');
    }
}

async function startGame() {
    console.log("startGame function called.");
    const mode = gameModeSelect.value;
    if (!mode) {
        window.showAlert('Veuillez choisir un mode de jeu pour démarrer l\'aventure.', 'info');
        return;
    }
    console.log("Game mode selected:", mode);

    currentStoryState.gameMode = mode; // Met à jour le mode de jeu dans l'état de la session
    
    window.showScreen('gameScreen'); // Affiche l'écran de jeu
    console.log("Transitioned to gameScreen.");

    if (narrativeDisplay) {
        narrativeDisplay.innerHTML = '<div class="loading">Génération de votre aventure...</div>'; // Affiche un message de chargement
    } else {
        console.error("narrativeDisplay element not found. Cannot show loading message.");
        window.showAlert("Erreur: l'élément d'affichage narratif est manquant.", "error");
        return;
    }
    
    console.log("Sending initial game start payload to backend.");
    // Envoie la première requête à l'IA pour générer le début de l'histoire
    await sendToBackend(`Démarrer l'aventure en tant que ${currentStoryState.playerArchetype} : "${currentStoryState.playerDescription}", avec un passé "${currentStoryState.playerBackground}" en mode ${currentStoryState.gameMode}`, true);
}

function updateGameDisplay() {
    console.log("updateGameDisplay called. Current state:", currentStoryState);
    // Met à jour le nom du joueur et l'ID dans la sidebar
    if (playerNameDisplay) playerNameDisplay.textContent = 
        `${currentStoryState.playerName} (${playerDisplayName || 'Anonyme'})`;
    
    // Met à jour les attributs
    if (vigorValue) vigorValue.textContent = currentStoryState.attributes.vigor;
    if (ingenuityValue) ingenuityValue.textContent = currentStoryState.attributes.ingenuity;
    if (adaptationValue) adaptationValue.textContent = currentStoryState.attributes.adaptation;
    if (influenceValue) influenceValue.textContent = currentStoryState.attributes.influence;
    
    // Met à jour la narration principale
    if (narrativeDisplay) {
        narrativeDisplay.innerHTML = currentStoryState.history
            .filter(entry => entry.type === 'gemini') // N'affiche que la narration de l'IA
            .map(entry => `<p>${entry.text}</p>`)
            .join('');
        narrativeDisplay.scrollTop = narrativeDisplay.scrollHeight; // Défilement vers le bas
    } else {
        console.warn("narrativeDisplay not found during updateGameDisplay. Cannot update narrative.");
    }

    // Met à jour l'inventaire
    updateListDisplay(inventoryGrid, currentStoryState.inventory, (item) => `${item.name} (${item.description})`, 'Aucun objet');
    if (inventoryCard) inventoryCard.style.display = currentStoryState.inventory.length > 0 ? 'block' : 'none';

    // Met à jour les relations de faction
    if (currentStoryState.factionRelations) {
        if (gardeChroniqueRelation) gardeChroniqueRelation.textContent = currentStoryState.factionRelations.gardeChronique.relation;
        if (fluxLibresRelation) fluxLibresRelation.textContent = currentStoryState.factionRelations.fluxLibres.relation;
        if (resonancesObscuresRelation) resonancesObscuresRelation.textContent = currentStoryState.factionRelations.resonancesObscures.relation;
    }
    // Met à jour les PNJ, Quêtes et Événements
    updateListDisplay(npcsList, currentStoryState.npcsMet, (npc) => `${npc.name} (${npc.relation || 'Inconnu'})`, 'Aucun PNJ');
    updateListDisplay(questsList, currentStoryState.activeQuests, (quest) => `${quest.name} [${quest.status}]`, 'Aucune quête');
    updateListDisplay(eventsList, currentStoryState.majorWorldEvents, (event) => `${event.description}`, 'Aucun événement');
    console.log("Game display updated successfully.");
}

function appendStory(text) {
    if (!narrativeDisplay) {
        console.error("narrativeDisplay element is null. Cannot append story.");
        return;
    }
    // Remplace les <br> pour un meilleur formatage
    const formattedText = text.replace(/<br>/g, '<br><br>');
    const p = document.createElement('p');
    p.innerHTML = formattedText;
    narrativeDisplay.appendChild(p);
    narrativeDisplay.scrollTop = narrativeDisplay.scrollHeight; // Défilement automatique
    console.log("Story appended to narrative display.");
}


function showActions(options) {
    console.log("showActions called with options:", options);
    if (!actionsCard || !choicesContainer || !customActionTextarea || !takeCustomActionButton) {
        console.error("Action elements not found in showActions. Cannot display actions.");
        return;
    }

    actionsCard.style.display = 'block'; // S'assure que la carte d'actions est visible
    choicesContainer.innerHTML = ''; // Vide les anciennes options

    if (options && options.length > 0) {
        console.log("Displaying multiple choice options.");
        options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'choice-btn btn'; // Ajoute la classe 'btn' pour le style
            button.textContent = option;
            button.addEventListener('click', () => sendToBackend(option));
            choicesContainer.appendChild(button);
        });
        customActionTextarea.style.display = 'none'; // Cache l'input libre
        takeCustomActionButton.style.display = 'none'; // Cache le bouton d'action libre
    } else {
        console.log("Displaying free text input.");
        customActionTextarea.style.display = 'block'; // Affiche l'input libre
        takeCustomActionButton.style.display = 'block'; // Affiche le bouton d'action libre
    }
}

function takeCustomAction() {
    console.log("takeCustomAction function called (from Exécuter l'action button).");
    const customAction = customActionTextarea.value.trim();
    if (!customAction) {
        window.showAlert('Veuillez décrire votre action.', 'info');
        return;
    }
    console.log("Custom action:", customAction);
    sendToBackend(customAction);
    customActionTextarea.value = ''; // Vide l'input après l'envoi
}

async function saveGame() {
    console.log("saveGame function called.");
    if (!currentUserId || !db) { // Vérifie que l'utilisateur est connecté et Firestore est initialisé
        window.showAlert("Vous devez être connecté et les services Firebase doivent être disponibles pour sauvegarder votre partie.", "error");
        console.error("Firebase services not available or user not logged in for saveGame.");
        return;
    }
    try {
        const userSessionRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'sessions', 'current');
        await setDoc(userSessionRef, currentStoryState, { merge: true });
        
        const originalText = saveGameButton.textContent;
        saveGameButton.textContent = '✅ Sauvegardé !'; // Feedback visuel
        saveGameButton.classList.add('success');
        
        setTimeout(() => { // Réinitialise le bouton après 2 secondes
            saveGameButton.textContent = originalText;
            saveGameButton.classList.remove('success');
        }, 2000);

        window.showAlert('Partie sauvegardée avec succès !', 'success');
        console.log("Game saved successfully.");
    } catch (error) {
        console.error("Error saving game:", error);
        window.showAlert("Erreur lors de la sauvegarde de la partie. Veuillez réessayer.", "error");
    }
}

function newAdventure() {
    console.log("newAdventure function called.");
    window.showAlert("Lancement d'une nouvelle aventure... Votre partie actuelle ne sera pas sauvegardée si vous n'êtes pas connecté.", "info");
    currentStoryState = {}; // Réinitialise l'état du jeu
    window.showScreen('characterScreen'); // Retourne à l'écran de création de personnage
    // Réinitialise les champs du formulaire
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
    console.log("New adventure initiated. Resetting UI elements and transitioning to characterScreen.");
}

function quitGame() { 
    console.log("quitGame function called. Redirecting to signOutUser.");
    signOutUser(); // Utilise la fonction de déconnexion pour quitter proprement
}

async function sendToBackend(action, isStart = false) {
    console.log(`sendToBackend called. Action: "${action}", isStart: ${isStart}`);
    if (!currentUserId) {
        window.showAlert("Vous n'êtes pas connecté. Veuillez vous connecter ou jouer anonymement pour commencer.", "error");
        window.showScreen('loginScreen');
        console.warn("sendToBackend aborted: No currentUserId.");
        return;
    }
    if (!playerDisplayName) {
        window.showAlert("Veuillez choisir un nom d'affichage avant de commencer l'aventure.", "error");
        window.showScreen('loginScreen');
        console.warn("sendToBackend aborted: No playerDisplayName.");
        return;
    }

    // Affiche l'action du joueur dans l'historique de la narration
    if (!isStart && currentStoryState.playerName) {
        appendStory(`\n> ${currentStoryState.playerName} : ${action}\n`);
    }

    // Désactive les éléments interactifs pendant le traitement de l'IA
    if (actionsCard) actionsCard.style.pointerEvents = 'none';
    if (takeCustomActionButton) takeCustomActionButton.textContent = 'Réflexion en cours...';
    if (saveGameButton) saveGameButton.disabled = true;

    // Affiche un message de chargement dans la zone de narration
    if (narrativeDisplay) narrativeDisplay.innerHTML = '<div class="loading">L\'IA génère la suite de votre aventure...</div>';
    else {
        console.error("narrativeDisplay not found. Cannot show loading message.");
        window.showAlert("Erreur interne : Élément narratif introuvable.", "error");
        return;
    }


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
    console.log("Payload sent to backend:", payload);

    try {
        // Envoi de la requête à la fonction Netlify
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
        console.log("Response from backend:", data);

        currentStoryState = newState; // Met à jour l'état du jeu avec la réponse du backend

        updateGameDisplay(); // Met à jour tous les éléments de l'UI (stats, inventaire, etc.)
        appendStory(narration); // Ajoute la nouvelle narration
        showActions(options); // Affiche les nouvelles options ou l'input libre

    } catch (error) {
        console.error('Error sending to backend:', error);
        window.showAlert("Une erreur est survenue. Le tissu de l'Echo Verse vacille... (Voir la console pour plus de détails)", "error");
        if (narrativeDisplay) narrativeDisplay.innerHTML = `<p class="error">Une erreur est survenue: ${error.message}. Veuillez réessayer.</p>`;
        showActions([]); // Affiche l'input libre en cas d'erreur
    } finally {
        // Réactive les éléments interactifs
        if (actionsCard) actionsCard.style.pointerEvents = 'auto';
        if (takeCustomActionButton) takeCustomActionButton.textContent = 'Exécuter l\'action';
        if (saveGameButton) saveGameButton.disabled = false;
        console.log("Backend request complete. Re-enabling actions.");
    }
}

// Fonction pour charger une session de jeu existante
// Cette fonction est appelée par initFirebaseAuth si une session est détectée
async function loadGameSession(userId) {
    console.log("loadGameSession called for userId:", userId);
    if (!userId || !db) { // Vérifie que Firestore est initialisé
        console.warn("loadGameSession called without userId or Firestore not initialized. Cannot load session.");
        window.showAlert("Les services Firebase ne sont pas disponibles. Impossible de charger la session.", "error");
        window.showScreen('loginScreen');
        return;
    }
    
    // On doit distinguer l'appel selon la page pour laquelle la session est chargée
    // (index.html, profile.html, history.html)
    const path = window.location.pathname;

    // Logique pour index.html (la page de jeu principale)
    if (path === '/' || path.includes('index.html')) {
        try {
            console.log("Loading session for index.html from backend...");
            const response = await fetch('/.netlify/functions/gemini-narrator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId, isStart: false, playerAction: "Charger session" }),
            });

            if (!response.ok) {
                // Si la session n'est pas trouvée (status 404), on démarre une nouvelle partie
                if (response.status === 404) {
                    console.warn("Session not found for this user, starting a new game (character creation screen).");
                    window.showScreen('characterScreen');
                } else {
                    // Pour toute autre erreur HTTP, on la propage
                    throw new Error(`Erreur HTTP: ${response.status} - ${await response.text()}`);
                }
            } else {
                // Session trouvée et chargée
                const data = await response.json();
                currentStoryState = data.newState;
                console.log("Session loaded successfully. State:", currentStoryState);

                window.showAlert(`Bienvenue de nouveau, ${currentStoryState.playerName || playerDisplayName} ! L'Echo Verse vous attend...`, "success");

                updateGameDisplay(); // Met à jour l'UI du jeu
                appendStory(data.narration); // Affiche la dernière narration

                window.showScreen('gameScreen'); // Affiche l'écran de jeu
                showActions([]); // Affiche l'input libre par défaut après le chargement
                console.log("Game screen displayed with loaded session.");
            }
        } catch (error) {
            console.error('Error loading session for index.html:', error);
            window.showAlert("Impossible de charger la session. Veuillez démarrer une nouvelle partie.", "error");
            window.showScreen('characterScreen'); // En cas d'erreur de chargement, proposer une nouvelle partie
        }
    } else if (path.includes('profile.html')) {
        // Logique spécifique pour profile.html
        const profilePlayerName = document.getElementById('profile-player-name');
        if (userId) {
            console.log("Loading profile data for profile.html...");
            try {
                const response = await fetch('/.netlify/functions/gemini-narrator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId, isStart: false, playerAction: "Charger session pour profil" }),
                });

                if (response.ok) {
                    const data = await response.json();
                    currentStoryState = data.newState;
                    console.log("Profile data loaded:", currentStoryState);
                    // Mise à jour des éléments de la page de profil
                    if (profilePlayerName) profilePlayerName.textContent = currentStoryState.playerName || 'N/A';
                    if (document.getElementById('profile-player-archetype')) document.getElementById('profile-player-archetype').textContent = currentStoryState.playerArchetype || 'N/A';
                    if (document.getElementById('profile-player-description')) document.getElementById('profile-player-description').textContent = currentStoryState.playerDescription || 'N/A';
                    if (document.getElementById('profile-player-background')) document.getElementById('profile-player-background').textContent = currentStoryState.playerBackground || 'N/A';
                    if (document.getElementById('profile-game-mode')) document.getElementById('profile-game-mode').textContent = currentStoryState.gameMode || 'N/A';
                    if (document.getElementById('profile-vigor-value')) document.getElementById('profile-vigor-value').textContent = currentStoryState.attributes ? currentStoryState.attributes.vigor : 'N/A';
                    if (document.getElementById('profile-ingenuit-value')) document.getElementById('profile-ingenuit-value').textContent = currentStoryState.attributes ? currentStoryState.attributes.ingenuity : 'N/A';
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
                    console.error('Failed to load profile data:', await response.text());
                    window.showAlert('Impossible de charger les données de votre profil.', "error");
                }
            } catch (error) {
                console.error('Error loading profile:', error);
                window.showAlert('Erreur lors du chargement des données de profil.', "error");
            }
        } else {
            if (profilePlayerName) profilePlayerName.textContent = 'Veuillez vous connecter pour voir votre profil.';
            if (document.getElementById('profile-display-name')) document.getElementById('profile-display-name').textContent = 'Non connecté';
        }
    } else if (path.includes('history.html')) {
        // Logique spécifique pour history.html
        const sessionsHistoryList = document.getElementById('sessions-history-list');
        if (userId) {
            console.log("Loading history data for history.html...");
            try {
                 const response = await fetch('/.netlify/functions/gemini-narrator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId, isStart: false, playerAction: "Charger session pour historique" }),
                });

                if (response.ok) {
                    const data = await response.json();
                    currentStoryState = data.newState;
                    console.log("History data loaded:", currentStoryState);
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
                    console.error('Failed to load history data:', await response.text());
                    window.showAlert('Impossible de charger les données de votre historique.', "error");
                }
            } catch (error) {
                console.error('Error loading history:', error);
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
        konamiCode = []; // Réinitialise le code Konami
    }
});

// Fonction pour réinitialiser complètement le jeu (pour développement)
function resetGame() {
    window.showAlert('Êtes-vous sûr de vouloir réinitialiser complètement le jeu ? Cela supprimera toutes les données sauvegardées localement et sur le cloud pour cet utilisateur.', 'info');
    
    // Logique de déconnexion et de réinitialisation
    if (auth) {
        signOut(auth).then(() => {
            localStorage.removeItem('echoVerseSessionId'); // Supprime l'ID de session locale
            currentStoryState = {}; // Vide l'état du jeu
            window.showAlert('Jeu réinitialisé. Toutes les données ont été supprimées pour cet utilisateur.', 'success');
            window.showScreen('loginScreen'); // Retourne à l'écran de connexion
            if (displayNameInput) displayNameInput.value = ''; // Vide le champ du nom d'affichage
        }).catch(error => {
            console.error("Erreur lors de la réinitialisation/déconnexion:", error);
            window.showAlert("Erreur lors de la réinitialisation du jeu. Veuillez vérifier votre connexion.", "error");
        });
    } else {
        // Fallback si pas d'auth (par exemple, en mode dev local sans Firebase config)
        localStorage.removeItem('echoVerseSessionId');
        currentStoryState = {};
        window.showAlert('Jeu réinitialisé localement. Veuillez recharger la page.', 'success');
        window.showScreen('loginScreen');
        if (displayNameInput) displayNameInput.value = '';
    }
}

// Ajouter la fonction reset au global pour le debugging (accessible via console du navigateur)
window.resetGame = resetGame;
