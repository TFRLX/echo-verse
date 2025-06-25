// Déclaration des éléments UI
const playerNameInput = document.getElementById('player-name-input');
const playerArchetypeSelect = document.getElementById('player-archetype-select');
const gameModeSelect = document.getElementById('game-mode-select');
const startAdventureButton = document.getElementById('start-adventure-button');
const startScreen = document.getElementById('start-screen');
const storyScreen = document.getElementById('story-screen');
const storyDisplay = document.getElementById('story-display');
const optionsDisplay = document.getElementById('options-display');
const freeTextInput = document.getElementById('free-text-input');
const actionInputField = document.getElementById('action-input-field');
const submitActionButton = document.getElementById('submit-action-button');
const saveGameButton = document.getElementById('save-game-button');

// UI pour les statistiques et inventaire (main game screen)
const vigorValue = document.getElementById('vigor-value');
const ingenuityValue = document.getElementById('ingenuity-value');
const adaptationValue = document.getElementById('adaptation-value');
const influenceValue = document.getElementById('influence-value');
const inventoryList = document.getElementById('inventory-list');
const gardeChroniqueRelation = document.getElementById('garde-chronique-relation');
const fluxLibresRelation = document.getElementById('flux-libres-relation');
const resonancesObscuresRelation = document.getElementById('resonances-obscures-relation');
const npcsList = document.getElementById('npcs-list');
const questsList = document.getElementById('quests-list');
const eventsList = document.getElementById('events-list');

// UI pour la page de profil (s'ils existent)
const profilePlayerName = document.getElementById('profile-player-name');
const profilePlayerArchetype = document.getElementById('profile-player-archetype');
const profileGameMode = document.getElementById('profile-game-mode');
const profileVigorValue = document.getElementById('profile-vigor-value');
const profileIngenuityValue = document.getElementById('profile-ingenuity-value');
const profileAdaptationValue = document.getElementById('profile-adaptation-value');
const profileInfluenceValue = document.getElementById('profile-influence-value');
const profileInventoryList = document.getElementById('profile-inventory-list');
const profileGardeChroniqueRelation = document.getElementById('profile-garde-chronique-relation');
const profileFluxLibresRelation = document.getElementById('profile-flux-libres-relation');
const profileResonancesObscuresRelation = document.getElementById('profile-resonances-obscures-relation');
const profileNpcsList = document.getElementById('profile-npcs-list');
const profileQuestsList = document.getElementById('profile-quests-list');
const profileEventsList = document.getElementById('profile-events-list');

// UI pour la page d'historique (s'ils existent)
const sessionsHistoryList = document.getElementById('sessions-history-list');

// Éléments de la modal personnalisée
const customAlertModal = document.getElementById('custom-alert-modal');
const modalMessage = document.getElementById('modal-message');
const modalOkButton = document.getElementById('modal-ok-button');
const closeButton = document.querySelector('.close-button');


// --- Variables globales de Firebase (rendues disponibles par le script dans index.html) ---
let firebaseApp;
let firebaseAuth;
let firestoreDb;
let canvasAppId;
let currentUserId = null; // Cet ID est maintenant géré par Firebase Auth dans index.html

// État de la partie
let currentStoryState = {}; // Sera chargé/mis à jour par le backend

// Fonction utilitaire pour afficher la modal personnalisée
window.showAlert = (message, type = 'info') => {
    modalMessage.textContent = message;
    customAlertModal.classList.add('active'); // Afficher l'overlay
    
    // Réinitialiser les classes de type et appliquer la bonne
    modalMessage.parentNode.classList.remove('error', 'success', 'info');
    modalMessage.parentNode.classList.add(type);

    customAlertModal.style.display = 'flex'; // Assurez-vous que l'overlay est affiché
};

// Fermer la modal
const closeModal = () => {
    customAlertModal.style.display = 'none';
    customAlertModal.classList.remove('active');
};

modalOkButton.addEventListener('click', closeModal);
closeButton.addEventListener('click', closeModal);
window.addEventListener('click', (event) => {
    if (event.target === customAlertModal) {
        closeModal();
    }
});


// Fonction pour gérer l'affichage des écrans (chargement, auth, début, jeu)
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}


