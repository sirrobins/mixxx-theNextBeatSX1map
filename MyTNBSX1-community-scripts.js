////////////////////////////////////////////////////////////////////////
// Controller: The Next Beat SX1
// URL:        https://mixxx.discourse.group/t/help-with-the-next-beat-by-tiesto-controller-mapping/28518/17
// Author:     sirrobins
// Credits:    DJ aK (baseline: Reloop Digital Jockey 2 RDJ2) 
// Credits:    Uwe Klotz a/k/a tapir (baseline: Denon MC6000MK2 script)
////////////////////////////////////////////////////////////////////////

var TNBSX1 = {};


////////////////////////////////////////////////////////////////////////
// Tunable constants                                                  //
////////////////////////////////////////////////////////////////////////

//TNBSX1.JOG_SPIN_CUE_PEAK = 0.2; // [0.0, 1.0]
TNBSX1.JOG_SPIN_CUE_PEAK = 0.1; // [0.0, 1.0]
//TNBSX1.JOG_SPIN_CUE_EXPONENT = 0.3; // 1.0 = linear response
TNBSX1.JOG_SPIN_CUE_EXPONENT = 0.1; // 1.0 = linear response

TNBSX1.JOG_SPIN_PLAY_PEAK = 0.9; // [0.0, 1.0]
TNBSX1.JOG_SPIN_PLAY_EXPONENT = 0.1; // 1.0 = linear response

TNBSX1.JOG_SCRATCH_RPM = 33.333333; // 33 1/3
TNBSX1.JOG_SCRATCH_ALPHA = 0.125; // 1/8
TNBSX1.JOG_SCRATCH_BETA = TNBSX1.JOG_SCRATCH_ALPHA / 32.0;
TNBSX1.JOG_SCRATCH_RAMP = true; // required for back spins

// Seeking: Number of revolutions needed to seek from the beginning
// to the end of the track.
//TNBSX1.JOG_SEEK_REVOLUTIONS = 2;
TNBSX1.JOG_SEEK_REVOLUTIONS = 50;


////////////////////////////////////////////////////////////////////////
// Fixed constants                                                    //
////////////////////////////////////////////////////////////////////////

// Controller constants
TNBSX1.DECK_COUNT = 2;
//TNBSX1.JOG_RESOLUTION = 148; // measured/estimated
//TNBSX1.JOG_RESOLUTION = 240; // SX1: 240 codes per 360 turn: measured/estimated
// testing jogwheel smoother reaction:
TNBSX1.JOG_RESOLUTION = 240; // SX1: 240 codes per 360 turn: measured/estimated
TNBSX1.SHIFT_OFFSET = 0x1E;  // 1E hex: 30 decimal.


// Jog constants
// SX1 jog code: ForWard turn: 0x01 (1 dec). ReWind turn: 0x7F (127 dec.)
// SX1: 0x40 = 64 (dec)
//TNBSX1.MIDI_JOG_DELTA_BIAS = 0x40;
TNBSX1.MIDI_JOG_DELTA_BIAS = 0x40; // center value of relative movements
// SX1: not sure below value: 3F (hex) = 63 (dec)
TNBSX1.MIDI_JOG_DELTA_RANGE = 0x3F; // both forward (= positive) and reverse (= negative)


// Mixxx constants
//TNBSX1.MIXXX_JOG_RANGE = 3.0;
TNBSX1.MIXXX_JOG_RANGE = 0.5;
TNBSX1.MIXXX_LOOP_POSITION_UNDEFINED = -1;


////////////////////////////////////////////////////////////////////////
// Button/Knob map                                                    //
////////////////////////////////////////////////////////////////////////

/* This map is necessary as Reloop has designed the controller in such
   a way that not all buttons/knobs have the same offset comparing
   CH0 and CH1. By looking at the MIDI messages sent by the controller,
   we can see that the hardware is designed as symmetric halves.

   In other words, constant offset in hardware corresponds to symmetric
   halves, but the controller layout is not fully symmetric.
   (e.x. ACTIVATE 1 buttons)

   Thus we need a map to preserve object oriented approach .

   The below map is only for the unshifted controls as shifted ones
   have the same handlers mapped in the xml file and the outputs
   always refer to the unshifted controls. 
   
   SX1: Below map cannot be modified, whithout deep map understanding
   All values are required on functions that prevents controller map start.
   Pending further analysis.
   
   */
TNBSX1.BUTTONMAP_CH0_CH1 = {
    load: [0x4B, 0x34],
    play: [0x4A, 0x4C],
    cue: [0x91, 0x92],
    sync: [0x44, 0x46],
	search: [0x00, 0x33], // SX1: set to x33 same as Shift 1 button., (conflict with tempoDown  RDJ2 values: [0x1A, 0x56]
	scratch: [0x48, 0x35],  // SX1: we assume vinyl button == scratch
	fxdrywet: [0x1C, 0x58],
    bendminus: [0x00, 0x00], //SX1  tempo - ??
    bendplus: [0x00, 0x00], // SX1 tempo + ??
	loopin: [0x00, 0x00], //SX1   - ??
	loopout: [0x00, 0x00], // SX1 set to x00, conflict with play.  RDJ2 values: [0x10, 0x4C]
	autoloop: [0x51, 0x0C],
	loopactive: [0x00, 0x00], //SX1   - ??
    fx1assign: [0x27, 0x68],    //this is the shifted Activate 3 button
    fx2assign: [0x2C, 0x63],    //this is the shifted FX ON button
	highkill: [0x00, 0x00], //SX1 set to x00, (conflict with loopsizeUp. RDJ2 values: [0x14, 0x50]
	// from this point, SX1 buttons map, not available in Dig jockey2
	tempoUp: [0x53, 0x55], // SX1: bpm_up_small
	tempoDown: [0x54, 0x56], // SX1: bpm_down_small
	loopSizeUp: [0x50, 0x0E], // SX1: loop_double
	loopSizeDown: [0x64, 0x65], // SX1: loop_halve
	
};

