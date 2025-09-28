// 🌐 Global Variables
// =============================
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
// 📊 Optimized Google Sheets Integration
// =============================
class GoogleSheetsAPI {
    constructor() {
        this.apiUrl = "https://script.google.com/macros/s/AKfycbwHNUdKLXepN8RsY-53R_97rJ4T1-hCMa2jiv07gYKbMP9Mohh5hMN0Ndlnx1Kc2b9n/exec";
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
            console.log(`Fetching sheet: ${sheetName} from URL: ${url}`);
            
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
            console.log(`Raw response for ${sheetName}:`, text.substring(0, 200) + '...');
            
            const data = JSON.parse(text);
            console.log(`Parsed data for ${sheetName}:`, {
                isArray: Array.isArray(data),
                length: data?.length || 0,
                sample: Array.isArray(data) ? data.slice(0, 2) : 'Not array'
            });
            
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

    // Debug method to test all sheets
    async debugAllSheets() {
        console.log('=== GoogleSheetsAPI Debug: Testing all sheets ===');
        
        const sheetsToTest = [
            'user_credentials',
            'tasks_master', 
            'courses_master',
            'events_master',
            'registration',
            'user1_progress',
            'user2_progress', 
            'user3_progress',
            'nasik_progress',
            'sufiyan_progress',
            'user1_schedule',
            'user2_schedule',
            'user3_schedule',
            'nasik_schedule',
            'sufiyan_schedule'
        ];

        const results = {};
        
        for (const sheetName of sheetsToTest) {
            try {
                console.log(`\n--- Testing sheet: ${sheetName} ---`);
                const data = await this.getSheet(sheetName, false); // Don't use cache
                
                if (data && data.error) {
                    results[sheetName] = { status: 'error', error: data.error };
                    console.log(`❌ ${sheetName}: Error - ${data.error}`);
                } else if (Array.isArray(data)) {
                    results[sheetName] = { 
                        status: 'success', 
                        count: data.length,
                        sample: data.length > 0 ? data[0] : null
                    };
                    console.log(`✅ ${sheetName}: Found ${data.length} records`);
                    if (data.length > 0) {
                        console.log(`   Sample record:`, data[0]);
                    }
                } else if (data) {
                    results[sheetName] = { 
                        status: 'success', 
                        type: typeof data,
                        data: data
                    };
                    console.log(`✅ ${sheetName}: Found data (not array)`, typeof data);
                } else {
                    results[sheetName] = { status: 'empty' };
                    console.log(`⚠️ ${sheetName}: Empty or null response`);
                }
                
            } catch (error) {
                results[sheetName] = { status: 'exception', error: error.message };
                console.log(`❌ ${sheetName}: Exception - ${error.message}`);
            }
            
            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('\n=== Debug Summary ===');
        Object.entries(results).forEach(([sheet, result]) => {
            console.log(`${sheet}: ${result.status}${result.count ? ` (${result.count} records)` : ''}${result.error ? ` - ${result.error}` : ''}`);
        });
        
        console.log('=== GoogleSheetsAPI Debug Complete ===\n');
        return results;
    }

    // Debug method to test specific user data
    async debugUserData(username) {
        console.log(`=== Debug User Data: ${username} ===`);
        
        try {
            // Test user credentials
            console.log('1. Testing user_credentials...');
            const users = await this.getSheet('user_credentials', false);
            if (Array.isArray(users)) {
                const user = users.find(u => u.username === username);
                console.log(`User found:`, user ? 'Yes' : 'No');
                if (user) {
                    console.log('User data:', user);
                }
            } else {
                console.log('Users data is not an array:', users);
            }
            
            // Test user progress sheet
            console.log(`\n2. Testing ${username}_progress...`);
            const progress = await this.getSheet(`${username}_progress`, false);
            if (progress && !progress.error) {
                console.log(`Progress sheet found with ${Array.isArray(progress) ? progress.length : 'non-array'} records`);
                if (Array.isArray(progress) && progress.length > 0) {
                    console.log('Sample progress record:', progress[0]);
                }
            } else {
                console.log(`Progress sheet error or not found:`, progress?.error || 'Not found');
            }
            
            // Test user schedule sheet
            console.log(`\n3. Testing ${username}_schedule...`);
            const schedule = await this.getSheet(`${username}_schedule`, false);
            if (schedule && !schedule.error) {
                console.log(`Schedule sheet found with ${Array.isArray(schedule) ? schedule.length : 'non-array'} records`);
                if (Array.isArray(schedule) && schedule.length > 0) {
                    console.log('Sample schedule record:', schedule[0]);
                }
            } else {
                console.log(`Schedule sheet error or not found:`, schedule?.error || 'Not found');
            }
            
        } catch (error) {
            console.error('Debug user data error:', error);
        }
        
        console.log(`=== Debug User Data Complete ===\n`);
    }
}

const api = new GoogleSheetsAPI();

// Debug functions - Global function for easy console access
window.debugAdminStatus = async function() {
    console.log('=== DEBUG: Admin Status ===');
    
    try {
        const users = await api.getSheet("user_credentials", false);
        console.log('Users found:', users);
        
        if (Array.isArray(users)) {
            console.log('User count:', users.length);
            users.forEach((user, index) => {
                console.log(`${index + 1}. ${user.username} - ${user.full_name} (${user.role})`);
            });
        }
        
        // Test dropdown population
        await loadUsersDropdown();
        
    } catch (error) {
        console.error('Debug error:', error);
    }
};

window.debugSheets = async function() {
    console.log('=== DEBUG: Testing sheet access ===');
    
    try {
        console.log('Testing user_credentials sheet...');
        const users = await api.getSheet("user_credentials", false);
        console.log('Users result:', users);
        console.log('Users type:', typeof users);
        console.log('Users isArray:', Array.isArray(users));
        if (Array.isArray(users)) {
            console.log('Users count:', users.length);
            console.log('First user:', users[0]);
            
            // Show all usernames
            console.log('All usernames:', users.map(u => u.username));
        }
        
        // Test individual user progress sheets
        const testUsers = ['user1', 'user2', 'user3', 'nasik', 'sufiyan'];
        for (const testUser of testUsers) {
            try {
                console.log(`\n--- Testing ${testUser}_progress ---`);
                const progress = await api.getSheet(`${testUser}_progress`, false);
                if (progress && !progress.error) {
                    console.log(`✅ ${testUser}_progress: Found ${Array.isArray(progress) ? progress.length + ' records' : 'data'}`);
                    if (Array.isArray(progress) && progress.length > 0) {
                        console.log(`Sample record:`, progress[0]);
                    }
                } else {
                    console.log(`❌ ${testUser}_progress: ${progress?.error || 'Not found'}`);
                }
            } catch (e) {
                console.log(`❌ ${testUser}_progress: Exception -`, e.message);
            }
        }
        
    } catch (error) {
        console.error('Debug error:', error);
    }
    
    console.log('=== DEBUG: Complete ===');
};

// Advanced debug function - Test all sheets
window.debugAllSheets = async function() {
    return await api.debugAllSheets();
};

// Debug specific user
window.debugUser = async function(username) {
    if (!username) {
        console.log('Usage: debugUser("username")');
        return;
    }
    return await api.debugUserData(username);
};

// Quick test function
window.testAPI = async function() {
    console.log('=== Quick API Test ===');
    try {
        const users = await api.getSheet("user_credentials", false);
        console.log('API Response:', {
            success: !users?.error,
            isArray: Array.isArray(users),
            count: Array.isArray(users) ? users.length : 'N/A',
            error: users?.error || 'None'
        });
        
        if (Array.isArray(users) && users.length > 0) {
            console.log('Available users:');
            users.forEach((user, index) => {
                console.log(`  ${index + 1}. ${user.username} (${user.full_name || 'No name'}) - Role: ${user.role || 'student'}`);
            });
        }
    } catch (error) {
        console.error('Test failed:', error);
    }
    console.log('=== Test Complete ===');
};

// =============================
// 🔑 Optimized Authentication
// =============================
async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorDiv = document.getElementById('loginError');

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
        console.log('Raw response:', users);
        
        if (!users || users.error) {
            showError(users?.error || 'Failed to fetch user data');
            return;
        }
        
        if (!Array.isArray(users) || users.length === 0) {
            showError('No users found in database');
            return;
        }
        
        // Simple exact match
        const user = users.find(u => 
            u.username === username && u.password === password
        );

        if (user) {
            currentUser = {
                username: user.username,
                name: user.full_name || user.username,
                role: user.role || 'student',
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
                showPage('adminUsers');
                await loadAdminData();
            } else {
                document.getElementById('studentNav').classList.remove('hidden');
                document.getElementById('adminNav').classList.add('hidden');
                showPage('tasks');
                await Promise.all([
                    loadTasks(),
                    loadCourses(),
                    loadEvents(),
                    loadTimeTable(),
                    checkOverdueTasks()
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
    
    // Clear URL hash and show login by default
    updateUrlHash('login');
    showLogin();
}

// Add these functions after the existing login/logout functions
function showSignup() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('signupSection').classList.remove('hidden');
    hideError();
    updateUrlHash('signup');
}

function showLogin() {
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    hideSignupError();
    hideSignupSuccess();
    updateUrlHash('login');
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
        console.log('Signup result:', result);

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
    console.log('Loading admin status page...');
    await loadAllUsersStatus(); // Make sure this line has 'await'
} else if (page === 'adminResponse') {
    loadAdminResponse();
}
}

// =============================
// ✅ Optimized Tasks
// =============================
// Updated loadTasks function (remove submit functionality for students)
async function loadTasks() {
    const tasksContainer = document.getElementById('tasksList');
    
    // Show loading state
    tasksContainer.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading tasks...</div>';

    try {
        const [tasks, progress] = await Promise.all([
            api.getSheet("tasks_master"),
            api.getSheet(`${currentUser.username}_progress`)
        ]);
        
        tasksContainer.innerHTML = '';

        if (!tasks || tasks.length === 0) {
            tasksContainer.innerHTML = '<p class="text-gray-500">No tasks found.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        tasks.forEach(task => {
            const userTask = progress.find(p => 
                String(p.item_id) === String(task.task_id) && 
                p.item_type === "task" && 
                p.status === "complete"
            );
            const completed = !!userTask;
            
            // Check if task is overdue
            const dueDate = new Date(task.due_date);
            dueDate.setHours(23, 59, 59, 999);
            const isOverdue = !completed && dueDate < today;
            const isDueToday = !completed && dueDate.toDateString() === today.toDateString();
            const isDueSoon = !completed && dueDate > today && dueDate <= new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000));

            const taskElement = document.createElement('div');
            let containerClass = 'flex items-start space-x-3 p-4 border rounded-lg';
            let statusIndicator = '';
            
            if (completed) {
                containerClass += ' bg-green-50 border-green-200';
                statusIndicator = '<span class="text-xs text-green-600 font-medium">✓ Completed</span>';
            } else if (isOverdue) {
                containerClass += ' bg-red-50 border-red-300';
                statusIndicator = '<span class="text-xs text-red-600 font-medium">⚠ Overdue</span>';
            } else if (isDueToday) {
                containerClass += ' bg-yellow-50 border-yellow-300';
                statusIndicator = '<span class="text-xs text-yellow-600 font-medium">Due Today</span>';
            } else if (isDueSoon) {
                containerClass += ' bg-blue-50 border-blue-200';
                statusIndicator = '<span class="text-xs text-blue-600 font-medium">Due Soon</span>';
            } else {
                containerClass += ' bg-gray-50';
            }
            
            taskElement.className = containerClass;
            
            const dueDateFormatted = new Date(task.due_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            // Remove checkbox for students - display only
            taskElement.innerHTML = `
                <div class="flex-shrink-0 mt-1">
                    ${completed ? 
                        '<i class="fas fa-check-circle text-green-600 text-xl"></i>' : 
                        '<i class="fas fa-clock text-gray-400 text-xl"></i>'
                    }
                </div>
                <div class="flex-1">
                    <h4 class="font-semibold ${completed ? 'line-through text-gray-500' : isOverdue ? 'text-red-700' : ''}">${task.title}</h4>
                    <p class="text-gray-600 text-sm ${completed ? 'line-through' : isOverdue ? 'text-red-600' : ''}">${task.description}</p>
                    <p class="text-xs ${isOverdue ? 'text-red-500 font-medium' : isDueToday ? 'text-yellow-600 font-medium' : 'text-gray-400'}">
                        Due: ${dueDateFormatted}
                        ${isOverdue ? ' (OVERDUE)' : isDueToday ? ' (TODAY)' : ''}
                    </p>
                    ${statusIndicator}
                    ${isOverdue ? '<p class="text-xs text-red-500 mt-1 italic">This task is overdue</p>' : ''}
                </div>
            `;
            fragment.appendChild(taskElement);
        });

        tasksContainer.appendChild(fragment);
        
    } catch (error) {
        console.error('Error loading tasks:', error);
        tasksContainer.innerHTML = '<p class="text-red-500">Error loading tasks.</p>';
    }
}


async function submitTasks() {
    const submitBtn = event.target;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Updating...';
    submitBtn.disabled = true;

    try {
        // Get selected tasks first - only non-disabled checkboxes
        const selectedTasks = [];
        const overdueTasksSelected = [];
        
        document.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            if (checkbox.disabled && !checkbox.id.includes('completed')) {
                // Skip disabled overdue tasks
                const taskId = checkbox.id.replace('task-', '');
                overdueTasksSelected.push(taskId);
                return;
            }
            
            if (!checkbox.disabled) {
                const taskId = checkbox.id.replace('task-', '');
                selectedTasks.push(taskId);
            }
        });

