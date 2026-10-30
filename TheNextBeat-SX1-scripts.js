// Define the controller module namespace
var TheNextBeatSX1 = {
    shift1Active: false,
    shift2Active: false
};


// Track Vinyl / Scratch mode state per deck (default: false)
TheNextBeatSX1.scratchEnabled = {
    1: false,
    2: false
};


// Track physical vs software positions for Soft Takeover
TheNextBeatSX1.eqSoftTakeover = {
    '[Channel1]': { activeTarget: 'parameter3', synced: true },
    '[Channel2]': { activeTarget: 'parameter3', synced: true }
};




// --- Dual-Function EQ Knob Handler (High / Mid) with 4.0 Multiplier & Soft Takeover ---
// State tracker for EQ Soft Takeover
// Dual-Function EQ Knob Handler (High / Mid) with 12 o'clock Center Alignment & Soft Takeover
// Equalizer Soft Takeover State
TheNextBeatSX1.eqSoftTakeover = {
    1: { activeTarget: 'parameter3', synced: true },
    2: { activeTarget: 'parameter3', synced: true }
};

// High / Mid Dual Function Knob Handler
TheNextBeatSX1.eqHighKnob = function (channel, control, value, status, group) {
    var deckNum = (group.indexOf('Channel1') !== -1 || group.indexOf('1') !== -1) ? 1 : 2;
    var targetGroup = (deckNum === 1) ? '[EqualizerRack1_[Channel1]_Effect1]' : '[EqualizerRack1_[Channel2]_Effect1]';

    var physicalValue;
    if (value <= 64) {
        physicalValue = value / 64.0;
    } else {
        physicalValue = 1.0 + (value - 64) * (3.0 / 63.0);
    }

    var currentTarget = TheNextBeatSX1.shift1Active ? 'parameter2' : 'parameter3';
    var deckState = TheNextBeatSX1.eqSoftTakeover[deckNum];

    if (deckState.activeTarget !== currentTarget) {
        deckState.activeTarget = currentTarget;
        deckState.synced = false;
    }

    var softwareValue = engine.getValue(targetGroup, currentTarget);
    var threshold = 0.20;

    if (!deckState.synced) {
        if (Math.abs(physicalValue - softwareValue) <= threshold) {
            deckState.synced = true;
        } else {
            return;
        }
    }

    engine.setValue(targetGroup, currentTarget, physicalValue);
};





// LED update function for Vinyl buttons
TheNextBeatSX1.updateVinylLED = function (deckNum) {
    var midino = (deckNum === 1) ? 0x48 : 0x35;
    var state = TheNextBeatSX1.scratchEnabled[deckNum] ? 0x7F : 0x00;
    
    // Send MIDI Note On (0x90) to light up / dim the Vinyl LED
    midi.sendShortMsg(0x90, midino, state);
};

// Custom Toggle Function for Vinyl Buttons
TheNextBeatSX1.toggleScratchMode = function (channel, control, value, status, group) {
    if (value > 0) { // On button press
        var deckNum = (group === '[Channel1]') ? 1 : 2;
        
        // Toggle boolean state
        TheNextBeatSX1.scratchEnabled[deckNum] = !TheNextBeatSX1.scratchEnabled[deckNum];
        
        // Update LED on controller
        TheNextBeatSX1.updateVinylLED(deckNum);
        
        // If scratch mode was disabled while actively touching, release scratch immediately
        if (!TheNextBeatSX1.scratchEnabled[deckNum] && engine.isScratching(deckNum)) {
            engine.scratchDisable(deckNum);
        }
    }
};



// --- Loop LED Blinking State Tracker ---
TheNextBeatSX1.loopBlinkState = {
    1: { timerId: 0, ledState: false, midiNo: 0x51 },
    2: { timerId: 0, ledState: false, midiNo: 0x0C }
};

