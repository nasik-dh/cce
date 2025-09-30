// 🌐 Global Variables
let currentUser = null;
let currentPage = 'tasks';
let chartInstances = {};
let adminChartInstances = {};
let selectedClassForModal = null;
let selectedSubjectForModal = null;

// Cache for better performance
let dataCache = {
    users: null,
    tasks: null,
    courses: null,
    events: null,
    lastUpdated: null
};

// =============================
// 📊 Google Sheets Integration
// =============================
class GoogleSheetsAPI {
    constructor() {
        this.apiUrl = "https://script.google.com/macros/s/AKfycbw0jNeTVwrG8wVloSCtsqPf76yAy4_LP4JrZa9OGoIOivBQ2B0OaEBr5XHyhCUjvh_cXg/exec";
        this.cache = new Map();
        this.cacheTimeout = 2 * 60 * 1000; // 2 minutes cache
    }

    async getSheet(sheetName, useCache = true) {
        const cacheKey = sheetName;
        
        // Check cache first
        if (useCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log(`Using cached data for ${sheetName}`);
                return cached.data;
            }
        }

        try {
            const url = `${this.apiUrl}?sheet=${encodeURIComponent(sheetName)}&cachebust=${Date.now()}`;
            console.log(`Fetching sheet: ${sheetName}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            const data = JSON.parse(text);
            
            // Cache the result
            if (useCache) {
                this.cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
            }
            
            return data;
        } catch (error) {
            console.error(`Error fetching ${sheetName}:`, error);
            return { error: error.message };
        }
    }

    clearCache() {
        this.cache.clear();
    }

    async addRow(sheetName, row) {
        try {            
            const response = await fetch(this.apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    sheet: sheetName,
                    data: JSON.stringify(row)
                })
            });
            
            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (parseError) {
                result = { message: text };
            }
            
            // Clear relevant cache entries after adding data
            this.cache.delete(sheetName);
            
            return result;
        } catch (error) {
            console.error('Error adding row:', error);
            return { error: error.message };
        }
    }
}

const api = new GoogleSheetsAPI();

// =============================
// 🔑 Authentication
// =============================
async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        showError('Please enter both username and password');
        return;
    }

    // Show loading state
    const loginBtn = document.querySelector('button[type="submit"]');
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Signing In...';
    loginBtn.disabled = true;

    try {
        console.log('Attempting login with:', username);
        const users = await api.getSheet("user_credentials", false);
        
        if (!users || users.error) {
            showError(users?.error || 'Failed to fetch user data');
            return;
        }
        
        if (!Array.isArray(users) || users.length === 0) {
            showError('No users found in database');
            return;
        }
        
        // Find user with exact match
        const user = users.find(u => 
            u.username === username && u.password === password
        );

        if (user) {
            currentUser = {
                username: user.username,
                name: user.full_name || user.username,
                role: user.role || 'student',
                class: user.class || null,
                subjects: user.subjects || null,
                userId: user.username
            };

            // Hide login, show dashboard
            document.getElementById('loginPage').classList.add('hidden');
            document.getElementById('dashboardContainer').classList.remove('hidden');
            document.getElementById('welcomeUser').textContent = `Welcome, ${currentUser.name}`;

            // Show appropriate navigation based on role
            if (currentUser.role === 'admin') {
                document.getElementById('studentNav').classList.add('hidden');
                document.getElementById('adminNav').classList.remove('hidden');
                showPage('adminTasks');
                await loadAdminData();
            } else {
                document.getElementById('studentNav').classList.remove('hidden');
                document.getElementById('adminNav').classList.add('hidden');
                showPage('tasks');
                await loadTasks();
            }
            
            hideError();
        } else {
            showError('Invalid username or password');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Network error: ' + error.message);
    } finally {
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

function showError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideError() {
    document.getElementById('loginError').classList.add('hidden');
}

function logout() {
    currentUser = null;
    selectedClassForModal = null;
    selectedSubjectForModal = null;
    api.clearCache();
    
    // Clean up chart instances
    Object.values(chartInstances).forEach(chart => {
        if (chart) chart.destroy();
    });
    chartInstances = {};
    
    // Clean up admin chart instances
    Object.values(adminChartInstances).forEach(chart => {
        if (chart) chart.destroy();
    });
    adminChartInstances = {};
    
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('dashboardContainer').classList.add('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    hideError();
    
    showLogin();
}

// Signup functions
function showSignup() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('signupSection').classList.remove('hidden');
    hideError();
}

function showLogin() {
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    hideSignupError();
    hideSignupSuccess();
}

function showSignupError(message) {
    const errorDiv = document.getElementById('signupError');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideSignupError() {
    document.getElementById('signupError').classList.add('hidden');
}

function showSignupSuccess(message) {
    const successDiv = document.getElementById('signupSuccess');
    successDiv.textContent = message;
    successDiv.classList.remove('hidden');
}

function hideSignupSuccess() {
    document.getElementById('signupSuccess').classList.add('hidden');
}

async function submitSignup() {
    const name = document.getElementById('signupName').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    const gmail = document.getElementById('signupGmail').value.trim();
    const state = document.getElementById('signupState').value.trim();
    const district = document.getElementById('signupDistrict').value.trim();
    const place = document.getElementById('signupPlace').value.trim();
    const po = document.getElementById('signupPO').value.trim();
    const pinCode = document.getElementById('signupPinCode').value.trim();

    if (!name || !phone || !state || !district || !place || !po || !pinCode) {
        showSignupError('Please fill in all required fields');
        return;
    }

    // Validate pin code
    if (!/^\d{6}$/.test(pinCode)) {
        showSignupError('Please enter a valid 6-digit pin code');
        return;
    }

    // Show loading state
    const signupBtn = document.querySelector('#signupForm button[type="submit"]');
    const originalText = signupBtn.innerHTML;
    signupBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Creating Account...';
    signupBtn.disabled = true;

    try {
        const rowData = [
            name,
            phone,
            gmail || '',
            state,
            district,
            place,
            po,
            pinCode,
            new Date().toISOString().split('T')[0] // Registration date
        ];

        const result = await api.addRow('registration', rowData);

        if (result && (result.success || result.includes?.('Success'))) {
            showSignupSuccess('Account created successfully! Please contact admin for login credentials.');
            document.getElementById('signupForm').reset();
            hideSignupError();
        } else {
            throw new Error(result?.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showSignupError('Registration failed: ' + error.message);
    } finally {
        signupBtn.innerHTML = originalText;
        signupBtn.disabled = false;
    }
}

// =============================
// 📍 Navigation
// =============================
async function showPage(page) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('border-green-500', 'text-green-600', 'border-blue-500', 'text-blue-600');
        btn.classList.add('border-transparent');
    });

    document.getElementById(page + 'Page').classList.remove('hidden');
    
    // Find the clicked button and highlight it
    const clickedBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => {
        const btnText = btn.textContent.toLowerCase();
        return btnText.includes(page.replace('admin', '').toLowerCase()) || 
               (page === 'adminStatus' && btnText.includes('all status'));
    });
    
    if (clickedBtn) {
        if (currentUser && currentUser.role === 'admin') {
            clickedBtn.classList.add('border-blue-500', 'text-blue-600');
        } else {
            clickedBtn.classList.add('border-green-500', 'text-green-600');
        }
    }

    currentPage = page;

    // Load page-specific data
    if (page === 'status') {
        loadStatusCharts();
    } else if (page === 'adminTasks') {
        loadAdminTasks();
    } else if (page === 'adminStatus') {
        await loadAllUsersStatus();
    }
}

// =============================
// ✅ Tasks (Class-Based System)
// =============================
async function loadTasks() {
    const tasksContainer = document.getElementById('subjectCards');
    
    // Show loading state
    tasksContainer.innerHTML = '<div class="text-center py-6 md:py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading your tasks...</div>';

    try {
        if (currentUser.role === 'student') {
            if (!currentUser.class) {
                tasksContainer.innerHTML = '<p class="text-gray-500 text-center py-6 md:py-8 text-sm md:text-base">No class assigned. Please contact administrator.</p>';
                document.getElementById('userClass').textContent = 'Class: Not Assigned';
                return;
            }
            
            // Update class info display
            document.getElementById('userClass').textContent = `Class ${currentUser.class}`;
            
            const tasksSheetName = `${currentUser.class}_tasks_master`;
            const [tasks, progress] = await Promise.all([
                api.getSheet(tasksSheetName),
                api.getSheet(`${currentUser.username}_progress`)
            ]);
            
            tasksContainer.innerHTML = '';

            if (!tasks || tasks.error || tasks.length === 0) {
                tasksContainer.innerHTML = '<p class="text-gray-500 text-center py-6 md:py-8 text-sm md:text-base">No tasks found for your class.</p>';
                return;
            }

            // Group tasks by subject
            const tasksBySubject = {};
            tasks.forEach(task => {
                const subject = task.subject || 'General';
                if (!tasksBySubject[subject]) {
                    tasksBySubject[subject] = [];
                }
                tasksBySubject[subject].push(task);
            });

            const fragment = document.createDocumentFragment();

            // Create subject cards
            Object.entries(tasksBySubject).forEach(([subject, subjectTasks]) => {
                const completedCount = subjectTasks.filter(task => {
                    const userTask = Array.isArray(progress) ? progress.find(p => 
                        String(p.item_id) === String(task.task_id) && 
                        p.item_type === "task" && 
                        p.status === "complete"
                    ) : null;
                    return !!userTask;
                }).length;

                const subjectCard = document.createElement('div');
                subjectCard.className = 'subject-card';
                subjectCard.setAttribute('data-subject', subject);
                
                subjectCard.innerHTML = `
                    <div class="subject-header" onclick="toggleSubjectTasks('${subject}')">
                        <div class="flex items-center min-w-0 flex-1">
                            <div class="subject-icon">
                                <i class="${getSubjectIcon(subject)}"></i>
                            </div>
                            <div class="subject-info min-w-0 flex-1">
                                <h3>${subject}</h3>
                                <p>${subjectTasks.length} tasks • ${completedCount} completed</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2 flex-shrink-0">
                            <span class="task-count-badge">${subjectTasks.length} tasks</span>
                            <i class="fas fa-chevron-down expand-arrow" id="arrow-${subject}"></i>
                        </div>
                    </div>
                    
                    <div class="tasks-container" id="tasks-${subject}">
                        ${subjectTasks.map(task => {
                            const userTask = Array.isArray(progress) ? progress.find(p => 
                                String(p.item_id) === String(task.task_id) && 
                                p.item_type === "task" && 
                                p.status === "complete"
                            ) : null;
                            const completed = !!userTask;
                            const grade = userTask ? userTask.grade : null;
                            
                            const dueDate = new Date(task.due_date);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            dueDate.setHours(0, 0, 0, 0);
                            
                            let statusClass = 'status-pending';
                            let statusText = 'Pending';
                            
                            if (completed) {
                                statusClass = 'status-completed';
                                statusText = 'Completed';
                            } else if (dueDate < today) {
                                statusClass = 'status-overdue';
                                statusText = 'Overdue';
                            } else if (dueDate.getTime() === today.getTime()) {
                                statusClass = 'status-pending';
                                statusText = 'Due Today';
                            }
                            
                            const dueDateFormatted = new Date(task.due_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            });
                            
                            // Update the task item display in student view
return `
    <div class="task-item">
        <div class="task-header">
            <span class="task-id-badge">${task.task_id}</span>
            <span class="task-status ${statusClass}">
                ${statusText}
            </span>
        </div>
        <h4 class="task-title">${task.title}</h4>
        <p class="task-description">${task.description}</p>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
            <p class="task-due-date">
                <i class="fas fa-calendar-alt"></i>
                Due: ${dueDateFormatted}
            </p>
            ${completed && grade ? `<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Score: ${grade}</span>` : ''}
        </div>
    </div>
`;
                        }).join('')}
                    </div>
                `;
                fragment.appendChild(subjectCard);
            });

            tasksContainer.appendChild(fragment);
        }
        
    } catch (error) {
        console.error('Error loading tasks:', error);
        tasksContainer.innerHTML = '<p class="text-red-500 text-center py-6 md:py-8 text-sm md:text-base">Error loading tasks. Please try again.</p>';
    }
}

// Function to toggle subject task visibility
function toggleSubjectTasks(subject) {
    const tasksContainer = document.getElementById(`tasks-${subject}`);
    const arrow = document.getElementById(`arrow-${subject}`);
    
    if (tasksContainer && arrow) {
        if (!tasksContainer.classList.contains('expanded')) {
            // Close all other expanded subjects first
            document.querySelectorAll('.tasks-container.expanded').forEach(container => {
                if (container !== tasksContainer) {
                    container.classList.remove('expanded');
                }
            });
            document.querySelectorAll('.expand-arrow.expanded').forEach(arrowIcon => {
                if (arrowIcon !== arrow) {
                    arrowIcon.classList.remove('expanded');
                }
            });
            
            // Open this subject
            tasksContainer.classList.add('expanded');
            arrow.classList.add('expanded');
        } else {
            // Close this subject
            tasksContainer.classList.remove('expanded');
            arrow.classList.remove('expanded');
        }
    }
}

// Helper functions for subject icons
function getSubjectIcon(subject) {
    const subjectLower = subject.toLowerCase();
    if (subjectLower.includes('math')) return 'fas fa-calculator';
    if (subjectLower.includes('english') || subjectLower.includes('language')) return 'fas fa-language';
    if (subjectLower.includes('science')) return 'fas fa-flask';
    if (subjectLower.includes('arabic')) return 'fas fa-book-open';
    if (subjectLower.includes('islamic') || subjectLower.includes('quran')) return 'fas fa-mosque';
    if (subjectLower.includes('computer')) return 'fas fa-laptop-code';
    if (subjectLower.includes('history')) return 'fas fa-scroll';
    if (subjectLower.includes('geography')) return 'fas fa-globe';
    if (subjectLower.includes('urdu')) return 'fas fa-font';
    if (subjectLower.includes('malayalam')) return 'fas fa-language';
    if (subjectLower.includes('social')) return 'fas fa-users';
    return 'fas fa-book';
}

// =============================
// 📊 Status Charts & Progress
// =============================
async function loadStatusCharts() {
    try {
        const progressSheetName = `${currentUser.username}_progress`;
        const progress = await api.getSheet(progressSheetName);
        
        await Promise.all([
            loadTaskChart(progress),
            loadSubjectPointsSummary(progress)
        ]);
    } catch (error) {
        console.error('Error loading status charts:', error);
    }
}

async function loadSubjectPointsSummary(progress) {
    try {
        if (!currentUser.class) return;
        
        const tasksSheetName = `${currentUser.class}_tasks_master`;
        const tasks = await api.getSheet(tasksSheetName);
        
        if (!tasks || tasks.error || tasks.length === 0) return;
        
        // Group tasks by subject and calculate points
        const subjectStats = {};
        // Remove maxPointsPerTask constant
        
        tasks.forEach(task => {
            const subject = task.subject || 'General';
            if (!subjectStats[subject]) {
                subjectStats[subject] = {
                    totalTasks: 0,
                    completedTasks: 0,
                    totalPoints: 0,
                    earnedPoints: 0
                };
            }
            
            subjectStats[subject].totalTasks++;
            
            // Check if task is completed
            const userTask = Array.isArray(progress) ? progress.find(p => 
                String(p.item_id) === String(task.task_id) && 
                p.item_type === "task" && 
                p.status === "complete"
            ) : null;
            
            if (userTask) {
                subjectStats[subject].completedTasks++;
                subjectStats[subject].earnedPoints += parseInt(userTask.grade || 0); // Use 0 as default
            }
        });
        
        // Calculate total possible points for each subject
        Object.keys(subjectStats).forEach(subject => {
            // Since there's no fixed limit per task, totalPoints is the sum of all completed task points
            // For display purposes, we'll show earned points vs completed tasks
            subjectStats[subject].totalPoints = subjectStats[subject].earnedPoints;
        });
        
        // Generate subject points grid
        const subjectPointsGrid = document.getElementById('subjectPointsGrid');
        if (!subjectPointsGrid) return;
        
        const subjectCardsHtml = Object.entries(subjectStats).map(([subject, stats]) => {
            return `
                <div class="subject-points-card">
                    <div class="flex items-center justify-center mb-3">
                        <div class="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white mr-2">
                            <i class="${getSubjectIcon(subject)} text-xs md:text-sm"></i>
                        </div>
                        <h4>${subject}</h4>
                    </div>
                    <div class="points-display">${stats.earnedPoints}</div>
                    <div class="points-label">total points</div>
                    <div class="text-xs text-gray-500 mt-2">
                        ${stats.completedTasks}/${stats.totalTasks} tasks completed
                    </div>
                </div>
            `;
        }).join('');
        
        subjectPointsGrid.innerHTML = subjectCardsHtml;
        
    } catch (error) {
        console.error('Error loading subject points summary:', error);
    }
}

async function loadTaskChart(progress) {
    if (!currentUser.class) return;
    
    try {
        const tasksSheetName = `${currentUser.class}_tasks_master`;
        const tasks = await api.getSheet(tasksSheetName);
        const completedTasks = Array.isArray(progress) ? 
            progress.filter(p => p.item_type === "task" && p.status === "complete").length : 0;
        const totalTasks = Array.isArray(tasks) ? tasks.length : 0;
        const pendingTasks = Math.max(0, totalTasks - completedTasks);

        const ctx = document.getElementById('taskChart');
        if (!ctx) return;
        
        if (chartInstances.taskChart) {
            chartInstances.taskChart.destroy();
        }
        
        chartInstances.taskChart = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Pending'],
                datasets: [{
                    data: [completedTasks, pendingTasks],
                    backgroundColor: ['#059669', '#e5e7eb'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading task chart:', error);
    }
}

// =============================
// 👨‍💼 Admin Functions
// =============================
async function loadAdminData() {
    try {
        if (currentUser.role === 'admin') {
            // Enhanced parsing for admin subjects
            let adminClasses = [];
            let adminSubjects = {};
            
            console.log('Admin subjects raw:', currentUser.subjects);
            
            if (currentUser.subjects) {
                const subjectsStr = currentUser.subjects.toString().trim();
                
                // Enhanced format: 1,2|(1-english,mathematics,science)(2-urdu,arabic)
                if (subjectsStr.includes('|')) {
                    const parts = subjectsStr.split('|');
                    const classesStr = parts[0];
                    const subjectAssignments = parts[1];
                    
                    // Parse classes
                    if (classesStr) {
                        adminClasses = classesStr.split(',').map(c => c.trim()).filter(c => c && /^\d+$/.test(c));
                    }
                    
                    // Parse subject assignments - format: (class-subject1,subject2,subject3)
                    if (subjectAssignments) {
                        const subjectMatches = subjectAssignments.match(/\(\d+-[^)]+\)/g);
                        if (subjectMatches) {
                            subjectMatches.forEach(match => {
                                const innerContent = match.slice(1, -1); // Remove parentheses
                                const dashIndex = innerContent.indexOf('-');
                                if (dashIndex > 0) {
                                    const classNum = innerContent.substring(0, dashIndex);
                                    const subjectsString = innerContent.substring(dashIndex + 1);
                                    
                                    let subjects;
                                    if (subjectsString.toLowerCase() === 'all') {
                                        subjects = ['english', 'mathematics', 'urdu', 'arabic', 'malayalam', 'social science', 'science'];
                                    } else {
                                        subjects = subjectsString.split(',').map(s => s.trim()).filter(s => s);
                                    }
                                    
                                    if (subjects.length > 0) {
                                        adminSubjects[classNum] = subjects;
                                    }
                                }
                            });
                        }
                    }
                } else {
                    // Fallback: if no pipe, treat as old format or assign default
                    console.log('No pipe found, using fallback parsing');
                    const classMatch = subjectsStr.match(/[\d,\s]+/);
                    if (classMatch) {
                        adminClasses = classMatch[0].split(',').map(c => c.trim()).filter(c => c && /^\d+$/.test(c));
                        // Assign all subjects to all classes as fallback
                        const defaultSubjects = ['english', 'mathematics', 'urdu', 'arabic', 'malayalam', 'social science', 'science'];
                        adminClasses.forEach(classNum => {
                            adminSubjects[classNum] = defaultSubjects;
                        });
                    }
                }
            }
            
            // Ensure all assigned classes have subject assignments
            adminClasses.forEach(classNum => {
                if (!adminSubjects[classNum]) {
                    adminSubjects[classNum] = ['english', 'mathematics', 'urdu', 'arabic', 'malayalam', 'social science', 'science'];
                }
            });
            
            console.log('Parsed admin classes:', adminClasses);
            console.log('Parsed admin subjects:', adminSubjects);
            
            currentUser.adminClasses = adminClasses;
            currentUser.adminSubjects = adminSubjects;
            
            // Update teaching info display
            const teachingInfo = document.getElementById('teachingSubjects');
            if (teachingInfo) {
                if (adminClasses.length > 0) {
                    const classText = `Classes: ${adminClasses.join(', ')}`;
                    const subjectText = Object.entries(adminSubjects).map(([cls, subjs]) => 
                        `Class ${cls}: ${subjs.join(', ')}`
                    ).join(' | ');
                    teachingInfo.textContent = `${classText} | ${subjectText}`;
                } else {
                    teachingInfo.textContent = 'No classes or subjects assigned';
                }
            }
        }
    } catch (error) {
        console.error('Error loading admin data:', error);
        const teachingInfo = document.getElementById('teachingSubjects');
        if (teachingInfo) {
            teachingInfo.textContent = 'Error loading teaching assignments - check console';
        }
    }
}


async function loadAdminTasks() {
    const adminTaskClassSelect = document.getElementById('adminTaskClassSelect');
    const adminTaskSubjectSelect = document.getElementById('adminTaskSubjectSelect');
    
    if (!adminTaskClassSelect || !adminTaskSubjectSelect) return;
    
    // Clear existing options
    adminTaskClassSelect.innerHTML = '<option value="">-- Select Class --</option>';
    adminTaskSubjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
    adminTaskSubjectSelect.disabled = true;
    
    console.log('Loading admin tasks, classes:', currentUser.adminClasses);
    
    // Only show admin's assigned classes
    if (currentUser.adminClasses && currentUser.adminClasses.length > 0) {
        currentUser.adminClasses.forEach(classNum => {
            const option = document.createElement('option');
            option.value = classNum;
            option.textContent = `Class ${classNum}`;
            adminTaskClassSelect.appendChild(option);
        });
    } else {
        // Show message if no classes assigned
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No classes assigned';
        option.disabled = true;
        adminTaskClassSelect.appendChild(option);
        return;
    }
    
    // Remove existing event listeners to avoid duplication
    const newClassSelect = adminTaskClassSelect.cloneNode(true);
    adminTaskClassSelect.parentNode.replaceChild(newClassSelect, adminTaskClassSelect);
    
    const newSubjectSelect = adminTaskSubjectSelect.cloneNode(true);
    adminTaskSubjectSelect.parentNode.replaceChild(newSubjectSelect, adminTaskSubjectSelect);
    
    // Add event listener for class selection
    document.getElementById('adminTaskClassSelect').addEventListener('change', async function() {
        const selectedClass = this.value;
        const subjectSelect = document.getElementById('adminTaskSubjectSelect');
        subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
        
        console.log('Class selected:', selectedClass);
        
        if (selectedClass) {
            subjectSelect.disabled = false;
            
            // Get subjects for this class from admin assignments ONLY
            let availableSubjects = [];
            
            if (currentUser.adminSubjects && currentUser.adminSubjects[selectedClass]) {
                availableSubjects = currentUser.adminSubjects[selectedClass];
            }
            
            console.log('Available subjects for class', selectedClass, ':', availableSubjects);
            
            if (availableSubjects.length > 0) {
                availableSubjects.forEach(subject => {
                    const option = document.createElement('option');
                    option.value = subject;
                    option.textContent = subject.charAt(0).toUpperCase() + subject.slice(1);
                    subjectSelect.appendChild(option);
                });
            } else {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No subjects assigned';
                option.disabled = true;
                subjectSelect.appendChild(option);
            }
        } else {
            subjectSelect.disabled = true;
        }
        
        // Hide class subject view when class changes
        document.getElementById('adminTasksClassSubjectView').classList.add('hidden');
        document.getElementById('adminTasksDefaultView').classList.remove('hidden');
    });
    
    // Add event listener for subject selection
    document.getElementById('adminTaskSubjectSelect').addEventListener('change', async function() {
        const selectedClass = document.getElementById('adminTaskClassSelect').value;
        const selectedSubject = this.value;
        
        console.log('Subject selected:', selectedSubject, 'for class:', selectedClass);
        
        if (selectedClass && selectedSubject) {
            // Verify admin has access to this class-subject combination
            const hasAccess = currentUser.adminSubjects && 
                             currentUser.adminSubjects[selectedClass] && 
                             currentUser.adminSubjects[selectedClass].includes(selectedSubject);
            
            if (hasAccess) {
                selectedClassForModal = selectedClass;
                selectedSubjectForModal = selectedSubject;
                await loadAdminClassSubjectData(selectedClass, selectedSubject);
            } else {
                alert('Access denied: You are not assigned to this class-subject combination.');
                this.value = '';
            }
        } else {
            document.getElementById('adminTasksClassSubjectView').classList.add('hidden');
            document.getElementById('adminTasksDefaultView').classList.remove('hidden');
        }
    });
}


async function loadAdminClassSubjectData(classNum, subject) {
    try {
        // Show class subject view
        document.getElementById('adminTasksDefaultView').classList.add('hidden');
        document.getElementById('adminTasksClassSubjectView').classList.remove('hidden');
        
        // Update selected info
        document.getElementById('selectedClassSubjectInfo').textContent = `Class ${classNum} - ${subject.charAt(0).toUpperCase() + subject.slice(1)}`;
        
        // Load tasks for this class and subject
        const tasksSheetName = `${classNum}_tasks_master`;
        const tasks = await api.getSheet(tasksSheetName);
        
        const adminClassSubjectTasksList = document.getElementById('adminClassSubjectTasksList');
        adminClassSubjectTasksList.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading tasks...</div>';
        
        if (!tasks || tasks.error || tasks.length === 0) {
            adminClassSubjectTasksList.innerHTML = '<p class="text-gray-500 text-center py-6 md:py-8 text-sm md:text-base">No tasks found for this class.</p>';
        } else {
            // Filter tasks by subject
            const subjectTasks = tasks.filter(task => 
                task.subject && task.subject.toLowerCase() === subject.toLowerCase()
            );
            
            if (subjectTasks.length === 0) {
                adminClassSubjectTasksList.innerHTML = `<p class="text-gray-500 text-center py-6 md:py-8 text-sm md:text-base">No tasks found for ${subject} in Class ${classNum}.</p>`;
            } else {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const tasksHtml = subjectTasks.map(task => {
                    const dueDate = new Date(task.due_date);
                    dueDate.setHours(0, 0, 0, 0);
                    const isOverdue = dueDate < today;
                    const isDueToday = dueDate.getTime() === today.getTime();
                    
                    let statusClass = 'status-pending';
                    let statusText = 'Active';
                    
                    if (isOverdue) {
                        statusClass = 'status-overdue';
                        statusText = 'Overdue';
                    } else if (isDueToday) {
                        statusClass = 'status-pending';
                        statusText = 'Due Today';
                    }
                    
                    return `
                        <div class="task-item">
                            <div class="flex items-start justify-between">
                                <div class="flex-1">
                                    <div class="flex items-center justify-between mb-2">
                                        <span class="task-id-badge">${task.task_id}</span>
                                        <span class="task-status ${statusClass}">${statusText}</span>
                                    </div>
                                    <h4 class="task-title">${task.title}</h4>
                                    <p class="task-description">${task.description}</p>
                                    <p class="task-due-date">
                                        <i class="fas fa-calendar-alt"></i>
                                        Due: ${new Date(task.due_date).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                adminClassSubjectTasksList.innerHTML = tasksHtml;
            }
        }
        
