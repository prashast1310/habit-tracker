// AuraHabit Core Logic - Designed for Nihu

// --- Application State Manager ---
class AuraHabitApp {
  constructor() {
    this.storageKey = 'aurahabit_state_v1';
    
    // Default Habits Setup
    this.defaultHabits = [
      { id: 'h1', name: 'Meditate', desc: 'Focus on breathing & mindfulness', routine: 'morning', history: {}, streak: 0 },
      { id: 'h2', name: 'Journal', desc: 'Reflect and plan the day', routine: 'morning', history: {}, streak: 0 },
      { id: 'h3', name: 'Make bed', desc: 'Set a neat tone for the day', routine: 'morning', history: {}, streak: 0 },
      { id: 'h4', name: 'Protein Intake', desc: 'Fuel your morning structure', routine: 'morning', history: {}, streak: 0 },
      { id: 'h5', name: 'Workout', desc: 'Get moving and build strength', routine: 'evening', history: {}, streak: 0 },
      { id: 'h6', name: 'Protein Intake', desc: 'Support recovery and repair', routine: 'evening', history: {}, streak: 0 },
      { id: 'h7', name: 'Reading', desc: 'Wind down with a book', routine: 'evening', history: {}, streak: 0 }
    ];

    this.state = {
      habits: [],
      hydration: {}, // key: 'YYYY-MM-DD', value: number (0-6)
      activeRoutine: 'morning', // 'morning' | 'evening'
      themeOverride: null // 'morning' | 'evening' | null (null auto-calculates based on time)
    };

    // DOM Caching
    this.elements = {};
    
    // Initialize
    this.init();
  }

  // --- Initialize App ---
  init() {
    this.loadState();
    this.cacheDOM();
    this.determineInitialRoutine();
    this.setupEventListeners();
    this.startClock();
    
    // Initial Render
    this.render();
  }