// Callback when Loop Enabled state changes (Deck 1 / Deck 2)
TheNextBeatSX1.onLoopEnabledChanged = function (value, group, key) {
    var deckNum = (group === '[Channel1]') ? 1 : 2;
    var state = TheNextBeatSX1.loopBlinkState[deckNum];
    var statusByte = 0x90; // Note On opcode for LEDs

    if (value === 1) {
        // --- LOOP ACTIVE: START BLINKING TIMER ---
        if (state.timerId === 0) {
            state.timerId = engine.beginTimer(300, function () { // 300ms blink rate
                
                // ONLY override LED if NO Shift layer is active!
                if (!TheNextBeatSX1.shift1Active && !TheNextBeatSX1.shift2Active) {
                    state.ledState = !state.ledState;
                    midi.sendShortMsg(statusByte, state.midiNo, state.ledState ? 0x7F : 0x00);
                }
            });
        }
    } else {
        // --- LOOP INACTIVE: STOP TIMER ---
        if (state.timerId !== 0) {
            engine.stopTimer(state.timerId);
            state.timerId = 0;
        }
        state.ledState = false;

        // Reset LED only if not in a Shift layer (allowing Hot Cue 2 LED component to take over)
        if (!TheNextBeatSX1.shift1Active && !TheNextBeatSX1.shift2Active) {
            midi.sendShortMsg(statusByte, state.midiNo, 0x00);
        }
    }
};


// --- Library Track Navigation Encoder Handler ---
// TheNextBeatSX1.libraryScroll = function (channel, control, value, status, group) {
//     // Parse relative 2's complement delta:
//     // 0x01..0x3F => Clockwise (+1, +2...)
//     // 0x7F..0x40 => Counter-Clockwise (-1, -2...)
//     var delta = (value < 64) ? value : value - 128;

//     // Per user request:
//     // Counter-clockwise (delta < 0) -> move focus DOWN
//     // Clockwise (delta > 0) -> move focus UP
//     if (delta < 0) {
//         // Move selection down
//         engine.setValue('[Playlist]', 'SelectNextTrack', 1);
//     } else if (delta > 0) {
//         // Move selection up
//         engine.setValue('[Playlist]', 'SelectPrevTrack', 1);
//     }
// };


// --- Toggle Focus Between Sidebar and Track Table ---
TheNextBeatSX1.libraryFocusToggle = function (channel, control, value, status, group) {
    if (value > 0) {
        // Moves focus between Sidebar (Folders/Crates) and Track Table
        engine.setValue('[Library]', 'MoveFocus', 1);
    }
};


// --- Universal Library / Folder Scroll Handler ---
// TheNextBeatSX1.libraryScroll = function (channel, control, value, status, group) {
//     // Parse relative 2's complement delta:
//     // 0x01..0x3F => Clockwise (+1, +2...)
//     // 0x7F..0x40 => Counter-Clockwise (-1, -2...)
//     var delta = (value < 64) ? value : value - 128;

//     // Per user request:
//     // Counter-clockwise (delta < 0) -> Move focus DOWN (+1 step)
//     // Clockwise (delta > 0) -> Move focus UP (-1 step)
//     var step = (delta < 0) ? 1 : -1;

//     // 'SelectTrackKnob' on [Library] scrolls whichever pane is currently focused:
//     // - If focus is on Sidebar (folders/crates/playlists) -> moves folder selection UP/DOWN
//     // - If focus is on Main Track List -> moves track selection UP/DOWN
//     engine.setValue('[Library]', 'SelectTrackKnob', step);
// };

// --- Universal Library / Folder Scroll Handler ---
TheNextBeatSX1.libraryScroll = function (channel, control, value, status, group) {
    var delta = (value < 64) ? value : value - 128;

    var step = (delta < 0) ? -1 : 1;

    // [Library] MoveVertical navigates up/down in the active library view
    engine.setValue('[Library]', 'MoveVertical', step);
};


// // --- Library Focus Toggle Handler (Button Press) ---
// TheNextBeatSX1.libraryFocusToggle = function (channel, control, value, status, group) {
//     if (value > 0) { // On button press
//         // Toggles focus back and forth between Sidebar Folders and Track List
//         engine.setValue('[Library]', 'GoToItem', 1);
//     }
// };



// // --- HeadMix Cue/Master Toggle Switch Handler ---
// TheNextBeatSX1.headMixButton = function (channel, control, value, status, group) {
//     if (value > 0) { // On button press only
//         var currentMix = engine.getValue('[Master]', 'headMix');
        
//         // Toggle logic: If currently set to Master (> 0), switch to Cue (-1.0).
//         // Otherwise, switch back to Master (1.0).
//         var newMix = (currentMix > 0.0) ? -1.0 : 1.0;
//         engine.setValue('[Master]', 'headMix', newMix);
//     }
// };

