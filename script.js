// Модуль для работы с Firebase
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
            await db.collection('teams').doc(teamName).set({
                name: teamName,
                players: players || [],
                createdAt: new Date().toISOString(),
                createdBy: currentUser
            });
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
            if (match.id) {
                // Обновление существующего матча
                await db.collection('matches').doc(match.id).update({
                    description: match.description,
                    teams: match.teams,
                    scores: match.scores,
                    status: match.status,
                    updatedAt: new Date().toISOString()
                });
                return match.id;
            } else {
                // Создание нового матча
                const docRef = await db.collection('matches').add({
                    ...match,
                    timestamp: Date.now(),
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
            
            // Получаем данные пользователя
            const userData = await this.getUser(user.uid);
            if (!userData) {
                // Если пользователь есть в Auth, но нет в Firestore
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
            // Создаем пользователя в Authentication
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Сохраняем в Firestore
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
            // Проверяем, есть ли игроки
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

// Глобальные переменные
let currentUser = null;
let isAdmin = false;
let allPlayers = [];
let allTeams = {};
let allMatches = [];

// =========== ФУНКЦИИ ПРИЛОЖЕНИЯ ===========

// Инициализация приложения
async function initApp() {
    console.log('Инициализация приложения...');
    
    // Проверяем Firebase
    if (!DataManager.isInitialized()) {
        console.error('Ошибка: Firebase не инициализирован');
        return;
    }
    
    try {
        // Настраиваем слушатель аутентификации
        setupAuthListener();
        
        // Инициализируем данные по умолчанию
        await DataManager.initDefaultData();
        
        // Загружаем данные
        await loadAllData();
        
        // Инициализируем навигацию
        initNavigation();
        
        // Показываем домашнюю страницу (если не была открыта другая через хеш)
        if (!window.location.hash || window.location.hash === '#home') {
            showSection('home');
        } else {
            // Обрабатываем хеш из URL
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
            
            // Получаем данные пользователя
            const userData = await DataManager.getUser(user.uid);
            if (userData) {
                isAdmin = userData.role === 'admin';
                document.getElementById('current-username').textContent = userData.username || user.email.split('@')[0];
                console.log('Роль пользователя:', userData.role);
            }
            
            updateNavigation();
        } else {
            console.log('Пользователь вышел');
            currentUser = null;
            isAdmin = false;
            document.getElementById('current-username').textContent = '';
            updateNavigation();
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

// Функции отображения секций
window.showSection = function (name) {
    console.log('Переход на секцию:', name);
    
    try {
        // Скрываем все секции
        document.querySelectorAll('section').forEach(s => {
            if (s.id.startsWith('section-')) {
                s.style.display = 'none';
            }
        });
        
        // Показываем нужную секцию
        const section = document.getElementById('section-' + name);
        if (section) {
            section.style.display = 'block';
            // Обновляем URL
            window.location.hash = name;
        } else {
            console.error('Секция не найдена:', 'section-' + name);
        }

        // Обработка специальных случаев
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

// Инициализация навигации
function initNavigation() {
    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionName = link.dataset.section;
            showSection(sectionName);
        });
    });
    
    // Обновить навигацию в зависимости от статуса
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

// =========== АУТЕНТИФИКАЦИЯ ===========

// Регистрация
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
    
    // Проверяем, не пытаются ли зарегистрировать админа
    if (username.toLowerCase() === 'admin') {
        alert('Логин "admin" зарезервирован. Используйте другой логин.');
        return;
    }
    
    try {
        await DataManager.register(email, password, username);
        alert('Регистрация прошла успешно! Теперь вы можете войти.');
        
        // Очищаем поля
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

// Вход
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
        
        // Очищаем поля
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        
        // Переходим на главную
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

// Выход
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

// Показать всех игроков
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

// Показать прошедшие матчи
// Показать прошедшие матчи
async function displayPastMatches() {
    const container = document.getElementById('matches-list');
    if (!container) return;
    
    try {
        allMatches = await DataManager.getMatches();
        allTeams = await DataManager.getTeams();
        
        if (allMatches.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 40px; color: #666; font-size: 1.2rem;">Нет завершенных матчей</p>';
            return;
        }
        
        let html = '';
        allMatches.forEach(match => {
            // Фильтруем только завершенные матчи
            if (match.status !== 'completed') return;
            
            // Функция для получения игроков команды
            const getTeamPlayers = (teamName) => {
                const team = allTeams[teamName];
                if (!team) return [];
                return Array.isArray(team.players) ? team.players : [];
            };
            
            const matchDate = match.date || (match.timestamp ? new Date(match.timestamp).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Дата не указана');
            
            html += `
                <div class="match-card">
                    <div class="match-header">
                        <h3>${match.description || 'Волейбольный матч'}</h3>
                        <span class="match-date">${matchDate}</span>
                    </div>
                    
                    ${match.scores ? `
                        <div class="match-table-container">
                            <table class="match-results-table">
                                <thead>
                                    <tr>
                                        <th style="min-width: 200px;">Команда / Игроки</th>
                                        ${match.teams.map(teamName => {
                                            const teamPlayers = getTeamPlayers(teamName);
                                            const shortName = teamName.length > 30 ? teamName.substring(0, 27) + '...' : teamName;
                                            return `
                                                <th style="min-width: 150px;">
                                                    <div style="margin-bottom: 10px; font-size: 0.9rem; font-weight: bold;">${shortName}</div>
                                                    <div class="team-thumbnail">
                                                        ${teamPlayers.slice(0, 4).map(player => `
                                                            <img src="${player.photo || 'images/default-player.png'}" 
                                                                 alt="${player.name}"
                                                                 title="${player.name}"
                                                                 onerror="this.src='images/default-player.png'">
                                                        `).join('')}
                                                        ${teamPlayers.length > 4 ? `<span style="color: #666; font-size: 0.8rem;">+${teamPlayers.length - 4}</span>` : ''}
                                                    </div>
                                                </th>
                                            `;
                                        }).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${match.teams.map(teamName => {
                                        const teamPlayers = getTeamPlayers(teamName);
                                        return `
                                            <tr>
                                                <td>
                                                    <div class="team-display">
                                                        ${teamPlayers.map(player => `
                                                            <div class="team-player-display">
                                                                <img src="${player.photo || 'images/default-player.png'}" 
                                                                     alt="${player.name}"
                                                                     onerror="this.src='images/default-player.png'">
                                                                <span>${player.name}</span>
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                </td>
                                                ${match.teams.map(opponent => {
                                                    if (teamName === opponent) {
                                                        return '<td class="score-cell" style="background: #f8f9fa; color: #999;">-</td>';
                                                    } else {
                                                        const score = match.scores && match.scores[teamName] && match.scores[teamName][opponent] ? 
                                                                      match.scores[teamName][opponent] : '0:0';
                                                        return `<td class="score-cell">${score}</td>`;
                                                    }
                                                }).join('')}
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 20px; color: #666;">
                            <p>Счет не указан</p>
                        </div>
                    `}
                    
                    <div class="match-footer">
                        <div style="margin-bottom: 5px;">
                            <strong>Участники:</strong> ${match.teams.join(', ')}
                        </div>
                        <div style="color: #28a745; font-weight: bold;">
                            ✅ Матч завершен
                        </div>
                    </div>
                </div>
            `;
        });
        
        // Если нет завершенных матчей
        if (html === '') {
            html = '<p style="text-align: center; padding: 40px; color: #666; font-size: 1.2rem;">Нет завершенных матчей</p>';
        }
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Ошибка загрузки матчей:', error);
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: #dc3545;">Ошибка загрузки матчей</p>';
    }
}
// =========== АДМИНКА ===========

// Показать панель администратора
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
            
            <div class="admin-stat-card">
                <h4 style="margin-top: 0;">Последние матчи</h4>
                ${getRecentMatchesHTML()}
            </div>
        </div>
    `;
};

function getRecentMatchesHTML() {
    const recentMatches = allMatches.slice(0, 3);
    
    if (recentMatches.length === 0) {
        return '<p>Нет завершенных матчей</p>';
    }
    
    let html = '';
    recentMatches.forEach(match => {
        html += `
            <div class="recent-match" style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-weight: bold; color: #1e3c72;">${match.description || 'Матч'}</div>
                <div style="font-size: 0.9rem; color: #666;">${match.date || new Date(match.timestamp).toLocaleDateString()}</div>
                <div style="font-size: 0.9rem;">${match.teams.join(', ')}</div>
            </div>
        `;
    });
    
    return html;
}

// Создать команду
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
            <h3 style="color: #1e3c72;">Создать новую команду</h3>
            
            <p>Название команды будет создано автоматически из имен выбранных игроков.</p>
            
            <h4>Выберите игроков (минимум 2):</h4>
            <div id="players-selection" class="players-selection-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
                ${allPlayers.map((player, index) => `
                    <div class="player-checkbox-card" style="border: 2px solid #e0e0e0; border-radius: 10px; padding: 15px; cursor: pointer; transition: all 0.3s ease;">
                        <label class="player-checkbox-label" style="cursor: pointer; display: block;">
                            <input type="checkbox" value="${player.name}" class="player-checkbox-input" style="display: none;">
                            <div class="player-checkbox-content" style="text-align: center;">
                                <img src="${player.photo || 'images/default-player.png'}" 
                                     alt="${player.name}"
                                     onerror="this.src='images/default-player.png'"
                                     style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 10px;">
                                <span style="display: block;">${player.name}</span>
                            </div>
                        </label>
                    </div>
                `).join('')}
            </div>
            
            <div style="margin: 30px 0;">
                <button onclick="saveNewTeam()" class="btn-primary" style="padding: 12px 30px; margin-right: 10px;">Создать команду</button>
                <button onclick="showAdminDashboard()" class="btn-secondary">Отмена</button>
            </div>
            
            <h4>Существующие команды:</h4>
            <div id="existing-teams" style="margin-top: 20px;"></div>
        `;
        
        // Добавляем обработчики кликов
        document.querySelectorAll('.player-checkbox-card').forEach(card => {
            card.addEventListener('click', function() {
                const checkbox = this.querySelector('.player-checkbox-input');
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) {
                    this.style.borderColor = '#1e3c72';
                    this.style.backgroundColor = '#f0f4ff';
                } else {
                    this.style.borderColor = '#e0e0e0';
                    this.style.backgroundColor = 'transparent';
                }
            });
        });
        
        await displayExistingTeams();
    } catch (error) {
        alert(`Ошибка загрузки данных: ${error.message}`);
    }
};

// Отображение существующих команд
async function displayExistingTeams() {
    const container = document.getElementById('existing-teams');
    if (!container) return;
    
    allTeams = await DataManager.getTeams();
    
    if (Object.keys(allTeams).length === 0) {
        container.innerHTML = '<p>Нет созданных команд</p>';
        return;
    }
    
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">';
    
    for (const [teamName, teamData] of Object.entries(allTeams)) {
        const players = Array.isArray(teamData.players) ? teamData.players : [];
        html += `
            <div class="team-card" style="background: white; border-radius: 15px; padding: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); border-left: 5px solid #ffd700;">
                <div class="team-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h4 style="margin: 0; color: #1e3c72;">${teamName}</h4>
                    <button onclick="deleteTeam('${teamName}')" class="btn-delete" style="padding: 5px 10px; font-size: 0.9rem;">Удалить</button>
                </div>
                <div class="team-players">
                    ${players.map(player => `
                        <div class="team-player" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 8px; background: #f8f9fa; border-radius: 8px;">
                            <img src="${player.photo || 'images/default-player.png'}" 
                                 alt="${player.name}"
                                 onerror="this.src='images/default-player.png'"
                                 style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                            <span>${player.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// Сохранение новой команды
window.saveNewTeam = async () => {
    const selectedPlayers = Array.from(document.querySelectorAll('.player-checkbox-input:checked'))
        .map(cb => cb.value);
    
    if (selectedPlayers.length < 2) {
        alert('Выберите минимум 2 игрока');
        return;
    }
    
    // Создаем название команды из имен игроков
    const teamName = selectedPlayers.join(' + ');
    
    // Находим полные данные выбранных игроков
    const playersData = allPlayers.filter(p => selectedPlayers.includes(p.name));
    
    try {
        await DataManager.saveTeam(teamName, playersData);
        alert(`Команда создана: ${teamName}`);
        
        // Обновляем список команд
        allTeams = await DataManager.getTeams();
        showCreateTeam();
        
    } catch (error) {
        alert(`Ошибка создания команды: ${error.message}`);
    }
};

// Удаление команды
window.deleteTeam = async (teamName) => {
    if (!confirm(`Удалить команду "${teamName}"?`)) return;
    
    try {
        await DataManager.deleteTeam(teamName);
        alert('Команда удалена');
        
        // Обновляем список команд
        allTeams = await DataManager.getTeams();
        displayExistingTeams();
        
    } catch (error) {
        alert(`Ошибка удаления команды: ${error.message}`);
    }
};

// Создать таблицу матча
window.showCreateMatch = async () => {
    if (!isAdmin) {
        alert('Доступ только для администраторов');
        return;
    }
    
    try {
        allTeams = await DataManager.getTeams();
        const teamNames = Object.keys(allTeams);
        
        if (teamNames.length < 2) {
            alert('Сначала создайте хотя бы две команды');
            return;
        }
        
        const area = document.getElementById('admin-area');
        area.innerHTML = `
            <h3 style="color: #1e3c72;">Создать таблицу матча</h3>
            
            <div class="match-creation-container">
                <h4>Выберите команды для участия (минимум 2):</h4>
                <div id="team-selection-area" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; margin: 20px 0;">
                    ${teamNames.map((teamName, index) => {
                        const team = allTeams[teamName];
                        const players = Array.isArray(team.players) ? team.players : [];
                        return `
                            <div class="team-selection-card" style="border: 2px solid #e0e0e0; border-radius: 10px; padding: 15px; cursor: pointer; transition: all 0.3s ease;">
                                <label class="team-selection-label" style="cursor: pointer; display: block;">
                                    <input type="checkbox" value="${teamName}" class="team-checkbox-input" style="display: none;" ${index < 2 ? 'checked' : ''}>
                                    <div class="team-selection-content" style="text-align: center;">
                                        <div class="team-players-preview" style="display: flex; justify-content: center; gap: 5px; margin-bottom: 10px;">
                                            ${players.slice(0, 3).map(player => `
                                                <img src="${player.photo || 'images/default-player.png'}" 
                                                     alt="${player.name}"
                                                     title="${player.name}"
                                                     onerror="this.src='images/default-player.png'"
                                                     style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid white;">
                                            `).join('')}
                                            ${players.length > 3 ? `<span style="background: #1e3c72; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">+${players.length - 3}</span>` : ''}
                                        </div>
                                        <div class="team-names" style="font-size: 0.9rem; color: #666;">
                                            ${teamName}
                                        </div>
                                    </div>
                                </label>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="match-description" style="margin: 20px 0;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold;">Название/описание матча:</label>
                    <input type="text" id="match-description" placeholder="Например: Турнир по волейболу" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;">
                </div>
                
                <div class="match-actions">
                    <button onclick="generateMatchTable()" class="btn-primary" style="padding: 12px 30px; margin-right: 10px;">Создать таблицу матчей</button>
                    <button onclick="showAdminDashboard()" class="btn-secondary">Отмена</button>
                </div>
            </div>
            
            <div id="match-table-container" style="margin-top: 30px;"></div>
        `;
        
        // Добавляем обработчики кликов
        document.querySelectorAll('.team-selection-card').forEach(card => {
            card.addEventListener('click', function() {
                const checkbox = this.querySelector('.team-checkbox-input');
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) {
                    this.style.borderColor = '#1e3c72';
                    this.style.backgroundColor = '#f0f4ff';
                } else {
                    this.style.borderColor = '#e0e0e0';
                    this.style.backgroundColor = 'transparent';
                }
            });
        });
    } catch (error) {
        alert(`Ошибка загрузки данных: ${error.message}`);
    }
};

// Генерация таблицы матча
window.generateMatchTable = async () => {
    const selectedTeams = Array.from(document.querySelectorAll('.team-checkbox-input:checked'))
        .map(cb => cb.value);
    
    const matchDescription = document.getElementById('match-description').value.trim() || 
                           `Матч от ${new Date().toLocaleDateString()}`;
    
    if (selectedTeams.length < 2) {
        alert('Выберите хотя бы две команды');
        return;
    }
    
    const container = document.getElementById('match-table-container');
    container.innerHTML = '';
    
    // Создаем матч
    const match = {
        description: matchDescription,
        teams: selectedTeams,
        date: new Date().toLocaleString(),
        timestamp: Date.now(),
        status: 'active',
        scores: {}
    };
    
    try {
        const matchId = await DataManager.saveMatch(match);
        match.id = matchId;
        
        // Добавляем в локальный список
        allMatches.push(match);
        
        // Генерируем таблицу
        await generateMatchTableHTML(selectedTeams, matchId, matchDescription);
    } catch (error) {
        alert(`Ошибка создания матча: ${error.message}`);
    }
};

// Генерация HTML таблицы матча
async function generateMatchTableHTML(teams, matchId, description, containerId = 'match-table-container') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Контейнер не найден:', containerId);
        return;
    }
    
    allTeams = await DataManager.getTeams();
    
    // Функция для получения игроков команды
    const getTeamPlayers = (teamName) => {
        const team = allTeams[teamName];
        if (!team) return [];
        return Array.isArray(team.players) ? team.players : [];
    };
    
    let html = `
        <div class="match-table-wrapper" style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); margin-top: 20px;">
            <h4 style="color: #1e3c72; margin-bottom: 10px;">${description}</h4>
            <p class="match-date" style="color: #666; margin-bottom: 20px;">Дата: ${new Date().toLocaleDateString()}</p>
            
            <div class="table-responsive">
                <table class="match-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th class="team-header" style="padding: 15px; text-align: left; border-bottom: 2px solid #eee; color: #1e3c72;">Команда / Игроки</th>
    `;
    
    // Заголовки с командами и фото игроков
    teams.forEach(teamName => {
        const teamPlayers = getTeamPlayers(teamName);
        html += `<th class="team-column-header" style="padding: 15px; text-align: center; border-bottom: 2px solid #eee;">
                    <div class="team-header-content">
                        <div class="team-photos" style="display: flex; justify-content: center; gap: 5px; margin-bottom: 10px;">
                            ${teamPlayers.map(player => `
                                <img src="${player.photo || 'images/default-player.png'}" 
                                     alt="${player.name}"
                                     title="${player.name}"
                                     onerror="this.src='images/default-player.png'"
                                     style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 2px solid white;">
                            `).join('')}
                        </div>
                        <div class="team-names-small" style="font-size: 0.8rem; color: #666;">
                            ${teamName}
                        </div>
                    </div>
                 </th>`;
    });
    
    html += `</tr></thead><tbody>`;
    
    // Строки с командами
    teams.forEach((teamName, rowIndex) => {
        const teamPlayers = getTeamPlayers(teamName);
        html += `<tr>
                    <td class="team-row-header" style="padding: 15px; border-bottom: 1px solid #eee;">
                        <div class="team-row-content" style="display: flex; align-items: center; gap: 10px;">
                            <div class="team-photos" style="display: flex; gap: 5px;">
                                ${teamPlayers.map(player => `
                                    <img src="${player.photo || 'images/default-player.png'}" 
                                         alt="${player.name}"
                                         title="${player.name}"
                                         onerror="this.src='images/default-player.png'"
                                         style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 2px solid white;">
                                `).join('')}
                            </div>
                            <div class="team-names" style="font-size: 0.9rem;">
                                ${teamName}
                            </div>
                        </div>
                    </td>`;
        
        teams.forEach((opponent, colIndex) => {
            if (rowIndex === colIndex) {
                html += `<td style="padding: 15px; text-align: center; border-bottom: 1px solid #eee; background: #f8f9fa; color: #999;">-</td>`;
            } else {
                const cellId = `${matchId}_${teamName}_${opponent}`;
                html += `<td style="padding: 15px; text-align: center; border-bottom: 1px solid #eee;">
                            <input type="text" 
                                   id="${cellId}" 
                                   placeholder="0:0" 
                                   class="score-input"
                                   style="width: 80px; padding: 8px; text-align: center; border: 2px solid #e0e0e0; border-radius: 5px;"
                                   onchange="saveScore('${matchId}', '${teamName}', '${opponent}', this.value)">
                         </td>`;
            }
        });
        
        html += `</tr>`;
    });
    
    html += `</tbody></table></div>`;
    
    html += `
        <div class="match-actions" style="margin-top: 30px; display: flex; gap: 10px;">
            <button onclick="saveMatchScores('${matchId}')" class="btn-primary">Сохранить все результаты</button>
            <button onclick="finishMatch('${matchId}')" class="btn-success">Завершить матч</button>
            <button onclick="showEditMatches()" class="btn-secondary">Назад к списку</button>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Загружаем сохраненные счета
    loadSavedScores(matchId);
}

// Сохранение счета
window.saveScore = async (matchId, teamA, teamB, score) => {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    // Проверяем формат счета
    if (score && !/^\d+:\d+$/.test(score)) {
        alert('Введите счет в формате "число:число", например "25:20"');
        return;
    }
    
    if (!match.scores) match.scores = {};
    if (!match.scores[teamA]) match.scores[teamA] = {};
    
    match.scores[teamA][teamB] = score;
    
    try {
        await DataManager.saveMatch(match);
        console.log('Счет сохранен');
    } catch (error) {
        console.error('Ошибка сохранения счета:', error);
    }
};

// Сохранение всех счетов матча
window.saveMatchScores = async (matchId) => {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    const teams = match.teams;
    teams.forEach(teamA => {
        teams.forEach(teamB => {
            if (teamA !== teamB) {
                const cellId = `${matchId}_${teamA}_${teamB}`;
                const input = document.getElementById(cellId);
                if (input && input.value) {
                    if (!match.scores) match.scores = {};
                    if (!match.scores[teamA]) match.scores[teamA] = {};
                    match.scores[teamA][teamB] = input.value;
                }
            }
        });
    });
    
    try {
        await DataManager.saveMatch(match);
        alert('Результаты сохранены!');
    } catch (error) {
        alert(`Ошибка сохранения: ${error.message}`);
    }
};

// Завершение матча
window.finishMatch = async (matchId) => {
    if (!confirm('Завершить матч? После завершения редактирование будет невозможно.')) return;
    
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;
    
    match.status = 'completed';
    match.completedAt = new Date().toLocaleString();
    
    try {
        await DataManager.saveMatch(match);
        alert('Матч завершен!');
        showEditMatches();
    } catch (error) {
        alert(`Ошибка завершения матча: ${error.message}`);
    }
};

// Редактирование матчей
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
                                <p style="margin: 5px 0;"><strong>Команды:</strong> ${match.teams.join(', ')}</p>
                                <p style="margin: 5px 0;"><strong>Статус:</strong> ${match.status === 'completed' ? 'Завершен' : 'Активный'}</p>
                            </div>
                            <div class="match-edit-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <button onclick="editMatch('${match.id}')" class="admin-btn">Редактировать</button>
                                <button onclick="deleteMatch('${match.id}')" class="btn-delete">Удалить</button>
                                ${match.status === 'completed' ? 
                                    `<button onclick="reopenMatch('${match.id}')" class="btn-warning">Возобновить</button>` : 
                                    `<button onclick="finishMatchFromEdit('${match.id}')" class="btn-success">Завершить</button>`
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

// Редактировать конкретный матч
window.editMatch = async (matchId) => {
    const match = allMatches.find(m => m.id === matchId);
    
    if (!match) {
        alert('Матч не найден');
        return;
    }
    
    const area = document.getElementById('admin-area');
    area.innerHTML = `
        <h3 style="color: #1e3c72;">Редактирование матча</h3>
        <p><strong>${match.description || 'Матч'}</strong> (${match.date || new Date(match.timestamp).toLocaleDateString()})</p>
        
        <div id="match-edit-container" style="margin-top: 20px;"></div>
        
        <div style="margin-top: 20px;">
            <button onclick="showEditMatches()" class="btn-secondary">Вернуться к списку матчей</button>
        </div>
    `;
    
    // Генерируем таблицу в правильном контейнере
    await generateMatchTableHTML(match.teams, match.id, match.description, 'match-edit-container');
};

// Удалить матч
window.deleteMatch = async (matchId) => {
    if (!confirm('Удалить этот матч?')) return;
    
    try {
        await DataManager.deleteMatch(matchId);
        alert('Матч удален');
        
        // Обновляем список матчей
        allMatches = allMatches.filter(m => m.id !== matchId);
        showEditMatches();
        
    } catch (error) {
        alert(`Ошибка удаления: ${error.message}`);
    }
};

// Возобновить матч
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

// Завершить матч из редактора
window.finishMatchFromEdit = async (matchId) => {
    if (!confirm('Завершить матч?')) return;
    
    const match = allMatches.find(m => m.id === matchId);
    
    if (match) {
        match.status = 'completed';
        match.completedAt = new Date().toLocaleString();
        
        try {
            await DataManager.saveMatch(match);
            alert('Матч завершен');
            showEditMatches();
        } catch (error) {
            alert(`Ошибка: ${error.message}`);
        }
    }
};

// Вспомогательная функция
function loadSavedScores(matchId) {
    const match = allMatches.find(m => m.id === matchId);
    if (!match || !match.scores) return;
    
    for (const teamA in match.scores) {
        for (const teamB in match.scores[teamA]) {
            const cellId = `${matchId}_${teamA}_${teamB}`;
            const input = document.getElementById(cellId);
            if (input) {
                input.value = match.scores[teamA][teamB];
            }
        }
    }
}
document.addEventListener('DOMContentLoaded', initApp);
// =========== АДАПТИВНЫЙ ХЕДЕР С АНИМАЦИЕЙ ПРИ СКРОЛЛЕ ===========

let lastScrollTop = 0;
const header = document.querySelector('.header');
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.header nav');

// Функция для обработки скролла
function handleScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > 100) {
        header.classList.add('compact');
        
        if (scrollTop > lastScrollTop && scrollTop > 200) {
            // Скролл вниз - скрываем хедер
            header.classList.add('hidden');
        } else {
            // Скролл вверх - показываем хедер
            header.classList.remove('hidden');
        }
    } else {
        // Вверху страницы - обычный вид
        header.classList.remove('compact', 'hidden');
    }
    
    lastScrollTop = scrollTop;
}

// Функция для переключения мобильного меню
function toggleMobileMenu() {
    if (menuToggle && nav) {
        menuToggle.classList.toggle('active');
        nav.classList.toggle('active');
        document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
    }
}

// Закрытие мобильного меню при клике на ссылку
function closeMobileMenu() {
    if (menuToggle && nav) {
        menuToggle.classList.remove('active');
        nav.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Инициализация адаптивного хедера
function initResponsiveHeader() {
    // Обработчик скролла
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Инициализируем начальное состояние
    handleScroll();
    
    // Обработчик для гамбургер-меню
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMobileMenu);
    }
    
    // Закрытие меню при клике на ссылку
    document.querySelectorAll('.header nav a').forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });
    
    // Закрытие меню при клике вне его
    document.addEventListener('click', function(event) {
        if (nav && nav.classList.contains('active') && 
            !nav.contains(event.target) && 
            !menuToggle.contains(event.target)) {
            closeMobileMenu();
        }
    });
    
    // Закрытие меню при изменении размера окна
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }
    });
}

// Обновите функцию initApp, чтобы вызвать инициализацию хедера
// В существующей функции initApp добавьте вызов:
// initResponsiveHeader();

// Или замените вашу текущую функцию initApp на:
async function initApp() {
    console.log('Инициализация приложения...');
    
    // Проверяем Firebase
    if (!DataManager.isInitialized()) {
        console.error('Ошибка: Firebase не инициализирован');
        return;
    }
    
    try {
        // Настраиваем слушатель аутентификации
        setupAuthListener();
        
        // Инициализируем данные по умолчанию
        await DataManager.initDefaultData();
        
        // Загружаем данные
        await loadAllData();
        
        // Инициализируем навигацию
        initNavigation();
        
        // Инициализируем адаптивный хедер
        initResponsiveHeader();
        
        // Показываем домашнюю страницу
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

// Обновите функцию showSection для закрытия меню
window.showSection = function (name) {
    console.log('Переход на секцию:', name);
    
    try {
        // Закрываем мобильное меню если открыто
        closeMobileMenu();
        
        // Скрываем все секции
        document.querySelectorAll('section').forEach(s => {
            if (s.id.startsWith('section-')) {
                s.style.display = 'none';
            }
        });
        
        // Показываем нужную секцию
        const section = document.getElementById('section-' + name);
        if (section) {
            section.style.display = 'block';
            // Обновляем URL
            window.location.hash = name;
            // Прокручиваем вверх
            window.scrollTo(0, 0);
        } else {
            console.error('Секция не найдена:', 'section-' + name);
        }

        // Обработка специальных случаев
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