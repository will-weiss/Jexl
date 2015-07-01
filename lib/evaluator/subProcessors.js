var omit = {},
	utils = require('./utils'),
	Flood = require('../Flood');

/**
 * The SubProcessor iteratively applies a subprocess over an object. Subclasses
 * of SubProcessor handle different subprocesses.
 * @param {{@link Evaluator}} [evaluator] The evaluator invoking the subprocess.
 * @param {{}} [expr] The expression tree to run against each value.
 * @param {{}} [obj] An object over which to apply a subexpression.
 * @constructor
 */
function SubProcessor(evaluator, ast, obj) {
	if (!((typeof obj === 'object') && !!obj)) {
		throw new Error("Attempting iterable expression: " + ast.expr
			+ "\nover non-iterable: " + obj);
	}
	this.evaluator = evaluator;
	this.ast = ast;
	this.flood = Flood.from(obj);
	this.result = this.process();
};

/**
 * Applies a suboperation once given a value and a key. Within the context of the
 * subprocess the '@' identifier refers to the value, the '#' identifier refers
 * to the numeric index if the subject is an array or the string key otherwise,
 * and the '~' identifier indicates that a result for this suboperation should be
 * omitted.
 *
 * @param {{}} [val] A value over which the suboperation is applied.
 * @param {{}} [key] The key representing the value in the object.
 * @returns {Promise<{}>} resolves when the supoperation has completed.
 */
SubProcessor.prototype.subOp = function(val, key) {
	var evalInst = this.evaluator.clone({'@': val, '#': key, '~': omit});
	return evalInst.evalLazy(this.ast.expr);
};

/**
 * Sets the prototype and constructor properties of a subclass of SubProcessor.
 */
SubProcessor.subClass = function(ctor) {
	ctor.prototype = Object.create(SubProcessor.prototype);
	ctor.prototype.constructor = ctor;
};

/**
 * The Collector handles a Collect process.
 * @param {{@link Evaluator}} [evaluator] The evaluator invoking the Collect.
 * @param {{}} [expr] The expression tree to run against each value.
 * @param {{}} [obj] An object over which to apply a Collect process.
 * @constructor
 */
function Collector(evaluator, ast, obj) {
	SubProcessor.call(this, evaluator, ast, obj);
};

SubProcessor.subClass(Collector);

/**
 * When the object being collected is an Flood, the result is an Flood.
 */
Collector.prototype.process = function() {
	return this.flood.map(this.subOp.bind(this))
	.filter(function(res) {
		return res !== omit;
	});
};

/**
 * The Finder handles a Find process. The result is a Promise which resolves with the first
 * nonomitted truthy result of a suboperation.
 * @param {{@link Evaluator}} [evaluator] The evaluator invoking the Find.
 * @param {{}} [expr] The expression tree to run against each value.
 * @param {{}} [obj] An object over which to apply a Find process.
 * @constructor
 */
function Finder(evaluator, ast, obj) {
	SubProcessor.call(this, evaluator, ast, obj);
};

SubProcessor.subClass(Finder);

/**
 * Applies processing logic for when the supplied object is an Flood. Keys
 * are numeric indices reflecting the order of 'data' events. On 'end' and 'error'
 * events, the listener is removed.
 */
Finder.prototype.process = function() {
	var self = this;
	return this.flood.find(function(val, key) {
		return self.subOp(val, key).then(function(res) {
			return res && (res !== omit);
		});
	});
};

/**
 * The Reducer handles a Reduce process. The result is a Promise which resolves with the
 * final value of the accumulator.
 * @param {{@link Evaluator}} [evaluator] The evaluator invoking the Reduce.
 * @param {{}} [expr] The expression tree to run against each value.
 * @param {{}} [obj] An object over which to apply a Reduce process.
 * @constructor
 */
function Reducer(evaluator, ast, obj) {
	SubProcessor.call(this, evaluator, ast, obj);
};

SubProcessor.subClass(Reducer);

Reducer.prototype.process = function() {
	var self = this,
		context = this.evaluator._context;
	return this.flood.reduce(function(accumulator, val, key) {
		context['$'] = accumulator;
		return self.subOp(val, key).then(function(res) {
			return res !== omit ? res : accumulator;
		});
	}, this.evaluator.eval(this.ast.accumulator));
};

module.exports.Collect = Collector;
module.exports.Find = Finder;
module.exports.Reduce = Reducer;