// Fonction utilitaire pour gérer les mises à jour des listes UI (inventaire, PNJ, quêtes, événements)
function updateListDisplay(element, items, displayFunc, defaultText = 'Aucun') {
    if (!element) return; // S'assurer que l'élément existe sur la page
    element.innerHTML = ''; // Vide la liste existante
    if (items && items.length > 0) {
        items.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = displayFunc(item); // Utilise une fonction de display spécifique pour chaque type d'élément
            element.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = `${defaultText} ${element.id.includes('inventory') ? 'objet' : element.id.includes('npcs') ? 'PNJ' : element.id.includes('quests') ? 'quête' : 'événement'}`;
        element.appendChild(li);
    }
}

// Fonctions de mise à jour de l'UI du jeu principal
function appendStory(text) {
    const formattedText = text.replace(/<br>/g, '<br><br>');
    const p = document.createElement('p');
    p.innerHTML = formattedText;
    storyDisplay.appendChild(p);
    storyDisplay.scrollTop = storyDisplay.scrollHeight;
}

function displayOptions(options) {
    optionsDisplay.innerHTML = '';
    freeTextInput.style.display = 'none';
    optionsDisplay.style.display = 'flex';
    options.forEach(option => {
        const button = document.createElement('button');
        button.textContent = option;
        button.addEventListener('click', () => sendToBackend(option));
        optionsDisplay.appendChild(button);
    });
}

function displayFreeTextInput() {
    optionsDisplay.style.display = 'none';
    freeTextInput.style.display = 'block';
    actionInputField.value = '';
    actionInputField.focus();
}

function updateGameUI() {
    if (currentStoryState.attributes) {
        vigorValue.textContent = currentStoryState.attributes.vigor;
        ingenuityValue.textContent = currentStoryState.attributes.ingenuity;
        adaptationValue.textContent = currentStoryState.attributes.adaptation;
        influenceValue.textContent = currentStoryState.attributes.influence;
    }
    updateListDisplay(inventoryList, currentStoryState.inventory, (item) => `${item.name} (${item.description})`, 'Aucun');
    if (currentStoryState.factionRelations) {
        gardeChroniqueRelation.textContent = currentStoryState.factionRelations.gardeChronique.relation;
        fluxLibresRelation.textContent = currentStoryState.factionRelations.fluxLibres.relation;
        resonancesObscuresRelation.textContent = currentStoryState.factionRelations.resonancesObscures.relation;
    }
    updateListDisplay(npcsList, currentStoryState.npcsMet, (npc) => `${npc.name} (${npc.relation || 'Inconnu'})`, 'Aucun');
    updateListDisplay(questsList, currentStoryState.activeQuests.filter(q => q.status === 'Active'), (quest) => `${quest.name} [${quest.status}]`, 'Aucune');
    updateListDisplay(eventsList, currentStoryState.majorWorldEvents, (event) => `${event.description}`, 'Aucun');
}

// Fonctions de mise à jour de l'UI de la page de profil
function updateProfileUI() {
    if (profilePlayerName) profilePlayerName.textContent = currentStoryState.playerName || 'N/A';
    if (profilePlayerArchetype) profilePlayerArchetype.textContent = currentStoryState.playerArchetype || 'N/A';
    if (profileGameMode) profileGameMode.textContent = currentStoryState.gameMode || 'N/A';

    if (profileVigorValue) profileVigorValue.textContent = currentStoryState.attributes ? currentStoryState.attributes.vigor : 'N/A';
    if (profileIngenuityValue) profileIngenuityValue.textContent = currentStoryState.attributes ? currentStoryState.attributes.ingenuity : 'N/A';
    if (profileAdaptationValue) profileAdaptationValue.textContent = currentStoryState.attributes ? currentStoryState.attributes.adaptation : 'N/A';
    if (profileInfluenceValue) profileInfluenceValue.textContent = currentStoryState.attributes ? currentStoryState.attributes.influence : 'N/A';

    if (profileInventoryList) updateListDisplay(profileInventoryList, currentStoryState.inventory, (item) => `${item.name} (${item.description})`, 'Aucun');

    if (profileGardeChroniqueRelation) profileGardeChroniqueRelation.textContent = currentStoryState.factionRelations ? currentStoryState.factionRelations.gardeChronique.relation : 'N/A';
    if (profileFluxLibresRelation) profileFluxLibresRelation.textContent = currentStoryState.factionRelations ? currentStoryState.factionRelations.fluxLibres.relation : 'N/A';
    if (profileResonancesObscuresRelation) profileResonancesObscuresRelation.textContent = currentStoryState.factionRelations ? currentStoryState.factionRelations.resonancesObscures.relation : 'N/A';

    if (profileNpcsList) updateListDisplay(profileNpcsList, currentStoryState.npcsMet, (npc) => `${npc.name} (${npc.relation || 'Inconnu'})`, 'Aucun');
    if (profileQuestsList) updateListDisplay(profileQuestsList, currentStoryState.activeQuests.filter(q => q.status === 'Active'), (quest) => `${quest.name} [${quest.status}]`, 'Aucune');
    if (profileEventsList) updateListDisplay(profileEventsList, currentStoryState.majorWorldEvents, (event) => `${event.description}`, 'Aucun');
}

