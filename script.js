// --- Gestion de l'état de la partie ---
let currentSessionId = localStorage.getItem('echoVerseSessionId');
let currentStoryState = {}; // Sera chargé/mis à jour par le backend

// Déclaration des variables globales qui seront initialisées dans window.onload
let playerNameInput, playerArchetypeSelect, gameModeSelect, startAdventureButton,
    startScreen, storyScreen, storyDisplay, optionsDisplay, freeTextInput,
    actionInputField, submitActionButton,
    vigorValue, ingenuityValue, adaptationValue, influenceValue, inventoryList,
    gardeChroniqueRelation, fluxLibresRelation, resonancesObscuresRelation,
    npcsList, questsList, eventsList;


// Fonction utilitaire pour gérer les mises à jour des listes UI (inventaire, PNJ, quêtes, événements)
function updateListDisplay(element, items, displayFunc) {
    // Vérification pour s'assurer que l'élément existe avant de le manipuler
    if (!element) {
        console.error(`Element for list display not found:`, element);
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
        li.textContent = `Aucun ${element.id.replace('-list', '') === 'inventory' ? 'objet' : element.id.replace('-list', '') === 'npcs' ? 'PNJ' : element.id.replace('-list', '') === 'quests' ? 'quête' : 'événement'}`;
        element.appendChild(li);
    }
}


// Fonctions de mise à jour de l'UI
function appendStory(text) {
    if (!storyDisplay) { console.error("storyDisplay element not found."); return; }
    // Remplace les <br> par des sauts de ligne réels dans les balises <p> pour un meilleur rendu
    const formattedText = text.replace(/<br>/g, '<br><br>');
    const p = document.createElement('p');
    p.innerHTML = formattedText;
    storyDisplay.appendChild(p);
    storyDisplay.scrollTop = storyDisplay.scrollHeight; // Défilement automatique
}

function displayOptions(options) {
    if (!optionsDisplay || !freeTextInput) { console.error("Options or Free Text Input elements not found."); return; }
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
    if (!optionsDisplay || !freeTextInput || !actionInputField) { console.error("Free Text Input elements not found."); return; }
    optionsDisplay.style.display = 'none';
    freeTextInput.style.display = 'block';
    actionInputField.value = '';
    actionInputField.focus();
}

function updateAttributesDisplay() {
    if (currentStoryState.attributes) {
        if (vigorValue) vigorValue.textContent = currentStoryState.attributes.vigor;
        if (ingenuityValue) ingenuityValue.textContent = currentStoryState.attributes.ingenuity;
        if (adaptationValue) adaptationValue.textContent = currentStoryState.attributes.adaptation;
        if (influenceValue) influenceValue.textContent = currentStoryState.attributes.influence;
    }
}

function updateInventoryDisplay() {
    if (!inventoryList) { console.error("inventoryList element not found."); return; }
    updateListDisplay(inventoryList, currentStoryState.inventory, (item) => `${item.name} (${item.description})`);
}

function updateFactionRelationsDisplay() {
    if (currentStoryState.factionRelations) {
        if (gardeChroniqueRelation) gardeChroniqueRelation.textContent = currentStoryState.factionRelations.gardeChronique.relation;
        if (fluxLibresRelation) fluxLibresRelation.textContent = currentStoryState.factionRelations.fluxLibres.relation;
        if (resonancesObscuresRelation) resonancesObscuresRelation.textContent = currentStoryState.factionRelations.resonancesObscures.relation;
    }
}

function updateNPCsDisplay() {
    if (!npcsList) { console.error("npcsList element not found."); return; }
    updateListDisplay(npcsList, currentStoryState.npcsMet, (npc) => `${npc.name} (${npc.relation || 'Inconnu'})`);
}

function updateQuestsDisplay() {
    if (!questsList) { console.error("questsList element not found."); return; }
    updateListDisplay(questsList, currentStoryState.activeQuests.filter(q => q.status === 'Active'), (quest) => `${quest.name} [${quest.status}]`);
}

function updateEventsDisplay() {
    if (!eventsList) { console.error("eventsList element not found."); return; }
    updateListDisplay(eventsList, currentStoryState.majorWorldEvents, (event) => `${event.description}`);
}


