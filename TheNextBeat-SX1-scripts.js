// Define the controller module namespace
var TheNextBeatSX1 = {
    shift1Active: false,
    shift2Active: false
};

// 1. Layer Definitions matching table.csv
TheNextBeatSX1.layers = {
    // --- DECK 1 ---
    deck1: {
        load: {
            default: { group: '[Channel1]', inKey: 'LoadSelectedTrack', outKey: 'track_loaded' },
            shift1:  { group: '[Channel1]', inKey: 'eject', outKey: 'track_loaded' }
        },
        loopDouble: {
            default: { group: '[Channel1]', inKey: 'loop_double', outKey: 'loop_enabled' },
            shift1:  { group: '[Channel1]', inKey: 'hotcue_1_activate', outKey: 'hotcue_1_enabled' },
            blue:    { group: '[Channel1]', inKey: 'hotcue_1_clear', outKey: 'hotcue_1_enabled' }
        },
        autoLoop: {
            default: { group: '[Channel1]', inKey: 'beatloop_activate', outKey: 'loop_enabled' },
            shift1:  { group: '[Channel1]', inKey: 'hotcue_2_activate', outKey: 'hotcue_2_enabled' },
            blue:    { group: '[Channel1]', inKey: 'hotcue_2_clear', outKey: 'hotcue_2_enabled' }
        },
        loopHalve: {
            default: { group: '[Channel1]', inKey: 'loop_halve', outKey: 'loop_enabled' },
            shift1:  { group: '[Channel1]', inKey: 'hotcue_3_activate', outKey: 'hotcue_3_enabled' },
            blue:    { group: '[Channel1]', inKey: 'hotcue_3_clear', outKey: 'hotcue_3_enabled' }
        }
    },

    // --- DECK 2 ---
    deck2: {
        autoLoop: {
            default: { group: '[Channel2]', inKey: 'beatloop_activate', outKey: 'loop_enabled' },
            shift1:  { group: '[Channel2]', inKey: 'hotcue_2_activate', outKey: 'hotcue_2_enabled' },
            blue:    { group: '[Channel2]', inKey: 'hotcue_2_clear', outKey: 'hotcue_2_enabled' }
        },
        loopDouble: {
            default: { group: '[Channel2]', inKey: 'loop_double', outKey: 'loop_enabled' },
            shift1:  { group: '[Channel2]', inKey: 'hotcue_1_activate', outKey: 'hotcue_1_enabled' },
            blue:    { group: '[Channel2]', inKey: 'hotcue_1_clear', outKey: 'hotcue_1_enabled' }
        },
        load: {
            default: { group: '[Channel2]', inKey: 'LoadSelectedTrack', outKey: 'track_loaded' },
            shift1:  { group: '[Channel2]', inKey: 'eject', outKey: 'track_loaded' }
        },
        loopHalve: {
            default: { group: '[Channel2]', inKey: 'loop_halve', outKey: 'loop_enabled' },
            shift1:  { group: '[Channel2]', inKey: 'hotcue_3_activate', outKey: 'hotcue_3_enabled' },
            blue:    { group: '[Channel2]', inKey: 'hotcue_3_clear', outKey: 'hotcue_3_enabled' }
        }
    }
};

// 2. Custom LayerButton with safe state-resetting on layer change
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

        // Force-release any active input key in Mixxx before switching targets
        if (this.inKey && this.group) {
            engine.setValue(this.group, this.inKey, 0);
        }

        // Disconnect current Mixxx output listeners
        if (typeof this.disconnect === 'function') {
            this.disconnect();
        }

        // Update component targets
        this.group = layerConfig.group;
        this.inKey = layerConfig.inKey;
        this.outKey = layerConfig.outKey;
        this.currentLayer = layerName;

        // Reset internal state tracker in components.Button
        this.isPressed = false;

        // Reconnect and trigger immediate state refresh
        if (typeof this.connect === 'function') {
            this.connect();
        }
        if (typeof this.trigger === 'function') {
            this.trigger();
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

    // Deck 1 Buttons
    TheNextBeatSX1.container.d1Load = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x4B],
        layers: TheNextBeatSX1.layers.deck1.load
    });
    TheNextBeatSX1.container.d1LoopDouble = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x50],
        layers: TheNextBeatSX1.layers.deck1.loopDouble
    });
    TheNextBeatSX1.container.d1AutoLoop = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x51],
        layers: TheNextBeatSX1.layers.deck1.autoLoop
    });
    TheNextBeatSX1.container.d1LoopHalve = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x64],
        layers: TheNextBeatSX1.layers.deck1.loopHalve
    });

    // Deck 2 Buttons
    TheNextBeatSX1.container.d2AutoLoop = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x0C],
        layers: TheNextBeatSX1.layers.deck2.autoLoop
    });
    TheNextBeatSX1.container.d2LoopDouble = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x0E],
        layers: TheNextBeatSX1.layers.deck2.loopDouble
    });
    TheNextBeatSX1.container.d2Load = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x34],
        layers: TheNextBeatSX1.layers.deck2.load
    });
    TheNextBeatSX1.container.d2LoopHalve = new TheNextBeatSX1.LayerButton({
        midi: [0x90, 0x65],
        layers: TheNextBeatSX1.layers.deck2.loopHalve
    });

// Master Shift 1 (Green) Button (0x33)
    TheNextBeatSX1.container.shift1 = new components.Button({
        midi: [0x90, 0x33],
        input: function (channel, control, value, status) {
            // Evaluates to true on press (0x90 + value > 0) 
            // Evaluates to false on release (0x80 OR status 0x90 with value 0)
            var isPressed = (status === 0x90 && value > 0);
            
            TheNextBeatSX1.shift1Active = isPressed;
            TheNextBeatSX1.updateLayers();
        }
    });

    // Master Shift 2 (Blue) Button (0x3C)
    TheNextBeatSX1.container.shift2 = new components.Button({
        midi: [0x90, 0x3C],
        input: function (channel, control, value, status) {
            var isPressed = (status === 0x90 && value > 0);
            
            TheNextBeatSX1.shift2Active = isPressed;
            TheNextBeatSX1.updateLayers();
        }
    });
};

TheNextBeatSX1.shutdown = function () {
    if (TheNextBeatSX1.container) {
        TheNextBeatSX1.container.shutdown();
    }
};