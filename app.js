document.addEventListener('DOMContentLoaded', () => {
  // --- UI Selectors ---
  const body = document.body;
  const navbar = document.getElementById('mainNavbar');
  const navLinks = document.querySelectorAll('.nav-link');
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const navLinksList = document.getElementById('navLinks');
  
  // Auth Selectors
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const userPanel = document.getElementById('userPanel');
  const loginTrigger = document.getElementById('loginTrigger');
  const logoutBtn = document.getElementById('logoutBtn');
  const userNameText = document.getElementById('userName');
  const authToast = document.getElementById('authToast');

  // Panel Toggles
  const loginPanel = document.getElementById('loginPanel');
  const registerPanel = document.getElementById('registerPanel');
  const goToRegisterBtn = document.getElementById('goToRegisterBtn');
  const goToLoginBtn = document.getElementById('goToLoginBtn');

  // Premium Navigation Capsule Switch
  const navCapsule = document.getElementById('navSwitchCapsule');
  const container = document.getElementById('horizontalContainer');

  // Slider sections order in DOM:
  // hero, login, upload, analysis, nutrition, food-order, profile
  const sliderSections = [
    document.getElementById('hero'),
    document.getElementById('login'),
    document.getElementById('upload'),
    document.getElementById('analysis'),
    document.getElementById('nutrition'),
    document.getElementById('food-order'),
    document.getElementById('profile')
  ].filter(Boolean);

  let currentSectionIndex = 0;

  // For a clean state on load, always start in a logged-out state.
  localStorage.removeItem('sessionUser');
  body.classList.remove('is-logged-in');
  if (userNameText) userNameText.textContent = '';
  if (userPanel) userPanel.style.display = 'none';
  if (loginTrigger) loginTrigger.style.display = 'block';
  window.currentPatient = null;

  // Populate Profile Inputs on load
  updateProfileUI();

  // Handle Login Panel / Register Panel Toggles
  if (goToRegisterBtn) {
    goToRegisterBtn.addEventListener('click', () => {
      if (loginPanel) loginPanel.style.display = 'none';
      if (registerPanel) registerPanel.style.display = 'block';
    });
  }
  if (goToLoginBtn) {
    goToLoginBtn.addEventListener('click', () => {
      if (registerPanel) registerPanel.style.display = 'none';
      if (loginPanel) loginPanel.style.display = 'block';
    });
  }

  // =================================================================
  // 🧭 HORIZONTAL SLIDER NAVIGATION SYSTEM
  // =================================================================
  
  function getVisibleSections() {
    const isLoggedIn = body.classList.contains('is-logged-in');
    return sliderSections.filter(sec => {
      if (sec.id === 'login' && isLoggedIn) {
        sec.style.display = 'none'; // hide/collapse from horizontal flex
        return false;
      }
      sec.style.display = 'block';
      return true;
    });
  }

  function goToSection(sectionId) {
    const visible = getVisibleSections();
    const targetIndex = visible.findIndex(sec => sec.id === sectionId);
    if (targetIndex !== -1) {
      currentSectionIndex = targetIndex;
      updateSliderPosition();
    }
  }
  window.goToSection = goToSection; // Expose globally for inline button onclick

  function updateSliderPosition() {
    const visible = getVisibleSections();
    if (currentSectionIndex < 0) currentSectionIndex = 0;
    if (currentSectionIndex >= visible.length) currentSectionIndex = visible.length - 1;

    const activeSection = visible[currentSectionIndex];
    if (container) {
      container.style.transform = `translateX(-${currentSectionIndex * 100}vw)`;
    }

    // Set navbar link active status
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === '#' + activeSection.id) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

  }

  // Navigation handlers with knob sliding animation
  let isNavigating = false;

  function navigatePrev() {
    if (isNavigating) return;
    isNavigating = true;

    if (navCapsule) {
      navCapsule.classList.remove('slide-right');
      navCapsule.classList.add('slide-left');
      setTimeout(() => {
        navCapsule.classList.remove('slide-left');
        isNavigating = false;
      }, 400);
    } else {
      isNavigating = false;
    }

    const visible = getVisibleSections();
    if (currentSectionIndex > 0) {
      currentSectionIndex--;
      updateSliderPosition();
    }
  }

  function navigateNext() {
    if (isNavigating) return;
    isNavigating = true;

    if (navCapsule) {
      navCapsule.classList.remove('slide-left');
      navCapsule.classList.add('slide-right');
      setTimeout(() => {
        navCapsule.classList.remove('slide-right');
        isNavigating = false;
      }, 400);
    } else {
      isNavigating = false;
    }

    const visible = getVisibleSections();
    if (currentSectionIndex < visible.length - 1) {
      currentSectionIndex++;
      updateSliderPosition();
    }
  }

  // Navigation capsule click handler (Left half = Previous, Right half = Next)
  if (navCapsule) {
    navCapsule.addEventListener('click', (e) => {
      const rect = navCapsule.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      if (clickX < rect.width / 2) {
        navigatePrev();
      } else {
        navigateNext();
      }
    });
  }

  // Keyboard navigation arrows handler
  document.addEventListener('keydown', (e) => {
    // Prevent scrolling when typing in input or text fields
    const activeEl = document.activeElement;
    if (activeEl && (
      activeEl.tagName === 'INPUT' || 
      activeEl.tagName === 'TEXTAREA' || 
      activeEl.isContentEditable
    )) {
      return;
    }

    if (e.key === 'ArrowLeft') {
      navigatePrev();
    } else if (e.key === 'ArrowRight') {
      navigateNext();
    }
  });

  // Intercept all page anchors with # targets for horizontal sliding
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (link) {
      e.preventDefault();
      const href = link.getAttribute('href');
      
      // If clicking "Get Started", switch to Create Account (Register Panel)
      if (link.textContent.includes('Get Started')) {
        if (loginPanel) loginPanel.style.display = 'none';
        if (registerPanel) registerPanel.style.display = 'block';
      } else if (href === '#login') {
        // If clicking other links to login (like navbar, lock screen buttons), show Login Panel
        if (loginPanel) loginPanel.style.display = 'block';
        if (registerPanel) registerPanel.style.display = 'none';
      }
      
      if (href.length > 1) {
        goToSection(href.substring(1));
      }
    }
  });

  // Initialize edge buttons layout state on boot
  updateSliderPosition();

  // =================================================================
  // 🔐 AUTHENTICATION STATE & TOAST SYSTEM
  // =================================================================
  
  function showToast(message) {
    if (authToast) {
      authToast.innerHTML = `<span>🔔</span> ${message}`;
      authToast.classList.add('show');
      setTimeout(() => {
        authToast.classList.remove('show');
      }, 4000);
    }
  }

  function loginUser(userName, profile) {
    body.classList.add('is-logged-in');
    localStorage.setItem('sessionUser', userName);
    if (userNameText) userNameText.textContent = userName;
    if (userPanel) userPanel.style.display = 'flex';
    if (loginTrigger) loginTrigger.style.display = 'none';

    // Update Profile UI with newly loaded state values
    updateProfileUI();

    // Trigger state loaded events to alert other parts of the application
    if (profile) {
      const patient = {
        name: profile.name,
        gender: profile.gender,
        blood_sugar: 90,
        hba1c: 5.4,
        cholesterol: 180,
        hdl: 50,
        ldl: 100,
        haemoglobin: 14.0,
        bmi: 23.5,
        vitamin_d: 35,
        daily_calories: 1800,
        conditions: [],
        risks: { diabetes: 10, cardiovascular: 15, obesity: 10, nutritional: 10 }
      };
      if (window.setPatient) window.setPatient(patient);
    } else {
      const shreyaaPatient = {
        name: 'Shreyaa',
        gender: 'Female',
        blood_sugar: 88,
        hba1c: 5.1,
        cholesterol: 165,
        hdl: 58,
        ldl: 95,
        haemoglobin: 13.5,
        bmi: 21.0,
        vitamin_d: 42,
        daily_calories: 1800,
        conditions: [],
        risks: { diabetes: 5, cardiovascular: 10, obesity: 5, nutritional: 8 }
      };
      if (window.setPatient) window.setPatient(shreyaaPatient);
    }

    // Refresh horizontal slider index (hides login) and slide to upload section
    setTimeout(() => {
      goToSection('upload');
    }, 1500);
  }

  function logoutUser() {
    body.classList.remove('is-logged-in');
    body.classList.remove('chat-active');
    localStorage.removeItem('sessionUser');

    if (userPanel) userPanel.style.display = 'none';
    if (loginTrigger) loginTrigger.style.display = 'block';

    // Reset forms and view panels
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    if (loginPanel) loginPanel.style.display = 'block';
    if (registerPanel) registerPanel.style.display = 'none';

    // Reset chatbot UI state
    const chatbot = document.getElementById('mediguardian-chatbot');
    if (chatbot) chatbot.classList.remove('open');
    const bubbleToggle = document.getElementById('chatBubbleToggle');
    if (bubbleToggle) bubbleToggle.classList.add('hidden');

    // Reset profile card displays
    const avatarDiv = document.getElementById('profileAvatar');
    const displayNameDiv = document.getElementById('profileDisplayName');
    if (avatarDiv) avatarDiv.textContent = 'DU';
    if (displayNameDiv) displayNameDiv.textContent = 'Demo User';

    window.currentPatient = null;
    showToast("Logged out successfully.");

    // Redirect to Dashboard (hero) smoothly
    goToSection('hero');
  }

  // Login form handler
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      showToast("Welcome back, Shreyaa!");
      loginUser("Shreyaa", null);
    });
  }

  // Register form handler (Create Account)
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const profile = {
        name: document.getElementById('regName').value.trim(),
        age: document.getElementById('regAge').value.trim(),
        gender: document.getElementById('regGender').value,
        bloodGroup: document.getElementById('regBloodGroup').value,
        phone: document.getElementById('regPhone').value.trim(),
        country: document.getElementById('regCountry').value.trim(),
        email: document.getElementById('regEmail').value.trim()
      };
      localStorage.setItem('userProfile', JSON.stringify(profile));
      showToast("Account created successfully!");
      loginUser(profile.name, profile);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      console.log("MediGuardian Auth: Logout button clicked.");
      logoutUser();
    });
  }

  const loginTriggerLink = document.querySelector('#loginTrigger a');
  if (loginTriggerLink) {
    loginTriggerLink.addEventListener('click', (e) => {
      console.log("MediGuardian Auth: Login/Register link clicked.");
      e.preventDefault();
      e.stopPropagation();
      if (loginPanel) loginPanel.style.display = 'block';
      if (registerPanel) registerPanel.style.display = 'none';
      goToSection('login');
    });
  }

  function updateProfileUI() {
    const nameInput = document.getElementById('profileName');
    const emailInput = document.getElementById('profileEmail');
    const ageInput = document.getElementById('profileAge');
    const genderSelect = document.getElementById('profileGender');
    const bloodSelect = document.getElementById('profileBloodType');
    const phoneInput = document.getElementById('profilePhone');
    const countryInput = document.getElementById('profileCountry');
    const avatarDiv = document.getElementById('profileAvatar');
    const displayNameDiv = document.getElementById('profileDisplayName');

    const session = localStorage.getItem('sessionUser');
    if (!session) return;

    let initials = 'DU';
    let displayName = 'Demo User';

    if (session === 'Shreyaa') {
      if (nameInput) nameInput.value = 'Shreyaa';
      if (emailInput) emailInput.value = 'demo@mediguardian.ai';
      if (ageInput) ageInput.value = '21';
      if (genderSelect) genderSelect.value = 'Female';
      if (bloodSelect) bloodSelect.value = 'O+';
      if (phoneInput) phoneInput.value = '9876543210';
      if (countryInput) countryInput.value = 'India';
      initials = 'S';
      displayName = 'Shreyaa';
    } else {
      const savedProfile = JSON.parse(localStorage.getItem('userProfile'));
      if (savedProfile && savedProfile.name === session) {
        if (nameInput) nameInput.value = savedProfile.name || '';
        if (emailInput) emailInput.value = savedProfile.email || '';
        if (ageInput) ageInput.value = savedProfile.age || '';
        if (genderSelect) genderSelect.value = savedProfile.gender || 'Female';
        if (bloodSelect) bloodSelect.value = savedProfile.bloodGroup || 'O+';
        if (phoneInput) phoneInput.value = savedProfile.phone || '';
        if (countryInput) countryInput.value = savedProfile.country || '';
        displayName = savedProfile.name || 'User';
        const parts = displayName.trim().split(/\s+/);
        initials = parts.map(p => p[0]).join('').substring(0, 2).toUpperCase();
      }
    }

    if (avatarDiv) avatarDiv.textContent = initials;
    if (displayNameDiv) displayNameDiv.textContent = displayName;
  }

  // Global function to save profile edits from Profile page UI
  window.saveProfileChanges = function() {
    const session = localStorage.getItem('sessionUser');
    if (!session) return;

    const profile = {
      name: document.getElementById('profileName').value.trim(),
      email: document.getElementById('profileEmail').value.trim(),
      age: document.getElementById('profileAge').value.trim(),
      gender: document.getElementById('profileGender').value,
      bloodGroup: document.getElementById('profileBloodType').value,
      phone: document.getElementById('profilePhone').value.trim(),
      country: document.getElementById('profileCountry').value.trim()
    };

    if (session === 'Shreyaa') {
      alert('Demo User (Shreyaa) details cannot be customized permanently in this demo.');
    } else {
      localStorage.setItem('userProfile', JSON.stringify(profile));
      localStorage.setItem('sessionUser', profile.name);
      if (userNameText) userNameText.textContent = profile.name;
      updateProfileUI();
      alert('Profile updated successfully!');
    }
  };

  // Sticky nav glowing shadows logic
  window.addEventListener('scroll', () => {
    if (navbar) {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }
  });

  // Mobile navigation drawer toggle
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
      if (navLinksList) navLinksList.classList.toggle('mobile-open');
    });
  }

  // =================================================================
  // 🤖 FLOATING CHATBOT CONTROLS & EVENT BUS
  // =================================================================
  
  window.enableChatbot = function() {
    body.classList.add('chat-active');
    const bubbleToggle = document.getElementById('chatBubbleToggle');
    if (bubbleToggle) bubbleToggle.classList.remove('hidden');
    console.log("MediGuardian RAG Chatbot: Display Enabled.");
  };

  window.disableChatbot = function() {
    body.classList.remove('chat-active');
    console.log("MediGuardian RAG Chatbot: Display Disabled.");
  };
});
