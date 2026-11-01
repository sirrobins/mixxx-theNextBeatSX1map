// Define the controller module namespace
var TheNextBeatSX1 = {
    shift1Active: false,
    shift2Active: false,
    folderExpandedState: false
};



// reverse-engineered init tweak
// --- DJ Exact Hardware Initialization Sequence ---
TheNextBeatSX1.INIT_PACKETS = [
    [0x9F, 0x3F, 0x7F] // Master Handshake
 
];

TheNextBeatSX1.sendInitSequence = function () {
    var packets = TheNextBeatSX1.INIT_PACKETS;
    var index = 0;

    // Send 1 packets with a 10ms interval to prevent buffer overflow
    var initTimer = engine.beginTimer(10, function () {
        if (index < packets.length) {
            var packet = packets[index];
            midi.sendShortMsg(packet[0], packet[1], packet[2]);
            index++;
        } else {
            engine.stopTimer(initTimer);
        }
    });
};



TheNextBeatSX1.LED_COLOR = {
    OFF: 0x00,
    WHITE: 0x7F,
    GREEN: 0x3F // Updated to 0x3F secondary color byte
};

// Track Vinyl / Scratch mode state per deck (default: false)
TheNextBeatSX1.scratchEnabled = {
    1: false,
    2: false
};

// Equalizer Soft Takeover State (1 = Deck 1, 2 = Deck 2)
TheNextBeatSX1.eqSoftTakeover = {
    1: { activeTarget: 'parameter3', synced: true },
    2: { activeTarget: 'parameter3', synced: true }
};

// --- Auto-Repeat Handler for Default Tempo Buttons ---
// When tempo +/- is long-pressed action is repeated in an accelerate manner.
TheNextBeatSX1.tempoRepeatState = {};

TheNextBeatSX1.handleTempoPress = function (channel, control, value, status, group) {
    var key = channel + "_" + control;
    var isPress = (status === 0x90 && value > 0);

    // Identify action based on group and active layer key
    var isPlus = this.inKey.indexOf('up') !== -1;
    var targetKey = isPlus ? 'rate_perm_up_small' : 'rate_perm_down_small';

    if (isPress) {
        // Trigger immediately on first press
        engine.setValue(group, targetKey, 1);

        // Clear any lingering timer for this button
        if (TheNextBeatSX1.tempoRepeatState[key]) {
            engine.stopTimer(TheNextBeatSX1.tempoRepeatState[key]);
        }

        // Delay 300ms before starting repeat loop, then repeat every 100ms
        TheNextBeatSX1.tempoRepeatState[key] = engine.beginTimer(300, function () {
            engine.setValue(group, targetKey, 1);
            
            // Speed up to continuous repeat rate after initial hold delay
            engine.stopTimer(TheNextBeatSX1.tempoRepeatState[key]);
            TheNextBeatSX1.tempoRepeatState[key] = engine.beginTimer(100, function () {
                engine.setValue(group, targetKey, 1);
            });
        });
    } else {
        // Stop timer on release
        if (TheNextBeatSX1.tempoRepeatState[key]) {
            engine.stopTimer(TheNextBeatSX1.tempoRepeatState[key]);
            delete TheNextBeatSX1.tempoRepeatState[key];
        }
    }
};

// High / Mid Dual Function Knob Handler
// SX1 has no physicak knob for mid eq control. shift1(green) + high eq is connected to MidEQ on Mixxx.
TheNextBeatSX1.eqHighKnob = function (channel, control, value, status, group) {
    var deckNum = (control === 0x11 || group.indexOf('Channel2') !== -1 || group.indexOf('2') !== -1) ? 2 : 1;
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
    midi.sendShortMsg(0x90, midino, state);
};

// Custom Toggle Function for Vinyl Buttons
TheNextBeatSX1.toggleScratchMode = function (channel, control, value, status, group) {
    if (value > 0) {
        var deckNum = (group === '[Channel1]') ? 1 : 2;
        TheNextBeatSX1.scratchEnabled[deckNum] = !TheNextBeatSX1.scratchEnabled[deckNum];
        TheNextBeatSX1.updateVinylLED(deckNum);
        
        if (!TheNextBeatSX1.scratchEnabled[deckNum] && engine.isScratching(deckNum)) {
            engine.scratchDisable(deckNum);
        }
    }
};

