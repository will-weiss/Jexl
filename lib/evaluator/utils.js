var Relay = require('../Relay');

/**
 * Consumes an Relay, return a promise that resolves with an array of
 * values from each of the 'data' events after a final 'end' event.
 * @param {{Relay}} emitter An instance of Relay
 * @returns {Promise<{}>} resolves with an array of results;
 */
exports.consume = function(obj) {
	return Promise.resolve(obj).then(function(res) {
		if (res instanceof Relay)
			return res.value().then(exports.consume);
		else if (Array.isArray(res))
			return Promise.all(res.map(exports.consume));
		else
			return res;
	});
};

exports.partialConsume = function(obj) {
	return Array.isArray(obj) ? Promise.all(obj) : Promise.resolve(obj);
};

exports.pending = function() {
	var deferred = {};
	deferred.promise = new Promise(function(resolve, reject) {
		deferred.resolve = resolve;
		deferred.reject = reject;
	});
	return deferred;
};
