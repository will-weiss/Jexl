function noop() {};

function thrower(msg) {
	throw new Error(msg);
};

function valuePush(value) {
	this.value.push(value);
};

function valueEnd(err) {
	this.value.end(err);
};

function Node(value) {
	this.value = value;
};

function Listener(flood, onData, onEnd, initValue) {
	this._state = flood._state;
	this.node = flood._headRef;
	this.value = initValue;
	this.onData = onData;
	this.onEnd = onEnd;
	this.process();
};

Listener.prototype.processing = 0;

Listener.prototype.end = function(err) {
	this.process = this.end = noop;
	this.onEnd(err);
};

Listener.prototype.pend = function() {
	var state = this._state;
	this.pending = state.pending;
	state.pending = this;
};

Listener.prototype.close = function() {
	if (!this.processing)
		this.end();
};

Listener.prototype.process = function() {
	var state = this._state;
	return state.error ?
		this.end(state.error)
	: this.node.next ?
		this.shift()
	: state.ended ?
		this.close()
	: this.pend();
};

Listener.prototype.decrement = function() {
	if (!(--this.processing) && this._state.ended)
		this.end();
};

Listener.prototype.shift = function() {
	this.processing++;
	this.node = this.node.next;
	Promise.resolve(this.node.value)
		.then(this.onData.bind(this))
		.then(this.decrement.bind(this), this.end.bind(this));
	return this.process();
};

Listener.prototype.valuePush = valuePush;

Listener.prototype.valueEnd = valueEnd;

function FloodState() {};

function Flood() {
	this._headRef = this._tail = {};
	this._state = new FloodState;
	Object.defineProperty(this, 'value', {
		get: function() {
			var value = this.consume(valuePush, []);
			this.value = value;
			return value;
		}
	});
};

Flood.from = function(from) {
	if (from instanceof Flood)
		return from;
	var flood;
	if (Array.isArray(from)) {
		flood = new Flood.Array
		from.forEach(flood.push.bind(flood));
	}
	flood.end();
	return flood;
};

Flood.prototype.then = function(onResolve, onReject) {
	return this.value.then(onResolve, onReject);
};

Flood.prototype.catch = function(onReject) {
	return this.then.call(this, undefined, onReject);
};

Flood.prototype.revive = function(fn, arg) {
	var pending, check = this._state;
	while (pending = check.pending) {
		delete check.pending;
		pending[fn](arg);
		check = pending;
	}
};

Flood.prototype.push = function(value) {
	this._tail = this._tail.next = new Node(value);
	this.revive('shift');
	return this;
};

Flood.prototype.listen = function(onData, onEnd, initValue) {
	return new Listener(this, onData, onEnd, initValue);
};

Flood.prototype.end = function(err) {
	this.push = this.end = thrower.bind(this, 'May not be called on an ended flood.');
	this._state.ended = true;
	if (!err)
		return this.revive('close');
	this._state.error = err;
	return this.revive('end', err);
};

Flood.prototype.close = function() {
	this.listen = this.close = thrower.bind(this, 'May not be called on a closed flood.');
	delete this._headRef;
};

Flood.prototype.link = function(onData, onEnd) {
	return this.listen(onData, onEnd, new Flood).value;
};

Flood.prototype.consume = function(onData, initValue) {
	return new Promise((function(resolve, reject) {
		this.listen(onData, function(err) {
			return err ? reject(err) : resolve(this.value);
		}, initValue);
	}).bind(this));
};

Flood.prototype.map = function(lambda) {
	return this.link(function(value) {
		this.valuePush(lambda(value));
	}, valueEnd);
};

Flood.prototype.filter = function(predicate) {
	return this.link(function(value) {
		return Promise.resolve(predicate(value)).then((function(res) {
			if (res)
				this.valuePush(value);
		}).bind(this));
	}, valueEnd);
};

Flood.prototype.find = function(predicate) {
	return this.consume(function(value) {
		return Promise.resolve(predicate(value)).then((function(res) {
			if (res) {
				this.value = value;
				this.end();
			}
		}).bind(this));
	});
};

Flood.prototype.reduce = function(lambda, accumulator) {
	return this.consume(function(value) {
		return Promise.resolve(this.value).then((function(accumulator) {
			this.value = lambda(accumulator, value);
		}).bind(this));
	}, accumulator);
};

Flood.prototype.concat = function(obj) {
	return this.link(valuePush, function(err) {
		return err
			? this.valueEnd(err)
			: Flood.from(obj).listen(valuePush, valueEnd, this.value);
	});
};

Flood.prototype.flatten = function() {
	return this.link(function(obj) {
		var self = this;
		return Flood.from(obj).consume(function(value) {
			self.valuePush(value);
		});
	}, valueEnd);
};

module.exports = Flood;