// Track folder expanded/collapsed state
TheNextBeatSX1.folderExpandedState = false;

// --- HeadMix Cue/Master Toggle Switch & Expand/Collapse Handler ---
TheNextBeatSX1.headMixButton = function (channel, control, value, status, group) {
    if (value > 0) { // On button press only
        
        if (TheNextBeatSX1.shift1Active) {
            // --- SHIFT 1 (GREEN) ACTIVE: EXPAND / COLLAPSE SIDEBAR FOLDER ---
            // Toggle between 1 (Expand right) and -1 (Collapse left)
            TheNextBeatSX1.folderExpandedState = !TheNextBeatSX1.folderExpandedState;
            var expandDirection = TheNextBeatSX1.folderExpandedState ? 1 : -1;

            // 'MoveHorizontal' expands/collapses folder trees WITHOUT loading tracks!
            engine.setValue('[Library]', 'MoveHorizontal', expandDirection);

        } else {
            // --- DEFAULT MODE: HEADMIX CUE / MASTER TOGGLE ---
            var currentMix = engine.getValue('[Master]', 'headMix');
            var newMix = (currentMix > 0.0) ? -1.0 : 1.0;
            engine.setValue('[Master]', 'headMix', newMix);
        }
    }
};

// --- HeadMix LED Connection Callback ---
TheNextBeatSX1.headMixLEDCallback = function (value, group, key) {
    // Light LED when set towards Cue (value <= 0.0)
    var isCueMode = (value >= 0.0);
    var ledState = isCueMode ? 0x7F : 0x00;
    
    midi.sendShortMsg(0x90, 0x0D, ledState);
};



// ENABLE PFL when a track is loaded
// callback function
// --- Auto-Enable PFL on Track Load ---
// --- Auto-Enable PFL on Active Deck & Disable on Other Deck ---
TheNextBeatSX1.onTrackLoaded = function (value, group, key) {
    // value === 1 indicates a track was successfully loaded into the deck
    if (value === 1) {
        // Determine current deck and opposite deck
        var currentDeck = group; // e.g., '[Channel1]' or '[Channel2]'
        var otherDeck = (group === '[Channel1]') ? '[Channel2]' : '[Channel1]';

        // Enable PFL for the loaded deck
        engine.setValue(currentDeck, 'pfl', 1);

        // Automatically turn off PFL on the other deck
        engine.setValue(otherDeck, 'pfl', 0);
    }
};





