var EventEmitter = require('events').EventEmitter;
var util = require('util');
var temporal = require('temporal');

/**
 * pid-controller -  A node advanced PID controller based on the Arduino PID library
 * github@wilberforce.co.nz Rhys Williams
 * Based on:
 * Arduino PID Library - Version 1.0.1
 * by Brett Beauregard <br3ttb@gmail.com> brettbeauregard.com
 *
 * This Library is licensed under a GPL-3.0 License
 *
 * @param {Object} opts Options: kp, ki, pd, dt, initial, target, u_bound, l_bound, direction, mode
 *
 * direction 'direct' or 'reverse'
 * mode: 'auto' or 'manual'
 *
 */

"use strict";
var PID = function(opts) {
  this.setTimeInterval(opts.dt || 1000);
  this.setControllerDirection(opts.direction || 'reverse');
  this.setTuning(opts.kp || 0.5, opts.ki || 0.5, opts.kd || 10);
  this.setInput(opts.initial || 0);
  this.setTarget(opts.target || 0);
  this.setOutputLimits(opts.l_bound || 0, opts.u_bound || 100); // default output limits
  this.setMode(opts.mode || 'auto');

  this.reset()
};

util.inherits(PID, EventEmitter);

// Constants for backward compatibility
PID.AUTOMATIC = 1;
PID.MANUAL = 0;
PID.DIRECT = 'direct';
PID.REVERSE = 'reverse';

PID.prototype.setInput = function(current_value) {
  this.input = current_value;
};

PID.prototype.setTarget = function(current_value) {
  this.mySetpoint = current_value;
};

PID.prototype.millis = function() {
  var d = new Date();
  return d.getTime();
};

PID.prototype.reset = function() {
  this.totalError = 0;
  this.lastInput = this.input;
  this.myOutput = 0
  this.lastTime = this.millis() - this.SampleTime;
}

/**
 * Compute()
 * This, as they say, is where the magic happens.  this function should be called
 * every time "void loop()" executes.  the function will decide for itself whether a new
 * pid Output needs to be computed.  returns true when the output is computed,
 * false when nothing has been done.
 */
PID.prototype.compute = function() {
  if (!this.inAuto) {
    return false;
  }
  var now = this.millis();
  var timeChange = (now - this.lastTime);
  if (timeChange >= this.SampleTime) {

    // Compute all the working error variables
    var input = this.input;
    var error = this.mySetpoint - input;
    var dInput = input - this.lastInput;
    this.totalError += (this.ki * error);

    if (this.outMax !== undefined && this.totalError > this.outMax) this.totalError = this.outMax;
    else if (this.outMin !== undefined && this.totalError < this.outMin) this.totalError = this.outMin;

    // Compute PID Output
    // P: this.kp * error
    var output = error / this.kp * 100 + this.totalError - this.kd * dInput;

    if (this.outMax !== undefined && output > this.outMax) output = this.outMax;
    else if (this.outMin !== undefined && output < this.outMin) output = this.outMin;

    this.myOutput = output;

    // Remember some variables for next time
    this.lastInput = input;
    this.lastTime = now;

    // Emit computed output
    this.emit('output', output);
  }
};

/**
 * setTuning(...)
 * This function allows the controller's dynamic performance to be adjusted.
 * it's called automatically from the constructor, but tunings can also
 * be adjusted on the fly during normal operation
 */
PID.prototype.setTuning = function(Kp, Ki, Kd) {
  if (Kp < 0 || Ki < 0 || Kd < 0) {
    return;
  }

  this.dispKp = Kp;
  this.dispKi = Ki;
  this.dispKd = Kd;

  this.SampleTimeInSec = (this.SampleTime) / 1000;
  this.kp = Kp;
  this.ki = Ki * this.SampleTimeInSec;
  this.kd = Kd / this.SampleTimeInSec;

  this.kp = Math.abs(this.kp) * this.controllerDirection;
  this.ki = Math.abs(this.ki) * this.controllerDirection;
  this.kd = Math.abs(this.kd) * this.controllerDirection;
};

/**
 * setTimeInterval(...)
 * sets the period, in Milliseconds, at which the calculation is performed
 */
PID.prototype.setTimeInterval = function(NewSampleTime) {
  if (NewSampleTime > 0) {
    var ratio = NewSampleTime / (1.0 * this.SampleTime);
    this.ki *= ratio;
    this.kd /= ratio;
    this.SampleTime = Math.round(NewSampleTime);
  }
};

/**
 * SetOutput( )
 * Set output level if in manual mode
 */
