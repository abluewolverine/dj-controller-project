# 🎛️ OMNI DJ CONTROLLER

## True Omni Functionality - Custom Code Integration

The OMNI DJ Controller features a revolutionary custom code system that allows users to completely customize slider functionality through JavaScript code injection.

### 🚀 Features

#### 1. **Custom Code Editor Panel**
- **Access**: Click the ⚙️ CODE button in the top-right corner
- **Live Coding**: Write JavaScript functions that control audio processing
- **Real-time Testing**: Test your code before applying it
- **Multiple Functions**: Separate code for volume, EQ, and effects

#### 2. **Available Variables in Custom Functions**
```javascript
// Your custom function receives these parameters:
{
  value,        // Slider value (0-100)
  deckId,       // 'A' or 'B' 
  sliderId,     // Unique identifier for the slider
  audioContext, // Web Audio API context
  audioNode     // The actual audio node being controlled
}
```

#### 3. **Example Custom Functions**

**Volume Control with Logarithmic Scaling:**
```javascript
// Convert linear slider to logarithmic volume
const logValue = Math.pow(value / 100, 2);
return logValue;
```

**Advanced EQ with Frequency Response:**
```javascript
// Dynamic EQ with variable Q factor
const frequency = sliderId.includes('high') ? 8000 : 
                 sliderId.includes('mid') ? 1000 : 200;
const qFactor = (value / 100) * 30; // Variable Q based on slider

audioNode.frequency.setValueAtTime(frequency, audioContext.currentTime);
audioNode.Q.setValueAtTime(qFactor, audioContext.currentTime);
audioNode.gain.setValueAtTime((value - 50) * 0.5, audioContext.currentTime);
```

**Custom Effects Processing:**
```javascript
// Multi-mode effect based on slider position
if (value < 33) {
  // Low range: Subtle reverb
  return value * 0.01;
} else if (value < 66) {
  // Mid range: Chorus effect
  return (value - 33) * 0.02;
} else {
  // High range: Distortion
  return (value - 66) * 0.03;
}
```

### 🎯 Backend Preset System

#### Running the Backend Server
```bash
cd apps/dj-controller
npm install
npm start
```

#### API Endpoints
- `GET /api/presets` - List all saved presets
- `POST /api/presets` - Save new preset
- `GET /api/presets/:id` - Get specific preset
- `POST /api/test-code` - Test code execution
- `DELETE /api/presets/:id` - Delete preset

#### Preset Storage Features
- **Persistent Storage**: Presets saved to JSON file on server
- **Default Protection**: Cannot delete default behavior preset
- **Timestamped**: All presets include creation timestamp
- **Fallback**: Works with localStorage if backend unavailable

### 🔧 Usage Instructions

1. **Access Code Editor**: Click ⚙️ CODE button
2. **Write Custom Function**: Use the provided template or write from scratch
3. **Test Code**: Click 🧪 Test Code to validate functionality
4. **Apply Code**: Click ✅ Apply Code to activate custom behavior
5. **Save Preset**: Click Save Preset to store your custom configuration
6. **Load Preset**: Click Load Presets to restore saved configurations

### 🛡️ Security Features

- **Sandboxed Execution**: Custom code runs in controlled environment
- **Error Handling**: Graceful fallback to default behavior on errors
- **Input Validation**: Server validates all preset data
- **Limited Scope**: Functions only access provided audio parameters

### 💡 Creative Possibilities

- **Dynamic EQ Curves**: Create frequency responses that change with music
- **Multi-band Compression**: Implement custom dynamics processing
- **Harmonic Enhancement**: Add custom harmonic distortion algorithms
- **Rhythm-Reactive Effects**: Make effects respond to beat detection
- **Cross-deck Modulation**: Use one deck's parameters to control another
- **MIDI Integration**: Map sliders to external MIDI parameters

### 🎵 Making it Truly "OMNI"

The custom code system transforms the DJ controller from a fixed-function device into a completely programmable audio workstation. Users can:

- Create instrument-specific EQ curves for different genres
- Implement custom audio effects not available in traditional DJ software
- Build unique performance workflows tailored to their style
- Save and share custom configurations with other DJs
- Rapidly prototype new audio processing ideas

This makes the controller truly "OMNI" - capable of adapting to any musical style, performance need, or creative vision through the power of custom code.

### 🔄 Theme Support

The custom code editor fully supports both light and dark themes, maintaining the galactic aesthetic while providing a professional coding environment.

---

**Ready to make your DJ controller truly omnipotent? Start coding!** 🚀