// SX1: Not sure if this is userful in SX1
TNBSX1.KNOBMAP_CH0_CH1 = {
    loopSize: [0x28, 0x63],     //this is the shifted Dry/Wet Knob
};


////////////////////////////////////////////////////////////////////////
// Logging functions                                                  //
////////////////////////////////////////////////////////////////////////

TNBSX1.logDebug = function(msg) {
    if (TNBSX1.debug) {
        print("[" + TNBSX1.id + " DEBUG] " + msg);
    }
};

TNBSX1.logInfo = function(msg) {
    print("[" + TNBSX1.id + " INFO] " + msg);
};

TNBSX1.logWarning = function(msg) {
    print("[" + TNBSX1.id + " WARNING] " + msg);
};

TNBSX1.logError = function(msg) {
    print("[" + TNBSX1.id + " ERROR] " + msg);
};


////////////////////////////////////////////////////////////////////////
// Buttons                                                            //
////////////////////////////////////////////////////////////////////////

// SX1: This seems the value code for outgoing midi on/off signals (leds on/off)
TNBSX1.MIDI_ON = 0x7F;
TNBSX1.MIDI_OFF = 0x00;

TNBSX1.isButtonPressed = function(midiValue) {
	console.log("SX1: " + midiValue);
    switch (midiValue) {
		
    case TNBSX1.MIDI_ON:
        return true;
    case TNBSX1.MIDI_OFF:
        return false;
    default:
        TNBSX1.logError("Unexpected MIDI button value: " + midiValue);
        return undefined;
    }
};

/* Custom buttons */

// SX1 SHIFT1 button.
// It applies both for leftDeck and rightDeck controls. (activating GREEN color function when available)
TNBSX1.ShiftButton = function(options) {
	
    this.state = false;
    this.connectedContainers = [];
    components.Button.call(this, options);
};
TNBSX1.ShiftButton.prototype = new components.Button({
    input: function(channel, control, value) {
        //update shift state
        this.state = TNBSX1.isButtonPressed(value);
        this.send(this.outValueScale(this.state));

        //call shift()/unshift() for each connected container
        if (this.state) {
            this.connectedContainers.forEach(function(container) {
                container.shift();
            });
        } else {
            this.connectedContainers.forEach(function(container) {
                container.unshift();
            });
        }
    },
    isActive: function() {
        return this.state;
    },
    connectContainer: function(container) {
        if (container instanceof components.ComponentContainer === false) {
            TNBSX1.logError("Container type mismatch");
        } else {
            this.connectedContainers.push(container);
            TNBSX1.logDebug("Connected container " + this.connectedContainers.indexOf(container) + " to shift button 0x" + this.midi[1].toString(16));
        }
    }
});


// SX1 SHIFT2 button.
// It applies both for leftDeck and rightDeck controls. (activating BLUE color function when available)
TNBSX1.Shift2Button = function(options) {
	console.log("SX1: " + options);
    this.state = false;
    this.connectedContainers = [];
    components.Button.call(this, options);
};
TNBSX1.Shift2Button.prototype = new components.Button({
    input: function(channel, control, value) {
        //update shift state
        this.state = TNBSX1.isButtonPressed(value);
        this.send(this.outValueScale(this.state));

        //call shift()/unshift() for each connected container
        if (this.state) {
			TNBSX1.leftDeck.loopSizeUpButton.inKey = "hotcue_1_clear";
			TNBSX1.leftDeck.autoLoopButton.inKey = "hotcue_2_clear";
			TNBSX1.leftDeck.loopSizeDownButton.inKey = "hotcue_3_clear";
			TNBSX1.rightDeck.loopSizeUpButton.inKey = "hotcue_1_clear";
			TNBSX1.rightDeck.autoLoopButton.inKey = "hotcue_2_clear";
			TNBSX1.rightDeck.loopSizeDownButton.inKey = "hotcue_3_clear";
				
            this.connectedContainers.forEach(function(container) {
                container.shift();
            });
        } else {
            this.connectedContainers.forEach(function(container) {
                container.unshift();
            });
        }
    },
    isActive: function() {
        return this.state;
    },
    connectContainer: function(container) {
        if (container instanceof components.ComponentContainer === false) {
            TNBSX1.logError("Container type mismatch");
        } else {
            this.connectedContainers.push(container);
            TNBSX1.logDebug("Connected container " + this.connectedContainers.indexOf(container) + " to shift button 0x" + this.midi[1].toString(16));
        }
    }
});