        // Show warning if user tried to select overdue tasks
        if (overdueTasksSelected.length > 0) {
            alert(`Warning: ${overdueTasksSelected.length} overdue task(s) cannot be submitted. Only current tasks will be processed.`);
        }

        if (selectedTasks.length === 0) {
            alert('No valid tasks were selected for submission.');
            return;
        }

        const [tasks, progress] = await Promise.all([
            api.getSheet("tasks_master"),
            api.getSheet(`${currentUser.username}_progress`)
        ]);
        
        // Additional validation: Check if selected tasks are actually not overdue
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const validTasks = [];
        const invalidTasks = [];
        
        for (let taskId of selectedTasks) {
            const task = tasks.find(t => String(t.task_id) === String(taskId));
            if (task) {
                const dueDate = new Date(task.due_date);
                dueDate.setHours(23, 59, 59, 999);
                
                if (dueDate >= today) {
                    validTasks.push(taskId);
                } else {
                    invalidTasks.push(taskId);
                }
            }
        }

        if (invalidTasks.length > 0) {
            alert(`Error: ${invalidTasks.length} task(s) are overdue and cannot be submitted. Please refresh the page.`);
            await loadTasks(); // Refresh the task list
            return;
        }

        const promises = [];
        let updatedCount = 0;

        for (let taskId of validTasks) {
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

async function checkOverdueTasks() {
    try {
        const [tasks, progress] = await Promise.all([
            api.getSheet("tasks_master"),
            api.getSheet(`${currentUser.username}_progress`)
        ]);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const overdueTasks = tasks.filter(task => {
            const completed = progress.find(p => 
                String(p.item_id) === String(task.task_id) && 
                p.item_type === "task" && 
                p.status === "complete"
            );
            
            if (completed) return false;
            
            const dueDate = new Date(task.due_date);
            dueDate.setHours(23, 59, 59, 999);
            return dueDate < today;
        });
        
        if (overdueTasks.length > 0) {
            // Show notification for overdue tasks
            showOverdueNotification(overdueTasks.length);
        }
        
        return overdueTasks;
    } catch (error) {
        console.error('Error checking overdue tasks:', error);
        return [];
    }
}

function showOverdueNotification(count) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-20 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 animate-bounce';
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-exclamation-triangle mr-2"></i>
            <span>You have ${count} overdue task${count > 1 ? 's' : ''}!</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-3 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function showOverdueTasksSummary() {
    const overdueCheckboxes = document.querySelectorAll('input[type="checkbox"]:disabled:not(:checked)');
    const overdueCount = Array.from(overdueCheckboxes).filter(checkbox => 
        checkbox.title && checkbox.title.includes('overdue')
    ).length;
    
    if (overdueCount > 0) {
        const summaryDiv = document.createElement('div');
        const tasksContainer = document.getElementById('tasksList');
        tasksContainer.parentNode.insertBefore(summaryDiv, tasksContainer);
    }
}

// =============================
// 📚 Optimized Courses
// =============================
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

        // Add video courses
        videoCourses.forEach(videoCourse => {
            const userCourse = progress.find(p => 
                String(p.item_id) === String(videoCourse.course_id) && 
                p.item_type === "course" && 
                p.status === "complete"
            );
            const completed = !!userCourse;

            const courseElement = document.createElement('div');
            courseElement.className = `bg-gray-50 rounded-lg p-6 hover:shadow-md transition duration-300 ${completed ? 'opacity-75' : 'cursor-pointer'}`;
            
            if (!completed) {
                courseElement.onclick = () => openVideoCourse(videoCourse);
            }

            courseElement.innerHTML = `
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-lg font-semibold ${completed ? 'text-gray-500 line-through' : 'text-green-600'}">${videoCourse.title}</h3>
                    ${completed ? 
                        '<i class="fas fa-check-circle text-green-600 text-xl"></i>' : 
                        '<i class="fas fa-play-circle text-gray-400"></i>'
                    }
                </div>
                <p class="text-gray-600 text-sm ${completed ? 'line-through' : ''}">${videoCourse.description}</p>
                <div class="mt-4 text-sm ${completed ? 'text-green-600' : 'text-gray-500'}">
                    <i class="fas fa-video mr-1"></i>
                    ${completed ? '✓ Completed Course' : 'Video Course Collection'}
                </div>
            `;
            fragment.appendChild(courseElement);
        });

        // Add quiz courses at the bottom
        quizCourses.forEach(quizCourse => {
            const userCourse = progress.find(p => 
                String(p.item_id) === String(quizCourse.course_id) && 
                p.item_type === "course" && 
                p.status === "complete"
            );
            const completed = !!userCourse;

            const courseElement = document.createElement('div');
            courseElement.className = `bg-blue-50 rounded-lg p-6 hover:shadow-md transition duration-300 border-2 border-blue-200 ${completed ? 'opacity-75' : 'cursor-pointer'}`;
            
            if (!completed) {
                courseElement.onclick = () => openQuizCourse(quizCourse);
            }

            courseElement.innerHTML = `
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-lg font-semibold ${completed ? 'text-gray-500 line-through' : 'text-blue-600'}">${quizCourse.title}</h3>
                    ${completed ? 
                        '<i class="fas fa-check-circle text-blue-600 text-xl"></i>' : 
                        '<i class="fas fa-question-circle text-blue-400"></i>'
                    }
                </div>
                <p class="text-gray-600 text-sm ${completed ? 'line-through' : ''}">${quizCourse.description}</p>
                <div class="mt-4 text-sm ${completed ? 'text-blue-600' : 'text-blue-500'}">
                    <i class="fas fa-clipboard-question mr-1"></i>
                    ${completed ? '✓ Quiz Completed' : 'Interactive Quiz Course'}
                </div>
            `;
            fragment.appendChild(courseElement);
        });

        if (fragment.children.length === 0) {
            container.innerHTML = '<p class="text-gray-500 col-span-3">No courses found.</p>';
        } else {
            container.appendChild(fragment);
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        container.innerHTML = '<p class="text-red-500 col-span-3">Error loading courses.</p>';
    }
}

// Add video courses data
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
            },
            {
                title: 'Video 3',
                url: 'https://www.youtube.com/embed/VIDEO_ID_3'
            },
            {
                title: 'Video 4',
                url: 'https://www.youtube.com/embed/VIDEO_ID_4'
            },
            {
                title: 'Video 5',
                url: 'https://www.youtube.com/embed/VIDEO_ID_5'
            }
        ]
    },
    {
        course_id: 'video_course_2',
        title: 'Course Videos - Set 2',
        description: 'Islamic learning videos collection - Part 2',
        videos: [
            {
                title: 'Video 1',
                url: 'https://www.youtube.com/embed/VIDEO_ID_6'
            },
            {
                title: 'Video 2',
                url: 'https://www.youtube.com/embed/VIDEO_ID_7'
            },
            {
                title: 'Video 3',
                url: 'https://www.youtube.com/embed/VIDEO_ID_8'
            },
            {
                title: 'Video 4',
                url: 'https://www.youtube.com/embed/VIDEO_ID_9'
            },
            {
                title: 'Video 5',
                url: 'https://www.youtube.com/embed/VIDEO_ID_10'
            }
        ]
    }
];