        // Load students in this class
        await loadAdminClassStudents(classNum);
        
    } catch (error) {
        console.error('Error loading admin class subject data:', error);
        document.getElementById('adminClassSubjectTasksList').innerHTML = '<p class="text-red-500 text-center py-6 md:py-8 text-sm md:text-base">Error loading tasks. Please try again.</p>';
    }
}

async function loadAdminClassStudents(classNum) {
    try {
        const users = await api.getSheet("user_credentials");
        const adminClassStudentsList = document.getElementById('adminClassStudentsList');
        
        adminClassStudentsList.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading students...</div>';
        
        if (!users || users.error) {
            adminClassStudentsList.innerHTML = '<p class="text-red-500 text-center py-6 md:py-8 text-sm md:text-base">Error loading students.</p>';
            return;
        }
        
        // Filter students by class
        const classStudents = users.filter(user => 
            user.role === 'student' && String(user.class) === String(classNum)
        );
        
        if (classStudents.length === 0) {
            adminClassStudentsList.innerHTML = `<p class="text-gray-500 text-center py-6 md:py-8 text-sm md:text-base">No students found in Class ${classNum}.</p>`;
            return;
        }
        
        const studentsHtml = classStudents.map(student => {
            const initials = student.full_name ? 
                student.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 
                student.username.substring(0, 2).toUpperCase();
            
            return `
                <div class="student-card" onclick="openStudentTaskModal('${student.username}', '${student.full_name || student.username}', '${classNum}')">
                    <div class="student-avatar">${initials}</div>
                    <div class="student-name">${student.full_name || student.username}</div>
                    <div class="student-username">@${student.username}</div>
                    <div class="student-class">Class ${student.class}</div>
                </div>
            `;
        }).join('');
        
        adminClassStudentsList.innerHTML = studentsHtml;
        
    } catch (error) {
        console.error('Error loading admin class students:', error);
        const adminClassStudentsList = document.getElementById('adminClassStudentsList');
        adminClassStudentsList.innerHTML = '<p class="text-red-500 text-center py-6 md:py-8 text-sm md:text-base">Error loading students. Please try again.</p>';
    }
}

