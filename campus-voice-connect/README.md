# 🎙️ Campus Voice Connect
> **Real-Time Campus Intercom & Classroom PA System for Higher Education**

Campus Voice Connect bridges faculty cabins and classrooms through digital voice communication, eliminating unnecessary physical movement across academic blocks for announcements, lab instructions, syllabus queries, and urgent notices.

---

## 🎯 The Problem

In universities and engineering colleges:
* Faculty members spend significant portions of their working hours in **Faculty Cabins** (e.g., *Cabin 204, Academic Block B*).
* Students are situated inside **Classrooms and Laboratories** (e.g., *Classroom ECE-301, 3rd Floor*).
* For routine or urgent announcements (e.g., *"Guest lecture starting in Seminar Hall at 2 PM"*, *"Class postponed by 15 mins"*, *"Submit lab records before 4 PM"*), faculty have to physically walk down corridors, climb stairs, or send peons/messengers.
* This wastes **30–60 minutes per day** per professor, interrupts classroom focus, and creates severe latency during time-sensitive situations.

---

## 💡 The Solution

**Campus Voice Connect** provides an instant, bidirectional digital voice channel:
1. Faculty in Cabin 204 selects target classroom (ECE-301) from their smartphone, tablet, or laptop.
2. Taps **“Start Voice Broadcast”** or uses **Spacebar Push-to-Talk**.
3. A pleasant campus attention chime (Bing-Bong! 🔔) rings through the classroom smart speaker.
4. Faculty speaks directly into the cabin microphone.
5. Classroom wall/ceiling speakers play crystal-clear audio in real time, accompanied by a dynamic visualizer and live speech transcription on the smart board.
6. Students can raise a doubt or query via the **“✋ Request to Speak”** buzzer, opening a 2-way intercom back to the cabin.

### 📊 Quantified Campus Impact
* **Travel Reduced**: Eliminates **1.5 to 2.5 km** of daily walking per department.
* **Time Saved**: Saves ~**45 minutes per faculty member daily**.
* **Latency**: Message delivery drops from **8 minutes (walking)** to **under 2 seconds (instant IP audio)**.
* **Campus Safety**: Instant campus-wide or block-wide emergency PA broadcast with one click.

---

## 🌟 Key Features & 7 Pages Architecture

### 1. 🔑 Login & Role Portal (`#login`)
* Single Sign-On (SSO) for Campus LAN.
* Quick 1-click hackathon profiles:
  * **Faculty Persona**: Dr. Divakar Verma (Cabin 204, Dept of ECE).
  * **Classroom Podium**: Classroom ECE-301 Terminal.
  * **Dual Demo Theatre**: Side-by-side presentation mode.

