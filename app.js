// AuraHabit Core Logic - Designed for Nihu & Pruthu

// --- Application State Manager ---
class AuraHabitApp {
  constructor() {
    this.storageKey = 'aurahabit_state_v1';
    
    // Default Habits Setup (used to initialize profiles)
    this.defaultHabits = [
      { id: 'h3', name: 'Make bed', desc: 'Set a neat tone for the day', routine: 'morning', history: {}, streak: 0 },
      { id: 'h1', name: 'Meditate', desc: 'Focus on breathing & mindfulness', routine: 'morning', history: {}, streak: 0 },
      { id: 'h2', name: 'Journal', desc: 'Reflect and plan the day', routine: 'morning', history: {}, streak: 0 },
      { id: 'h4', name: 'Protein Intake', desc: 'Fuel your morning structure', routine: 'morning', history: {}, streak: 0 },
      { id: 'h5', name: 'Workout', desc: 'Get moving and build strength', routine: 'evening', history: {}, streak: 0 },
      { id: 'h6', name: 'Protein Intake', desc: 'Support recovery and repair', routine: 'evening', history: {}, streak: 0 },
      { id: 'h7', name: 'Reading', desc: 'Wind down with a book', routine: 'evening', history: {}, streak: 0 }
    ];

    this.state = {
      currentUser: 'Nihu', // 'Nihu' | 'Pruthu'
      profiles: {
        'Nihu': {
          habits: [],
          hydration: {}
        },
        'Pruthu': {
          habits: [],
          hydration: {}
        }
      },
      activeRoutine: 'morning', // 'morning' | 'evening'
      themeOverride: null, // 'morning' | 'evening' | null (null auto-calculates based on time)
      selectedDate: this.getLocalDateString()
    };

    // Supabase State
    this.supabase = null;
    this.isCloudEnabled = false;

    // DOM Caching
    this.elements = {};
    
    // Initialize
    this.init();
  }

  // --- Initialize App ---
  init() {
    this.cacheDOM();
    this.setupLockScreen();
  }

