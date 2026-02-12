// =========== МОДУЛЬ ДЛЯ РАБОТЫ С FIREBASE ===========
const DataManager = {
    // Проверка инициализации
    isInitialized() {
        return firebase.apps.length > 0 && db && auth;
    },

    // =========== ИГРОКИ ===========
    async getPlayers() {
        try {
            const snapshot = await db.collection('players').get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Ошибка загрузки игроков:', error);
            return [];
        }
    },

    async addPlayer(player) {
        try {
            const docRef = await db.collection('players').add(player);
            return { id: docRef.id, ...player };
        } catch (error) {
            console.error('Ошибка добавления игрока:', error);
            throw error;
        }
    },

    async deletePlayer(playerId) {
        try {
            await db.collection('players').doc(playerId).delete();
        } catch (error) {
            console.error('Ошибка удаления игрока:', error);
            throw error;
        }
    },

    // =========== КОМАНДЫ ===========
    async getTeams() {
        try {
            const snapshot = await db.collection('teams').get();
            const teams = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                teams[doc.id] = {
                    name: doc.id,
                    players: Array.isArray(data.players) ? data.players : [],
                    createdAt: data.createdAt,
                    createdBy: data.createdBy
                };
            });
            return teams;
        } catch (error) {
            console.error('Ошибка загрузки команд:', error);
            return {};
        }
    },

    async saveTeam(teamName, players) {
        try {
            if (!Array.isArray(players)) {
                throw new Error('Данные игроков должны быть массивом');
            }
            
            const teamData = {
                name: teamName,
                players: players.map(player => ({
                    id: player.id || null,
                    name: player.name,
                    photo: player.photo || 'images/default-player.png'
                })),
                createdAt: new Date().toISOString(),
                createdBy: currentUser,
                playerCount: players.length
            };
            
            await db.collection('teams').doc(teamName).set(teamData);
            console.log(`Команда "${teamName}" сохранена, игроков: ${players.length}`);
        } catch (error) {
            console.error('Ошибка сохранения команды:', error);
            throw error;
        }
    },

    async deleteTeam(teamName) {
        try {
            await db.collection('teams').doc(teamName).delete();
        } catch (error) {
            console.error('Ошибка удаления команды:', error);
            throw error;
        }
    },

    // =========== ТИПЫ МАТЧЕЙ ===========
    MATCH_TYPES: {
        POINTS: 'points',
        CLASSIC: 'classic'
    },

    // =========== МАТЧИ ===========
    async getMatches() {
        try {
            const snapshot = await db.collection('matches')
                .orderBy('timestamp', 'desc')
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Ошибка загрузки матчей:', error);
            return [];
        }
    },

    async saveMatch(match) {
        try {
            const matchData = {
                description: match.description,
                matchType: match.matchType || this.MATCH_TYPES.CLASSIC,
                teams: match.teams || [],
                players: match.players || [],
                participants: match.participants || [],
                participantsType: match.participantsType || 'players',
                scores: match.scores || {},
                points: match.points || {},
                sets: match.sets || 3,
                status: match.status || 'active',
                date: match.date || new Date().toLocaleString(),
                timestamp: match.timestamp || Date.now(),
                standings: match.standings || [],
                updatedAt: new Date().toISOString()
            };

            if (match.id) {
                await db.collection('matches').doc(match.id).update(matchData);
                return match.id;
            } else {
                const docRef = await db.collection('matches').add({
                    ...matchData,
                    createdAt: new Date().toISOString(),
                    createdBy: currentUser
                });
                return docRef.id;
            }
        } catch (error) {
            console.error('Ошибка сохранения матча:', error);
            throw error;
        }
    },

    async deleteMatch(matchId) {
        try {
            await db.collection('matches').doc(matchId).delete();
        } catch (error) {
            console.error('Ошибка удаления матча:', error);
            throw error;
        }
    },

    // =========== ПОЛЬЗОВАТЕЛИ ===========
    async getUser(uid) {
        try {
            const doc = await db.collection('users').doc(uid).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('Ошибка загрузки пользователя:', error);
            return null;
        }
    },

    async createUser(uid, userData) {
        try {
            await db.collection('users').doc(uid).set({
                ...userData,
                createdAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Ошибка создания пользователя:', error);
            throw error;
        }
    },

    async updateUser(uid, data) {
        try {
            await db.collection('users').doc(uid).update(data);
        } catch (error) {
            console.error('Ошибка обновления пользователя:', error);
            throw error;
        }
    },

    // =========== АУТЕНТИФИКАЦИЯ ===========
    async login(email, password) {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            const userData = await this.getUser(user.uid);
            if (!userData) {
                await this.createUser(user.uid, {
                    email: email,
                    username: email.split('@')[0],
                    role: email === 'admin@volleyball.ru' ? 'admin' : 'user',
                    displayName: email.split('@')[0]
                });
                return { user, userData: { role: email === 'admin@volleyball.ru' ? 'admin' : 'user' } };
            }
            
            return { user, userData };
        } catch (error) {
            console.error('Ошибка входа:', error);
            throw error;
        }
    },

    async register(email, password, username) {
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            await this.createUser(user.uid, {
                email: email,
                username: username,
                role: 'user',
                displayName: username
            });
            
            return { user };
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            throw error;
        }
    },

    async logout() {
        try {
            await auth.signOut();
        } catch (error) {
            console.error('Ошибка выхода:', error);
            throw error;
        }
    },

    getCurrentUser() {
        return auth.currentUser;
    },

    // =========== ИНИЦИАЛИЗАЦИЯ ДАННЫХ ===========
    async initDefaultData() {
        try {
            const playersSnapshot = await db.collection('players').get();
            if (playersSnapshot.empty) {
                console.log('Создаем данные по умолчанию...');
                await this.createDefaultPlayers();
            }
        } catch (error) {
            console.error('Ошибка инициализации данных:', error);
        }
    },

    async createDefaultPlayers() {
        const defaultPlayers = [
            { name: "Акаро Дмитрий", photo: "images/Акаро Дмитрий.png" },
            { name: "Баландин Максим", photo: "images/Баландин Максим.png" },
            { name: "Баринова Арина", photo: "images/Баринова Арина.png" },
            { name: "Барычев Артём", photo: "images/Барычев Артём.png" },
            { name: "Евгений Колесников", photo: "images/Евгений Колесников.png" },
            { name: "Зайцев Сергей", photo: "images/Зайцев Сергей.png" },
            { name: "Затолока Матвей", photo: "images/Затолока Матвей.png" },
            { name: "Кабанов Макар", photo: "images/Кабанов Макар.png" },
            { name: "Калашин Фёдор", photo: "images/Калашин Фёдор.png" },
            { name: "Комаров Александр", photo: "images/Комаров Александр.png" },
            { name: "Красин Глеб", photo: "images/Красин Глеб.png" },
            { name: "Максимов Максим", photo: "images/Максимов Максим.png" },
            { name: "Малов Кирилл", photo: "images/Малов Кирилл.png" },
            { name: "Машков Иван", photo: "images/Машков Иван.png" },
            { name: "Никита Матягин", photo: "images/Никита Матягин.png" },
            { name: "Поникаровских Артём", photo: "images/Поникаровских Артём.png" },
            { name: "Скиба Фёдор", photo: "images/Скиба Фёдор.png" },
            { name: "Скребень Александр", photo: "images/Скребень Александр.png" },
            { name: "Чесноков Константин", photo: "images/Чесноков Константин.png" },
            { name: "Шамсиддинов Давид", photo: "images/Шамсиддинов Давид.png" },
            { name: "Щедров Даниил", photo: "images/Щедров Даниил.png" },
            { name: "Щедров Макар", photo: "images/Щедров Макар.png" },
            { name: "Якубовский Кирилл", photo: "images/Якубовский Кирилл.png" },
            { name: "Канищев Евгений", photo: "images/Канищев Евгений.png" },
            { name: "Мартынцев Даниил", photo: "images/Мартынцев Даниил.png" }
        ];

        for (const player of defaultPlayers) {
            await db.collection('players').add(player);
        }
        console.log('Игроки по умолчанию созданы');
    }
};

// =========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===========
let currentUser = null;
let isAdmin = false;
let allPlayers = [];
let allTeams = {};
let allMatches = [];

// =========== ФУНКЦИИ ПРИЛОЖЕНИЯ ===========

// Инициализация приложения
async function initApp() {
    console.log('Инициализация приложения...');
    
    if (!DataManager.isInitialized()) {
        console.error('Ошибка: Firebase не инициализирован');
        return;
    }
    
    try {
        setupAuthListener();
        await DataManager.initDefaultData();
        await loadAllData();
        initNavigation();
        initResponsiveHeader();
        
        if (!window.location.hash || window.location.hash === '#home') {
            showSection('home');
        } else {
            const sectionName = window.location.hash.substring(1);
            if (['home', 'players', 'matches', 'auth', 'admin'].includes(sectionName)) {
                showSection(sectionName);
            } else {
                showSection('home');
            }
        }
        
        console.log('Приложение инициализировано');
    } catch (error) {
        console.error('Ошибка инициализации:', error);
    }
}

// Слушатель изменения статуса аутентификации
function setupAuthListener() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('Пользователь вошел:', user.email);
            currentUser = user.uid;
            
            const userData = await DataManager.getUser(user.uid);
            if (userData) {
                isAdmin = userData.role === 'admin';
                document.getElementById('current-username').textContent = userData.username || user.email.split('@')[0];
                console.log('Роль пользователя:', userData.role);
            }
            
            updateNavigation();
            updateAdminLinks();
        } else {
            console.log('Пользователь вышел');
            currentUser = null;
            isAdmin = false;
            document.getElementById('current-username').textContent = '';
            updateNavigation();
            updateAdminLinks();
        }
    });
}