// 1. Layer Definitions matching table.csv
TheNextBeatSX1.layers = {
    // --- DECK 1 ---
    deck1: {
        autoLoop: {
            default: { group: '[Channel1]', inKey: 'beatloop_activate', outKey: 'loop_enabled' },
            shift1:  { group: '[Channel1]', inKey: 'hotcue_2_activate', outKey: 'hotcue_2_enabled' },
            blue:    { group: '[Channel1]', inKey: 'hotcue_2_clear', outKey: 'hotcue_2_enabled' }
        },
        cue: {
            default: { group: '[Channel1]', inKey: 'cue_default', outKey: 'cue_indicator' },
            shift1:  { group: '[Channel1]', inKey: 'cue_gotoandstop', outKey: 'cue_indicator' }
        },
        // --- DECK 1 FX ON/OFF ---
    fxOnOff: {
        default: { 
            group: '[EffectRack1_EffectUnit1_Effect1]', 
            inKey: 'enabled', 
            outKey: 'enabled', 
            type: 1 // Toggle mode
    }
},
        jogTouch: {
            default: { group: '[Channel1]', inKey: 'wheel' }
        },
        load: {
            default: { group: '[Channel1]', inKey: 'LoadSelectedTrack', outKey: 'track_loaded' },
            shift1:  { group: '[Channel1]', inKey: 'eject', outKey: 'track_loaded' }
        },
        loopDouble: {
            default: { group: '[Channel1]', inKey: 'loop_double', outKey: 'loop_enabled' },
            shift1:  { group: '[Channel1]', inKey: 'hotcue_1_activate', outKey: 'hotcue_1_enabled' },
            blue:    { group: '[Channel1]', inKey: 'hotcue_1_clear', outKey: 'hotcue_1_enabled' }
        },
        loopHalve: {
            default: { group: '[Channel1]', inKey: 'loop_halve', outKey: 'loop_enabled' },
            shift1:  { group: '[Channel1]', inKey: 'hotcue_3_activate', outKey: 'hotcue_3_enabled' },
            blue:    { group: '[Channel1]', inKey: 'hotcue_3_clear', outKey: 'hotcue_3_enabled' }
        },
        pfl: {
            default: { group: '[Channel1]', inKey: 'pfl', outKey: 'pfl', type: 1 },
            shift1:  { group: '[Sampler2]', inKey: 'cue_gotoandplay', outKey: 'track_loaded' },
            blue:    { group: '[Sampler4]', inKey: 'cue_gotoandplay', outKey: 'track_loaded' }
        },
        // fxOnOff: {

        //     default: { group: '[EffectRack1_EffectUnit1]', inKey: 'group_[Channel1]_enable' }

        // }, 


// --- DECK 1 PLAY ---
play: {
    default: { group: '[Channel1]', inKey: 'play', outKey: 'play_indicator', type: 1 }, // 1 = toggle (Play/Pause)
    shift1:  { group: '[Channel1]', inKey: 'start_play', outKey: 'play_indicator', type: 0 }
},
        sync: {
            default: { group: '[Channel1]', inKey: 'sync_enabled', outKey: 'sync_enabled' }
        },
        tempoMinus: {
            default: { group: '[Channel1]', inKey: 'rate_perm_down_small' },
            shift1:  { group: '[Channel1]', inKey: 'rate_perm_down' }
        },
        tempoPlus: {
            default: { group: '[Channel1]', inKey: 'rate_perm_up_small' },
            shift1:  { group: '[Channel1]', inKey: 'rate_perm_up' }
        },
// --- DECK 1 VINYL ---
vinyl: {
    default: { group: '[Channel1]', input: TheNextBeatSX1.toggleScratchMode },
    shift1:  { group: '[Sampler1]', inKey: 'cue_gotoandplay', outKey: 'track_loaded' },
    blue:    { group: '[Sampler3]', inKey: 'cue_gotoandplay', outKey: 'track_loaded' }
}
    },

    // --- DECK 2 ---
    deck2: {
        autoLoop: {
            default: { group: '[Channel2]', inKey: 'beatloop_activate', outKey: 'loop_enabled' },
            shift1:  { group: '[Channel2]', inKey: 'hotcue_2_activate', outKey: 'hotcue_2_enabled' },
            blue:    { group: '[Channel2]', inKey: 'hotcue_2_clear', outKey: 'hotcue_2_enabled' }
        },
        cue: {
            default: { group: '[Channel2]', inKey: 'cue_default', outKey: 'cue_indicator' },
            shift1:  { group: '[Channel2]', inKey: 'cue_gotoandstop', outKey: 'cue_indicator' }
        },
        // fxOnOff: {
        //     default: { group: '[EffectRack1_EffectUnit2]', inKey: 'group_[Channel2]_enable' }
        // },
        // --- DECK 2 FX ON/OFF ---
        fxOnOff: {
            default: { 
                group: '[EffectRack1_EffectUnit2_Effect1]', 
                inKey: 'enabled', 
                outKey: 'enabled', 
                type: 1 // Toggle mode
            }
        },
        jogTouch: {
            default: { group: '[Channel2]', inKey: 'wheel' }
        },
        load: {
            default: { group: '[Channel2]', inKey: 'LoadSelectedTrack', outKey: 'track_loaded' },
            shift1:  { group: '[Channel2]', inKey: 'eject', outKey: 'track_loaded' }
        },
        loopDouble: {
            default: { group: '[Channel2]', inKey: 'loop_double', outKey: 'loop_enabled' },
            shift1:  { group: '[Channel2]', inKey: 'hotcue_1_activate', outKey: 'hotcue_1_enabled' },
            blue:    { group: '[Channel2]', inKey: 'hotcue_1_clear', outKey: 'hotcue_1_enabled' }
        },
        loopHalve: {
            default: { group: '[Channel2]', inKey: 'loop_halve', outKey: 'loop_enabled' },
            shift1:  { group: '[Channel2]', inKey: 'hotcue_3_activate', outKey: 'hotcue_3_enabled' },
            blue:    { group: '[Channel2]', inKey: 'hotcue_3_clear', outKey: 'hotcue_3_enabled' }
        },
        pfl: {
            default: { group: '[Channel2]', inKey: 'pfl', outKey: 'pfl', type: 1 },
            shift1:  { group: '[Sampler2]', inKey: 'cue_gotoandplay', outKey: 'track_loaded' },
            blue:    { group: '[Sampler4]', inKey: 'cue_gotoandplay', outKey: 'track_loaded' }
        },
        // --- DECK 2 PLAY ---
play: {
    default: { group: '[Channel2]', inKey: 'play', outKey: 'play_indicator', type: 1 }, // 1 = toggle (Play/Pause)
    shift1:  { group: '[Channel2]', inKey: 'start_play', outKey: 'play_indicator', type: 0 }
},
        sync: {
            default: { group: '[Channel2]', inKey: 'sync_enabled', outKey: 'sync_enabled' }
        },
        tempoMinus: {
            default: { group: '[Channel2]', inKey: 'rate_perm_down_small' },
            shift1:  { group: '[Channel2]', inKey: 'rate_perm_down' }
        },
        tempoPlus: {
            default: { group: '[Channel2]', inKey: 'rate_perm_up_small' },
            shift1:  { group: '[Channel2]', inKey: 'rate_perm_up' }
        },
// --- DECK 2 VINYL ---
vinyl: {
    default: { group: '[Channel2]', input: TheNextBeatSX1.toggleScratchMode },
    shift1:  { group: '[Sampler1]', inKey: 'cue_gotoandplay', outKey: 'track_loaded' },
    blue:    { group: '[Sampler3]', inKey: 'cue_gotoandplay', outKey: 'track_loaded' }
}
    },

    // --- MASTER ---
    // master: {
    //     toggleFocus: {
    //         default: { group: '[Library]', inKey: 'MoveFocusForward' }
    //     }
    // }
};


