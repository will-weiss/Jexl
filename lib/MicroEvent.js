var MicroEvent = function() {
	this._events = {};
};

MicroEvent.prototype.on = function(event, fct) {
	this._events[event] = this._events[event] || [];
	this._events[event].push(fct);
};

MicroEvent.prototype.removeListener = function(event, fct) {
	if (event in this._events)
		this._events[event].splice(this._events[event].indexOf(fct), 1);
};

MicroEvent.prototype.emit = function(event) {
	if (event in this._events) {
		var args = Array.prototype.slice.call(arguments, 1);
		this._events[event].forEach(function(fct) {
			fct.apply(this, args);
		}, this);
	}
};

module.exports = MicroEvent;