// Add quiz courses data after videoCourses array
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
            },
            {
                question: "Which month is the holy month of fasting?",
                options: ["Ramadan", "Shawwal", "Muharram"],
                correct: 0
            },
            {
                question: "What is the direction Muslims face when praying?",
                options: ["East", "West", "Qibla"],
                correct: 2
            },
            {
                question: "What is the holy book of Islam?",
                options: ["Torah", "Quran", "Bible"],
                correct: 1
            }
        ]
    },
    {
        course_id: 'quiz_course_2',
        title: 'Course Practical - 2',
        description: 'Islamic knowledge quiz - Assessment 2',
        questions: [
            {
                question: "Who is the last Prophet of Islam?",
                options: ["Prophet Isa", "Prophet Muhammad", "Prophet Musa"],
                correct: 1
            },
            {
                question: "What does 'Hajj' refer to?",
                options: ["Daily prayer", "Pilgrimage to Mecca", "Charity"],
                correct: 1
            },
            {
                question: "In which city is the Kaaba located?",
                options: ["Medina", "Mecca", "Jerusalem"],
                correct: 1
            },
            {
                question: "What is 'Zakat'?",
                options: ["Fasting", "Prayer", "Charitable giving"],
                correct: 2
            },
            {
                question: "How many chapters (Surahs) are in the Quran?",
                options: ["114", "110", "120"],
                correct: 0
            }
        ]
    }
];

// Add quiz-related variables after existing global variables
let currentQuiz = null;
let currentQuizStep = 0;
let quizAnswers = [];

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
    
    // Handle video courses
    if (currentCourse.videos) {
        loadVideoStep();
        return;
    }
    
    // Rest of the existing function remains the same
    const content = document.getElementById('courseContent');
    const stepIndicator = document.getElementById('stepIndicator');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    // Get the current step content from the course data
    const stepKey = `step${currentStep + 1}`;
    const stepContent = currentCourse[stepKey] || `Step ${currentStep + 1} content`;
    
    content.innerHTML = `
        <div class="bg-green-50 p-4 sm:p-6 rounded-lg overflow-hidden">
            <h4 class="font-semibold text-green-600 mb-3 text-base sm:text-lg break-words">Step ${currentStep + 1}: ${currentCourse.title}</h4>
            <div class="text-gray-700 leading-relaxed mb-4 overflow-hidden">
                <p class="whitespace-pre-wrap break-words text-sm sm:text-base">${stepContent}</p>
            </div>
            
        </div>
    `;
    
    const totalSteps = 5;
    stepIndicator.textContent = `Step ${currentStep + 1} of ${totalSteps}`;

    prevBtn.disabled = currentStep === 0;
    prevBtn.className = `px-3 sm:px-4 py-2 rounded transition duration-300 text-sm sm:text-base ${currentStep === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}`;
    
    if (currentStep === totalSteps - 1) {
        nextBtn.innerHTML = 'Complete<i class="fas fa-check ml-1 sm:ml-2"></i>';
        nextBtn.onclick = completeCourse;
    } else {
        nextBtn.innerHTML = 'Next<i class="fas fa-chevron-right ml-1 sm:ml-2"></i>';
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
        if (currentQuiz && currentQuiz.questions) {
            loadQuizStep();
        } else if (currentCourse && currentCourse.videos) {
            loadVideoStep();
        } else {
            loadCourseStep();
        }
    }
}