// JOGWHEELS AND SCTRATCHIG


// Add scratch configuration constants to namespace
TheNextBeatSX1.scratchSettings = {
    intervalsPerRev: 128, // Ticks per revolution (typical for controller wheels)
    rpm: 33 + 1/3,        // 33.33 RPM
    alpha: 1.0 / 8.0,      // Filter coefficient for smooth pitch interpolation
    beta: (1.0 / 8.0) / 32 // Filter coefficient
};

// --- Jog Wheel Turn Handler (Deck 1 & Deck 2) ---
// --- Jog Wheel Turn Handler (Deck 1 & Deck 2) ---
TheNextBeatSX1.jogWheelTurn = function (channel, control, value, status, group) {
    var deckNum = (group === '[Channel1]') ? 1 : 2;
    
    // Parse Relative 2's Complement delta value:
    // 0x01 to 0x3F => Clockwise (+1, +2...)
    // 0x7F to 0x40 => Counter-Clockwise (-1, -2...)
    var delta = (value < 64) ? value : value - 128;

    // --- SHIFT 1 ACTIVE: SEARCH MODE SHIFT1 + JOGTURN ---
    if (TheNextBeatSX1.shift1Active) {
        // Option A: Beatjump seek (jumps by beat/fraction per tick)
        // engine.setValue(group, (delta > 0) ? 'beatjump_1_forward' : 'beatjump_1_backward', 1);

        // Option B: Smooth high-speed track seek (percentage of song length)
        var currentPos = engine.getValue(group, 'playposition');
        var seekStep = delta * 0.005; // Adjust 0.005 to speed up or slow down search speed
        var newPos = Math.max(0.0, Math.min(1.0, currentPos + seekStep));
        engine.setValue(group, 'playposition', newPos);

        return;
    }

    // --- STANDARD MODE: SCRATCH / PITCH BEND ---
    //Customizing Speed: You can adjust seekStep = delta * 0.005 (e.g., change to 0.01 for faster scrubbing or 0.002 for fine scrubbing).
    if (engine.isScratching(deckNum)) {
        // Scratching mode (Platter touched)
        engine.scratchTick(deckNum, delta);
    } else {
        // Pitch-bend mode (Rim turn / untouched platter)
        engine.setValue(group, 'jog', delta * 0.4); // <--- CHANGE THIS MULTIPLIER
    }
                    // How to adjust it:
                    // Change 0.1 to a larger number to increase pitch bend intensity:
                    // Default (0.1): Subtle/fine pitch bend.
                    // Medium (0.3 to 0.5): Moderate pitch bend (more responsive).
                    // Strong (0.8 to 1.0): Aggressive pitch bend (nudges track speed significantly per tick).

};

