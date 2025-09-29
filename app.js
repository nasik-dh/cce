// 🌐 Global Variables
let currentUser = null;
let currentPage = 'tasks';
let currentCourse = null;
let currentStep = 0;
let currentDate = new Date();
let chartInstances = {};

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
                await Promise.all([
                    loadTasks(),
                    loadCourses(),
                    loadEvents(),
                    loadTimeTable()
                ]);
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
               (page === 'timetable' && btnText.includes('schedule')) ||
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
    if (page === 'events') {
        currentDate = new Date();
        loadCalendar();
    } else if (page === 'status') {
        loadStatusCharts();
    } else if (page === 'timetable') {
        loadTimeTable();
    } else if (page === 'adminUsers') {
        loadAdminUsers();
    } else if (page === 'adminEvents') {
        loadAdminEvents();
    } else if (page === 'adminTasks') {
        loadAdminTasks();
    } else if (page === 'adminCourses') {
        loadAdminCourses();
    } else if (page === 'adminStatus') {
        await loadAllUsersStatus();
    } else if (page === 'adminResponse') {
        loadAdminResponse();
    }
}

// =============================
// ✅ Tasks (Class-Based System)
// =============================
async function loadTasks() {
    const tasksContainer = document.getElementById('subjectCards');
    
    // Show loading state
    tasksContainer.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading your tasks...</div>';

    try {
        // For students, load tasks based on their class
        if (currentUser.role === 'student') {
            if (!currentUser.class) {
                tasksContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No class assigned. Please contact administrator.</p>';
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
                tasksContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No tasks found for your class.</p>';
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
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Create subject cards
            Object.entries(tasksBySubject).forEach(([subject, subjectTasks]) => {
                const completedCount = subjectTasks.filter(task => {
                    const userTask = progress.find(p => 
                        String(p.item_id) === String(task.task_id) && 
                        p.item_type === "task" && 
                        p.status === "complete"
                    );
                    return !!userTask;
                }).length;

                const progressPercentage = subjectTasks.length > 0 ? Math.round((completedCount / subjectTasks.length) * 100) : 0;

                const subjectCard = document.createElement('div');
                subjectCard.className = 'subject-card bg-white rounded-lg shadow-md border-2 border-gray-200 hover:border-green-400 transition-all duration-300 p-6 mb-4';
                subjectCard.setAttribute('data-subject', subject);
                
                subjectCard.innerHTML = `
                    <div class="flex justify-between items-center cursor-pointer" onclick="toggleSubjectTasks('${subject}')">
                        <div class="flex items-center space-x-4">
                            <div class="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white">
                                <i class="${getSubjectIcon(subject)}"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-gray-800">${subject}</h3>
                                <p class="text-sm text-gray-600">${subjectTasks.length} tasks • ${completedCount} completed</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-3">
                            <div class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                                ${subjectTasks.length} tasks
                            </div>
                            <i class="fas fa-chevron-down text-gray-400 transform transition-transform duration-300" id="arrow-${subject}"></i>
                        </div>
                    </div>
                    
                    <div class="mt-4">
                        <div class="flex justify-between text-sm text-gray-600 mb-2">
                            <span>Progress</span>
                            <span>${progressPercentage}%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-green-500 h-2 rounded-full transition-all duration-500" style="width: ${progressPercentage}%"></div>
                        </div>
                    </div>
                    
                    <div class="hidden mt-6 space-y-3" id="tasks-${subject}">
                        ${subjectTasks.map(task => {
                            const userTask = progress.find(p => 
                                String(p.item_id) === String(task.task_id) && 
                                p.item_type === "task" && 
                                p.status === "complete"
                            );
                            const completed = !!userTask;
                            
                            const dueDate = new Date(task.due_date);
                            dueDate.setHours(23, 59, 59, 999);
                            const isOverdue = !completed && dueDate < today;
                            const isDueToday = !completed && dueDate.toDateString() === today.toDateString();

                            let taskClass = 'task-item bg-gray-50 border border-gray-200 rounded-lg p-4 transition-all duration-200';
                            let statusIcon = '';
                            let statusClass = '';
                            
                            if (completed) {
                                taskClass += ' opacity-75';
                                statusIcon = '<i class="fas fa-check-circle text-green-500"></i>';
                                statusClass = 'text-green-600';
                            } else if (isOverdue) {
                                taskClass += ' border-red-300 bg-red-50';
                                statusIcon = '<i class="fas fa-exclamation-triangle text-red-500"></i>';
                                statusClass = 'text-red-600';
                            } else if (isDueToday) {
                                taskClass += ' border-yellow-300 bg-yellow-50';
                                statusIcon = '<i class="fas fa-clock text-yellow-500"></i>';
                                statusClass = 'text-yellow-600';
                            } else {
                                statusIcon = '<i class="fas fa-clock text-gray-400"></i>';
                                statusClass = 'text-gray-600';
                            }

                            const dueDateFormatted = new Date(task.due_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            });
                            
                            return `
                                <div class="${taskClass}">
                                    <div class="flex items-start space-x-3">
                                        <input type="checkbox" id="task-${task.task_id}" 
                                               ${completed ? 'checked disabled' : ''}
                                               ${isOverdue ? 'disabled title="This task is overdue and cannot be submitted"' : ''}
                                               class="mt-1 w-5 h-5 text-green-600 rounded focus:ring-green-500">
                                        <div class="flex-1">
                                            <div class="flex items-center justify-between mb-2">
                                                <span class="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded font-mono">${task.task_id}</span>
                                                <div class="flex items-center space-x-2">
                                                    ${statusIcon}
                                                    <span class="text-xs ${statusClass} font-medium">
                                                        ${completed ? 'Completed' : isOverdue ? 'Overdue' : isDueToday ? 'Due Today' : 'Pending'}
                                                    </span>
                                                </div>
                                            </div>
                                            <h4 class="font-semibold text-gray-800 ${completed ? 'line-through' : ''} ${isOverdue ? 'text-gray-500' : ''}">${task.title}</h4>
                                            <p class="text-sm text-gray-600 mt-1 ${completed ? 'line-through' : ''} ${isOverdue ? 'text-gray-400' : ''}">${task.description}</p>
                                            <p class="text-xs ${statusClass} mt-2">
                                                <i class="fas fa-calendar-alt mr-1"></i>
                                                Due: ${dueDateFormatted}
                                                ${isOverdue ? ' (OVERDUE)' : isDueToday ? ' (TODAY)' : ''}
                                            </p>
                                        </div>
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
        tasksContainer.innerHTML = '<p class="text-red-500 text-center py-8">Error loading tasks. Please try again.</p>';
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

// Function to toggle subject task visibility
function toggleSubjectTasks(subject) {
    const tasksContainer = document.getElementById(`tasks-${subject}`);
    const arrow = document.getElementById(`arrow-${subject}`);
    
    if (tasksContainer && arrow) {
        if (tasksContainer.classList.contains('hidden')) {
            // Close all other expanded subjects first
            document.querySelectorAll('[id^="tasks-"]').forEach(container => {
                if (container !== tasksContainer) {
                    container.classList.add('hidden');
                }
            });
            document.querySelectorAll('[id^="arrow-"]').forEach(arrowIcon => {
                if (arrowIcon !== arrow) {
                    arrowIcon.classList.remove('rotate-180');
                }
            });
            
            // Open this subject
            tasksContainer.classList.remove('hidden');
            arrow.classList.add('rotate-180');
        } else {
            // Close this subject
            tasksContainer.classList.add('hidden');
            arrow.classList.remove('rotate-180');
        }
    }
}

// Submit tasks function
async function submitTasks() {
    const submitBtn = event.target;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Updating...';
    submitBtn.disabled = true;

    try {
        // Get selected tasks - only non-disabled checkboxes
        const selectedTasks = [];
        document.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)').forEach(checkbox => {
            const taskId = checkbox.id.replace('task-', '');
            selectedTasks.push(taskId);
        });

        if (selectedTasks.length === 0) {
            alert('No valid tasks were selected for submission.');
            return;
        }

        const tasksSheetName = `${currentUser.class}_tasks_master`;
        const progress = await api.getSheet(`${currentUser.username}_progress`);
        
        const promises = [];
        let updatedCount = 0;

        for (let taskId of selectedTasks) {
            const existingTask = progress.find(p => 
                String(p.item_id) === String(taskId) && 
                p.item_type === "task" && 
                p.status === "complete"
            );
            
            if (!existingTask) {
                const rowData = [
                    taskId,
                    "task",
                    "complete",
                    new Date().toISOString().split('T')[0],
                    "100"
                ];
                
                promises.push(api.addRow(`${currentUser.username}_progress`, rowData));
                updatedCount++;
            }
        }

        if (promises.length > 0) {
            await Promise.all(promises);
            alert(`${updatedCount} task(s) submitted successfully!`);
            await loadTasks();
            if (currentPage === 'status') {
                await loadStatusCharts();
            }
        } else {
            alert('All selected tasks are already completed.');
        }
    } catch (error) {
        console.error('Error submitting tasks:', error);
        alert('Error updating tasks. Please try again.');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// =============================
// 📚 Courses
// =============================
const videoCourses = [
    {
        course_id: 'video_course_1',
        title: 'Course Videos - Set 1',
        description: 'Islamic learning videos collection - Part 1',
        videos: [
            {
                title: 'Video 1',
                url: 'https://www.youtube.com/embed/zalLv2NY98k'
            },
            {
                title: 'Video 2', 
                url: 'https://www.youtube.com/embed/VIDEO_ID_2'
            }
        ]
    }
];

const quizCourses = [
    {
        course_id: 'quiz_course_1',
        title: 'Course Practical - 1',
        description: 'Islamic knowledge quiz - Assessment 1',
        questions: [
            {
                question: "What is the first pillar of Islam?",
                options: ["Salah", "Shahada", "Zakat"],
                correct: 1
            },
            {
                question: "How many times a day do Muslims pray?",
                options: ["3 times", "5 times", "7 times"],
                correct: 1
            }
        ]
    }
];

async function loadCourses() {
    const container = document.getElementById('coursesList');
    
    // Show loading state
    container.innerHTML = '<div class="col-span-3 text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading courses...</div>';

    try {
        const [courses, progress] = await Promise.all([
            api.getSheet("courses_master"),
            api.getSheet(`${currentUser.username}_progress`)
        ]);
        
        container.innerHTML = '';

        const fragment = document.createDocumentFragment();

        // Add regular courses first
        if (courses && courses.length > 0) {
            courses.forEach(course => {
                const userCourse = progress.find(p => 
                    String(p.item_id) === String(course.course_id) && 
                    p.item_type === "course" && 
                    p.status === "complete"
                );
                const completed = !!userCourse;

                const courseElement = document.createElement('div');
                courseElement.className = `bg-gray-50 rounded-lg p-6 hover:shadow-md transition duration-300 ${completed ? 'opacity-75' : 'cursor-pointer'}`;
                
                if (!completed) {
                    courseElement.onclick = () => openCourse(course);
                }

                courseElement.innerHTML = `
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-lg font-semibold ${completed ? 'text-gray-500 line-through' : 'text-green-600'}">${course.title}</h3>
                        ${completed ? 
                            '<i class="fas fa-check-circle text-green-600 text-xl"></i>' : 
                            '<i class="fas fa-play-circle text-gray-400"></i>'
                        }
                    </div>
                    <p class="text-gray-600 text-sm ${completed ? 'line-through' : ''}">${course.description}</p>
                    <div class="mt-4 text-sm ${completed ? 'text-green-600' : 'text-gray-500'}">
                        <i class="fas fa-book-open mr-1"></i>
                        ${completed ? '✓ Completed Course' : 'Islamic Studies Course'}
                    </div>
                `;
                fragment.appendChild(courseElement);
            });
        }

        container.appendChild(fragment);
    } catch (error) {
        console.error('Error loading courses:', error);
        container.innerHTML = '<p class="text-red-500 col-span-3">Error loading courses.</p>';
    }
}

// Course modal functions
async function openCourse(course) {
    try {
        // Check if course is already completed
        const progress = await api.getSheet(`${currentUser.username}_progress`);
        const isCompleted = progress.find(p => 
            String(p.item_id) === String(course.course_id) && 
            p.item_type === "course" && 
            p.status === "complete"
        );
        
        if (isCompleted) {
            alert('This course is already completed!');
            return;
        }
        
        currentCourse = course;
        currentStep = 0;
        document.getElementById('courseTitle').textContent = course.title;
        document.getElementById('courseModal').classList.remove('hidden');
        loadCourseStep();
    } catch (error) {
        console.error('Error opening course:', error);
        alert('Error loading course. Please try again.');
    }
}

function closeCourseModal() {
    document.getElementById('courseModal').classList.add('hidden');
    currentCourse = null;
    currentStep = 0;
}

function loadCourseStep() {
    if (!currentCourse) return;
    
    const content = document.getElementById('courseContent');
    const stepIndicator = document.getElementById('stepIndicator');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    // Get the current step content from the course data
    const stepKey = `step${currentStep + 1}`;
    const stepContent = currentCourse[stepKey] || `Step ${currentStep + 1} content`;
    
    content.innerHTML = `
        <div class="bg-green-50 p-6 rounded-lg">
            <h4 class="font-semibold text-green-600 mb-3">Step ${currentStep + 1}: ${currentCourse.title}</h4>
            <div class="text-gray-700 leading-relaxed">
                <p class="whitespace-pre-wrap">${stepContent}</p>
            </div>
        </div>
    `;
    
    const totalSteps = 5;
    stepIndicator.textContent = `Step ${currentStep + 1} of ${totalSteps}`;

    prevBtn.disabled = currentStep === 0;
    prevBtn.className = `px-4 py-2 rounded transition duration-300 ${currentStep === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}`;
    
    if (currentStep === totalSteps - 1) {
        nextBtn.innerHTML = 'Complete<i class="fas fa-check ml-2"></i>';
        nextBtn.onclick = completeCourse;
    } else {
        nextBtn.innerHTML = 'Next<i class="fas fa-chevron-right ml-2"></i>';
        nextBtn.onclick = nextStep;
    }
}

function nextStep() {
    const totalSteps = 5;
    if (currentStep < totalSteps - 1) {
        currentStep++;
        loadCourseStep();
    }
}

function prevStep() {
    if (currentStep > 0) {
        currentStep--;
        loadCourseStep();
    }
}

async function completeCourse() {
    const completeBtn = document.getElementById('nextBtn');
    const originalText = completeBtn.innerHTML;
    completeBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Completing...';
    completeBtn.disabled = true;

    try {
        const progress = await api.getSheet(`${currentUser.username}_progress`);
        
        // Check if course is already completed
        const existingCourse = progress.find(p => 
            String(p.item_id) === String(currentCourse.course_id) && 
            p.item_type === "course" && 
            p.status === "complete"
        );
        
        if (existingCourse) {
            alert('This course is already completed!');
            closeCourseModal();
            return;
        }

        const progressSheetName = `${currentUser.username}_progress`;
        const rowData = [
            currentCourse.course_id,
            "course",
            "complete",
            new Date().toISOString().split('T')[0],
            "100"
        ];
        
        const result = await api.addRow(progressSheetName, rowData);

        if (result && (result.success || result.includes?.('Success'))) {
            alert('Congratulations! Course completed successfully!');
            closeCourseModal();
            await loadCourses();
            if (currentPage === 'status') {
                await loadStatusCharts();
            }
        } else {
            throw new Error(result?.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Error completing course:', error);
        alert('Error completing course: ' + error.message);
    } finally {
        completeBtn.innerHTML = originalText;
        completeBtn.disabled = false;
    }
}

// =============================
// 📅 Events
// =============================
async function loadEvents() {
    try {
        window.eventsData = await api.getSheet("events_master");
    } catch (error) {
        console.error('Error loading events:', error);
        window.eventsData = [];
    }
}

function changeMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    loadCalendar();
}

async function loadCalendar() {
    const events = window.eventsData || await api.getSheet("events_master");
    const calendar = document.getElementById('calendar');
    const monthTitle = document.getElementById('currentMonth');

    const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
    monthTitle.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    calendar.innerHTML = '';

    // Add day headers
    const dayHeaders = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const fragment = document.createDocumentFragment();
    
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'text-center font-semibold text-gray-600 py-2 text-sm';
        dayHeader.textContent = day;
        fragment.appendChild(dayHeader);
    });

        // Calculate calendar days
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    for (let i = 0; i < 42; i++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        const dayElement = document.createElement('div');
        dayElement.className = 'min-h-[60px] p-2 border border-gray-200 hover:bg-green-50 cursor-pointer transition-colors text-xs sm:text-sm';

        if (day.getMonth() !== currentDate.getMonth()) {
            dayElement.classList.add('text-gray-300', 'bg-gray-50');
        }

        const dayEvents = events.filter(event => {
            if (!event.date) return false;
            const eventDate = new Date(event.date);
            return eventDate.toDateString() === day.toDateString();
        });

        if (dayEvents.length > 0) {
            dayElement.onclick = () => openEventModal(day.toISOString().split('T')[0]);
        }

        dayElement.innerHTML = `
            <div class="font-medium">${day.getDate()}</div>
            ${dayEvents.length > 0 ? `
                <div class="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
                ${dayEvents.length > 1 ? `<div class="text-xs text-green-600 mt-1">${dayEvents.length} events</div>` : ''}
            ` : ''}
        `;
        
        fragment.appendChild(dayElement);
    }
    
    calendar.appendChild(fragment);
}

function openEventModal(dateString) {
    const events = window.eventsData || [];
    const dayEvents = events.filter(event => {
        if (!event.date) return false;
        const eventDate = new Date(event.date);
        return eventDate.toISOString().split('T')[0] === dateString;
    });

    if (dayEvents.length === 0) return;

    const modal = document.getElementById('eventModal');
    const titleElement = document.getElementById('eventTitle');
    const dateTimeElement = document.getElementById('eventDateTime');
    const detailsElement = document.getElementById('eventDetails');

    if (dayEvents.length === 1) {
        const event = dayEvents[0];
        titleElement.textContent = event.title || 'Event';
        
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        dateTimeElement.innerHTML = `
            <i class="fas fa-calendar-day mr-2"></i>${formattedDate}
            ${event.time ? `<br><i class="fas fa-clock mr-2"></i>${event.time}` : ''}
        `;

        detailsElement.innerHTML = `
            ${event.description ? `
                <div class="bg-green-50 p-3 rounded-lg mb-3">
                    <h4 class="font-semibold text-green-800 mb-2">Description</h4>
                    <p class="text-gray-700">${event.description}</p>
                </div>
            ` : ''}
            ${event.place ? `
                <div class="flex items-start space-x-2 mb-2">
                    <i class="fas fa-map-marker-alt text-green-600 mt-1"></i>
                    <div>
                        <span class="font-semibold text-gray-800">Location:</span>
                        <span class="text-gray-700 ml-1">${event.place}</span>
                    </div>
                </div>
            ` : ''}
            ${event.details ? `
                <div class="flex items-start space-x-2">
                    <i class="fas fa-info-circle text-green-600 mt-1"></i>
                    <div>
                        <span class="font-semibold text-gray-800">Details:</span>
                        <span class="text-gray-700 ml-1">${event.details}</span>
                    </div>
                </div>
            ` : ''}
        `;
    } else {
        // Multiple events on same day
        titleElement.textContent = `${dayEvents.length} Events`;
        
        const eventDate = new Date(dayEvents[0].date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        dateTimeElement.innerHTML = `<i class="fas fa-calendar-day mr-2"></i>${formattedDate}`;

        detailsElement.innerHTML = dayEvents.map(event => `
            <div class="border-l-4 border-green-500 pl-4 mb-4 last:mb-0">
                <h4 class="font-semibold text-green-600 mb-1">${event.title || 'Event'}</h4>
                ${event.time ? `<p class="text-sm text-gray-600 mb-2"><i class="fas fa-clock mr-1"></i>${event.time}</p>` : ''}
                ${event.description ? `<p class="text-gray-700 text-sm mb-2">${event.description}</p>` : ''}
                ${event.place ? `<p class="text-sm text-gray-600"><i class="fas fa-map-marker-alt mr-1"></i>${event.place}</p>` : ''}
                ${event.details ? `<p class="text-sm text-gray-600"><i class="fas fa-info-circle mr-1"></i>${event.details}</p>` : ''}
            </div>
        `).join('');
    }

    modal.classList.remove('hidden');
}

function closeEventModal() {
    document.getElementById('eventModal').classList.add('hidden');
}

// =============================
// 📊 Status Charts & Progress (COMPLETED)
// =============================
async function loadStatusCharts() {
    try {
        const progressSheetName = `${currentUser.username}_progress`;
        const progress = await api.getSheet(progressSheetName);
        
        await Promise.all([
            loadTaskChart(progress),
            loadCourseChart(progress),
            loadActivityChart(progress),
            updateProgressBars(progress)
        ]);
    } catch (error) {
        console.error('Error loading status charts:', error);
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

async function loadCourseChart(progress) {
    try {
        const courses = await api.getSheet("courses_master");
        
        // Calculate total courses including video courses and quiz courses
        const totalRegularCourses = courses && Array.isArray(courses) ? courses.length : 0;
        const totalVideoCourses = videoCourses.length;
        const totalQuizCourses = quizCourses.length;
        const totalCourses = totalRegularCourses + totalVideoCourses + totalQuizCourses;
        
        // Calculate completed courses
        const completedCourses = Array.isArray(progress) ? 
            progress.filter(p => p.item_type === "course" && p.status === "complete").length : 0;
        const inProgressCourses = Math.max(0, totalCourses - completedCourses);

        const ctx = document.getElementById('courseChart');
        if (!ctx) return;
        
        if (chartInstances.courseChart) {
            chartInstances.courseChart.destroy();
        }
        
        chartInstances.courseChart = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'In Progress'],
                datasets: [{
                    data: [completedCourses, inProgressCourses],
                    backgroundColor: ['#3b82f6', '#e5e7eb'],
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
        console.error('Error loading course chart:', error);
    }
}

async function loadActivityChart(progress) {
    try {
        const progressArray = Array.isArray(progress) ? progress : [];
        
        const now = new Date();
        const startOfWeek = new Date(now);
        
        // Get Monday of current week
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const dailyData = [];
        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        
        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(startOfWeek);
            currentDay.setDate(startOfWeek.getDate() + i);
            
            const nextDay = new Date(currentDay);
            nextDay.setDate(currentDay.getDate() + 1);
            
            // Count completions for this specific day
            const dayCompletions = progressArray.filter(p => {
                if (!p.completion_date) return false;
                try {
                    const completionDate = new Date(p.completion_date);
                    return completionDate >= currentDay && completionDate < nextDay && p.status === "complete";
                } catch (e) {
                    return false;
                }
            }).length;
            
            dailyData.push(dayCompletions);
        }

        const ctx = document.getElementById('activityChart');
        if (!ctx) return;
        
        if (chartInstances.activityChart) {
            chartInstances.activityChart.destroy();
        }
        
        chartInstances.activityChart = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: dayLabels,
                datasets: [{
                    label: 'Items Completed',
                    data: dailyData,
                    backgroundColor: 'rgba(5, 150, 105, 0.8)',
                    borderColor: '#059669',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading activity chart:', error);
    }
}

async function updateProgressBars(progress) {
    try {
        if (!currentUser.class) return;
        
        const tasksSheetName = `${currentUser.class}_tasks_master`;
        const [tasks, courses] = await Promise.all([
            api.getSheet(tasksSheetName),
            api.getSheet("courses_master")
        ]);
        
        // Ensure progress is an array
        const progressArray = Array.isArray(progress) ? progress : [];
        
        // Tasks progress
        const completedTasks = progressArray.filter(p => p.item_type === "task" && p.status === "complete").length;
        const totalTasks = Array.isArray(tasks) ? tasks.length : 0;
        const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        const taskProgressElement = document.getElementById('taskProgress');
        const taskProgressBarElement = document.getElementById('taskProgressBar');
        
        if (taskProgressElement) taskProgressElement.textContent = `${taskProgress}%`;
        if (taskProgressBarElement) taskProgressBarElement.style.width = `${taskProgress}%`;

        // Courses progress (including video courses and quiz courses)
        const totalRegularCourses = Array.isArray(courses) ? courses.length : 0;
        const totalVideoCourses = videoCourses.length;
        const totalQuizCourses = quizCourses.length;
        const totalCourses = totalRegularCourses + totalVideoCourses + totalQuizCourses;
        
        const completedCourses = progressArray.filter(p => p.item_type === "course" && p.status === "complete").length;
        const courseProgress = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;
        
        const courseProgressTextElement = document.getElementById('courseProgressText');
        const courseProgressBarElement = document.getElementById('courseProgressBar');
        
        if (courseProgressTextElement) courseProgressTextElement.textContent = `${courseProgress}%`;
        if (courseProgressBarElement) courseProgressBarElement.style.width = `${courseProgress}%`;

        // Events progress (placeholder)
        const eventProgress = 40;
        const eventProgressElement = document.getElementById('eventProgress');
        const eventProgressBarElement = document.getElementById('eventProgressBar');
        
        if (eventProgressElement) eventProgressElement.textContent = `${eventProgress}%`;
        if (eventProgressBarElement) eventProgressBarElement.style.width = `${eventProgress}%`;
        
    } catch (error) {
        console.error('Error updating progress bars:', error);
    }
}

// =============================
// 📅 Time Table Functions (COMPLETED)
// =============================
async function loadTimeTable() {
    try {
        const scheduleSheetName = `${currentUser.username}_schedule`;
        console.log('Loading schedule for:', scheduleSheetName);
        const schedule = await api.getSheet(scheduleSheetName);
        console.log('Schedule data received:', schedule);
        
        const timetableBody = document.getElementById('timetableBody');
        if (!timetableBody) return;
        
        timetableBody.innerHTML = '';

        if (!schedule || schedule.error || schedule.length === 0) {
            timetableBody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center py-8 text-gray-500">
                        No schedule found. Please contact administrator.
                        <br><small>Looking for: ${scheduleSheetName}</small>
                    </td>
                </tr>
            `;
            return;
        }

        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const fragment = document.createDocumentFragment();

        days.forEach(dayName => {
            const daySchedule = schedule.find(s => s.day && s.day.toLowerCase() === dayName);
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 transition-colors';

            // Day cell
            const dayCell = document.createElement('td');
            dayCell.className = 'border border-gray-300 p-2 font-semibold bg-gray-100 sticky left-0 z-10 text-xs sm:text-sm';
            dayCell.textContent = dayName.charAt(0).toUpperCase() + dayName.slice(1);
            row.appendChild(dayCell);

            // Period cells
            for (let period = 1; period <= 10; period++) {
                const periodCell = document.createElement('td');
                const subject = daySchedule ? (daySchedule[`period_${period}`] || 'Free') : 'Free';
                
                periodCell.className = `border border-gray-300 p-1 text-center text-xs sm:text-sm ${getSubjectClass(subject)}`;
                
                if (period === 6) { // Break period
                    periodCell.className += ' bg-orange-100 font-medium';
                }

                periodCell.innerHTML = `
                    <div class="font-medium">${subject}</div>
                    <div class="mt-1">${getSubjectIcon(subject)}</div>
                `;
                
                row.appendChild(periodCell);
            }

            fragment.appendChild(row);
        });

        timetableBody.appendChild(fragment);
    } catch (error) {
        console.error('Error loading timetable:', error);
        const timetableBody = document.getElementById('timetableBody');
        if (timetableBody) {
            timetableBody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center py-8 text-red-500">
                        Error loading timetable: ${error.message}<br>
                        Please check console for details.
                    </td>
                </tr>
            `;
        }
    }
}

function getSubjectClass(subject) {
    if (!subject || subject.toLowerCase() === 'free') return 'bg-gray-50 text-gray-500';
    
    const subjectLower = subject.toLowerCase();
    
    if (subjectLower.includes('qura') || subjectLower.includes('quran') || subjectLower.includes('islamic') ||
        subjectLower.includes('hadith') || subjectLower.includes('fiqh') || subjectLower.includes('isl')) {
        return 'bg-green-100 text-green-800';
    } else if (subjectLower.includes('arb') || subjectLower.includes('arabic') ||
               subjectLower.includes('eng') || subjectLower.includes('english') ||
               subjectLower.includes('language') || subjectLower.includes('urdu')) {
        return 'bg-blue-100 text-blue-800';
    } else if (subjectLower.includes('mth') || subjectLower.includes('math') ||
               subjectLower.includes('sci') || subjectLower.includes('science') ||
               subjectLower.includes('computer') || subjectLower.includes('cop')) {
        return 'bg-purple-100 text-purple-800';
    } else if (subjectLower.includes('break') || subjectLower.includes('lunch') ||
               subjectLower.includes('prayer') || subjectLower.includes('rest')) {
        return 'bg-orange-100 text-orange-800';
    } else if (subjectLower.includes('hds') || subjectLower.includes('history') ||
               subjectLower.includes('eco') || subjectLower.includes('economy')) {
        return 'bg-yellow-100 text-yellow-800';
    }
    
    return 'bg-gray-100 text-gray-700';
}

function getSubjectIcon(subject) {
    if (!subject || subject.toLowerCase() === 'free') {
        return '<i class="fas fa-coffee text-xs opacity-60"></i>';
    }
    
    const subjectLower = subject.toLowerCase();
    
    if (subjectLower.includes('qura') || subjectLower.includes('quran') || subjectLower.includes('islamic')) {
        return '<i class="fas fa-mosque text-xs opacity-60"></i>';
    } else if (subjectLower.includes('arb') || subjectLower.includes('arabic') ||
               subjectLower.includes('eng') || subjectLower.includes('english')) {
        return '<i class="fas fa-language text-xs opacity-60"></i>';
    } else if (subjectLower.includes('mth') || subjectLower.includes('math')) {
        return '<i class="fas fa-calculator text-xs opacity-60"></i>';
    } else if (subjectLower.includes('sci') || subjectLower.includes('science')) {
        return '<i class="fas fa-flask text-xs opacity-60"></i>';
    } else if (subjectLower.includes('cop') || subjectLower.includes('computer')) {
        return '<i class="fas fa-laptop text-xs opacity-60"></i>';
    } else if (subjectLower.includes('break') || subjectLower.includes('lunch')) {
        return '<i class="fas fa-utensils text-xs opacity-60"></i>';
    } else if (subjectLower.includes('prayer') || subjectLower.includes('rest')) {
        return '<i class="fas fa-pray text-xs opacity-60"></i>';
    } else if (subjectLower.includes('hds') || subjectLower.includes('history')) {
        return '<i class="fas fa-scroll text-xs opacity-60"></i>';
    } else if (subjectLower.includes('eco') || subjectLower.includes('economy')) {
        return '<i class="fas fa-chart-line text-xs opacity-60"></i>';
    } else if (subjectLower.includes('pe') || subjectLower.includes('physical')) {
        return '<i class="fas fa-running text-xs opacity-60"></i>';
    } else if (subjectLower.includes('art')) {
        return '<i class="fas fa-palette text-xs opacity-60"></i>';
    } else if (subjectLower.includes('music')) {
        return '<i class="fas fa-music text-xs opacity-60"></i>';
    } else if (subjectLower.includes('urdu')) {
        return '<i class="fas fa-font text-xs opacity-60"></i>';
    }
    
    return '<i class="fas fa-book text-xs opacity-60"></i>';
}

// =============================
// 🔗 URL Hash Navigation Functions (COMPLETED)
// =============================
function handleHashNavigation() {
    const hash = window.location.hash;
    
    if (hash === '#signup') {
        if (!document.getElementById('loginPage').classList.contains('hidden')) {
            showSignup();
        }
    } else if (hash === '#login') {
        if (!document.getElementById('loginPage').classList.contains('hidden')) {
            showLogin();
        }
    }
}

function updateUrlHash(section) {
    if (section === 'signup') {
        window.history.pushState(null, null, '#signup');
    } else if (section === 'login') {
        window.history.pushState(null, null, '#login');
    } else {
        window.history.pushState(null, null, window.location.pathname);
    }
}

// =============================
// 👨‍💼 Admin Functions (COMPLETED)
// =============================
async function clearAdminTaskFilters() {
    document.getElementById('adminTaskClassSelect').value = '';
    document.getElementById('adminTaskSubjectSelect').value = '';
    document.getElementById('adminTaskSubjectSelect').disabled = true;
    document.getElementById('adminTaskSubjectSelect').innerHTML = '<option value="">-- Select Subject --</option>';
    
    document.getElementById('adminTasksClassSubjectView').classList.add('hidden');
    document.getElementById('adminTasksDefaultView').classList.remove('hidden');
}

function toggleRoleFields() {
    const role = document.getElementById('newRole').value;
    const studentFields = document.getElementById('studentFields');
    const adminFields = document.getElementById('adminFields');
    
    if (role === 'admin') {
        studentFields.classList.add('hidden');
        adminFields.classList.remove('hidden');
        document.getElementById('newSubjects').required = true;
        document.getElementById('newClass').required = false;
    } else {
        studentFields.classList.remove('hidden');
        adminFields.classList.add('hidden');
        document.getElementById('newClass').required = true;
        document.getElementById('newSubjects').required = false;
    }
}

// =============================
// 🎯 Event Listeners & Initialization (COMPLETED)
// =============================
document.addEventListener('DOMContentLoaded', function() {
    // Initialize calendar
    loadCalendar();
    
    // Add signup form event listener
    document.getElementById('signupForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitSignup();
    });
    
    // Handle initial hash navigation
    handleHashNavigation();
    
    // Add login form event listener
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        login();
    });
    
    // Modal close event listeners
    document.getElementById('eventModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeEventModal();
        }
    });
    
    document.getElementById('courseModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeCourseModal();
        }
    });
    
    document.getElementById('studentTaskModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeStudentTaskModal();
        }
    });
    
    document.getElementById('addUserModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeAddUserModal();
        }
    });
    
    document.getElementById('addEventModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeAddEventModal();
        }
    });
    
    document.getElementById('addCourseModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeAddCourseModal();
        }
    });
});