async function openStudentTaskModal(username, fullName, classNum) {
    try {
        const modal = document.getElementById('studentTaskModal');
        const title = document.getElementById('studentTaskModalTitle');
        const content = document.getElementById('studentTaskModalContent');
        
        title.textContent = `Tasks for ${fullName} - ${selectedSubjectForModal}`;
        content.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading student tasks...</div>';
        
        modal.classList.remove('hidden');
        
        // Load student's progress and class tasks, but filter by selected subject
        const [progress, tasks] = await Promise.all([
            api.getSheet(`${username}_progress`),
            api.getSheet(`${classNum}_tasks_master`)
        ]);
        
        if (!tasks || tasks.error || tasks.length === 0) {
            content.innerHTML = '<p class="text-gray-500 text-center py-6 md:py-8 text-sm md:text-base">No tasks found for this class.</p>';
            return;
        }
        
        // Filter tasks by the selected subject
        const subjectTasks = selectedSubjectForModal ? 
            tasks.filter(task => task.subject && task.subject.toLowerCase() === selectedSubjectForModal.toLowerCase()) :
            tasks;
        
        if (subjectTasks.length === 0) {
            content.innerHTML = `<p class="text-gray-500 text-center py-6 md:py-8 text-sm md:text-base">No tasks found for ${selectedSubjectForModal} in this class.</p>`;
            return;
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tasksHtml = subjectTasks.map(task => {
            const userTask = Array.isArray(progress) ? progress.find(p => 
                String(p.item_id) === String(task.task_id) && 
                p.item_type === "task" && 
                p.status === "complete"
            ) : null;
            
            const completed = !!userTask;
            const currentGrade = userTask ? parseInt(userTask.grade || 30) : 30;
            
            const dueDate = new Date(task.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const isOverdue = !completed && dueDate < today;
            const isDueToday = dueDate.getTime() === today.getTime();
            
            let taskClass = 'admin-task-item';
            let statusIcon = '';
            let statusText = '';
            
            if (completed) {
                taskClass += ' completed';
                statusIcon = '<i class="fas fa-check-circle text-green-500"></i>';
                statusText = `Completed (${currentGrade}/30)`;
            } else if (isOverdue) {
                statusIcon = '<i class="fas fa-exclamation-triangle text-red-500"></i>';
                statusText = 'Overdue';
            } else if (isDueToday) {
                statusIcon = '<i class="fas fa-clock text-orange-500"></i>';
                statusText = 'Due Today';
            } else {
                statusIcon = '<i class="fas fa-clock text-gray-400"></i>';
                statusText = 'Pending';
            }
            
            // In the tasksHtml generation part, update the grade input section:
return `
    <div class="${taskClass}">
        <div class="flex items-start space-x-3">
            <input type="checkbox" 
                   data-task-id="${task.task_id}"
                   data-username="${username}"
                   ${completed ? 'checked disabled' : ''}
                   class="task-checkbox"
                   onchange="toggleGradeSection('${task.task_id}', this.checked)">
            <div class="flex-1">
                <div class="flex items-center justify-between mb-2">
                    <span class="task-id-badge">${task.task_id}</span>
                    <div class="flex items-center space-x-2">
                        ${statusIcon}
                        <span class="text-xs font-medium">${statusText}</span>
                    </div>
                </div>
                <h4 class="task-title">${task.title}</h4>
                <p class="task-description">${task.description}</p>
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
                    <p class="task-due-date">
                        <i class="fas fa-calendar-alt mr-1"></i>
                        Due: ${new Date(task.due_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        })}
                    </p>
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        ${task.subject}
                    </span>
                </div>
                <div class="grade-section" id="grade-${task.task_id}">
                    <div class="grade-input-group">
                        <span class="grade-label">Points:</span>
                        <input type="number" 
                               class="grade-input" 
                               id="grade-input-${task.task_id}"
                               min="0" 
                               value="${currentGrade}"
                               placeholder="Enter points">
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
        }).join('');
        
        content.innerHTML = tasksHtml;
        
    } catch (error) {
        console.error('Error opening student task modal:', error);
        const content = document.getElementById('studentTaskModalContent');
        content.innerHTML = '<p class="text-red-500 text-center py-6 md:py-8 text-sm md:text-base">Error loading student tasks. Please try again.</p>';
    }
}

function toggleGradeSection(taskId, isChecked) {
    const gradeSection = document.getElementById(`grade-${taskId}`);
    if (gradeSection) {
        if (isChecked) {
            gradeSection.classList.add('show');
        } else {
            gradeSection.classList.remove('show');
        }
    }
}

async function submitSelectedStudentTasks() {
    const submitBtn = event.target;
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Submitting...';
        submitBtn.disabled = true;
        
        const selectedCheckboxes = document.querySelectorAll('#studentTaskModalContent input[type="checkbox"]:checked:not(:disabled)');
        
        if (selectedCheckboxes.length === 0) {
            alert('No tasks selected for submission.');
            return;
        }
        
        const promises = [];
        let updatedCount = 0;
        
        for (let checkbox of selectedCheckboxes) {
            const taskId = checkbox.getAttribute('data-task-id');
            const username = checkbox.getAttribute('data-username');
            const gradeInput = document.getElementById(`grade-input-${taskId}`);
            let grade = 0; // Start from 0
            
            if (gradeInput && gradeInput.value) {
                grade = Math.max(0, parseInt(gradeInput.value) || 0); // Remove the 30-point limit
            }
            
            const rowData = [
                taskId,
                "task",
                "complete",
                new Date().toISOString().split('T')[0],
                grade.toString()
            ];
            
            promises.push(api.addRow(`${username}_progress`, rowData));
            updatedCount++;
        }
        
        await Promise.all(promises);
        alert(`${updatedCount} task(s) marked as completed successfully!`);
        closeStudentTaskModal();
        
        // Refresh the current view
        const selectedClass = document.getElementById('adminTaskClassSelect').value;
        const selectedSubject = document.getElementById('adminTaskSubjectSelect').value;
        if (selectedClass && selectedSubject) {
            await loadAdminClassSubjectData(selectedClass, selectedSubject);
        }
        
    } catch (error) {
        console.error('Error submitting selected student tasks:', error);
        alert('Error submitting tasks. Please try again.');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function closeStudentTaskModal() {
    document.getElementById('studentTaskModal').classList.add('hidden');
}

// Clear admin task filters
function clearAdminTaskFilters() {
    document.getElementById('adminTaskClassSelect').value = '';
    document.getElementById('adminTaskSubjectSelect').value = '';
    document.getElementById('adminTaskSubjectSelect').disabled = true;
    document.getElementById('adminTaskSubjectSelect').innerHTML = '<option value="">-- Select Subject --</option>';
    
    selectedClassForModal = null;
    selectedSubjectForModal = null;
    
    document.getElementById('adminTasksClassSubjectView').classList.add('hidden');
    document.getElementById('adminTasksDefaultView').classList.remove('hidden');
}

// =============================
// 👨‍💼 Admin Status Functions (Simplified)
// =============================
async function loadAllUsersStatus() {
    try {
        const userSelect = document.getElementById('userSelect');
        const noUserSelected = document.getElementById('noUserSelected');
        const selectedUserStatus = document.getElementById('selectedUserStatus');
        
        // Show loading in user select
        userSelect.innerHTML = '<option value="">-- Loading Users... --</option>';
        
        // Load all users
        const users = await api.getSheet("user_credentials");
        
        // Clear and populate user select
        userSelect.innerHTML = '<option value="">-- Select User --</option>';
        
        if (users && Array.isArray(users)) {
            const students = users.filter(user => user.role === 'student');
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.username;
                option.textContent = `${student.full_name || student.username} (Class ${student.class || 'N/A'})`;
                userSelect.appendChild(option);
            });
        }
        
        // Remove existing event listeners to avoid duplication
        const newUserSelect = userSelect.cloneNode(true);
        userSelect.parentNode.replaceChild(newUserSelect, userSelect);
        
        // Add event listener for user selection
        document.getElementById('userSelect').addEventListener('change', async function() {
            const selectedUsername = this.value;
            
            if (selectedUsername) {
                noUserSelected.classList.add('hidden');
                selectedUserStatus.classList.remove('hidden');
                await loadSelectedUserStatus(selectedUsername);
            } else {
                noUserSelected.classList.remove('hidden');
                selectedUserStatus.classList.add('hidden');
            }
        });
        
        // Show no user selected initially
        noUserSelected.classList.remove('hidden');
        selectedUserStatus.classList.add('hidden');
        
    } catch (error) {
        console.error('Error loading all users status:', error);
        const userSelect = document.getElementById('userSelect');
        userSelect.innerHTML = '<option value="">-- Error Loading Users --</option>';
    }
}

async function loadSelectedUserStatus(username) {
    try {
        // Load user data and progress
        const users = await api.getSheet("user_credentials");
        const user = users.find(u => u.username === username);
        
        if (!user) {
            alert('User not found!');
            return;
        }
        
        // Update user info display
        document.getElementById('selectedUserName').textContent = user.full_name || user.username;
        document.getElementById('selectedUserInfo').textContent = `Username: ${user.username} | Class: ${user.class || 'Not Assigned'} | Role: ${user.role}`;
        
        // Load user's progress
        const progress = await api.getSheet(`${username}_progress`);
        
        // Load simplified admin status (only task chart and subject points)
        await Promise.all([
            loadAdminTaskChart(progress, user.class),
            loadAdminSubjectPointsSummary(progress, user.class)
        ]);
        
        // Hide other sections that are not needed
        const courseChartContainer = document.getElementById('adminCourseChart')?.closest('.bg-gray-50');
        const activityChartContainer = document.getElementById('adminActivityChart')?.closest('.bg-gray-50');
        const progressBarsContainer = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.gap-6');
        
        if (courseChartContainer) courseChartContainer.style.display = 'none';
        if (activityChartContainer) activityChartContainer.style.display = 'none';
        if (progressBarsContainer) progressBarsContainer.style.display = 'none';
        
    } catch (error) {
        console.error('Error loading selected user status:', error);
        alert('Error loading user status. Please try again.');
    }
}

async function loadAdminTaskChart(progress, userClass) {
    if (!userClass) return;
    
    try {
        const tasksSheetName = `${userClass}_tasks_master`;
        const tasks = await api.getSheet(tasksSheetName);
        const completedTasks = Array.isArray(progress) ? 
            progress.filter(p => p.item_type === "task" && p.status === "complete").length : 0;
        const totalTasks = Array.isArray(tasks) ? tasks.length : 0;
        const pendingTasks = Math.max(0, totalTasks - completedTasks);

        const ctx = document.getElementById('adminTaskChart');
        if (!ctx) return;
        
        if (adminChartInstances.taskChart) {
            adminChartInstances.taskChart.destroy();
        }
        
        adminChartInstances.taskChart = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Pending'],
                datasets: [{
                    data: [completedTasks, pendingTasks],
                    backgroundColor: ['#059669', '#e5e7eb'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading admin task chart:', error);
    }
}

async function loadAdminSubjectPointsSummary(progress, userClass) {
    try {
        if (!userClass) return;
        
        const tasksSheetName = `${userClass}_tasks_master`;
        const tasks = await api.getSheet(tasksSheetName);
        
        if (!tasks || tasks.error || tasks.length === 0) return;
        
        // Group tasks by subject and calculate points
        const subjectStats = {};
        // Remove maxPointsPerTask constant
        
        tasks.forEach(task => {
            const subject = task.subject || 'General';
            if (!subjectStats[subject]) {
                subjectStats[subject] = {
                    totalTasks: 0,
                    completedTasks: 0,
                    totalPoints: 0,
                    earnedPoints: 0
                };
            }
            
            subjectStats[subject].totalTasks++;
            
            // Check if task is completed
            const userTask = Array.isArray(progress) ? progress.find(p => 
                String(p.item_id) === String(task.task_id) && 
                p.item_type === "task" && 
                p.status === "complete"
            ) : null;
            
            if (userTask) {
                subjectStats[subject].completedTasks++;
                subjectStats[subject].earnedPoints += parseInt(userTask.grade || 0); // Use 0 as default
            }
        });
        
        // Calculate total points
        Object.keys(subjectStats).forEach(subject => {
            subjectStats[subject].totalPoints = subjectStats[subject].earnedPoints;
        });
        
        // Create or find the subject points container in admin status
        let subjectPointsContainer = document.getElementById('adminSubjectPointsGrid');
        if (!subjectPointsContainer) {
            // Create the subject points section after the task chart
            const taskChartContainer = document.getElementById('adminTaskChart')?.closest('.bg-gray-50');
            if (taskChartContainer) {
                const subjectPointsSection = document.createElement('div');
                subjectPointsSection.className = 'bg-gray-50 rounded-lg p-3 md:p-4';
                subjectPointsSection.innerHTML = `
                    <h3 class="text-base md:text-lg font-bold mb-3 md:mb-4 text-blue-600">Subject Points Summary</h3>
                    <div id="adminSubjectPointsGrid" class="subject-points-grid"></div>
                `;
                taskChartContainer.parentNode.insertBefore(subjectPointsSection, taskChartContainer.nextSibling);
                subjectPointsContainer = document.getElementById('adminSubjectPointsGrid');
            }
        }
        
        if (!subjectPointsContainer) return;
        
        const subjectCardsHtml = Object.entries(subjectStats).map(([subject, stats]) => {
            return `
                <div class="subject-points-card">
                    <div class="flex items-center justify-center mb-3">
                        <div class="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white mr-2">
                            <i class="${getSubjectIcon(subject)} text-xs md:text-sm"></i>
                        </div>
                        <h4>${subject}</h4>
                    </div>
                    <div class="points-display">${stats.earnedPoints}</div>
                    <div class="points-label">total points</div>
                    <div class="text-xs text-gray-500 mt-2">
                        ${stats.completedTasks}/${stats.totalTasks} tasks completed
                    </div>
                </div>
            `;
        }).join('');
        
        subjectPointsContainer.innerHTML = subjectCardsHtml;
        
    } catch (error) {
        console.error('Error loading admin subject points summary:', error);
    }
}

// =============================
// 🎯 Event Listeners & Initialization
// =============================
document.addEventListener('DOMContentLoaded', function() {
    // Add signup form event listener
    document.getElementById('signupForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitSignup();
    });
    
    // Add login form event listener
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        login();
    });
    
    // Modal close event listeners
    document.getElementById('studentTaskModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeStudentTaskModal();
        }
    });
});

// Performance optimization: Debounce resize events
let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
        if (currentPage === 'status') {
            Object.values(chartInstances).forEach(chart => {
                if (chart) chart.resize();
            });
        }
        if (currentPage === 'adminStatus') {
            Object.values(adminChartInstances).forEach(chart => {
                if (chart) chart.resize();
            });
        }
    }, 250);
});

// =============================
// 🔧 Utility Functions
// =============================
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return 'Invalid Date';
    }
}

function showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    let bgColor = 'bg-blue-500';
    let icon = 'fas fa-info-circle';
    
    switch (type) {
        case 'success':
            bgColor = 'bg-green-500';
            icon = 'fas fa-check-circle';
            break;
        case 'error':
            bgColor = 'bg-red-500';
            icon = 'fas fa-exclamation-circle';
            break;
        case 'warning':
            bgColor = 'bg-yellow-500';
            icon = 'fas fa-exclamation-triangle';
            break;
    }
    
    notification.className = `fixed top-20 right-4 ${bgColor} text-white p-4 rounded-lg shadow-lg z-50 max-w-sm`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="${icon} mr-2"></i>
            <span class="flex-1">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-3 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, duration);
}

// =============================
// 🔒 Security Functions
// =============================
// Disable right-click
document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
});

// Disable common inspect shortcuts
document.addEventListener("keydown", function (e) {
    // F12
    if (e.key === "F12") {
        e.preventDefault();
    }
    // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) {
        e.preventDefault();
    }
    // Ctrl+U (View source)
    if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
    }
    // Ctrl+S (Save page)
    if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
    }
});

// =============================
// 🚀 Final Initialization
// =============================
// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function initializeApp() {
    console.log('Initializing DHDC MANOOR System...');
    
    // Set default view to login
    showLogin();
    
    console.log('System initialized successfully!');
}

// Console welcome message
console.log('%c🎓 DHDC MANOOR System Loaded Successfully! 🎓', 'color: #059669; font-size: 16px; font-weight: bold;');
console.log('%cDarul Hidaya Da\'wa College Management System', 'color: #1e40af; font-size: 12px;');