  // --- Load State from LocalStorage ---
  loadState() {
    const raw = localStorage.getItem(this.storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.state.habits = parsed.habits || [];
        this.state.hydration = parsed.hydration || {};
        this.state.themeOverride = parsed.themeOverride || null;
      } catch (e) {
        console.error('Failed parsing state, resetting to defaults.', e);
        this.resetStateToDefault();
      }
    } else {
      this.resetStateToDefault();
    }
  }

  resetStateToDefault() {
    this.state.habits = JSON.parse(JSON.stringify(this.defaultHabits));
    this.state.hydration = {};
    this.state.themeOverride = null;
    this.saveState();
  }

  // --- Save State to LocalStorage ---
  saveState() {
    const dataToSave = {
      habits: this.state.habits,
      hydration: this.state.hydration,
      themeOverride: this.state.themeOverride
    };
    localStorage.setItem(this.storageKey, JSON.stringify(dataToSave));
  }

  // --- Cache DOM Elements ---
  cacheDOM() {
    this.elements.body = document.body;
    this.elements.greeting = document.getElementById('greeting-text');
    this.elements.day = document.getElementById('current-day');
    this.elements.time = document.getElementById('current-time');
    
    this.elements.overallPercentage = document.getElementById('overall-percentage');
    this.elements.morningGauge = document.getElementById('morning-gauge');
    this.elements.morningRatio = document.getElementById('morning-ratio');
    this.elements.eveningGauge = document.getElementById('evening-gauge');
    this.elements.eveningRatio = document.getElementById('evening-ratio');
    
    this.elements.waterIntake = document.getElementById('water-intake');
    this.elements.bottlesGrid = document.getElementById('bottles-grid');
    
    this.elements.currentStreakVal = document.getElementById('current-streak-val');
    this.elements.bestStreakVal = document.getElementById('best-streak-val');
    this.elements.streakMotivation = document.getElementById('streak-motivation-msg');
    
    this.elements.tabMorning = document.getElementById('tab-morning');
    this.elements.tabEvening = document.getElementById('tab-evening');
    this.elements.addHabitBtn = document.getElementById('add-habit-btn');
    this.elements.habitListContainer = document.getElementById('habit-list-container');
    
    this.elements.weeklyDaysGrid = document.getElementById('weekly-days-grid');
    this.elements.themeToggleBtn = document.getElementById('theme-toggle-btn');
    
    // Modal
    this.elements.modal = document.getElementById('habit-modal');
    this.elements.modalForm = document.getElementById('add-habit-form');
    this.elements.closeModalBtn = document.getElementById('close-modal-btn');
    this.elements.cancelModalBtn = document.getElementById('cancel-modal-btn');
  }

  // --- Determine initial active routine ---
  determineInitialRoutine() {
    const hour = new Date().getHours();
    // Morning: 5 AM to 4 PM (16:00)
    if (hour >= 5 && hour < 16) {
      this.state.activeRoutine = 'morning';
    } else {
      this.state.activeRoutine = 'evening';
    }
  }

  // --- Get Date String (Timezone Accurate YYYY-MM-DD) ---
  getLocalDateString(date = new Date()) {
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  }

  // --- Clock Loop ---
  startClock() {
    const updateTime = () => {
      const now = new Date();
      
      // Update Day
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      this.elements.day.textContent = days[now.getDay()];
      
      // Format Time
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      const formattedTime = `${hours}:${minutes} ${ampm}`;
      
      this.elements.time.textContent = formattedTime;
      
      // Update dynamic greeting header depending on time
      this.updateGreetingText(now.getHours());
      
      // Theme switching based on dynamic check if no manual override
      this.updateThemeStyle(now.getHours());
    };
    
    updateTime();
    setInterval(updateTime, 10000); // Update every 10 seconds to minimize CPU load
  }

  // --- Greeting Customization for Nihu ---
  updateGreetingText(hour) {
    let greeting = '';
    if (hour >= 5 && hour < 12) {
      greeting = 'Rise & Shine, Nihu! 🌅';
    } else if (hour >= 12 && hour < 17) {
      greeting = 'Good Afternoon, Nihu! ☀️';
    } else if (hour >= 17 && hour < 22) {
      greeting = 'Good Evening, Nihu! 🌌';
    } else {
      greeting = 'Time to Unwind, Nihu! 🌙';
    }
    
    if (this.elements.greeting.textContent !== greeting) {
      this.elements.greeting.textContent = greeting;
    }
  }

  // --- Theme Class Manager ---
  updateThemeStyle(hour) {
    // If user set an override, honor it
    if (this.state.themeOverride) {
      this.elements.body.className = this.state.themeOverride === 'morning' ? 'morning-theme' : 'evening-theme';
      return;
    }
    
    // Otherwise calculate dynamically
    if (hour >= 5 && hour < 16) {
      this.elements.body.className = 'morning-theme';
    } else {
      this.elements.body.className = 'evening-theme';
    }
  }

  // --- Setup Event Handlers ---
  setupEventListeners() {
    // Manual Theme override toggle
    this.elements.themeToggleBtn.addEventListener('click', () => {
      const currentClass = this.elements.body.className;
      if (currentClass === 'morning-theme') {
        this.state.themeOverride = 'evening';
      } else {
        this.state.themeOverride = 'morning';
      }
      this.saveState();
      this.render();
    });

    // Routine Tabs Toggle
    this.elements.tabMorning.addEventListener('click', () => {
      this.state.activeRoutine = 'morning';
      this.render();
    });

    this.elements.tabEvening.addEventListener('click', () => {
      this.state.activeRoutine = 'evening';
      this.render();
    });

    // Modal Control
    this.elements.addHabitBtn.addEventListener('click', () => this.openModal());
    this.elements.closeModalBtn.addEventListener('click', () => this.closeModal());
    this.elements.cancelModalBtn.addEventListener('click', () => this.closeModal());
    
    // Form Submit
    this.elements.modalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('habit-name').value.trim();
      const desc = document.getElementById('habit-desc').value.trim();
      const routine = document.querySelector('input[name="habit-routine"]:checked').value;
      
      if (name) {
        this.addHabit(name, desc, routine);
        this.closeModal();
      }
    });

    // Hydration Bottles Grid Interactions
    const bottleBtns = this.elements.bottlesGrid.querySelectorAll('.bottle-btn');
    bottleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'));
        const dateStr = this.getLocalDateString();
        const currentIntake = this.state.hydration[dateStr] || 0;
        
        let newIntake = idx + 1;
        // If they click the same active bottle (e.g. index 2 with water intake 3), toggle it down to index 2 (water intake 2)
        if (currentIntake === idx + 1) {
          newIntake = idx;
        }
        
        this.state.hydration[dateStr] = newIntake;
        this.saveState();
        this.render();
      });
    });
  }

  // --- Modal Utilities ---
  openModal() {
    this.elements.modal.classList.add('active');
    document.getElementById('habit-name').focus();
    // Default form routine to the currently open tab routine
    const radios = document.getElementsByName('habit-routine');
    radios.forEach(r => {
      r.checked = (r.value === this.state.activeRoutine);
    });
  }

  closeModal() {
    this.elements.modal.classList.remove('active');
    this.elements.modalForm.reset();
  }

  // --- Add Custom Habit ---
  addHabit(name, desc, routine) {
    const newHabit = {
      id: 'h_' + Date.now(),
      name: name,
      desc: desc || '',
      routine: routine,
      history: {},
      streak: 0
    };
    
    this.state.habits.push(newHabit);
    this.saveState();
    this.render();
  }

  // --- Delete Habit ---
  deleteHabit(id) {
    this.state.habits = this.state.habits.filter(h => h.id !== id);
    this.saveState();
    this.render();
  }

  // --- Toggle Habit Completion ---
  toggleHabitCompletion(id, dateStr) {
    const habit = this.state.habits.find(h => h.id === id);
    if (habit) {
      if (habit.history[dateStr]) {
        delete habit.history[dateStr];
      } else {
        habit.history[dateStr] = true;
      }
      this.saveState();
      this.render();
    }
  }

  // --- Streaks Core Engine ---
  calculateStreaks() {
    // Gather all dates where AT LEAST ONE habit of any routine was completed
    const completedDates = new Set();
    this.state.habits.forEach(h => {
      Object.keys(h.history).forEach(d => {
        if (h.history[d]) {
          completedDates.add(d);
        }
      });
    });

    const sortedDates = Array.from(completedDates).sort();
    if (sortedDates.length === 0) {
      return { current: 0, best: 0 };
    }

    const getDayDifference = (d1, d2) => {
      const diffTime = Math.abs(new Date(d2) - new Date(d1));
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    };

    // Calculate Best Streak
    let best = 0;
    let running = 0;
    let prevDateStr = null;

    sortedDates.forEach(dateStr => {
      if (prevDateStr === null) {
        running = 1;
      } else {
        const diff = getDayDifference(prevDateStr, dateStr);
        if (diff === 1) {
          running++;
        } else if (diff > 1) {
          if (running > best) best = running;
          running = 1;
        }
      }
      prevDateStr = dateStr;
    });
    if (running > best) best = running;

    // Calculate Current Streak
    const todayStr = this.getLocalDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.getLocalDateString(yesterday);

    let current = 0;
    let startPoint = null;

    if (completedDates.has(todayStr)) {
      startPoint = new Date(todayStr);
    } else if (completedDates.has(yesterdayStr)) {
      startPoint = new Date(yesterdayStr);
    }

    if (startPoint) {
      current = 1;
      let checkDate = new Date(startPoint);
      while (true) {
        checkDate.setDate(checkDate.getDate() - 1);
        const checkStr = this.getLocalDateString(checkDate);
        if (completedDates.has(checkStr)) {
          current++;
        } else {
          break;
        }
      }
    }

    return { current, best: Math.max(best, current) };
  }

  // --- Render Orchestrator ---
  render() {
    const todayStr = this.getLocalDateString();
    
    // Update theme overrides if specified
    if (this.state.themeOverride) {
      this.elements.body.className = this.state.themeOverride === 'morning' ? 'morning-theme' : 'evening-theme';
    } else {
      this.updateThemeStyle(new Date().getHours());
    }

    // --- 1. Render Tabs UI ---
    if (this.state.activeRoutine === 'morning') {
      this.elements.tabMorning.classList.add('active');
      this.elements.tabEvening.classList.remove('active');
    } else {
      this.elements.tabMorning.classList.remove('active');
      this.elements.tabEvening.classList.add('active');
    }

    // --- 2. Render Overall Gauge Progression ---
    const morningHabits = this.state.habits.filter(h => h.routine === 'morning');
    const eveningHabits = this.state.habits.filter(h => h.routine === 'evening');

    const morningCompleted = morningHabits.filter(h => h.history[todayStr]).length;
    const eveningCompleted = eveningHabits.filter(h => h.history[todayStr]).length;

    const totalHabitsCount = this.state.habits.length;
    const totalCompletedCount = morningCompleted + eveningCompleted;
    
    // Overall Percentage
    const percentage = totalHabitsCount > 0 ? Math.round((totalCompletedCount / totalHabitsCount) * 100) : 0;
    this.elements.overallPercentage.textContent = `${percentage}% Done`;

    // Morning Ratio & Circular SVG Gauge (diameter = 64, circumference = 2 * PI * r = 2 * Math.PI * 32 = 201)
    this.elements.morningRatio.textContent = `${morningCompleted}/${morningHabits.length}`;
    const morningOffset = morningHabits.length > 0 ? 201 - (morningCompleted / morningHabits.length) * 201 : 201;
    this.elements.morningGauge.setAttribute('stroke-dashoffset', morningOffset);

    // Evening Ratio & Circular SVG Gauge
    this.elements.eveningRatio.textContent = `${eveningCompleted}/${eveningHabits.length}`;
    const eveningOffset = eveningHabits.length > 0 ? 201 - (eveningCompleted / eveningHabits.length) * 201 : 201;
    this.elements.eveningGauge.setAttribute('stroke-dashoffset', eveningOffset);

    // --- 3. Hydration Rendering ---
    const waterLevel = this.state.hydration[todayStr] || 0;
    this.elements.waterIntake.textContent = waterLevel;
    
    const bottleBtns = this.elements.bottlesGrid.querySelectorAll('.bottle-btn');
    bottleBtns.forEach((btn, idx) => {
      if (idx < waterLevel) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // --- 4. Streaks Metric Rendering ---
    const streaks = this.calculateStreaks();
    this.elements.currentStreakVal.textContent = streaks.current;
    this.elements.bestStreakVal.textContent = streaks.best;
    
    // Streaks feedback message
    if (streaks.current > 0) {
      this.elements.streakMotivation.textContent = `Amazing! You are holding a ${streaks.current}-day habit streak. Keep going!`;
    } else {
      this.elements.streakMotivation.textContent = `Start completion today to build momentum!`;
    }

    // --- 5. Render Habit Cards Checklist ---
    const filteredHabits = this.state.habits.filter(h => h.routine === this.state.activeRoutine);
    this.elements.habitListContainer.innerHTML = '';
    
    if (filteredHabits.length === 0) {
      // Empty routine container
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'glass-card empty-state';
      emptyDiv.innerHTML = `
        <i data-lucide="sparkles"></i>
        <h3>No Rituals Set</h3>
        <p>No habits scheduled for your ${this.state.activeRoutine} routine. Add one above to begin tracking!</p>
      `;
      this.elements.habitListContainer.appendChild(emptyDiv);
    } else {
      filteredHabits.forEach(habit => {
        const isCompleted = !!habit.history[todayStr];
        const card = document.createElement('div');
        card.className = `glass-card habit-card ${isCompleted ? 'completed' : ''}`;
        
        card.innerHTML = `
          <div class="habit-card-left">
            <label class="checkbox-container">
              <input type="checkbox" ${isCompleted ? 'checked' : ''} data-id="${habit.id}">
              <span class="checkbox-custom">
                <i data-lucide="check"></i>
              </span>
            </label>
            <div class="habit-details">
              <div class="habit-title-line">
                <span class="habit-title">${habit.name}</span>
                <span class="habit-routine-indicator">
                  <i data-lucide="${habit.routine === 'morning' ? 'sunrise' : 'moon'}"></i>
                  ${habit.routine}
                </span>
              </div>
              ${habit.desc ? `<span class="habit-desc">${habit.desc}</span>` : ''}
            </div>
          </div>
          <div class="habit-card-right">
            <button class="delete-habit-btn" data-id="${habit.id}" title="Remove Habit">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;
        
        // Add completion change listener
        const checkbox = card.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
          this.toggleHabitCompletion(habit.id, todayStr);
        });
        
        // Add delete listener
        const deleteBtn = card.querySelector('.delete-habit-btn');
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Are you sure you want to remove "${habit.name}"?`)) {
            this.deleteHabit(habit.id);
          }
        });
        
        this.elements.habitListContainer.appendChild(card);
      });
    }

    // --- 6. Render Weekly Vis Log Calendar ---
    this.renderWeeklyLog();

    // Re-initialize Lucide Icons on dynamic elements
    lucide.createIcons();
  }

  // --- Render Weekly Progress Dots Grid ---
  renderWeeklyLog() {
    this.elements.weeklyDaysGrid.innerHTML = '';
    
    const daysArr = [];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Generate last 7 days backward
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      daysArr.push(d);
    }
    
    daysArr.forEach(date => {
      const dateStr = this.getLocalDateString(date);
      const isToday = dateStr === this.getLocalDateString();
      
      const dayName = weekdays[date.getDay()];
      const dayNum = date.getDate();
      
      // Check if morning habits were completed
      const morningHabits = this.state.habits.filter(h => h.routine === 'morning');
      const morningCompletedAny = morningHabits.some(h => h.history[dateStr]);
      
      // Check if evening habits were completed
      const eveningHabits = this.state.habits.filter(h => h.routine === 'evening');
      const eveningCompletedAny = eveningHabits.some(h => h.history[dateStr]);
      
      const dayCol = document.createElement('div');
      dayCol.className = `day-column ${isToday ? 'today' : ''}`;
      
      dayCol.innerHTML = `
        <span class="day-name">${dayName}</span>
        <span class="day-number">${dayNum}</span>
        <div class="day-indicators">
          <div class="ind-dot ${morningCompletedAny ? 'morning-done' : ''}" title="Morning Routine Completion"></div>
          <div class="ind-dot ${eveningCompletedAny ? 'evening-done' : ''}" title="Evening Routine Completion"></div>
        </div>
      `;
      
      this.elements.weeklyDaysGrid.appendChild(dayCol);
    });
  }
}

// --- Bootstrap AuraHabit Application ---
document.addEventListener('DOMContentLoaded', () => {
  window.auraHabitAppInstance = new AuraHabitApp();
});
