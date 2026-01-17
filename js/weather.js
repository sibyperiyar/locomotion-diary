/**
 * WeatherService
 * Handles fetching historical weather data from Open-Meteo API.
 * Includes simple caching and rate-limiting.
 */
const WeatherService = {
    BASE_URL: 'https://archive-api.open-meteo.com/v1/archive',

    // WMO Weather interpretation codes (https://open-meteo.com/en/docs)
    WEATHER_CODES: {
        0: { label: 'Clear sky', icon: '☀️' },
        1: { label: 'Mainly clear', icon: '🌤️' },
        2: { label: 'Partly cloudy', icon: '⛅' },
        3: { label: 'Overcast', icon: '☁️' },
        45: { label: 'Fog', icon: 'Fog 🌫️' },
        48: { label: 'Depositing rime fog', icon: 'Fog 🌫️' },
        51: { label: 'Light Drizzle', icon: 'Drizzle 🌧️' },
        53: { label: 'Moderate Drizzle', icon: 'Drizzle 🌧️' },
        55: { label: 'Dense Drizzle', icon: 'Drizzle 🌧️' },
        61: { label: 'Slight Rain', icon: 'Rain 🌧️' },
        63: { label: 'Moderate Rain', icon: 'Rain 🌧️' },
        65: { label: 'Heavy Rain', icon: 'Rain 🌧️' },
        71: { label: 'Slight Snow', icon: 'Snow ❄️' },
        73: { label: 'Moderate Snow', icon: 'Snow ❄️' },
        75: { label: 'Heavy Snow', icon: 'Snow ❄️' },
        95: { label: 'Thunderstorm', icon: '⚡' },
        96: { label: 'Thunderstorm with hail', icon: '⚡' },
        99: { label: 'Thunderstorm with hail', icon: '⚡' }
    },

    /**
     * Fetch weather for a specific location and date.
     * @param {number} lat 
     * @param {number} lng 
     * @param {string} dateStr 'YYYY-MM-DD'
     */
    async getDailyWeather(lat, lng, dateStr) {
        // simple cache key
        const cacheKey = `weather_${dateStr}_${lat.toFixed(1)}_${lng.toFixed(1)}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            // return JSON.parse(cached); // DISABLED LOCALSTORAGE CACHE FOR TESTING
        }

        const url = `${this.BASE_URL}?latitude=${lat}&longitude=${lng}&start_date=${dateStr}&end_date=${dateStr}&daily=weather_code,temperature_2m_max,precipitation_sum&timezone=auto`;

        console.log(`🌤️ Fetching Weather for ${dateStr}...`);

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Weather API Error');
            const data = await response.json();

            if (data.daily && data.daily.weather_code) {
                const result = {
                    code: data.daily.weather_code[0],
                    tempMax: data.daily.temperature_2m_max[0],
                    precip: data.daily.precipitation_sum[0],
                    icon: this.getIcon(data.daily.weather_code[0])
                };

                // Cache it (LocalStorage for now, maybe DB later)
                // localStorage.setItem(cacheKey, JSON.stringify(result));
                return result;
            }
        } catch (e) {
            console.error("Weather fetch failed:", e);
        }
        return null;
    },

    getIcon(code) {
        return this.WEATHER_CODES[code] ? this.WEATHER_CODES[code].icon : '❓';
    },

    /**
     * Test function to run in console
     */
    async test() {
        // Date, Lat, Lng (Example: Paris, 2023-01-01)
        const w = await this.getDailyWeather(48.8566, 2.3522, '2023-01-01');
        console.log("Test Weather:", w);
        alert(`Weather Test (Paris 2023): ${w.icon} ${w.tempMax}°C`);
    }
};

window.WeatherService = WeatherService;
