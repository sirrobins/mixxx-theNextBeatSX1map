// Define the controller module namespace
var TheNextBeatSX1 = {
    shift1Active: false,
    shift2Active: false,
    folderExpandedState: false
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
TheNextBeatSX1.loopBlinkState = {
    1: { timerId: 0, ledState: false, midiNo: 0x51 },
    2: { timerId: 0, ledState: false, midiNo: 0x0C }
};

TheNextBeatSX1.onLoopEnabledChanged = function (value, group, key) {
    var deckNum = (group === '[Channel1]') ? 1 : 2;
    var state = TheNextBeatSX1.loopBlinkState[deckNum];
    var statusByte = 0x90;

    if (value === 1) {
        if (state.timerId === 0) {
            state.timerId = engine.beginTimer(300, function () {
                if (!TheNextBeatSX1.shift1Active && !TheNextBeatSX1.shift2Active) {
                    state.ledState = !state.ledState;
                    midi.sendShortMsg(statusByte, state.midiNo, state.ledState ? 0x7F : 0x00);
                }
            });
        }
    } else {
        if (state.timerId !== 0) {
            engine.stopTimer(state.timerId);
            state.timerId = 0;
        }
        state.ledState = false;

        if (!TheNextBeatSX1.shift1Active && !TheNextBeatSX1.shift2Active) {
            midi.sendShortMsg(statusByte, state.midiNo, 0x00);
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

// 1. Layer Definitions matching table.csv
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
            default: { group: '[EffectRack1_EffectUnit1_Effect1]', inKey: 'enabled', outKey: 'enabled', type: 1 }
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
        play: {
            default: { group: '[Channel1]', inKey: 'play', outKey: 'play_indicator', type: 1 },
            shift1:  { group: '[Channel1]', inKey: 'play', outKey: 'play_indicator', type: 1 },
            blue:  { group: '[Channel1]', inKey: 'start_stop', outKey: 'play_indicator', type: 0 }
        },
        sync: {
            default: { group: '[Channel1]', inKey: 'sync_enabled' }
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
            default: { group: '[Channel1]', input: TheNextBeatSX1.toggleScratchMode },
            shift1:  { group: '[Sampler1]', inKey: 'cue_gotoandplay', outKey: 'track_loaded' },
            blue:    { group: '[Sampler3]', inKey: 'cue_gotoandplay', outKey: 'track_loaded' }
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
            blue:  { group: '[Channel2]', inKey: 'cue_gotoandplay', outKey: 'cue_indicator' }
            
        },
        fxOnOff: {
            default: { group: '[EffectRack1_EffectUnit2_Effect1]', inKey: 'enabled', outKey: 'enabled', type: 1 }
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
        play: {
            default: { group: '[Channel2]', inKey: 'play', outKey: 'play_indicator', type: 1 },
            shift1:  { group: '[Channel2]', inKey: 'play', outKey: 'play_indicator', type: 1 },
            blue:  { group: '[Channel2]', inKey: 'start_stop', outKey: 'play_indicator', type: 0 }
        },
        sync: {
            default: { group: '[Channel2]', inKey: 'sync_enabled' }
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
            default: { group: '[Channel2]', input: TheNextBeatSX1.toggleScratchMode },
            shift1:  { group: '[Sampler1]', inKey: 'cue_gotoandplay', outKey: 'track_loaded' },
            blue:    { group: '[Sampler3]', inKey: 'cue_gotoandplay', outKey: 'track_loaded' }
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

TheNextBeatSX1.jogWheelTurn = function (channel, control, value, status, group) {
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
};

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
        engine.scratchDisable(1);
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
        engine.scratchDisable(2);
    }
};

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

        var persistentKeys = ['play', 'pfl', 'slip_enabled', 'sync_enabled'];
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
    TheNextBeatSX1.container = new components.ComponentContainer();

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

    engine.setValue('[Channel1]', 'volume', 0.5);
    engine.setValue('[Channel2]', 'volume', 0.5);
    engine.softTakeover('[Channel1]', 'volume', true);
    engine.softTakeover('[Channel2]', 'volume', true);
};

// Shutdown Cleanup
TheNextBeatSX1.shutdown = function () {
    // Clear tempo repeat timers
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