/**
 * Campus Voice Connect - Main Application Logic
 * Integrates Web Audio API, real-time broadcast sync, classroom state, and pages.
 */

import { campusClassrooms, initialBroadcastHistory, quickPresets } from './classrooms.js';
import { audioEngine } from './audio-engine.js';
import { campusBroadcast } from './broadcast-channel.js';

class CampusVoiceApp {
  constructor() {
    this.currentViewMode = 'faculty'; // 'faculty' | 'classroom' | 'dual'
    this.currentFacultyPage = 'dashboard'; // 'dashboard' | 'classrooms' | 'broadcast' | 'history' | 'settings'

    // Faculty state
    this.faculty = {
      name: 'Dr. Divakar Verma',
      title: 'Associate Professor',
      department: 'Electronics & Communication Engineering',
      cabin: 'Cabin 204',
      block: 'Block B, 2nd Floor',
      status: 'online',
      phoneExt: '#4204',
      avatar: '👨‍🏫'
    };

    // Classrooms & history
    this.classrooms = [...campusClassrooms];
    this.selectedClassroomId = 'ECE-301';
    this.history = [...initialBroadcastHistory];
    this.presets = [...quickPresets];

    // Classroom state (for classroom view)
    this.classroomState = {
      id: 'ECE-301',
      name: 'Classroom ECE-301',
      department: 'Electronics & Communication',
      block: 'Block B (Academic), 3rd Floor',
      connectedFaculty: null,
      isBroadcasting: false,
      transcript: 'No active broadcast. Classroom speaker is in standby listening mode.',
      volume: 85,
      studentRequests: []
    };

    // Broadcast live session state
    this.broadcastSession = {
      isActive: false,
      isMuted: false,
      startTime: null,
      timerInterval: null,
      durationSeconds: 0,
      visualizerCleanup: null,
      dualVisualizerCleanup: null
    };

    // Incoming student doubts for faculty
    this.incomingStudentRequests = [];

    this.init();
  }

  init() {
    this.bindEvents();
    this.setupBroadcastSync();
    this.render();
  }