TNBSX1.LoopInButton = function(options) {
    components.Button.call(this, options);
};
TNBSX1.LoopInButton.prototype = new components.Button({
    outKey: "loop_start_position",
    outValueScale: function(value) { return value >= 0 ? this.on : this.off; },
    unshift: function() {
        this.inKey = "loop_in";
        this.input = components.Button.prototype.input;
    },
    shift: function() {
        //pressing when shifted will delete loop start marker
        this.inKey = "loop_start_position";
        this.input = function(channel, control, value, status) {
            if (this.isPress(channel, control, value, status)) {
                this.inSetValue(TNBSX1.MIXXX_LOOP_POSITION_UNDEFINED);
            }
        };
    },
});

TNBSX1.LoopOutButton = function(options) {
    components.Button.call(this, options);
};
TNBSX1.LoopOutButton.prototype = new components.Button({
    outKey: "loop_end_position",
    outValueScale: function(value) { return value >= 0 ? this.on : this.off; },
    unshift: function() {
        this.inKey = "loop_out";
        this.input = components.Button.prototype.input;
    },
    shift: function() {
        //pressing when shifted will delete loop end marker
        this.inKey = "loop_end_position";
        this.input = function(channel, control, value, status) {
            if (this.isPress(channel, control, value, status)) {
                this.inSetValue(TNBSX1.MIXXX_LOOP_POSITION_UNDEFINED);
            }
        };
    },
});



// SX1 added custom button: TEMPO +
TNBSX1.tempoUpButton = function(options) {
    components.Button.call(this, options);
};
TNBSX1.tempoUpButton.prototype = new components.Button({
    outKey: "bpm_up_small",
    unshift: function() {
        this.inKey = "bpm_up_small";
    },
    shift: function() {
        this.inKey = "bpm_up";
    },
});

// SX1 added custom button: TEMPO -
TNBSX1.tempoDownButton = function(options) {
    components.Button.call(this, options);
};
TNBSX1.tempoDownButton.prototype = new components.Button({
    outKey: "bpm_up_small",
    unshift: function() {
        this.inKey = "bpm_down_small";
    },
    shift: function() {
        this.inKey = "bpm_down";
    },
});

// SX1 added custom button: AutoLoop (UnShift) > HotCue2 set (shift) > HotCue2 unSet (shift2)
TNBSX1.AutoLoopButton = function(options) {
    components.Button.call(this, options);
};
TNBSX1.AutoLoopButton.prototype = new components.Button({
    outKey: "beatloop_activate",
    unshift: function() {
        this.inKey = "beatloop_activate";
    },
    shift: function() {
        this.inKey = "hotcue_2_activate";
    },
});

// SX1 added custom button: Loop Double (unShift) >  HotCue1 set (shift) > HotCue1 unSet (shift2)
TNBSX1.loopSizeUpButton = function(options) {
    components.Button.call(this, options);
};
TNBSX1.loopSizeUpButton.prototype = new components.Button({
    outKey: "loop_double",
    unshift: function() {
        this.inKey = "loop_double";
    },
    shift: function() {
        this.inKey = "hotcue_1_activate";
    },
    shift2: function() {
        this.inKey = "hotcue_1_clear";
    },
});

// SX1 added custom button: LOOP HALVE  HotCue1 set (shift). HotCue1 unSet (shift2)
TNBSX1.loopSizeDownButton = function(options) {
    components.Button.call(this, options);
};
TNBSX1.loopSizeDownButton.prototype = new components.Button({
    outKey: "loop_halve",
    unshift: function() {
        this.inKey = "loop_halve";
		console.log(this.inKey);
    },
    shift: function() {
        this.inKey = "hotcue_3_activate";
    },
    shift2: function() {
        this.inKey = "hotcue_3_clear";
    },	
});

TNBSX1.LoopActiveButton = function(options) {
    components.Button.call(this, options);
};
TNBSX1.LoopActiveButton.prototype = new components.Button({
    outKey: "loop_enabled",
    unshift: function() {
        this.inKey = "reloop_toggle";
    },
    shift: function() {
        this.inKey = "reloop_andstop";
    },
});


////////////////////////////////////////////////////////////////////////
// Knobs                                                              //
////////////////////////////////////////////////////////////////////////

TNBSX1.MIDI_KNOB_INC = 0x01; // 0x41 in RDJ2
TNBSX1.MIDI_KNOB_DEC = 0x7F; // x7f in RDJ2
TNBSX1.MIDI_KNOB_DELTA_BIAS = 0x3f; // center value of relative movements x40 in RDJ2
//TNBSX1.MIDI_KNOB_STEPS = 20;  // 20 is full knob's rotation (360deg)
TNBSX1.MIDI_KNOB_STEPS = 16;    // 16 is more like volume knobs

TNBSX1.getKnobDelta = function(midiValue) {
    return midiValue - TNBSX1.MIDI_KNOB_DELTA_BIAS;
};

TNBSX1.knobInput = function(channel, control, value) {
    var knobDelta = TNBSX1.getKnobDelta(value);
    this.inSetParameter(this.inGetParameter() + knobDelta / TNBSX1.MIDI_KNOB_STEPS);
};

/* Custom knobs */
TNBSX1.LoopSizeKnob = function(options) {
    components.Pot.call(this, options);
};
TNBSX1.LoopSizeKnob.prototype = new components.Pot({
    input: function(channel, control, value) {
        var knobDelta = TNBSX1.getKnobDelta(value);

        if (knobDelta > 0) {
            engine.setValue(this.group, "loop_double", true);
        } else {
            engine.setValue(this.group, "loop_halve", true);
        }
    }
});


////////////////////////////////////////////////////////////////////////
// Decks                                                              //
////////////////////////////////////////////////////////////////////////

