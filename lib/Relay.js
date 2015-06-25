function Node(value, key) {
	this.value = value;
	this.key = key;
};

Node.prototype.push = function(value, key) {
	return this.next = new Node(value, key);
};

function Listener(relay, initValue, onData, onEnd) {
	this.relay = relay;
	this.value = initValue;
	this.onData = onData;
	this.onEnd = onEnd;
	this.relay._head
		? this.start()
		: this.resume = this.start, this.pend();
};

Listener.prototype.end = function(err) {
	this.resume = this.end = function noop() {};
	return this.onEnd(err);
};

Listener.prototype.pend = function() {
	return this.relay._pendingListeners.push(this);
};

Listener.prototype.dequeue = function() {
	return Promise.resolve(this.node.value)
		.then(this.onData.bind(this, this.node.key))
		.then(this.after.bind(this), this.end.bind(this));
};

Listener.prototype.after = function() {
	return this.node.next ?
		this.resume()
	: this.relay._ended ?
		this.end(this.relay._error)
	: this.pend();
};

Listener.prototype.start = function() {
	this.node = this.relay._head;
	this.resume = this.next;
	return this.dequeue();
};

Listener.prototype.next = function() {
	this.node = this.node.next;
	return this.dequeue();
};

function Relay(valueCtor, listenerOnData) {
	this._pendingListeners = [];
	Object.defineProperty(this, 'value', {
		get: function() {
			var value = this.consume(listenerOnData, new valueCtor);
			this.value = value;
			return value;
		}
	});
};

Relay.from = function(from) {
	if (from instanceof Relay)
		return from;
	var relay;
	if (Array.isArray(from)) {
		relay = new ArrayRelay
		from.forEach(relay.push.bind(relay));
	} else {
		relay = new ObjectRelay
		Object.keys(from).forEach(function(key) {
			relay.push(from[key], key);
		});
	}
	relay.end();
	return relay;
};

Relay.subClass = function(ctor) {
	ctor.prototype = Object.create(Relay.prototype);
	ctor.prototype.constructor = ctor;
};

Relay.prototype.then = function(onResolve, onReject) {
	return this.value.then(onResolve, onReject);
};

Relay.prototype.catch = function(onReject) {
	return this.then.call(this, undefined, onReject);
};

Relay.prototype.revive = function(fn, arg) {
	while (this._pendingListeners.length)
		this._pendingListeners.pop()[fn](arg);
};

Relay.prototype._push = function(value, key) {
	this._push = this._tailPush;
	return this._head = new Node(value, key);
};

Relay.prototype._tailPush = function(value, key) {
	return this._tail.push(value, key);
};

Relay.prototype.push = function(value, key) {
	this._tail = this._push(value, key);
	this.revive('resume');
};

Relay.prototype.end = function(err) {
	this.push = this.end = function noop() {};
	this._ended = true;
	if (err)
		this._error = err;
	this.revive('end', err);
};

Relay.prototype.link = function(onData) {
	return new Listener(this, new this.constructor, onData, function onEnd(err) {
		this.value.end(err);
	}).value;
};

Relay.prototype.consume = function(onData, initValue) {
	return new Promise((function(resolve, reject) {
		new Listener(this, initValue, onData, function onEnd(err) {
			return err ? reject(err) : resolve(this.value);
		});
	}).bind(this));
};

Relay.prototype.map = function(lambda) {
	return this.link(function onData(key, value) {
		this.value.push(lambda(value, key), key);
	});
};

Relay.prototype.filter = function(predicate) {
	return this.link(function onData(key, value) {
		return Promise.resolve(predicate(value, key)).then((function(res) {
			if (res)
				this.value.push(value, key)
		}).bind(this));
	});
};

Relay.prototype.find = function(predicate) {
	return this.consume(function onData(key, value) {
		return Promise.resolve(predicate(value, key)).then((function(res) {
			if (res) {
				this.value = value;
				this.end();
			}
		}).bind(this));
	});
};

Relay.prototype.reduce = function(lambda, accumulator) {
	return this.consume(function(key, value) {
		return Promise.resolve(this.value).then((function(accumulator) {
			this.value = lambda(accumulator, value, key);
		}).bind(this));
	}, accumulator);
};

Relay.prototype.concat = function(obj) {
	var result = new this.constructor,
		push = result.push.bind(result);
	new Listener(this, result, push, function onEnd(err) {
		return err ? result.end(err) : Relay.from(obj).map(push)
			.then(result.end.bind(result, null), result.end.bind(result));
	});
	return result;
};

function ArrayRelay() {
	this.length = 0;
	Relay.call(this, Array, function onData(key, value) {
		this.value.push(value);
	});
};

Relay.subClass(ArrayRelay);

ArrayRelay.prototype.push = function(value) {
	Relay.prototype.push.call(this, value, this.length++);
};

function ObjectRelay() {
	Relay.call(this, Object, function onData(key, value) {
		this.value[key] = value;
	});
};

Relay.subClass(ObjectRelay);

module.exports = Relay;
module.exports.Array = ArrayRelay;
module.exports.Object = ObjectRelay;
