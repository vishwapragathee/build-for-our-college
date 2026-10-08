/**
 * Campus Voice Connect - Web Audio Engine & Visualizer
 * Provides real-time microphone capture, campus chime synthesis,
 * classroom speaker playback loopback, and visualizer rendering.
 */

export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.micStream = null;
    this.micSource = null;
    this.analyser = null;
    this.speakerGain = null;
    this.isMicActive = false;
    this.isMuted = false;
    this.volume = 0.85; // 85% default speaker volume
    this.useMicLoopback = false; // Prevent harsh acoustic feedback on single machine by default
    this.simulatedWavePhase = 0;
    this.isSimulating = false;
    this.animationFrameId = null;
    this.listeners = new Set();
  }

  ensureAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.speakerGain = this.audioCtx.createGain();
      this.speakerGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      this.speakerGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.speakerGain && this.audioCtx) {
      this.speakerGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  getVolume() {
    return this.volume;
  }

  /**
   * Synthesize classic campus two-tone announcement chime
   * F5 (698 Hz) -> A5 (880 Hz) or classic gentle chime
   */
  async playCampusChime(type = 'campus') {
    const ctx = this.ensureAudioContext();
    const now = ctx.currentTime;

    const masterChimeGain = ctx.createGain();
    masterChimeGain.gain.setValueAtTime(this.volume * 0.7, now);
    masterChimeGain.connect(ctx.destination);

    if (type === 'campus') {
      // Two-tone college announcement chime
      const tones = [
        { freq: 587.33, start: 0, dur: 0.35 },    // D5
        { freq: 880.00, start: 0.28, dur: 0.55 },  // A5
        { freq: 659.25, start: 0.65, dur: 0.8 }   // E5
      ];

      tones.forEach(tone => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(tone.freq, now + tone.start);

        noteGain.gain.setValueAtTime(0, now + tone.start);
        noteGain.gain.linearRampToValueAtTime(0.4, now + tone.start + 0.04);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);

        osc.connect(noteGain);
        noteGain.connect(masterChimeGain);

        osc.start(now + tone.start);
        osc.stop(now + tone.start + tone.dur);
      });
      return 1500;
    } else if (type === 'student-buzz') {
      // Gentle intercom double-beep for student question
      const tones = [
        { freq: 1046.50, start: 0, dur: 0.12 }, // C6
        { freq: 1318.51, start: 0.16, dur: 0.22 } // E6
      ];
      tones.forEach(tone => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(tone.freq, now + tone.start);

        noteGain.gain.setValueAtTime(0, now + tone.start);
        noteGain.gain.linearRampToValueAtTime(0.35, now + tone.start + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);

        osc.connect(noteGain);
        noteGain.connect(masterChimeGain);

        osc.start(now + tone.start);
        osc.stop(now + tone.start + tone.dur);
      });
      return 600;
    }
    return 1000;
  }

  /**
   * Request actual microphone from user
   */
  async startMicrophone() {
    this.ensureAudioContext();
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;

        this.micSource = this.audioCtx.createMediaStreamSource(this.micStream);
        this.micSource.connect(this.analyser);

        // Optional loopback to speakers (if enabled in settings)
        if (this.useMicLoopback && this.speakerGain) {
          this.micSource.connect(this.speakerGain);
        }

        this.isMicActive = true;
        this.isSimulating = false;
        return { success: true, mode: 'hardware_mic' };
      }
    } catch (err) {
      console.warn('Microphone permission denied or not available. Using high-fidelity synthetic wave simulation.', err);
    }

    // Fallback: Virtual/Simulated active audio wave
    this.initSimulatedAnalyser();
    this.isMicActive = true;
    this.isSimulating = true;
    return { success: true, mode: 'simulated_mic' };
  }

  initSimulatedAnalyser() {
    if (!this.analyser) {
      const ctx = this.ensureAudioContext();
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
    }
  }

  stopMicrophone() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.micSource) {
      try { this.micSource.disconnect(); } catch (e) {}
      this.micSource = null;
    }
    this.isMicActive = false;
    this.isSimulating = false;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach(t => {
        t.enabled = !this.isMuted;
      });
    }
    return this.isMuted;
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach(t => {
        t.enabled = !this.isMuted;
      });
    }
  }

  /**
   * Speak announcement text using Web Speech API aloud through speakers
   */
  speakText(text, onEnd) {
    if (!('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = this.volume;
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    // Pick a clean English voice if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Samantha')));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onend = () => {
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Render real-time dynamic audio waveform onto an HTML Canvas
   */
  startVisualizer(canvas, options = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const style = options.style || 'wave'; // 'wave' | 'bars' | 'circular'
    const primaryColor = options.primaryColor || '#6366f1';
    const secondaryColor = options.secondaryColor || '#10b981';

    let running = true;

    const render = () => {
      if (!running) return;
      const width = canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth : 400;
      const height = canvas.height = canvas.parentElement ? canvas.parentElement.clientHeight : 120;

      ctx.clearRect(0, 0, width, height);

      let dataArray;
      let activeLevel = 0;

      if (this.isMicActive && !this.isMuted) {
        if (!this.isSimulating && this.analyser) {
          const bufferLength = this.analyser.frequencyBinCount;
          dataArray = new Uint8Array(bufferLength);
          this.analyser.getByteFrequencyData(dataArray);

          // Calculate average energy
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          activeLevel = sum / bufferLength / 255;
          // Even when quiet, keep a gentle baseline pulse
          activeLevel = Math.max(0.12, activeLevel * 1.8);
        } else {
          // Synthetic audio simulation wave
          this.simulatedWavePhase += 0.08;
          activeLevel = 0.55 + Math.sin(this.simulatedWavePhase * 0.7) * 0.35;
          const count = 64;
          dataArray = new Uint8Array(count);
          for (let i = 0; i < count; i++) {
            const freq = Math.sin(i * 0.2 + this.simulatedWavePhase) * Math.cos(i * 0.1 - this.simulatedWavePhase * 0.5);
            dataArray[i] = Math.max(10, Math.min(255, (freq + 1) * 90 * activeLevel));
          }
        }
      } else {
        // Idle/Muted state: faint gentle resting flatline
        activeLevel = 0.02;
        const count = 64;
        dataArray = new Uint8Array(count).fill(5);
      }

      if (style === 'bars') {
        const barCount = 36;
        const barWidth = (width / barCount) * 0.65;
        const gap = (width - (barCount * barWidth)) / (barCount - 1);

        for (let i = 0; i < barCount; i++) {
          const dataIndex = Math.floor((i / barCount) * (dataArray.length / 2));
          const val = dataArray[dataIndex] || 10;
          const barHeight = Math.max(6, (val / 255) * height * 0.85);
          const x = i * (barWidth + gap);
          const y = (height - barHeight) / 2;

          // Gradient for bars
          const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
          grad.addColorStop(0, primaryColor);
          grad.addColorStop(1, secondaryColor);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 4);
          ctx.fill();
        }
      } else {
        // Smooth sine oscilloscope waveform
        const centerY = height / 2;
        ctx.beginPath();
        ctx.moveTo(0, centerY);

        const sliceWidth = width / (dataArray.length - 1);
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 128.0;
          const amp = (v - 1) * (height / 2.3) * (this.isMuted ? 0.05 : 1.2);
          const y = centerY + amp;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.strokeStyle = this.isMuted ? '#64748b' : primaryColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.shadowBlur = this.isMuted ? 0 : 12;
        ctx.shadowColor = primaryColor;
        ctx.stroke();

        // Secondary glow line
        if (!this.isMuted && this.isMicActive) {
          ctx.beginPath();
          ctx.moveTo(0, centerY);
          x = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128.0;
            const y = centerY - (v - 1) * (height / 3.0);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.strokeStyle = secondaryColor;
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
      }

      this.animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
    };
  }
}

export const audioEngine = new AudioEngine();