// Fonction de mise à jour de l'UI de la page d'historique (simple pour l'instant)
function updateHistoryUI() {
    if (sessionsHistoryList) {
        sessionsHistoryList.innerHTML = '';
        if (currentUserId && currentStoryState.playerName) {
            const li = document.createElement('li');
            li.textContent = `Partie en cours: ${currentStoryState.playerName} (${currentStoryState.gameMode})`;
            sessionsHistoryList.appendChild(li);
        } else {
            const li = document.createElement('li');
            li.textContent = 'Aucune partie sauvegardée trouvée.';
            sessionsHistoryList.appendChild(li);
        }
    }
}


// --- Communication avec le Backend (Netlify Function) ---
async function sendToBackend(action, isStart = false) {
    if (!currentUserId) {
        showAlert("Vous n'êtes pas connecté. Veuillez vous connecter ou jouer anonymement pour commencer.", "error");
        return;
    }

    // Afficher l'action du joueur dans l'historique
    if (!isStart && currentStoryState.playerName) {
        appendStory(`\n> ${currentStoryState.playerName} : ${action}\n`);
    }

    // Désactiver les entrées pendant le traitement
    optionsDisplay.style.pointerEvents = 'none';
    freeTextInput.style.pointerEvents = 'none';
    submitActionButton.textContent = 'Réflexion en cours...';
    if (saveGameButton) saveGameButton.disabled = true;

    const payload = {
        userId: currentUserId, // ENVOYER L'ID UTILISATEUR DE FIREBASE
        playerName: currentStoryState.playerName,
        playerArchetype: currentStoryState.playerArchetype,
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

        // Mise à jour de l'UI du jeu principal
        appendStory(narration);
        updateGameUI();

        if (options && options.length > 0) {
            displayOptions(options);
        } else {
            displayFreeTextInput();
        }

    } catch (error) {
        console.error('Erreur lors de l\'envoi au backend:', error);
        showAlert("Une erreur est survenue. Le tissu de l'Echo Verse vacille... (Voir la console pour plus de détails)", "error");
        if (freeTextInput) displayFreeTextInput();
    } finally {
        // Réactiver les entrées
        optionsDisplay.style.pointerEvents = 'auto';
        freeTextInput.style.pointerEvents = 'auto';
        submitActionButton.textContent = 'Agir';
        if (saveGameButton) saveGameButton.disabled = false;
    }
}


// --- Fonctions de chargement et d'initialisation de la partie ---