// Загрузка всех данных
async function loadAllData() {
    try {
        console.log('Загрузка данных...');
        
        allPlayers = await DataManager.getPlayers();
        allTeams = await DataManager.getTeams();
        allMatches = await DataManager.getMatches();
        
        console.log('Данные загружены:', {
            players: allPlayers.length,
            teams: Object.keys(allTeams).length,
            matches: allMatches.length
        });
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

// =========== НАВИГАЦИЯ ===========

window.showSection = function (name) {
    console.log('Переход на секцию:', name);
    
    try {
        closeMobileMenu();
        
        document.querySelectorAll('section').forEach(s => {
            if (s.id.startsWith('section-')) {
                s.style.display = 'none';
            }
        });
        
        const section = document.getElementById('section-' + name);
        if (section) {
            section.style.display = 'block';
            window.location.hash = name;
            window.scrollTo(0, 0);
        } else {
            console.error('Секция не найдена:', 'section-' + name);
        }

        if (name === 'admin') {
            const adminLoggedIn = document.getElementById('admin-logged-in');
            const adminLoginArea = document.getElementById('admin-login-area');
            
            if (currentUser && isAdmin) {
                adminLoggedIn.style.display = 'block';
                adminLoginArea.style.display = 'none';
                showAdminDashboard();
            } else {
                adminLoggedIn.style.display = 'none';
                adminLoginArea.style.display = 'block';
            }
        } else if (name === 'matches') {
            displayPastMatches();
        } else if (name === 'players') {
            displayAllPlayers();
        }
    } catch (error) {
        console.error('Ошибка при переключении секции:', error);
    }
};

function initNavigation() {
    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionName = link.dataset.section;
            showSection(sectionName);
        });
    });
    
    updateNavigation();
}

function updateNavigation() {
    const adminNav = document.getElementById('admin-nav');
    const userInfo = document.getElementById('user-info');
    
    if (currentUser) {
        userInfo.style.display = 'flex';
        if (isAdmin) {
            adminNav.style.display = 'inline';
        } else {
            adminNav.style.display = 'none';
        }
    } else {
        userInfo.style.display = 'none';
        adminNav.style.display = 'none';
    }
}

function updateAdminLinks() {
    const adminFooterLink = document.getElementById('admin-footer-link');
    const adminNav = document.getElementById('admin-nav');
    
    if (currentUser && isAdmin) {
        if (adminFooterLink) adminFooterLink.style.display = 'inline';
        if (adminNav) adminNav.style.display = 'inline';
    } else {
        if (adminFooterLink) adminFooterLink.style.display = 'none';
        if (adminNav) adminNav.style.display = 'none';
    }
}

// =========== АУТЕНТИФИКАЦИЯ ===========

window.register = async () => {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    
    const email = `${username}@volleyball.ru`;
    
    if (!username || !password) {
        alert('Заполните все поля');
        return;
    }
    
    if (username.length < 3) {
        alert('Логин должен быть не менее 3 символов');
        return;
    }
    
    if (password.length < 6) {
        alert('Пароль должен быть не менее 6 символов');
        return;
    }
    
    if (username.toLowerCase() === 'admin') {
        alert('Логин "admin" зарезервирован. Используйте другой логин.');
        return;
    }
    
    try {
        await DataManager.register(email, password, username);
        alert('Регистрация прошла успешно! Теперь вы можете войти.');
        
        document.getElementById('reg-username').value = '';
        document.getElementById('reg-password').value = '';
        
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            alert('Пользователь с таким логином уже существует');
        } else if (error.code === 'auth/weak-password') {
            alert('Пароль слишком слабый');
        } else {
            alert(`Ошибка регистрации: ${error.message}`);
        }
    }
};

window.login = async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    const email = username === 'admin' ? 'admin@volleyball.ru' : `${username}@volleyball.ru`;
    
    if (!username || !password) {
        alert('Заполните все поля');
        return;
    }
    
    try {
        const { userData } = await DataManager.login(email, password);
        
        isAdmin = userData.role === 'admin';
        
        alert(`Добро пожаловать, ${username}${isAdmin ? ' (администратор)' : ''}!`);
        
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        
        showSection('home');
        
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            alert('Неверный логин или пароль');
        } else if (error.code === 'auth/invalid-email') {
            alert('Неверный формат email');
        } else {
            alert(`Ошибка входа: ${error.message}`);
        }
    }
};

window.logout = async () => {
    try {
        await DataManager.logout();
        alert('Вы вышли из системы');
        showSection('home');
    } catch (error) {
        alert(`Ошибка выхода: ${error.message}`);
    }
};

// =========== ОТОБРАЖЕНИЕ ДАННЫХ ===========