TNBSX1.JOGMODES = {
    normal: 0,
    vinyl: 1,
    search: 2,
    fxdrywet: 3,
    trax: 4,
};

//SX1:
// Controller sends value 1 when jog spinning ForWard
// Controller sends value 127 when spinning backwards
// Added 128 - value.... 
TNBSX1.getJogDeltaValue = function(value) {
    if (value === 0x00) {
        return 0x00;
    } else {
//      return value - TNBSX1.MIDI_JOG_DELTA_BIAS;
        return 128 - value - TNBSX1.MIDI_JOG_DELTA_BIAS;
    }
};

/* Constructor */

TNBSX1.Deck = function(number) {
    TNBSX1.logDebug("Creating Deck " + number);

    this.number = number; 
    this.group = "[Channel" + number + "]";
    this.filterGroup = "[QuickEffectRack1_" + this.group + "_Effect1]";
    this.rateDirBackup = this.getValue("rate_dir");
    this.setValue("rate_dir", -1);
    this.jogTouchState = false;

    components.Deck.call(this, number);

    //primary buttons
    this.loadButton = new TNBSX1.LoadButton([0x90, TNBSX1.BUTTONMAP_CH0_CH1.load[number - 1]]);
    this.playButton = new components.PlayButton([0x90, TNBSX1.BUTTONMAP_CH0_CH1.play[number - 1]]);
    this.cueButton = new components.CueButton([0x90, TNBSX1.BUTTONMAP_CH0_CH1.cue[number - 1]]);
    this.syncButton = new components.SyncButton([0x90, TNBSX1.BUTTONMAP_CH0_CH1.sync[number - 1]]);
    this.bendMinusButton = new TNBSX1.BendMinusButton([0x90, TNBSX1.BUTTONMAP_CH0_CH1.bendminus[number - 1]]);
    this.bendPlusButton = new TNBSX1.BendPlusButton([0x90, TNBSX1.BUTTONMAP_CH0_CH1.bendplus[number - 1]]);
    this.jogModeSelector = new TNBSX1.JogModeSelector(number,
        TNBSX1.BUTTONMAP_CH0_CH1.search[number - 1],
        TNBSX1.BUTTONMAP_CH0_CH1.scratch[number - 1],
        TNBSX1.BUTTONMAP_CH0_CH1.fxdrywet[number - 1]);

    //loops
    this.loopsizeKnob = new TNBSX1.LoopSizeKnob([0xB0, TNBSX1.KNOBMAP_CH0_CH1.loopSize[number - 1]]);
    this.loopInButton = new TNBSX1.LoopInButton([0x90, TNBSX1.BUTTONMAP_CH0_CH1.loopin[number - 1]]);
    this.loopOutButton = new TNBSX1.LoopOutButton([0x90, TNBSX1.BUTTONMAP_CH0_CH1.loopout[number - 1]]);
    this.autoLoopButton = new TNBSX1.AutoLoopButton([0x90, TNBSX1.BUTTONMAP_CH0_CH1.autoloop[number - 1]]);
    this.loopActiveButton = new TNBSX1.LoopActiveButton([0x90, TNBSX1.BUTTONMAP_CH0_CH1.loopactive[number - 1]]);
	
	// SX1 added tempo + - buttons for bpm_down
	this.tempoUpButton = new TNBSX1.tempoUpButton([0x90, TNBSX1.BUTTONMAP_CH0_CH1.tempoUp[number - 1]]);
    this.tempoDownButton = new TNBSX1.tempoDownButton([0x90, TNBSX1.BUTTONMAP_CH0_CH1.tempoDown[number - 1]]);
	
	// SX1 added loopSize Up/Down + - buttons 
	// UNSHIFT: Double/halve loop size
	// SHIFT: HotCue 1, 3 set/go
	// SHIFT: Unset HotCue 1, 3.
	this.loopSizeUpButton = new TNBSX1.loopSizeUpButton([0x90, TNBSX1.BUTTONMAP_CH0_CH1.loopSizeUp[number - 1]]);
    this.loopSizeDownButton = new TNBSX1.loopSizeDownButton([0x90, TNBSX1.BUTTONMAP_CH0_CH1.loopSizeDown[number - 1]]);	
	

    //effect assignment switches
    this.fx1AssignmentButton = new components.EffectAssignmentButton({
        midi: [0x90, TNBSX1.BUTTONMAP_CH0_CH1.fx1assign[number - 1]],
        effectUnit: 1,
        group: "[Channel" + number + "]",
    });
    this.fx2AssignmentButton = new components.EffectAssignmentButton({
        midi: [0x90, TNBSX1.BUTTONMAP_CH0_CH1.fx2assign[number - 1]],
        effectUnit: 2,
        group: "[Channel" + number + "]",
    });

    // high kill / quick effect enable button
    this.highKillQuickEffectButton = new TNBSX1.HighKillQuickEffectButton({
        midi: [0x90, TNBSX1.BUTTONMAP_CH0_CH1.highkill[number - 1]],
        channelNr: number,
    });


    // Set the group properties of the above Components and connect their output callback functions
    // Without this, the group property for each Component would have to be specified to its
    // constructor.
    this.reconnectComponents(function(component) {
        if (component.group === undefined) {
            // 'this' inside a function passed to reconnectComponents refers to the ComponentContainer
            // so 'this' refers to the custom Deck object being constructed
            component.group = this.currentDeck;
        }
    });
};

