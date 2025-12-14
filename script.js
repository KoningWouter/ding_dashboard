const API_URL = 'http://173.249.28.205:8080/flightlog';

const tableBody = document.getElementById('tableBody');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const refreshBtn = document.getElementById('refreshBtn');

// Format timestamp to readable date
function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return timestamp; // Return original if not a valid date
        }
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return timestamp;
    }
}

// Fetch and display flight logs
async function fetchFlightLogs() {
    loading.style.display = 'block';
    error.style.display = 'none';
    tableBody.innerHTML = '';
    
    try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Handle both array and single object responses
        const logs = Array.isArray(data) ? data : [data];
        
        if (logs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 30px; color: #6c757d;">No flight logs found</td></tr>';
            return;
        }
        
        logs.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${log.user_id || 'N/A'}</td>
                <td>${log.flight_log || 'N/A'}</td>
                <td>${formatTimestamp(log.timestamp)}</td>
            `;
            tableBody.appendChild(row);
        });
        
    } catch (err) {
        console.error('Error fetching flight logs:', err);
        error.textContent = `Error loading flight logs: ${err.message}`;
        error.style.display = 'block';
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 30px; color: #e74c3c;">Failed to load data</td></tr>';
    } finally {
        loading.style.display = 'none';
    }
}

// Refresh button event listener
refreshBtn.addEventListener('click', fetchFlightLogs);

// Initial load
fetchFlightLogs();

// Auto-refresh every 30 seconds
setInterval(fetchFlightLogs, 30000);