// Listen for hash changes
window.addEventListener('hashchange', handleHashNavigation);
window.addEventListener('load', handleHashNavigation);

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
// 🔧 Utility Functions (COMPLETED)
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

function formatDateTime(dateString, timeString) {
    try {
        const date = new Date(dateString);
        let result = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        if (timeString) {
            result += ` at ${timeString}`;
        }
        
        return result;
    } catch (e) {
        return 'Invalid Date';
    }
}

function generateTaskId() {
    return 'TASK_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

function generateCourseId() {
    return 'COURSE_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

function generateEventId() {
    return 'EVENT_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

// =============================
// 🎨 Theme and UI Functions (COMPLETED)
// =============================
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

function showLoading(element, text = 'Loading...') {
    if (element) {
        element.innerHTML = `<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>${text}</div>`;
    }
}

function hideLoading(element, content = '') {
    if (element) {
        element.innerHTML = content;
    }
}

// =============================
// 🔒 Security Functions (COMPLETED)
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
// 🚀 Debug and Development Functions (COMPLETED)
// =============================
// Expose functions for debugging and development
window.hudaAcademy = {
    // Core functions
    login,
    logout,
    showPage,
    
    // Task functions
    submitTasks,
    loadTasks,
    checkOverdueTasks,
    
    // Course functions
    openCourse,
    completeCourse,
    loadCourses,
    
    // Event functions
    loadEvents,
    loadCalendar,
    openEventModal,
    
    // Admin functions
    loadAdminData,
    loadAdminUsers,
    loadAdminTasks,
    loadAdminEvents,
    loadAdminCourses,
    loadAllUsersStatus,
    
    // Utility functions
    clearCache: () => api.clearCache(),
    formatDate,
    formatDateTime,
    showNotification,
    
    // Debug functions
    debugSheets: window.debugSheets,
    debugUser: window.debugUser,
    debugAllSheets: window.debugAllSheets,
    testAPI: window.testAPI,
    debugAdminStatus: window.debugAdminStatus,
    debugAdminSubjects: window.debugAdminSubjects,
    
    // API instance
    api
};

// Console welcome message
console.log('%c🎓 DHDC MANOOR System Loaded Successfully! 🎓', 'color: #059669; font-size: 16px; font-weight: bold;');
console.log('%cDarul Hidaya Da\'wa College Management System', 'color: #1e40af; font-size: 12px;');
console.log('%cAvailable debug functions: hudaAcademy.debugSheets(), hudaAcademy.testAPI(), hudaAcademy.debugUser("username")', 'color: #6b7280; font-size: 10px;');

// =============================
// 🎯 Final Initialization (COMPLETED)
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
    
    // Initialize calendar with current date
    currentDate = new Date();
    
    // Check for saved user session (optional enhancement)
    // This could be implemented later for "Remember Me" functionality
    
    console.log('System initialized successfully!');
}

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        api,
        login,
        logout,
        showPage,
        hudaAcademy: window.hudaAcademy
    };
}