async function completeCourse() {
    const completeBtn = document.getElementById('nextBtn');
    const originalText = completeBtn.innerHTML;
    completeBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Completing...';
    completeBtn.disabled = true;

    try {
        const [courses, progress] = await Promise.all([
            api.getSheet("courses_master"),
            api.getSheet(`${currentUser.username}_progress`)
        ]);
        
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
        console.log('Course completion result:', result);

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

async function openVideoCourse(videoCourse) {
    try {
        // Check if course is already completed
        const progress = await api.getSheet(`${currentUser.username}_progress`);
        const isCompleted = progress.find(p => 
            String(p.item_id) === String(videoCourse.course_id) && 
            p.item_type === "course" && 
            p.status === "complete"
        );
        
        if (isCompleted) {
            alert('This course is already completed!');
            return;
        }
        
        currentCourse = videoCourse;
        currentStep = 0;
        document.getElementById('courseTitle').textContent = videoCourse.title;
        document.getElementById('courseModal').classList.remove('hidden');
        loadVideoStep();
    } catch (error) {
        console.error('Error opening video course:', error);
        alert('Error loading course. Please try again.');
    }
}

function loadVideoStep() {
    if (!currentCourse || !currentCourse.videos) return;
    const content = document.getElementById('courseContent');
    const stepIndicator = document.getElementById('stepIndicator');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    const currentVideo = currentCourse.videos[currentStep];
    
    content.innerHTML = `
        <div class="bg-green-50 p-4 sm:p-6 rounded-lg overflow-hidden">
            <h4 class="font-semibold text-green-600 mb-3 text-base sm:text-lg break-words">${currentVideo.title}</h4>
            <div class="video-container mb-4" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
                <iframe 
                    src="${currentVideo.url}" 
                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
                    frameborder="0" 
                    allowfullscreen>
                </iframe>
            </div>
        </div>
    `;
    
    const totalVideos = currentCourse.videos.length;
    stepIndicator.textContent = `Video ${currentStep + 1} of ${totalVideos}`;

    prevBtn.disabled = currentStep === 0;
    prevBtn.className = `px-3 sm:px-4 py-2 rounded transition duration-300 text-sm sm:text-base ${currentStep === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}`;
    
    if (currentStep === totalVideos - 1) {
        nextBtn.innerHTML = 'Complete<i class="fas fa-check ml-1 sm:ml-2"></i>';
        nextBtn.onclick = completeVideoCourse;
    } else {
        nextBtn.innerHTML = 'Next<i class="fas fa-chevron-right ml-1 sm:ml-2"></i>';
        nextBtn.onclick = nextVideoStep;
    }
}

function nextVideoStep() {
    const totalVideos = currentCourse.videos.length;
    if (currentStep < totalVideos - 1) {
        currentStep++;
        loadVideoStep();
    }
}

function prevVideoStep() {
    if (currentStep > 0) {
        currentStep--;
        loadVideoStep();
    }
}

async function completeVideoCourse() {
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
        console.log('Video course completion result:', result);

        if (result && (result.success || result.includes?.('Success'))) {
            alert('Congratulations! Video course completed successfully!');
            closeCourseModal();
            await loadCourses();
            if (currentPage === 'status') {
                await loadStatusCharts();
            }
        } else {
            throw new Error(result?.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Error completing video course:', error);
        alert('Error completing course: ' + error.message);
    } finally {
        completeBtn.innerHTML = originalText;
        completeBtn.disabled = false;
    }
}

async function openQuizCourse(quizCourse) {
    try {
        // Check if course is already completed
        const progress = await api.getSheet(`${currentUser.username}_progress`);
        const isCompleted = progress.find(p => 
            String(p.item_id) === String(quizCourse.course_id) && 
            p.item_type === "course" && 
            p.status === "complete"
        );
        
        if (isCompleted) {
            alert('This quiz is already completed!');
            return;
        }
        
        currentQuiz = quizCourse;
        currentQuizStep = 0;
        quizAnswers = [];
        document.getElementById('courseTitle').textContent = quizCourse.title;
        document.getElementById('courseModal').classList.remove('hidden');
        loadQuizStep();
    } catch (error) {
        console.error('Error opening quiz course:', error);
        alert('Error loading quiz. Please try again.');
    }
}

function loadQuizStep() {
    if (!currentQuiz || !currentQuiz.questions) return;
    
    const content = document.getElementById('courseContent');
    const stepIndicator = document.getElementById('stepIndicator');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    const currentQuestion = currentQuiz.questions[currentQuizStep];
    const selectedAnswer = quizAnswers[currentQuizStep];
    
    content.innerHTML = `
        <div class="bg-blue-50 p-4 sm:p-6 rounded-lg overflow-hidden">
            <h4 class="font-semibold text-blue-600 mb-4 text-base sm:text-lg break-words">${currentQuiz.title} - Question ${currentQuizStep + 1}</h4>
            <div class="mb-6">
                <h5 class="text-gray-800 font-medium mb-4 text-sm sm:text-base">${currentQuestion.question}</h5>
                <div class="space-y-3">
                    ${currentQuestion.options.map((option, index) => `
                        <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-blue-100 transition-colors ${selectedAnswer === index ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}">
                            <input type="radio" name="quizAnswer" value="${index}" 
                                   ${selectedAnswer === index ? 'checked' : ''}
                                   onchange="selectQuizAnswer(${index})"
                                   class="mr-3 text-blue-600">
                            <span class="text-gray-700 text-sm sm:text-base">${option}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    const totalQuestions = currentQuiz.questions.length;
    stepIndicator.textContent = `Question ${currentQuizStep + 1} of ${totalQuestions}`;

    prevBtn.disabled = currentQuizStep === 0;
    prevBtn.className = `px-3 sm:px-4 py-2 rounded transition duration-300 text-sm sm:text-base ${currentQuizStep === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}`;
    
    if (currentQuizStep === totalQuestions - 1) {
        nextBtn.innerHTML = 'Submit Quiz<i class="fas fa-check ml-1 sm:ml-2"></i>';
        nextBtn.onclick = submitQuiz;
        nextBtn.disabled = selectedAnswer === undefined;
        nextBtn.className = `px-3 sm:px-4 py-2 rounded transition duration-300 text-sm sm:text-base ${selectedAnswer === undefined ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`;
    } else {
        nextBtn.innerHTML = 'Next<i class="fas fa-chevron-right ml-1 sm:ml-2"></i>';
        nextBtn.onclick = nextQuizStep;
        nextBtn.disabled = selectedAnswer === undefined;
        nextBtn.className = `px-3 sm:px-4 py-2 rounded transition duration-300 text-sm sm:text-base ${selectedAnswer === undefined ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`;
    }
}

function selectQuizAnswer(answerIndex) {
    quizAnswers[currentQuizStep] = answerIndex;
    // Refresh the step to update button states
    loadQuizStep();
}

function nextQuizStep() {
    const totalQuestions = currentQuiz.questions.length;
    if (currentQuizStep < totalQuestions - 1 && quizAnswers[currentQuizStep] !== undefined) {
        currentQuizStep++;
        loadQuizStep();
    }
}

function prevQuizStep() {
    if (currentQuizStep > 0) {
        currentQuizStep--;
        loadQuizStep();
    }
}

async function submitQuiz() {
    const submitBtn = document.getElementById('nextBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Submitting...';
    submitBtn.disabled = true;

    try {
        const progress = await api.getSheet(`${currentUser.username}_progress`);
        
        // Check if quiz is already completed
        const existingQuiz = progress.find(p => 
            String(p.item_id) === String(currentQuiz.course_id) && 
            p.item_type === "course" && 
            p.status === "complete"
        );
        
        if (existingQuiz) {
            alert('This quiz is already completed!');
            closeCourseModal();
            return;
        }

        // Calculate score
        let correctAnswers = 0;
        currentQuiz.questions.forEach((question, index) => {
            if (quizAnswers[index] === question.correct) {
                correctAnswers++;
            }
        });
        
        const score = Math.round((correctAnswers / currentQuiz.questions.length) * 100);
        
        // Save to progress sheet
        const progressSheetName = `${currentUser.username}_progress`;
        const rowData = [
            currentQuiz.course_id,
            "course",
            "complete",
            new Date().toISOString().split('T')[0],
            score.toString()
        ];
        
        const result = await api.addRow(progressSheetName, rowData);
        console.log('Quiz completion result:', result);

        if (result && (result.success || result.includes?.('Success'))) {
            alert(`Quiz completed! Your score: ${correctAnswers}/${currentQuiz.questions.length} (${score}%)`);
            closeCourseModal();
            await loadCourses();
            if (currentPage === 'status') {
                await loadStatusCharts();
            }
        } else {
            throw new Error(result?.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Error submitting quiz:', error);
        alert('Error submitting quiz: ' + error.message);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// =============================
// 📅 Optimized Events
// =============================
async function loadEvents() {
    try {
        window.eventsData = await api.getSheet("events_master");
        console.log('Events loaded:', window.eventsData);
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
        dayHeader.className = 'text-center font-semibold text-gray-600 py-2 text-xs sm:text-sm';
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
        dayElement.className = 'calendar-day p-1 sm:p-2 text-xs sm:text-sm';

        if (day.getMonth() !== currentDate.getMonth()) {
            dayElement.classList.add('text-gray-300', 'bg-gray-50');
        } else {
            dayElement.classList.add('hover:bg-green-50');
        }

        const dayEvents = events.filter(event => {
            if (!event.date) return false;
            const eventDate = new Date(event.date);
            return eventDate.toDateString() === day.toDateString();
        });

        // Make entire day cell clickable if it has events
        if (dayEvents.length > 0) {
            dayElement.style.cursor = 'pointer';
            dayElement.onclick = () => openEventModal(day.toISOString().split('T')[0]);
        }

        dayElement.innerHTML = `
            <div class="font-medium">${day.getDate()}</div>
            ${dayEvents.length > 0 ? `
                <div class="event-indicator ${dayEvents.length > 1 ? 'multiple' : ''}" 
                     title="${dayEvents.length} event(s)">
                </div>
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
                <div class="bg-green-50 p-3 rounded-lg">
                    <h4 class="font-semibold text-green-800 mb-2">Description</h4>
                    <p class="text-gray-700">${event.description}</p>
                </div>
            ` : ''}
            ${event.place ? `
                <div class="flex items-start space-x-2">
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

// Add click outside to close modal
document.getElementById('eventModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeEventModal();
    }
});

// =============================
// 📊 Optimized Charts & Progress
// =============================
async function loadStatusCharts() {
    const progressSheetName = `${currentUser.username}_progress`;
    const progress = await api.getSheet(progressSheetName);
    
    await Promise.all([
        loadTaskChart(progress),
        loadCourseChart(progress),
        loadActivityChart(progress),
        updateProgressBars(progress)
    ]);
}

async function loadTaskChart(progress) {
    const tasks = await api.getSheet("tasks_master");
    const completedTasks = progress.filter(p => p.item_type === "task" && p.status === "complete").length;
    const totalTasks = tasks.length;
    const pendingTasks = totalTasks - completedTasks;

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
}

async function loadCourseChart(progress) {
    const courses = await api.getSheet("courses_master");
    
    // Calculate total courses including video courses and quiz courses
    const totalRegularCourses = courses && Array.isArray(courses) ? courses.length : 0;
    const totalVideoCourses = videoCourses.length;
    const totalQuizCourses = quizCourses.length;
    const totalCourses = totalRegularCourses + totalVideoCourses + totalQuizCourses;
    
    // Calculate completed courses (regular, video, and quiz)
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
}

async function loadActivityChart(progress) {
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
        const dayCompletions = progress.filter(p => {
            if (!p.completion_date) return false;
            const completionDate = new Date(p.completion_date);
            return completionDate >= currentDay && completionDate < nextDay && p.status === "complete";
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
}

async function updateProgressBars(progress) {
    try {
        const [tasks, courses] = await Promise.all([
            api.getSheet("tasks_master"),
            api.getSheet("courses_master")
        ]);
        
        // Ensure progress is an array
        const progressArray = Array.isArray(progress) ? progress : [];
        
        // Tasks progress
        const completedTasks = progressArray.filter(p => p.item_type === "task" && p.status === "complete").length;
        const totalTasks = Array.isArray(tasks) ? tasks.length : 0;
        const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        document.getElementById('taskProgress').textContent = `${taskProgress}%`;
        document.getElementById('taskProgressBar').style.width = `${taskProgress}%`;

        // Courses progress (including video courses and quiz courses)
        const totalRegularCourses = Array.isArray(courses) ? courses.length : 0;
        const totalVideoCourses = videoCourses.length;
        const totalQuizCourses = quizCourses.length;
        const totalCourses = totalRegularCourses + totalVideoCourses + totalQuizCourses;
        
        const completedCourses = progressArray.filter(p => p.item_type === "course" && p.status === "complete").length;
        const courseProgress = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;
        
        document.getElementById('courseProgressText').textContent = `${courseProgress}%`;
        document.getElementById('courseProgressBar').style.width = `${courseProgress}%`;

        // Events progress (placeholder)
        const eventProgress = 40;
        document.getElementById('eventProgress').textContent = `${eventProgress}%`;
        document.getElementById('eventProgressBar').style.width = `${eventProgress}%`;
        
    } catch (error) {
        console.error('Error updating progress bars:', error);
    }
}

// =============================
// 🎯 Event Listeners
// =============================
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    login();
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
    }, 250);
});

// Expose functions for debugging
window.hudaAcademy = {
    login,
    logout,
    showPage,
    submitTasks,
    openCourse,
    completeCourse,
    clearCache: () => api.clearCache()
};

// =============================
// 📅 Time Table Functions
// =============================
async function loadTimeTable() {
    try {
        const scheduleSheetName = `${currentUser.username}_schedule`;
        console.log('Loading schedule for:', scheduleSheetName);
        const schedule = await api.getSheet(scheduleSheetName);
        console.log('Schedule data received:', schedule);
        
        const timetableBody = document.getElementById('timetableBody');
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
                
                periodCell.className = `border border-gray-300 p-1 timetable-cell text-center text-xs sm:text-sm ${getSubjectClass(subject)}`;
                
                if (period === 6) { // Break period
                    periodCell.className += ' bg-orange-100 font-medium';
                }

                periodCell.innerHTML = `
                    <div class="font-medium">${subject}</div>
                    ${getSubjectIcon(subject)}
                `;
                
                row.appendChild(periodCell);
            }

            fragment.appendChild(row);
        });

        timetableBody.appendChild(fragment);
    } catch (error) {
        console.error('Error loading timetable:', error);
        document.getElementById('timetableBody').innerHTML = `
            <tr>
                <td colspan="11" class="text-center py-8 text-red-500">
                    Error loading timetable: ${error.message}<br>
                    Please check console for details.
                </td>
            </tr>
        `;
    }
}

function getSubjectClass(subject) {
    if (!subject) return 'subject-free';
    const subjectLower = subject.toLowerCase();
    
    // Handle abbreviated and full subject names
    if (subjectLower.includes('qura') || subjectLower.includes('quran') || subjectLower.includes('islamic') || 
        subjectLower.includes('hadith') || subjectLower.includes('fiqh') || subjectLower.includes('isl')) {
        return 'subject-islamic';
    } else if (subjectLower.includes('arb') || subjectLower.includes('arabic') || 
               subjectLower.includes('eng') || subjectLower.includes('english') || 
               subjectLower.includes('language')) {
        return 'subject-language';
    } else if (subjectLower.includes('mth') || subjectLower.includes('math') || 
               subjectLower.includes('sci') || subjectLower.includes('science') || 
               subjectLower.includes('computer') || subjectLower.includes('cop')) {
        return 'subject-science';
    } else if (subjectLower.includes('break') || subjectLower.includes('lunch') || 
               subjectLower.includes('prayer') || subjectLower.includes('rest')) {
        return 'subject-break';
    } else if (subjectLower.includes('free') || subjectLower.includes('study')) {
        return 'subject-free';
    } else if (subjectLower.includes('hds') || subjectLower.includes('history')) {
        return 'subject-science';
    } else if (subjectLower.includes('eco') || subjectLower.includes('economy')) {
        return 'subject-science';
    }
    return 'subject-free';
}

function getSubjectIcon(subject) {
    if (!subject) return '<i class="fas fa-book text-xs opacity-60"></i>';
    const subjectLower = subject.toLowerCase();
    
    // Handle abbreviated and full subject names
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
    }
    return '<i class="fas fa-book text-xs opacity-60"></i>';
}

// =============================
// 🔗 URL Hash Navigation for Signup
// =============================
// Function to handle URL hash changes
function handleHashNavigation() {
    const hash = window.location.hash;
    
    if (hash === '#signup') {
        // Only show signup if we're on the login page
        if (!document.getElementById('loginPage').classList.contains('hidden')) {
            showSignup();
        }
    } else if (hash === '#login') {
        // Show login form
        if (!document.getElementById('loginPage').classList.contains('hidden')) {
            showLogin();
        }
    }
}

// Function to update URL hash when switching forms
function updateUrlHash(section) {
    if (section === 'signup') {
        window.history.pushState(null, null, '#signup');
    } else if (section === 'login') {
        window.history.pushState(null, null, '#login');
    } else {
        // Clear hash for main sections
        window.history.pushState(null, null, window.location.pathname);
    }
}

// Listen for hash changes (when user uses browser back/forward)
window.addEventListener('hashchange', handleHashNavigation);

// Handle initial page load with hash
window.addEventListener('load', handleHashNavigation);

// Also call it when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    loadCalendar();
    
    // Add signup form event listener
    document.getElementById('signupForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitSignup();
    });
    
    // Handle initial hash navigation
    handleHashNavigation();
});