// --- BPM Equalizer LED Checker for Sync Buttons ---
// This function makes sync button led to on when bpms in deck1/deck2 are close to equal value. Some difference is allowed.
TheNextBeatSX1.updateSyncLEDs = function () {
    var bpm1 = engine.getValue('[Channel1]', 'bpm');
    var bpm2 = engine.getValue('[Channel2]', 'bpm');

    if (bpm1 > 0 && bpm2 > 0) {
        var diffRatio = Math.abs(bpm1 - bpm2) / Math.max(bpm1, bpm2);
        
        if (diffRatio <= 0.01) {
            midi.sendShortMsg(0x90, 0x44, 0x7F);
            midi.sendShortMsg(0x90, 0x46, 0x7F);
            return;
        }
    }

    midi.sendShortMsg(0x90, 0x44, 0x00);
    midi.sendShortMsg(0x90, 0x46, 0x00);
};

// --- Loop LED Blinking State Tracker ---
// This provides auto-loop button led blinking when on active loop.
// --- Loop LED Blinking State Tracker ---
TheNextBeatSX1.loopBlinkState = {
    1: { timerId: 0, ledState: false, midiNo: 0x51 },
    2: { timerId: 0, ledState: false, midiNo: 0x0C }
};

TheNextBeatSX1.onLoopEnabledChanged = function (value, group, key) {
    var deckNum = (group === '[Channel1]') ? 1 : 2;
    var state = TheNextBeatSX1.loopBlinkState[deckNum];
    var statusByte = 0x90;

    if (value === 1) {
        // --- LOOP ENABLED ---
        if (state.timerId === 0) {
            state.timerId = engine.beginTimer(300, function () {
                if (!TheNextBeatSX1.shift1Active && !TheNextBeatSX1.shift2Active) {
                    state.ledState = !state.ledState;
                    midi.sendShortMsg(statusByte, state.midiNo, state.ledState ? 0x7F : 0x00);
                }
            });
        }
    } else {
        // Track whether it was previously looping before turning off
        var wasLooping = (state.timerId !== 0);

        // --- LOOP EXITED / DISABLED ---
        if (state.timerId !== 0) {
            engine.stopTimer(state.timerId);
            state.timerId = 0;
        }
        state.ledState = false;

        if (!TheNextBeatSX1.shift1Active && !TheNextBeatSX1.shift2Active) {
            midi.sendShortMsg(statusByte, state.midiNo, 0x00);
        }

        // ONLY auto-deactivate slip mode if a loop was actually active and just got turned off
        if (wasLooping && engine.getValue(group, 'slip_enabled') === 1) {
            engine.setValue(group, 'slip_enabled', 0);
        }
    }
};

// --- Library Controls ---
TheNextBeatSX1.libraryFocusToggle = function (channel, control, value, status, group) {
    if (value > 0) {
        engine.setValue('[Library]', 'MoveFocus', 1);
    }
};

TheNextBeatSX1.libraryScroll = function (channel, control, value, status, group) {
    var delta = (value < 64) ? value : value - 128;
    var step = (delta < 0) ? -1 : 1;
    engine.setValue('[Library]', 'MoveVertical', step);
};

// --- HeadMix Cue/Master Toggle Switch & Expand/Collapse Handler ---
// SX1 has a Master HeadMix button, but in Mixxx software we have a Pot control. 
// Button has ben set to switch  0% / 100% values.
TheNextBeatSX1.headMixButton = function (channel, control, value, status, group) {
    if (value > 0) {
        if (TheNextBeatSX1.shift1Active) {
            TheNextBeatSX1.folderExpandedState = !TheNextBeatSX1.folderExpandedState;
            var expandDirection = TheNextBeatSX1.folderExpandedState ? 1 : -1;
            engine.setValue('[Library]', 'MoveHorizontal', expandDirection);
        } else {
            var currentMix = engine.getValue('[Master]', 'headMix');
            var newMix = (currentMix > 0.0) ? -1.0 : 1.0;
            engine.setValue('[Master]', 'headMix', newMix);
        }
    }
};