// --- Communication avec le Backend (Netlify Function) ---
async function sendToBackend(action, isStart = false) {
    if (!currentSessionId && !isStart) {
        alert("Erreur de session. Veuillez recharger la page ou démarrer une nouvelle partie.");
        return;
    }

    // Afficher l'action du joueur dans l'historique
    if (!isStart) { // Ne pas afficher l'action 'start' qui n'est pas une vraie action de jeu
        appendStory(`\n> ${currentStoryState.playerName || 'Vous'} : ${action}\n`);
    }

    // Désactiver les entrées pendant le traitement
    if (optionsDisplay) optionsDisplay.style.pointerEvents = 'none';
    if (freeTextInput) freeTextInput.style.pointerEvents = 'none';
    if (submitActionButton) submitActionButton.textContent = 'Réflexion en cours...';

    const payload = {
        playerName: currentStoryState.playerName,
        playerArchetype: currentStoryState.playerArchetype,
        gameMode: currentStoryState.gameMode, // Nouveau: Envoyer le mode de jeu
        playerAction: action,
        isStart: isStart,
        sessionId: currentSessionId,
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
        const { narration, options, newState } = data; // Le backend envoie le newState complet

        currentStoryState = newState; // METTRE À JOUR L'ÉTAT LOCAL AVEC LE NOUVEL ÉTAT

        // Mise à jour de l'UI avec le nouvel état
        appendStory(narration);
        updateAttributesDisplay();
        updateInventoryDisplay();
        updateFactionRelationsDisplay();
        updateNPCsDisplay();
        updateQuestsDisplay();
        updateEventsDisplay();


        if (options && options.length > 0) {
            displayOptions(options);
        } else {
            displayFreeTextInput();
        }

    } catch (error) {
        console.error('Erreur lors de l\'envoi au backend:', error);
        appendStory("<p style='color: red;'>Une erreur est survenue. Le tissu de l'Echo Verse vacille... (Voir la console pour plus de détails)</p>");
        displayFreeTextInput();
    } finally {
        // Réactiver les entrées
        if (optionsDisplay) optionsDisplay.style.pointerEvents = 'auto';
        if (freeTextInput) freeTextInput.style.pointerEvents = 'auto';
        if (submitActionButton) submitActionButton.textContent = 'Agir';
    }
}