// =============================
// 👨‍💼 Admin Functions
// =============================

async function loadAdminData() {
    try {
        await Promise.all([
            loadAdminUsers(),
            loadAdminResponse(),  // ADD THIS LINE
            loadAdminEvents(),
            loadAdminTasks(),
            loadAdminCourses()
        ]);
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

// Admin Users Management
async function loadAdminUsers() {
    const container = document.getElementById('usersList');
    container.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading users...</div>';

    try {
        const users = await api.getSheet("user_credentials");
        
        if (!users || users.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No users found.</p>';
            return;
        }

        container.innerHTML = `
            <table class="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${users.map(user => `
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.username}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.full_name || 'N/A'}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
                                    ${user.role || 'student'}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <button onclick="editUser('${user.username}')" class="text-blue-600 hover:text-blue-900 mr-3">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button onclick="deleteUser('${user.username}')" class="text-red-600 hover:text-red-900">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading users:', error);
        container.innerHTML = '<p class="text-red-500">Error loading users.</p>';
    }
}

// Admin Events Management
async function loadAdminEvents() {
    const container = document.getElementById('adminEventsList');
    container.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading events...</div>';

    try {
        const events = await api.getSheet("events_master");
        
        if (!events || events.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No events found.</p>';
            return;
        }

        container.innerHTML = events.map(event => `
            <div class="bg-gray-50 rounded-lg p-4 flex justify-between items-start">
                <div class="flex-1">
                    <h4 class="font-semibold text-gray-800">${event.title || 'Untitled Event'}</h4>
                    <p class="text-sm text-gray-600">${event.description || 'No description'}</p>
                    <div class="mt-2 space-y-1">
                        <p class="text-xs text-gray-500"><i class="fas fa-calendar mr-1"></i>${new Date(event.date).toLocaleDateString()}</p>
                        ${event.time ? `<p class="text-xs text-gray-500"><i class="fas fa-clock mr-1"></i>${event.time}</p>` : ''}
                        ${event.place ? `<p class="text-xs text-gray-500"><i class="fas fa-map-marker-alt mr-1"></i>${event.place}</p>` : ''}
                    </div>
                </div>
                <div class="flex space-x-2 ml-4">
                    <button onclick="editEvent('${event.event_id || event.title}')" class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteEvent('${event.event_id || event.title}')" class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading events:', error);
        container.innerHTML = '<p class="text-red-500">Error loading events.</p>';
    }
}

// Admin Tasks Management
async function loadAdminTasks() {
    const container = document.getElementById('adminTasksList');
    container.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading tasks...</div>';

    try {
        const tasks = await api.getSheet("tasks_master");
        
        if (!tasks || tasks.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No tasks found.</p>';
            return;
        }

        container.innerHTML = tasks.map(task => `
            <div class="bg-gray-50 rounded-lg p-4 flex justify-between items-start">
                <div class="flex-1">
                    <h4 class="font-semibold text-gray-800">${task.title}</h4>
                    <p class="text-sm text-gray-600">${task.description}</p>
                    <div class="mt-2">
                        <p class="text-xs text-gray-500"><i class="fas fa-calendar-alt mr-1"></i>Due: ${new Date(task.due_date).toLocaleDateString()}</p>
                        <p class="text-xs text-gray-500"><i class="fas fa-tag mr-1"></i>ID: ${task.task_id}</p>
                    </div>
                </div>
                <div class="flex space-x-2 ml-4">
                    <button onclick="editTask('${task.task_id}')" class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteTask('${task.task_id}')" class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading tasks:', error);
        container.innerHTML = '<p class="text-red-500">Error loading tasks.</p>';
    }
}

// Admin Courses Management
async function loadAdminCourses() {
    const container = document.getElementById('adminCoursesList');
    container.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading courses...</div>';

    try {
        const courses = await api.getSheet("courses_master");
        
        if (!courses || courses.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No courses found.</p>';
            return;
        }

        container.innerHTML = courses.map(course => `
            <div class="bg-gray-50 rounded-lg p-4 flex justify-between items-start">
                <div class="flex-1">
                    <h4 class="font-semibold text-gray-800">${course.title}</h4>
                    <p class="text-sm text-gray-600">${course.description}</p>
                    <p class="text-xs text-gray-500 mt-2"><i class="fas fa-tag mr-1"></i>ID: ${course.course_id}</p>
                </div>
                <div class="flex space-x-2 ml-4">
                    <button onclick="editCourse('${course.course_id}')" class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteCourse('${course.course_id}')" class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading courses:', error);
        container.innerHTML = '<p class="text-red-500">Error loading courses.</p>';
    }
}

// Admin Response Management
async function loadAdminResponse() {
    const container = document.getElementById('responsesList');
    container.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading responses...</div>';

    try {
        const responses = await api.getSheet("registration");
        
        if (!responses || responses.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No responses found.</p>';
            document.getElementById('responseCount').textContent = '0';
            return;
        }

        document.getElementById('responseCount').textContent = responses.length;

        // Create responsive table and cards
        container.innerHTML = `
            <!-- Desktop Table View -->
            <div class="response-table">
                <table class="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.No</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gmail</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pin Code</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${responses.map((response, index) => {
                            // Handle both array format and object format
                            let name, phone, gmail, state, district, place, po, pinCode, regDate;
                            
                            if (Array.isArray(response)) {
                                [name, phone, gmail, state, district, place, po, pinCode, regDate] = response;
                            } else {
                                // Object format
                                name = response.name || response.full_name || '';
                                phone = response.phone || response.phone_number || '';
                                gmail = response.gmail || response.email || '';
                                state = response.state || '';
                                district = response.district || '';
                                place = response.place || '';
                                po = response.po || response.post_office || '';
                                pinCode = response.pin_code || response.pinCode || '';
                                regDate = response.registration_date || response.date || '';
                            }

                            const location = `${place || ''}, ${district || ''}, ${state || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',');
                            const formattedDate = regDate ? new Date(regDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            }) : 'N/A';

                            return `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${index + 1}</td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${name || 'N/A'}</td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <a href="tel:${phone}" class="text-blue-600 hover:text-blue-800">${phone || 'N/A'}</a>
                                    </td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        ${gmail ? `<a href="mailto:${gmail}" class="text-blue-600 hover:text-blue-800">${gmail}</a>` : 'N/A'}
                                    </td>
                                    <td class="px-4 py-4 text-sm text-gray-900">${location || 'N/A'}</td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${pinCode || 'N/A'}</td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${formattedDate}</td>
                                    <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <button onclick="viewResponseDetails(${index})" class="text-blue-600 hover:text-blue-900 mr-3" title="View Details">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button onclick="contactApplicant('${phone}', '${gmail}')" class="text-green-600 hover:text-green-900" title="Contact">
                                            <i class="fas fa-phone"></i>
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Mobile Cards View -->
            <div class="response-cards">
                ${responses.map((response, index) => {
                    // Handle both array format and object format
                    let name, phone, gmail, state, district, place, po, pinCode, regDate;
                    
                    if (Array.isArray(response)) {
                        [name, phone, gmail, state, district, place, po, pinCode, regDate] = response;
                    } else {
                        name = response.name || response.full_name || '';
                        phone = response.phone || response.phone_number || '';
                        gmail = response.gmail || response.email || '';
                        state = response.state || '';
                        district = response.district || '';
                        place = response.place || '';
                        po = response.po || response.post_office || '';
                        pinCode = response.pin_code || response.pinCode || '';
                        regDate = response.registration_date || response.date || '';
                    }

                    const formattedDate = regDate ? new Date(regDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    }) : 'N/A';

                    return `
                        <div class="response-card">
                            <div class="response-card-header">
                                <div class="flex justify-between items-center">
                                    <span>#${index + 1} - ${name || 'Unknown'}</span>
                                    <span class="status-badge status-new">
                                        <i class="fas fa-circle text-xs mr-1"></i>New
                                    </span>
                                </div>
                            </div>
                            <div class="response-card-body">
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div class="response-field">
                                        <div class="response-field-label">Phone Number</div>
                                        <div class="response-field-value">
                                            ${phone ? `<a href="tel:${phone}" class="text-blue-600">${phone}</a>` : 'N/A'}
                                        </div>
                                    </div>
                                    <div class="response-field">
                                        <div class="response-field-label">Email</div>
                                        <div class="response-field-value">
                                            ${gmail ? `<a href="mailto:${gmail}" class="text-blue-600">${gmail}</a>` : 'N/A'}
                                        </div>
                                    </div>
                                    <div class="response-field">
                                        <div class="response-field-label">State</div>
                                        <div class="response-field-value">${state || 'N/A'}</div>
                                    </div>
                                    <div class="response-field">
                                        <div class="response-field-label">District</div>
                                        <div class="response-field-value">${district || 'N/A'}</div>
                                    </div>
                                    <div class="response-field">
                                        <div class="response-field-label">Place</div>
                                        <div class="response-field-value">${place || 'N/A'}</div>
                                    </div>
                                    <div class="response-field">
                                        <div class="response-field-label">P.O</div>
                                        <div class="response-field-value">${po || 'N/A'}</div>
                                    </div>
                                    <div class="response-field">
                                        <div class="response-field-label">Pin Code</div>
                                        <div class="response-field-value">${pinCode || 'N/A'}</div>
                                    </div>
                                    <div class="response-field">
                                        <div class="response-field-label">Registration Date</div>
                                        <div class="response-field-value">${formattedDate}</div>
                                    </div>
                                </div>
                                <div class="mt-4 flex space-x-3">
                                    <button onclick="viewResponseDetails(${index})" class="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition duration-300">
                                        <i class="fas fa-eye mr-1"></i>View Details
                                    </button>
                                    <button onclick="contactApplicant('${phone}', '${gmail}')" class="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition duration-300">
                                        <i class="fas fa-phone mr-1"></i>Contact
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // Store responses data for detail view
        window.currentResponses = responses;

    } catch (error) {
        console.error('Error loading responses:', error);
        container.innerHTML = '<p class="text-red-500">Error loading responses.</p>';
        document.getElementById('responseCount').textContent = '0';
    }
}

// View response details function
function viewResponseDetails(index) {
    if (!window.currentResponses || !window.currentResponses[index]) {
        alert('Response data not found.');
        return;
    }

    const response = window.currentResponses[index];
    let name, phone, gmail, state, district, place, po, pinCode, regDate;
    
    if (Array.isArray(response)) {
        [name, phone, gmail, state, district, place, po, pinCode, regDate] = response;
    } else {
        name = response.name || response.full_name || '';
        phone = response.phone || response.phone_number || '';
        gmail = response.gmail || response.email || '';
        state = response.state || '';
        district = response.district || '';
        place = response.place || '';
        po = response.po || response.post_office || '';
        pinCode = response.pin_code || response.pinCode || '';
        regDate = response.registration_date || response.date || '';
    }

    const formattedDate = regDate ? new Date(regDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'N/A';

    alert(`Registration Details #${index + 1}

Full Name: ${name || 'N/A'}
Phone Number: ${phone || 'N/A'}
Email: ${gmail || 'N/A'}
State: ${state || 'N/A'}
District: ${district || 'N/A'}
Place: ${place || 'N/A'}
Post Office: ${po || 'N/A'}
Pin Code: ${pinCode || 'N/A'}
Registration Date: ${formattedDate}`);
}

// Contact applicant function
function contactApplicant(phone, gmail) {
    const options = [];
    if (phone && phone !== 'N/A') {
        options.push(`Call: ${phone}`);
    }
    if (gmail && gmail !== 'N/A') {
        options.push(`Email: ${gmail}`);
    }
    
    if (options.length === 0) {
        alert('No contact information available.');
        return;
    }
    
    const choice = confirm(`Contact this applicant?\n\n${options.join('\n')}\n\nClick OK to call, Cancel to email.`);
    
    if (choice && phone && phone !== 'N/A') {
        window.open(`tel:${phone}`);
    } else if (!choice && gmail && gmail !== 'N/A') {
        window.open(`mailto:${gmail}`);
    }
}


// Admin Status - All Users (FIXED VERSION)
async function loadAllUsersStatus() {
    console.log('Loading all users status page...');
    
    try {
        // Clear any existing charts first
        Object.values(adminChartInstances).forEach(chart => {
            if (chart) chart.destroy();
        });
        adminChartInstances = {};
        
        // Reset the display
        document.getElementById('selectedUserStatus').classList.add('hidden');
        document.getElementById('noUserSelected').classList.remove('hidden');
        
        // Clear and reset dropdown
        const userSelect = document.getElementById('userSelect');
        if (userSelect) {
            userSelect.innerHTML = '<option value="">-- Loading Users... --</option>';
            userSelect.value = '';
        }
        
        // Load users dropdown immediately
        await loadUsersDropdown();
        
    } catch (error) {
        console.error('Error in loadAllUsersStatus:', error);
        const userSelect = document.getElementById('userSelect');
        if (userSelect) {
            userSelect.innerHTML = '<option value="">-- Error Loading Users --</option>';
        }
    }
}

// Admin chart instances for user status
let adminChartInstances = {};

// Load users dropdown for admin status (FIXED VERSION)
async function loadUsersDropdown() {
    try {
        console.log('Loading users dropdown...');
        const users = await api.getSheet("user_credentials", false); // Force fresh data
        console.log('Raw users data:', users);
        
        const userSelect = document.getElementById('userSelect');
        
        if (!users || users.error || !Array.isArray(users) || users.length === 0) {
            console.log('No valid users data found');
            userSelect.innerHTML = '<option value="">-- No Users Found --</option>';
            return;
        }
        
        // Clear existing options
        userSelect.innerHTML = '<option value="">-- Select a User --</option>';
        
        // Add ALL users to dropdown (including admin for testing)
        users.forEach(user => {
            console.log('Processing user:', user);
            
            // Check if user has valid username
            if (user.username && user.username.trim()) {
                const username = user.username.trim();
                const role = (user.role || 'student').toLowerCase();
                const displayName = user.full_name || username;
                
                const option = document.createElement('option');
                option.value = username;
                option.textContent = `${displayName} (@${username}) - ${role}`;
                userSelect.appendChild(option);
                console.log('Added user to dropdown:', username);
            }
        });
        
        // Add event listener for user selection
        userSelect.onchange = handleUserSelection;
        
        console.log(`Loaded ${userSelect.options.length - 1} users in dropdown`);
        
    } catch (error) {
        console.error('Error loading users dropdown:', error);
        const userSelect = document.getElementById('userSelect');
        if (userSelect) {
            userSelect.innerHTML = '<option value="">-- Error Loading Users --</option>';
        }
    }
}

// Handle user selection from dropdown (FIXED VERSION)
function handleUserSelection(event) {
    const selectedUsername = event.target.value;
    console.log('User selected:', selectedUsername);
    
    const selectedUserStatus = document.getElementById('selectedUserStatus');
    const noUserSelected = document.getElementById('noUserSelected');
    
    if (!selectedUsername) {
        selectedUserStatus.classList.add('hidden');
        noUserSelected.classList.remove('hidden');
        
        // Clear any existing charts
        Object.values(adminChartInstances).forEach(chart => {
            if (chart) chart.destroy();
        });
        adminChartInstances = {};
        return;
    }
    
    noUserSelected.classList.add('hidden');
    selectedUserStatus.classList.remove('hidden');
    
    // Load the selected user's status
    loadSelectedUserStatus(selectedUsername);
}

// Load status for selected user (FIXED VERSION)
async function loadSelectedUserStatus(username) {
    try {
        console.log('Loading status for user:', username);
        
        // Show loading state
        document.getElementById('selectedUserName').innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
        document.getElementById('selectedUserInfo').textContent = 'Loading user data...';
        
        // Load user info first
        const users = await api.getSheet("user_credentials", false);
        const user = users.find(u => u.username === username);
        
        if (!user) {
            throw new Error(`User "${username}" not found in user_credentials`);
        }
        
        // Update user info display
        document.getElementById('selectedUserName').textContent = user.full_name || username;
        document.getElementById('selectedUserInfo').textContent = `Username: @${username} • Role: ${user.role || 'student'}`;
        
        // Try to load user's progress sheet - use exact username match first
        let userProgress = null;
        const progressSheetName = `${username}_progress`;
        
        console.log(`Trying to load: ${progressSheetName}`);
        
        try {
            userProgress = await api.getSheet(progressSheetName, false);
            if (userProgress && userProgress.error) {
                console.log(`Progress sheet error for ${username}:`, userProgress.error);
                userProgress = null;
            }
        } catch (e) {
            console.log(`Progress sheet ${progressSheetName} not found:`, e.message);
        }
        
        // If no progress sheet found, use empty array but show message
        if (!userProgress || !Array.isArray(userProgress)) {
            console.log(`No progress sheet found for ${username}, using empty data`);
            userProgress = [];
            
            // Update user info to show no progress data
            document.getElementById('selectedUserInfo').textContent += ' • No progress data found';
        }
        
        const [tasks, courses] = await Promise.all([
            api.getSheet("tasks_master"),
            api.getSheet("courses_master")
        ]);
        
        // Ensure tasks and courses are arrays
        const tasksData = Array.isArray(tasks) ? tasks : [];
        const coursesData = Array.isArray(courses) ? courses : [];
        
        console.log(`Progress records: ${userProgress.length}, Tasks: ${tasksData.length}, Courses: ${coursesData.length}`);
        
        // Clear any existing charts first
        Object.values(adminChartInstances).forEach(chart => {
            if (chart) chart.destroy();
        });
        adminChartInstances = {};
        
        // Small delay to ensure charts are cleared
        setTimeout(async () => {
            // Load charts and progress bars
            await Promise.all([
                loadAdminUserTaskChart(userProgress, tasksData),
                loadAdminUserCourseChart(userProgress, coursesData),
                loadAdminUserActivityChart(userProgress),
                updateAdminProgressBars(userProgress, tasksData, coursesData)
            ]);
        }, 100);
        
        console.log(`Successfully loaded status for ${username}`);
        
    } catch (error) {
        console.error('Error loading user status:', error);
        document.getElementById('selectedUserName').textContent = 'Error loading user data';
        document.getElementById('selectedUserInfo').textContent = `Error: ${error.message}`;
        
        // Clear charts on error
        Object.values(adminChartInstances).forEach(chart => {
            if (chart) chart.destroy();
        });
        adminChartInstances = {};
    }
}

// Load task chart for selected user
async function loadAdminUserTaskChart(progress, tasks) {
    const progressArray = Array.isArray(progress) ? progress : [];
    const tasksArray = Array.isArray(tasks) ? tasks : [];
    
    const completedTasks = progressArray.filter(p => p.item_type === "task" && p.status === "complete").length;
    const totalTasks = tasksArray.length;
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
}

// Load course chart for selected user
async function loadAdminUserCourseChart(progress, courses) {
    const progressArray = Array.isArray(progress) ? progress : [];
    const coursesArray = Array.isArray(courses) ? courses : [];
    
    // Calculate total courses including video courses and quiz courses
    const totalRegularCourses = coursesArray.length;
    const totalVideoCourses = videoCourses.length;
    const totalQuizCourses = quizCourses.length;
    const totalCourses = totalRegularCourses + totalVideoCourses + totalQuizCourses;
    
    const completedCourses = progressArray.filter(p => p.item_type === "course" && p.status === "complete").length;
    const inProgressCourses = Math.max(0, totalCourses - completedCourses);

    const ctx = document.getElementById('adminCourseChart');
    if (!ctx) return;
    
    if (adminChartInstances.courseChart) {
        adminChartInstances.courseChart.destroy();
    }
    
    adminChartInstances.courseChart = new Chart(ctx.getContext('2d'), {
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
}

// Load activity chart for selected user
async function loadAdminUserActivityChart(progress) {
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
            if (!p.completion_date || p.status !== "complete") return false;
            try {
                const completionDate = new Date(p.completion_date);
                return completionDate >= currentDay && completionDate < nextDay;
            } catch (e) {
                return false;
            }
        }).length;
        
        dailyData.push(dayCompletions);
    }

    const ctx = document.getElementById('adminActivityChart');
    if (!ctx) return;
    
    if (adminChartInstances.activityChart) {
        adminChartInstances.activityChart.destroy();
    }
    
    adminChartInstances.activityChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: dayLabels,
            datasets: [{
                label: 'Items Completed',
                data: dailyData,
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: '#3b82f6',
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
}

// Update progress bars for selected user
async function updateAdminProgressBars(progress, tasks, courses) {
    try {
        // Ensure all parameters are arrays
        const progressArray = Array.isArray(progress) ? progress : [];
        const tasksArray = Array.isArray(tasks) ? tasks : [];
        const coursesArray = Array.isArray(courses) ? courses : [];
        
        // Tasks progress
        const completedTasks = progressArray.filter(p => p.item_type === "task" && p.status === "complete").length;
        const totalTasks = tasksArray.length;
        const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        document.getElementById('adminTaskProgress').textContent = `${taskProgress}%`;
        document.getElementById('adminTaskProgressBar').style.width = `${taskProgress}%`;
        document.getElementById('adminTaskStats').textContent = `${completedTasks} / ${totalTasks}`;

        // Courses progress (including video courses and quiz courses)
        const totalRegularCourses = coursesArray.length;
        const totalVideoCourses = videoCourses.length;
        const totalQuizCourses = quizCourses.length;
        const totalCourses = totalRegularCourses + totalVideoCourses + totalQuizCourses;
        
        const completedCourses = progressArray.filter(p => p.item_type === "course" && p.status === "complete").length;
        const courseProgress = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;
        
        document.getElementById('adminCourseProgress').textContent = `${courseProgress}%`;
        document.getElementById('adminCourseProgressBar').style.width = `${courseProgress}%`;
        document.getElementById('adminCourseStats').textContent = `${completedCourses} / ${totalCourses}`;
    } catch (error) {
        console.error('Error updating admin progress bars:', error);
    }
}

// Modal Functions
function showAddUserModal() {
    document.getElementById('addUserModal').classList.remove('hidden');
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.add('hidden');
    document.getElementById('addUserForm').reset();
}

function showAddEventModal() {
    document.getElementById('addEventModal').classList.remove('hidden');
}

function closeAddEventModal() {
    document.getElementById('addEventModal').classList.add('hidden');
    document.getElementById('addEventForm').reset();
}

function showAddTaskModal() {
    document.getElementById('addTaskModal').classList.remove('hidden');
}

function closeAddTaskModal() {
    document.getElementById('addTaskModal').classList.add('hidden');
    document.getElementById('addTaskForm').reset();
}

function showAddCourseModal() {
    document.getElementById('addCourseModal').classList.remove('hidden');
}

function closeAddCourseModal() {
    document.getElementById('addCourseModal').classList.add('hidden');
    document.getElementById('addCourseForm').reset();
}

// Add Form Handlers
document.addEventListener('DOMContentLoaded', function() {
    // Add User Form
    document.getElementById('addUserForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Adding...';
        submitBtn.disabled = true;

        try {
            const userData = [
                document.getElementById('newUsername').value.trim(),
                document.getElementById('newPassword').value.trim(),
                document.getElementById('newFullName').value.trim(),
                document.getElementById('newRole').value
            ];

            const result = await api.addRow('user_credentials', userData);
            
            if (result && (result.success || result.includes?.('Success'))) {
                alert('User added successfully!');
                closeAddUserModal();
                await loadAdminUsers();
            } else {
                throw new Error(result?.error || 'Failed to add user');
            }
        } catch (error) {
            console.error('Error adding user:', error);
            alert('Error adding user: ' + error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // Add Event Form
    document.getElementById('addEventForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Adding...';
        submitBtn.disabled = true;

        try {
            const eventData = [
                Date.now().toString(), // event_id
                document.getElementById('eventTitle').value.trim(),
                document.getElementById('eventDate').value,
                document.getElementById('eventTime').value || '',
                document.getElementById('eventDescription').value.trim(),
                document.getElementById('eventPlace').value.trim()
            ];

            const result = await api.addRow('events_master', eventData);
            
            if (result && (result.success || result.includes?.('Success'))) {
                alert('Event added successfully!');
                closeAddEventModal();
                await loadAdminEvents();
                // Clear cache to refresh events
                api.clearCache();
            } else {
                throw new Error(result?.error || 'Failed to add event');
            }
        } catch (error) {
            console.error('Error adding event:', error);
            alert('Error adding event: ' + error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // Add Task Form
    document.getElementById('addTaskForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Adding...';
        submitBtn.disabled = true;

        try {
            const taskData = [
                document.getElementById('taskId').value.trim(),
                document.getElementById('taskTitle').value.trim(),
                document.getElementById('taskDescription').value.trim(),
                document.getElementById('taskDueDate').value
            ];

            const result = await api.addRow('tasks_master', taskData);
            
            if (result && (result.success || result.includes?.('Success'))) {
                alert('Task added successfully!');
                closeAddTaskModal();
                await loadAdminTasks();
            } else {
                throw new Error(result?.error || 'Failed to add task');
            }
        } catch (error) {
            console.error('Error adding task:', error);
            alert('Error adding task: ' + error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // Add Course Form
    document.getElementById('addCourseForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Adding...';
        submitBtn.disabled = true;

        try {
            const courseData = [
                document.getElementById('courseId').value.trim(),
                document.getElementById('courseTitle').value.trim(),
                document.getElementById('courseDescription').value.trim(),
                document.getElementById('courseStep1').value.trim(),
                document.getElementById('courseStep2').value.trim(),
                document.getElementById('courseStep3').value.trim(),
                document.getElementById('courseStep4').value.trim(),
                document.getElementById('courseStep5').value.trim()
            ];

            const result = await api.addRow('courses_master', courseData);
            
            if (result && (result.success || result.includes?.('Success'))) {
                alert('Course added successfully!');
                closeAddCourseModal();
                await loadAdminCourses();
            } else {
                throw new Error(result?.error || 'Failed to add course');
            }
        } catch (error) {
            console.error('Error adding course:', error);
            alert('Error adding course: ' + error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
});

// Placeholder functions for edit/delete (you can implement these later)
function editUser(username) {
    alert(`Edit user functionality for ${username} - To be implemented`);
}

function deleteUser(username) {
    if (confirm(`Are you sure you want to delete user ${username}?`)) {
        alert(`Delete user functionality for ${username} - To be implemented`);
    }
}

function editEvent(eventId) {
    alert(`Edit event functionality for ${eventId} - To be implemented`);
}

function deleteEvent(eventId) {
    if (confirm(`Are you sure you want to delete this event?`)) {
        alert(`Delete event functionality for ${eventId} - To be implemented`);
    }
}

function editTask(taskId) {
    alert(`Edit task functionality for ${taskId} - To be implemented`);
}

function deleteTask(taskId) {
    if (confirm(`Are you sure you want to delete this task?`)) {
        alert(`Delete task functionality for ${taskId} - To be implemented`);
    }
}

function editCourse(courseId) {
    alert(`Edit course functionality for ${courseId} - To be implemented`);
}

function deleteCourse(courseId) {
    if (confirm(`Are you sure you want to delete this course?`)) {
        alert(`Delete course functionality for ${courseId} - To be implemented`);
    }
}

// Load admin tasks with dropdown functionality
async function loadAdminTasks() {
    const container = document.getElementById('adminTasksDefaultList');
    container.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading tasks...</div>';

    try {
        // Load students dropdown
        await loadTaskStudentsDropdown();
        
        const tasks = await api.getSheet("tasks_master");
        
        if (!tasks || tasks.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No tasks found.</p>';
            return;
        }

        container.innerHTML = tasks.map(task => `
            <div class="bg-gray-50 rounded-lg p-4 flex justify-between items-start">
                <div class="flex-1">
                    <h4 class="font-semibold text-gray-800">${task.title}</h4>
                    <p class="text-sm text-gray-600">${task.description}</p>
                    <div class="mt-2">
                        <p class="text-xs text-gray-500"><i class="fas fa-calendar-alt mr-1"></i>Due: ${new Date(task.due_date).toLocaleDateString()}</p>
                        <p class="text-xs text-gray-500"><i class="fas fa-tag mr-1"></i>ID: ${task.task_id}</p>
                    </div>
                </div>
                <div class="flex space-x-2 ml-4">
                    <button onclick="editTask('${task.task_id}')" class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteTask('${task.task_id}')" class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading tasks:', error);
        container.innerHTML = '<p class="text-red-500">Error loading tasks.</p>';
    }
}

// Load students dropdown for task assignment
async function loadTaskStudentsDropdown() {
    try {
        const users = await api.getSheet("user_credentials", false);
        const userSelect = document.getElementById('adminTaskUserSelect');
        
        if (!users || !Array.isArray(users) || users.length === 0) {
            userSelect.innerHTML = '<option value="">-- No Students Found --</option>';
            return;
        }
        
        userSelect.innerHTML = '<option value="">-- Select Student --</option>';
        
        // Filter and add only students (non-admin users)
        users.forEach(user => {
            if (user.username && user.username.trim() && user.role !== 'admin') {
                const username = user.username.trim();
                const displayName = user.full_name || username;
                
                const option = document.createElement('option');
                option.value = username;
                option.textContent = `${displayName} (@${username})`;
                userSelect.appendChild(option);
            }
        });
        
        // Add event listener for student selection
        userSelect.onchange = handleTaskStudentSelection;
        
    } catch (error) {
        console.error('Error loading students dropdown:', error);
        document.getElementById('adminTaskUserSelect').innerHTML = '<option value="">-- Error Loading Students --</option>';
    }
}

// Handle student selection for task assignment
async function handleTaskStudentSelection(event) {
    const selectedUsername = event.target.value;
    const assignmentView = document.getElementById('adminTaskAssignmentView');
    const defaultList = document.getElementById('adminTasksDefaultList');
    
    if (!selectedUsername) {
        assignmentView.classList.add('hidden');
        defaultList.classList.remove('hidden');
        return;
    }
    
    defaultList.classList.add('hidden');
    assignmentView.classList.remove('hidden');
    
    // Update selected student info
    const users = await api.getSheet("user_credentials");
    const selectedUser = users.find(u => u.username === selectedUsername);
    document.getElementById('selectedStudentInfo').textContent = 
        `Assigning tasks for: ${selectedUser?.full_name || selectedUsername} (@${selectedUsername})`;
    
    // Load tasks for assignment
    await loadTasksForAssignment(selectedUsername);
}

// Load tasks for assignment to selected student
async function loadTasksForAssignment(username) {
    const container = document.getElementById('adminTasksList');
    container.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading tasks...</div>';

    try {
        const [tasks, progress] = await Promise.all([
            api.getSheet("tasks_master"),
            api.getSheet(`${username}_progress`)
        ]);
        
        if (!tasks || tasks.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No tasks found.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        tasks.forEach(task => {
            const userTask = progress.find(p => 
                String(p.item_id) === String(task.task_id) && 
                p.item_type === "task" && 
                p.status === "complete"
            );
            const completed = !!userTask;
            
            // Check if task is overdue
            const dueDate = new Date(task.due_date);
            dueDate.setHours(23, 59, 59, 999);
            const isOverdue = !completed && dueDate < today;
            
            const taskElement = document.createElement('div');
            let containerClass = 'flex items-start space-x-3 p-4 border rounded-lg transition-colors';
            let statusIndicator = '';
            let checkboxDisabled = '';
            let checkboxClass = 'mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500';
            
            if (completed) {
                containerClass += ' bg-green-50 border-green-200';
                statusIndicator = '<span class="text-xs text-green-600 font-medium">✓ Completed</span>';
                checkboxDisabled = 'disabled';
            } else if (isOverdue) {
                containerClass += ' bg-red-50 border-red-300';
                statusIndicator = '<span class="text-xs text-red-600 font-medium">⚠ Overdue</span>';
            } else {
                containerClass += ' hover:bg-gray-50';
            }
            
            taskElement.className = containerClass;
            
            const dueDateFormatted = new Date(task.due_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            taskElement.innerHTML = `
                <input type="checkbox" id="admin-task-${task.task_id}" ${completed ? 'checked' : ''} 
                       class="${checkboxClass}" ${checkboxDisabled}>
                <div class="flex-1">
                    <h4 class="font-semibold ${completed ? 'line-through text-gray-500' : ''}">${task.title}</h4>
                    <p class="text-gray-600 text-sm ${completed ? 'line-through' : ''}">${task.description}</p>
                    <p class="text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}">
                        Due: ${dueDateFormatted}
                        ${isOverdue ? ' (OVERDUE)' : ''}
                    </p>
                    ${statusIndicator}
                </div>
            `;
            fragment.appendChild(taskElement);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
        
    } catch (error) {
        console.error('Error loading tasks for assignment:', error);
        container.innerHTML = '<p class="text-red-500">Error loading tasks.</p>';
    }
}

// Submit tasks for selected student (admin function)
async function submitTasksForStudent() {
    const userSelect = document.getElementById('adminTaskUserSelect');
    const selectedUsername = userSelect.value;
    
    if (!selectedUsername) {
        alert('No student selected.');
        return;
    }

    const submitBtn = event.target;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Updating...';
    submitBtn.disabled = true;

    try {
        // Get selected tasks
        const selectedTasks = [];
        document.querySelectorAll('input[id^="admin-task-"]:checked:not(:disabled)').forEach(checkbox => {
            const taskId = checkbox.id.replace('admin-task-', '');
            selectedTasks.push(taskId);
        });

        if (selectedTasks.length === 0) {
            alert('No new tasks were selected for submission.');
            return;
        }

        const [tasks, progress] = await Promise.all([
            api.getSheet("tasks_master"),
            api.getSheet(`${selectedUsername}_progress`)
        ]);
        
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
                
                promises.push(api.addRow(`${selectedUsername}_progress`, rowData));
                updatedCount++;
            }
        }

        if (promises.length > 0) {
            await Promise.all(promises);
            alert(`${updatedCount} task(s) submitted successfully for ${selectedUsername}!`);
            await loadTasksForAssignment(selectedUsername);
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
