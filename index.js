var Service, Characteristic;
var pollingtoevent = require("polling-to-event");
const { getAccessToken, getServices, getStatus, setStatus } = require('yalealarmsystem');

module.exports = function(homebridge){
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory("homebridge-YaleSmartHomeAlarm", "YaleAlarmSystem", YaleAlarmSystem);
};


/**
 * The main class acting as the Security System Accessory
 *
 * @param log The logger to use
 * @param config The config received from HomeBridge
 * @constructor
 */
function YaleAlarmSystem(log, config) {
	var self = this;
	self.log = log;
	self.name = config["name"];
	this.config = config;
	self.statecons = 0;

	// the service
	self.securityService = null;

	// polling settings
	self.polling = config.polling || true;
	self.pollInterval = config.pollInterval || 30000;

	// debug flag
	self.debug = config.debug || false;

	// cached values
	self.previousCurrentState = null;
	self.previousTargetState = null;

	// initialize
	self.init();

}

YaleAlarmSystem.prototype.init = function() {
	var self = this;

	// set up polling if requested
	if (self.polling) {
		self.log("Starting polling with an interval of %s ms", self.pollInterval);
		var emitter = pollingtoevent(function (done) {
			self.getCurrentState(function (err, result) {
				done(err, result);
			});
		}, { longpolling: true, interval: self.pollInterval });

		emitter.on("longpoll", function (state) {
			self.log("Polling noticed status change to %s, notifying devices", state);
			self.securityService
				.getCharacteristic(Characteristic.SecuritySystemCurrentState)
				.setValue(state);
		});

		emitter.on("err", function(err) {
			self.log("Polling failed, error was %s", err);
		});
	}
};


/**
 * Logs a message to the HomeBridge log
 *
 * Only logs the message if the debug flag is on.
 */
YaleAlarmSystem.prototype.debugLog = function () {
	if (this.debug) {
		this.log.apply(this, arguments);
	}
};

/**
 * Sets the target state of the security device to a given state
 *
 * @param state The state to set
 * @param callback Callback to call with the result
 */
YaleAlarmSystem.prototype.setTargetState = function(state, callback) {
	var self = this;
	switch (state) {
	        case 3:
				alarmState = "disarm";
				break;
			case 1:
				alarmState = "arm";
				break;
			case 0:
				alarmState = "home";
				break;
			case 2:
				alarmState = "home";
				break;
        }
	this.log("Setting state to %s", alarmState);

	getAccessToken(
        this.config.username,
        this.config.password
    ).then((accessToken) => {
				getServices(accessToken);
				setStatus(accessToken, alarmState).then(setStatus => {
					this.log("Status set: %s",setStatus);
				});
        callback(null);

    }).catch(console.log);
};

//
/**
 * Gets the current state of the security system
 *
 * @param {Function} callback The method to call with the results
 */
 YaleAlarmSystem.prototype.getCurrentState = function(callback) {
 	var self = this;
 	this.debugLog("Getting current state");
	getAccessToken(
        this.config.username,
        this.config.password
    ).then(access_token => {
  		getServices(access_token);
  		getStatus(access_token).then(alarmState => {
					console.log(alarmState);
					switch (alarmState) {
 	        	case "disarm":
 							state = 3;
 							break;
 						case "arm":
 							state = 1;
 							break;
 						case "home":
 							state = 0;
 							break;
         }
         callback(null,state);
     }).catch(console.log);
	 });
 };

/**
 * Identifies the security device (?)
 *
 * @param {Function} callback The method to call with the results
 */
YaleAlarmSystem.prototype.identify = function(callback) {
	this.log("Identify requested!");
	callback();
};

/**
 * Returns the services offered by this security device
 *
 * @returns {Array} The services offered
 */
YaleAlarmSystem.prototype.getServices =  function() {
	this.securityService = new Service.SecuritySystem(this.name);

	this.securityService
		.getCharacteristic(Characteristic.SecuritySystemCurrentState)
		.on("get", this.getCurrentState.bind(this));

	this.securityService
		.getCharacteristic(Characteristic.SecuritySystemTargetState)
		.on("get", this.getCurrentState.bind(this))
		.on("set", this.setTargetState.bind(this));

	this.infoService = new Service.AccessoryInformation();
    this.infoService
      .setCharacteristic(Characteristic.Manufacturer, "Opensource Community")
      .setCharacteristic(Characteristic.Model, "Yale Security System")
      .setCharacteristic(Characteristic.SerialNumber, "Version 0.0.1");
      //.setCharacteristic(Characteristic.Firmware, "0.0.1");

	return [ this.infoService, this.securityService ];
};