  // --- Real-time cross-component / cross-tab synchronization ---
  setupBroadcastSync() {
    campusBroadcast.on('BROADCAST_START', (data) => {
      if (this.classroomState.id === data.targetClassroom || data.targetClassroom === 'ALL') {
        this.classroomState.isBroadcasting = true;
        this.classroomState.connectedFaculty = `${data.facultyName} (${data.cabin})`;
        this.classroomState.transcript = data.presetText || 'Faculty is speaking live through the cabin microphone...';
        this.renderClassroomSection();
        this.showToast(`📢 Live broadcast incoming from ${data.cabin}!`, 'warning');
      }
    });

    campusBroadcast.on('BROADCAST_STATE_CHANGE', (data) => {
      if (this.classroomState.isBroadcasting) {
        if (data.isMuted) {
          this.classroomState.transcript = 'Faculty microphone muted.';
        } else if (data.text) {
          this.classroomState.transcript = data.text;
        }
        this.renderClassroomSection();
      }
    });

    campusBroadcast.on('BROADCAST_END', (data) => {
      this.classroomState.isBroadcasting = false;
      this.classroomState.connectedFaculty = null;
      this.classroomState.transcript = `Broadcast ended. Recorded at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
      this.renderClassroomSection();
    });

    campusBroadcast.on('STUDENT_REQUEST_TO_SPEAK', (data) => {
      this.incomingStudentRequests.unshift(data);
      audioEngine.playCampusChime('student-buzz');
      this.showToast(`✋ Student in ${data.classroomId} raised a query: "${data.message}"`, 'warning');
      this.renderFacultyLiveSection();
      this.renderFacultyDashboard();
    });

    campusBroadcast.on('FACULTY_ACCEPT_REQUEST', (data) => {
      this.showToast(`Faculty connected to 2-way student intercom in ${data.classroomId}`, 'success');
      this.renderClassroomSection();
    });
  }

  // --- DOM Event Bindings ---
  bindEvents() {
    // Mode Switcher (Faculty / Classroom / Dual Demo)
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = btn.dataset.mode;
        this.setMode(mode);
      });
    });

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        themeBtn.textContent = next === 'light' ? '🌙' : '☀️';
      });
    }

    // Audio chime test button in top navbar
    const bellBtn = document.getElementById('bell-test-btn');
    if (bellBtn) {
      bellBtn.addEventListener('click', () => {
        audioEngine.playCampusChime('campus');
        this.showToast('🔔 Campus Announcement Chime Tested', 'success');
      });
    }

    // Faculty Navigation Tabs
    document.querySelectorAll('.sub-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        this.setFacultyPage(page);
      });
    });

    // Global Key Listener: Spacebar push-to-talk in Live Broadcast mode
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        if (this.broadcastSession.isActive) {
          e.preventDefault();
          // Toggle mute when spacebar pressed
          this.toggleMute();
        }
      }
    });
    // Login nav button
    const loginNavBtn = document.getElementById('login-nav-btn');
    if (loginNavBtn) {
      loginNavBtn.addEventListener('click', () => {
        this.setMode('login');
      });
    }

    const userBadge = document.getElementById('user-badge');
    if (userBadge) {
      userBadge.addEventListener('click', () => {
        this.setMode('faculty');
        this.setFacultyPage('settings');
      });
    }

    // Hash change router support
    window.addEventListener('hashchange', () => {
      this.handleHashRoute();
    });
    if (window.location.hash) {
      this.handleHashRoute();
    }
  }

  handleHashRoute() {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'login') {
      this.setMode('login');
    } else if (hash === 'classroom') {
      this.setMode('classroom');
    } else if (hash === 'dual') {
      this.setMode('dual');
    } else if (['dashboard', 'classrooms', 'broadcast', 'history', 'settings'].includes(hash)) {
      this.setMode('faculty');
      this.setFacultyPage(hash);
    }
  }

  setMode(mode) {
    this.currentViewMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    if (mode === 'login') {
      window.location.hash = 'login';
    } else if (mode === 'classroom') {
      window.location.hash = 'classroom';
    } else if (mode === 'dual') {
      window.location.hash = 'dual';
    } else {
      window.location.hash = this.currentFacultyPage;
    }
    this.render();
  }

  setFacultyPage(page) {
    this.currentFacultyPage = page;
    this.currentViewMode = 'faculty';
    window.location.hash = page;
    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === 'faculty');
    });
    this.render();
  }

  // --- Broadcast Action Methods ---
  async startBroadcast(classroomId = null) {
    if (classroomId) {
      this.selectedClassroomId = classroomId;
    }

    const room = this.classrooms.find(c => c.id === this.selectedClassroomId) || this.classrooms[0];

    // 1. Play announcement chime first
    await audioEngine.playCampusChime('campus');

    // 2. Request mic / start audio engine
    const micResult = await audioEngine.startMicrophone();

    // 3. Update session state
    this.broadcastSession.isActive = true;
    this.broadcastSession.isMuted = false;
    this.broadcastSession.startTime = Date.now();
    this.broadcastSession.durationSeconds = 0;

    // Start timer interval
    if (this.broadcastSession.timerInterval) {
      clearInterval(this.broadcastSession.timerInterval);
    }
    this.broadcastSession.timerInterval = setInterval(() => {
      this.broadcastSession.durationSeconds++;
      this.updateTimerDisplays();
    }, 1000);

    // 4. Send network broadcast event
    campusBroadcast.send('BROADCAST_START', {
      broadcastId: 'bc-' + Date.now(),
      facultyName: this.faculty.name,
      cabin: this.faculty.cabin,
      targetClassroom: room.id,
      targetClassroomName: room.name,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      presetText: `Faculty is broadcasting live from ${this.faculty.cabin} to ${room.name}.`
    });

    this.showToast(`🔴 Broadcasting live to ${room.name}!`, 'danger');

    // Re-render UI
    this.render();
  }

  endBroadcast() {
    if (!this.broadcastSession.isActive) return;

    const dur = this.broadcastSession.durationSeconds;
    const durStr = this.formatDuration(dur);
    const room = this.classrooms.find(c => c.id === this.selectedClassroomId) || this.classrooms[0];

    // Stop mic and timer
    audioEngine.stopMicrophone();
    audioEngine.stopSpeaking();
    if (this.broadcastSession.timerInterval) {
      clearInterval(this.broadcastSession.timerInterval);
      this.broadcastSession.timerInterval = null;
    }

    // Save to history
    const newEntry = {
      id: 'hist-' + Date.now(),
      timestamp: 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      faculty: this.faculty.name,
      cabin: this.faculty.cabin,
      department: 'ECE',
      classroom: room.id,
      classroomName: room.name,
      duration: durStr,
      durationSec: dur,
      type: 'Live Voice Notice',
      transcript: `Voice announcement transmitted to ${room.name} from ${this.faculty.cabin}.`,
      recipients: room.occupancy,
      status: 'Delivered',
      starred: false
    };
    this.history.unshift(newEntry);

    // Reset session
    this.broadcastSession.isActive = false;
    this.broadcastSession.isMuted = false;

    // Send broadcast end signal
    campusBroadcast.send('BROADCAST_END', {
      targetClassroom: room.id,
      duration: durStr
    });

    this.showToast(`⏹️ Broadcast ended. Saved to History (${durStr})`, 'success');
    this.render();
  }

  toggleMute() {
    if (!this.broadcastSession.isActive) return;
    const isMuted = audioEngine.toggleMute();
    this.broadcastSession.isMuted = isMuted;

    campusBroadcast.send('BROADCAST_STATE_CHANGE', {
      isMuted: isMuted,
      targetClassroom: this.selectedClassroomId
    });

    this.showToast(isMuted ? '🔇 Microphone Muted' : '🎙️ Microphone Unmuted', isMuted ? 'warning' : 'success');
    this.render();
  }

  triggerPreset(preset) {
    if (!this.broadcastSession.isActive) {
      this.startBroadcast(this.selectedClassroomId).then(() => {
        this.speakPresetText(preset);
      });
    } else {
      this.speakPresetText(preset);
    }
  }

  speakPresetText(preset) {
    const room = this.classrooms.find(c => c.id === this.selectedClassroomId) || this.classrooms[0];

    // Announce via Web Speech API
    audioEngine.speakText(preset.text, () => {
      // Speech complete
    });

    // Update classroom view
    this.classroomState.transcript = `"${preset.text}"`;
    campusBroadcast.send('BROADCAST_STATE_CHANGE', {
      text: `"${preset.text}"`,
      targetClassroom: room.id
    });

    this.showToast(`📢 Transmitting preset: "${preset.title}"`, 'success');
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  updateTimerDisplays() {
    const timeStr = this.formatDuration(this.broadcastSession.durationSeconds);
    document.querySelectorAll('.live-timer-display').forEach(el => {
      el.textContent = timeStr;
    });
  }

  // --- Main Render Dispatcher ---
  render() {
    const container = document.getElementById('main-content');
    if (!container) return;

    if (this.currentViewMode === 'login') {
      this.renderLoginPage(container);
    } else if (this.currentViewMode === 'dual') {
      this.renderDualDemoView(container);
    } else if (this.currentViewMode === 'classroom') {
      this.renderClassroomView(container);
    } else {
      this.renderFacultyView(container);
    }
  }

  // =========================================================================
  // PAGE 1: LOGIN & ROLE PORTAL
  // =========================================================================
  renderLoginPage(container) {
    container.innerHTML = `
      <div style="max-width: 900px; margin: 1rem auto;">
        <!-- University Portal Branding Header -->
        <div style="text-align: center; margin-bottom: 2rem;">
          <div style="width: 64px; height: 64px; margin: 0 auto 1rem; border-radius: 16px; background: linear-gradient(135deg, var(--accent-primary), var(--accent-cyan)); display: flex; align-items: center; justify-content: center; font-size: 2.2rem; box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);">
            🎙️
          </div>
          <h1 style="font-size: 2rem; font-weight: 800; letter-spacing: -0.02em;">
            Campus Voice Connect
          </h1>
          <p style="font-size: 1rem; color: var(--text-secondary); max-width: 580px; margin: 0.5rem auto 0;">
            Unified Campus Intercom & Real-Time Classroom Voice PA System
          </p>
          <div style="display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; background: rgba(16, 185, 129, 0.12); color: var(--color-success); padding: 4px 12px; border-radius: 99px; font-size: 0.8rem; font-weight: 600;">
            <span class="status-dot"></span> Campus LAN Authentication Node Online
          </div>
        </div>

        <!-- 3 Quick Access Portals for Demo Presentation -->
        <div style="margin-bottom: 2rem;">
          <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; text-align: center;">
            ⚡ Quick 1-Click Role Login (Hackathon Demo Profiles)
          </h3>
          <div class="grid-3">
            <!-- Portal 1: Faculty -->
            <div class="card" style="border-top: 4px solid var(--accent-primary); cursor: pointer; text-align: center;" id="quick-login-faculty">
              <div style="width: 54px; height: 54px; border-radius: 50%; background: var(--accent-primary-light); margin: 0 auto 0.75rem; display: flex; align-items: center; justify-content: center; font-size: 1.8rem;">
                👨‍🏫
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 700;">Faculty Portal</h3>
              <p style="font-size: 0.82rem; color: var(--accent-cyan); font-weight: 600; margin: 0.2rem 0 0.5rem;">
                Dr. Divakar Verma (Cabin 204)
              </p>
              <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 1rem;">
                Department of ECE • Broadcast microphone access to assigned classrooms.
              </p>
              <button class="btn btn-primary" style="width: 100%; font-size: 0.85rem;">
                Login as Faculty →
              </button>
            </div>

            <!-- Portal 2: Classroom Podium -->
            <div class="card" style="border-top: 4px solid var(--accent-cyan); cursor: pointer; text-align: center;" id="quick-login-classroom">
              <div style="width: 54px; height: 54px; border-radius: 50%; background: var(--accent-cyan-light); margin: 0 auto 0.75rem; display: flex; align-items: center; justify-content: center; font-size: 1.8rem;">
                🏫
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 700;">Classroom Terminal</h3>
              <p style="font-size: 0.82rem; color: var(--accent-cyan); font-weight: 600; margin: 0.2rem 0 0.5rem;">
                Classroom ECE-301 Smart Podium
              </p>
              <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 1rem;">
                Wall speaker receiver terminal with acoustic animation & doubt buzzer.
              </p>
              <button class="btn btn-secondary" style="width: 100%; font-size: 0.85rem; border-color: var(--accent-cyan); color: var(--accent-cyan);">
                Open Classroom Screen →
              </button>
            </div>

            <!-- Portal 3: Dual Simulator -->
            <div class="card" style="border-top: 4px solid var(--color-live); cursor: pointer; text-align: center;" id="quick-login-dual">
              <div style="width: 54px; height: 54px; border-radius: 50%; background: var(--color-live-light); margin: 0 auto 0.75rem; display: flex; align-items: center; justify-content: center; font-size: 1.8rem;">
                🚀
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 700;">Dual Demo Theatre</h3>
              <p style="font-size: 0.82rem; color: var(--color-live); font-weight: 600; margin: 0.2rem 0 0.5rem;">
                Side-by-Side Presentation
              </p>
              <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 1rem;">
                Simultaneous split-screen showing Cabin 204 transmitting to ECE-301.
              </p>
              <button class="btn btn-danger" style="width: 100%; font-size: 0.85rem;">
                Launch Dual Demo →
              </button>
            </div>
          </div>
        </div>

        <!-- Standard Credentials Form Card -->
        <div class="card" style="max-width: 500px; margin: 0 auto;">
          <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
            🔐 Standard Campus Single Sign-On
          </h3>
          <form id="standard-login-form" style="display: flex; flex-direction: column; gap: 1rem;">
            <div>
              <label style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-bottom: 0.35rem;">
                Campus ID / Faculty Code
              </label>
              <input type="text" id="login-id-input" class="input-field" value="FAC-204-VERMA" required />
            </div>
            <div>
              <label style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-bottom: 0.35rem;">
                Security Passcode
              </label>
              <input type="password" id="login-pwd-input" class="input-field" value="••••••••••••" required />
            </div>
            <div>
              <label style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-bottom: 0.35rem;">
                Access Gateway
              </label>
              <select class="input-field">
                <option>Faculty Cabin Network (Block B - VLAN 20)</option>
                <option>Classroom IP Speaker Network (VLAN 30)</option>
                <option>Campus Central Administration (VLAN 10)</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top: 0.5rem; width: 100%;">
              Sign In to Campus Network
            </button>
          </form>
        </div>
      </div>
    `;

    // Handlers
    const facCard = container.querySelector('#quick-login-faculty');
    if (facCard) {
      facCard.addEventListener('click', () => {
        this.setFacultyPage('dashboard');
        this.showToast('Logged in as Dr. Divakar Verma (Cabin 204)', 'success');
      });
    }

    const clsCard = container.querySelector('#quick-login-classroom');
    if (clsCard) {
      clsCard.addEventListener('click', () => {
        this.setMode('classroom');
        this.showToast('Opened Classroom ECE-301 Podium Terminal', 'success');
      });
    }

    const dualCard = container.querySelector('#quick-login-dual');
    if (dualCard) {
      dualCard.addEventListener('click', () => {
        this.setMode('dual');
        this.showToast('Dual Demo Theatre Launched', 'success');
      });
    }

    const form = container.querySelector('#standard-login-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.setFacultyPage('dashboard');
        this.showToast('Authentication Successful!', 'success');
      });
    }
  }

  // =========================================================================
  // VIEW 1: FACULTY VIEW
  // =========================================================================
  renderFacultyView(container = document.getElementById('main-content')) {
    container.innerHTML = `
      <!-- Faculty Sub-Navbar with Complete 7-Page Jump Navigation -->
      <nav class="sub-nav">
        <button class="sub-nav-item ${this.currentFacultyPage === 'dashboard' ? 'active' : ''}" data-page="dashboard">
          📊 2. Faculty Dashboard
        </button>
        <button class="sub-nav-item ${this.currentFacultyPage === 'classrooms' ? 'active' : ''}" data-page="classrooms">
          🏫 4. Classroom Selection & Map
        </button>
        <button class="sub-nav-item ${this.currentFacultyPage === 'broadcast' ? 'active' : ''}" data-page="broadcast">
          🎙️ 5. Live Voice Studio ${this.broadcastSession.isActive ? '<span class="status-dot pulsing" style="background:#ef4444;box-shadow:0 0 8px #ef4444;"></span>' : ''}
        </button>
        <button class="sub-nav-item ${this.currentFacultyPage === 'history' ? 'active' : ''}" data-page="history">
          📜 6. Communication History
        </button>
        <button class="sub-nav-item ${this.currentFacultyPage === 'settings' ? 'active' : ''}" data-page="settings">
          ⚙️ 7. Profile & Settings
        </button>
      </nav>

      <div id="faculty-page-content"></div>
    `;

    // Re-bind sub-nav items
    container.querySelectorAll('.sub-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        this.setFacultyPage(item.dataset.page);
      });
    });

    const pageContent = document.getElementById('faculty-page-content');
    if (!pageContent) return;

    switch (this.currentFacultyPage) {
      case 'dashboard':
        this.renderFacultyDashboard(pageContent);
        break;
      case 'classrooms':
        this.renderClassroomSelectionPage(pageContent);
        break;
      case 'broadcast':
        this.renderLiveBroadcastPage(pageContent);
        break;
      case 'history':
        this.renderHistoryPage(pageContent);
        break;
      case 'settings':
        this.renderSettingsPage(pageContent);
        break;
    }
  }

  // --- Page: Faculty Dashboard ---
  renderFacultyDashboard(container = document.getElementById('faculty-page-content')) {
    const selectedRoom = this.classrooms.find(c => c.id === this.selectedClassroomId) || this.classrooms[0];
    const totalWalkMetersSaved = this.history.length * 350; // 350m avg walk between cabin & class
    const totalMinutesSaved = this.history.length * 8; // 8 mins per round trip

    container.innerHTML = `
      <!-- Faculty Hero Header -->
      <div class="card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95)); border-left: 4px solid var(--accent-primary);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 58px; height: 58px; border-radius: 50%; background: var(--accent-primary-light); border: 2px solid var(--accent-primary); display: flex; align-items: center; justify-content: center; font-size: 2rem;">
              ${this.faculty.avatar}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <h2 style="font-size: 1.35rem;">${this.faculty.name}</h2>
                <span class="campus-status-pill" style="padding: 2px 8px; font-size: 0.75rem;">
                  <span class="status-dot ${this.faculty.status === 'online' ? 'pulsing' : ''}"></span>
                  ${this.faculty.status.toUpperCase()}
                </span>
              </div>
              <p style="font-size: 0.88rem; margin-top: 0.2rem;">
                ${this.faculty.title} • <strong>${this.faculty.department}</strong>
              </p>
              <p style="font-size: 0.82rem; color: var(--accent-cyan); margin-top: 0.15rem;">
                📍 <strong>${this.faculty.cabin}</strong> (${this.faculty.block}) • Intercom ${this.faculty.phoneExt}
              </p>
            </div>
          </div>
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <button id="quick-broadcast-btn" class="btn btn-primary btn-large">
              🎙️ Start Voice Broadcast
            </button>
            <button id="switch-room-btn" class="btn btn-secondary">
              🏫 Select Classroom (${selectedRoom.id})
            </button>
          </div>
        </div>
      </div>

      <!-- Campus Problem Solved / Impact Banner -->
      <div class="card" style="margin-bottom: 1.5rem; background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 1.6rem;">⚡</span>
            <div>
              <strong style="color: var(--color-success);">Campus Mobility & Productivity Impact:</strong>
              <span style="color: var(--text-secondary); font-size: 0.9rem; margin-left: 0.5rem;">
                Saved <strong>${(totalWalkMetersSaved / 1000).toFixed(1)} km</strong> of physical movement across academic blocks & ~<strong>${totalMinutesSaved} minutes</strong> today.
              </span>
            </div>
          </div>
          <span style="font-size: 0.78rem; background: var(--color-success-light); color: var(--color-success); padding: 3px 10px; border-radius: 99px; font-weight: 700;">
            Zero Physical Travel Required
          </span>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid-4" style="margin-bottom: 1.5rem;">
        <div class="stat-card">
          <div class="stat-icon purple">🏫</div>
          <div>
            <div class="stat-value">${this.classrooms.length}</div>
            <div class="stat-label">Assigned Classrooms</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon cyan">📢</div>
          <div class="stat-value">${this.history.length}</div>
          <div class="stat-label">Broadcasts Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">👥</div>
          <div>
            <div class="stat-value">${this.classrooms.reduce((acc, c) => acc + c.occupancy, 0)}</div>
            <div class="stat-label">Total Students Reached</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber">📶</div>
          <div>
            <div class="stat-value">12 ms</div>
            <div class="stat-label">Campus LAN Latency</div>
          </div>
        </div>
      </div>

      <!-- Dashboard Main Grid: Left Console + Right Assigned Rooms & Alerts -->
      <div class="grid-dashboard">
        <!-- Left: Quick Voice Broadcast Console -->
        <div class="card ${this.broadcastSession.isActive ? 'broadcasting' : ''}">
          <div class="card-header">
            <h3 class="card-title">
              🎙️ Quick Voice Console
              <span class="brand-badge">${this.broadcastSession.isActive ? 'ACTIVE TRANSMISSION' : 'READY'}</span>
            </h3>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 0.8rem; color: var(--text-secondary);">Target:</span>
              <select id="quick-target-select" class="input-field" style="width: auto; padding: 0.35rem 0.75rem; font-size: 0.85rem;">
                ${this.classrooms.map(c => `
                  <option value="${c.id}" ${c.id === this.selectedClassroomId ? 'selected' : ''}>
                    ${c.id} - ${c.name} (${c.occupancy} students)
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Central Tactile Microphone Widget -->
          <div class="mic-broadcast-center">
            <div class="mic-button-wrapper">
              <div class="mic-glow-ring"></div>
              <button id="main-mic-btn" class="mic-btn-large" title="Click to Broadcast / Push to Talk">
                ${this.broadcastSession.isActive ? (this.broadcastSession.isMuted ? '🔇' : '🎙️') : '🎙️'}
              </button>
            </div>

            <div style="margin-top: 0.5rem;">
              <h4 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem;">
                ${this.broadcastSession.isActive 
                  ? (this.broadcastSession.isMuted ? 'BROADCAST MUTED' : `LIVE TO ${selectedRoom.id}`) 
                  : 'Ready to Broadcast'}
              </h4>
              <p style="font-size: 0.85rem; color: var(--text-secondary);">
                ${this.broadcastSession.isActive 
                  ? `Transmitting live from ${this.faculty.cabin} to ${selectedRoom.name} (${selectedRoom.occupancy} listeners)` 
                  : `Click the microphone to connect cabin mic to ${selectedRoom.name} speaker.`}
              </p>
            </div>

            <!-- Waveform visualizer container -->
            <div class="visualizer-container" style="width: 100%; max-width: 500px; height: 90px; margin: 1.25rem auto;">
              <canvas id="faculty-dash-canvas" class="visualizer-canvas"></canvas>
              <div class="visualizer-overlay-info">
                ${this.broadcastSession.isActive ? '● 48kHz HD AUDIO' : 'STANDBY'}
              </div>
            </div>

            <!-- Active Broadcast Controls / Timer -->
            ${this.broadcastSession.isActive ? `
              <div style="display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem; flex-wrap: wrap; justify-content: center;">
                <div style="font-size: 1.2rem; font-family: var(--font-mono); font-weight: 700; color: var(--color-live); background: rgba(239, 68, 68, 0.15); padding: 0.4rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--color-live);">
                  ⏱️ <span class="live-timer-display">${this.formatDuration(this.broadcastSession.durationSeconds)}</span>
                </div>
                <button id="dash-mute-btn" class="btn btn-secondary">
                  ${this.broadcastSession.isMuted ? '🔊 Unmute Mic' : '🔇 Mute Mic'}
                </button>
                <button id="dash-end-btn" class="btn btn-danger">
                  ⏹️ End Broadcast
                </button>
              </div>
            ` : `
              <button id="dash-start-btn" class="btn btn-primary btn-large" style="margin-top: 0.5rem;">
                ▶️ Start Voice Broadcast to ${selectedRoom.id}
              </button>
            `}
          </div>

          <!-- Quick Preset Announcements -->
          <div style="margin-top: 1.5rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h4 style="font-size: 0.92rem; font-weight: 600; color: var(--text-secondary);">
                ⚡ Quick Presets (One-Click Instant Voice to ${selectedRoom.id}):
              </h4>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${this.presets.slice(0, 3).map(p => `
                <button class="btn btn-secondary quick-preset-chip" data-preset-id="${p.id}" style="font-size: 0.8rem; padding: 0.45rem 0.85rem;">
                  📢 ${p.title}
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Right Side: Assigned Classrooms & Student Queries -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <!-- Assigned Classrooms Cards -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">🏫 Assigned Classrooms</h3>
              <a href="#" id="view-all-rooms-link" style="font-size: 0.82rem;">View Floor Map →</a>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${this.classrooms.slice(0, 4).map(c => `
                <div class="classroom-card ${c.id === this.selectedClassroomId ? 'selected' : ''}" data-room-id="${c.id}" style="padding: 0.85rem 1rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <strong style="font-size: 0.95rem;">${c.id}</strong>
                      <div style="font-size: 0.78rem; color: var(--text-secondary);">${c.name}</div>
                    </div>
                    <span class="classroom-badge badge-online">
                      <span class="status-dot"></span> Online
                    </span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.6rem; font-size: 0.78rem; color: var(--text-muted);">
                    <span>👥 ${c.occupancy} / ${c.capacity} Students</span>
                    <button class="btn btn-ghost direct-broadcast-btn" data-room-id="${c.id}" style="padding: 2px 8px; font-size: 0.75rem; color: var(--accent-primary);">
                      🎙️ Broadcast Now
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Incoming Student Queries Tray -->
          <div class="card" style="border-left: 4px solid var(--color-warning);">
            <div class="card-header">
              <h3 class="card-title" style="font-size: 0.98rem;">
                ✋ Student Doubts & Requests
                ${this.incomingStudentRequests.length ? `<span class="badge-busy" style="font-size: 0.7rem; padding: 2px 6px; border-radius: 10px;">${this.incomingStudentRequests.length}</span>` : ''}
              </h3>
            </div>
            ${this.incomingStudentRequests.length === 0 ? `
              <p style="font-size: 0.82rem; color: var(--text-muted); text-align: center; padding: 1rem 0;">
                No pending student doubt queries from classrooms.
              </p>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                ${this.incomingStudentRequests.map((req, idx) => `
                  <div style="background: var(--bg-surface); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600;">
                      <span style="color: var(--color-warning);">Classroom ${req.classroomId}</span>
                      <span style="color: var(--text-muted);">${req.timestamp || 'Just now'}</span>
                    </div>
                    <div style="font-size: 0.85rem; margin: 0.35rem 0;">"${req.message}"</div>
                    <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                      <button class="btn btn-primary accept-request-btn" data-index="${idx}" data-room="${req.classroomId}" style="padding: 3px 10px; font-size: 0.75rem;">
                        Accept Intercom
                      </button>
                      <button class="btn btn-ghost dismiss-request-btn" data-index="${idx}" style="padding: 3px 10px; font-size: 0.75rem;">
                        Dismiss
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- Recent Announcements Feed -->
      <div class="card" style="margin-top: 1.5rem;">
        <div class="card-header">
          <h3 class="card-title">📜 Recent Voice Announcements from Cabin 204</h3>
          <button id="view-full-history-btn" class="btn btn-ghost" style="font-size: 0.85rem;">
            Full Log Archive →
          </button>
        </div>
        <div class="history-table-container">
          <table class="history-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Target Room</th>
                <th>Duration</th>
                <th>Announcement Transcript</th>
                <th>Delivery Receipt</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.history.slice(0, 4).map(h => `
                <tr>
                  <td><span style="font-weight: 600;">${h.timestamp}</span></td>
                  <td><span class="campus-status-pill" style="padding: 2px 8px; font-size: 0.78rem;">${h.classroom}</span></td>
                  <td><span style="font-family: var(--font-mono);">${h.duration}</span></td>
                  <td style="max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    "${h.transcript}"
                  </td>
                  <td>
                    <span style="color: var(--color-success); font-size: 0.8rem; font-weight: 600;">
                      ✓ ${h.recipients} Listeners
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-ghost replay-speech-btn" data-text="${encodeURIComponent(h.transcript)}" style="padding: 2px 8px; font-size: 0.8rem;">
                      🔊 Replay
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Attach Event Handlers for Dashboard
    const quickSelect = container.querySelector('#quick-target-select');
    if (quickSelect) {
      quickSelect.addEventListener('change', (e) => {
        this.selectedClassroomId = e.target.value;
        this.renderFacultyDashboard(container);
      });
    }

    const mainMicBtn = container.querySelector('#main-mic-btn');
    if (mainMicBtn) {
      mainMicBtn.addEventListener('click', () => {
        if (!this.broadcastSession.isActive) {
          this.startBroadcast();
        } else {
          this.toggleMute();
        }
      });
    }

    const quickBroadcastBtn = container.querySelector('#quick-broadcast-btn');
    if (quickBroadcastBtn) {
      quickBroadcastBtn.addEventListener('click', () => {
        this.setFacultyPage('broadcast');
      });
    }

    const dashStartBtn = container.querySelector('#dash-start-btn');
    if (dashStartBtn) {
      dashStartBtn.addEventListener('click', () => {
        this.startBroadcast();
      });
    }

    const dashMuteBtn = container.querySelector('#dash-mute-btn');
    if (dashMuteBtn) {
      dashMuteBtn.addEventListener('click', () => {
        this.toggleMute();
      });
    }

    const dashEndBtn = container.querySelector('#dash-end-btn');
    if (dashEndBtn) {
      dashEndBtn.addEventListener('click', () => {
        this.endBroadcast();
      });
    }

    const switchRoomBtn = container.querySelector('#switch-room-btn');
    if (switchRoomBtn) {
      switchRoomBtn.addEventListener('click', () => {
        this.setFacultyPage('classrooms');
      });
    }

    const viewAllRoomsLink = container.querySelector('#view-all-rooms-link');
    if (viewAllRoomsLink) {
      viewAllRoomsLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.setFacultyPage('classrooms');
      });
    }

    const viewFullHistoryBtn = container.querySelector('#view-full-history-btn');
    if (viewFullHistoryBtn) {
      viewFullHistoryBtn.addEventListener('click', () => {
        this.setFacultyPage('history');
      });
    }

    // Direct broadcast buttons on classroom cards
    container.querySelectorAll('.direct-broadcast-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rid = btn.dataset.roomId;
        this.selectedClassroomId = rid;
        this.startBroadcast(rid);
      });
    });

    container.querySelectorAll('.classroom-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectedClassroomId = card.dataset.roomId;
        this.renderFacultyDashboard(container);
      });
    });

    // Preset buttons
    container.querySelectorAll('.quick-preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.presetId;
        const preset = this.presets.find(p => p.id === pid);
        if (preset) {
          this.triggerPreset(preset);
        }
      });
    });

    // Replay buttons
    container.querySelectorAll('.replay-speech-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = decodeURIComponent(btn.dataset.text);
        audioEngine.speakText(text);
        this.showToast('🔊 Replaying audio broadcast...', 'success');
      });
    });

    // Accept / Dismiss student requests
    container.querySelectorAll('.accept-request-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        const req = this.incomingStudentRequests[idx];
        if (req) {
          campusBroadcast.send('FACULTY_ACCEPT_REQUEST', {
            requestId: req.requestId,
            classroomId: req.classroomId
          });
          this.incomingStudentRequests.splice(idx, 1);
          this.renderFacultyDashboard(container);
        }
      });
    });

    container.querySelectorAll('.dismiss-request-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        this.incomingStudentRequests.splice(idx, 1);
        this.renderFacultyDashboard(container);
      });
    });

    // Initialize visualizer canvas for dashboard
    const canvas = container.querySelector('#faculty-dash-canvas');
    if (canvas) {
      if (this.broadcastSession.visualizerCleanup) {
        this.broadcastSession.visualizerCleanup();
      }
      this.broadcastSession.visualizerCleanup = audioEngine.startVisualizer(canvas, {
        style: 'wave',
        primaryColor: '#6366f1',
        secondaryColor: '#10b981'
      });
    }
  }

  // --- Page: Classroom Selection & Floor Plan ---
  renderClassroomSelectionPage(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 style="font-size: 1.35rem; font-weight: 700;">🏫 Campus Classroom Directory & Floor Map</h2>
            <p style="font-size: 0.88rem; margin-top: 0.2rem;">
              Select any smart classroom, laboratory or auditorium to open a voice communication channel from Cabin 204.
            </p>
          </div>
          <div style="display: flex; gap: 0.75rem;">
            <button id="broadcast-all-btn" class="btn btn-secondary">
              📢 Broadcast to Entire Campus (PA Mode)
            </button>
            <button id="confirm-selection-btn" class="btn btn-primary">
              🎙️ Connect to Selected Room (${this.selectedClassroomId})
            </button>
          </div>
        </div>

        <!-- Filter and Search -->
        <div style="display: flex; gap: 1rem; margin-top: 1.25rem; flex-wrap: wrap;">
          <input type="text" id="room-search-input" class="input-field" placeholder="🔍 Search room number, block, course or department..." style="flex: 1; min-width: 260px;" />
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;" id="block-filter-container">
            <button class="btn btn-secondary btn-pill filter-btn active" data-filter="all">All Rooms</button>
            <button class="btn btn-secondary btn-pill filter-btn" data-filter="Block B">Block B (Academic)</button>
            <button class="btn btn-secondary btn-pill filter-btn" data-filter="Block A">Block A (Computing)</button>
            <button class="btn btn-secondary btn-pill filter-btn" data-filter="Labs">Labs & Research</button>
          </div>
        </div>
      </div>

      <!-- Campus Map Visual Representation -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header">
          <h3 class="card-title">🗺️ Interactive Campus Map - Academic Wing</h3>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Click any node to target room</span>
        </div>
        <div style="position: relative; height: 180px; background: radial-gradient(circle at 50% 50%, #1e293b, #090d16); border-radius: var(--radius-md); border: 1px dashed var(--border-color); overflow: hidden;">
          <!-- Cabin 204 indicator -->
          <div style="position: absolute; left: 10%; top: 25%; transform: translate(-50%, -50%); text-align: center; z-index: 10;">
            <div style="width: 38px; height: 38px; border-radius: 50%; background: #6366f1; border: 3px solid #fff; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; box-shadow: 0 0 15px #6366f1; margin: 0 auto;">
              👨‍🏫
            </div>
            <div style="font-size: 0.72rem; font-weight: 800; color: #fff; margin-top: 3px; background: rgba(0,0,0,0.6); padding: 1px 6px; border-radius: 4px;">
              Cabin 204 (YOU)
            </div>
          </div>

          <!-- Classroom nodes placed across coordinate map -->
          ${this.classrooms.map(c => `
            <div class="map-node ${c.id === this.selectedClassroomId ? 'active' : ''}" 
                 data-room-id="${c.id}"
                 style="position: absolute; left: ${c.coordinates.x}%; top: ${c.coordinates.y}%; transform: translate(-50%, -50%); text-align: center; cursor: pointer; transition: transform 0.2s;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: ${c.id === this.selectedClassroomId ? '#10b981' : '#1e293b'}; border: 2px solid ${c.id === this.selectedClassroomId ? '#fff' : '#64748b'}; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; margin: 0 auto; box-shadow: ${c.id === this.selectedClassroomId ? '0 0 12px #10b981' : 'none'};">
                🔊
              </div>
              <div style="font-size: 0.7rem; font-weight: 700; color: #f8fafc; margin-top: 2px; background: rgba(15,23,42,0.85); padding: 1px 5px; border-radius: 4px; white-space: nowrap;">
                ${c.id} (${c.occupancy})
              </div>
            </div>
          `).join('')}

          <div style="position: absolute; bottom: 8px; right: 12px; font-size: 0.72rem; color: var(--text-muted);">
            Campus Gigabit IP Audio Backbone • 5 GHz Mesh Wi-Fi
          </div>
        </div>
      </div>

      <!-- Classrooms Card Grid -->
      <div class="grid-3" id="classrooms-grid-container">
        ${this.renderClassroomCardsList(this.classrooms)}
      </div>
    `;

    // Map and card selection events
    const selectRoom = (rid) => {
      this.selectedClassroomId = rid;
      this.renderClassroomSelectionPage(container);
    };

    container.querySelectorAll('.map-node').forEach(node => {
      node.addEventListener('click', () => selectRoom(node.dataset.roomId));
    });

    container.querySelectorAll('.classroom-select-card').forEach(card => {
      card.addEventListener('click', () => selectRoom(card.dataset.roomId));
    });

    container.querySelectorAll('.start-broadcast-direct').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedClassroomId = btn.dataset.roomId;
        this.setFacultyPage('broadcast');
        this.startBroadcast();
      });
    });

    const confirmBtn = container.querySelector('#confirm-selection-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        this.setFacultyPage('broadcast');
      });
    }

    const broadcastAllBtn = container.querySelector('#broadcast-all-btn');
    if (broadcastAllBtn) {
      broadcastAllBtn.addEventListener('click', () => {
        this.selectedClassroomId = 'ALL';
        this.setFacultyPage('broadcast');
        this.startBroadcast('ALL');
      });
    }

    // Filter pills
    container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        let filtered = this.classrooms;
        if (filter === 'Block B') filtered = this.classrooms.filter(c => c.block.includes('Block B'));
        else if (filter === 'Block A') filtered = this.classrooms.filter(c => c.block.includes('Block A'));
        else if (filter === 'Labs') filtered = this.classrooms.filter(c => c.name.includes('Lab') || c.id.includes('LAB'));
        const grid = container.querySelector('#classrooms-grid-container');
        if (grid) grid.innerHTML = this.renderClassroomCardsList(filtered);
      });
    });
  }

  renderClassroomCardsList(roomsList) {
    return roomsList.map(c => `
      <div class="card classroom-card classroom-select-card ${c.id === this.selectedClassroomId ? 'selected' : ''}" data-room-id="${c.id}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <span class="brand-badge" style="margin-left: 0; font-size: 0.72rem;">${c.block}</span>
            <h3 style="font-size: 1.15rem; font-weight: 700; margin-top: 0.35rem;">${c.id}</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary);">${c.name}</p>
          </div>
          <span class="classroom-badge badge-online">
            <span class="status-dot"></span> Online
          </span>
        </div>

        <div style="background: var(--bg-surface); border-radius: var(--radius-md); padding: 0.75rem; margin-bottom: 1rem; font-size: 0.82rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
            <span style="color: var(--text-muted);">Current Class:</span>
            <span style="font-weight: 600;">${c.course}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
            <span style="color: var(--text-muted);">Occupancy:</span>
            <span><strong>${c.occupancy}</strong> / ${c.capacity} students</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Hardware:</span>
            <span>${c.speakerDevice.split('#')[0]}</span>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-primary start-broadcast-direct" data-room-id="${c.id}" style="flex: 1; font-size: 0.85rem;">
            🎙️ Broadcast Now
          </button>
        </div>
      </div>
    `).join('');
  }

  // --- Page: Live Voice Broadcast Studio ---
  renderLiveBroadcastPage(container) {
    const room = this.selectedClassroomId === 'ALL'
      ? { id: 'ALL', name: 'Campus-Wide Public Address', occupancy: '450+' }
      : (this.classrooms.find(c => c.id === this.selectedClassroomId) || this.classrooms[0]);

    container.innerHTML = `
      <div class="card" style="border: 2px solid ${this.broadcastSession.isActive ? 'var(--color-live)' : 'var(--border-color)'}; box-shadow: ${this.broadcastSession.isActive ? '0 0 35px var(--color-live-glow)' : 'var(--shadow-lg)'};">
        <!-- Studio Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1.25rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span class="brand-badge" style="background: ${this.broadcastSession.isActive ? 'var(--color-live)' : 'var(--accent-primary)'}; color: #fff; font-size: 0.8rem; padding: 4px 10px;">
                ${this.broadcastSession.isActive ? '🔴 ON AIR LIVE' : 'STUDIO READY'}
              </span>
              <h2 style="font-size: 1.4rem;">Digital Voice Intercom Studio</h2>
            </div>
            <p style="font-size: 0.88rem; margin-top: 0.25rem;">
              Origin: <strong>${this.faculty.cabin}</strong> • Transmitting to: <strong style="color: var(--accent-cyan);">${room.name} (${room.id})</strong>
            </p>
          </div>

          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="text-align: right;">
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Duration</div>
              <div class="live-timer-display" style="font-size: 1.4rem; font-family: var(--font-mono); font-weight: 800; color: ${this.broadcastSession.isActive ? 'var(--color-live)' : 'var(--text-secondary)'};">
                ${this.formatDuration(this.broadcastSession.durationSeconds)}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Listeners</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: var(--color-success);">
                ${room.occupancy}
              </div>
            </div>
          </div>
        </div>

        <!-- Center Studio Mic & Visualizer -->
        <div class="mic-broadcast-center" style="padding: 2rem 1rem;">
          <div class="mic-button-wrapper ${this.broadcastSession.isActive ? 'broadcasting' : ''} ${this.broadcastSession.isMuted ? 'muted' : ''}">
            <div class="mic-glow-ring"></div>
            <button id="studio-mic-btn" class="mic-btn-large" style="width: 130px; height: 130px; font-size: 3rem;">
              ${this.broadcastSession.isActive ? (this.broadcastSession.isMuted ? '🔇' : '🎙️') : '🎙️'}
            </button>
          </div>

          <h3 style="font-size: 1.4rem; font-weight: 700; margin-top: 0.75rem;">
            ${this.broadcastSession.isActive
              ? (this.broadcastSession.isMuted ? 'MICROPHONE MUTED' : `BROADCASTING TO ${room.id}`)
              : 'Tap Microphone to Speak'}
          </h3>
          <p style="font-size: 0.9rem; color: var(--text-secondary); max-width: 500px; margin: 0.25rem auto;">
            ${this.broadcastSession.isActive
              ? 'Your speech is being amplified live through the classroom ceiling speaker system.'
              : 'Classroom speakers are listening. Tap above or use Spacebar to push-to-talk.'}
          </p>

          <!-- Studio High-Res Oscilloscope Visualizer -->
          <div class="visualizer-container" style="height: 120px; max-width: 650px; width: 100%; margin: 1.5rem auto;">
            <canvas id="studio-canvas" class="visualizer-canvas"></canvas>
            <div class="visualizer-overlay-info">
              ${this.broadcastSession.isActive ? 'PCM 48kHz • 16-BIT LOW LATENCY' : 'MIC STANDBY'}
            </div>
          </div>

          <!-- Studio Control Buttons -->
          <div style="display: flex; gap: 1rem; align-items: center; justify-content: center; flex-wrap: wrap;">
            ${!this.broadcastSession.isActive ? `
              <button id="studio-start-btn" class="btn btn-primary btn-large">
                ▶️ Connect & Start Live Broadcast
              </button>
            ` : `
              <button id="studio-mute-btn" class="btn btn-secondary btn-large">
                ${this.broadcastSession.isMuted ? '🔊 Unmute Mic' : '🔇 Mute Mic'}
              </button>
              <button id="studio-chime-btn" class="btn btn-secondary btn-large">
                🔔 Play Attention Chime
              </button>
              <button id="studio-end-btn" class="btn btn-danger btn-large">
                ⏹️ End Voice Broadcast
              </button>
            `}
          </div>
        </div>

        <!-- Two Columns: Preset Announcements & Custom TTS Broadcast -->
        <div class="grid-2" style="border-top: 1px solid var(--border-subtle); padding-top: 1.5rem; margin-top: 1rem;">
          <!-- Presets -->
          <div>
            <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem;">
              📢 Instant Audio Presets
            </h4>
            <div class="presets-grid">
              ${this.presets.map(p => `
                <div class="preset-chip studio-preset-card" data-preset-id="${p.id}">
                  <div>
                    <div class="preset-chip-title">${p.title}</div>
                    <div class="preset-chip-text">"${p.text}"</div>
                  </div>
                  <button class="btn btn-primary" style="padding: 4px 10px; font-size: 0.75rem; white-space: nowrap;">
                    Speak Aloud
                  </button>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Custom Broadcast Message (Text to Speech Engine) -->
          <div>
            <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem;">
              ✍️ Custom Classroom Announcement
            </h4>
            <div style="background: var(--bg-surface); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <label style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem; display: block;">
                Type instructions to broadcast clearly via text-to-speech:
              </label>
              <textarea id="custom-broadcast-input" class="input-field" rows="3" style="resize: vertical; font-size: 0.9rem;" placeholder="e.g., Good morning students, please come to the seminar hall at 2 PM."></textarea>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem;">
                <span style="font-size: 0.78rem; color: var(--text-muted);">
                  Auto-plays campus bell then speaks aloud.
                </span>
                <button id="broadcast-custom-btn" class="btn btn-primary">
                  📢 Broadcast to ${room.id}
                </button>
              </div>
            </div>

            <!-- Intercom Talkback info -->
            <div style="background: rgba(99, 102, 241, 0.08); border: 1px dashed var(--accent-primary); border-radius: var(--radius-md); padding: 1rem; margin-top: 1rem; font-size: 0.82rem;">
              <strong style="color: var(--accent-primary);">💡 Hackathon Demo Pro-Tip:</strong>
              <p style="margin-top: 0.25rem; color: var(--text-secondary);">
                Switch to <strong>"Dual Demo Mode"</strong> in the top navbar to see both Faculty and Classroom screens side-by-side with real-time sound and waveform synchronization!
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach Event Handlers for Studio
    const studioMicBtn = container.querySelector('#studio-mic-btn');
    if (studioMicBtn) {
      studioMicBtn.addEventListener('click', () => {
        if (!this.broadcastSession.isActive) this.startBroadcast();
        else this.toggleMute();
      });
    }

    const studioStartBtn = container.querySelector('#studio-start-btn');
    if (studioStartBtn) {
      studioStartBtn.addEventListener('click', () => this.startBroadcast());
    }

    const studioMuteBtn = container.querySelector('#studio-mute-btn');
    if (studioMuteBtn) {
      studioMuteBtn.addEventListener('click', () => this.toggleMute());
    }

    const studioChimeBtn = container.querySelector('#studio-chime-btn');
    if (studioChimeBtn) {
      studioChimeBtn.addEventListener('click', () => {
        audioEngine.playCampusChime('campus');
        this.showToast('🔔 Campus chime sent to classroom speaker', 'success');
      });
    }

    const studioEndBtn = container.querySelector('#studio-end-btn');
    if (studioEndBtn) {
      studioEndBtn.addEventListener('click', () => this.endBroadcast());
    }

    container.querySelectorAll('.studio-preset-card').forEach(card => {
      card.addEventListener('click', () => {
        const pid = card.dataset.presetId;
        const p = this.presets.find(item => item.id === pid);
        if (p) this.triggerPreset(p);
      });
    });

    const customBtn = container.querySelector('#broadcast-custom-btn');
    const customInput = container.querySelector('#custom-broadcast-input');
    if (customBtn && customInput) {
      customBtn.addEventListener('click', () => {
        const txt = customInput.value.trim();
        if (!txt) {
          this.showToast('Please enter an announcement text', 'warning');
          return;
        }
        this.triggerPreset({ id: 'custom', title: 'Custom Notice', text: txt });
        customInput.value = '';
      });
    }

    // Canvas visualizer in Studio
    const canvas = container.querySelector('#studio-canvas');
    if (canvas) {
      if (this.broadcastSession.visualizerCleanup) {
        this.broadcastSession.visualizerCleanup();
      }
      this.broadcastSession.visualizerCleanup = audioEngine.startVisualizer(canvas, {
        style: 'wave',
        primaryColor: '#ef4444',
        secondaryColor: '#06b6d4'
      });
    }
  }

  // --- Page: Communication History ---
  renderHistoryPage(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 style="font-size: 1.35rem; font-weight: 700;">📜 Campus Communication History & Audit Logs</h2>
            <p style="font-size: 0.88rem; margin-top: 0.2rem;">
              Complete archive of all digital voice announcements broadcast from Faculty Cabins to Classrooms.
            </p>
          </div>
          <button id="export-history-btn" class="btn btn-secondary">
            📥 Export Audit Log (CSV)
          </button>
        </div>
      </div>

      <div class="card">
        <div class="history-table-container">
          <table class="history-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Origin</th>
                <th>Target Classroom</th>
                <th>Duration</th>
                <th>Category</th>
                <th>Announcement Content / Transcript</th>
                <th>Audience</th>
                <th>Playback</th>
              </tr>
            </thead>
            <tbody>
              ${this.history.map(item => `
                <tr>
                  <td style="font-weight: 600;">${item.timestamp}</td>
                  <td><span class="campus-status-pill" style="padding: 2px 8px; font-size: 0.75rem;">${item.cabin}</span></td>
                  <td><strong>${item.classroom}</strong></td>
                  <td><span style="font-family: var(--font-mono);">${item.duration}</span></td>
                  <td><span class="brand-badge" style="margin-left: 0;">${item.type}</span></td>
                  <td style="max-width: 320px;">"${item.transcript}"</td>
                  <td><span style="color: var(--color-success); font-weight: 600;">✓ ${item.recipients}</span></td>
                  <td>
                    <button class="btn btn-ghost replay-speech-btn" data-text="${encodeURIComponent(item.transcript)}" style="padding: 2px 8px; font-size: 0.8rem;">
                      🔊 Replay
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Replay buttons
    container.querySelectorAll('.replay-speech-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = decodeURIComponent(btn.dataset.text);
        audioEngine.speakText(text);
        this.showToast('🔊 Replaying announcement...', 'success');
      });
    });

    const exportBtn = container.querySelector('#export-history-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const csvContent = "data:text/csv;charset=utf-8," 
          + "ID,Timestamp,Cabin,Classroom,Duration,Transcript,Recipients\n"
          + this.history.map(e => `"${e.id}","${e.timestamp}","${e.cabin}","${e.classroom}","${e.duration}","${e.transcript.replace(/"/g, '""')}","${e.recipients}"`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `campus_voice_history_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.showToast('Audit log CSV exported successfully', 'success');
      });
    }
  }

  // --- Page: Profile & Settings ---
  renderSettingsPage(container) {
    container.innerHTML = `
      <div class="grid-2">
        <!-- Faculty Profile Information -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">👨‍🏫 Faculty Profile</h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div>
              <label style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-bottom: 0.35rem;">Full Name</label>
              <input type="text" id="prof-name-input" class="input-field" value="${this.faculty.name}" />
            </div>
            <div>
              <label style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-bottom: 0.35rem;">Department</label>
              <input type="text" id="prof-dept-input" class="input-field" value="${this.faculty.department}" />
            </div>
            <div class="grid-2">
              <div>
                <label style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-bottom: 0.35rem;">Faculty Cabin</label>
                <input type="text" id="prof-cabin-input" class="input-field" value="${this.faculty.cabin}" />
              </div>
              <div>
                <label style="font-size: 0.82rem; color: var(--text-secondary); display: block; margin-bottom: 0.35rem;">Cabin Intercom Ext</label>
                <input type="text" id="prof-ext-input" class="input-field" value="${this.faculty.phoneExt}" />
              </div>
            </div>
            <button id="save-profile-btn" class="btn btn-primary" style="align-self: flex-start;">
              Save Profile Changes
            </button>
          </div>
        </div>

        <!-- Audio Hardware & Campus Network Configuration -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">⚙️ Audio Hardware & Campus LAN</h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div>
              <label style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 0.35rem;">
                Microphone Input Device
              </label>
              <select class="input-field">
                <option>Default - Integrated High Definition Microphone Array</option>
                <option>USB Studio Condenser Mic (Cabin Desk)</option>
                <option>Bluetooth Wireless Headset</option>
              </select>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
                <label style="font-size: 0.85rem; color: var(--text-secondary);">Speaker Volume Output</label>
                <span id="vol-display" style="font-size: 0.85rem; font-weight: 600;">85%</span>
              </div>
              <input type="range" id="vol-slider" class="range-slider" min="0" max="100" value="85" />
            </div>

            <div style="background: var(--bg-surface); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <strong style="font-size: 0.88rem;">Campus LAN Diagnostics</strong>
                <button id="run-ping-btn" class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.75rem;">
                  Run Ping Test
                </button>
              </div>
              <div id="ping-results" style="font-size: 0.82rem; color: var(--text-secondary);">
                <div>Latency to Classroom ECE-301: <strong style="color: var(--color-success);">11 ms</strong></div>
                <div>Campus Wi-Fi 6 Gateway: <strong>Connected (1.2 Gbps)</strong></div>
                <div>Packet Loss: <strong style="color: var(--color-success);">0.0%</strong></div>
              </div>
            </div>

            <button id="play-chime-settings-btn" class="btn btn-secondary">
              🔔 Test Campus Announcement Bell Chime
            </button>
          </div>
        </div>
      </div>
    `;

    const saveProfileBtn = container.querySelector('#save-profile-btn');
    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', () => {
        this.faculty.name = container.querySelector('#prof-name-input').value;
        this.faculty.department = container.querySelector('#prof-dept-input').value;
        this.faculty.cabin = container.querySelector('#prof-cabin-input').value;
        this.faculty.phoneExt = container.querySelector('#prof-ext-input').value;
        this.showToast('Profile updated successfully', 'success');
      });
    }

    const volSlider = container.querySelector('#vol-slider');
    const volDisplay = container.querySelector('#vol-display');
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        if (volDisplay) volDisplay.textContent = val + '%';
        audioEngine.setVolume(val / 100);
      });
    }

    const chimeBtn = container.querySelector('#play-chime-settings-btn');
    if (chimeBtn) {
      chimeBtn.addEventListener('click', () => {
        audioEngine.playCampusChime('campus');
      });
    }

    const pingBtn = container.querySelector('#run-ping-btn');
    const pingResults = container.querySelector('#ping-results');
    if (pingBtn && pingResults) {
      pingBtn.addEventListener('click', () => {
        pingResults.innerHTML = `<em>Pinging campus core switch...</em>`;
        setTimeout(() => {
          pingResults.innerHTML = `
            <div>Latency to Classroom ECE-301: <strong style="color: var(--color-success);">9 ms</strong></div>
            <div>WebRTC Audio Buffer: <strong>20 ms (Ultra Low Latency)</strong></div>
            <div>Packet Loss: <strong style="color: var(--color-success);">0.0%</strong></div>
          `;
          this.showToast('Ping test passed! LAN audio connection is excellent.', 'success');
        }, 600);
      });
    }
  }

  // =========================================================================
  // VIEW 2: CLASSROOM DASHBOARD (STUDENT & PODIUM VIEW)
  // =========================================================================
  renderClassroomView(container = document.getElementById('main-content')) {
    container.innerHTML = `
      <div id="classroom-section-mount"></div>
    `;
    this.renderClassroomSection(document.getElementById('classroom-section-mount'));
  }

  renderClassroomSection(container = document.getElementById('classroom-section-mount')) {
    if (!container) return;
    const room = this.classrooms.find(c => c.id === this.classroomState.id) || this.classrooms[0];
    const isLive = this.classroomState.isBroadcasting;

    container.innerHTML = `
      <!-- Classroom Header -->
      <div class="card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(6,182,212,0.1)); border-left: 4px solid var(--accent-cyan);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 58px; height: 58px; border-radius: var(--radius-md); background: var(--accent-cyan-light); border: 2px solid var(--accent-cyan); display: flex; align-items: center; justify-content: center; font-size: 2rem;">
              🏫
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <h2 style="font-size: 1.4rem;">${room.name}</h2>
                <span class="campus-status-pill">
                  <span class="status-dot ${isLive ? 'pulsing' : ''}" style="${isLive ? 'background: #ef4444; box-shadow: 0 0 8px #ef4444;' : ''}"></span>
                  ${isLive ? 'LIVE BROADCAST ACTIVE' : 'SPEAKER STANDBY'}
                </span>
              </div>
              <p style="font-size: 0.88rem; margin-top: 0.2rem;">
                ${room.department} • <strong>${room.block}</strong>
              </p>
              <p style="font-size: 0.82rem; color: var(--accent-cyan); margin-top: 0.15rem;">
                🔊 ${room.speakerDevice} • ${room.occupancy} Students in Attendance
              </p>
            </div>
          </div>

          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <button id="student-doubt-btn" class="btn btn-primary" style="background: var(--color-warning); border-color: var(--color-warning);">
              ✋ Request to Speak / Ask Doubt
            </button>
            <button id="toggle-classroom-fullscreen-btn" class="btn btn-secondary">
              ⛶ Fullscreen Projector Mode
            </button>
          </div>
        </div>
      </div>

      <!-- Hero Classroom Speaker Display Widget -->
      <div class="classroom-speaker-display ${isLive ? 'active' : ''}">
        <!-- Acoustic Waves Animation -->
        <div class="speaker-acoustic-waves">
          <div class="ripple-circle"></div>
          <div class="ripple-circle"></div>
          <div class="ripple-circle"></div>
          <div class="speaker-core-icon">
            ${isLive ? '📢' : '🔊'}
          </div>
        </div>

        <!-- Faculty status banner -->
        ${isLive ? `
          <div class="active-faculty-banner">
            <span class="status-dot pulsing" style="background: #ef4444; box-shadow: 0 0 8px #ef4444;"></span>
            <span style="font-weight: 700; color: #fff;">
              ${this.classroomState.connectedFaculty || 'Dr. Divakar Verma (Cabin 204)'} IS SPEAKING LIVE
            </span>
          </div>
        ` : `
          <div class="active-faculty-banner" style="border-color: var(--border-subtle); color: var(--text-secondary);">
            <span class="status-dot"></span>
            <span>Standby • Listening for voice announcements from Faculty Cabins</span>
          </div>
        `}

        <h3 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 0.5rem; color: #fff;">
          ${isLive ? 'Faculty Voice Transmission in Progress' : 'Smart Classroom Ceiling Speaker Online'}
        </h3>

        <!-- Real-time dynamic visualizer inside classroom -->
        <div class="visualizer-container" style="max-width: 600px; height: 90px; margin: 1.5rem auto;">
          <canvas id="classroom-speaker-canvas" class="visualizer-canvas"></canvas>
          <div class="visualizer-overlay-info">
            ${isLive ? '● 48kHz STEREO PA RECEPTION' : 'IDLE'}
          </div>
        </div>

        <!-- Live Transcription Box -->
        <div class="transcript-bubble">
          <div style="font-size: 1.05rem; line-height: 1.4;">
            ${this.classroomState.transcript}
          </div>
        </div>

        <!-- Classroom Controls (Volume, Test Chime) -->
        <div style="display: flex; gap: 1.5rem; justify-content: center; align-items: center; flex-wrap: wrap; margin-top: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem; background: var(--bg-surface); padding: 0.5rem 1.25rem; border-radius: var(--radius-full); border: 1px solid var(--border-color);">
            <span style="font-size: 1.1rem;">🔊</span>
            <span style="font-size: 0.85rem; color: var(--text-secondary);">Speaker Volume:</span>
            <input type="range" id="class-vol-slider" class="range-slider" style="width: 120px;" min="0" max="100" value="${this.classroomState.volume}" />
            <span id="class-vol-label" style="font-size: 0.85rem; font-weight: 700;">${this.classroomState.volume}%</span>
          </div>

          <button id="class-test-chime-btn" class="btn btn-secondary btn-pill">
            🔔 Test Speaker Chime
          </button>
        </div>
      </div>

      <!-- Recent Announcements in this Classroom -->
      <div class="card" style="margin-top: 1.5rem;">
        <div class="card-header">
          <h3 class="card-title">📜 Today's Broadcasts in ${room.id}</h3>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${this.history.filter(h => h.classroom === room.id || h.classroom === 'ALL').map(h => `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem;">
                  <strong style="color: var(--accent-primary);">${h.faculty} (${h.cabin})</strong>
                  <span style="color: var(--text-muted);">• ${h.timestamp}</span>
                  <span class="brand-badge">${h.duration}</span>
                </div>
                <div style="font-size: 0.92rem; margin-top: 0.35rem; color: #fff;">
                  "${h.transcript}"
                </div>
              </div>
              <button class="btn btn-secondary replay-speech-btn" data-text="${encodeURIComponent(h.transcript)}" style="padding: 4px 12px; font-size: 0.8rem;">
                🔊 Replay Notice
              </button>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Student Doubt Query Modal -->
      <div id="doubt-modal" class="modal-overlay">
        <div class="modal-box">
          <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem;">
            ✋ Request to Speak / Ask Faculty Doubt
          </h3>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
            This sends an instant alert buzzer to <strong>${this.faculty.cabin}</strong> asking for two-way audio talkback.
          </p>
          <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem;">
            <input type="text" id="doubt-input" class="input-field" placeholder="e.g. Can you repeat the seminar hall room number?" value="Can you clarify if attendance is compulsory for the 2 PM seminar?" />
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-ghost doubt-preset-pill" style="font-size: 0.78rem; border: 1px solid var(--border-color);">
                "Please repeat the timing"
              </button>
              <button class="btn btn-ghost doubt-preset-pill" style="font-size: 0.78rem; border: 1px solid var(--border-color);">
                "Should we bring lab records?"
              </button>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button id="cancel-doubt-btn" class="btn btn-secondary">Cancel</button>
            <button id="send-doubt-btn" class="btn btn-primary" style="background: var(--color-warning); border-color: var(--color-warning);">
              Buzz Cabin 204
            </button>
          </div>
        </div>
      </div>
    `;

    // Visualizer for Classroom
    const canvas = container.querySelector('#classroom-speaker-canvas');
    if (canvas) {
      audioEngine.startVisualizer(canvas, {
        style: 'bars',
        primaryColor: isLive ? '#ef4444' : '#06b6d4',
        secondaryColor: isLive ? '#f59e0b' : '#3b82f6'
      });
    }

    // Classroom Volume slider
    const volSlider = container.querySelector('#class-vol-slider');
    const volLabel = container.querySelector('#class-vol-label');
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        this.classroomState.volume = val;
        if (volLabel) volLabel.textContent = val + '%';
        audioEngine.setVolume(val / 100);
      });
    }

    // Test Chime in classroom
    const chimeBtn = container.querySelector('#class-test-chime-btn');
    if (chimeBtn) {
      chimeBtn.addEventListener('click', () => {
        audioEngine.playCampusChime('campus');
        this.showToast('🔔 Classroom speaker chime test sounded', 'success');
      });
    }

    // Replay buttons
    container.querySelectorAll('.replay-speech-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = decodeURIComponent(btn.dataset.text);
        audioEngine.speakText(text);
        this.showToast('🔊 Replaying audio notice...', 'success');
      });
    });

    // Student Doubt Modal Logic
    const doubtModal = container.querySelector('#doubt-modal');
    const doubtBtn = container.querySelector('#student-doubt-btn');
    const cancelDoubtBtn = container.querySelector('#cancel-doubt-btn');
    const sendDoubtBtn = container.querySelector('#send-doubt-btn');
    const doubtInput = container.querySelector('#doubt-input');

    if (doubtBtn && doubtModal) {
      doubtBtn.addEventListener('click', () => {
        doubtModal.classList.add('active');
      });
    }

    if (cancelDoubtBtn && doubtModal) {
      cancelDoubtBtn.addEventListener('click', () => {
        doubtModal.classList.remove('active');
      });
    }

    container.querySelectorAll('.doubt-preset-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        if (doubtInput) doubtInput.value = pill.textContent.replace(/"/g, '').trim();
      });
    });

    if (sendDoubtBtn && doubtModal && doubtInput) {
      sendDoubtBtn.addEventListener('click', () => {
        const msg = doubtInput.value.trim() || 'Student has a question regarding the announcement.';
        campusBroadcast.send('STUDENT_REQUEST_TO_SPEAK', {
          requestId: 'req-' + Date.now(),
          classroomId: this.classroomState.id,
          message: msg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        doubtModal.classList.remove('active');
        this.showToast('✋ Request sent to Cabin 204!', 'warning');
      });
    }

    // Fullscreen projector mode
    const fsBtn = container.querySelector('#toggle-classroom-fullscreen-btn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }
  }

  // =========================================================================
  // VIEW 3: DUAL DEMO MODE (SPLIT THEATRE FOR HACKATHON PRESENTATION)
  // =========================================================================
  renderDualDemoView(container) {
    container.innerHTML = `
      <div style="margin-bottom: 1rem; text-align: center;">
        <span class="brand-badge" style="background: var(--color-live); color: white; padding: 4px 12px; font-size: 0.82rem;">
          🚀 HACKATHON LIVE DUAL SIMULATION THEATRE
        </span>
        <h2 style="font-size: 1.35rem; margin-top: 0.4rem;">
          Real-Time Intercom: Cabin 204 ↔ Classroom ECE-301
        </h2>
        <p style="font-size: 0.88rem; color: var(--text-secondary);">
          Experience how faculty transmits voice without walking, and students receive audio in real time with synchronized waveforms.
        </p>
      </div>

      <div class="split-theatre">
        <!-- LEFT: Faculty POV (Cabin 204) -->
        <div class="theatre-pane faculty-side">
          <div class="theatre-content" id="dual-faculty-container"></div>
        </div>

        <!-- RIGHT: Classroom POV (ECE-301 Speaker) -->
        <div class="theatre-pane classroom-side">
          <div class="theatre-content" id="dual-classroom-container"></div>
        </div>
      </div>
    `;

    // Render Faculty Console on Left
    const facMount = document.getElementById('dual-faculty-container');
    if (facMount) {
      this.renderDualFacultySide(facMount);
    }

    // Render Classroom Console on Right
    const clsMount = document.getElementById('dual-classroom-container');
    if (clsMount) {
      this.renderClassroomSection(clsMount);
    }
  }

  renderDualFacultySide(container) {
    const isLive = this.broadcastSession.isActive;
    const isMuted = this.broadcastSession.isMuted;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div>
          <h3 style="font-size: 1.15rem; font-weight: 700;">Dr. Divakar Verma</h3>
          <span style="font-size: 0.8rem; color: var(--accent-primary);">📍 Cabin 204 (Dept of ECE)</span>
        </div>
        <span class="campus-status-pill">
          <span class="status-dot ${isLive ? 'pulsing' : ''}" style="${isLive ? 'background: #ef4444; box-shadow: 0 0 8px #ef4444;' : ''}"></span>
          ${isLive ? 'BROADCASTING' : 'READY'}
        </span>
      </div>

      <div class="mic-broadcast-center" style="padding: 1.5rem 0;">
        <div class="mic-button-wrapper ${isLive ? 'broadcasting' : ''} ${isMuted ? 'muted' : ''}">
          <div class="mic-glow-ring"></div>
          <button id="dual-mic-btn" class="mic-btn-large">
            ${isLive ? (isMuted ? '🔇' : '🎙️') : '🎙️'}
          </button>
        </div>

        <h4 style="font-size: 1.2rem; font-weight: 700; margin-top: 0.5rem;">
          ${isLive ? (isMuted ? 'MICROPHONE MUTED' : 'LIVE TO ECE-301') : 'Click to Broadcast Voice'}
        </h4>

        <!-- Waveform canvas -->
        <div class="visualizer-container" style="height: 80px; width: 100%; margin: 1rem 0;">
          <canvas id="dual-faculty-canvas" class="visualizer-canvas"></canvas>
          <div class="visualizer-overlay-info">
            ${isLive ? 'PCM 48kHz' : 'STANDBY'}
          </div>
        </div>

        <!-- Timer & Controls -->
        <div style="display: flex; gap: 0.75rem; align-items: center; justify-content: center; flex-wrap: wrap;">
          ${!isLive ? `
            <button id="dual-start-btn" class="btn btn-primary btn-large">
              ▶️ Start Voice Broadcast
            </button>
          ` : `
            <div style="font-size: 1.1rem; font-family: var(--font-mono); font-weight: 700; color: var(--color-live); background: rgba(239,68,68,0.1); padding: 0.4rem 0.8rem; border-radius: var(--radius-md);">
              ⏱️ <span class="live-timer-display">${this.formatDuration(this.broadcastSession.durationSeconds)}</span>
            </div>
            <button id="dual-mute-btn" class="btn btn-secondary">
              ${isMuted ? '🔊 Unmute' : '🔇 Mute'}
            </button>
            <button id="dual-end-btn" class="btn btn-danger">
              ⏹️ End
            </button>
          `}
        </div>
      </div>

      <!-- Quick Preset Triggers in Dual Mode -->
      <div style="margin-top: auto; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
        <div style="font-size: 0.82rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text-secondary);">
          📢 One-Click Scenario Presets:
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${this.presets.slice(0, 3).map(p => `
            <button class="preset-chip dual-preset-btn" data-preset-id="${p.id}" style="padding: 0.6rem 0.8rem;">
              <div>
                <strong style="font-size: 0.82rem;">${p.title}</strong>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${p.text}</div>
              </div>
              <span style="font-size: 0.75rem; color: var(--accent-primary); font-weight: 700;">▶</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    // Event listeners for dual faculty side
    const dualMicBtn = container.querySelector('#dual-mic-btn');
    if (dualMicBtn) {
      dualMicBtn.addEventListener('click', () => {
        if (!isLive) this.startBroadcast();
        else this.toggleMute();
      });
    }

    const startBtn = container.querySelector('#dual-start-btn');
    if (startBtn) startBtn.addEventListener('click', () => this.startBroadcast());

    const muteBtn = container.querySelector('#dual-mute-btn');
    if (muteBtn) muteBtn.addEventListener('click', () => this.toggleMute());

    const endBtn = container.querySelector('#dual-end-btn');
    if (endBtn) endBtn.addEventListener('click', () => this.endBroadcast());

    container.querySelectorAll('.dual-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.presetId;
        const p = this.presets.find(item => item.id === pid);
        if (p) this.triggerPreset(p);
      });
    });

    const canvas = container.querySelector('#dual-faculty-canvas');
    if (canvas) {
      audioEngine.startVisualizer(canvas, {
        style: 'wave',
        primaryColor: '#6366f1',
        secondaryColor: '#10b981'
      });
    }
  }

  // --- Notifications / Toast helper ---
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span style="font-size: 1.1rem;">
        ${type === 'success' ? '✓' : type === 'danger' ? '⚠️' : type === 'warning' ? '✋' : 'ℹ️'}
      </span>
      <span style="font-size: 0.88rem; font-weight: 500;">${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.campusVoiceApp = new CampusVoiceApp();
});
