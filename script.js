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
    const saveGameButton = document.getElementById('save-game-button'); // Nouveau: bouton de sauvegarde
    
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
    
    // --- Gestion de l'état de la partie ---
    let currentSessionId = localStorage.getItem('echoVerseSessionId');
    let currentStoryState = {}; // Sera chargé/mis à jour par le backend
    
    // Fonction utilitaire pour gérer les mises à jour des listes UI (inventaire, PNJ, quêtes, événements)
    function updateListDisplay(element, items, displayFunc, defaultText = 'Aucun') {
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
        // Remplace les <br> par des sauts de ligne réels dans les balises <p> pour un meilleur rendu
        const formattedText = text.replace(/<br>/g, '<br><br>');
        const p = document.createElement('p');
        p.innerHTML = formattedText;
        storyDisplay.appendChild(p);
        storyDisplay.scrollTop = storyDisplay.scrollHeight; // Défilement automatique
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
            if (currentSessionId && currentStoryState.playerName) {
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
        if (!currentSessionId && !isStart) {
            alert("Erreur de session. Veuillez recharger la page ou démarrer une nouvelle partie.");
            return;
        }
    
        // Afficher l'action du joueur dans l'historique
        if (!isStart && currentStoryState.playerName) {
            appendStory(`\n> ${currentStoryState.playerName} : ${action}\n`);
        }
    
        // Désactiver les entrées pendant le traitement
        if (optionsDisplay) optionsDisplay.style.pointerEvents = 'none';
        if (freeTextInput) freeTextInput.style.pointerEvents = 'none';
        if (submitActionButton) submitActionButton.textContent = 'Réflexion en cours...';
        if (saveGameButton) saveGameButton.disabled = true;
    
        const payload = {
            playerName: currentStoryState.playerName,
            playerArchetype: currentStoryState.playerArchetype,
            gameMode: currentStoryState.gameMode,
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
            alert("Une erreur est survenue. Le tissu de l'Echo Verse vacille... (Voir la console pour plus de détails)");
            if (freeTextInput) displayFreeTextInput(); // Afficher l'input libre même en cas d'erreur
        } finally {
            // Réactiver les entrées
            if (optionsDisplay) optionsDisplay.style.pointerEvents = 'auto';
            if (freeTextInput) freeTextInput.style.pointerEvents = 'auto';
            if (submitActionButton) submitActionButton.textContent = 'Agir';
            if (saveGameButton) saveGameButton.disabled = false;
        }
    }
    
    // --- Événements du Démarrage et Sauvegarde ---
    startAdventureButton.addEventListener('click', () => {
        const playerName = playerNameInput.value.trim();
        const playerArchetype = playerArchetypeSelect.value;
        const gameMode = gameModeSelect.value;
    
        if (!playerName || !playerArchetype || !gameMode) {
            alert("Veuillez entrer votre nom, choisir une classe et un mode de jeu.");
            return;
        }
    
        // Initialiser ou charger la session ID
        if (!currentSessionId) {
            currentSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('echoVerseSessionId', currentSessionId);
        }
    
        // Mettre à jour l'état local avec le nom, l'archétype ET LE MODE DE JEU
        currentStoryState = { // Réinitialiser l'état pour une nouvelle partie
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
    
        startScreen.classList.remove('active');
        storyScreen.classList.add('active');
    
        // Envoyer la requête de démarrage au backend
        sendToBackend(`Démarrer l'aventure en tant que ${playerArchetype} en mode ${gameMode}`, true);
    });
    
    submitActionButton.addEventListener('click', () => {
        const action = actionInputField.value.trim();
        if (action) {
            sendToBackend(action);
        } else {
            alert("Veuillez décrire votre action.");
        }
    });
    
    // Événement pour le bouton de sauvegarde
    if (saveGameButton) {
        saveGameButton.addEventListener('click', () => {
            // Puisque le jeu sauvegarde à chaque action, ce bouton peut simplement confirmer
            // ou déclencher une action vide pour forcer une sauvegarde si aucune action n'a été faite.
            // Pour l'instant, on va juste confirmer.
            alert("Votre partie a été sauvegardée automatiquement à votre dernière action.");
            // Si vous voulez forcer une sauvegarde, même sans nouvelle action narrative:
            // sendToBackend("Sauvegarde manuelle de la partie", false);
        });
    }
    
    // Permettre d'envoyer l'action avec "Entrée"
    actionInputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Shift+Enter pour un saut de ligne
            e.preventDefault(); // Empêche le saut de ligne par défaut du textarea
            submitActionButton.click();
        }
    });
    
    // Charger une session existante au chargement de la page (si ID de session existe)
    window.onload = async () => {
        const path = window.location.pathname;
    
        // Si nous sommes sur la page principale (index.html) et qu'il y a une session
        if (path === '/' || path === '/index.html') {
            if (currentSessionId) {
                try {
                    const response = await fetch('/.netlify/functions/gemini-narrator', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: currentSessionId, isStart: false, playerAction: "Charger session" }),
                    });
    
                    if (!response.ok) {
                        if (response.status === 404) {
                            console.warn("Session non trouvée, démarrage d'une nouvelle partie.");
                            localStorage.removeItem('echoVerseSessionId');
                            currentSessionId = null;
                            startScreen.classList.add('active');
                            storyScreen.classList.remove('active');
                        } else {
                            throw new Error(`Erreur HTTP: ${response.status} - ${await response.text()}`);
                        }
                    } else {
                        const data = await response.json();
                        currentStoryState = data.newState;
                        appendStory(`Bienvenue de nouveau, ${currentStoryState.playerName} ! L'Echo Verse vous attend...`);
                        appendStory(data.narration);
    
                        updateGameUI(); // Mise à jour de l'UI du jeu
    
                        startScreen.classList.remove('active');
                        storyScreen.classList.add('active');
                        displayFreeTextInput();
                    }
                } catch (error) {
                    console.error('Erreur lors du chargement de la session:', error);
                    alert("Impossible de charger la session. Une nouvelle partie va démarrer.");
                    localStorage.removeItem('echoVerseSessionId');
                    currentSessionId = null;
                    startScreen.classList.add('active');
                    storyScreen.classList.remove('active');
                }
            } else {
                startScreen.classList.add('active');
                storyScreen.classList.remove('active');
            }
        } else if (path === '/profile.html') {
            // Logique pour la page de profil
            if (currentSessionId) {
                try {
                    const response = await fetch('/.netlify/functions/gemini-narrator', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: currentSessionId, isStart: false, playerAction: "Charger session pour profil" }),
                    });
    
                    if (response.ok) {
                        const data = await response.json();
                        currentStoryState = data.newState;
                        updateProfileUI(); // Mettre à jour l'UI de la page de profil
                    } else {
                        console.error('Impossible de charger les données du profil:', await response.text());
                        alert('Impossible de charger les données de votre profil.');
                    }
                } catch (error) {
                    console.error('Erreur lors du chargement du profil:', error);
                    alert('Erreur lors du chargement des données de profil.');
                }
            } else {
                // Pas de session, afficher "N/A" ou un message approprié
                if (profilePlayerName) profilePlayerName.textContent = 'Aucune session active';
            }
        } else if (path === '/history.html') {
            // Logique pour la page d'historique (simple pour l'instant)
            if (currentSessionId) {
                try {
                     const response = await fetch('/.netlify/functions/gemini-narrator', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: currentSessionId, isStart: false, playerAction: "Charger session pour historique" }),
                    });
    
                    if (response.ok) {
                        const data = await response.json();
                        currentStoryState = data.newState;
                        updateHistoryUI(); // Mettre à jour l'UI de la page d'historique
                    } else {
                        console.error('Impossible de charger les données de l\'historique:', await response.text());
                        alert('Impossible de charger les données de votre historique.');
                    }
                } catch (error) {
                    console.error('Erreur lors du chargement de l\'historique:', error);
                    alert('Erreur lors du chargement des données d\'historique.');
                }
            } else {
                 if (sessionsHistoryList) {
                    sessionsHistoryList.innerHTML = '<li>Aucune partie sauvegardée trouvée.</li>';
                 }
            }
        }
        // Pour les autres pages, aucune logique JS spécifique au chargement n'est nécessaire pour l'instant.
    };
    
    