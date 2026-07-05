const workInput = document.getElementById('work_time');
const shortInput = document.getElementById('short_time');
const longInput = document.getElementById('long_time');

let work_length = Number(workInput.value) || 25;
let short_length = Number(shortInput.value) || 5;
let long_length = Number(longInput.value) || 15;

// Global state trackers
const COLORS = { work: '#e74c3c', short: '#f97316', long: '#6b8e23' };
const CIRCUMFERENCE = 2 * Math.PI * 90;

let currentMode = 'work';
let countdownInterval = null;
let saveInterval = null;
let sessions = 0;

let MODES = { work: work_length * 60, short: short_length * 60, long: long_length * 60 };
let timeLeft = MODES.work;
let totalTime = MODES.work;

// Load persisted state from localStorage on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedEndTime = localStorage.getItem('timerEndTime');
    const savedMode = localStorage.getItem('timerMode');
    const savedTimeLeft = localStorage.getItem('timerTimeLeft');
    
    if (savedEndTime && savedMode) {
        currentMode = savedMode;
        const now = Date.now();
        const difference = Math.floor((Number(savedEndTime) - now) / 1000);
        
        if (difference > 0) {
            timeLeft = difference;
            totalTime = MODES[currentMode];
            updateTabs();
            startTimer();
        } else {
            localStorage.removeItem('timerEndTime');
            localStorage.removeItem('timerMode');
            localStorage.removeItem('timerTimeLeft');
            switchMode('work');
        }
    } else if (savedTimeLeft) {
        timeLeft = Number(savedTimeLeft);
        updateDisplay();
        updateTabs();
    }
});

async function saveStudySession(minutesSpent) {
    const csrfToken = document.querySelector('input[name="csrf_token"]')?.value;
    
    try {
        const response = await fetch('/api/save_study_time', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ minutes: minutesSpent })
        });
        
        const data = await response.json();
        if (!data.success) {
            console.error("Failed to log study time:", data.error);
        }
    } catch (error) {
        console.error("Error logging study time:", error);
    }
}

workInput.addEventListener('input', function() {
    work_length = Number(this.value);
    MODES.work = work_length * 60;
    if (currentMode === 'work' && !countdownInterval) resetTimer();
});

shortInput.addEventListener('input', function() {
    short_length = Number(this.value);
    MODES.short = short_length * 60;
    if (currentMode === 'short' && !countdownInterval) resetTimer();
});

longInput.addEventListener('input', function() {
    long_length = Number(this.value);
    MODES.long = long_length * 60;
    if (currentMode === 'long' && !countdownInterval) resetTimer();
});

const display = document.getElementById('timer-display');
const progress = document.getElementById('progress');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');

function updateDisplay() {
    const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
    const s = String(timeLeft % 60).padStart(2, '0');
    display.textContent = `${m}:${s}`;
    
    const percent = totalTime > 0 ? timeLeft / totalTime : 0;
    const offset = CIRCUMFERENCE * (1 - percent);
    progress.style.strokeDashoffset = offset;
}

function updateTabs() {
    ['work','short','long'].forEach(mode => {
        const tab = document.getElementById('tab-' + (mode === 'short' ? 'short' : mode === 'long' ? 'long' : 'work'));
        if (!tab) return;
        if (mode === currentMode) {
            tab.style.background = COLORS[mode];
            tab.style.color = '#fff';
        } else {
            tab.style.background = '#f0c0bd';
            tab.style.color = '#000000';
        }
    });
    progress.style.stroke = COLORS[currentMode];
}

function switchMode(mode) {
    clearInterval(countdownInterval); countdownInterval = null;
    clearInterval(saveInterval); saveInterval = null;
    currentMode = mode;
    timeLeft = MODES[mode];
    totalTime = MODES[mode];
    startBtn.classList.remove('hidden');
    pauseBtn.classList.add('hidden');
    
    toggleActivity(currentMode === 'work');
    updateDisplay();
    updateTabs();
}

async function toggleActivity(newStatus) {
    const csrf_token = document.querySelector('input[name="csrf_token"]')?.value;
    try {
        await fetch('/api/toggle_activity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrf_token
            },
            body: JSON.stringify({ is_studying: newStatus })
        });
    } catch (error) {
        showError("Error updating status.");
        console.log("Error updating status", error);
    }
}

function startTimer() {
    startBtn.classList.add('hidden');
    pauseBtn.classList.remove('hidden');
    
    if (timeLeft === totalTime) {
        timeLeft = MODES[currentMode];
        totalTime = MODES[currentMode];
    }
    
    toggleActivity(currentMode === 'work');

    const endTime = Date.now() + (timeLeft * 1000);
    localStorage.setItem('timerEndTime', endTime);
    localStorage.setItem('timerMode', currentMode);
    localStorage.removeItem('timerTimeLeft');

    if (currentMode === 'work') {
        // clear any old save intervals first so they don't stack up
        clearInterval(saveInterval);
        
        // Set the interval to log 1 minute every 60 seconds
        saveInterval = setInterval(() => {saveStudySession(1);}, 60000);
    }

    // 1. Independent Countdown Loop
    clearInterval(countdownInterval); countdownInterval = null;
    countdownInterval = setInterval(() => {
        const now = Date.now();
        timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
        updateDisplay();
        if (timeLeft <= 0) {
            clearInterval(countdownInterval); countdownInterval = null;
            clearInterval(saveInterval); saveInterval = null;
            localStorage.removeItem('timerEndTime');
            localStorage.removeItem('timerMode');
            
            playChime();
            
            if (currentMode === 'work') {
                sessions++;
                saveStudySession(work_length);
                document.getElementById('session-count').textContent = sessions;
                switchMode(sessions % 4 === 0 ? 'long' : 'short');
            } else {
                switchMode('work');
            }
            startTimer();
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(countdownInterval); countdownInterval = null;
    clearInterval(saveInterval); saveInterval = null;
    
    localStorage.removeItem('timerEndTime');
    localStorage.setItem('timerTimeLeft', timeLeft);
    
    pauseBtn.classList.add('hidden');
    startBtn.classList.remove('hidden');
    toggleActivity(false);
}

function resetTimer() {
    clearInterval(countdownInterval); countdownInterval = null;
    clearInterval(saveInterval); saveInterval = null;
    
    localStorage.removeItem('timerEndTime');
    localStorage.removeItem('timerMode');
    localStorage.removeItem('timerTimeLeft');
    
    timeLeft = MODES[currentMode];
    totalTime = MODES[currentMode];
    startBtn.classList.remove('hidden');
    pauseBtn.classList.add('hidden');
    updateDisplay();
    toggleActivity(false);
}

function playChime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 830;
        o.type = 'sine';
        g.gain.setValueAtTime(0.3, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        o.start(); o.stop(ctx.currentTime + 0.8);
    } catch(e) {}
}

document.querySelector('#add-group-name')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentForm = e.currentTarget;
    const groupName = currentForm.querySelector('input[name="group_name"]').value.trim();
    const csrfToken = document.querySelector('input[name="csrf_token"]')?.value;

    if (groupName.length > 50 || groupName.length === 0) {
        showError("Please enter a group that is between 1 and 50 characters.");
        return;
    }

    try {
        const response = await fetch('/api/update_group', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ group: groupName })
        });

        const data = await response.json();
        
        if (data.success) {
            window.location.reload();
            setTimeout(() => { showSuccess("Group updated successfully!"); }, 1000);
        } else {
            showError(data.error || "Failed to update group name");
        }
    } catch (error) {
        showError("Error updating group name.");
    }
});

updateDisplay();
updateTabs();