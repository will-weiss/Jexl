function Node(value, key) {
	this.value = value;
	this.key = key || 0;
};

Node.prototype.push = function(value, key) {
	return this.next = new Node(value, key || this.key + 1);
};

function Listener(relay) {
	this._ended = false;
	this.relay = relay;
};

Listener.prototype.error = function(err) {
	this._ended = true;
	return this.onErr(err);
};

Listener.prototype.end = function() {
	this._ended = true;
	return this.onEnd();
};

Listener.prototype.pend = function() {
	return this.relay._pendingListeners.push(this);
};

Listener.prototype.dequeue = function() {
	return Promise.resolve(this.node.value).then(
			(function(res) {
				return this.onData(res, this.node.key);
			}).bind(this)
		).then(this.after.bind(this), this.error.bind(this));
};

Listener.prototype.after = function() {
	return this.relay._error ?
		this.error(this.relay._error)
	: this._ended ?
		void 0
	: this.node.next ?
		this.next()
	: this.relay._alive ?
		this.pend()
	: this.end();
};

Listener.prototype.start = function() {
	if (!this.relay._head)
		return this.pend();
	this.node = this.relay._head;
	return this.dequeue();
};

Listener.prototype.next = function() {
	this.node = this.node.next;
	return this.dequeue();
};

Listener.prototype.resume = function() {
	return this.node ? this.next() : this.start();
};

function Relay() {
	this._alive = true;
	this._pendingListeners = [];
};

Relay.prototype.revive = function(fn) {
	var args = Array.prototype.slice.call(arguments, 1);
	while (this._pendingListeners.length) {
		var listener = this._pendingListeners.shift();
		listener[fn].apply(listener, args);
	}
};

Relay.prototype.push = function(value, key) {
	if (!this._alive)
		return;
	if (this._tail)
		this._tail = this._tail.push(value, key);
	else
		this._head = this._tail = new Node(value, key);
	this.revive('resume');
};

Relay.prototype.error = function(err) {
	this._alive = false;
	this._error = err;
	this.revive('error', err);
};

Relay.prototype.end = function() {
	this._alive = false;
	this.revive('end');
};

Relay.prototype.map = function(lambda) {
	var relay = new this.constructor,
		listener = new Listener(this);
	listener.onData = function(val, key) {
		relay.push(lambda(val, key), key);
	};
	listener.onErr = function(err) {
		relay.error(err);
	};
	listener.onEnd = function() {
		relay.end();
	};
	listener.start();
	return relay;
};

Relay.prototype.filter = function(predicate) {
	var relay = new this.constructor,
		listener = new Listener(this);
	listener.onData = function(val, key) {
		return Promise.resolve(predicate(val, key))
			.then(function(res) {
				if (res)
					relay.push(val, key);
			});
	};
	listener.onErr = function(err) {
		return relay.error(err);
	};
	listener.onEnd = function() {
		return relay.end();
	};
	listener.start();
	return relay;
};

Relay.prototype.find = function(predicate) {
	var listener = new Listener(this);
	listener.onData = function(val, key) {
		return Promise.resolve(predicate(val, key))
			.then(function(res) {
				if (res) {
					listener.result = val;
					listener.end();
				}
			});
	};
	return new Promise(function(resolve, reject) {
		listener.onErr = reject;
		listener.onEnd = function() {
			resolve(listener.result);
		};
		listener.start();
	});
};

Relay.prototype.reduce = function(lambda, accumulator) {
	var listener = new Listener(this);
	listener.accumulator = accumulator;
	listener.onData = function(val, key) {
		return Promise.resolve(listener.accumulator)
			.then(function(accumulator) {
				listener.accumulator = lambda(accumulator, val, key);
			});
	};
	return new Promise(function(resolve, reject) {
		listener.onErr = reject;
		listener.onEnd = function() {
			resolve(listener.accumulator);
		};
		listener.start();
	});
};

Relay.from = function(from, end) {
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
	if (end)
		relay.end();
	return relay;
};

Relay.subClass = function(ctor) {
	ctor.prototype = Object.create(Relay.prototype);
	ctor.prototype.constructor = ctor;
};

function ArrayRelay() {
	Relay.call(this);
};

Relay.subClass(ArrayRelay);

ArrayRelay.prototype.value = function() {
	var results = [],
		listener = new Listener(this);
	listener.onData = function(val) {
		results.push(val);
	};
	return new Promise(function(resolve, reject) {
		listener.onErr = reject;
		listener.onEnd = function() {
			resolve(Promise.all(results));
		};
		listener.start();
	});
};

function ObjectRelay() {
	Relay.call(this);
};

Relay.subClass(ObjectRelay);

ObjectRelay.prototype.value = function() {
	var results = {},
		listener = new Listener(this);
	listener.onData = function(val, key) {
		results[key] = val;
	};
	return new Promise(function(resolve, reject) {
		listener.onErr = reject;
		listener.onEnd = function() {
			resolve(results);
		};
		listener.start();
	});
};


module.exports = Relay;
module.exports.Array = ArrayRelay;
module.exports.Object = ObjectRelay;