// --- Jog Touch Handlers ---
TheNextBeatSX1.jogTouch1 = function (channel, control, value, status, group) {
    // Only enable scratching if Vinyl Mode is active for Deck 1
    if (value > 0 && TheNextBeatSX1.scratchEnabled[1]) {
        engine.scratchEnable(
            1,
            TheNextBeatSX1.scratchSettings.intervalsPerRev,
            TheNextBeatSX1.scratchSettings.rpm,
            TheNextBeatSX1.scratchSettings.alpha,
            TheNextBeatSX1.scratchSettings.beta
        );
    } else {
        engine.scratchDisable(1);
    }
};

TheNextBeatSX1.jogTouch2 = function (channel, control, value, status, group) {
    // Only enable scratching if Vinyl Mode is active for Deck 2
    if (value > 0 && TheNextBeatSX1.scratchEnabled[2]) {
        engine.scratchEnable(
            2,
            TheNextBeatSX1.scratchSettings.intervalsPerRev,
            TheNextBeatSX1.scratchSettings.rpm,
            TheNextBeatSX1.scratchSettings.alpha,
            TheNextBeatSX1.scratchSettings.beta
        );
    } else {
        engine.scratchDisable(2);
    }
};

// 2. Custom LayerButton with safe state-resetting on layer change
// 2. Custom LayerButton supporting Toggles (Play/Pause)
TheNextBeatSX1.LayerButton = class extends components.Button {
    constructor(options) {
        super(options);
        this.layers = options.layers || {};
        this.currentLayer = null;
        this.setLayer('default');
    }

    setLayer(layerName) {
        if (this.currentLayer === layerName) return;

        var layerConfig = this.layers[layerName] || this.layers.default;
        if (!layerConfig) return;

        // Force-release active press-and-hold keys BEFORE switching targets
        var persistentKeys = ['play', 'pfl', 'slip_enabled', 'sync_enabled'];
        if (this.inKey && this.group && persistentKeys.indexOf(this.inKey) === -1) {
            engine.setValue(this.group, this.inKey, 0);
        }

        // Disconnect standard engine connections
        if (typeof this.disconnect === 'function') {
            this.disconnect();
        }

        // Update component targets and properties
        this.group = layerConfig.group;
        this.inKey = layerConfig.inKey || null;
        this.outKey = layerConfig.outKey || null;
        this.type = (layerConfig.type !== undefined) ? layerConfig.type : 0;
        
        // Support custom JS input callbacks
        if (layerConfig.input) {
            this.input = layerConfig.input;
        } else {
            delete this.input; // Revert to standard Button.prototype.input
        }

        this.currentLayer = layerName;
        this.isPressed = false;

        // Reconnect standard Mixxx output binding if outKey is set
        if (this.outKey && typeof this.connect === 'function') {
            this.connect();
            if (typeof this.trigger === 'function') {
                this.trigger();
            }
        }

        // If switching back to default Vinyl layer, refresh LED manually
        if (layerName === 'default' && (this.midi[1] === 0x48 || this.midi[1] === 0x35)) {
            var deckNum = (this.group === '[Channel1]') ? 1 : 2;
            TheNextBeatSX1.updateVinylLED(deckNum);
        }
    }
};

// 3. Centralized Shift Layer Manager
TheNextBeatSX1.updateLayers = function () {
    var activeLayer = 'default';
    if (TheNextBeatSX1.shift2Active) {
        activeLayer = 'blue';
    } else if (TheNextBeatSX1.shift1Active) {
        activeLayer = 'shift1';
    }

    TheNextBeatSX1.container.forEachComponent(function (component) {
        if (component instanceof TheNextBeatSX1.LayerButton) {
            component.setLayer(activeLayer);
        }
    });
};