// give our custom Deck all the methods of the generic Deck in the Components library
TNBSX1.Deck.prototype = Object.create(components.Deck.prototype);

/* get/set Values */

TNBSX1.Deck.prototype.getValue = function(key) {
    return engine.getValue(this.group, key);
};

TNBSX1.Deck.prototype.setValue = function(key, value) {
    engine.setValue(this.group, key, value);
};

/* Load Track */

TNBSX1.LoadButton = function(options) {
    components.Button.call(this, options);
};
TNBSX1.LoadButton.prototype = new components.Button({
    outKey: "track_loaded",
    unshift: function() {
        this.inKey = "LoadSelectedTrack";
    },
    shift: function() {
        this.inKey = "eject";
    },
});

/* Cue & Play */

TNBSX1.Deck.prototype.isPlaying = function() {
    return this.getValue("play");
	console.log("isPlaying");
};

/* Pitch Bend / Track Search */

TNBSX1.BendMinusButton = function(options) {
    components.Button.call(this, options);
};
TNBSX1.BendMinusButton.prototype = new components.Button({
    key: "rate_temp_down",
    input: function(channel, control, value, status) {
        var isPlaying = engine.getValue(this.group, "play");
        if (isPlaying) {
            engine.setValue(this.group, "back", false);
            this.inSetValue(this.isPress(channel, control, value, status));
        } else {
            engine.setValue(this.group, "back", this.isPress(channel, control, value, status));
        }
    },
});

TNBSX1.BendPlusButton = function(options) {
    components.Button.call(this, options);
};
TNBSX1.BendPlusButton.prototype = new components.Button({
    key: "rate_temp_up",
    input: function(channel, control, value, status) {
        var isPlaying = engine.getValue(this.group, "play");
        if (isPlaying) {
            engine.setValue(this.group, "fwd", false);
            this.inSetValue(this.isPress(channel, control, value, status));
        } else {
            engine.setValue(this.group, "fwd", this.isPress(channel, control, value, status));
        }
    },
});

/* Jog Mode */

TNBSX1.JogModeSelector = function(number, searchMidiCtrl, scratchMidiCtrl, fxDryWetMidiCtrl) {
    this.number = number;
    this.searchMidiCtrl = searchMidiCtrl;
    this.scratchMidiCtrl = scratchMidiCtrl;
    this.fxDryWetMidiCtrl = fxDryWetMidiCtrl;
    this.jogMode = TNBSX1.JOGMODES.normal;
    this.lastNonTraxJogMode = this.jogMode;
    this.input = this.inputNormal;

    components.Component.call(this);
    this.updateControls();
};
TNBSX1.JogModeSelector.prototype = new components.Component({
    updateControls: function() {
        var searchValue = this.jogMode === TNBSX1.JOGMODES.search ? TNBSX1.MIDI_ON : TNBSX1.MIDI_OFF;
        var scratchValue = this.jogMode === TNBSX1.JOGMODES.vinyl ? TNBSX1.MIDI_ON : TNBSX1.MIDI_OFF;
        var fxDryWetValue = this.jogMode === TNBSX1.JOGMODES.fxdrywet ? TNBSX1.MIDI_ON : TNBSX1.MIDI_OFF;

        if (midi.sendShortMsg) {
            midi.sendShortMsg(0x90, this.searchMidiCtrl, searchValue);
            midi.sendShortMsg(0x90, this.scratchMidiCtrl, scratchValue);
            midi.sendShortMsg(0x90, this.fxDryWetMidiCtrl, fxDryWetValue);
        }
    },
    inputNormal: function(channel, control, value) {
        var isButtonPressed = TNBSX1.isButtonPressed(value);
        if (isButtonPressed) {
            switch (control) {
            case this.searchMidiCtrl:
                this.jogMode = this.jogMode === TNBSX1.JOGMODES.search ? TNBSX1.JOGMODES.normal : TNBSX1.JOGMODES.search;
                break;
            case this.scratchMidiCtrl:
                this.jogMode = this.jogMode === TNBSX1.JOGMODES.vinyl ? TNBSX1.JOGMODES.normal : TNBSX1.JOGMODES.vinyl;
                break;
            case this.fxDryWetMidiCtrl:
                this.jogMode = this.jogMode === TNBSX1.JOGMODES.fxdrywet ? TNBSX1.JOGMODES.normal : TNBSX1.JOGMODES.fxdrywet;
                break;
            default:
                TNBSX1.logError("Unexpected MIDI ctrl value: " + control);
            }
            if (this.jogMode !== TNBSX1.JOGMODES.vinyl && engine.isScratching(this.number)) {
                engine.scratchDisable(this.number, TNBSX1.JOG_SCRATCH_RAMP);
            }
            this.updateControls();
        }
    },
    inputTrax: function(channel, control, value) {
        var isButtonPressed = TNBSX1.isButtonPressed(value);
        if (isButtonPressed) {
            switch (control) {
            case this.searchMidiCtrl:
            case this.searchMidiCtrl + TNBSX1.SHIFT_OFFSET:
                engine.setValue("[Library]", "MoveRight", 1);
                break;
            case this.scratchMidiCtrl:
            case this.scratchMidiCtrl + TNBSX1.SHIFT_OFFSET:
                engine.setValue("[Library]", "MoveLeft", 1);
                break;
            case this.fxDryWetMidiCtrl:
            case this.fxDryWetMidiCtrl + TNBSX1.SHIFT_OFFSET:
                //'MoveFocusForward' is equivalent to pressing TAB key on the keyboard
                engine.setValue("[Library]", "MoveFocusForward", 1);
                break;
                /* The below code will probably be removed.
                   It allowed absolute referencing to buttons to enable
                   moving focus backward/forward. It seems that using only
                   'MoveFocusForward' is enough.

                case TNBSX1.BUTTONMAP_CH0_CH1.fxdrywet[0]:
                case TNBSX1.BUTTONMAP_CH0_CH1.fxdrywet[0] + TNBSX1.SHIFT_OFFSET:
                    engine.setValue('[Library]', 'MoveFocusBackward', 1);
                    break;
                case TNBSX1.BUTTONMAP_CH0_CH1.fxdrywet[1]:
                case TNBSX1.BUTTONMAP_CH0_CH1.fxdrywet[1] + TNBSX1.SHIFT_OFFSET:
                    engine.setValue('[Library]', 'MoveFocusForward', 1);
                    break;*/
            default:
                TNBSX1.logError("Unexpected MIDI ctrl value: " + control);
            }
        }
    },
    setTraxMode: function(isTraxModeEnabled) {
        if (isTraxModeEnabled) {
            if (this.jogMode !== TNBSX1.JOGMODES.trax) {
                this.lastNonTraxJogMode = this.jogMode;
                this.jogMode = TNBSX1.JOGMODES.trax;
                this.input = this.inputTrax;
                //set all LEDs on to indicate trax mode
                if (midi.sendShortMsg) {
                    midi.sendShortMsg(0x90, this.searchMidiCtrl, TNBSX1.MIDI_ON);
                    midi.sendShortMsg(0x90, this.scratchMidiCtrl, TNBSX1.MIDI_ON);
                    midi.sendShortMsg(0x90, this.fxDryWetMidiCtrl, TNBSX1.MIDI_ON);
                }
            }
        } else {
            this.jogMode = this.lastNonTraxJogMode;
            this.input = this.inputNormal;
            this.updateControls();
        }
    },
    unshift: function() {
        var isLibraryModeEnabled = engine.getValue("[Master]", "maximize_library");
        if (!isLibraryModeEnabled) {
            this.setTraxMode(false);
        }
    },
	// SX1: it seems than shift button set the trax jogwheel mode.
    shift: function() {
        var isLibraryModeEnabled = engine.getValue("[Master]", "maximize_library");
        if (!isLibraryModeEnabled) {
 //         this.setTraxMode(true);
            this.setTraxMode(false);
			this.jogMode = TNBSX1.JOGMODES.search;
        }
    },
});