TheNextBeatSX1.headMixLEDCallback = function (value, group, key) {
    var isCueMode = (value >= 0.0);
    var ledState = isCueMode ? 0x7F : 0x00;
    midi.sendShortMsg(0x90, 0x0D, ledState);
};

// --- Auto-Enable PFL on Track Load ---
TheNextBeatSX1.onTrackLoaded = function (value, group, key) {
    if (value === 1) {
        var currentDeck = group;
        var otherDeck = (group === '[Channel1]') ? '[Channel2]' : '[Channel1]';
        engine.setValue(currentDeck, 'pfl', 1);
        engine.setValue(otherDeck, 'pfl', 0);
    }
};

// 1. Layer Definitions. default (unshifted), shift1 (shift1/green), and blue (shift2/blue)
TheNextBeatSX1.layers = {
    deck1: {
        autoLoop: {
            default: { group: '[Channel1]', inKey: 'beatloop_activate', outKey: 'loop_enabled' },
            shift1:  { group: '[Channel1]', inKey: 'hotcue_2_activate', outKey: 'hotcue_2_enabled' },
            blue:    { group: '[Channel1]', inKey: 'hotcue_2_clear', outKey: 'hotcue_2_enabled' }
        },
        cue: {
            default: { group: '[Channel1]', inKey: 'cue_default', outKey: 'cue_indicator' },
            shift1:  { group: '[Channel1]', inKey: 'cue_gotoandstop', outKey: 'cue_indicator' },
            blue:  { group: '[Channel1]', inKey: 'cue_gotoandplay', outKey: 'cue_indicator' }
        },
        fxOnOff: {
            default: { group: '[EffectRack1_EffectUnit1_Effect1]', inKey: 'enabled', outKey: 'enabled', type: 1 },
            shift1:  { group: '[EffectRack1_EffectUnit1_Effect2]', inKey: 'enabled', outKey: 'enabled', type: 1 },
            blue:    { group: '[EffectRack1_EffectUnit1_Effect3]', inKey: 'enabled', outKey: 'enabled', type: 1 }
        },
        jogTouch: {
            default: { group: '[Channel1]', inKey: 'wheel' }
        },
        load: {
            default: { group: '[Channel1]', inKey: 'LoadSelectedTrack', outKey: 'track_loaded' },
            shift1:  { group: '[Channel1]', inKey: 'eject', outKey: 'track_loaded' },
            blue:    { group: '[Channel1]', inKey: 'slip_enabled', type: 1 }
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
            shift1:  { group: '[Sampler2]', inKey: 'cue_gotoandplay', outKey: 'play_latched' },
            blue:    { group: '[Sampler4]', inKey: 'cue_gotoandplay', outKey: 'play_latched'}
        },
        play: {
            default: { group: '[Channel1]', inKey: 'play', outKey: 'play_indicator', type: 1 },
            shift1:  { group: '[Channel1]', inKey: 'play', outKey: 'play_indicator', type: 1 },
            blue:  { group: '[Channel1]', inKey: 'start_stop', outKey: 'play_indicator', type: 0 }
        },
        sync: {
            default: { group: '[Channel1]', inKey: 'beatsync' },
            shift1:  { group: '[Channel1]', inKey: 'sync_enabled' },
            blue:  { group: '[Channel1]', inKey: 'sync_leader' }
        },
        tempoMinus: {
            default: { group: '[Channel1]', inKey: 'rate_perm_down_small', input: TheNextBeatSX1.handleTempoPress },
            shift1:  { group: '[Channel1]', inKey: 'rate_perm_down' },
            blue:    { group: '[Channel1]', inKey: 'beatjump_backward' }
        },
        tempoPlus: {
            default: { group: '[Channel1]', inKey: 'rate_perm_up_small', input: TheNextBeatSX1.handleTempoPress },
            shift1:  { group: '[Channel1]', inKey: 'rate_perm_up' },
            blue:    { group: '[Channel1]', inKey: 'beatjump_forward' }
        },
        vinyl: {
            default: { group: '[Channel1]', input: TheNextBeatSX1.toggleScratchMode, type: 1 },
            shift1:  { group: '[Sampler1]', inKey: 'cue_gotoandplay', outKey: 'play_latched'  },
            blue:    { group: '[Sampler3]', inKey: 'cue_gotoandplay', outKey: 'play_latched' }
        }
    },
    deck2: {
        autoLoop: {
            default: { group: '[Channel2]', inKey: 'beatloop_activate', outKey: 'loop_enabled' },
            shift1:  { group: '[Channel2]', inKey: 'hotcue_2_activate', outKey: 'hotcue_2_enabled' },
            blue:    { group: '[Channel2]', inKey: 'hotcue_2_clear', outKey: 'hotcue_2_enabled' }
        },
        cue: {
            default: { group: '[Channel2]', inKey: 'cue_default', outKey: 'cue_indicator' },
            shift1:  { group: '[Channel2]', inKey: 'cue_gotoandstop', outKey: 'cue_indicator' },
            blue:    { group: '[Channel2]', inKey: 'cue_gotoandplay', outKey: 'cue_indicator' }
            
        },
        fxOnOff: {
            default: { group: '[EffectRack1_EffectUnit2_Effect1]', inKey: 'enabled', outKey: 'enabled', type: 1 },
            shift1:  { group: '[EffectRack1_EffectUnit2_Effect2]', inKey: 'enabled', outKey: 'enabled', type: 1 },
            blue:    { group: '[EffectRack1_EffectUnit2_Effect3]', inKey: 'enabled', outKey: 'enabled', type: 1 }
        },
        jogTouch: {
            default: { group: '[Channel2]', inKey: 'wheel' }
        },
        load: {
            default: { group: '[Channel2]', inKey: 'LoadSelectedTrack', outKey: 'track_loaded' },
            shift1:  { group: '[Channel2]', inKey: 'eject', outKey: 'track_loaded' },
            blue:    { group: '[Channel2]', inKey: 'slip_enabled', type: 1 }
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
            shift1:  { group: '[Sampler6]', inKey: 'cue_gotoandplay', outKey: 'play_latched'  },
            blue:    { group: '[Sampler8]', inKey: 'cue_gotoandplay', outKey: 'play_latched'  }
        },
        play: {
            default: { group: '[Channel2]', inKey: 'play', outKey: 'play_indicator', type: 1 },
            shift1:  { group: '[Channel2]', inKey: 'play', outKey: 'play_indicator', type: 1 },
            blue:  { group: '[Channel2]', inKey: 'start_stop', outKey: 'play_indicator', type: 0 }
        },
        sync: {
            default: { group: '[Channel2]', inKey: 'beatsync' },
            shift1:  { group: '[Channel2]', inKey: 'sync_enabled' },
            blue:  { group: '[Channel2]', inKey: 'sync_leader' }
        },
        tempoMinus: {
            default: { group: '[Channel2]', inKey: 'rate_perm_down_small', input: TheNextBeatSX1.handleTempoPress },
            shift1:  { group: '[Channel2]', inKey: 'rate_perm_down' },
            blue:    { group: '[Channel2]', inKey: 'beatjump_backward' }
        },
        tempoPlus: {
            default: { group: '[Channel2]', inKey: 'rate_perm_up_small', input: TheNextBeatSX1.handleTempoPress },
            shift1:  { group: '[Channel2]', inKey: 'rate_perm_up' },
            blue:    { group: '[Channel2]', inKey: 'beatjump_forward' }
        },
        vinyl: {
            default: { group: '[Channel2]', input: TheNextBeatSX1.toggleScratchMode , type: 1},
            shift1:  { group: '[Sampler5]', inKey: 'cue_gotoandplay', outKey: 'play_latched' },
            blue:    { group: '[Sampler7]', inKey: 'cue_gotoandplay', outKey: 'play_latched' }
        }
    }
};

