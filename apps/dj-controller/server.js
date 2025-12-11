const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const PRESETS_FILE = path.join(__dirname, 'presets.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Initialize presets file if it doesn't exist
async function initializePresets() {
    try {
        await fs.access(PRESETS_FILE);
    } catch {
        await fs.writeFile(PRESETS_FILE, JSON.stringify({
            default: {
                name: "Default Behavior",
                volumeCode: "return value * 0.01;",
                eqCode: `const frequency = sliderId.includes('high') ? 8000 : sliderId.includes('mid') ? 1000 : 200;
audioNode.frequency.setValueAtTime(frequency, audioContext.currentTime);
audioNode.gain.setValueAtTime((value - 50) * 0.3, audioContext.currentTime);`,
                effectsCode: `if (sliderId.includes('reverb')) {
  return value * 0.02;
}
return value * 0.01;`,
                timestamp: new Date().toISOString(),
                isDefault: true
            }
        }, null, 2));
    }
}

// API Routes

// Get all presets
app.get('/api/presets', async (req, res) => {
    try {
        const data = await fs.readFile(PRESETS_FILE, 'utf8');
        const presets = JSON.parse(data);
        res.json(presets);
    } catch (error) {
        console.error('Error loading presets:', error);
        res.status(500).json({ error: 'Failed to load presets' });
    }
});

// Save a new preset
app.post('/api/presets', async (req, res) => {
    try {
        const { name, volumeCode, eqCode, effectsCode } = req.body;
        
        // Validate input
        if (!name || !volumeCode || !eqCode || !effectsCode) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Load existing presets
        const data = await fs.readFile(PRESETS_FILE, 'utf8');
        const presets = JSON.parse(data);
        
        // Generate unique ID
        const presetId = `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Add new preset
        presets[presetId] = {
            name,
            volumeCode,
            eqCode,
            effectsCode,
            timestamp: new Date().toISOString(),
            isDefault: false
        };

        // Save back to file
        await fs.writeFile(PRESETS_FILE, JSON.stringify(presets, null, 2));
        
        res.json({ 
            message: 'Preset saved successfully', 
            presetId,
            preset: presets[presetId]
        });
    } catch (error) {
        console.error('Error saving preset:', error);
        res.status(500).json({ error: 'Failed to save preset' });
    }
});

// Get a specific preset
app.get('/api/presets/:id', async (req, res) => {
    try {
        const data = await fs.readFile(PRESETS_FILE, 'utf8');
        const presets = JSON.parse(data);
        
        const preset = presets[req.params.id];
        if (!preset) {
            return res.status(404).json({ error: 'Preset not found' });
        }
        
        res.json(preset);
    } catch (error) {
        console.error('Error loading preset:', error);
        res.status(500).json({ error: 'Failed to load preset' });
    }
});

// Delete a preset
app.delete('/api/presets/:id', async (req, res) => {
    try {
        const data = await fs.readFile(PRESETS_FILE, 'utf8');
        const presets = JSON.parse(data);
        
        if (!presets[req.params.id]) {
            return res.status(404).json({ error: 'Preset not found' });
        }
        
        // Don't allow deleting default preset
        if (presets[req.params.id].isDefault) {
            return res.status(400).json({ error: 'Cannot delete default preset' });
        }
        
        delete presets[req.params.id];
        await fs.writeFile(PRESETS_FILE, JSON.stringify(presets, null, 2));
        
        res.json({ message: 'Preset deleted successfully' });
    } catch (error) {
        console.error('Error deleting preset:', error);
        res.status(500).json({ error: 'Failed to delete preset' });
    }
});

// Test code execution endpoint (sandboxed)
app.post('/api/test-code', (req, res) => {
    try {
        const { code, testValue = 50 } = req.body;
        
        // Create a very basic sandbox for testing
        const mockParams = {
            value: testValue,
            deckId: 'A',
            sliderId: 'test-slider',
            audioContext: {
                currentTime: 0
            },
            audioNode: {
                frequency: { setValueAtTime: () => {} },
                gain: { setValueAtTime: () => {} }
            }
        };
        
        // Execute code in a controlled environment
        const func = new Function('params', `
            const { value, deckId, sliderId, audioContext, audioNode } = params;
            ${code}
        `);
        
        const result = func(mockParams);
        
        res.json({
            success: true,
            input: testValue,
            output: result,
            message: 'Code executed successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Code execution failed'
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'DJ Controller Backend is running' });
});

// Start server
async function startServer() {
    await initializePresets();
    
    app.listen(PORT, () => {
        console.log(`🎛️  DJ Controller Backend running on port ${PORT}`);
        console.log(`📁 Presets stored in: ${PRESETS_FILE}`);
        console.log(`🌐 API endpoints:`);
        console.log(`   GET  /api/presets - List all presets`);
        console.log(`   POST /api/presets - Save new preset`);
        console.log(`   GET  /api/presets/:id - Get specific preset`);
        console.log(`   POST /api/test-code - Test code execution`);
        console.log(`   GET  /health - Health check`);
    });
}

startServer().catch(console.error);