/* Jog Wheel */

TNBSX1.Deck.prototype.onJogTouch = function(channel, control, value) {
    var currentJogMode =  this.jogModeSelector.jogMode;
    this.jogTouchState = TNBSX1.isButtonPressed(value);

    if (currentJogMode === TNBSX1.JOGMODES.vinyl && this.jogTouchState) {
        engine.scratchEnable(this.number,
            TNBSX1.JOG_RESOLUTION,
            TNBSX1.JOG_SCRATCH_RPM,
            TNBSX1.JOG_SCRATCH_ALPHA,
            TNBSX1.JOG_SCRATCH_BETA,
            TNBSX1.JOG_SCRATCH_RAMP);
    } else if (!this.jogTouchState && engine.isScratching(this.number)) {
        engine.scratchDisable(this.number, TNBSX1.JOG_SCRATCH_RAMP);
    }
};

TNBSX1.Deck.prototype.onJogSpin = function(channel, control, value) {
    var currentJogMode =  this.jogModeSelector.jogMode;
	TNBSX1.logDebug("SX1 DEBUG: value for currentJogMode: " + currentJogMode);
    var jogDelta = TNBSX1.getJogDeltaValue(value);
	TNBSX1.logInfo("SX1 value for jogSpin: " + value);
	TNBSX1.logInfo("SX1 value for jogDelta: " + jogDelta);

    if (currentJogMode === TNBSX1.JOGMODES.vinyl) {
        engine.scratchTick(this.number, jogDelta);
    } else if (currentJogMode === TNBSX1.JOGMODES.fxdrywet) {
        var currMixValue = engine.getParameter("[EffectRack1_EffectUnit" + this.number + "]", "mix");
        engine.setParameter("[EffectRack1_EffectUnit" + this.number + "]", "mix", currMixValue + jogDelta / TNBSX1.JOG_RESOLUTION);
    } else if (currentJogMode === TNBSX1.JOGMODES.search) {
        var playPos = engine.getValue(this.group, "playposition");
        if (undefined !== playPos) {
            var seekPos = playPos + (jogDelta / (TNBSX1.JOG_RESOLUTION * TNBSX1.JOG_SEEK_REVOLUTIONS));
            this.setValue("playposition", Math.max(0.0, Math.min(1.0, seekPos)));
        }
    } else if (currentJogMode === TNBSX1.JOGMODES.trax) {
        engine.setValue("[Library]", "MoveVertical", jogDelta);
    } else if (currentJogMode === TNBSX1.JOGMODES.normal) {
        var normalizedDelta = jogDelta / TNBSX1.MIDI_JOG_DELTA_RANGE;
        var scaledDelta;
        var jogExponent;
        if (this.isPlaying()) {
            // bending
            scaledDelta = normalizedDelta / TNBSX1.JOG_SPIN_PLAY_PEAK;
            jogExponent = TNBSX1.JOG_SPIN_PLAY_EXPONENT;
        } else {
            // cueing
            scaledDelta = normalizedDelta / TNBSX1.JOG_SPIN_CUE_PEAK;
            jogExponent = TNBSX1.JOG_SPIN_CUE_EXPONENT;
        }
        var direction;
        var scaledDeltaAbs;
        if (scaledDelta > 0.0) {
            direction = 1.0;
            scaledDeltaAbs = scaledDelta;
        } else {
            direction = -1.0;
            scaledDeltaAbs = -scaledDelta;
        }
        var scaledDeltaPow = direction * Math.pow(scaledDeltaAbs, jogExponent);
        var jogValue = TNBSX1.MIXXX_JOG_RANGE * scaledDeltaPow;
        this.setValue("jog", jogValue);
		TNBSX1.logInfo("SX1 value for scaledDelta: " + scaledDelta);
		TNBSX1.logInfo("SX1 value for direction: " + direction);
		TNBSX1.logInfo("SX1 setting jogValue as: " + TNBSX1.MIXXX_JOG_RANGE + " * " + scaledDeltaPow + " = " + jogValue);
		
    } else {
        TNBSX1.logError("onJogSpin unknown mode error!");
    }
};


