function thrower(msg) {
	throw new Error(msg);
};

function noop() {};

function valuePush(key, value) {
	this.value.push(value, key);
};

function valueEnd(err) {
	this.value.end(err);
};

function Node(value, key) {
	this.value = value;
	this.key = key;
};

function Listener(relay, onData, onEnd, initValue) {
	this._state = relay._state;
	this.node = relay._headRef;
	this.value = initValue;
	this.onData = onData;
	this.onEnd = onEnd;
	this.process();
};

Listener.prototype.end = function(err) {
	this.onEnd(err);
	this.process = this.end = noop;
};

Listener.prototype.pend = function() {
	var state = this._state;
	this.pending = state.pending;
	state.pending = this;
};

Listener.prototype.process = function() {
	return this.node.next ?
		this.shift()
	: this._state.ended ?
		this.end(this._state.error)
	: this.pend();
};

Listener.prototype.shift = function() {
	this.node = this.node.next;
	return Promise.resolve(this.node.value)
		.then(this.onData.bind(this, this.node.key))
		.then(this.process.bind(this), this.end.bind(this));
};

Listener.prototype.valuePush = valuePush;

Listener.prototype.valueEnd = valueEnd;

function RelayState() {};

function Relay() {
	this._headRef = this._tail = {};
	this._state = new RelayState;
	Object.defineProperty(this, 'value', {
		get: function() {
			var value = this.consume(this.onData, new this.valueConstructor);
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
		relay = new Relay.Array
		from.forEach(relay.push.bind(relay));
	} else {
		relay = new Relay.Object
		Object.keys(from).forEach(function(key) {
			relay.push(from[key], key);
		});
	}
	relay.end();
	return relay;
};

Relay.subClass = function(valueConstructor, onData) {
	var ctor = function() {
		Relay.call(this);
	};
	ctor.name = valueConstructor.name + Relay.name;
	ctor.prototype = Object.create(Relay.prototype);
	ctor.prototype.constructor = ctor;
	ctor.prototype.valueConstructor = valueConstructor;
	ctor.prototype.onData = onData;
	return ctor;
};

Relay.prototype.then = function(onResolve, onReject) {
	return this.value.then(onResolve, onReject);
};

Relay.prototype.catch = function(onReject) {
	return this.then.call(this, undefined, onReject);
};

Relay.prototype.revive = function(fn, arg) {
	var pending, check = this._state;
	while (pending = check.pending) {
		delete check.pending;
		pending[fn](arg);
		check = pending;
	}
};

Relay.prototype.push = function(value, key) {
	this._tail = this._tail.next = new Node(value, key);
	this.revive('shift');
	return this;
};

Relay.prototype.listen = function(onData, onEnd, initValue) {
	return new Listener(this, onData, onEnd, initValue);
};

Relay.prototype.end = function(err) {
	this.push = this.end = thrower.bind(this, 'May not be called on an ended relay.');
	this._state.ended = true;
	if (err)
		this._state.error = err;
	return this.revive('end', err);
};

Relay.prototype.close = function() {
	this.listen = this.close = thrower.bind(this, 'May not be called on a closed relay.');
	delete this._headRef;
};

Relay.prototype.link = function(onData, onEnd) {
	return this.listen(onData, onEnd, new this.constructor).value;
};

Relay.prototype.consume = function(onData, initValue) {
	return new Promise((function(resolve, reject) {
		this.listen(onData, function(err) {
			return err ? reject(err) : resolve(this.value);
		}, initValue);
	}).bind(this));
};

Relay.prototype.map = function(lambda) {
	return this.link(function(key, value) {
		this.valuePush(key, lambda(value, key));
	}, valueEnd);
};

Relay.prototype.filter = function(predicate) {
	return this.link(function(key, value) {
		return Promise.resolve(predicate(value, key)).then((function(res) {
			if (res)
				this.valuePush(key, value);
		}).bind(this));
	}, valueEnd);
};

Relay.prototype.find = function(predicate) {
	return this.consume(function(key, value) {
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
	return this.link(valuePush, function(err) {
		return err
			? this.valueEnd(err)
			: Relay.from(obj).listen(valuePush, valueEnd, this.value);
	});
};

Relay.prototype.flatten = function() {
	return this.link(function(key, obj) {
		var self = this;
		return Relay.from(obj).consume(function(key, value) {
			self.valuePush(key, value);
		});
	}, valueEnd);
};

Relay.Array = Relay.subClass(Array, function(key, value) {
	this.value.push(value);
});

Relay.Array.prototype.length = 0;

Relay.Array.prototype.push = function(value) {
	return Relay.prototype.push.call(this, value, this.length++);
};

Relay.Object = Relay.subClass(Object, function(key, value) {
	this.value[key] = value;
});

module.exports = Relay;