// 4. Controller Init & Container Setup
TheNextBeatSX1.init = function () {
    TheNextBeatSX1.container = new components.ComponentContainer();

    // --- DECK 1 BUTTONS ---
    TheNextBeatSX1.container.d1AutoLoop = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x51],
        layers: TheNextBeatSX1.layers.deck1.autoLoop
    });
    TheNextBeatSX1.container.d1Cue = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x3B],
        layers: TheNextBeatSX1.layers.deck1.cue
    });
    TheNextBeatSX1.container.d1FxOnOff = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x43],
        layers: TheNextBeatSX1.layers.deck1.fxOnOff
    });
    // Replace d1JogTouch and d2JogTouch in init():
    TheNextBeatSX1.container.d1JogTouch = new components.Button({
        midi: [0x90, 0x4D],
        group: '[Channel1]',
        input: TheNextBeatSX1.jogTouch1
    });
    TheNextBeatSX1.container.d1Load = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x4B],
        layers: TheNextBeatSX1.layers.deck1.load
    });
    TheNextBeatSX1.container.d1LoopDouble = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x50],
        layers: TheNextBeatSX1.layers.deck1.loopDouble
    });
    TheNextBeatSX1.container.d1LoopHalve = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x64],
        layers: TheNextBeatSX1.layers.deck1.loopHalve
    });
    TheNextBeatSX1.container.d1Pfl = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x40],
        layers: TheNextBeatSX1.layers.deck1.pfl
    });
    TheNextBeatSX1.container.d1Play = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x4A],
        layers: TheNextBeatSX1.layers.deck1.play
    });
    TheNextBeatSX1.container.d1Sync = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x44],
        layers: TheNextBeatSX1.layers.deck1.sync
    });
    TheNextBeatSX1.container.d1TempoMinus = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x54],
        layers: TheNextBeatSX1.layers.deck1.tempoMinus
    });
    TheNextBeatSX1.container.d1TempoPlus = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x53],
        layers: TheNextBeatSX1.layers.deck1.tempoPlus
    });
    TheNextBeatSX1.container.d1Vinyl = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x48],
        layers: TheNextBeatSX1.layers.deck1.vinyl
    });

    // --- DECK 2 BUTTONS ---
    TheNextBeatSX1.container.d2AutoLoop = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x0C],
        layers: TheNextBeatSX1.layers.deck2.autoLoop
    });
    TheNextBeatSX1.container.d2Cue = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x42],
        layers: TheNextBeatSX1.layers.deck2.cue
    });
    TheNextBeatSX1.container.d2FxOnOff = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x45],
        layers: TheNextBeatSX1.layers.deck2.fxOnOff
    });