////////////////////////////////////////////////////////////////////////
// Effects                                                            //
////////////////////////////////////////////////////////////////////////

//functions for overriding default unshift/shift functions of efx unit knobs
TNBSX1.efxUnitKnobUnshift = function() {
    this.input = function(channel, control, value) {
        var knobDelta = TNBSX1.getKnobDelta(value);
        this.inSetParameter(this.inGetParameter() + knobDelta / TNBSX1.MIDI_KNOB_STEPS);
    };
};
TNBSX1.efxUnitKnobShift = function() {
    this.input = function(channel, control, value) {
        var knobDelta = TNBSX1.getKnobDelta(value);
        var effectGroup = "[EffectRack1_EffectUnit" +
                            this.eu.currentUnitNumber + "_Effect" +
                            this.number + "]";
        engine.setValue(effectGroup, "effect_selector", knobDelta);
    };
};

//note: the shifted dry/wet knob is mapped to beatloop size


////////////////////////////////////////////////////////////////////////
// Quick Effects                                                      //
////////////////////////////////////////////////////////////////////////

/* HIGH kill / QuickEffect enable button */

TNBSX1.HighKillQuickEffectButton = function(options) {
    this.channelNr = options.channelNr;
    components.Button.call(this, options);
};
TNBSX1.HighKillQuickEffectButton.prototype = new components.Button({
    type: components.Button.prototype.types.powerWindow,
    unshift: function() {
        this.disconnect();
        this.group = "[EqualizerRack1_[Channel" + this.channelNr + "]_Effect1]";
        this.inKey = "button_parameter3";
        this.outKey = "button_parameter3";
        this.connect();
        this.trigger();
    },
    shift: function() {
        this.disconnect();
        this.group = "[QuickEffectRack1_[Channel" + this.channelNr + "]_Effect1]";
        this.inKey = "enabled";
        this.outKey = "enabled";
        this.connect();
        this.trigger();
    },
});


////////////////////////////////////////////////////////////////////////
// Library                                                            //
////////////////////////////////////////////////////////////////////////

/* Trax knob */

TNBSX1.TraxKnob = function(options) {
    components.Encoder.call(this, options);
};
TNBSX1.TraxKnob.prototype = new components.Encoder({
    group: "[Library]",
    unshift: function() {
        this.inKey = "MoveVertical";
		console.log("move vertical");
    },
    shift: function() {
        this.inKey = "ScrollVertical";
		console.log("SCROLL vertical");
    },
    input: function(channel, control, value) {
        var knobDelta = TNBSX1.getKnobDelta(value);
        this.inSetValue(knobDelta);
		console.log("browse encoder: " + knobDelta);		
    }
});

/* Trax button */

TNBSX1.TraxButton = function(obj) {
    this.detectedDecks = [];
    /* group and/or outKey cannot be defined at prototype initialization
       (inside anonymous object passed to components.Button constructor
       below) as this would cause additional premature engine.makeConnection
       call that binds prototype object's output callback to the outKey.
       This would cause uncaught exception when invoking the callback:

       "TypeError: Result of expression 'this.detectedDecks' [undefined] is not an object"

       which happens because at the time we create the prototype object,
       we have no information yet about detectedDecks, as detectedDecks is
       created at new TraxButton object construction, when its prototype is
       long time existing. */
    this.group = "[Master]";
    this.outKey = "maximize_library";

    this.detectDecks(obj);
    components.Button.call(this);
};
TNBSX1.TraxButton.prototype = new components.Button({
    unshift: function() {
        this.type = components.Button.prototype.types.toggle;
        this.group = "[Master]";
        this.inKey = "maximize_library";
    },
    shift: function() {
        this.type = components.Button.prototype.types.push;
        this.group = "[Library]";
        this.inKey = "MoveFocusForward";
    },
    output: function(value) {
        this.updateTraxMode(value);
    },
    updateTraxMode: function(mode) {
        this.detectedDecks.forEach(function(deck) {
            deck.jogModeSelector.setTraxMode(mode);
        });
    },
    detectDecks: function(obj) {
        // find decks in the passed object and store them in the array
        for (var memberName in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, memberName) && obj[memberName] instanceof components.Deck) {
                TNBSX1.logDebug("Detected " + memberName);
                this.detectedDecks.push(obj[memberName]);
            }
        }
    },
});