// Scratch configuration
TheNextBeatSX1.scratchSettings = {
    intervalsPerRev: 128,
    rpm: 33 + 1/3,
    alpha: 1.0 / 8.0,
    beta: (1.0 / 8.0) / 32
};

// Previous jogwheel implementation.
/* TheNextBeatSX1.jogWheelTurn = function (channel, control, value, status, group) {
    var deckNum = (group === '[Channel1]') ? 1 : 2;
    var delta = (value < 64) ? value : value - 128;

    if (TheNextBeatSX1.shift1Active) {
        var currentPos = engine.getValue(group, 'playposition');
        var seekStep = delta * 0.002;  // INCREASE/DECREASE 0.005 FOR SEARCH SENSIBILITY TUNNING.
        var newPos = Math.max(0.0, Math.min(1.0, currentPos + seekStep));
        engine.setValue(group, 'playposition', newPos);
        return;
    }

    if (engine.isScratching(deckNum)) {
        engine.scratchTick(deckNum, delta);
    } else {
        engine.setValue(group, 'jog', delta * 0.3); // INCREASE/DECREASE 0.3 TO CHANGE JOG SENSIBILITY
    }
}; */

// --- Jog Wheel Turn Handler (Deck 1 & Deck 2) ---
// Map is meant to follow hardware basic design.
// Unshifted: picth bend or scratch depending on Vynil mode on/off.
// Shift1(green) + jog turn is fast seek/search.
// Shift2(blue) + jog turn is an extra feature: ramp/accelerated pitch bend.
TheNextBeatSX1.jogWheelTurn = function (channel, control, value, status, group) {
    var deckNum = (group === '[Channel1]') ? 1 : 2;
    var delta = (value < 64) ? value : value - 128; // Parse 2's complement relative delta

    // --- 1. SHIFT 1 (GREEN) ACTIVE: HIGH-SPEED TRACK SEEK ---
    if (TheNextBeatSX1.shift1Active) {
        var currentPos = engine.getValue(group, 'playposition');
        var seekStep = delta * 0.002; // Track position scrubbing speed // INCREASE/DECREASE 0.005 FOR SEARCH SENSIBILITY TUNNING.
        var newPos = Math.max(0.0, Math.min(1.0, currentPos + seekStep));
        engine.setValue(group, 'playposition', newPos);
        return;
    }

// --- 2. SHIFT 2 (BLUE) ACTIVE: ACCELERATED JOG PITCH BEND ---
// --- Shift 2 (Blue) Accelerated & Reverse-Capable Jog Handler ---
if (TheNextBeatSX1.shift2Active) {
    var absDelta = Math.abs(delta);
    
    // --- ADJUSTABLE PARAMETERS ---
    //     Tuning Guide:
    // If slow turns are still too sensitive: Increase exponent to 2.8 or 3.0.
    // If fast spins don't reach enough speed/reverse: Increase baseMultiplier (e.g., to 2.0 or 3.0).
    var exponent = 5.5;           // Higher exponent (2.5) flattens slow turns for fine precision & steepens fast spins (default 2.5)
    var baseMultiplier = 8.00;    // Scaled multiplier to work with higher exponent growth (1.25)
    var backspinThreshold = 10;   // Minimum CCW speed to trigger negative/backward playback
    var backspinIntensity = 2.5;  // Multiplier to force strong negative jog momentum on fast backspins
    
    // Calculate non-linear accelerated speed curve
    var speedMultiplier = Math.pow(absDelta, exponent) * baseMultiplier;
    var acceleratedJog = (delta > 0 ? 1 : -1) * speedMultiplier;

    // Check for fast backward (counter-clockwise) spin
    if (delta < 0 && absDelta >= backspinThreshold) {
        // Ramps up negative jog input to force negative playback speed
        acceleratedJog = -Math.pow(absDelta, exponent) * backspinIntensity;
    }

    engine.setValue(group, 'jog', acceleratedJog);
    return;
}


    // --- 3. STANDARD LAYER: SCRATCH OR RIM PITCH BEND ---
    if (engine.isScratching(deckNum)) {
        // Platter touched while Vinyl mode is ON
        engine.scratchTick(deckNum, delta);
    } else {
        // Untouched platter / Rim turn pitch bend
        engine.setValue(group, 'jog', delta * 0.3);
    }
};

