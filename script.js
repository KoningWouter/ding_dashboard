const API_URL = 'http://173.249.28.205:8080/flightlog';

const tableBody = document.getElementById('tableBody');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const refreshBtn = document.getElementById('refreshBtn');

// Tab elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Tab switching
function initTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Remove active class from all tabs and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            button.classList.add('active');
            document.getElementById(`${targetTab}Tab`).classList.add('active');
        });
    });
}

// Flight times in seconds (Torn <-> destination)
const FLIGHT_TIMES = {
    'Argentina': 7020,     // 1:57 hours = 1*3600 + 57*60 = 7020 seconds
    'China': 10140,        // 2:49 hours = 2*3600 + 49*60 = 10140 seconds
    'Japan': 9480,         // 2:38 hours = 2*3600 + 38*60 = 9480 seconds
    'Hawaii': 5640,        // 1:34 hours = 1*3600 + 34*60 = 5640 seconds
    'Mexico': 1080,        // 0:18 hours = 18*60 = 1080 seconds
    'Cayman Islands': 1500, // 0:25 hours = 25*60 = 1500 seconds
    'Canada': 1740,        // 0:29 hours = 29*60 = 1740 seconds
    'United Kingdom': 6660, // 1:51 hours = 1*3600 + 51*60 = 6660 seconds
    'Switzerland': 7380,   // 2:03 hours = 2*3600 + 3*60 = 7380 seconds
    'Swiss': 7380,         // 2:03 hours = 2*3600 + 3*60 = 7380 seconds (alias for Switzerland)
    'UAE': 11400,          // 3:10 hours = 3*3600 + 10*60 = 11400 seconds
    'South Africa': 12480  // 3:28 hours = 3*3600 + 28*60 = 12480 seconds
};

// Extract destination/country from flight_log string
// Handles patterns like:
// - "Traveling to Canada" -> "Canada"
// - "Returning to Torn from Argentina" -> "Argentina"
// - "Torn <-> China" -> "China"
function extractDestination(flightLog) {
    if (!flightLog) return null;
    
    // Pattern 1: "Traveling to [Country]"
    let match = flightLog.match(/Traveling\s+to\s+(.+)/i);
    if (match) {
        return match[1].trim();
    }
    
    // Pattern 2: "Returning to Torn from [Country]"
    match = flightLog.match(/Returning\s+to\s+Torn\s+from\s+(.+)/i);
    if (match) {
        return match[1].trim();
    }
    
    // Pattern 3: "Torn <-> Destination" or "Destination <-> Torn" (old format)
    match = flightLog.match(/Torn\s*<->\s*(.+)|(.+)\s*<->\s*Torn/i);
    if (match) {
        return (match[1] || match[2]).trim();
    }
    
    return null;
}

// Get flight time in seconds for a destination
function getFlightTime(destination) {
    if (!destination) return null;
    
    // Try exact match first
    if (FLIGHT_TIMES[destination]) {
        return FLIGHT_TIMES[destination];
    }
    
    // Try case-insensitive match
    const destinationLower = destination.toLowerCase();
    for (const [key, value] of Object.entries(FLIGHT_TIMES)) {
        if (key.toLowerCase() === destinationLower) {
            return value;
        }
    }
    
    return null;
}

// Calculate landing time from start timestamp and flight log
function calculateLandingTime(startTimestamp, flightLog) {
    if (!startTimestamp) return null;
    
    const destination = extractDestination(flightLog);
    const flightTimeSeconds = getFlightTime(destination);
    
    if (flightTimeSeconds === null) {
        return null; // Unknown destination
    }
    
    // Convert start timestamp to number (Unix timestamp in seconds)
    let unixTimestamp = typeof startTimestamp === 'string' ? parseInt(startTimestamp, 10) : startTimestamp;
    if (isNaN(unixTimestamp)) return null;
    
    // Add flight time in seconds directly to the Unix timestamp
    const landingTimestamp = unixTimestamp + flightTimeSeconds;
    
    return landingTimestamp;
}

