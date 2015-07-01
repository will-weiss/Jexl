var Flood = require('../Flood');

/**
 * Consumes an Flood, return a promise that resolves with an array of
 * values from each of the 'data' events after a final 'end' event.
 * @param {{Flood}} emitter An instance of Flood
 * @returns {Promise<{}>} resolves with an array of results;
 */
exports.consume = function(obj) {
	if (obj instanceof Flood)
		return obj.value.then(exports.consume);
	else if (Array.isArray(obj))
		return Promise.all(obj.map(exports.consume));
	return Promise.resolve(obj);
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