//new in 1.1 (slip_mode is off when releasing jogTouch / jogWheel.)
TheNextBeatSX1.jogTouch1 = function (channel, control, value, status, group) {
    if (value > 0 && TheNextBeatSX1.scratchEnabled[1]) {
        engine.scratchEnable(
            1,
            TheNextBeatSX1.scratchSettings.intervalsPerRev,
            TheNextBeatSX1.scratchSettings.rpm,
            TheNextBeatSX1.scratchSettings.alpha,
            TheNextBeatSX1.scratchSettings.beta
        );
    } else {
        // Touch released (or scratch disabled)
        engine.scratchDisable(1);

        // Auto-deactivate slip mode on release if active
        if (engine.getValue('[Channel1]', 'slip_enabled') === 1) {
            engine.setValue('[Channel1]', 'slip_enabled', 0);
        }
    }
};

TheNextBeatSX1.jogTouch2 = function (channel, control, value, status, group) {
    if (value > 0 && TheNextBeatSX1.scratchEnabled[2]) {
        engine.scratchEnable(
            2,
            TheNextBeatSX1.scratchSettings.intervalsPerRev,
            TheNextBeatSX1.scratchSettings.rpm,
            TheNextBeatSX1.scratchSettings.alpha,
            TheNextBeatSX1.scratchSettings.beta
        );
    } else {
        // Touch released (or scratch disabled)
        engine.scratchDisable(2);

        // Auto-deactivate slip mode on release if active
        if (engine.getValue('[Channel2]', 'slip_enabled') === 1) {
            engine.setValue('[Channel2]', 'slip_enabled', 0);
        }
    }
};




