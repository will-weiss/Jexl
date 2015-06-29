function thrower(msg) {
	setTimeout(function() {
		throw new Error(msg);
	}, 0)
	return this;
};

function valuePush(key, value) {
	this.value._push(value, key);
};

function valueEnd(err) {
	this.value.end(err);
};

function Node(value, key) {
	this.value = value;
	this.key = key;
};

function Listener(relay, onData, onEnd, initValue) {
	this.relay = relay;
	this._state = relay._state;
	this.node = relay._headRef;
	this.value = initValue;
	this.onData = onData;
	this.end = onEnd;
	this.process();
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
	this._onto = this;
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
	var pending = this._state.pending;
	if (pending) {
		pending[fn](arg);
		pending = pending.pending;
	}
	delete this._state.pending;
};

Relay.prototype._dequeue = function() {
	if (this._tail.next = this._onto._headRef.next)
		this.revive('shift');
};

Relay.prototype._push = function(value, key) {
	this._tail = this._tail.next = new Node(value, key);
	this.revive('shift');
};

Relay.prototype.push = function(value, key) {
	this._onto._push(value, key);
	return this;
};

Relay.prototype.listen = function(onData, onEnd, initValue) {
	return new Listener(this, onData, onEnd, initValue);
};

Relay.prototype.end = function(err) {
	this.push = this.end = thrower.bind(this, 'May not be called on an ended relay.');
	if (this._onto !== this)
		this._dequeue();
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
	var relay = new this.constructor;
	relay._onto = new this.constructor;
	return this.listen(onData, onEnd, relay).value;
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