// --- Événements du Démarrage (Déplacés à l'intérieur de window.onload) ---
// Charger une session existante au chargement de la page (si ID de session existe)
window.onload = async () => {
    // Initialiser les variables en accédant aux éléments du DOM après le chargement complet de la page
    playerNameInput = document.getElementById('player-name-input');
    playerArchetypeSelect = document.getElementById('player-archetype-select');
    gameModeSelect = document.getElementById('game-mode-select');
    startAdventureButton = document.getElementById('start-adventure-button');
    startScreen = document.getElementById('start-screen');
    storyScreen = document.getElementById('story-screen');
    storyDisplay = document.getElementById('story-display');
    optionsDisplay = document.getElementById('options-display');
    freeTextInput = document.getElementById('free-text-input');
    actionInputField = document.getElementById('action-input-field');
    submitActionButton = document.getElementById('submit-action-button');

    vigorValue = document.getElementById('vigor-value');
    ingenuityValue = document.getElementById('ingenuity-value');
    adaptationValue = document.getElementById('adaptation-value');
    influenceValue = document.getElementById('influence-value');
    inventoryList = document.getElementById('inventory-list');
    gardeChroniqueRelation = document.getElementById('garde-chronique-relation');
    fluxLibresRelation = document.getElementById('flux-libres-relation');
    resonancesObscuresRelation = document.getElementById('resonances-obscures-relation');
    npcsList = document.getElementById('npcs-list');
    questsList = document.getElementById('quests-list');
    eventsList = document.getElementById('events-list');


    // Attach event listeners here to ensure DOM elements are fully loaded
    if (startAdventureButton) { // S'assurer que le bouton existe avant d'ajouter l'écouteur
        startAdventureButton.addEventListener('click', () => {
            const playerName = playerNameInput.value.trim();
            const playerArchetype = playerArchetypeSelect.value;
            const gameMode = gameModeSelect.value; // Récupérer le mode de jeu sélectionné

            if (!playerName || !playerArchetype || !gameMode) {
                alert("Veuillez entrer votre nom, choisir un archétype et un mode de jeu.");
                return;
            }

            // Initialiser ou charger la session ID
            if (!currentSessionId) {
                currentSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('echoVerseSessionId', currentSessionId);
            }

            // Mettre à jour l'état local avec le nom, l'archétype ET LE MODE DE JEU
            currentStoryState.playerName = playerName;
            currentStoryState.playerArchetype = playerArchetype;
            currentStoryState.gameMode = gameMode;

            if (startScreen) startScreen.classList.remove('active');
            if (storyScreen) storyScreen.classList.add('active');

            // Envoyer la requête de démarrage au backend
            sendToBackend(`Démarrer l'aventure en tant que ${playerArchetype} en mode ${gameMode}`, true);
        });
    } else {
        console.error("startAdventureButton element not found, cannot attach event listener.");
    }


    if (submitActionButton) { // S'assurer que le bouton existe avant d'ajouter l'écouteur
        submitActionButton.addEventListener('click', () => {
            const action = actionInputField.value.trim();
            if (action) {
                sendToBackend(action);
            } else {
                alert("Veuillez décrire votre action.");
            }
        });
    } else {
        console.error("submitActionButton element not found, cannot attach event listener.");
    }


    // Permettre d'envoyer l'action avec "Entrée"
    if (actionInputField) { // S'assurer que le champ existe avant d'ajouter l'écouteur
        actionInputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { // Shift+Enter pour un saut de ligne
                e.preventDefault(); // Empêche le saut de ligne par défaut du textarea
                if (submitActionButton) submitActionButton.click();
            }
        });
    } else {
        console.error("actionInputField element not found, cannot attach event listener.");
    }


    // Existing session loading logic
    if (currentSessionId) {
        // Tente de charger l'état depuis le backend. Si la session n'est pas trouvée (par ex. première visite après avoir vidé la DB),
        // le backend renverra 404, et le frontend basculera sur l'écran de démarrage.
        try {
            const response = await fetch('/.netlify/functions/gemini-narrator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: currentSessionId, isStart: false, playerAction: "Charger session" }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn("Session non trouvée, démarrage d'une nouvelle partie.");
                    localStorage.removeItem('echoVerseSessionId'); // Supprime l'ID de session invalide
                    currentSessionId = null; // Réinitialise
                    if (startScreen) startScreen.classList.add('active');
                    if (storyScreen) storyScreen.classList.remove('active');
                } else {
                    throw new Error(`Erreur HTTP: ${response.status} - ${await response.text()}`);
                }
            } else {
                const data = await response.json();
                currentStoryState = data.newState; // Charger l'état complet
                appendStory(`Bienvenue de nouveau, ${currentStoryState.playerName} ! L'Echo Verse vous attend...`);
                appendStory(data.narration); // Afficher la dernière narration enregistrée (ou un message de bienvenue générique)

                // Mettre à jour toutes les UI
                updateAttributesDisplay();
                updateInventoryDisplay();
                updateFactionRelationsDisplay();
                updateNPCsDisplay();
                updateQuestsDisplay();
                updateEventsDisplay();

                if (startScreen) startScreen.classList.remove('active');
                if (storyScreen) storyScreen.classList.add('active');
                displayFreeTextInput(); // Afficher l'input libre par default après le chargement
            }
        } catch (error) {
            console.error('Erreur lors du chargement de la session:', error);
            alert("Impossible de charger la session. Une nouvelle partie va démarrer.");
            localStorage.removeItem('echoVerseSessionId');
            currentSessionId = null;
            if (startScreen) startScreen.classList.add('active');
            if (storyScreen) storyScreen.classList.remove('active');
        }
    } else {
        // Si pas de session, afficher l'écran de démarrage
        if (startScreen) startScreen.classList.add('active');
        if (storyScreen) storyScreen.classList.remove('active');
    }
};