// 2. Custom LayerButton.
//  It is developed supporting Toggles (Play/Pause, Pre-fader Listening PFL, Vynil/slip mode, sync, and Effects)
// Early versions suffer from losing toggle status when changing layers when pushing shift1/shift2.
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

        // Added 'enabled' to prevent clearing Effects toggles on layer switch
        var persistentKeys = ['play', 'pfl', 'slip_enabled', 'sync_enabled', 'sync_leader', 'enabled'];
        if (this.inKey && this.group && persistentKeys.indexOf(this.inKey) === -1) {
            engine.setValue(this.group, this.inKey, 0);
        }

        if (typeof this.disconnect === 'function') {
            this.disconnect();
        }

        this.group = layerConfig.group;
        this.inKey = layerConfig.inKey || null;
        this.outKey = layerConfig.outKey || null;
        this.type = (layerConfig.type !== undefined) ? layerConfig.type : 0;
        
        if (layerConfig.input) {
            this.input = layerConfig.input;
        } else {
            delete this.input;
        }

        this.currentLayer = layerName;
        this.isPressed = false;

        if (this.outKey && typeof this.connect === 'function') {
            this.connect();
            if (typeof this.trigger === 'function') {
                this.trigger();
            }
        }

        if (layerName === 'default' && (this.midi[1] === 0x48 || this.midi[1] === 0x35)) {
            var deckNum = (this.group === '[Channel1]') ? 1 : 2;
            TheNextBeatSX1.updateVinylLED(deckNum);
        }
    }

    send(value) {
        var isHotcue = this.inKey && this.inKey.indexOf('hotcue_') !== -1;
        
        if (isHotcue && value > 0) {
            midi.sendShortMsg(this.midi[0], this.midi[1], TheNextBeatSX1.LED_COLOR.GREEN);
        } else {
            super.send(value);
        }
    }
};

// Centralized Shift Layer Manager
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