async function displayAllPlayers() {
    const container = document.getElementById('players-list');
    if (!container) return;
    
    try {
        allPlayers = await DataManager.getPlayers();
        
        if (allPlayers.length === 0) {
            container.innerHTML = '<p>Нет данных об игроках</p>';
            return;
        }
        
        let html = '';
        allPlayers.forEach(player => {
            const nameParts = player.name.split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ');
            
            html += `
                <div class="player-card">
                    <div class="player-photo">
                        <img src="${player.photo || 'images/default-player.png'}" 
                             alt="${player.name}" 
                             onerror="this.src='images/default-player.png'">
                    </div>
                    <div class="player-info">
                        <h3>${firstName}</h3>
                        <p>${lastName}</p>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<p>Ошибка загрузки игроков</p>';
        console.error(error);
    }
}

// =========== ОТОБРАЖЕНИЕ МАТЧЕЙ ===========

async function displayPastMatches() {
    const container = document.getElementById('matches-list');
    if (!container) return;
    
    try {
        allMatches = await DataManager.getMatches();
        allTeams = await DataManager.getTeams();
        allPlayers = await DataManager.getPlayers();
        
        if (allMatches.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">Нет завершенных матчей</p>';
            return;
        }
        
        let html = '';
        allMatches.forEach(match => {
            if (match.status !== 'completed') return;
            
            if (match.matchType === 'points') {
                html += displayPointsMatch(match);
            } else {
                html += displayClassicMatch(match);
            }
        });
        
        if (html === '') {
            html = '<p style="text-align: center; padding: 40px; color: #666;">Нет завершенных матчей</p>';
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Ошибка загрузки матчей:', error);
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: #dc3545;">Ошибка загрузки матчей</p>';
    }
}

// =========== АДМИНКА ===========

window.showAdminDashboard = () => {
    if (!isAdmin) return;
    
    const area = document.getElementById('admin-area');
    area.innerHTML = `
        <h3 style="color: #1e3c72; margin-bottom: 20px;">Панель администратора</h3>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; margin-top: 20px;">
            <div class="admin-stat-card">
                <h4 style="margin-top: 0;">Статистика</h4>
                <p>Игроков: ${allPlayers.length}</p>
                <p>Команд: ${Object.keys(allTeams).length}</p>
                <p>Матчей: ${allMatches.length}</p>
                <p>Статус: ${currentUser ? 'В сети' : 'Не в сети'}</p>
            </div>
            
            <div class="admin-stat-card">
                <h4 style="margin-top: 0;">Быстрые действия</h4>
                <button onclick="showCreateTeam()" class="admin-btn" style="width: 100%; margin: 5px 0;">Создать команду</button>
                <button onclick="showCreateMatch()" class="admin-btn" style="width: 100%; margin: 5px 0;">Создать матч</button>
                <button onclick="showEditMatches()" class="admin-btn" style="width: 100%; margin: 5px 0;">Редактировать матчи</button>
            </div>
        </div>
    `;
};

// =========== СОЗДАНИЕ КОМАНДЫ ===========

window.showCreateTeam = async () => {
    if (!isAdmin) {
        alert('Доступ только для администраторов');
        return;
    }
    
    try {
        allPlayers = await DataManager.getPlayers();
        allTeams = await DataManager.getTeams();
        
        const area = document.getElementById('admin-area');
        area.innerHTML = `
            <h3 style="color: #1e3c72; margin-bottom: 20px;">Создать новую команду</h3>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <p style="margin-bottom: 15px; color: #666;">
                    Название команды будет создано автоматически из имен выбранных игроков.
                </p>
                
                <h4 style="color: #1e3c72; margin-bottom: 15px;">Выберите игроков (минимум 2):</h4>
                
                ${allPlayers.length === 0 ? 
                    '<p style="color: #dc3545;">Нет игроков для создания команды. Сначала добавьте игроков.</p>' : 
                    `<div id="players-selection" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; max-height: 500px; overflow-y: auto; padding: 10px; background: white; border-radius: 10px;">
                        ${allPlayers.map((player) => `
                            <div class="player-checkbox-card" data-player-id="${player.id}" style="border: 2px solid #e0e0e0; border-radius: 10px; padding: 15px; cursor: pointer; transition: all 0.3s ease;">
                                <div style="text-align: center;">
                                    <img src="${player.photo || 'images/default-player.png'}" 
                                         alt="${player.name}"
                                         onerror="this.src='images/default-player.png'"
                                         style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; border: 3px solid #1e3c72;">
                                    <div style="font-weight: bold; color: #1e3c72; margin-bottom: 10px;">${player.name}</div>
                                    <input type="checkbox" value="${player.name}" class="player-checkbox-input" style="width: 20px; height: 20px; cursor: pointer;">
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>
            
            <div style="display: flex; gap: 15px; margin-top: 20px;">
                <button onclick="saveNewTeam()" class="btn-primary" style="padding: 12px 30px;">Создать команду</button>
                <button onclick="showAdminDashboard()" class="btn-secondary">Отмена</button>
            </div>
            
            <h4 style="color: #1e3c72; margin-top: 40px; margin-bottom: 20px;">Существующие команды:</h4>
            <div id="existing-teams" style="margin-top: 20px;"></div>
        `;
        
        // Добавляем обработчики кликов
        setTimeout(() => {
            document.querySelectorAll('.player-checkbox-card').forEach(card => {
                const checkbox = card.querySelector('.player-checkbox-input');
                
                card.addEventListener('click', function(e) {
                    if (e.target.tagName === 'INPUT') return;
                    
                    checkbox.checked = !checkbox.checked;
                    
                    if (checkbox.checked) {
                        this.style.borderColor = '#1e3c72';
                        this.style.backgroundColor = '#f0f4ff';
                        this.style.transform = 'scale(0.98)';
                    } else {
                        this.style.borderColor = '#e0e0e0';
                        this.style.backgroundColor = 'transparent';
                        this.style.transform = 'scale(1)';
                    }
                });
                
                checkbox.addEventListener('change', function(e) {
                    const parentCard = this.closest('.player-checkbox-card');
                    if (this.checked) {
                        parentCard.style.borderColor = '#1e3c72';
                        parentCard.style.backgroundColor = '#f0f4ff';
                        parentCard.style.transform = 'scale(0.98)';
                    } else {
                        parentCard.style.borderColor = '#e0e0e0';
                        parentCard.style.backgroundColor = 'transparent';
                        parentCard.style.transform = 'scale(1)';
                    }
                    e.stopPropagation();
                });
            });
        }, 100);
        
        await displayExistingTeams();
        
    } catch (error) {
        console.error('Ошибка в showCreateTeam:', error);
        alert(`Ошибка загрузки данных: ${error.message}`);
    }
};

async function displayExistingTeams() {
    const container = document.getElementById('existing-teams');
    if (!container) return;
    
    try {
        allTeams = await DataManager.getTeams();
        
        if (Object.keys(allTeams).length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Нет созданных команд</p>';
            return;
        }
        
        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px;">';
        
        for (const [teamName, teamData] of Object.entries(allTeams)) {
            const players = Array.isArray(teamData.players) ? teamData.players : [];
            
            html += `
                <div class="team-card" style="background: white; border-radius: 15px; padding: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); border-left: 5px solid #ffd700;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #f0f0f0;">
                        <h4 style="margin: 0; color: #1e3c72; font-size: 1.1rem;">${teamName}</h4>
                        <button onclick="deleteTeam('${teamName}')" class="btn-delete" style="padding: 6px 12px; font-size: 0.85rem;">Удалить</button>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${players.map(player => `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f8f9fa; border-radius: 8px; transition: transform 0.2s;">
                                <img src="${player.photo || 'images/default-player.png'}" 
                                     alt="${player.name}"
                                     onerror="this.src='images/default-player.png'"
                                     style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #1e3c72;">
                                <span style="font-weight: 500; color: #333;">${player.name}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #e0e0e0; color: #666; font-size: 0.85rem;">
                        <span>👥 ${players.length} игроков</span>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Ошибка в displayExistingTeams:', error);
        container.innerHTML = '<p style="color: #dc3545;">Ошибка загрузки команд</p>';
    }
}

window.saveNewTeam = async () => {
    if (!isAdmin) {
        alert('Доступ только для администраторов');
        return;
    }
    
    try {
        const selectedCheckboxes = Array.from(document.querySelectorAll('.player-checkbox-input:checked'));
        
        if (selectedCheckboxes.length < 2) {
            alert('❌ Выберите минимум 2 игрока для создания команды');
            return;
        }
        
        const selectedPlayerNames = selectedCheckboxes.map(cb => cb.value);
        
        allPlayers = await DataManager.getPlayers();
        
        const playersData = allPlayers.filter(player => 
            selectedPlayerNames.includes(player.name)
        );
        
        if (playersData.length < 2) {
            alert('❌ Не удалось найти данные выбранных игроков');
            return;
        }
        
        const teamName = selectedPlayerNames.join(' + ');
        
        const existingTeams = await DataManager.getTeams();
        if (existingTeams[teamName]) {
            alert(`⚠️ Команда "${teamName}" уже существует`);
            return;
        }
        
        await DataManager.saveTeam(teamName, playersData);
        
        alert(`✅ Команда успешно создана: ${teamName}`);
        
        allTeams = await DataManager.getTeams();
        
        const area = document.getElementById('admin-area');
        if (area) {
            await showCreateTeam();
        }
        
    } catch (error) {
        console.error('Ошибка в saveNewTeam:', error);
        alert(`❌ Ошибка создания команды: ${error.message}`);
    }
};

window.deleteTeam = async (teamName) => {
    if (!isAdmin) {
        alert('Доступ только для администраторов');
        return;
    }
    
    if (!confirm(`🗑️ Вы уверены, что хотите удалить команду "${teamName}"?`)) {
        return;
    }
    
    try {
        await DataManager.deleteTeam(teamName);
        
        alert(`✅ Команда "${teamName}" удалена`);
        
        allTeams = await DataManager.getTeams();
        
        await displayExistingTeams();
        
    } catch (error) {
        console.error('Ошибка в deleteTeam:', error);
        alert(`❌ Ошибка удаления команды: ${error.message}`);
    }
};

// =========== СОЗДАНИЕ МАТЧА ===========

window.showCreateMatch = async () => {
    if (!isAdmin) {
        alert('Доступ только для администраторов');
        return;
    }
    
    try {
        allTeams = await DataManager.getTeams();
        allPlayers = await DataManager.getPlayers();
        
        const area = document.getElementById('admin-area');
        area.innerHTML = `
            <h3 style="color: #1e3c72;">Создать новый матч</h3>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0;">
                <div onclick="selectMatchType('points')" id="match-type-points" style="background: white; border-radius: 15px; padding: 30px; cursor: pointer; border: 3px solid #e0e0e0; transition: all 0.3s ease;">
                    <div style="font-size: 3rem; text-align: center; margin-bottom: 20px;">🎯</div>
                    <h4 style="text-align: center; color: #1e3c72; margin-bottom: 15px;">Игра на очки</h4>
                    <ul style="color: #666; font-size: 0.9rem; list-style: none; padding: 0;">
                        <li style="margin-bottom: 10px;">✓ 1 на 1 или команды</li>
                        <li style="margin-bottom: 10px;">✓ Несколько партий</li>
                        <li style="margin-bottom: 10px;">✓ Сумма очков</li>
                        <li style="margin-bottom: 10px;">✓ Таблица мест</li>
                    </ul>
                </div>
                
                <div onclick="selectMatchType('classic')" id="match-type-classic" style="background: white; border-radius: 15px; padding: 30px; cursor: pointer; border: 3px solid #e0e0e0; transition: all 0.3s ease;">
                    <div style="font-size: 3rem; text-align: center; margin-bottom: 20px;">🏐</div>
                    <h4 style="text-align: center; color: #1e3c72; margin-bottom: 15px;">Классический волейбол</h4>
                    <ul style="color: #666; font-size: 0.9rem; list-style: none; padding: 0;">
                        <li style="margin-bottom: 10px;">✓ 2+ команд</li>
                        <li style="margin-bottom: 10px;">✓ До 2 побед</li>
                        <li style="margin-bottom: 10px;">✓ Ввод 3 партий</li>
                        <li style="margin-bottom: 10px;">✓ Победа = 2 очка</li>
                    </ul>
                </div>
            </div>
            
            <div id="match-creation-form" style="display: none;"></div>
        `;
        
    } catch (error) {
        alert(`Ошибка загрузки данных: ${error.message}`);
    }
};

window.selectMatchType = (type) => {
    document.querySelectorAll('[id^="match-type-"]').forEach(el => {
        el.style.border = '3px solid #e0e0e0';
        el.style.background = 'white';
    });
    
    const selectedEl = document.getElementById(`match-type-${type}`);
    if (selectedEl) {
        selectedEl.style.border = '3px solid #1e3c72';
        selectedEl.style.background = '#f0f4ff';
    }
    
    if (type === 'points') {
        showPointsMatchForm();
    } else {
        showClassicMatchForm();
    }
};

// =========== ФОРМА КЛАССИЧЕСКОГО МАТЧА ===========

function showClassicMatchForm() {
    const container = document.getElementById('match-creation-form');
    container.style.display = 'block';
    
    const teamNames = Object.keys(allTeams);
    
    container.innerHTML = `
        <h4 style="color: #1e3c72; margin-bottom: 20px;">Создать классический матч (до 2 побед)</h4>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <p style="margin-bottom: 15px;"><strong>Выберите команды (минимум 2):</strong></p>
            <div id="teams-classic-selection" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; max-height: 400px; overflow-y: auto; padding: 10px; background: white; border-radius: 10px;">
                ${teamNames.map((teamName) => {
                    const team = allTeams[teamName];
                    const players = Array.isArray(team?.players) ? team.players : [];
                    return `
                        <div class="team-selection-card" style="border: 2px solid #e0e0e0; border-radius: 10px; padding: 15px; cursor: pointer; transition: all 0.3s ease;">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <input type="checkbox" value="${teamName}" class="team-classic-checkbox" style="width: 20px; height: 20px;">
                                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                                    ${players.slice(0, 3).map(player => `
                                        <img src="${player.photo || 'images/default-player.png'}" 
                                             style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid #1e3c72;">
                                    `).join('')}
                                    ${players.length > 3 ? `<span style="background: #1e3c72; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">+${players.length - 3}</span>` : ''}
                                </div>
                                <span style="font-size: 0.95rem; font-weight: bold; color: #1e3c72;">${teamName}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <div style="margin: 20px 0;">
            <label style="display: block; margin-bottom: 8px; font-weight: bold;">Название матча:</label>
            <input type="text" id="classic-match-description" placeholder="Например: Финальный матч" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;">
        </div>
        
        <div class="match-actions">
            <button onclick="generateClassicMatch()" class="btn-primary" style="padding: 12px 30px;">Создать таблицу</button>
            <button onclick="showCreateMatch()" class="btn-secondary">Назад</button>
        </div>
        
        <div id="classic-match-container" style="margin-top: 30px;"></div>
    `;
    
    document.querySelectorAll('.team-selection-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = this.querySelector('.team-classic-checkbox');
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) {
                    this.style.borderColor = '#1e3c72';
                    this.style.backgroundColor = '#f0f4ff';
                } else {
                    this.style.borderColor = '#e0e0e0';
                    this.style.backgroundColor = 'transparent';
                }
            }
        });
    });
}

// =========== ФУНКЦИИ ДЛЯ РАБОТЫ С КЛАССИЧЕСКИМ МАТЧЕМ ===========

// Обновление очков команды
window.updateTeamPoints = (matchId, team, points) => {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    const pointsValue = parseInt(points) || 0;
    
    if (!match.scores) match.scores = {};
    if (!match.scores[team]) {
        match.scores[team] = { points: 0, sets: {} };
    }
    
    match.scores[team].points = pointsValue;
    
    const pointsElement = document.getElementById(`points_${matchId}_${team}`);
    if (pointsElement) {
        pointsElement.value = pointsValue;
    }
    
    DataManager.saveMatch(match).then(() => {
        console.log(`Очки для команды ${team} сохранены: ${pointsValue}`);
    }).catch(error => {
        console.error('Ошибка сохранения очков:', error);
    });
};

// Обновление счета партии
window.updateSetScore = (matchId, team1, team2, setNumber, value) => {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    if (!match.scores) match.scores = {};
    if (!match.scores[team1]) {
        match.scores[team1] = { points: 0, sets: {} };
    }
    if (!match.scores[team1].sets) {
        match.scores[team1].sets = {};
    }
    
    match.scores[team1].sets[setNumber] = value || null;
    
    // Подсчет очков на основе побед в партиях
    let totalPoints = 0;
    for (let set = 1; set <= 3; set++) {
        const score = match.scores[team1].sets[set];
        if (score && score.includes(':')) {
            const [score1, score2] = score.split(':').map(Number);
            if (!isNaN(score1) && !isNaN(score2) && score1 > score2) {
                totalPoints += 2; // Победа в партии
            }
        }
    }
    
    match.scores[team1].points = totalPoints;
    
    const pointsInput = document.getElementById(`points_${matchId}_${team1}`);
    if (pointsInput) {
        pointsInput.value = totalPoints;
    }
    
    DataManager.saveMatch(match).then(() => {
        console.log(`Счет партии ${setNumber} для ${team1} сохранен: ${value}, очки: ${totalPoints}`);
    }).catch(error => {
        console.error('Ошибка сохранения счета партии:', error);
    });
};

// Подсчет мест в классическом матче
window.calculateClassicStandings = (matchId) => {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    // Собираем все очки из полей ввода
    match.teams.forEach(team => {
        const pointsInput = document.getElementById(`points_${matchId}_${team}`);
        if (pointsInput) {
            const points = parseInt(pointsInput.value) || 0;
            if (!match.scores[team]) {
                match.scores[team] = { points: 0, sets: {} };
            }
            match.scores[team].points = points;
        }
        
        // Собираем сеты
        match.teams.forEach(opponent => {
            if (team !== opponent) {
                for (let set = 1; set <= 3; set++) {
                    const scoreInput = document.getElementById(`score_${matchId}_${team}_vs_${opponent}_set${set}`);
                    if (scoreInput && scoreInput.value) {
                        if (!match.scores[team].sets) {
                            match.scores[team].sets = {};
                        }
                        match.scores[team].sets[set] = scoreInput.value;
                    }
                }
            }
        });
    });
    
    const standings = match.teams.map(team => ({
        name: team,
        points: match.scores[team]?.points || 0
    }));
    
    standings.sort((a, b) => b.points - a.points);
    
    standings.forEach((team, index) => {
        const rankElement = document.getElementById(`rank_${matchId}_${team.name}`);
        if (rankElement) {
            rankElement.textContent = index + 1;
            
            if (index === 0) {
                rankElement.style.color = '#ffd700';
                rankElement.style.fontWeight = 'bold';
            } else if (index === 1) {
                rankElement.style.color = '#c0c0c0';
                rankElement.style.fontWeight = 'bold';
            } else if (index === 2) {
                rankElement.style.color = '#cd7f32';
                rankElement.style.fontWeight = 'bold';
            } else {
                rankElement.style.color = '#666';
                rankElement.style.fontWeight = 'normal';
            }
        }
    });
    
    match.standings = standings;
    
    DataManager.saveMatch(match).then(() => {
        console.log('Турнирная таблица сохранена');
        
        let resultsMessage = '🏆 ТУРНИРНАЯ ТАБЛИЦА:\n\n';
        standings.forEach((team, index) => {
            resultsMessage += `${index + 1}. ${team.name}\n`;
            resultsMessage += `   ⚡ Очки: ${team.points}\n\n`;
        });
        
        alert(resultsMessage);
    }).catch(error => {
        console.error('Ошибка сохранения турнирной таблицы:', error);
        alert('❌ Ошибка сохранения результатов');
    });
};

// Завершение классического матча
window.finishClassicMatch = async (matchId) => {
    if (!confirm('Завершить матч?')) return;
    
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    calculateClassicStandings(matchId);
    
    match.status = 'completed';
    match.completedAt = new Date().toLocaleString();
    
    try {
        await DataManager.saveMatch(match);
        console.log('Матч завершен и сохранен:', match);
        alert('✅ Матч завершен! Результаты сохранены.');
        
        const index = allMatches.findIndex(m => m.id === matchId);
        if (index !== -1) {
            allMatches[index] = match;
        }
        
        showEditMatches();
    } catch (error) {
        console.error('Ошибка завершения матча:', error);
        alert('❌ Ошибка завершения матча');
    }
};

// =========== ГЕНЕРАЦИЯ КЛАССИЧЕСКОГО МАТЧА ===========

window.generateClassicMatch = async () => {
    const selectedTeams = Array.from(document.querySelectorAll('.team-classic-checkbox:checked'))
        .map(cb => cb.value);
    
    const description = document.getElementById('classic-match-description').value.trim() || 
                       `Матч от ${new Date().toLocaleDateString()}`;
    
    if (selectedTeams.length < 2) {
        alert('Выберите минимум 2 команды');
        return;
    }
    
    const container = document.getElementById('classic-match-container');
    
    const match = {
        description: description,
        matchType: 'classic',
        teams: selectedTeams,
        date: new Date().toLocaleString(),
        timestamp: Date.now(),
        status: 'active',
        scores: {},
        standings: []
    };
    
    selectedTeams.forEach(team => {
        match.scores[team] = {
            points: 0,
            sets: {
                1: null,
                2: null,
                3: null
            }
        };
    });
    
    try {
        const matchId = await DataManager.saveMatch(match);
        match.id = matchId;
        allMatches.push(match);
        
        let html = `
            <div style="background: white; border-radius: 15px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); margin-top: 20px;">
                <h4 style="color: #1e3c72; margin-bottom: 15px;">${description}</h4>
                <p style="color: #666; margin-bottom: 20px;">Классический матч • Ручной ввод очков</p>
                
                <div class="table-responsive">
                    <table class="match-table" style="width: 100%; border-collapse: collapse; border: 1px solid #dee2e6;">
                        <thead>
                            <tr>
                                <th style="background: #1e3c72; color: white; padding: 15px; text-align: left;">Команда / Игроки</th>
                                ${selectedTeams.map(teamName => {
                                    const teamPlayers = allTeams[teamName]?.players || [];
                                    return `
                                        <th style="background: #2a5298; color: white; padding: 15px; text-align: center; min-width: 180px;">
                                            <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                                                <div style="display: flex; gap: 5px; justify-content: center;">
                                                    ${teamPlayers.slice(0, 3).map(player => `
                                                        <img src="${player.photo || 'images/default-player.png'}" 
                                                             style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid white;">
                                                    `).join('')}
                                                    ${teamPlayers.length > 3 ? `<span style="background: rgba(255,255,255,0.2); padding: 5px 8px; border-radius: 15px; font-size: 0.7rem;">+${teamPlayers.length - 3}</span>` : ''}
                                                </div>
                                                <span style="font-size: 0.9rem; font-weight: bold;">${teamName}</span>
                                            </div>
                                        </th>
                                    `;
                                }).join('')}
                                <th style="background: #1e3c72; color: white; padding: 15px; text-align: center; min-width: 80px;">Очки</th>
                                <th style="background: #1e3c72; color: white; padding: 15px; text-align: center; min-width: 60px;">Место</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${selectedTeams.map((team1, rowIndex) => {
                                const team1Players = allTeams[team1]?.players || [];
                                return `
                                    <tr style="border-bottom: 1px solid #dee2e6;">
                                        <td style="padding: 15px; background: #f8f9fa; font-weight: bold;">
                                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                                ${team1Players.slice(0, 3).map(player => `
                                                    <img src="${player.photo || 'images/default-player.png'}" 
                                                         style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid #1e3c72;">
                                                `).join('')}
                                                ${team1Players.length > 3 ? `<span style="background: #1e3c72; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">+${team1Players.length - 3}</span>` : ''}
                                                <span style="color: #1e3c72;">${team1}</span>
                                            </div>
                                        </td>
                                        ${selectedTeams.map((team2, colIndex) => {
                                            if (team1 === team2) {
                                                return '<td style="padding: 15px; text-align: center; background: #f8f9fa; color: #999;">-</td>';
                                            } else {
                                                const scores = match.scores?.[team1]?.sets || {};
                                                return `
                                                    <td style="padding: 15px; text-align: center;">
                                                        <div style="display: flex; flex-direction: column; gap: 5px; align-items: center;">
                                                            <div style="display: flex; align-items: center; gap: 5px;">
                                                                <span style="font-size: 0.8rem; color: #666;">1:</span>
                                                                <input type="text" 
                                                                       id="score_${matchId}_${team1}_vs_${team2}_set1"
                                                                       placeholder="0:0"
                                                                       value="${scores[1] || ''}"
                                                                       style="width: 60px; padding: 6px; text-align: center; border: 2px solid #e0e0e0; border-radius: 5px;"
                                                                       onchange="updateSetScore('${matchId}', '${team1}', '${team2}', 1, this.value)">
                                                            </div>
                                                            <div style="display: flex; align-items: center; gap: 5px;">
                                                                <span style="font-size: 0.8rem; color: #666;">2:</span>
                                                                <input type="text" 
                                                                       id="score_${matchId}_${team1}_vs_${team2}_set2"
                                                                       placeholder="0:0"
                                                                       value="${scores[2] || ''}"
                                                                       style="width: 60px; padding: 6px; text-align: center; border: 2px solid #e0e0e0; border-radius: 5px;"
                                                                       onchange="updateSetScore('${matchId}', '${team1}', '${team2}', 2, this.value)">
                                                            </div>
                                                            <div style="display: flex; align-items: center; gap: 5px;">
                                                                <span style="font-size: 0.8rem; color: #666;">3:</span>
                                                                <input type="text" 
                                                                       id="score_${matchId}_${team1}_vs_${team2}_set3"
                                                                       placeholder="0:0"
                                                                       value="${scores[3] || ''}"
                                                                       style="width: 60px; padding: 6px; text-align: center; border: 2px solid #e0e0e0; border-radius: 5px;"
                                                                       onchange="updateSetScore('${matchId}', '${team1}', '${team2}', 3, this.value)">
                                                            </div>
                                                        </div>
                                                    </td>
                                                `;
                                            }
                                        }).join('')}
                                        <td style="padding: 15px; text-align: center;">
                                            <input type="number" 
                                                   id="points_${matchId}_${team1}"
                                                   placeholder="0"
                                                   min="0"
                                                   value="${match.scores?.[team1]?.points || 0}"
                                                   style="width: 70px; padding: 8px; text-align: center; border: 2px solid #e0e0e0; border-radius: 5px; font-weight: bold; color: #1e3c72;"
                                                   onchange="updateTeamPoints('${matchId}', '${team1}', this.value)">
                                        </td>
                                        <td style="padding: 15px; text-align: center; font-weight: bold; font-size: 1.2rem;" id="rank_${matchId}_${team1}">
                                            ${rowIndex + 1}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div style="margin-top: 30px; display: flex; gap: 10px;">
                    <button onclick="calculateClassicStandings('${matchId}')" class="btn-primary">Подсчитать места</button>
                    <button onclick="finishClassicMatch('${matchId}')" class="btn-success">Завершить матч</button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Ошибка создания матча:', error);
        alert(`Ошибка создания матча: ${error.message}`);
    }
};

// =========== ФОРМА ИГРЫ НА ОЧКИ ===========

function showPointsMatchForm() {
    const container = document.getElementById('match-creation-form');
    container.style.display = 'block';
    
    container.innerHTML = `
        <h4 style="color: #1e3c72; margin-bottom: 20px;">Создать игру на очки</h4>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                    <input type="radio" name="points-type" value="players" checked onclick="togglePointsType('players')">
                    <span style="font-weight: bold;">1 на 1 (игроки)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                    <input type="radio" name="points-type" value="teams" onclick="togglePointsType('teams')">
                    <span style="font-weight: bold;">Команды</span>
                </label>
            </div>
            
            <div id="points-players-selection" style="display: block;">
                <p style="margin-bottom: 15px;"><strong>Выберите игроков для турнира:</strong></p>
                <div id="players-points-selection" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; max-height: 400px; overflow-y: auto; padding: 10px; background: white; border-radius: 10px;">
                    ${allPlayers.map(player => `
                        <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e0e0e0;">
                            <input type="checkbox" value="${player.id}" data-name="${player.name}" class="player-points-checkbox" style="width: 18px; height: 18px;">
                            <img src="${player.photo || 'images/default-player.png'}" 
                                 style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover;">
                            <span style="font-size: 0.95rem;">${player.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div id="points-teams-selection" style="display: none;">
                <p style="margin-bottom: 15px;"><strong>Выберите команды для турнира:</strong></p>
                <div id="teams-points-selection" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; max-height: 400px; overflow-y: auto; padding: 10px; background: white; border-radius: 10px;">
                    ${Object.keys(allTeams).map(teamName => {
                        const team = allTeams[teamName];
                        const players = Array.isArray(team?.players) ? team.players : [];
                        return `
                            <div class="team-selection-card" style="border: 2px solid #e0e0e0; border-radius: 10px; padding: 15px; cursor: pointer; transition: all 0.3s ease;">
                                <div style="display: flex; align-items: center; gap: 15px;">
                                    <input type="checkbox" value="${teamName}" class="team-points-checkbox" style="width: 20px; height: 20px;">
                                    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                                        ${players.slice(0, 3).map(player => `
                                            <img src="${player.photo || 'images/default-player.png'}" 
                                                 style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid #1e3c72;">
                                        `).join('')}
                                        ${players.length > 3 ? `<span style="background: #1e3c72; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">+${players.length - 3}</span>` : ''}
                                    </div>
                                    <span style="font-size: 0.95rem; font-weight: bold; color: #1e3c72;">${teamName}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
        
        <div style="margin: 20px 0;">
            <label style="display: block; margin-bottom: 8px; font-weight: bold;">Название турнира:</label>
            <input type="text" id="points-match-description" placeholder="Например: Турнир по волейболу" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;">
        </div>
        
        <div style="margin: 20px 0;">
            <label style="display: block; margin-bottom: 8px; font-weight: bold;">Количество партий:</label>
            <select id="points-match-sets" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;">
                <option value="1">1 партия</option>
                <option value="2">2 партии</option>
                <option value="3" selected>3 партии</option>
                <option value="4">4 партии</option>
                <option value="5">5 партий</option>
            </select>
        </div>
        
        <div class="match-actions">
            <button onclick="generatePointsMatch()" class="btn-primary" style="padding: 12px 30px;">Создать таблицу</button>
            <button onclick="showCreateMatch()" class="btn-secondary">Назад</button>
        </div>
        
        <div id="points-match-container" style="margin-top: 30px;"></div>
    `;
    
    document.querySelectorAll('.team-selection-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = this.querySelector('.team-points-checkbox');
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) {
                    this.style.borderColor = '#1e3c72';
                    this.style.backgroundColor = '#f0f4ff';
                } else {
                    this.style.borderColor = '#e0e0e0';
                    this.style.backgroundColor = 'transparent';
                }
            }
        });
    });
}

window.togglePointsType = (type) => {
    const playersDiv = document.getElementById('points-players-selection');
    const teamsDiv = document.getElementById('points-teams-selection');
    
    if (type === 'players') {
        playersDiv.style.display = 'block';
        teamsDiv.style.display = 'none';
    } else {
        playersDiv.style.display = 'none';
        teamsDiv.style.display = 'block';
    }
};

// =========== ФУНКЦИИ ДЛЯ РАБОТЫ С ИГРОЙ НА ОЧКИ ===========

window.updatePointsScore = (matchId, participantId, value) => {
    recalculateParticipantTotal(matchId, participantId);
};

function recalculateParticipantTotal(matchId, participantId) {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return 0;
    
    let total = 0;
    const participants = match.participants || match.players?.map(p => ({ id: p.id })) || [];
    
    participants.forEach(opponent => {
        if (opponent.id !== participantId) {
            for (let setIndex = 0; setIndex < match.sets; setIndex++) {
                const inputId = `points_${matchId}_${participantId}_vs_${opponent.id}_set${setIndex}`;
                const input = document.getElementById(inputId);
                if (input) {
                    const value = parseInt(input.value) || 0;
                    total += value;
                    
                    if (!match.points[participantId]) {
                        match.points[participantId] = { total: 0, sets: new Array(match.sets).fill(0) };
                    }
                    if (!match.points[participantId].sets) {
                        match.points[participantId].sets = new Array(match.sets).fill(0);
                    }
                    match.points[participantId].sets[setIndex] = value;
                }
            }
        }
    });
    
    if (!match.points[participantId]) {
        match.points[participantId] = { total: 0, sets: new Array(match.sets).fill(0) };
    }
    match.points[participantId].total = total;
    
    const totalElement = document.getElementById(`total_${matchId}_${participantId}`);
    if (totalElement) {
        totalElement.textContent = total;
    }
    
    DataManager.saveMatch(match);
    return total;
}

window.recalculatePlayerTotals = (matchId) => {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    const participants = match.participants || match.players || [];
    participants.forEach(participant => {
        recalculateParticipantTotal(matchId, participant.id);
    });
    
    alert('Очки всех участников пересчитаны!');
};

window.calculatePointsStandings = (matchId) => {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    const participants = match.participants || match.players || [];
    
    participants.forEach(participant => {
        recalculateParticipantTotal(matchId, participant.id);
    });
    
    const standings = participants.map(participant => {
        const participantPoints = match.points[participant.id] || { total: 0 };
        return {
            id: participant.id,
            name: participant.name,
            total: participantPoints.total
        };
    });
    
    standings.sort((a, b) => b.total - a.total);
    
    standings.forEach((participant, index) => {
        const rankElement = document.getElementById(`rank_${matchId}_${participant.id}`);
        if (rankElement) {
            rankElement.textContent = index + 1;
            if (index === 0) {
                rankElement.style.color = '#ffd700';
                rankElement.style.fontWeight = 'bold';
            } else if (index === 1) {
                rankElement.style.color = '#c0c0c0';
                rankElement.style.fontWeight = 'bold';
            } else if (index === 2) {
                rankElement.style.color = '#cd7f32';
                rankElement.style.fontWeight = 'bold';
            } else {
                rankElement.style.color = '#666';
                rankElement.style.fontWeight = 'normal';
            }
        }
    });
    
    match.standings = standings;
    DataManager.saveMatch(match);
    
    alert('Места подсчитаны!');
};

window.finishPointsMatch = async (matchId) => {
    if (!confirm('Завершить турнир?')) return;
    
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    recalculatePlayerTotals(matchId);
    calculatePointsStandings(matchId);
    
    match.status = 'completed';
    match.completedAt = new Date().toLocaleString();
    
    await DataManager.saveMatch(match);
    
    alert('Турнир завершен!');
    showEditMatches();
};

// =========== ГЕНЕРАЦИЯ ИГРЫ НА ОЧКИ ===========

window.generatePointsMatch = async () => {
    const isTeamsMode = document.querySelector('input[name="points-type"]:checked')?.value === 'teams';
    
    let participants = [];
    let participantsType = isTeamsMode ? 'teams' : 'players';
    
    if (isTeamsMode) {
        participants = Array.from(document.querySelectorAll('.team-points-checkbox:checked'))
            .map(cb => ({
                id: cb.value,
                name: cb.value,
                type: 'team',
                players: allTeams[cb.value]?.players || []
            }));
    } else {
        participants = Array.from(document.querySelectorAll('.player-points-checkbox:checked'))
            .map(cb => ({
                id: cb.value,
                name: cb.dataset.name,
                type: 'player',
                players: [allPlayers.find(p => p.id === cb.value)]
            }));
    }
    
    const description = document.getElementById('points-match-description').value.trim() || 
                       `Турнир ${new Date().toLocaleDateString()}`;
    const numberOfSets = parseInt(document.getElementById('points-match-sets').value);
    
    if (participants.length < 2) {
        alert(`Выберите минимум 2 ${isTeamsMode ? 'команды' : 'игроков'}`);
        return;
    }
    
    const container = document.getElementById('points-match-container');
    
    const match = {
        description: description,
        matchType: 'points',
        participantsType: participantsType,
        participants: participants,
        teams: participants.map(p => p.name),
        players: participantsType === 'players' ? participants : [],
        date: new Date().toLocaleString(),
        timestamp: Date.now(),
        status: 'active',
        sets: numberOfSets,
        points: {},
        scores: {},
        standings: []
    };
    
    participants.forEach(participant => {
        match.points[participant.id] = {
            total: 0,
            sets: new Array(numberOfSets).fill(0),
            name: participant.name,
            type: participant.type
        };
    });
    
    try {
        const matchId = await DataManager.saveMatch(match);
        match.id = matchId;
        allMatches.push(match);
        
        let html = `
            <div style="background: white; border-radius: 15px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); margin-top: 20px;">
                <h4 style="color: #1e3c72; margin-bottom: 15px;">${description}</h4>
                <p style="color: #666; margin-bottom: 20px;">
                    Игра на очки • ${numberOfSets} партий • 
                    ${participantsType === 'teams' ? 'Команды' : '1 на 1'}
                </p>
                
                <div class="table-responsive">
                    <table class="match-table" style="width: 100%; border-collapse: collapse; border: 1px solid #dee2e6;">
                        <thead>
                            <tr>
                                <th style="background: #1e3c72; color: white; padding: 15px; text-align: left;">
                                    ${participantsType === 'teams' ? 'Команды' : 'Игроки'}
                                </th>
                                ${participants.map(participant => {
                                    if (participant.type === 'team') {
                                        const teamPlayers = participant.players || [];
                                        return `
                                            <th style="background: #2a5298; color: white; padding: 15px; text-align: center; min-width: 150px;">
                                                <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                                                    <div style="display: flex; gap: 5px; justify-content: center;">
                                                        ${teamPlayers.slice(0, 3).map(player => `
                                                            <img src="${player.photo || 'images/default-player.png'}" 
                                                                 style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid white;">
                                                        `).join('')}
                                                        ${teamPlayers.length > 3 ? `<span style="background: rgba(255,255,255,0.2); padding: 5px 8px; border-radius: 15px; font-size: 0.7rem;">+${teamPlayers.length - 3}</span>` : ''}
                                                    </div>
                                                    <span style="font-size: 0.9rem; font-weight: bold;">${participant.name}</span>
                                                </div>
                                            </th>
                                        `;
                                    } else {
                                        const playerData = allPlayers.find(p => p.id === participant.id) || participant;
                                        return `
                                            <th style="background: #2a5298; color: white; padding: 15px; text-align: center; min-width: 100px;">
                                                <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                                                    <img src="${playerData.photo || 'images/default-player.png'}" 
                                                         style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid white;">
                                                    <span style="font-size: 0.9rem;">${participant.name}</span>
                                                </div>
                                            </th>
                                        `;
                                    }
                                }).join('')}
                                <th style="background: #1e3c72; color: white; padding: 15px; text-align: center; min-width: 100px;">Всего очков</th>
                                <th style="background: #1e3c72; color: white; padding: 15px; text-align: center; min-width: 60px;">Место</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${participants.map(participant1 => {
                                return `
                                    <tr style="border-bottom: 1px solid #dee2e6;">
                                        <td style="padding: 15px; background: #f8f9fa; font-weight: bold;">
                                            ${participant1.type === 'team' ? `
                                                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                                    ${participant1.players.slice(0, 3).map(player => `
                                                        <img src="${player.photo || 'images/default-player.png'}" 
                                                             style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid #1e3c72;">
                                                    `).join('')}
                                                    ${participant1.players.length > 3 ? `<span style="background: #1e3c72; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">+${participant1.players.length - 3}</span>` : ''}
                                                    <span style="color: #1e3c72;">${participant1.name}</span>
                                                </div>
                                            ` : `
                                                <div style="display: flex; align-items: center; gap: 10px;">
                                                    <img src="${(allPlayers.find(p => p.id === participant1.id)?.photo) || 'images/default-player.png'}" 
                                                         style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #1e3c72;">
                                                    <span style="color: #1e3c72;">${participant1.name}</span>
                                                </div>
                                            `}
                                        </td>
                                        ${participants.map(participant2 => {
                                            if (participant1.id === participant2.id) {
                                                return '<td style="padding: 15px; text-align: center; background: #f8f9fa; color: #999;">-</td>';
                                            } else {
                                                let setInputs = '';
                                                for (let i = 0; i < numberOfSets; i++) {
                                                    setInputs += `
                                                        <div style="display: flex; align-items: center; gap: 5px; margin: 2px 0;">
                                                            <span style="font-size: 0.7rem; color: #666;">${i + 1}:</span>
                                                            <input type="number" 
                                                                   id="points_${matchId}_${participant1.id}_vs_${participant2.id}_set${i}"
                                                                   placeholder="0"
                                                                   min="0"
                                                                   value="0"
                                                                   style="width: 50px; padding: 6px; text-align: center; border: 2px solid #e0e0e0; border-radius: 5px;"
                                                                   onchange="updatePointsScore('${matchId}', '${participant1.id}', this.value)">
                                                        </div>
                                                    `;
                                                }
                                                return `<td style="padding: 15px; text-align: center;">${setInputs}</td>`;
                                            }
                                        }).join('')}
                                        <td style="padding: 15px; text-align: center; font-weight: bold; color: #1e3c72; font-size: 1.2rem;" id="total_${matchId}_${participant1.id}">
                                            0
                                        </td>
                                        <td style="padding: 15px; text-align: center; font-weight: bold; font-size: 1.2rem;" id="rank_${matchId}_${participant1.id}">
                                            ${participants.indexOf(participant1) + 1}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div style="margin-top: 30px; display: flex; gap: 10px;">
                    <button onclick="recalculatePlayerTotals('${matchId}')" class="btn-primary">Пересчитать очки</button>
                    <button onclick="calculatePointsStandings('${matchId}')" class="btn-primary">Подсчитать места</button>
                    <button onclick="finishPointsMatch('${matchId}')" class="btn-success">Завершить турнир</button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (error) {
        alert(`Ошибка создания турнира: ${error.message}`);
    }
};

// =========== ОТОБРАЖЕНИЕ КЛАССИЧЕСКОГО МАТЧА ===========

function displayClassicMatch(match) {
    const matchDate = match.date || new Date(match.timestamp).toLocaleDateString('ru-RU');
    
    let html = `
        <div class="match-card">
            <div class="match-header">
                <div>
                    <h3>${match.description || 'Волейбольный матч'}</h3>
                    <span style="background: #28a745; color: white; padding: 3px 10px; border-radius: 15px; font-size: 0.8rem; margin-left: 10px;">🏐 Классический</span>
                </div>
                <span class="match-date">${matchDate}</span>
            </div>
            
            <div class="match-table-container">
                <table class="match-results-table">
                    <thead>
                        <tr>
                            <th style="min-width: 250px;">Команда / Игроки</th>
                            ${(match.teams || []).map(teamName => {
                                const teamPlayers = allTeams[teamName]?.players || [];
                                return `
                                    <th style="min-width: 180px; text-align: center;">
                                        <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                                            <div style="display: flex; gap: 5px; justify-content: center;">
                                                ${teamPlayers.slice(0, 3).map(player => `
                                                    <img src="${player.photo || 'images/default-player.png'}" 
                                                         style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 2px solid white;">
                                                `).join('')}
                                                ${teamPlayers.length > 3 ? `<span style="background: rgba(255,255,255,0.2); padding: 5px 8px; border-radius: 15px; font-size: 0.7rem;">+${teamPlayers.length - 3}</span>` : ''}
                                            </div>
                                            <span style="font-size: 0.8rem; font-weight: bold;">${teamName}</span>
                                        </div>
                                    </th>
                                `;
                            }).join('')}
                            <th style="text-align: center; min-width: 80px;">Очки</th>
                            <th style="text-align: center; min-width: 60px;">Место</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(match.teams || []).map(team1 => {
                            const team1Players = allTeams[team1]?.players || [];
                            const totalPoints = match.scores?.[team1]?.points || 0;
                            const rank = match.standings?.findIndex(t => t.name === team1) + 1 || match.teams.indexOf(team1) + 1;
                            
                            return `
                                <tr>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                            ${team1Players.slice(0, 3).map(player => `
                                                <img src="${player.photo || 'images/default-player.png'}" 
                                                     style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid #1e3c72;">
                                            `).join('')}
                                            ${team1Players.length > 3 ? `<span style="background: #1e3c72; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">+${team1Players.length - 3}</span>` : ''}
                                            <span style="font-weight: bold; color: #1e3c72;">${team1}</span>
                                        </div>
                                    </td>
                                    ${(match.teams || []).map(team2 => {
                                        if (team1 === team2) {
                                            return '<td style="text-align: center; background: #f8f9fa; color: #999;">-</td>';
                                        } else {
                                            const scores = match.scores?.[team1]?.sets || {};
                                            return `
                                                <td style="text-align: center;">
                                                    <div style="display: flex; flex-direction: column; gap: 3px; align-items: center;">
                                                        <div style="display: flex; align-items: center; gap: 5px; justify-content: center;">
                                                            <span style="font-size: 0.8rem; color: #666;">1:</span>
                                                            <span style="font-weight: bold;">${scores[1] || '0:0'}</span>
                                                        </div>
                                                        <div style="display: flex; align-items: center; gap: 5px; justify-content: center;">
                                                            <span style="font-size: 0.8rem; color: #666;">2:</span>
                                                            <span style="font-weight: bold;">${scores[2] || '0:0'}</span>
                                                        </div>
                                                        <div style="display: flex; align-items: center; gap: 5px; justify-content: center;">
                                                            <span style="font-size: 0.8rem; color: #666;">3:</span>
                                                            <span style="font-weight: bold;">${scores[3] || '0:0'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            `;
                                        }
                                    }).join('')}
                                    <td style="text-align: center; font-weight: bold; color: #1e3c72;">
                                        ${totalPoints}
                                    </td>
                                    <td style="text-align: center; font-weight: bold;
                                        ${rank === 1 ? 'color: #ffd700;' : 
                                          rank === 2 ? 'color: #c0c0c0;' : 
                                          rank === 3 ? 'color: #cd7f32;' : ''}">
                                        ${rank}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="match-footer">
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <div><strong>Команд:</strong> ${match.teams?.length || 0}</div>
                    <div><strong>Победитель:</strong> <span style="color: #ffd700; font-weight: bold;">${match.standings?.[0]?.name || ''}</span></div>
                    <div><strong>Очки победителя:</strong> ${match.scores?.[match.standings?.[0]?.name]?.points || 0}</div>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

function displayPointsMatch(match) {
    const matchDate = match.date || new Date(match.timestamp).toLocaleDateString('ru-RU');
    const isTeamsMode = match.participantsType === 'teams';
    const participants = match.participants || match.players?.map(p => ({ 
        id: p.id, 
        name: p.name, 
        type: 'player',
        players: [allPlayers.find(pl => pl.id === p.id)]
    })) || [];
    
    let html = `
        <div class="match-card">
            <div class="match-header">
                <div>
                    <h3>${match.description || 'Турнир'}</h3>
                    <span style="background: #ffd700; color: #1e3c72; padding: 3px 10px; border-radius: 15px; font-size: 0.8rem; margin-left: 10px;">
                        🎯 Игра на очки • ${isTeamsMode ? 'Команды' : '1 на 1'}
                    </span>
                </div>
                <span class="match-date">${matchDate}</span>
            </div>
            
            <div class="match-table-container">
                <table class="match-results-table">
                    <thead>
                        <tr>
                            <th style="min-width: 250px;">${isTeamsMode ? 'Команды' : 'Игроки'}</th>
                            ${participants.map(participant => {
                                if (isTeamsMode) {
                                    const teamData = allTeams[participant.name] || { players: [] };
                                    return `
                                        <th style="text-align: center; min-width: 120px;">
                                            <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                                                <div style="display: flex; gap: 5px; justify-content: center;">
                                                    ${teamData.players.slice(0, 3).map(player => `
                                                        <img src="${player.photo || 'images/default-player.png'}" 
                                                             style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 2px solid white;">
                                                    `).join('')}
                                                    ${teamData.players.length > 3 ? `<span style="background: rgba(255,255,255,0.2); padding: 5px 8px; border-radius: 15px; font-size: 0.7rem;">+${teamData.players.length - 3}</span>` : ''}
                                                </div>
                                                <span style="font-size: 0.8rem; font-weight: bold;">${participant.name}</span>
                                            </div>
                                        </th>
                                    `;
                                } else {
                                    const playerData = allPlayers.find(p => p.id === participant.id) || participant;
                                    return `
                                        <th style="text-align: center; min-width: 100px;">
                                            <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                                                <img src="${playerData.photo || 'images/default-player.png'}" 
                                                     style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid white;">
                                                <span style="font-size: 0.8rem;">${participant.name.split(' ')[0]}</span>
                                            </div>
                                        </th>
                                    `;
                                }
                            }).join('')}
                            <th style="text-align: center; min-width: 80px;">Всего очков</th>
                            <th style="text-align: center; min-width: 60px;">Место</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${participants.map(participant1 => {
                            let totalPoints = match.points?.[participant1.id]?.total || 0;
                            const rank = match.standings?.findIndex(p => p.id === participant1.id) + 1 || participants.indexOf(participant1) + 1;
                            
                            return `
                                <tr>
                                    <td style="display: flex; align-items: center; gap: 10px; padding: 10px;">
                                        ${isTeamsMode ? `
                                            <div style="display: flex; align-items: center; gap: 10px;">
                                                ${(allTeams[participant1.name]?.players || []).slice(0, 3).map(player => `
                                                    <img src="${player.photo || 'images/default-player.png'}" 
                                                         style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid #1e3c72;">
                                                `).join('')}
                                                <span style="font-weight: bold; color: #1e3c72;">${participant1.name}</span>
                                            </div>
                                        ` : `
                                            <img src="${(allPlayers.find(p => p.id === participant1.id)?.photo) || 'images/default-player.png'}" 
                                                 style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #1e3c72;">
                                            <span style="font-weight: bold; color: #1e3c72;">${participant1.name}</span>
                                        `}
                                    </td>
                                    ${participants.map(participant2 => {
                                        if (participant1.id === participant2.id) {
                                            return '<td style="text-align: center; background: #f8f9fa; color: #999;">-</td>';
                                        } else {
                                            const scores = [];
                                            for (let i = 0; i < (match.sets || 1); i++) {
                                                const score = match.points?.[participant1.id]?.sets?.[i] || 0;
                                                scores.push(score);
                                            }
                                            return `<td style="text-align: center; font-weight: bold;">${scores.join(' | ') || '0'}</td>`;
                                        }
                                    }).join('')}
                                    <td style="text-align: center; font-weight: bold; color: #1e3c72;">
                                        ${totalPoints}
                                    </td>
                                    <td style="text-align: center; font-weight: bold; 
                                        ${rank === 1 ? 'color: #ffd700;' : 
                                          rank === 2 ? 'color: #c0c0c0;' : 
                                          rank === 3 ? 'color: #cd7f32;' : ''}">
                                        ${rank}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="match-footer">
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <div><strong>Участников:</strong> ${participants.length}</div>
                    <div><strong>Партий:</strong> ${match.sets || 1}</div>
                    <div><strong>Победитель:</strong> <span style="color: #ffd700; font-weight: bold;">${match.standings?.[0]?.name || ''}</span></div>
                    <div><strong>Очки победителя:</strong> ${match.standings?.[0]?.total || 0}</div>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

// =========== РЕДАКТИРОВАНИЕ МАТЧЕЙ ===========

window.showEditMatches = async () => {
    if (!isAdmin) {
        alert('Доступ только для администраторов');
        return;
    }
    
    try {
        allMatches = await DataManager.getMatches();
        
        const area = document.getElementById('admin-area');
        area.innerHTML = `
            <h3 style="color: #1e3c72;">Редактирование матчей</h3>
            
            <div class="matches-edit-container" style="margin-top: 20px;">
                ${allMatches.length === 0 ? 
                    '<p>Нет созданных матчей</p>' : 
                    allMatches.map(match => `
                        <div class="match-edit-card" style="background: white; border-radius: 15px; padding: 20px; margin-bottom: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); border-left: 5px solid ${match.status === 'completed' ? '#28a745' : '#ffd700'};">
                            <div class="match-edit-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                <h4 style="margin: 0; color: #1e3c72;">${match.description || 'Матч'}</h4>
                                <span class="match-date" style="color: #666; font-size: 0.9rem;">${match.date || new Date(match.timestamp).toLocaleDateString()}</span>
                            </div>
                            <div class="match-edit-info" style="margin-bottom: 15px;">
                                <p style="margin: 5px 0;"><strong>Тип:</strong> ${match.matchType === 'points' ? '🎯 Игра на очки' : '🏐 Классический'}</p>
                                <p style="margin: 5px 0;"><strong>Участники:</strong> ${match.teams?.join(', ') || match.players?.map(p => p.name).join(', ') || ''}</p>
                                <p style="margin: 5px 0;"><strong>Статус:</strong> ${match.status === 'completed' ? 'Завершен' : 'Активный'}</p>
                                ${match.status === 'completed' ? 
                                    `<p style="margin: 5px 0;"><strong>Победитель:</strong> ${match.standings?.[0]?.name || ''}</p>` : 
                                    ''}
                            </div>
                            <div class="match-edit-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <button onclick="editMatch('${match.id}')" class="admin-btn">Редактировать</button>
                                <button onclick="deleteMatch('${match.id}')" class="btn-delete">Удалить</button>
                                ${match.status === 'completed' ? 
                                    `<button onclick="reopenMatch('${match.id}')" class="btn-warning">Возобновить</button>` : 
                                    `<button onclick="finishMatch('${match.id}')" class="btn-success">Завершить</button>`
                                }
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;
    } catch (error) {
        alert(`Ошибка загрузки матчей: ${error.message}`);
    }
};

window.editMatch = async (matchId) => {
    const match = allMatches.find(m => m.id === matchId);
    
    if (!match) {
        alert('Матч не найден');
        return;
    }
    
    const area = document.getElementById('admin-area');
    
    if (match.matchType === 'points') {
        area.innerHTML = `
            <h3 style="color: #1e3c72;">Редактирование игры на очки</h3>
            <p><strong>${match.description || 'Турнир'}</strong> (${match.date || new Date(match.timestamp).toLocaleDateString()})</p>
            
            <div id="points-match-container" style="margin-top: 20px;"></div>
            
            <div style="margin-top: 20px;">
                <button onclick="showEditMatches()" class="btn-secondary">Вернуться к списку</button>
            </div>
        `;
        
        const container = document.getElementById('points-match-container');
        
        let html = `
            <div style="background: white; border-radius: 15px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                <h4 style="color: #1e3c72; margin-bottom: 15px;">${match.description}</h4>
                <p style="color: #666; margin-bottom: 20px;">Редактирование • ${match.sets || 1} партий</p>
                
                <div class="table-responsive">
                    <table class="match-table" style="width: 100%; border-collapse: collapse; border: 1px solid #dee2e6;">
                        <thead>
                            <tr>
                                <th style="background: #1e3c72; color: white; padding: 15px; text-align: left;">
                                    ${match.participantsType === 'teams' ? 'Команды' : 'Игроки'}
                                </th>
                                ${(match.participants || match.players || []).map(participant => {
                                    if (match.participantsType === 'teams') {
                                        const teamPlayers = allTeams[participant.name]?.players || [];
                                        return `
                                            <th style="background: #2a5298; color: white; padding: 15px; text-align: center;">
                                                <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                                                    <div style="display: flex; gap: 5px; justify-content: center;">
                                                        ${teamPlayers.slice(0, 3).map(player => `
                                                            <img src="${player.photo || 'images/default-player.png'}" 
                                                                 style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid white;">
                                                        `).join('')}
                                                        ${teamPlayers.length > 3 ? `<span style="background: rgba(255,255,255,0.2); padding: 5px 8px; border-radius: 15px; font-size: 0.7rem;">+${teamPlayers.length - 3}</span>` : ''}
                                                    </div>
                                                    <span style="font-size: 0.9rem; font-weight: bold;">${participant.name}</span>
                                                </div>
                                            </th>
                                        `;
                                    } else {
                                        const playerData = allPlayers.find(p => p.id === participant.id) || participant;
                                        return `
                                            <th style="background: #2a5298; color: white; padding: 15px; text-align: center;">
                                                <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                                                    <img src="${playerData.photo || 'images/default-player.png'}" 
                                                         style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid white;">
                                                    <span style="font-size: 0.9rem;">${participant.name}</span>
                                                </div>
                                            </th>
                                        `;
                                    }
                                }).join('')}
                                <th style="background: #1e3c72; color: white; padding: 15px; text-align: center;">Всего очков</th>
                                <th style="background: #1e3c72; color: white; padding: 15px; text-align: center;">Место</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(match.participants || match.players || []).map(participant1 => {
                                return `
                                    <tr style="border-bottom: 1px solid #dee2e6;">
                                        <td style="padding: 15px; background: #f8f9fa; font-weight: bold;">
                                            ${match.participantsType === 'teams' ? `
                                                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                                    ${(allTeams[participant1.name]?.players || []).slice(0, 3).map(player => `
                                                        <img src="${player.photo || 'images/default-player.png'}" 
                                                             style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid #1e3c72;">
                                                    `).join('')}
                                                    ${(allTeams[participant1.name]?.players || []).length > 3 ? `<span style="background: #1e3c72; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">+${allTeams[participant1.name]?.players.length - 3}</span>` : ''}
                                                    <span style="color: #1e3c72;">${participant1.name}</span>
                                                </div>
                                            ` : `
                                                <div style="display: flex; align-items: center; gap: 10px;">
                                                    <img src="${(allPlayers.find(p => p.id === participant1.id)?.photo) || 'images/default-player.png'}" 
                                                         style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #1e3c72;">
                                                    <span style="color: #1e3c72;">${participant1.name}</span>
                                                </div>
                                            `}
                                        </td>
                                        ${(match.participants || match.players || []).map(participant2 => {
                                            if (participant1.id === participant2.id) {
                                                return '<td style="padding: 15px; text-align: center; background: #f8f9fa; color: #999;">-</td>';
                                            } else {
                                                let setInputs = '';
                                                for (let i = 0; i < (match.sets || 1); i++) {
                                                    const score = match.points?.[participant1.id]?.sets?.[i] || 0;
                                                    setInputs += `
                                                        <div style="display: flex; align-items: center; gap: 5px; margin: 2px 0;">
                                                            <span style="font-size: 0.7rem; color: #666;">${i + 1}:</span>
                                                            <input type="number" 
                                                                   id="points_${matchId}_${participant1.id}_vs_${participant2.id}_set${i}"
                                                                   placeholder="0"
                                                                   min="0"
                                                                   value="${score}"
                                                                   style="width: 50px; padding: 6px; text-align: center; border: 2px solid #e0e0e0; border-radius: 5px;"
                                                                   onchange="updatePointsScore('${matchId}', '${participant1.id}', this.value)">
                                                        </div>
                                                    `;
                                                }
                                                return `<td style="padding: 15px; text-align: center;">${setInputs}</td>`;
                                            }
                                        }).join('')}
                                        <td style="padding: 15px; text-align: center; font-weight: bold; color: #1e3c72; font-size: 1.2rem;" id="total_${matchId}_${participant1.id}">
                                            ${match.points?.[participant1.id]?.total || 0}
                                        </td>
                                        <td style="padding: 15px; text-align: center; font-weight: bold; font-size: 1.2rem;" id="rank_${matchId}_${participant1.id}">
                                            ${match.standings?.findIndex(p => p.id === participant1.id) + 1 || (match.players?.indexOf(participant1) + 1) || 1}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div style="margin-top: 30px; display: flex; gap: 10px;">
                    <button onclick="recalculatePlayerTotals('${matchId}')" class="btn-primary">Пересчитать очки</button>
                    <button onclick="calculatePointsStandings('${matchId}')" class="btn-primary">Подсчитать места</button>
                    <button onclick="finishPointsMatch('${matchId}')" class="btn-success">Завершить турнир</button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
    } else {
        area.innerHTML = `
            <h3 style="color: #1e3c72; margin-bottom: 20px;">Редактирование классического матча</h3>
            <p style="margin-bottom: 20px;"><strong>${match.description || 'Матч'}</strong> (${match.date || new Date(match.timestamp).toLocaleDateString()})</p>
            
            <div id="classic-match-container" style="margin-top: 20px;"></div>
            
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button onclick="showEditMatches()" class="btn-secondary">Вернуться к списку</button>
                <button onclick="saveClassicMatchChanges('${matchId}')" class="btn-success">Сохранить изменения</button>
            </div>
        `;
        
        const container = document.getElementById('classic-match-container');
        
        let html = `
            <div style="background: white; border-radius: 15px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                <h4 style="color: #1e3c72; margin-bottom: 15px;">${match.description}</h4>
                <p style="color: #666; margin-bottom: 20px;">Редактирование матча • Ручной ввод очков</p>
                
                <div class="table-responsive">
                    <table class="match-table" style="width: 100%; border-collapse: collapse; border: 1px solid #dee2e6;">
                        <thead>
                            <tr>
                                <th style="background: #1e3c72; color: white; padding: 15px; text-align: left;">Команда / Игроки</th>
                                ${(match.teams || []).map(teamName => {
                                    const teamPlayers = allTeams[teamName]?.players || [];
                                    return `
                                        <th style="background: #2a5298; color: white; padding: 15px; text-align: center;">
                                            <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                                                <div style="display: flex; gap: 5px; justify-content: center;">
                                                    ${teamPlayers.slice(0, 3).map(player => `
                                                        <img src="${player.photo || 'images/default-player.png'}" 
                                                             style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid white;">
                                                    `).join('')}
                                                    ${teamPlayers.length > 3 ? `<span style="background: rgba(255,255,255,0.2); padding: 5px 8px; border-radius: 15px; font-size: 0.7rem;">+${teamPlayers.length - 3}</span>` : ''}
                                                </div>
                                                <span style="font-size: 0.9rem; font-weight: bold;">${teamName}</span>
                                            </div>
                                        </th>
                                    `;
                                }).join('')}
                                <th style="background: #1e3c72; color: white; padding: 15px; text-align: center; min-width: 80px;">Очки</th>
                                <th style="background: #1e3c72; color: white; padding: 15px; text-align: center; min-width: 60px;">Место</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(match.teams || []).map((team1, rowIndex) => {
                                const team1Players = allTeams[team1]?.players || [];
                                return `
                                    <tr style="border-bottom: 1px solid #dee2e6;">
                                        <td style="padding: 15px; background: #f8f9fa; font-weight: bold;">
                                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                                ${team1Players.slice(0, 3).map(player => `
                                                    <img src="${player.photo || 'images/default-player.png'}" 
                                                         style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid #1e3c72;">
                                                    `).join('')}
                                                ${team1Players.length > 3 ? `<span style="background: #1e3c72; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">+${team1Players.length - 3}</span>` : ''}
                                                <span style="color: #1e3c72;">${team1}</span>
                                            </div>
                                        </td>
                                        ${(match.teams || []).map((team2, colIndex) => {
                                            if (team1 === team2) {
                                                return '<td style="padding: 15px; text-align: center; background: #f8f9fa; color: #999;">-</td>';
                                            } else {
                                                const scores = match.scores?.[team1]?.sets || {};
                                                return `
                                                    <td style="padding: 15px; text-align: center;">
                                                        <div style="display: flex; flex-direction: column; gap: 5px; align-items: center;">
                                                            <div style="display: flex; align-items: center; gap: 5px;">
                                                                <span style="font-size: 0.8rem; color: #666;">1:</span>
                                                                <input type="text" 
                                                                       id="score_${matchId}_${team1}_vs_${team2}_set1"
                                                                       placeholder="0:0"
                                                                       value="${scores[1] || ''}"
                                                                       style="width: 60px; padding: 6px; text-align: center; border: 2px solid #e0e0e0; border-radius: 5px;"
                                                                       onchange="updateSetScore('${matchId}', '${team1}', '${team2}', 1, this.value)">
                                                            </div>
                                                            <div style="display: flex; align-items: center; gap: 5px;">
                                                                <span style="font-size: 0.8rem; color: #666;">2:</span>
                                                                <input type="text" 
                                                                       id="score_${matchId}_${team1}_vs_${team2}_set2"
                                                                       placeholder="0:0"
                                                                       value="${scores[2] || ''}"
                                                                       style="width: 60px; padding: 6px; text-align: center; border: 2px solid #e0e0e0; border-radius: 5px;"
                                                                       onchange="updateSetScore('${matchId}', '${team1}', '${team2}', 2, this.value)">
                                                            </div>
                                                            <div style="display: flex; align-items: center; gap: 5px;">
                                                                <span style="font-size: 0.8rem; color: #666;">3:</span>
                                                                <input type="text" 
                                                                       id="score_${matchId}_${team1}_vs_${team2}_set3"
                                                                       placeholder="0:0"
                                                                       value="${scores[3] || ''}"
                                                                       style="width: 60px; padding: 6px; text-align: center; border: 2px solid #e0e0e0; border-radius: 5px;"
                                                                       onchange="updateSetScore('${matchId}', '${team1}', '${team2}', 3, this.value)">
                                                            </div>
                                                        </div>
                                                    </td>
                                                `;
                                            }
                                        }).join('')}
                                        <td style="padding: 15px; text-align: center;">
                                            <input type="number" 
                                                   id="points_${matchId}_${team1}"
                                                   placeholder="0"
                                                   min="0"
                                                   value="${match.scores?.[team1]?.points || 0}"
                                                   style="width: 70px; padding: 8px; text-align: center; border: 2px solid #e0e0e0; border-radius: 5px; font-weight: bold; color: #1e3c72;"
                                                   onchange="updateTeamPoints('${matchId}', '${team1}', this.value)">
                                        </td>
                                        <td style="padding: 15px; text-align: center; font-weight: bold; font-size: 1.2rem;" id="rank_${matchId}_${team1}">
                                            ${match.standings?.findIndex(t => t.name === team1) + 1 || rowIndex + 1}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div style="margin-top: 30px; display: flex; gap: 10px;">
                    <button onclick="calculateClassicStandings('${matchId}')" class="btn-primary">Подсчитать места</button>
                    <button onclick="finishClassicMatch('${matchId}')" class="btn-success">Завершить матч</button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
};

window.saveClassicMatchChanges = async (matchId) => {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    try {
        await DataManager.saveMatch(match);
        console.log('Изменения сохранены:', match);
        alert('✅ Изменения сохранены!');
        
        const index = allMatches.findIndex(m => m.id === matchId);
        if (index !== -1) {
            allMatches[index] = match;
        }
        
        showEditMatches();
    } catch (error) {
        console.error('Ошибка сохранения изменений:', error);
        alert('❌ Ошибка сохранения изменений');
    }
};

window.deleteMatch = async (matchId) => {
    if (!confirm('Удалить этот матч?')) return;
    
    try {
        await DataManager.deleteMatch(matchId);
        alert('Матч удален');
        
        allMatches = allMatches.filter(m => m.id !== matchId);
        showEditMatches();
        
    } catch (error) {
        alert(`Ошибка удаления: ${error.message}`);
    }
};

window.reopenMatch = async (matchId) => {
    const match = allMatches.find(m => m.id === matchId);
    
    if (match) {
        match.status = 'active';
        delete match.completedAt;
        
        try {
            await DataManager.saveMatch(match);
            alert('Матч возобновлен для редактирования');
            showEditMatches();
        } catch (error) {
            alert(`Ошибка: ${error.message}`);
        }
    }
};

window.finishMatch = async (matchId) => {
    const match = allMatches.find(m => m.id === matchId);
    
    if (match) {
        if (match.matchType === 'points') {
            await finishPointsMatch(matchId);
        } else {
            await finishClassicMatch(matchId);
        }
    }
};

// =========== АДАПТИВНЫЙ ХЕДЕР ===========

let lastScrollTop = 0;
const header = document.querySelector('.header');

function handleScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (header) {
        if (scrollTop > 100) {
            header.classList.add('compact');
            
            if (scrollTop > lastScrollTop && scrollTop > 200) {
                header.classList.add('hidden');
            } else {
                header.classList.remove('hidden');
            }
        } else {
            header.classList.remove('compact', 'hidden');
        }
    }
    
    lastScrollTop = scrollTop;
}

function closeMobileMenu() {}

function initResponsiveHeader() {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
}

// =========== ЗАПУСК ПРИЛОЖЕНИЯ ===========
document.addEventListener('DOMContentLoaded', initApp);