// Fonction exposée globalement pour être appelée par le script Firebase dans index.html
window.loadGameSession = async (userId) => {
    currentUserId = userId; // S'assurer que l'ID utilisateur est défini
    const path = window.location.pathname;

    if (userIdDisplay) userIdDisplay.textContent = currentUserId; // Afficher l'ID utilisateur dans la sidebar

    // Logique de chargement pour la page principale (index.html)
    if (path === '/' || path.includes('index.html')) {
        try {
            const response = await fetch('/.netlify/functions/gemini-narrator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId, isStart: false, playerAction: "Charger session" }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn("Session non trouvée pour cet utilisateur, démarrage d'une nouvelle partie.");
                    showScreen('start-screen'); // Afficher l'écran de démarrage si pas de partie
                } else {
                    throw new Error(`Erreur HTTP: ${response.status} - ${await response.text()}`);
                }
            } else {
                const data = await response.json();
                currentStoryState = data.newState; // Charger l'état complet depuis Firebase
                appendStory(`Bienvenue de nouveau, ${currentStoryState.playerName} ! L'Echo Verse vous attend...`);
                appendStory(data.narration); // Afficher la dernière narration enregistrée

                updateGameUI(); // Mettre à jour l'UI du jeu
                showScreen('story-screen'); // Afficher l'écran de jeu
                displayFreeTextInput(); // Afficher l'input libre par défaut après le chargement
            }
        } catch (error) {
            console.error('Erreur lors du chargement de la session:', error);
            showAlert("Impossible de charger la session. Veuillez démarrer une nouvelle partie.", "error");
            showScreen('start-screen'); // Revenir à l'écran de démarrage en cas d'erreur critique
        }
    } else if (path.includes('profile.html')) {
        // Logique pour la page de profil
        if (currentUserId) {
            try {
                const response = await fetch('/.netlify/functions/gemini-narrator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUserId, isStart: false, playerAction: "Charger session pour profil" }),
                });

                if (response.ok) {
                    const data = await response.json();
                    currentStoryState = data.newState;
                    updateProfileUI(); // Mettre à jour l'UI de la page de profil
                } else {
                    console.error('Impossible de charger les données du profil:', await response.text());
                    showAlert('Impossible de charger les données de votre profil.', "error");
                }
            } catch (error) {
                console.error('Erreur lors du chargement du profil:', error);
                showAlert('Erreur lors du chargement des données de profil.', "error");
            }
        } else {
            if (profilePlayerName) profilePlayerName.textContent = 'Veuillez vous connecter pour voir votre profil.';
        }
    } else if (path.includes('history.html')) {
        // Logique pour la page d'historique
        if (currentUserId) {
            try {
                 const response = await fetch('/.netlify/functions/gemini-narrator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUserId, isStart: false, playerAction: "Charger session pour historique" }),
                });

                if (response.ok) {
                    const data = await response.json();
                    currentStoryState = data.newState;
                    updateHistoryUI(); // Mettre à jour l'UI de la page d'historique
                } else {
                    console.error('Impossible de charger les données de l\'historique:', await response.text());
                    showAlert('Impossible de charger les données de votre historique.', "error");
                }
            } catch (error) {
                console.error('Erreur lors du chargement de l\'historique:', error);
                showAlert('Erreur lors du chargement des données d\'historique.', "error");
            }
        } else {
             if (sessionsHistoryList) {
                sessionsHistoryList.innerHTML = '<li>Veuillez vous connecter pour voir votre historique.</li>';
             }
        }
    }
    // Pour les autres pages (instructions, lore, community, contact, etc.), aucune logique JS spécifique au chargement de session n'est nécessaire.
    // Assurez-vous simplement que leurs fichiers HTML ont la même structure de fond et de navigation.
};


// --- Événements du Démarrage du Jeu ---
startAdventureButton.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    const playerArchetype = playerArchetypeSelect.value;
    const gameMode = gameModeSelect.value;

    if (!playerName || !playerArchetype || !gameMode) {
        showAlert("Veuillez entrer votre nom, choisir une classe et un mode de jeu.", "info");
        return;
    }

    // Réinitialiser l'état local pour une nouvelle partie
    currentStoryState = {
        playerName: playerName,
        playerArchetype: playerArchetype,
        gameMode: gameMode,
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

    showScreen('story-screen'); // Afficher l'écran de jeu

    // Envoyer la requête de démarrage au backend
    sendToBackend(`Démarrer l'aventure en tant que ${playerArchetype} en mode ${gameMode}`, true);
});

submitActionButton.addEventListener('click', () => {
    const action = actionInputField.value.trim();
    if (action) {
        sendToBackend(action);
    } else {
        showAlert("Veuillez décrire votre action.", "info");
    }
});

// Événement pour le bouton de sauvegarde
if (saveGameButton) {
    saveGameButton.addEventListener('click', () => {
        // La partie est sauvegardée automatiquement à chaque action. Ce bouton est pour rassurer.
        showAlert("Votre partie est automatiquement sauvegardée après chaque action.", "success");
    });
}

// Permettre d'envoyer l'action avec "Entrée"
actionInputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { // Shift+Enter pour un saut de ligne
        e.preventDefault();
        submitActionButton.click();
    }
});

// Initialisation au chargement de la fenêtre est maintenant gérée par le script Firebase intégré dans index.html
// qui appelle window.loadGameSession(userId) après authentification.
