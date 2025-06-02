// Constants
const API_BASE_URL = '';
const API_ENDPOINTS = {
    ALL_PAIRS: '/trading-pairs',
    ACTIVE_PAIRS: '/trading-pairs/active'
};

// DOM Elements
const activePairsTable = document.getElementById('active-pairs-body');
const allPairsTable = document.getElementById('all-pairs-body');
const addPairForm = document.getElementById('add-pair-form');
const formMessage = document.getElementById('form-message');
const activeLoading = document.getElementById('active-loading');
const allLoading = document.getElementById('all-loading');

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `message message-${type}`;
    
    // Hide message after 5 seconds
    setTimeout(() => {
        element.textContent = '';
        element.className = 'message';
    }, 5000);
}

// API functions
async function fetchData(endpoint) {
    try {
        console.log(`[🔍] Fetching data from: ${API_BASE_URL}${endpoint}`);
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        console.log(`[🔍] Response status:`, response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[✅] Data received:`, data);
        return data;
    } catch (error) {
        console.error(`[🔴] Error fetching data from ${endpoint}:`, error);
        return [];
    }
}

async function createTradingPair(data) {
    try {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.ALL_PAIRS}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Failed to create trading pair');
        }
        
        return { success: true, data: result };
    } catch (error) {
        console.error('[🔴] Error creating trading pair:', error);
        return { success: false, error: error.message };
    }
}

async function toggleTradingPairStatus(id, isActive) {
    try {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.ALL_PAIRS}/${id}/toggle-active`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: isActive })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update trading pair status');
        }
        
        return { success: true };
    } catch (error) {
        console.error('[🔴] Error updating trading pair status:', error);
        return { success: false, error: error.message };
    }
}

async function deleteTradingPair(id) {
    try {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.ALL_PAIRS}/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete trading pair');
        }
        
        return { success: true };
    } catch (error) {
        console.error('[🔴] Error deleting trading pair:', error);
        return { success: false, error: error.message };
    }
}

// Render functions
function renderTradingPairs(data, tableElement) {
    console.log('Rendering data:', data);
    tableElement.innerHTML = '';
    
    if (!data || data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="4" style="text-align: center;">No trading pairs found</td>`;
        tableElement.appendChild(row);
        return;
    }
    
    data.forEach(pair => {
        console.log('Rendering pair:', pair);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${pair.symbol || 'N/A'}</td>
            <td>
                <span class="status ${pair.is_active ? 'status-active' : 'status-inactive'}">
                    ${pair.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>${pair.created_at ? formatDate(pair.created_at) : 'N/A'}</td>
            <td>
                <button class="action-btn toggle-btn" data-id="${pair.id}" data-active="${!pair.is_active}">
                    ${pair.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button class="action-btn delete-btn" data-id="${pair.id}">Delete</button>
            </td>
        `;
        tableElement.appendChild(row);
    });
    
    // Add event listeners to action buttons
    tableElement.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', handleToggleStatus);
    });
    
    tableElement.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', handleDelete);
    });
}

// Event handlers
async function handleToggleStatus(event) {
    const button = event.currentTarget;
    const id = button.dataset.id;
    const newStatus = button.dataset.active === 'true';
    
    const result = await toggleTradingPairStatus(id, newStatus);
    
    if (result.success) {
        // Refresh data
        loadAllData();
        showMessage(formMessage, `Trading pair status updated successfully`, 'success');
    } else {
        showMessage(formMessage, result.error || 'Failed to update status', 'error');
    }
}

async function handleDelete(event) {
    if (!confirm('Are you sure you want to delete this trading pair?')) {
        return;
    }
    
    const button = event.currentTarget;
    const id = button.dataset.id;
    
    const result = await deleteTradingPair(id);
    
    if (result.success) {
        // Refresh data
        loadAllData();
        showMessage(formMessage, 'Trading pair deleted successfully', 'success');
    } else {
        showMessage(formMessage, result.error || 'Failed to delete trading pair', 'error');
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(addPairForm);
    const data = {
        symbol: formData.get('symbol'),
        is_active: formData.get('is_active') === 'true'
    };
    
    const result = await createTradingPair(data);
    
    if (result.success) {
        addPairForm.reset();
        loadAllData();
        showMessage(formMessage, 'Trading pair added successfully', 'success');
    } else {
        showMessage(formMessage, result.error || 'Failed to add trading pair', 'error');
    }
}

// Load data
async function loadActivePairs() {
    activeLoading.style.display = 'block';
    const data = await fetchData(API_ENDPOINTS.ACTIVE_PAIRS);
    renderTradingPairs(data, activePairsTable);
    activeLoading.style.display = 'none';
}

async function loadAllPairs() {
    allLoading.style.display = 'block';
    const data = await fetchData(API_ENDPOINTS.ALL_PAIRS);
    renderTradingPairs(data, allPairsTable);
    allLoading.style.display = 'none';
}

async function loadAllData() {
    await Promise.all([
        loadActivePairs(),
        loadAllPairs()
    ]);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Initial data load
    loadAllData();
    
    // Form submission
    const addPairForm = document.getElementById('add-pair-form');
    if (addPairForm) {
        addPairForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Toggle form visibility
    const toggleBtn = document.getElementById('toggle-add-form');
    const formContent = document.getElementById('add-form-content');
    
    if (toggleBtn && formContent) {
        toggleBtn.addEventListener('click', () => {
            const isVisible = formContent.style.display !== 'none';
            formContent.style.display = isVisible ? 'none' : 'block';
            toggleBtn.classList.toggle('active');
            toggleBtn.textContent = isVisible ? '+' : '−';
        });
    }
});