  setupLockScreen() {
    const isUnlocked = localStorage.getItem('aurahabit_unlocked') === 'true';
    const lockScreen = document.getElementById('lock-screen');
    
    if (isUnlocked) {
      if (lockScreen) lockScreen.classList.add('hidden');
      this.continueInitialization();
    } else {
      const lockForm = document.getElementById('lock-form');
      if (lockForm) {
        lockForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const input = document.getElementById('passcode-input');
          const errorMsg = document.getElementById('lock-error-msg');
          
          if (input && input.value === 'pvnrt') {
            localStorage.setItem('aurahabit_unlocked', 'true');
            if (lockScreen) lockScreen.classList.add('hidden');
            this.continueInitialization();
          } else {
            if (input) input.value = '';
            if (errorMsg) {
              errorMsg.style.display = 'block';
              errorMsg.style.animation = 'none';
              void errorMsg.offsetWidth; // trigger reflow
              errorMsg.style.animation = 'shakeInput 0.3s ease';
            }
          }
        });
      }
    }
  }

  continueInitialization() {
    this.loadState();
    this.initSupabase();
    this.determineInitialRoutine();
    this.setupEventListeners();
    this.startClock();
    
    // Initial Render
    this.render();

    // Trigger Supabase Cloud Sync
    if (this.isCloudEnabled) {
      this.syncAllProfilesFromCloud();
    }
  }

  // --- Initialize Supabase Client ---
  initSupabase() {
    const url = localStorage.getItem('aurahabit_supabase_url');
    const key = localStorage.getItem('aurahabit_supabase_key');
    
    if (url && key && typeof supabase !== 'undefined') {
      try {
        this.supabase = supabase.createClient(url, key);
        this.isCloudEnabled = true;
      } catch (err) {
        console.error('Failed to initialize Supabase client:', err);
        this.supabase = null;
        this.isCloudEnabled = false;
      }
    } else {
      this.supabase = null;
      this.isCloudEnabled = false;
    }
  }

  // --- Supabase Cloud Sync Operations ---
  setCloudStatus(status) { // 'synced' | 'syncing' | 'offline'
    if (!this.elements.cloudStatus) return;
    this.elements.cloudStatus.className = 'cloud-status-indicator ' + status;
    
    let title = 'Cloud Sync: ';
    if (!this.isCloudEnabled) {
      this.elements.cloudStatus.className = 'cloud-status-indicator offline';
      title += 'Not configured. Tap settings gear to set up Supabase sync.';
    } else {
      if (status === 'synced') title += 'All changes saved to Supabase';
      if (status === 'syncing') title += 'Syncing changes with Supabase...';
      if (status === 'offline') title += 'Cannot connect to Supabase. Storing changes locally.';
    }
    this.elements.cloudStatus.setAttribute('title', title);
  }

  async syncProfileFromCloud(user) {
    if (!this.isCloudEnabled) {
      this.setCloudStatus('offline');
      return false;
    }
    this.setCloudStatus('syncing');
    try {
      // 1. Fetch habits from Supabase
      const { data: habitsData, error: habitsError } = await this.supabase
        .from('habits')
        .select('*')
        .eq('profile_name', user);
        
      if (habitsError) throw habitsError;
      
      // 2. Fetch hydration logs from Supabase
      const { data: hydrationData, error: hydrationError } = await this.supabase
        .from('hydration')
        .select('*')
        .eq('profile_name', user);
        
      if (hydrationError) throw hydrationError;

      const activeProfile = this.state.profiles[user];
      
      // Map database rows back to our habits state format
      if (habitsData && habitsData.length > 0) {
        activeProfile.habits = habitsData.map(h => ({
          id: h.id,
          name: h.name,
          desc: h.description || '',
          routine: h.routine,
          history: h.history || {}
        }));
      } else {
        // If no habits exist on Supabase, upload local defaults
        await this.syncProfileToCloud(user);
      }

      // Map hydration database rows back to our hydration state format
      if (hydrationData) {
        activeProfile.hydration = {};
        hydrationData.forEach(row => {
          activeProfile.hydration[row.log_date] = row.bottles;
        });
      }
      
      this.saveState();
      this.setCloudStatus('synced');
      return true;
    } catch (err) {
      console.warn(`Could not sync profile ${user} from Supabase:`, err);
      this.setCloudStatus('offline');
    }
    return false;
  }

  async syncProfileToCloud(user) {
    if (!this.isCloudEnabled) return false;
    this.setCloudStatus('syncing');
    const activeProfile = this.state.profiles[user];
    try {
      // 1. Upsert habits to Supabase
      const habitsToUpsert = activeProfile.habits.map(h => ({
        id: h.id,
        profile_name: user,
        name: h.name,
        description: h.desc,
        routine: h.routine,
        history: h.history
      }));

      if (habitsToUpsert.length > 0) {
        const { error: habitsError } = await this.supabase
          .from('habits')
          .upsert(habitsToUpsert);
        if (habitsError) throw habitsError;
      }

      // 2. Upsert hydration logs to Supabase
      const hydrationToUpsert = Object.keys(activeProfile.hydration).map(dateStr => ({
        profile_name: user,
        log_date: dateStr,
        bottles: activeProfile.hydration[dateStr]
      }));

      if (hydrationToUpsert.length > 0) {
        const { error: hydrationError } = await this.supabase
          .from('hydration')
          .upsert(hydrationToUpsert);
        if (hydrationError) throw hydrationError;
      }

      this.setCloudStatus('synced');
      return true;
    } catch (err) {
      console.warn(`Could not sync profile ${user} to Supabase:`, err);
      this.setCloudStatus('offline');
    }
    return false;
  }

  async syncAllProfilesFromCloud() {
    const users = Object.keys(this.state.profiles);
    let rendered = false;
    for (const user of users) {
      const success = await this.syncProfileFromCloud(user);
      if (success && user === this.state.currentUser) {
        this.render();
        rendered = true;
      }
    }
    if (!rendered) {
      this.setCloudStatus('synced');
    }
  }

  // --- Load State from LocalStorage (with Migration Support) ---
  loadState() {
    const raw = localStorage.getItem(this.storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.profiles) {
          this.state.profiles = parsed.profiles;
          this.state.currentUser = parsed.currentUser || 'Nihu';
        } else {
          // Migrate old structure v1 (preserves Nihu's ticks)
          this.state.profiles = {
            'Nihu': {
              habits: parsed.habits || JSON.parse(JSON.stringify(this.defaultHabits)),
              hydration: parsed.hydration || {}
            },
            'Pruthu': {
              habits: JSON.parse(JSON.stringify(this.defaultHabits)),
              hydration: {}
            }
          };
          this.state.currentUser = 'Nihu';
        }
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
    this.state.profiles = {
      'Nihu': {
        habits: JSON.parse(JSON.stringify(this.defaultHabits)),
        hydration: {}
      },
      'Pruthu': {
        habits: JSON.parse(JSON.stringify(this.defaultHabits)),
        hydration: {}
      }
    };
    this.state.currentUser = 'Nihu';
    this.state.themeOverride = null;
    this.saveState();
  }

  // --- Save State to LocalStorage ---
  saveState() {
    const dataToSave = {
      profiles: this.state.profiles,
      currentUser: this.state.currentUser,
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
    
    // Profile Elements
    this.elements.userSubtitle = document.getElementById('user-subtitle');
    this.elements.currentUserName = document.getElementById('current-user-name');
    this.elements.profileSelectBtn = document.getElementById('profile-select-btn');
    this.elements.profileMenu = document.getElementById('profile-menu');
    this.elements.cloudStatus = document.getElementById('cloud-status');
    
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
    
    // Modal Habit
    this.elements.modal = document.getElementById('habit-modal');
    this.elements.modalForm = document.getElementById('add-habit-form');
    this.elements.closeModalBtn = document.getElementById('close-modal-btn');
    this.elements.cancelModalBtn = document.getElementById('cancel-modal-btn');

    // Modal Settings
    this.elements.settingsToggle = document.getElementById('settings-toggle-btn');
    this.elements.settingsModal = document.getElementById('settings-modal');
    this.elements.settingsForm = document.getElementById('settings-form');
    this.elements.closeSettingsBtn = document.getElementById('close-settings-modal-btn');
    this.elements.cancelSettingsBtn = document.getElementById('cancel-settings-btn');
    this.elements.sbUrl = document.getElementById('sb-url');
    this.elements.sbKey = document.getElementById('sb-key');
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
      if (this.elements.day) this.elements.day.textContent = days[now.getDay()];
      
      // Format Time
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      const formattedTime = `${hours}:${minutes} ${ampm}`;
      
      if (this.elements.time) this.elements.time.textContent = formattedTime;
      
      // Update dynamic greeting header depending on time
      this.updateGreetingText(now.getHours());
      
      // Theme switching based on dynamic check if no manual override
      this.updateThemeStyle(now.getHours());
    };
    
    updateTime();
    setInterval(updateTime, 10000); // Update every 10 seconds to minimize CPU load
  }

  // --- Greeting Customization for Profiles ---
  updateGreetingText(hour) {
    const user = this.state.currentUser;
    let greeting = '';
    if (this.state.activeRoutine === 'morning') {
      if (hour >= 12 && hour < 17) {
        greeting = `Good Afternoon, ${user}!`;
      } else {
        greeting = `Rise & Shine, ${user}!`;
      }
    } else {
      if (hour >= 22 || hour < 5) {
        greeting = `Time to Unwind, ${user}!`;
      } else {
        greeting = `Good Evening, ${user}!`;
      }
    }
    
    if (this.elements.greeting && this.elements.greeting.textContent !== greeting) {
      this.elements.greeting.textContent = greeting;
    }
  }

  updateThemeStyle(hour) {
    let theme;
    if (this.state.themeOverride) {
      theme = this.state.themeOverride;
    } else {
      theme = (hour >= 5 && hour < 16) ? 'morning' : 'evening';
    }
    
    this.elements.body.className = theme === 'morning' ? 'morning-theme' : 'evening-theme';
    
    // Sync active routine with currently active theme
    if (this.state.activeRoutine !== theme) {
      this.state.activeRoutine = theme;
    }
  }

  // --- Setup Event Handlers ---
  setupEventListeners() {
    // Manual Theme override toggle
    this.elements.themeToggleBtn.addEventListener('click', () => {
      const currentClass = this.elements.body.className;
      if (currentClass === 'morning-theme') {
        this.state.themeOverride = 'evening';
        this.state.activeRoutine = 'evening';
      } else {
        this.state.themeOverride = 'morning';
        this.state.activeRoutine = 'morning';
      }
      this.saveState();
      this.render();
    });

    // Profile Dropdown Toggle
    if (this.elements.profileSelectBtn) {
      this.elements.profileSelectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.elements.profileSelectBtn.parentElement.classList.toggle('active');
      });
    }

    // Close Dropdown on outside click
    document.addEventListener('click', () => {
      if (this.elements.profileSelectBtn) {
        this.elements.profileSelectBtn.parentElement.classList.remove('active');
      }
    });

    // Profile switch selection click
    if (this.elements.profileMenu) {
      const menuItems = this.elements.profileMenu.querySelectorAll('.profile-menu-item');
      menuItems.forEach(item => {
        item.addEventListener('click', () => {
          const user = item.getAttribute('data-user');
          this.state.currentUser = user;
          
          this.saveState();
          this.render();

          // Sync profile values from cloud upon switching
          if (this.isCloudEnabled) {
            this.syncProfileFromCloud(user).then((success) => {
              if (success) this.render();
            });
          }
        });
      });
    }

    // Modal Habits Controls
    this.elements.addHabitBtn.addEventListener('click', () => this.openModal());
    this.elements.closeModalBtn.addEventListener('click', () => this.closeModal());
    this.elements.cancelModalBtn.addEventListener('click', () => this.closeModal());

    // Modal Settings Controls
    if (this.elements.settingsToggle) {
      this.elements.settingsToggle.addEventListener('click', () => this.openSettingsModal());
    }
    if (this.elements.closeSettingsBtn) {
      this.elements.closeSettingsBtn.addEventListener('click', () => this.closeSettingsModal());
    }
    if (this.elements.cancelSettingsBtn) {
      this.elements.cancelSettingsBtn.addEventListener('click', () => this.closeSettingsModal());
    }

    // Settings Submit Form
    if (this.elements.settingsForm) {
      this.elements.settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = this.elements.sbUrl.value.trim();
        const key = this.elements.sbKey.value.trim();
        
        if (url && key) {
          localStorage.setItem('aurahabit_supabase_url', url);
          localStorage.setItem('aurahabit_supabase_key', key);
          
          // Re-initialize Supabase client
          this.initSupabase();
          this.closeSettingsModal();
          this.render();
          
          if (this.isCloudEnabled) {
            // Immediately sync with new database, pushing local backups first
            this.syncProfileToCloud('Nihu');
            this.syncProfileToCloud('Pruthu');
            this.syncAllProfilesFromCloud();
          }
        }
      });
    }
    
    // Form Submit (Habit)
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
        const dateStr = this.state.selectedDate;
        const activeProfile = this.state.profiles[this.state.currentUser];
        const currentIntake = activeProfile.hydration[dateStr] || 0;
        
        let newIntake = idx + 1;
        if (currentIntake === idx + 1) {
          newIntake = idx;
        }
        
        activeProfile.hydration[dateStr] = newIntake;
        this.saveState();
        this.render();

        // Push hydration updates to cloud database
        if (this.isCloudEnabled) {
          this.syncProfileToCloud(this.state.currentUser);
        }
      });
    });

    // Routine Tabs Toggle
    this.elements.tabMorning.addEventListener('click', () => {
      this.state.activeRoutine = 'morning';
      this.state.themeOverride = 'morning';
      this.saveState();
      this.render();
    });

    this.elements.tabEvening.addEventListener('click', () => {
      this.state.activeRoutine = 'evening';
      this.state.themeOverride = 'evening';
      this.saveState();
      this.render();
    });
  }

  // --- Modal Utilities ---
  openModal() {
    this.elements.modal.classList.add('active');
    document.getElementById('habit-name').focus();
    const radios = document.getElementsByName('habit-routine');
    radios.forEach(r => {
      r.checked = (r.value === this.state.activeRoutine);
    });
  }

  closeModal() {
    this.elements.modal.classList.remove('active');
    this.elements.modalForm.reset();
  }

  openSettingsModal() {
    if (this.elements.settingsModal) {
      this.elements.sbUrl.value = localStorage.getItem('aurahabit_supabase_url') || '';
      this.elements.sbKey.value = localStorage.getItem('aurahabit_supabase_key') || '';
      this.elements.settingsModal.classList.add('active');
      this.elements.sbUrl.focus();
    }
  }

  closeSettingsModal() {
    if (this.elements.settingsModal) {
      this.elements.settingsModal.classList.remove('active');
      this.elements.settingsForm.reset();
    }
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
    
    this.state.profiles[this.state.currentUser].habits.push(newHabit);
    this.saveState();
    this.render();

    // Push addition to cloud database
    if (this.isCloudEnabled) {
      this.syncProfileToCloud(this.state.currentUser);
    }
  }

  // --- Delete Habit ---
  async deleteHabit(id) {
    const activeProfile = this.state.profiles[this.state.currentUser];
    activeProfile.habits = activeProfile.habits.filter(h => h.id !== id);
    this.saveState();
    this.render();

    // Push deletion to cloud database
    if (this.isCloudEnabled) {
      try {
        const { error } = await this.supabase
          .from('habits')
          .delete()
          .eq('id', id);
        if (error) throw error;
        this.setCloudStatus('synced');
      } catch (err) {
        console.warn(`Could not delete habit on Supabase:`, err);
        this.setCloudStatus('offline');
      }
    }
  }

  // --- Toggle Habit Completion ---
  toggleHabitCompletion(id, dateStr) {
    const activeProfile = this.state.profiles[this.state.currentUser];
    const habit = activeProfile.habits.find(h => h.id === id);
    if (habit) {
      if (habit.history[dateStr]) {
        delete habit.history[dateStr];
      } else {
        habit.history[dateStr] = true;
      }
      this.saveState();
      this.render();

      // Push tick changes to cloud database
      if (this.isCloudEnabled) {
        this.syncProfileToCloud(this.state.currentUser);
      }
    }
  }

  // --- Streaks Core Engine ---
  calculateStreaks() {
    const activeProfile = this.state.profiles[this.state.currentUser];
    const completedDates = new Set();
    
    activeProfile.habits.forEach(h => {
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
    const selectedDateStr = this.state.selectedDate;
    const currentUser = this.state.currentUser;
    const activeProfile = this.state.profiles[currentUser];
    
    // --- 0. Update Profile Header Text & Dropdown Items ---
    if (this.elements.currentUserName) this.elements.currentUserName.textContent = currentUser;
    if (this.elements.userSubtitle) this.elements.userSubtitle.textContent = `${currentUser}'s Space`;
    
    // Update dynamic clocks / greetings immediately
    const hour = new Date().getHours();
    this.updateGreetingText(hour);

    if (this.elements.themeOverride) {
      this.elements.body.className = this.state.themeOverride === 'morning' ? 'morning-theme' : 'evening-theme';
    } else {
      this.updateThemeStyle(hour);
    }

    // Update cloud status display
    this.setCloudStatus('synced');

    // Toggle active markers in dropdown list
    if (this.elements.profileMenu) {
      const menuItems = this.elements.profileMenu.querySelectorAll('.profile-menu-item');
      menuItems.forEach(mi => {
        if (mi.getAttribute('data-user') === currentUser) {
          mi.classList.add('active');
        } else {
          mi.classList.remove('active');
        }
      });
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
    const morningHabits = activeProfile.habits.filter(h => h.routine === 'morning');
    const eveningHabits = activeProfile.habits.filter(h => h.routine === 'evening');

    const morningCompleted = morningHabits.filter(h => h.history[selectedDateStr]).length;
    const eveningCompleted = eveningHabits.filter(h => h.history[selectedDateStr]).length;

    const totalHabitsCount = activeProfile.habits.length;
    const totalCompletedCount = morningCompleted + eveningCompleted;
    
    // Overall Percentage
    const percentage = totalHabitsCount > 0 ? Math.round((totalCompletedCount / totalHabitsCount) * 100) : 0;
    this.elements.overallPercentage.textContent = `${percentage}% Done`;

    // Morning Ratio SVG Gauge
    this.elements.morningRatio.textContent = `${morningCompleted}/${morningHabits.length}`;
    const morningOffset = morningHabits.length > 0 ? 201 - (morningCompleted / morningHabits.length) * 201 : 201;
    this.elements.morningGauge.setAttribute('stroke-dashoffset', morningOffset);

    // Evening Ratio SVG Gauge
    this.elements.eveningRatio.textContent = `${eveningCompleted}/${eveningHabits.length}`;
    const eveningOffset = eveningHabits.length > 0 ? 201 - (eveningCompleted / eveningHabits.length) * 201 : 201;
    this.elements.eveningGauge.setAttribute('stroke-dashoffset', eveningOffset);

    // --- 3. Hydration Rendering ---
    const waterLevel = activeProfile.hydration[selectedDateStr] || 0;
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
    
    if (streaks.current > 0) {
      this.elements.streakMotivation.textContent = `Amazing! ${currentUser} holds a ${streaks.current}-day habit streak!`;
    } else {
      this.elements.streakMotivation.textContent = `Start completion today to build momentum!`;
    }

    // --- 5. Render Habit Cards Checklist ---
    // Ensure Make Bed is always at the top of the morning routine list
    const makeBedIdx = activeProfile.habits.findIndex(h => h.name.toLowerCase() === 'make bed' && h.routine === 'morning');
    if (makeBedIdx > 0) {
      const [makeBedHabit] = activeProfile.habits.splice(makeBedIdx, 1);
      activeProfile.habits.unshift(makeBedHabit);
      this.saveState();
      if (this.isCloudEnabled) {
        this.syncProfileToCloud(this.state.currentUser);
      }
    }

    const filteredHabits = activeProfile.habits.filter(h => h.routine === this.state.activeRoutine);
    this.elements.habitListContainer.innerHTML = '';
    
    if (filteredHabits.length === 0) {
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
        const isCompleted = !!habit.history[selectedDateStr];
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
        
        const checkbox = card.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
          this.toggleHabitCompletion(habit.id, selectedDateStr);
        });
        
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
    const activeProfile = this.state.profiles[this.state.currentUser];
    
    const daysArr = [];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      daysArr.push(d);
    }
    
    daysArr.forEach(date => {
      const dateStr = this.getLocalDateString(date);
      const isToday = dateStr === this.getLocalDateString();
      const isSelected = dateStr === this.state.selectedDate;
      
      const dayName = weekdays[date.getDay()];
      const dayNum = date.getDate();
      
      const morningHabits = activeProfile.habits.filter(h => h.routine === 'morning');
      const morningCompletedAny = morningHabits.some(h => h.history[dateStr]);
      
      const eveningHabits = activeProfile.habits.filter(h => h.routine === 'evening');
      const eveningCompletedAny = eveningHabits.some(h => h.history[dateStr]);
      
      const dayCol = document.createElement('div');
      dayCol.className = `day-column ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`;
      dayCol.style.cursor = 'pointer';
      
      dayCol.innerHTML = `
        <span class="day-name">${dayName}</span>
        <span class="day-number">${dayNum}</span>
        <div class="day-indicators">
          <div class="ind-dot ${morningCompletedAny ? 'morning-done' : ''}" title="Morning Routine Completion"></div>
          <div class="ind-dot ${eveningCompletedAny ? 'evening-done' : ''}" title="Evening Routine Completion"></div>
        </div>
      `;
      
      dayCol.addEventListener('click', () => {
        this.state.selectedDate = dateStr;
        this.render();
      });
      
      this.elements.weeklyDaysGrid.appendChild(dayCol);
    });
  }
}

// --- Bootstrap AuraHabit Application ---
document.addEventListener('DOMContentLoaded', () => {
  window.auraHabitAppInstance = new AuraHabitApp();
});