### 2. 📊 Faculty Dashboard (`#dashboard`)
* Faculty profile badge (Cabin 204, Extension #4204, ECE Dept).
* Online/Busy/Offline status indicator.
* Campus mobility impact counter (km saved, airtime, students reached).
* Tactile, glowing **Large Microphone Button** with radar pulse ring.
* Quick-target classroom dropdown with instant live occupancy.
* Recent broadcast history table with duration, listener count, and one-click audio replay.
* Incoming Student Doubt alerts tray with chime buzzer.

### 3. 🏫 Classroom Speaker Dashboard (`#classroom`)
* Displays classroom name, block, floor, and hardware status.
* Connected faculty cabin indicator (*"Dr. Divakar Verma speaking from Cabin 204"*).
* Hero animated speaker widget with acoustic soundwave ripples.
* Multi-frequency audio equalizer bars visualizer.
* Real-time live transcript ticker.
* Master volume slider (0–100%) and **Test Speaker Chime** button.
* **“✋ Request to Speak”** student button with question topic presets.
* Projector / Fullscreen mode for classroom smart boards.

### 4. 🗺️ Classroom Selection & Campus Map (`#classrooms`)
* Interactive 2D coordinate campus floor map showing academic blocks.
* Filter by block (*Block B - Academic*, *Block A - Computing*, *Research Labs*).
* Occupancy counters (e.g., ECE-301: 62/70 students).
* Multi-broadcast / Campus-wide Public Address (PA) broadcast option.

### 5. 🎙️ Live Voice Broadcast Studio (`#broadcast`)
* Full-screen broadcast console with glowing red **ON AIR** indicator.
* Real-time timer (`00:24`) and audience counter (`62 Listeners`).
* High-resolution oscilloscope waveform canvas powered by HTML5 Web Audio API.
* Controls: Large Push-to-Talk Mic, Mute/Unmute, Campus Attention Chime, End Broadcast.
* **Instant Audio Presets**:
  * *"Good morning students, please come to the seminar hall at 2 PM."*
  * *"Class postponed by 15 minutes due to department meeting."*
  * *"Please submit assignments at Cabin 204 before 4 PM."*
* Custom announcement composer with text-to-speech audio synthesis.

### 6. 📜 Communication History & Audit Logs (`#history`)
* Complete audit trail of past broadcasts.
* Metadata: timestamp, cabin, target room, duration, delivery receipts, transcripts.
* In-browser audio replay for any historical notice.
* One-click **Export Audit Log (CSV)**.

### 7. ⚙️ Profile & Audio Hardware Settings (`#settings`)
* Faculty cabin details & intercom extension configuration.
* Microphone device selector and sensitivity test with live VU meter.
* Master output volume slider.
* Campus LAN latency ping diagnostics (11 ms, 0.0% packet loss).
* Chime sound selector.

### 🚀 Bonus: Dual Demo Mode (`#dual`)
* Designed specifically for hackathon judges and stage demonstrations!
* Splits screen side-by-side:
  * **Left**: Faculty Cabin 204 Console.
  * **Right**: Classroom ECE-301 Smart Speaker Receiver.
* When you speak or trigger a preset on the left, the right side immediately animates, plays sound, pulses acoustic waves, and displays the transcript!
* Cross-tab synchronization via `BroadcastChannel` and `localStorage` events.

---

## 🛠️ Technical Stack & Architecture

* **Frontend**: Vanilla ES6+ Modules, HTML5 Web Audio API, Canvas 2D API, Web Speech API (`speechSynthesis`), CSS3 Flexbox/Grid with glassmorphism.
* **Audio Synthesis**: Native browser oscillators creating dual-tone university bells (D5 -> A5 -> E5 at 587Hz / 880Hz / 659Hz).
* **Microphone Processing**: `navigator.mediaDevices.getUserMedia` with fallback to dynamic synthetic frequency generation when mic permissions are restricted.
* **Synchronization**: Zero-latency cross-tab communication via `BroadcastChannel` and storage event bus.
* **Backend**: Zero-dependency Node.js HTTP server (`server.js`) using built-in `http`, `fs`, and `path`.

---

## 🚀 How to Run & Demo

### 1. Launch the Local Server
From the project folder, run:
```powershell
& "$env:APPDATA\Antigravity\bin\agy-node.cmd" server.js
```
*(or standard `node server.js` if Node is in your global PATH)*

### 2. Open in Browser
Visit **`http://localhost:3000`** in Google Chrome or Microsoft Edge.

### 3. Recommended Hackathon Presentation Flow
1. Click **“🚀 Split Demo”** in the top navigation bar.
2. Point out **Cabin 204** on the left and **Classroom ECE-301** on the right.
3. Click the preset: **📢 "Good morning students, please come to the seminar hall at 2 PM."**
4. Observe:
   - Left side starts live timer and oscilloscope waveform.
   - Right side plays the campus chime, starts speaker acoustic pulse ripples, and speaks the message aloud!
5. On the right side, click **“✋ Request to Speak”** and buzz the cabin.
6. On the left side, notice the instant alert chime and incoming student query notification!
7. Click **“Classroom Selection & Map”** to demonstrate how faculty can target any room or the entire campus.

---

*Developed for the Campus Tech Hackathon 2026.*
