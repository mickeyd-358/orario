document.addEventListener('DOMContentLoaded', () => {
    const streakDisplay = document.getElementById('streak-counter');

    async function displayStreak() {
        fetch('/api/calculate_streak', {method: 'GET'})
            .then((response) => response.json())
            .then(data => {
                if (data.streak === 0) {
                    streakDisplay.innerHTML = `<h1>Streak: ${data.streak} days!</h1><p>Study today to light the flame</p>
                    <div class="streak-widget">
                        <div class="fire-container">
                        <div class="flame outer dead"></div>
                        <div class="flame inner dead"></div>
                        <div class="flame core dead"></div>
                        </div><br><br>
                        <div class="streak-label">Study to keep your streak!</div>
                    </div>
                    `;
                } else {
                    streakDisplay.innerHTML = `<h1>Streak: ${data.streak} days!</h1>
                    <div class="streak-widget">
                        <div class="fire-container">
                        <div class="flame outer"></div>
                        <div class="flame inner"></div>
                        <div class="flame core"></div>
                        </div><br><br>
                        <div class="streak-label">Keep your streak by studying!</div>
                    </div>
                    `;
                }
        });
    };

    displayStreak();

    setInterval(displayStreak, 10000); 
});