TheNextBeatSX1.container.d2JogTouch = new components.Button({
    midi: [0x90, 0x4E],
    group: '[Channel2]',
    input: TheNextBeatSX1.jogTouch2
});
    TheNextBeatSX1.container.d2Load = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x34],
        layers: TheNextBeatSX1.layers.deck2.load
    });
    TheNextBeatSX1.container.d2LoopDouble = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x0E],
        layers: TheNextBeatSX1.layers.deck2.loopDouble
    });
    TheNextBeatSX1.container.d2LoopHalve = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x65],
        layers: TheNextBeatSX1.layers.deck2.loopHalve
    });
    TheNextBeatSX1.container.d2Pfl = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x47],
        layers: TheNextBeatSX1.layers.deck2.pfl
    });
    TheNextBeatSX1.container.d2Play = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x4C],
        layers: TheNextBeatSX1.layers.deck2.play
    });
    TheNextBeatSX1.container.d2Sync = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x46],
        layers: TheNextBeatSX1.layers.deck2.sync
    });
    TheNextBeatSX1.container.d2TempoMinus = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x56],
        layers: TheNextBeatSX1.layers.deck2.tempoMinus
    });
    TheNextBeatSX1.container.d2TempoPlus = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x55],
        layers: TheNextBeatSX1.layers.deck2.tempoPlus
    });
    TheNextBeatSX1.container.d2Vinyl = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x35],
        layers: TheNextBeatSX1.layers.deck2.vinyl
    });

    // --- MASTER & SHIFT BUTTONS ---
    // TheNextBeatSX1.container.toggleFocus = new TheNextBeatSX1.LayerButton({
    //     midi: [0x90, 0x4F],
    //     layers: TheNextBeatSX1.layers.master.toggleFocus
    // });

    // Master Shift 1 (Green) Button (0x33)
    TheNextBeatSX1.container.shift1 = new components.Button({
        midi: [0x90, 0x33],
        input: function (channel, control, value, status) {
            var isPressed = (status === 0x90 && value > 0);
            TheNextBeatSX1.shift1Active = isPressed;
            TheNextBeatSX1.updateLayers();

            // Refresh Loop/Hot Cue LED state on Shift 1 change
            TheNextBeatSX1.onLoopEnabledChanged(engine.getValue('[Channel1]', 'loop_enabled'), '[Channel1]', 'loop_enabled');
            TheNextBeatSX1.onLoopEnabledChanged(engine.getValue('[Channel2]', 'loop_enabled'), '[Channel2]', 'loop_enabled');
        }
    });

    // Master Shift 2 (Blue) Button (0x3C)
    TheNextBeatSX1.container.shift2 = new components.Button({
        midi: [0x90, 0x3C],
        input: function (channel, control, value, status) {
            var isPressed = (status === 0x90 && value > 0);
            TheNextBeatSX1.shift2Active = isPressed;
            TheNextBeatSX1.updateLayers();

            // Refresh Loop/Hot Cue LED state on Shift 2 change
            TheNextBeatSX1.onLoopEnabledChanged(engine.getValue('[Channel1]', 'loop_enabled'), '[Channel1]', 'loop_enabled');
            TheNextBeatSX1.onLoopEnabledChanged(engine.getValue('[Channel2]', 'loop_enabled'), '[Channel2]', 'loop_enabled');
        }
    });


    // Turn ON Vinyl LEDs by default upon initialization
    TheNextBeatSX1.updateVinylLED(1);
    TheNextBeatSX1.updateVinylLED(2);

    // Inside TheNextBeatSX1.init():
    engine.makeConnection('[Master]', 'headMix', TheNextBeatSX1.headMixLEDCallback);

    // Refresh LED state on load
    TheNextBeatSX1.headMixLEDCallback(engine.getValue('[Master]', 'headMix'), '[Master]', 'headMix');

    // Connect the Engine Listeners in init() 
    // register the connection callbacks for both [Channel1] and [Channel2]:
    // Automatically enable PFL when a track loads into Deck 1 or Deck 2
    engine.makeConnection('[Channel1]', 'track_loaded', TheNextBeatSX1.onTrackLoaded);
    engine.makeConnection('[Channel2]', 'track_loaded', TheNextBeatSX1.onTrackLoaded);

 

    // Connect loop_enabled listeners for Deck 1 and Deck 2
    engine.makeConnection('[Channel1]', 'loop_enabled', TheNextBeatSX1.onLoopEnabledChanged);
    engine.makeConnection('[Channel2]', 'loop_enabled', TheNextBeatSX1.onLoopEnabledChanged);
    
    // Trigger initial check in case a track is already looping on startup
    TheNextBeatSX1.onLoopEnabledChanged(engine.getValue('[Channel1]', 'loop_enabled'), '[Channel1]', 'loop_enabled');
    TheNextBeatSX1.onLoopEnabledChanged(engine.getValue('[Channel2]', 'loop_enabled'), '[Channel2]', 'loop_enabled');

    // 1. Set initial software volume to 12 o'clock (0.5 = 50%)
    engine.setValue('[Channel1]', 'volume', 0.5);
    engine.setValue('[Channel2]', 'volume', 0.5);

    // 2. Enable soft takeover so sudden jumps are avoided if knobs differ
    engine.softTakeover('[Channel1]', 'volume', true);
    engine.softTakeover('[Channel2]', 'volume', true);

};

TheNextBeatSX1.shutdown = function () {
    if (TheNextBeatSX1.container) {
        TheNextBeatSX1.container.shutdown();
    };



    engine.makeConnection('[Channel1]', 'track_loaded', TheNextBeatSX1.onTrackLoaded, true); // true = disconnect
    engine.makeConnection('[Channel2]', 'track_loaded', TheNextBeatSX1.onTrackLoaded, true);

    // Stop active timers and disconnect listeners
    if (TheNextBeatSX1.loopBlinkState[1].timerId !== 0) engine.stopTimer(TheNextBeatSX1.loopBlinkState[1].timerId);
    if (TheNextBeatSX1.loopBlinkState[2].timerId !== 0) engine.stopTimer(TheNextBeatSX1.loopBlinkState[2].timerId);

    engine.makeConnection('[Channel1]', 'loop_enabled', TheNextBeatSX1.onLoopEnabledChanged, true);
    engine.makeConnection('[Channel2]', 'loop_enabled', TheNextBeatSX1.onLoopEnabledChanged, true);

};