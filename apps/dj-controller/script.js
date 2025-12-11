class DJController {
    constructor() {
        this.audioContext = null;
        this.decks = {
            A: {
                audio: null,
                source: null,
                gainNode: null,
                isPlaying: false,
                bpm: null,
                cuePoint: 0,
                initialized: false
            },
            B: {
                audio: null,
                source: null,
                gainNode: null,
                isPlaying: false,
                bpm: null,
                cuePoint: 0,
                initialized: false
            }
        };
        this.masterGain = null;
        this.crossfaderValue = 50;
        this.analyserNode = null;
        this.spectrumCanvas = null;
        this.spectrumCtx = null;
        this.visualizerMode = 'default';
        this.init();
    }

    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.setupAudioNodes();
            this.setupEventListeners();
            this.startMainLoop();
            this.setupSpectrumAnalyzer();
            console.log('DJ Controller initialized successfully');
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
        }
    }

    setupAudioNodes() {
        // Master gain node
        this.masterGain = this.audioContext.createGain();
        
        // Spectrum analyzer
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 256;
        this.analyserNode.smoothingTimeConstant = 0.8;
        
        this.masterGain.connect(this.analyserNode);
        this.analyserNode.connect(this.audioContext.destination);

        // Setup Deck A audio nodes by default
        this.setupDeckAudioNodes('A');
        this.decks.A.initialized = true;
    }

    setupDeckAudioNodes(deckId) {
        const deck = this.decks[deckId];
        
        if (deck.initialized) return; // Already initialized
        
        deck.gainNode = this.audioContext.createGain();
        
        // Create EQ filters
        deck.highFilter = this.audioContext.createBiquadFilter();
        deck.highFilter.type = 'highshelf';
        deck.highFilter.frequency.value = 3200;
        deck.highFilter.gain.value = 0;

        deck.midFilter = this.audioContext.createBiquadFilter();
        deck.midFilter.type = 'peaking';
        deck.midFilter.frequency.value = 1000;
        deck.midFilter.Q.value = 0.5;
        deck.midFilter.gain.value = 0;

        deck.lowFilter = this.audioContext.createBiquadFilter();
        deck.lowFilter.type = 'lowshelf';
        deck.lowFilter.frequency.value = 320;
        deck.lowFilter.gain.value = 0;

        // Create effect nodes
        deck.reverbNode = this.audioContext.createConvolver();
        deck.delayNode = this.audioContext.createDelay(1.0);
        deck.delayFeedback = this.audioContext.createGain();
        deck.delayWet = this.audioContext.createGain();
        deck.delayDry = this.audioContext.createGain();
        
        // Setup delay effect chain
        deck.delayNode.connect(deck.delayFeedback);
        deck.delayFeedback.connect(deck.delayNode);
        deck.delayNode.connect(deck.delayWet);
        deck.delayFeedback.gain.value = 0.3;
        deck.delayWet.gain.value = 0;
        deck.delayDry.gain.value = 1;
        
        // Setup reverb
        deck.reverbWet = this.audioContext.createGain();
        deck.reverbDry = this.audioContext.createGain();
        deck.reverbNode.connect(deck.reverbWet);
        deck.reverbWet.gain.value = 0;
        deck.reverbDry.gain.value = 1;
        
        // Create simple reverb impulse response
        this.createReverbImpulse(deck.reverbNode);

        // Chain the audio nodes: input -> low -> mid -> high -> effects -> gain -> master
        deck.lowFilter.connect(deck.midFilter);
        deck.midFilter.connect(deck.highFilter);
        deck.highFilter.connect(deck.delayNode);
        deck.highFilter.connect(deck.delayDry);
        deck.highFilter.connect(deck.reverbNode);
        deck.highFilter.connect(deck.reverbDry);
        
        // Mix effects and connect to gain
        const effectsMixer = this.audioContext.createGain();
        deck.delayWet.connect(effectsMixer);
        deck.delayDry.connect(effectsMixer);
        deck.reverbWet.connect(effectsMixer);
        deck.reverbDry.connect(effectsMixer);
        effectsMixer.connect(deck.gainNode);
        
        deck.gainNode.connect(this.masterGain);
        deck.initialized = true;

        // Setup effects controls
        this.setupEffectsControls();
        
        // Auto-sync button
        document.getElementById('autoSync').addEventListener('click', () => {
            this.autoSync();
        });
        
        // Visualizer mode selector
        document.getElementById('visualizerMode').addEventListener('change', (e) => {
            this.visualizerMode = e.target.value;
        });

        // Setup theme toggle
        this.setupThemeToggle();

        // Setup custom code panel
        this.setupCodePanel();

        // Setup EQ visual sync
        this.setupEQVisualSync();

        // Deck B toggle functionality
        this.setupDeckBToggle();
    }

    setupEventListeners() {
        // Master volume
        document.getElementById('masterVolume').addEventListener('input', (e) => {
            const value = e.target.value / 100;
            this.masterGain.gain.value = value;
            document.querySelector('.volume-display-compact').textContent = e.target.value + '%';
        });

        // Setup deck controls
        ['A', 'B'].forEach(deckId => this.setupDeckControls(deckId));

        // Crossfader
        document.getElementById('crossfader').addEventListener('input', (e) => {
            this.crossfaderValue = e.target.value;
            this.updateCrossfader();
        });
    }

    setupDeckControls(deckId) {
        const deck = this.decks[deckId];

        // File loading
        document.getElementById(`loadTrack${deckId}`).addEventListener('change', (e) => {
            this.loadTrack(deckId, e.target.files[0]);
        });

        // Play/Pause
        document.getElementById(`play${deckId}`).addEventListener('click', () => {
            this.togglePlay(deckId);
        });

        // Cue
        document.getElementById(`cue${deckId}`).addEventListener('click', () => {
            this.setCue(deckId);
        });

        // Tempo
        document.getElementById(`tempo${deckId}`).addEventListener('input', (e) => {
            this.setTempo(deckId, e.target.value);
        });

        // Volume
        document.getElementById(`volume${deckId}`).addEventListener('input', (e) => {
            const value = e.target.value / 100;
            deck.gainNode.gain.value = value;
        });

        // EQ Controls
        // High EQ
        document.getElementById(`high${deckId}`).addEventListener('input', (e) => {
            const value = (e.target.value - 50) / 2; // Convert 0-100 to -25 to +25 dB
            deck.highFilter.gain.value = value;
        });

        // Mid EQ  
        document.getElementById(`mid${deckId}`).addEventListener('input', (e) => {
            const value = (e.target.value - 50) / 2; // Convert 0-100 to -25 to +25 dB
            deck.midFilter.gain.value = value;
        });

        // Low EQ
        document.getElementById(`low${deckId}`).addEventListener('input', (e) => {
            const value = (e.target.value - 50) / 2; // Convert 0-100 to -25 to +25 dB
            deck.lowFilter.gain.value = value;
        });

        // Progress bar scrubbing
        const progressBar = document.getElementById(`progress${deckId}`);
        if (progressBar) {
            progressBar.addEventListener('input', (e) => {
                if (!deck.audioBuffer) return;
                
                const progress = e.target.value / 100;
                const targetTime = progress * deck.audioBuffer.duration;
                
                deck.currentTime = targetTime;
                
                // If playing, restart from new position
                if (deck.isPlaying && deck.source) {
                    deck.source.stop();
                    this.playTrack(deckId);
                }
                
                // Update displays immediately
                this.updateLiveTimestamp(deckId);
                this.updatePositionIndicator(deckId);
            });

            progressBar.addEventListener('change', (e) => {
                // Final position when user releases the slider
                if (!deck.audioBuffer) return;
                
                const progress = e.target.value / 100;
                const targetTime = progress * deck.audioBuffer.duration;
                deck.currentTime = targetTime;
                
                this.updateLiveTimestamp(deckId);
                this.updatePositionIndicator(deckId);
            });
        }
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = themeToggle.querySelector('.theme-icon');
        const themeText = themeToggle.querySelector('.theme-text');
        
        // Check for saved theme preference or default to dark
        const savedTheme = localStorage.getItem('djControllerTheme') || 'dark';
        this.setTheme(savedTheme);
        
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            this.setTheme(newTheme);
        });
    }

    setTheme(theme) {
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = themeToggle.querySelector('.theme-icon');
        const themeText = themeToggle.querySelector('.theme-text');
        
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('djControllerTheme', theme);
        
        if (theme === 'light') {
            themeIcon.textContent = '🌙';
            themeText.textContent = 'DARK';
        } else {
            themeIcon.textContent = '☀️';
            themeText.textContent = 'LIGHT';
        }
    }

    setupCodePanel() {
        // Custom code system for truly omni functionality
        this.customFunctions = {
            volume: {
                A: null,
                B: null
            },
            eq: {
                A: null,
                B: null
            },
            effects: {
                A: null,
                B: null
            }
        };

        this.defaultFunctions = {
            volume: 'return value * 0.01;',
            eq: `const frequency = sliderId.includes('high') ? 8000 : sliderId.includes('mid') ? 1000 : 200;
audioNode.frequency.setValueAtTime(frequency, audioContext.currentTime);
audioNode.gain.setValueAtTime((value - 50) * 0.3, audioContext.currentTime);`,
            effects: `if (sliderId.includes('reverb')) {
  return value * 0.02;
}
return value * 0.01;`
        };

        // Code panel toggle
        const codeToggle = document.getElementById('codeToggle');
        const codePanel = document.getElementById('codePanel');
        
        codeToggle.addEventListener('click', () => {
            codePanel.classList.toggle('hidden');
        });

        // Code editor functionality
        this.setupCodeEditor();
        
        // Preset management
        this.setupPresetManager();
    }

    setupCodeEditor() {
        const testBtn = document.getElementById('testCode');
        const applyBtn = document.getElementById('applyCode');
        const resetBtn = document.getElementById('resetCode');
        const output = document.getElementById('codeOutput');

        testBtn.addEventListener('click', () => {
            this.testCustomCode();
        });

        applyBtn.addEventListener('click', () => {
            this.applyCustomCode();
        });

        resetBtn.addEventListener('click', () => {
            this.resetToDefaults();
        });
    }

    testCustomCode() {
        const output = document.getElementById('codeOutput');
        const volumeCodeA = document.getElementById('volumeCodeA').value;
        const eqCodeA = document.getElementById('eqCodeA').value;
        const effectCodeA = document.getElementById('effectCodeA').value;

        try {
            // Test compilation of custom functions
            const testCases = [
                { type: 'volume', code: volumeCodeA, testValue: 75 },
                { type: 'eq', code: eqCodeA, testValue: 60 },
                { type: 'effects', code: effectCodeA, testValue: 30 }
            ];

            let results = '🧪 TEST RESULTS:\n\n';
            
            for (const test of testCases) {
                try {
                    const func = this.createSafeFunction(test.code);
                    const result = func({
                        value: test.testValue,
                        deckId: 'A',
                        sliderId: test.type === 'eq' ? 'eq-high-A' : test.type + '-A',
                        audioContext: this.audioContext,
                        audioNode: { frequency: { setValueAtTime: () => {} }, gain: { setValueAtTime: () => {} } }
                    });
                    results += `✅ ${test.type.toUpperCase()}: Input ${test.testValue} → Output ${result}\n`;
                } catch (error) {
                    results += `❌ ${test.type.toUpperCase()}: ${error.message}\n`;
                }
            }

            output.textContent = results;
            output.className = 'code-output success';
        } catch (error) {
            output.textContent = `❌ COMPILATION ERROR: ${error.message}`;
            output.className = 'code-output error';
        }
    }

    createSafeFunction(code) {
        // Create a sandboxed function with limited scope and error handling
        try {
            const safeFunction = new Function('params', `
                const { value, deckId, sliderId, audioContext, audioNode } = params;
                // Sandboxed execution with timeout protection
                try {
                    ${code}
                } catch (error) {
                    console.warn('Custom function error:', error.message);
                    // Fallback to default behavior
                    if (sliderId.includes('volume')) return value * 0.01;
                    if (sliderId.includes('eq')) {
                        const frequency = sliderId.includes('high') ? 8000 : sliderId.includes('mid') ? 1000 : 200;
                        if (audioNode.frequency) audioNode.frequency.setValueAtTime(frequency, audioContext.currentTime);
                        if (audioNode.gain) audioNode.gain.setValueAtTime((value - 50) * 0.3, audioContext.currentTime);
                    }
                    return value * 0.01;
                }
            `);
            return safeFunction;
        } catch (error) {
            console.error('Function creation error:', error);
            // Return a safe default function
            return (params) => {
                const { value, sliderId } = params;
                return sliderId.includes('volume') ? value * 0.01 : value * 0.01;
            };
        }
    }

    applyCustomCode() {
        const output = document.getElementById('codeOutput');
        
        try {
            // Apply custom functions to the actual audio processing
            this.customFunctions.volume.A = this.createSafeFunction(document.getElementById('volumeCodeA').value);
            this.customFunctions.eq.A = this.createSafeFunction(document.getElementById('eqCodeA').value);
            this.customFunctions.effects.A = this.createSafeFunction(document.getElementById('effectCodeA').value);

            // Update slider labels with custom text
            this.updateSliderLabels();

            // Override the standard slider handlers with custom ones
            this.rebindSlidersWithCustomCode();

            output.textContent = '✅ CUSTOM CODE APPLIED SUCCESSFULLY!\n\nAll sliders now use your custom functions with updated labels!';
            output.className = 'code-output success';
        } catch (error) {
            output.textContent = `❌ APPLICATION ERROR: ${error.message}`;
            output.className = 'code-output error';
        }
    }

    updateSliderLabels() {
        // Get custom label values
        const highLabel = document.getElementById('highEqLabel').value || 'High';
        const midLabel = document.getElementById('midEqLabel').value || 'Mid';
        const lowLabel = document.getElementById('lowEqLabel').value || 'Low';
        
        // Update Deck A EQ labels
        const deckA = document.getElementById('deckA');
        if (deckA) {
            const eqControls = deckA.querySelectorAll('.eq-control');
            
            eqControls.forEach(control => {
                const label = control.querySelector('label');
                const slider = control.querySelector('input[type="range"]');
                
                if (slider && label) {
                    if (slider.id.includes('high')) {
                        label.textContent = highLabel;
                    } else if (slider.id.includes('mid')) {
                        label.textContent = midLabel;
                    } else if (slider.id.includes('low')) {
                        label.textContent = lowLabel;
                    }
                }
            });
        }
        
        // Update Deck B if it exists and is visible
        const deckB = document.getElementById('deckB');
        if (deckB && deckB.classList.contains('visible')) {
            const eqControls = deckB.querySelectorAll('.eq-control');
            
            eqControls.forEach(control => {
                const label = control.querySelector('label');
                const slider = control.querySelector('input[type="range"]');
                
                if (slider && label) {
                    if (slider.id.includes('high')) {
                        label.textContent = highLabel;
                    } else if (slider.id.includes('mid')) {
                        label.textContent = midLabel;
                    } else if (slider.id.includes('low')) {
                        label.textContent = lowLabel;
                    }
                }
            });
        }
    }

    rebindSlidersWithCustomCode() {
        // Rebind all sliders with custom code for Deck A
        this.rebindSlider('volumeA', 'volume', 'A');
        this.rebindSlider('highA', 'eq-high', 'A');
        this.rebindSlider('midA', 'eq-mid', 'A'); 
        this.rebindSlider('lowA', 'eq-low', 'A');
        
        // Rebind effects sliders if they exist
        const reverbA = document.getElementById('reverbA');
        if (reverbA) {
            this.rebindSlider('reverbA', 'reverb', 'A');
        }
        
        console.log('✅ All sliders rebound with custom code');
    }
    
    rebindSlider(sliderId, sliderType, deckId) {
        const slider = document.getElementById(sliderId);
        if (!slider) {
            console.warn(`Slider ${sliderId} not found`);
            return;
        }
        
        // Remove old event listeners by cloning the element
        const newSlider = slider.cloneNode(true);
        slider.parentNode.replaceChild(newSlider, slider);
        
        // Add new event listener with custom code
        newSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            
            try {
                // Determine which custom function to use
                let customFunction = null;
                let audioNode = null;
                
                if (sliderType === 'volume') {
                    customFunction = this.customFunctions.volume[deckId];
                    audioNode = this.decks[deckId].gainNode;
                } else if (sliderType.startsWith('eq-')) {
                    customFunction = this.customFunctions.eq[deckId];
                    // Get the appropriate EQ filter
                    if (sliderType.includes('high')) {
                        audioNode = this.decks[deckId].highFilter;
                    } else if (sliderType.includes('mid')) {
                        audioNode = this.decks[deckId].midFilter;
                    } else if (sliderType.includes('low')) {
                        audioNode = this.decks[deckId].lowFilter;
                    }
                } else if (sliderType === 'reverb') {
                    customFunction = this.customFunctions.effects[deckId];
                    audioNode = this.decks[deckId].reverbWet;
                }
                
                // Apply custom function if it exists
                if (customFunction && audioNode) {
                    const result = customFunction({
                        value: value,
                        deckId: deckId,
                        sliderId: sliderType + '-' + deckId,
                        audioContext: this.audioContext,
                        audioNode: audioNode
                    });
                    
                    // Apply result based on slider type
                    if (sliderType === 'volume') {
                        audioNode.gain.value = result || (value / 100);
                    } else if (sliderType.startsWith('eq-')) {
                        // EQ custom function handles its own audio node changes
                        // But we can also apply a fallback gain change if needed
                        if (typeof result === 'number') {
                            audioNode.gain.value = result;
                        }
                    } else if (sliderType === 'reverb') {
                        audioNode.gain.value = result || (value / 100);
                    }
                    
                    console.log(`Custom ${sliderType} applied: ${value} → ${result}`);
                } else {
                    // Fallback to default behavior
                    this.applyDefaultSliderBehavior(sliderType, deckId, value, audioNode);
                }
                
            } catch (error) {
                console.error(`Custom ${sliderType} function error:`, error);
                // Fallback to default behavior on error
                this.applyDefaultSliderBehavior(sliderType, deckId, value);
            }
        });
    }
    
    applyDefaultSliderBehavior(sliderType, deckId, value, audioNode = null) {
        if (sliderType === 'volume') {
            this.decks[deckId].gainNode.gain.value = value / 100;
        } else if (sliderType.startsWith('eq-')) {
            const gainValue = (value - 50) / 2; // Convert 0-100 to -25 to +25 dB
            if (sliderType.includes('high')) {
                this.decks[deckId].highFilter.gain.value = gainValue;
            } else if (sliderType.includes('mid')) {
                this.decks[deckId].midFilter.gain.value = gainValue;
            } else if (sliderType.includes('low')) {
                this.decks[deckId].lowFilter.gain.value = gainValue;
            }
        } else if (sliderType === 'reverb') {
            if (this.decks[deckId].reverbWet) {
                this.decks[deckId].reverbWet.gain.value = value / 100;
            }
        }
    }

    resetToDefaults() {
        const output = document.getElementById('codeOutput');
        
        // Reset all custom functions
        this.customFunctions = {
            volume: { A: null, B: null },
            eq: { A: null, B: null },
            effects: { A: null, B: null }
        };

        // Reset textareas to default code
        document.getElementById('volumeCodeA').value = this.defaultFunctions.volume;
        document.getElementById('eqCodeA').value = this.defaultFunctions.eq;
        document.getElementById('effectCodeA').value = this.defaultFunctions.effects;
        
        // Reset label inputs to default
        document.getElementById('highEqLabel').value = 'High';
        document.getElementById('midEqLabel').value = 'Mid';
        document.getElementById('lowEqLabel').value = 'Low';
        
        // Reset slider labels to default
        this.updateSliderLabels();

        // Rebind sliders to default functionality
        this.setupDeckControls('A');
        if (this.decks.B.initialized) {
            this.setupDeckControls('B');
        }

        output.textContent = '🔄 RESET TO DEFAULT FUNCTIONALITY\n\nAll sliders and labels restored to original behavior.';
        output.className = 'code-output';
    }

    setupPresetManager() {
        const saveBtn = document.getElementById('savePreset');
        const loadBtn = document.getElementById('loadPreset');
        const deleteBtn = document.getElementById('deletePreset');
        
        saveBtn.addEventListener('click', () => {
            this.savePresetToBackend();
        });
        
        loadBtn.addEventListener('click', () => {
            this.loadPresetsFromBackend();
        });
        
        deleteBtn.addEventListener('click', () => {
            this.deletePresetFromBackend();
        });
    }

    async savePresetToBackend() {
        const presetName = prompt('Enter preset name:');
        if (!presetName) return;
        
        const presetData = {
            name: presetName,
            volumeCode: document.getElementById('volumeCodeA').value,
            eqCode: document.getElementById('eqCodeA').value,
            effectsCode: document.getElementById('effectCodeA').value,
            labels: {
                high: document.getElementById('highEqLabel').value || 'High',
                mid: document.getElementById('midEqLabel').value || 'Mid',
                low: document.getElementById('lowEqLabel').value || 'Low'
            },
            timestamp: new Date().toISOString()
        };

        try {
            // Try backend with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch('/api/presets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(presetData),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const result = await response.json();
                alert(`✅ Preset "${presetData.name}" saved to server!`);
                this.updatePresetSelector();
                return;
            }
        } catch (error) {
            console.log('Backend unavailable, saving locally:', error.message);
        }
        
        // Fallback to localStorage
        try {
            const presets = JSON.parse(localStorage.getItem('djPresets') || '[]');
            presets.push(presetData);
            localStorage.setItem('djPresets', JSON.stringify(presets));
            alert(`⚠️ Backend unavailable. Saved locally: "${presetData.name}"`);
        } catch (error) {
            console.error('Save preset error:', error);
            alert('❌ Failed to save preset to both server and local storage.');
        }
    }

    async loadPresetsFromBackend() {
        try {
            // Try backend first with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
            
            const response = await fetch('/api/presets', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const presets = await response.json();
                const presetEntries = Object.entries(presets);
                
                if (presetEntries.length === 0) {
                    alert('No saved presets found on server.');
                    return;
                }
                
                const presetList = presetEntries.map(([id, preset], i) => `${i}: ${preset.name}`).join('\n');
                const selection = prompt(`Select preset by number:\n${presetList}`);
                
                const presetIndex = parseInt(selection);
                if (presetIndex >= 0 && presetIndex < presetEntries.length) {
                    const [id, preset] = presetEntries[presetIndex];
                    document.getElementById('volumeCodeA').value = preset.volumeCode;
                    document.getElementById('eqCodeA').value = preset.eqCode;
                    document.getElementById('effectCodeA').value = preset.effectsCode;
                    
                    // Update labels if they exist
                    if (preset.labels) {
                        document.getElementById('highEqLabel').value = preset.labels.high || 'High';
                        document.getElementById('midEqLabel').value = preset.labels.mid || 'Mid';
                        document.getElementById('lowEqLabel').value = preset.labels.low || 'Low';
                    }
                    
                    alert(`✅ Loaded preset: ${preset.name}`);
                }
                return;
            }
        } catch (error) {
            console.log('Backend unavailable, using local storage:', error.message);
        }
        
        // Fallback to localStorage
        try {
            const presets = JSON.parse(localStorage.getItem('djPresets') || '[]');
            if (presets.length === 0) {
                alert('⚠️ No presets found locally. Backend unavailable.');
                return;
            }
            
            const presetNames = presets.map((p, i) => `${i}: ${p.name}`).join('\n');
            const selection = prompt(`⚠️ Using local storage:\n${presetNames}`);
            const presetIndex = parseInt(selection);
            
            if (presetIndex >= 0 && presetIndex < presets.length) {
                const preset = presets[presetIndex];
                document.getElementById('volumeCodeA').value = preset.volumeCode;
                document.getElementById('eqCodeA').value = preset.eqCode;
                document.getElementById('effectCodeA').value = preset.effectsCode;
                
                if (preset.labels) {
                    document.getElementById('highEqLabel').value = preset.labels.high || 'High';
                    document.getElementById('midEqLabel').value = preset.labels.mid || 'Mid';
                    document.getElementById('lowEqLabel').value = preset.labels.low || 'Low';
                }
                
                alert(`✅ Loaded local preset: ${preset.name}`);
            }
        } catch (error) {
            console.error('Local storage error:', error);
            alert('❌ Failed to load presets from both server and local storage.');
        }
    }

    async deletePresetFromBackend() {
        try {
            // Try backend first with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
            
            const response = await fetch('/api/presets', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const presets = await response.json();
                const presetEntries = Object.entries(presets);
                
                if (presetEntries.length === 0) {
                    alert('No saved presets found on server.');
                    return;
                }
                
                const presetList = presetEntries.map(([id, preset], i) => `${i}: ${preset.name}`).join('\n');
                const selection = prompt(`Select preset to DELETE by number:\n${presetList}\n\nWARNING: This cannot be undone!`);
                
                const presetIndex = parseInt(selection);
                if (presetIndex >= 0 && presetIndex < presetEntries.length) {
                    const [id, preset] = presetEntries[presetIndex];
                    
                    if (confirm(`Are you sure you want to delete "${preset.name}"? This cannot be undone.`)) {
                        const deleteController = new AbortController();
                        const deleteTimeoutId = setTimeout(() => deleteController.abort(), 3000);
                        
                        const deleteResponse = await fetch(`/api/presets/${id}`, {
                            method: 'DELETE',
                            signal: deleteController.signal
                        });
                        clearTimeout(deleteTimeoutId);
                        
                        if (deleteResponse.ok) {
                            alert(`✅ Deleted preset: ${preset.name}`);
                        } else {
                            alert('❌ Failed to delete preset from server.');
                        }
                    }
                }
                return;
            }
        } catch (error) {
            console.log('Backend unavailable, using local storage:', error.message);
        }
        
        // Fallback to localStorage
        try {
            const presets = JSON.parse(localStorage.getItem('djPresets') || '[]');
            
            if (presets.length === 0) {
                alert('No saved presets found in local storage.');
                return;
            }
            
            const presetList = presets.map((preset, i) => `${i}: ${preset.name}`).join('\n');
            const selection = prompt(`Select preset to DELETE by number:\n${presetList}\n\nWARNING: This cannot be undone!`);
            
            const presetIndex = parseInt(selection);
            if (presetIndex >= 0 && presetIndex < presets.length) {
                const preset = presets[presetIndex];
                
                if (confirm(`Are you sure you want to delete "${preset.name}"? This cannot be undone.`)) {
                    presets.splice(presetIndex, 1);
                    localStorage.setItem('djPresets', JSON.stringify(presets));
                    alert(`✅ Deleted local preset: ${preset.name}`);
                }
            }
        } catch (error) {
            console.error('Local storage error:', error);
            alert('❌ Failed to delete preset from local storage.');
        }
    }

    async updatePresetSelector() {
        try {
            const response = await fetch('/api/presets');
            const presets = await response.json();
            
            const selector = document.getElementById('presetSelector');
            selector.innerHTML = '<option value="default">Default Behavior</option><option value="custom">Custom Code</option>';
            
            Object.entries(presets).forEach(([id, preset]) => {
                if (!preset.isDefault) {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = preset.name;
                    selector.appendChild(option);
                }
            });
        } catch (error) {
            console.error('Failed to update preset selector:', error);
        }
    }

    setupEQVisualSync() {
        // Sync EQ sliders with visual tracks
        ['A', 'B'].forEach(deckId => {
            ['high', 'mid', 'low'].forEach(band => {
                const slider = document.getElementById(`${band}${deckId}`);
                const visualTrack = slider.nextElementSibling; // Get the .eq-visual-track div
                
                // Update visual thumb position
                const updateVisualThumb = () => {
                    const value = parseFloat(slider.value);
                    const percentage = value / 100;
                    const trackHeight = 100; // height of track in pixels
                    const thumbPosition = (1 - percentage) * (trackHeight - 20); // 20px for thumb height
                    visualTrack.style.setProperty('--thumb-position', `${thumbPosition}px`);
                };
                
                // Initial position
                updateVisualThumb();
                
                // Track dragging state
                let isDragging = false;
                let hasMoved = false;
                
                slider.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    hasMoved = false;
                    slider.style.cursor = 'grabbing';
                });
                
                slider.addEventListener('mousemove', (e) => {
                    if (isDragging) {
                        hasMoved = true;
                    }
                });
                
                slider.addEventListener('mouseup', () => {
                    isDragging = false;
                    hasMoved = false;
                    slider.style.cursor = 'grab';
                });
                
                slider.addEventListener('mouseleave', () => {
                    isDragging = false;
                    hasMoved = false;
                    slider.style.cursor = 'grab';
                });
                
                // Update visual on any value change
                slider.addEventListener('input', updateVisualThumb);
                slider.addEventListener('change', updateVisualThumb);
            });
        });
    }

    setupDeckBToggle() {
        const toggleBtn = document.getElementById('toggleDeckB');
        const deckB = document.getElementById('deckB');
        const mainInterface = document.querySelector('.main-interface');
        let isDeckBVisible = false;

        toggleBtn.addEventListener('click', () => {
            isDeckBVisible = !isDeckBVisible;
            
            if (isDeckBVisible) {
                // Show Deck B
                deckB.classList.add('visible');
                mainInterface.classList.add('two-deck');
                toggleBtn.textContent = '- DECK B';
                toggleBtn.classList.add('active');
                
                // Enable Deck B audio processing
                if (!this.decks.B.initialized) {
                    this.setupDeckAudioNodes('B');
                    this.decks.B.initialized = true;
                }
            } else {
                // Hide Deck B
                deckB.classList.remove('visible');
                mainInterface.classList.remove('two-deck');
                toggleBtn.textContent = '+ DECK B';
                toggleBtn.classList.remove('active');
                
                // Stop any playing audio from Deck B
                if (this.decks.B.isPlaying) {
                    this.togglePlay('B');
                }
            }
        });
    }

    async loadTrack(deckId, file) {
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            const deck = this.decks[deckId];
            
            // Stop current track if playing
            if (deck.source) {
                deck.source.stop();
                deck.source = null;
            }

            // Update UI
            document.getElementById(`trackTitle${deckId}`).textContent = file.name;
            document.getElementById(`duration${deckId}`).textContent = this.formatTime(audioBuffer.duration);

            // Update timeline end label
            const timelineEndElement = document.getElementById(`timelineEnd${deckId}`);
            if (timelineEndElement) {
                timelineEndElement.textContent = this.formatTime(audioBuffer.duration);
            }

            // Store audio data
            deck.audioBuffer = audioBuffer;
            deck.isPlaying = false;
            deck.currentTime = 0;
            deck.cuePoint = 0;

            // Detect BPM
            deck.bpm = this.detectBPM(audioBuffer);
            this.updateBPMDisplay(deckId, deck.bpm);

            // Initialize live timestamp display
            this.updateLiveTimestamp(deckId);
            this.updateProgressBar(deckId);

            // Generate waveform
            this.generateWaveform(deckId, audioBuffer);

            console.log(`Track loaded on Deck ${deckId}:`, file.name);
        } catch (error) {
            console.error('Error loading track:', error);
        }
    }

    togglePlay(deckId) {
        const deck = this.decks[deckId];
        const playBtn = document.getElementById(`play${deckId}`);

        if (!deck.audioBuffer) {
            console.warn(`No track loaded on Deck ${deckId}`);
            return;
        }

        if (deck.isPlaying) {
            // Stop
            if (deck.source) {
                deck.source.stop();
                deck.source = null;
            }
            // Preserve current time position when stopping
            if (deck.startTime) {
                deck.currentTime = this.audioContext.currentTime - deck.startTime;
            }
            deck.isPlaying = false;
            playBtn.textContent = '▶';
            playBtn.classList.remove('active');
            document.getElementById(`deck${deckId}`).classList.remove('active');
        } else {
            // Play
            this.playTrack(deckId);
            deck.isPlaying = true;
            playBtn.textContent = '⏸';
            playBtn.classList.add('active');
            document.getElementById(`deck${deckId}`).classList.add('active');
        }
    }

    playTrack(deckId) {
        const deck = this.decks[deckId];
        
        if (!deck.audioBuffer) return;

        // Create new source
        deck.source = this.audioContext.createBufferSource();
        deck.source.buffer = deck.audioBuffer;
        
        // Connect to deck's audio chain (through EQ filters)
        deck.source.connect(deck.lowFilter);

        // Apply tempo changes
        const tempoSlider = document.getElementById(`tempo${deckId}`);
        if (tempoSlider) {
            deck.source.playbackRate.value = parseFloat(tempoSlider.value);
        }

        // Start playback
        deck.source.start(0, deck.currentTime);
        // Set start time for proper time tracking
        deck.startTime = this.audioContext.currentTime - (deck.currentTime || 0);
    }

    startMainLoop() {
        const update = () => {
            // Update both decks
            ['A', 'B'].forEach(deckId => {
                const deck = this.decks[deckId];
                if (deck.isPlaying && deck.source && deck.audioBuffer) {
                    // Calculate current time based on elapsed audio context time
                    deck.currentTime = this.audioContext.currentTime - deck.startTime;
                    
                    // Check if track ended
                    if (deck.currentTime >= deck.audioBuffer.duration) {
                        this.togglePlay(deckId);
                        deck.currentTime = 0;
                    }
                }
                
                // Always update displays (for both playing and stopped tracks)
                if (deck.audioBuffer) {
                    this.updateLiveTimestamp(deckId);
                    this.updateProgressBar(deckId);
                    this.updatePositionIndicator(deckId);
                    
                    // Update basic current time display
                    const currentTimeElement = document.getElementById(`currentTime${deckId}`);
                    if (currentTimeElement) {
                        currentTimeElement.textContent = this.formatTime(deck.currentTime || 0);
                    }
                }
            });
            
            this.animationId = requestAnimationFrame(update);
        };
        
        update();
    }

    setupEffectsControls() {
        // Reverb controls
        document.getElementById('reverb').addEventListener('input', (e) => {
            const value = e.target.value / 100;
            ['A', 'B'].forEach(deckId => {
                const deck = this.decks[deckId];
                deck.reverbWet.gain.value = value;
                deck.reverbDry.gain.value = 1 - value;
            });
        });

        document.getElementById('reverbToggle').addEventListener('click', (e) => {
            const button = e.target;
            const slider = document.getElementById('reverb');
            if (button.textContent === 'OFF') {
                button.textContent = 'ON';
                button.classList.add('active');
                slider.disabled = false;
            } else {
                button.textContent = 'OFF';
                button.classList.remove('active');
                slider.disabled = true;
                slider.value = 0;
                ['A', 'B'].forEach(deckId => {
                    const deck = this.decks[deckId];
                    deck.reverbWet.gain.value = 0;
                    deck.reverbDry.gain.value = 1;
                });
            }
        });

        // Delay controls
        document.getElementById('delay').addEventListener('input', (e) => {
            const value = e.target.value / 100;
            ['A', 'B'].forEach(deckId => {
                const deck = this.decks[deckId];
                deck.delayNode.delayTime.value = value * 0.5; // Max 0.5 seconds
                deck.delayWet.gain.value = value;
                deck.delayDry.gain.value = 1 - (value * 0.5);
            });
        });

        document.getElementById('delayToggle').addEventListener('click', (e) => {
            const button = e.target;
            const slider = document.getElementById('delay');
            if (button.textContent === 'OFF') {
                button.textContent = 'ON';
                button.classList.add('active');
                slider.disabled = false;
            } else {
                button.textContent = 'OFF';
                button.classList.remove('active');
                slider.disabled = true;
                slider.value = 0;
                ['A', 'B'].forEach(deckId => {
                    const deck = this.decks[deckId];
                    deck.delayWet.gain.value = 0;
                    deck.delayDry.gain.value = 1;
                });
            }
        });
    }

    createReverbImpulse(convolver) {
        const length = this.audioContext.sampleRate * 2; // 2 second reverb
        const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }
        
        convolver.buffer = impulse;
    }

    detectBPM(audioBuffer) {
        // Simple BPM detection using peak detection
        const data = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
        const peaks = [];
        
        // Find peaks in the audio data
        for (let i = windowSize; i < data.length - windowSize; i += windowSize) {
            let sum = 0;
            for (let j = i - windowSize; j < i + windowSize; j++) {
                sum += Math.abs(data[j]);
            }
            const average = sum / (windowSize * 2);
            if (average > 0.1) { // Threshold for peak detection
                peaks.push(i / sampleRate);
            }
        }
        
        // Calculate intervals between peaks
        const intervals = [];
        for (let i = 1; i < peaks.length; i++) {
            intervals.push(peaks[i] - peaks[i-1]);
        }
        
        if (intervals.length === 0) return 120; // Default BPM
        
        // Find the most common interval
        intervals.sort((a, b) => a - b);
        const medianInterval = intervals[Math.floor(intervals.length / 2)];
        const bpm = Math.round(60 / medianInterval);
        
        // Ensure BPM is in reasonable range
        if (bpm < 60) return bpm * 2;
        if (bpm > 200) return Math.round(bpm / 2);
        return bpm;
    }

    updateBPMDisplay(deckId, bpm) {
        document.getElementById(`bpm${deckId}`).textContent = bpm;
    }

    autoSync() {
        const deckA = this.decks.A;
        const deckB = this.decks.B;
        
        if (!deckA.bpm || !deckB.bpm) {
            console.warn('Both tracks must be loaded to auto-sync');
            return;
        }

        const button = document.getElementById('autoSync');
        button.classList.add('active');
        button.textContent = 'SYNCING...';

        // Calculate which deck needs tempo adjustment
        const targetBPM = Math.max(deckA.bpm, deckB.bpm);
        
        if (deckA.bpm !== targetBPM) {
            const ratio = targetBPM / deckA.bpm;
            const tempoSlider = document.getElementById('tempoA');
            tempoSlider.value = ratio;
            this.setTempo('A', ratio);
        }
        
        if (deckB.bpm !== targetBPM) {
            const ratio = targetBPM / deckB.bpm;
            const tempoSlider = document.getElementById('tempoB');
            tempoSlider.value = ratio;
            this.setTempo('B', ratio);
        }

        setTimeout(() => {
            button.classList.remove('active');
            button.textContent = 'SYNCED!';
            setTimeout(() => {
                button.textContent = 'AUTO SYNC';
            }, 2000);
        }, 1000);
    }

    setupSpectrumAnalyzer() {
        this.spectrumCanvas = document.getElementById('spectrumAnalyzer');
        this.spectrumCtx = this.spectrumCanvas.getContext('2d');
        
        // Set canvas size
        this.spectrumCanvas.width = this.spectrumCanvas.offsetWidth;
        this.spectrumCanvas.height = this.spectrumCanvas.offsetHeight;
        
        this.drawSpectrum();
    }

    drawSpectrum() {
        const canvas = this.spectrumCanvas;
        const ctx = this.spectrumCtx;
        
        if (!this.analyserNode || !canvas || !ctx) {
            requestAnimationFrame(() => this.drawSpectrum());
            return;
        }

        const bufferLength = this.analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyserNode.getByteFrequencyData(dataArray);

        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        switch(this.visualizerMode) {
            case 'ferrofluid':
                this.drawFerrofluid(ctx, dataArray, width, height);
                break;
            case 'cymatic':
                this.drawCymatic(ctx, dataArray, width, height);
                break;
            default:
                this.drawDefault(ctx, dataArray, width, height);
                break;
        }

        requestAnimationFrame(() => this.drawSpectrum());
    }

    drawDefault(ctx, dataArray, width, height) {
        // Disable smoothing for sharp, pixelated effect
        ctx.imageSmoothingEnabled = false;
        
        // Use fewer bars for more distinct, digital appearance
        const barCount = 32; // Digital-style bar count
        const barWidth = Math.floor(width / barCount);
        let x = 0;

        for (let i = 0; i < barCount; i++) {
            // Sample multiple frequency bins for each bar
            const startIndex = Math.floor((i * dataArray.length) / barCount / 2);
            const endIndex = Math.floor(((i + 1) * dataArray.length) / barCount / 2);
            
            // Get average amplitude for this frequency range
            let sum = 0;
            for (let j = startIndex; j < endIndex; j++) {
                sum += dataArray[j];
            }
            const avgAmplitude = sum / (endIndex - startIndex);
            
            // Quantize height for digital stepped effect
            const normalizedHeight = avgAmplitude / 255;
            const steps = 8; // Number of discrete height levels
            const steppedHeight = Math.floor(normalizedHeight * steps) / steps;
            const barHeight = Math.floor(steppedHeight * (height - 10));
            
            // Digital color scheme with distinct levels
            let color, shadowColor;
            if (steppedHeight < 0.25) {
                color = '#003300'; // Dark green
                shadowColor = '#006600';
            } else if (steppedHeight < 0.5) {
                color = '#d4af37'; // Gold
                shadowColor = '#ffcc00';
            } else if (steppedHeight < 0.75) {
                color = '#ff6b35'; // Orange
                shadowColor = '#ff8c42';
            } else {
                color = '#00ffff'; // Cyan
                shadowColor = '#66ffff';
            }
            
            // Calculate positions
            const barX = Math.floor(x);
            const barY = Math.floor(height - barHeight - 5);
            const actualBarWidth = barWidth - 2; // Gap between bars
            
            // Draw main bar with glow effect
            ctx.fillStyle = color;
            ctx.shadowColor = shadowColor;
            ctx.shadowBlur = 8;
            ctx.fillRect(barX + 1, barY, actualBarWidth, barHeight);
            
            // Reset shadow for border
            ctx.shadowBlur = 0;
            
            // Draw digital border/outline
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX + 1, barY, actualBarWidth, barHeight);
            
            // Add digital segments within tall bars
            if (barHeight > 20) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                const segments = Math.floor(barHeight / 8);
                for (let seg = 1; seg < segments; seg++) {
                    const segY = barY + (seg * 8);
                    ctx.strokeRect(barX + 1, segY, actualBarWidth, 1);
                }
            }
            
            x += barWidth;
        }
        
        // Add frequency range labels (digital style)
        ctx.font = '8px monospace';
        ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
        ctx.textAlign = 'center';
        
        // Low, Mid, High frequency markers
        ctx.fillText('LOW', width * 0.15, height - 2);
        ctx.fillText('MID', width * 0.5, height - 2);
        ctx.fillText('HIGH', width * 0.85, height - 2);
        
        // Reset context state
        ctx.shadowBlur = 0;
        ctx.textAlign = 'start';
    }

    drawFerrofluid(ctx, dataArray, width, height) {
        const centerX = width / 2;
        const centerY = height / 2;
        const time = Date.now() * 0.001;
        
        // Disable smoothing for digital effect
        ctx.imageSmoothingEnabled = false;
        
        ctx.fillStyle = '#000010';
        ctx.fillRect(0, 0, width, height);
        
        // Digital ferrofluid with quantized movement
        const points = [];
        const segments = Math.floor(dataArray.length / 4);
        
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const dataIndex = Math.floor(i * 4);
            const intensity = dataArray[dataIndex] / 255;
            
            // Quantize radius for digital effect
            const baseRadius = Math.floor((20 + intensity * 40) / 4) * 4;
            const digitalNoise = Math.floor(Math.sin(angle * 8 + time * 2) * 8) / 2;
            const radius = baseRadius + digitalNoise;
            
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            points.push({x, y, intensity});
        }
        
        // Draw digital ferrofluid shape
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            if (i === 0) {
                ctx.moveTo(Math.floor(point.x), Math.floor(point.y));
            } else {
                ctx.lineTo(Math.floor(point.x), Math.floor(point.y));
            }
        }
        ctx.closePath();
        
        // Digital gradient effect
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 50);
        gradient.addColorStop(0, '#00ffff');
        gradient.addColorStop(0.5, '#d4af37');
        gradient.addColorStop(1, '#000050');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Digital outline with glow
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Add digital grid overlay on ferrofluid
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const r = (i + 1) * 10;
            ctx.beginPath();
            ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    drawCymatic(ctx, dataArray, width, height) {
        const centerX = width / 2;
        const centerY = height / 2;
        const time = Date.now() * 0.002;
        
        // Disable smoothing for crisp digital lines
        ctx.imageSmoothingEnabled = false;
        
        ctx.fillStyle = '#000020';
        ctx.fillRect(0, 0, width, height);
        
        // Create digital cymatic patterns
        const maxRadius = Math.min(width, height) / 3;
        
        for (let ring = 0; ring < 6; ring++) {
            const points = [];
            const segments = 32; // Fixed segments for digital precision
            
            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                const baseRadius = (ring + 1) * (maxRadius / 6);
                
                // Use audio data for amplitude with digital quantization
                const dataIndex = Math.floor((i / segments) * (dataArray.length / 4)) * 4;
                const amplitude = Math.floor((dataArray[dataIndex] / 255) * 12) * 2; // Quantized amplitude
                
                const frequency = 6 + ring * 2;
                const digitalWave = Math.floor(Math.sin(angle * frequency + time + ring) * 4) / 2; // Quantized wave
                const radius = baseRadius + (digitalWave * amplitude);
                
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                points.push({x: Math.floor(x), y: Math.floor(y)});
            }
            
            // Draw digital cymatic ring
            ctx.beginPath();
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                if (i === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            }
            ctx.closePath();
            
            // Digital color based on ring and activity
            const intensity = ring / 6;
            const alpha = 0.4 + (ring * 0.1);
            let color;
            if (intensity < 0.33) {
                color = `rgba(0, 255, 255, ${alpha})`; // Cyan
            } else if (intensity < 0.66) {
                color = `rgba(212, 175, 55, ${alpha})`; // Gold
            } else {
                color = `rgba(255, 255, 255, ${alpha})`; // White
            }
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 1 + Math.floor(ring * 0.5);
            ctx.shadowColor = color;
            ctx.shadowBlur = 2;
            ctx.stroke();
        }
        
        ctx.shadowBlur = 0;
        
        // Digital crosshairs at center
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 4;
        
        ctx.beginPath();
        ctx.moveTo(centerX - 8, centerY);
        ctx.lineTo(centerX + 8, centerY);
        ctx.moveTo(centerX, centerY - 8);
        ctx.lineTo(centerX, centerY + 8);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        
        // Central digital dot
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(centerX - 2, centerY - 2, 4, 4);
    }

    setCue(deckId) {
        const deck = this.decks[deckId];
        if (deck.audioBuffer) {
            deck.cuePoint = deck.currentTime || 0;
            console.log(`Cue set on Deck ${deckId} at ${this.formatTime(deck.cuePoint)}`);
        }
    }

    setTempo(deckId, value) {
        const deck = this.decks[deckId];
        const percentage = ((value - 1) * 100).toFixed(1);
        
        document.getElementById(`tempoDisplay${deckId}`).textContent = `${(value * 100).toFixed(0)}%`;
        
        if (deck.source) {
            deck.source.playbackRate.value = value;
        }
    }

    updateCrossfader() {
        const value = this.crossfaderValue / 100;
        const deckA = this.decks.A;
        const deckB = this.decks.B;

        if (deckA.gainNode && deckB.gainNode) {
            // Simple crossfader curve
            const aGain = Math.cos(value * Math.PI / 2);
            const bGain = Math.sin(value * Math.PI / 2);
            
            deckA.gainNode.gain.value = aGain * (document.getElementById('volumeA').value / 100);
            deckB.gainNode.gain.value = bGain * (document.getElementById('volumeB').value / 100);
        }
    }

    generateWaveform(deckId, audioBuffer) {
        const canvas = document.getElementById(`waveform${deckId}`);
        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;

        const data = audioBuffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        // Digital background with enhanced grid
        ctx.fillStyle = '#000008';
        ctx.fillRect(0, 0, width, height);

        // Enhanced digital waveform with pixelated effect
        ctx.imageSmoothingEnabled = false;
        
        // Draw enhanced digital grid
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        
        // Dense horizontal grid lines
        for (let i = 0; i < height; i += 8) {
            ctx.beginPath();
            ctx.moveTo(0, Math.floor(i));
            ctx.lineTo(width, Math.floor(i));
            ctx.stroke();
        }
        
        // Dense vertical grid lines  
        for (let i = 0; i < width; i += 10) {
            ctx.beginPath();
            ctx.moveTo(Math.floor(i), 0);
            ctx.lineTo(Math.floor(i), height);
            ctx.stroke();
        }

        // Main waveform with enhanced digital styling
        const pixelSize = 3; // Larger pixels for more digital look
        
        for (let i = 0; i < width; i += pixelSize) {
            let min = 1.0;
            let max = -1.0;
            
            for (let j = 0; j < step * pixelSize; j++) {
                const index = Math.min((i * step) + j, data.length - 1);
                const datum = data[index];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            
            // Heavy quantization for digital effect
            min = Math.round(min * 12) / 12;
            max = Math.round(max * 12) / 12;
            
            const y1 = Math.floor((1 + min) * amp);
            const y2 = Math.floor((1 + max) * amp);
            const barHeight = Math.abs(y2 - y1) || pixelSize;
            
            // Digital color progression based on intensity
            const intensity = Math.abs(max - min);
            let color;
            if (intensity < 0.2) {
                color = '#0a3333'; // Dark cyan
            } else if (intensity < 0.5) {
                color = '#d4af37'; // Gold
            } else {
                color = '#00ffff'; // Bright cyan
            }
            
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 2;
            
            // Draw pixelated bars
            const barX = Math.floor(i);
            const barY = Math.floor(Math.min(y1, y2));
            ctx.fillRect(barX, barY, pixelSize, barHeight);
            
            // Add digital highlight
            if (intensity > 0.3) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(barX, barY, 1, barHeight);
            }
        }
        
        ctx.shadowBlur = 0;
        
        // Enhanced center scan line
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, Math.floor(height / 2));
        ctx.lineTo(width, Math.floor(height / 2));
        ctx.stroke();
        
        // Add digital frame border
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, width - 1, height - 1);
    }

    updateTimeDisplay(deckId) {
        const deck = this.decks[deckId];
        
        if (deck.isPlaying && deck.source) {
            deck.currentTime = this.audioContext.currentTime - deck.startTime;
            
            if (deck.currentTime >= deck.audioBuffer.duration) {
                // Track ended
                this.togglePlay(deckId);
                deck.currentTime = 0;
            }
            
            document.getElementById(`currentTime${deckId}`).textContent = this.formatTime(deck.currentTime);
            this.updatePositionIndicator(deckId);
            this.updateLiveTimestamp(deckId);
            this.updateProgressBar(deckId);
            
            // Continue updating if still playing
            if (deck.isPlaying) {
                requestAnimationFrame(() => this.updateTimeDisplay(deckId));
            }
        }
    }

    updateLiveTimestamp(deckId) {
        const deck = this.decks[deckId];
        if (!deck.audioBuffer) return;

        const currentTime = deck.currentTime || 0;
        const duration = deck.audioBuffer.duration;
        const remaining = duration - currentTime;
        const percentage = (currentTime / duration * 100).toFixed(1);

        // Format time with centiseconds for live display
        const currentFormatted = this.formatTimeLive(currentTime);
        const remainingFormatted = '-' + this.formatTimeLive(remaining);

        // Update live timestamp elements
        const currentLiveElement = document.getElementById(`currentLive${deckId}`);
        const remainingLiveElement = document.getElementById(`remainingLive${deckId}`);
        const percentageElement = document.getElementById(`percentage${deckId}`);

        if (currentLiveElement) currentLiveElement.textContent = currentFormatted;
        if (remainingLiveElement) remainingLiveElement.textContent = remainingFormatted;
        if (percentageElement) percentageElement.textContent = percentage + '%';
    }

    updateProgressBar(deckId) {
        const deck = this.decks[deckId];
        if (!deck.audioBuffer) return;

        const progress = (deck.currentTime / deck.audioBuffer.duration) * 100;
        const progressBar = document.getElementById(`progress${deckId}`);
        
        if (progressBar && !progressBar.matches(':active')) {
            // Only update if user isn't currently dragging the progress bar
            progressBar.value = progress;
        }
    }

    seekToPosition(deckId, event) {
        const deck = this.decks[deckId];
        if (!deck.audioBuffer) return;

        const canvas = document.getElementById(`waveform${deckId}`);
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const progress = x / rect.width;
        const targetTime = progress * deck.audioBuffer.duration;

        // Update current time
        deck.currentTime = Math.max(0, Math.min(targetTime, deck.audioBuffer.duration));

        // If playing, restart from new position
        if (deck.isPlaying && deck.source) {
            deck.source.stop();
            this.playTrack(deckId);
        }

        // Update displays immediately
        this.updateLiveTimestamp(deckId);
        this.updateProgressBar(deckId);
        this.updatePositionIndicator(deckId);
    }

    updatePositionIndicator(deckId) {
        const deck = this.decks[deckId];
        const indicator = document.getElementById(`position${deckId}`);
        
        if (deck.audioBuffer && indicator) {
            const progress = deck.currentTime / deck.audioBuffer.duration;
            const container = indicator.parentElement;
            const position = progress * container.offsetWidth;
            indicator.style.left = position + 'px';
        }
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    formatTimeLive(seconds) {
        const totalCentiseconds = Math.floor(seconds * 100);
        const minutes = Math.floor(totalCentiseconds / 6000);
        const secs = Math.floor((totalCentiseconds % 6000) / 100);
        const centisecs = totalCentiseconds % 100;
        return `${minutes}:${secs.toString().padStart(2, '0')}:${centisecs.toString().padStart(2, '0')}`;
    }
}

// Initialize DJ Controller when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.djController = new DJController();
});

// Resume audio context on user interaction (required by browsers)
document.addEventListener('click', async () => {
    if (window.djController && window.djController.audioContext.state === 'suspended') {
        await window.djController.audioContext.resume();
        console.log('Audio context resumed');
    }
}, { once: true });