// Format elapsed time (e.g., "2 hours 30 minutes ago" or "in 1 hour 15 minutes")
function formatElapsedTime(seconds) {
    const absSeconds = Math.abs(seconds);
    const hours = Math.floor(absSeconds / 3600);
    const minutes = Math.floor((absSeconds % 3600) / 60);
    const secs = absSeconds % 60;
    
    const parts = [];
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    if (secs > 0 && hours === 0 && minutes === 0) parts.push(`${secs} second${secs !== 1 ? 's' : ''}`);
    
    if (parts.length === 0) return 'just now';
    
    const timeStr = parts.join(' ');
    return seconds < 0 ? `${timeStr} ago` : `in ${timeStr}`;
}

// Format Unix timestamp to readable date
function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        // Convert to number if it's a string
        let unixTimestamp = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
        
        // Check if it's a valid number
        if (isNaN(unixTimestamp)) {
            return timestamp; // Return original if not a valid number
        }
        
        // Unix timestamps can be in seconds (10 digits) or milliseconds (13 digits)
        // If it's 10 digits or less, it's in seconds, so multiply by 1000
        if (unixTimestamp.toString().length <= 10) {
            unixTimestamp = unixTimestamp * 1000;
        }
        
        const date = new Date(unixTimestamp);
        
        // Validate the date
        if (isNaN(date.getTime())) {
            return timestamp; // Return original if not a valid date
        }
        
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });
    } catch (e) {
        return timestamp;
    }
}

// Format landing time with color based on past/future
function formatLandingTimeDisplay(landingTimestamp) {
    if (!landingTimestamp) return { text: 'N/A', color: '' };
    
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const secondsDiff = landingTimestamp - now;
    
    if (secondsDiff < 0) {
        // Past time - show elapsed time in green
        return {
            text: formatElapsedTime(secondsDiff),
            color: 'green'
        };
    } else {
        // Future time - show time remaining in blue
        return {
            text: formatElapsedTime(secondsDiff),
            color: 'blue'
        };
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
        
        // Sort by landing time (newest first - descending order)
        logs.sort((a, b) => {
            const getLandingTime = (log) => {
                const landingTime = calculateLandingTime(log.timestamp, log.flight_log);
                if (landingTime) return landingTime;
                // Fallback to start time if landing time can't be calculated
                let unixTimestamp = typeof log.timestamp === 'string' ? parseInt(log.timestamp, 10) : log.timestamp;
                if (isNaN(unixTimestamp)) return 0;
                return unixTimestamp;
            };
            
            return getLandingTime(b) - getLandingTime(a);
        });
        
        logs.forEach(log => {
            const row = document.createElement('tr');
            
            // Use username from API response, fallback to user_id or 'N/A'
            const username = log.username || log.user_id || 'N/A';
            
            // Calculate landing time and format with color
            const landingTime = calculateLandingTime(log.timestamp, log.flight_log);
            let landingTimeDisplay;
            
            if (landingTime) {
                const landingDisplay = formatLandingTimeDisplay(landingTime);
                landingTimeDisplay = `<span style="color: ${landingDisplay.color};">${landingDisplay.text}</span>`;
            } else {
                // Fallback: show relative time from timestamp itself
                let unixTimestamp = typeof log.timestamp === 'string' ? parseInt(log.timestamp, 10) : log.timestamp;
                if (!isNaN(unixTimestamp)) {
                    // Convert to seconds if it's in milliseconds (13 digits)
                    if (unixTimestamp.toString().length > 10) {
                        unixTimestamp = Math.floor(unixTimestamp / 1000);
                    }
                    const fallbackDisplay = formatLandingTimeDisplay(unixTimestamp);
                    landingTimeDisplay = `<span style="color: ${fallbackDisplay.color};">${fallbackDisplay.text}</span>`;
                } else {
                    landingTimeDisplay = 'N/A';
                }
            }
            
            row.innerHTML = `
                <td>${username}</td>
                <td>${log.flight_log || 'N/A'}</td>
                <td>${landingTimeDisplay}</td>
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

// Initialize tabs
initTabs();

// Initial load
fetchFlightLogs();

// Auto-refresh every 30 seconds
setInterval(fetchFlightLogs, 30000);