// Controller Init & Container Setup
TheNextBeatSX1.init = function () {



    // Continue with your component container setup...

    // Fire  22-Packet LED Burst & Analog ADC Dump Trigger
    // an attempt to get initial faders and knobs status on startup. It does not work :(
    TheNextBeatSX1.sendInitSequence();

    // Container is used to manage shift1 green and shift2 blue alternate functions as layers, following component.js approach.
    TheNextBeatSX1.container = new components.ComponentContainer();

    // SX1 midi map has no offset rule for channel1/channel2 midi controls
    // For this reason, deck 1 and deck 2 midi mapping is defined  independently .
    // All controls/buttons are defined as container properties so their functions can be managed by shifting/changing layer.

    // Deck 1 Components
    TheNextBeatSX1.container.d1AutoLoop = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x51], layers: TheNextBeatSX1.layers.deck1.autoLoop });
    TheNextBeatSX1.container.d1Cue = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x3B], layers: TheNextBeatSX1.layers.deck1.cue });
    TheNextBeatSX1.container.d1FxOnOff = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x43], layers: TheNextBeatSX1.layers.deck1.fxOnOff });
    TheNextBeatSX1.container.d1JogTouch = new components.Button({ midi: [0x90, 0x4D], group: '[Channel1]', input: TheNextBeatSX1.jogTouch1 });
    TheNextBeatSX1.container.d1Load = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x4B], layers: TheNextBeatSX1.layers.deck1.load });
    TheNextBeatSX1.container.d1LoopDouble = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x50], layers: TheNextBeatSX1.layers.deck1.loopDouble });
    TheNextBeatSX1.container.d1LoopHalve = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x64], layers: TheNextBeatSX1.layers.deck1.loopHalve });
    TheNextBeatSX1.container.d1Pfl = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x40], layers: TheNextBeatSX1.layers.deck1.pfl });
    TheNextBeatSX1.container.d1Play = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x4A], layers: TheNextBeatSX1.layers.deck1.play });
    TheNextBeatSX1.container.d1Sync = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x44], layers: TheNextBeatSX1.layers.deck1.sync });
    TheNextBeatSX1.container.d1TempoMinus = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x54], layers: TheNextBeatSX1.layers.deck1.tempoMinus });
    TheNextBeatSX1.container.d1TempoPlus = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x53], layers: TheNextBeatSX1.layers.deck1.tempoPlus });
    TheNextBeatSX1.container.d1Vinyl = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x48], layers: TheNextBeatSX1.layers.deck1.vinyl });

    // Deck 2 Components
    TheNextBeatSX1.container.d2AutoLoop = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x0C], layers: TheNextBeatSX1.layers.deck2.autoLoop });
    TheNextBeatSX1.container.d2Cue = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x42], layers: TheNextBeatSX1.layers.deck2.cue });
    TheNextBeatSX1.container.d2FxOnOff = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x45], layers: TheNextBeatSX1.layers.deck2.fxOnOff });
    TheNextBeatSX1.container.d2JogTouch = new components.Button({ midi: [0x90, 0x4E], group: '[Channel2]', input: TheNextBeatSX1.jogTouch2 });
    TheNextBeatSX1.container.d2Load = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x34], layers: TheNextBeatSX1.layers.deck2.load });
    TheNextBeatSX1.container.d2LoopDouble = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x0E], layers: TheNextBeatSX1.layers.deck2.loopDouble });
    TheNextBeatSX1.container.d2LoopHalve = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x65], layers: TheNextBeatSX1.layers.deck2.loopHalve });
    TheNextBeatSX1.container.d2Pfl = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x47], layers: TheNextBeatSX1.layers.deck2.pfl });
    TheNextBeatSX1.container.d2Play = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x4C], layers: TheNextBeatSX1.layers.deck2.play });
    TheNextBeatSX1.container.d2Sync = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x46], layers: TheNextBeatSX1.layers.deck2.sync });
    TheNextBeatSX1.container.d2TempoMinus = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x56], layers: TheNextBeatSX1.layers.deck2.tempoMinus });
    TheNextBeatSX1.container.d2TempoPlus = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x55], layers: TheNextBeatSX1.layers.deck2.tempoPlus });
    TheNextBeatSX1.container.d2Vinyl = new TheNextBeatSX1.LayerButton({ midi: [0x90, 0x35], layers: TheNextBeatSX1.layers.deck2.vinyl });

    // Shift Buttons
    TheNextBeatSX1.container.shift1 = new components.Button({
        midi: [0x90, 0x33],
        input: function (channel, control, value, status) {
            var isPressed = (status === 0x90 && value > 0);
            TheNextBeatSX1.shift1Active = isPressed;
            TheNextBeatSX1.updateLayers();
            TheNextBeatSX1.onLoopEnabledChanged(engine.getValue('[Channel1]', 'loop_enabled'), '[Channel1]', 'loop_enabled');
            TheNextBeatSX1.onLoopEnabledChanged(engine.getValue('[Channel2]', 'loop_enabled'), '[Channel2]', 'loop_enabled');
        }
    });

    TheNextBeatSX1.container.shift2 = new components.Button({
        midi: [0x90, 0x3C],
        input: function (channel, control, value, status) {
            var isPressed = (status === 0x90 && value > 0);
            TheNextBeatSX1.shift2Active = isPressed;
            TheNextBeatSX1.updateLayers();
            TheNextBeatSX1.onLoopEnabledChanged(engine.getValue('[Channel1]', 'loop_enabled'), '[Channel1]', 'loop_enabled');
            TheNextBeatSX1.onLoopEnabledChanged(engine.getValue('[Channel2]', 'loop_enabled'), '[Channel2]', 'loop_enabled');
        }
    });

    // Default LED setup
    TheNextBeatSX1.updateVinylLED(1);
    TheNextBeatSX1.updateVinylLED(2);

    // Bindings & Listeners
    engine.makeConnection('[Master]', 'headMix', TheNextBeatSX1.headMixLEDCallback);
    TheNextBeatSX1.headMixLEDCallback(engine.getValue('[Master]', 'headMix'), '[Master]', 'headMix');

    engine.makeConnection('[Channel1]', 'track_loaded', TheNextBeatSX1.onTrackLoaded);
    engine.makeConnection('[Channel2]', 'track_loaded', TheNextBeatSX1.onTrackLoaded);

    engine.makeConnection('[Channel1]', 'loop_enabled', TheNextBeatSX1.onLoopEnabledChanged);
    engine.makeConnection('[Channel2]', 'loop_enabled', TheNextBeatSX1.onLoopEnabledChanged);
    
    // Connect BPM monitoring to sync LEDs
    engine.makeConnection('[Channel1]', 'bpm', TheNextBeatSX1.updateSyncLEDs);
    engine.makeConnection('[Channel2]', 'bpm', TheNextBeatSX1.updateSyncLEDs);
    TheNextBeatSX1.updateSyncLEDs();

    TheNextBeatSX1.onLoopEnabledChanged(engine.getValue('[Channel1]', 'loop_enabled'), '[Channel1]', 'loop_enabled');
    TheNextBeatSX1.onLoopEnabledChanged(engine.getValue('[Channel2]', 'loop_enabled'), '[Channel2]', 'loop_enabled');

    // Uncomment following 2 lines if you prefer volume at middle position on startup. (no initial knob status is available for mixxx)
    // engine.setValue('[Channel1]', 'volume', 0.5);
    // engine.setValue('[Channel2]', 'volume', 0.5);
    engine.softTakeover('[Channel1]', 'volume', true);
    engine.softTakeover('[Channel2]', 'volume', true);


};