PID.prototype.setOutput = function(val) {
  if (val > this.outMax) {
    this.myOutput = val;
  } else if (val < this.outMin) {
    val = this.outMin;
  }
  this.myOutput = val;
};

/**
 * SetOutputLimits(...)
 * This function will be used far more often than SetInputLimits.  while
 * the input to the controller will generally be in the 0-1023 range (which is
 * the default already,)  the output will be a little different.  maybe they'll
 * be doing a time window and will need 0-8000 or something.  or maybe they'll
 * want to clamp it from 0-125.  who knows.  at any rate, that can all be done here.
 */
PID.prototype.setOutputLimits = function(Min, Max) {
  if (Min >= Max) {
    return;
  }
  this.outMin = Min;
  this.outMax = Max;

  if (this.inAuto) {
    if (this.myOutput > this.outMax) {
      this.myOutput = this.outMax;
    } else if (this.myOutput < this.outMin) {
      this.myOutput = this.outMin;
    }

    if (this.totalError > this.outMax) {
      this.totalError = this.outMax;
    } else if (this.totalError < this.outMin) {
      this.totalError = this.outMin;
    }
  }
};

/**
 * SetMode(...)
 * Allows the controller Mode to be set to manual (0) or Automatic (non-zero)
 * when the transition from manual to auto occurs, the controller is
 * automatically initialized
 */
PID.prototype.setMode = function(Mode) {
  var newAuto;
  if (Mode == PID.AUTOMATIC || Mode.toString().toLowerCase() == 'automatic' || Mode.toString().toLowerCase() == 'auto') {
    newAuto = 1;
  } else if (Mode == PID.MANUAL || Mode.toString().toLowerCase() == 'manual') {
    newAuto = 0;
  } else {
    throw new Error("Incorrect Mode Chosen");
  }

  if (newAuto == !this.inAuto) { //we just went from manual to auto
    this.initialize();
  }
  this.inAuto = newAuto;
};

/**
 * Initialize()
 * does all the things that need to happen to ensure a bumpless transfer
 * from manual to automatic mode.
 */
PID.prototype.initialize = function() {
  this.totalError = this.myOutput;
  this.lastInput = this.input;
  if (this.totalError > this.outMax) {
    this.totalError = this.outMax;
  } else if (this.totalError < this.outMin) {
    this.totalError = this.outMin;
  }
};

/**
 * SetControllerDirection(...)
 * The PID will either be connected to a DIRECT acting process (+Output leads
 * to +Input) or a REVERSE acting process(+Output leads to -Input.)  we need to
 * know which one, because otherwise we may increase the output when we should
 * be decreasing.  This is called from the constructor.
 */
PID.prototype.setControllerDirection = function(ControllerDirection) {
  if (ControllerDirection == 0 || ControllerDirection.toString().toLowerCase() == 'direct') {
    this.controllerDirection = -1;
  } else if (ControllerDirection == 1 || ControllerDirection.toString().toLowerCase() == 'reverse') {
    this.controllerDirection = 1;
  } else {
    throw new Error("Incorrect Controller Direction Chosen");
  }

  this.kp = Math.abs(this.kp) * this.controllerDirection;
  this.ki = Math.abs(this.ki) * this.controllerDirection;
  this.kd = Math.abs(this.kd) * this.controllerDirection;
};

/**
 * Status Functions
 * Just because you set the Kp=-1 doesn't mean it actually happened.  these
 * functions query the internal state of the PID.  they're here for display
 * purposes.  this are the functions the PID Front-end uses for example
 */
PID.prototype.getKp = function() {
  return this.dispKp;
};

PID.prototype.getKd = function() {
  return this.dispKd;
};

PID.prototype.getKi = function() {
  return this.dispKi;
};

PID.prototype.getMode = function() {
  return this.inAuto
    ? "Auto"
    : "Manual";
};

PID.prototype.getTimeInterval = function() {
  return this.SampleTime;
};

PID.prototype.getDirection = function() {
  return this.controllerDirection;
};

PID.prototype.getOutput = function() {
  return this.myOutput;
};

PID.prototype.getInput = function() {
  return this.input;
};

PID.prototype.getSetpoint = function() {
  return this.mySetpoint;
};

PID.prototype.startLoop = function() {
  var me = this;
  this.loop = temporal.loop(this.SampleTime, function() {
    me.compute();
  });
};

PID.prototype.stopLoop = function() {
  if (this.loop !== undefined) { this.loop.stop(); }
};

module.exports = PID;