/* Trax container */

TNBSX1.Trax = function(obj) {
    this.traxKnob = new TNBSX1.TraxKnob();
    this.traxButton = new TNBSX1.TraxButton(obj);
};
TNBSX1.Trax.prototype = new components.ComponentContainer();


////////////////////////////////////////////////////////////////////////
// Mixxx Callback Functions                                           //
////////////////////////////////////////////////////////////////////////

TNBSX1.init = function(id, debug) {
    TNBSX1.id = id;
    TNBSX1.debug = debug;

    TNBSX1.logInfo("Initializing controller");

    // left and right shift button
    TNBSX1.leftShiftButton = new TNBSX1.ShiftButton([0x90, 0x33]);
    TNBSX1.rightShiftButton = new TNBSX1.Shift2Button([0x90, 0x3c]);

    // left and right deck
    TNBSX1.leftDeck = new TNBSX1.Deck(1);
    TNBSX1.rightDeck = new TNBSX1.Deck(2);

    // effect unit 1
    TNBSX1.fx1 = new components.EffectUnit(1);
    TNBSX1.fx1.EffectUnitKnob.prototype.unshift = TNBSX1.efxUnitKnobUnshift;
    TNBSX1.fx1.EffectUnitKnob.prototype.shift = TNBSX1.efxUnitKnobShift;
    TNBSX1.fx1.EffectUnitKnob.prototype.eu = TNBSX1.fx1;    // hack for use by reimplemented unshift/shift
    TNBSX1.fx1.enableButtons[1].midi = [0x90, 0x07];
    TNBSX1.fx1.enableButtons[2].midi = [0x90, 0x00]; // removed for conflict: [0x90, 0x0C];
    TNBSX1.fx1.enableButtons[3].midi = [0x90, 0x09];
    TNBSX1.fx1.knobs[1].midi = [0xB0, 0x07];
    TNBSX1.fx1.knobs[2].midi = [0xB0, 0x08];
    TNBSX1.fx1.knobs[3].midi = [0xB0, 0x09];
    TNBSX1.fx1.dryWetKnob.midi = [0xB0, 0x0A];
    TNBSX1.fx1.dryWetKnob.input = TNBSX1.knobInput;
    TNBSX1.fx1.effectFocusButton.midi = [0x90, 0x00]; // removed (conflict) [0x90, 0x0E]
    // We need to call unshift() again for each EffectUnitKnob as we
    // swapped its implementation after fx object construction (when
    // it is called automatically)
    for (var n = 1; n <= 3; n++) {
        TNBSX1.fx1.knobs[n].unshift();
    }
    // Now init the fx unit
    TNBSX1.fx1.init();

    // effect unit 2
    TNBSX1.fx2 = new components.EffectUnit(2);
    TNBSX1.fx2.EffectUnitKnob.prototype.unshift = TNBSX1.efxUnitKnobUnshift;
    TNBSX1.fx2.EffectUnitKnob.prototype.shift = TNBSX1.efxUnitKnobShift;
    TNBSX1.fx2.EffectUnitKnob.prototype.eu = TNBSX1.fx2;    // hack for use by reimplemented unshift/shift
    TNBSX1.fx2.enableButtons[1].midi = [0x90, 0x48];
    TNBSX1.fx2.enableButtons[2].midi = [0x90, 0x43];
    TNBSX1.fx2.enableButtons[3].midi = [0x90, 0x9A];
    TNBSX1.fx2.knobs[1].midi = [0xB0, 0x44];
    TNBSX1.fx2.knobs[2].midi = [0xB0, 0x43];
    TNBSX1.fx2.knobs[3].midi = [0xB0, 0x00]; // removed (conflict) [0xB0, 0x46];
    TNBSX1.fx2.dryWetKnob.midi = [0xB0, 0x45];
    TNBSX1.fx2.dryWetKnob.input = TNBSX1.knobInput;
    TNBSX1.fx2.effectFocusButton.midi = [0x90, 0x45];
    // We need to call unshift() again for each EffectUnitKnob as we
    // swapped its implementation after fx object construction (when
    // it is called automatically)
    for (n = 1; n <= 3; n++) {
        TNBSX1.fx2.knobs[n].unshift();
    }
    // Now init the fx unit
    TNBSX1.fx2.init();

    // Trax/library
    TNBSX1.trax = new TNBSX1.Trax(TNBSX1);

    // connect decks, efx units and trax to shift buttons
    TNBSX1.leftShiftButton.connectContainer(TNBSX1.leftDeck);
	TNBSX1.leftShiftButton.connectContainer(TNBSX1.rightDeck);
    TNBSX1.leftShiftButton.connectContainer(TNBSX1.fx1);
    TNBSX1.leftShiftButton.connectContainer(TNBSX1.trax);
//    TNBSX1.rightShiftButton.connectContainer(TNBSX1.rightDeck);

    TNBSX1.rightShiftButton.connectContainer(TNBSX1.fx2);
    TNBSX1.rightShiftButton.connectContainer(TNBSX1.trax);
};

TNBSX1.shutdown = function() {
    TNBSX1.logInfo("Shutting down controller");
};