// Shutdown Cleanup
TheNextBeatSX1.shutdown = function () {
    // Clear tempo repeat timers (these timers are used for tempo long-press actions and autoloop blinking)
    for (var timerKey in TheNextBeatSX1.tempoRepeatState) {
        if (TheNextBeatSX1.tempoRepeatState[timerKey]) {
            engine.stopTimer(TheNextBeatSX1.tempoRepeatState[timerKey]);
        }
    }

    if (TheNextBeatSX1.loopBlinkState[1].timerId !== 0) {
        engine.stopTimer(TheNextBeatSX1.loopBlinkState[1].timerId);
    }
    if (TheNextBeatSX1.loopBlinkState[2].timerId !== 0) {
        engine.stopTimer(TheNextBeatSX1.loopBlinkState[2].timerId);
    }

    engine.makeConnection('[Channel1]', 'track_loaded', TheNextBeatSX1.onTrackLoaded, true);
    engine.makeConnection('[Channel2]', 'track_loaded', TheNextBeatSX1.onTrackLoaded, true);
    engine.makeConnection('[Channel1]', 'loop_enabled', TheNextBeatSX1.onLoopEnabledChanged, true);
    engine.makeConnection('[Channel2]', 'loop_enabled', TheNextBeatSX1.onLoopEnabledChanged, true);
    engine.makeConnection('[Channel1]', 'bpm', TheNextBeatSX1.updateSyncLEDs, true);
    engine.makeConnection('[Channel2]', 'bpm', TheNextBeatSX1.updateSyncLEDs, true);
    engine.makeConnection('[Master]', 'headMix', TheNextBeatSX1.headMixLEDCallback, true);

    if (TheNextBeatSX1.container) {
        TheNextBeatSX1.container.shutdown();
    }
};