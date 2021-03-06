/*
 * Jexl
 * Copyright (c) 2015 TechnologyAdvice
 */

var chai = require('chai'),
	chaiAsPromised = require('chai-as-promised'),
	should = require('chai').should(),
	Jexl = require('../lib/Jexl');

if (!global.Promise)
	global.Promise = require('bluebird').Promise;

chai.use(chaiAsPromised);

var inst;

describe('Jexl', function() {
	beforeEach(function() {
		inst = new Jexl.Jexl();
	});
	it('should resolve Promise on success', function() {
		return inst.eval('2+2').should.become(4);
	});
	it('should reject Promise on error', function() {
		return inst.eval('2++2').should.reject;
	});
	it('should call callback with success result', function(done) {
		inst.eval('2+2', function(err, res) {
			res.should.equal(4);
			done(err);
		});
	});
	it('should call callback with error result', function(done) {
		inst.eval('2++2', function(err, res) {
			should.exist(err);
			should.not.exist(res);
			done();
		});
	});
	it('should allow transforms to be defined', function() {
		inst.addTransform('toCase', function(val, args) {
			if (args.case === 'upper')
				return val.toUpperCase();
			return val.toLowerCase();
		});
		return inst.eval('"hello"|toCase({case:"upper"})')
			.should.become('HELLO');
	});
	it('should allow transforms to be retrieved', function() {
		inst.addTransform('ret2', function() { return 2; });
		var t = inst.getTransform('ret2');
		should.exist(t);
		t().should.equal(2);
	});
	it('should allow transforms to be set in batch', function() {
		inst.addTransforms({
			add1: function(val) { return val + 1; },
			add2: function(val) { return val + 2; }
		});
		return inst.eval('2|add1|add2').should.become(5);
	});
	it('should call callback with error result when a non-compile error is thrown', function(done) {
		inst.addTransform('throw', function() { throw new Error('foo'); });
		inst.eval('5 | throw', function(err, res) {
			should.exist(err);
			should.not.exist(res);
			done();
		});
	});
	it('should pass context', function() {
		return inst.eval('foo', {foo: 'bar'}).should.become('bar');
	});
	it('should have proper order of arithmetic operations', function() {
		return inst.eval('5 + 12/4 + 5%2 + 2^3 - 2').should.become(15);
	});
	it('should evaluate the "!", "<", and "!=" operators', function() {
		return inst.eval('!5 != (3 < 5)').should.become(true);
	});
	it('should allow binaryOps to be defined', function() {
		inst.addBinaryOp('_=', 20, function(left, right) {
			return left.toLowerCase() === right.toLowerCase();
		});
		return inst.eval('"FoO" _= "fOo"').should.become(true);
	});
	it('should observe weight on binaryOps', function() {
		inst.addBinaryOp('**', 0, function(left, right) {
			return left * 2 + right * 2;
		});
		inst.addBinaryOp('***', 1000, function(left, right) {
			return left * 2 + right * 2;
		});
		return Promise.all([
			inst.eval('1 + 2 ** 3 + 4'),
			inst.eval('1 + 2 *** 3 + 4')
		]).should.become([20, 15]);
	});
	it('should allow unaryOps to be defined', function() {
		inst.addUnaryOp('$', function(right) {
			return Math.floor(right);
		});
		return inst.eval('$5.7 + 5').should.become(10);
	});
	it('should allow binaryOps to be removed', function() {
		inst.removeOp('+');
		return inst.eval('1+2').should.eventually.be.rejected;
	});
	it('should allow unaryOps to be removed', function() {
		inst.removeOp('!');
		return inst.eval('!true').should.eventually.be.rejected;
	});
	it('should throw when the expression has a trailing "-" token', function() {
		return inst.eval('500 + -').should.eventually.be.rejected;
	});
	it('should allow access to properties of object literals', function() {
		return inst.eval('{foo: 5}.foo').should.become(5);
	});
	it('should allow assignment of a variable to context', function() {
		return inst.eval('foo=5+7; foo+3').should.become(15);
	});
	it('should properly assign a negative number to the context', function() {
		return inst.eval('foo=-3; foo+3').should.become(0);
	});
	it('should allow assignment of multiple variables to the context', function() {
		return inst.eval('foo=5+7; bar=foo*2; bar').should.become(24);
	});
	it('should allow succesive variable assignments to the context', function() {
		return inst.eval('foo=1; bar=foo*2; baz=foo+bar; baz*bar').should.become(6);
	});
	it('should not change the supplied context variable', function() {
		var context = {};
		return inst.eval('foo=5+7; bar=foo*2; bar', context).then(function() {
			return Object.keys(context).length.should.equal(0);
		});
	});
	it('should allow use of lambda functions', function() {
		inst.addTransform('map', function(val, lambda) {
			return val.map(lambda);
		});
		return inst.eval('foo = [1,2,3] | map((n) -> n + 2); foo').should.eventually.deep.equal([3,4,5]);
	});
	it('should allow use of lambda functions with multiple arguments', function() {
		inst.addTransform('map', function(val, lambda) {
			return val.map(lambda);
		});
		return inst.eval('foo = [1,2,3] | map((n, i, a, b, c) -> n - i); foo').should.eventually.deep.equal([1,1,1]);
	});
	it('should allow access of context variables within lambda functions with correct scope and not alter existing context', function() {
		var context = {other: 4, n: 17};
		inst.addTransform('map', function(val, lambda) {
			return val.map(lambda);
		});
		return inst.eval('foo = [1,2,3] | map((n) -> n + other); foo', context).then(function(res) {
			Object.keys(context).should.have.length(2);
			context.other.should.equal(4);
			context.n.should.equal(17);
			return res;
		}).should.eventually.deep.equal([5,6,7]);
	});
	it('should throw on an attempt to evaluate bare identifiers separated by commas', function() {
		return inst.eval('x, y', {x:1, y:2}).should.eventually.be.rejected;
	});
	it('should throw on a lambda declaration outside of a subexpresion', function() {
		return inst.eval('1 + -> 1').should.eventually.be.rejected;
	});
	it('should compile an expression', function() {
		var fn = inst.compile('foo');
		return Promise.all([
			fn({foo: 5}),
			fn({foo: 0})
		]).should.eventually.deep.equal([5,0]);
	});
	it('should throw when compiling an expression with invalid tokens', function() {
		var fn = inst.compile.bind(inst, '9foo');
		return fn.should.throw();
	});
	it('should throw when compiling an expression that assigns and identifies the same variable in the same line', function() {
		var fn = inst.compile.bind(inst, 'foo=foo;foo');
		return fn.should.throw();
	});
	it('should throw when compiling an expression that assigns a variable multiple times', function() {
		var fn = inst.compile.bind(inst, 'foo=5; foo=6; foo');
		return fn.should.throw();
	});
	it('should apply a filter to an object post-transform', function() {
		inst.addTransform('id', function(x) { return x; });
		return inst.eval("{foo: 5, bar: 7} | id[.foo > 3].bar").should.become(7);
	});
	it('should apply a collect subexpresion over an array', function() {
		return inst.eval("[3,5,7] <| @ + # |>").should.eventually.deep.equal([3,6,9]);
	});
	it('should apply a collect subexpresion over an object', function() {
		return inst.eval("{foo: 5, bar: 7} <| @ + 2 |>").should.eventually.deep.equal({foo: 7, bar: 9});
	});
	it('should throw applying a collect subexpresion over a non-object', function() {
		return inst.eval("20 <| @ + 2 |>").should.eventually.be.rejected;
	});
	it('should allow access of context variables within a collect expresion', function() {
		return inst.eval("[5,10] <| @ + foo |>", {foo: 5}).should.eventually.deep.equal([10,15]);
	});
	it('should allow access of properties of values without a dot within a collect expresion', function() {
		return inst.eval("foo <| @bar + 2 |>", {foo: [{bar: 5}]}).should.eventually.deep.equal([7]);
	});
	it('should allow object literals with multiple identifiers within a collect expression', function() {
		return inst.eval("[1,2,3] <| {num: @, inc: @} |> <| @num + @inc |>").should.eventually.deep.equal([2,4,6]);
	});
	it('should identify array literals within a collect expresion', function() {
		return inst.eval("foo <| [@bar, @baz] |>", {foo: [{bar: 5, baz: 7}]}).should.eventually.deep.equal([[5,7]]);
	});
	it('should throw when a bare identifiers separated by commas are used within a subexpresion of an array literal within a collect expression', function() {
		return inst.eval("foo <| [(@bar, @baz)] |>", {foo: [{bar: 5, baz: 7}]}).should.eventually.be.rejected;
	});
	it('should filter results indicated by the "~" character', function() {
		return inst.eval("[1,2,3,4,5] <| @ > 2 ? ~ : @ |>").should.eventually.deep.equal([1,2]);
	});
	it('should return undefined for the result of a nonexistant relative identifier', function() {
		return inst.eval("foo.bar").should.become(undefined);
	});
	it('should apply a static filter that evaluates to true', function() {
		return inst.eval("foo[3>2]", {foo: [1,2,3]}).should.eventually.deep.equal([1,2,3]);
	});
	it('should return undefined when applying a static filter that evaluates to false', function() {
		return inst.eval("foo[2>3]", {foo: [1,2,3]}).should.become(undefined);
	});
	it('should evaluate a find expression', function() {
		return inst.eval("[1,2,3,4,5] <|* @ % 4 == 0 ? @ : ~ |> ").should.become(4);
	});
	it('should evaluate a find expression to undefined when there are no truthy results', function() {
		return inst.eval("[1,2,3,4,5] <|* @ % 7 == 0 ? @ : ~ |> ").should.become(undefined);
	});
	it('should allow string literals as object keys', function() {
		return inst.eval("{'foo': 5}['foo']").should.become(5);
	});
	it('should apply a reduce expression', function() {
		return inst.eval("[1,2,3,4,5] <| @ + $ , 0|>").should.become(15);
	});
	it('should allow evaluation of an array literal', function() {
		return inst.eval("[1,2,3]").should.eventually.deep.equal([1,2,3]);
	});
	it('should allow definition of a transform', function() {
		return inst.eval("addDouble(num, i) |= num + 2*i; 5 | addDouble(3)").should.become(11);
	});
	it('should allow a reduce expression as a transform assignment', function() {
		return inst.eval("sum(arr) |= arr <| @ + $, 0 |>; [1,2,3,4,5] | sum").should.become(15);
	});
	it('should evaluate an expression over each context in an array', function() {
		return inst.eval("x + 2", [{x: 1}, {x: 2}, {x: 3}]).should.eventually.deep.equal([3,4,5]);
	});
	it('should allow results to be streamed', function() {
		return new Promise(function(resolve, reject) {
			var results = [];
			var stream = inst.stream("x + 2", [{x: 1}, {x: 2}, {x: 3}]);
			stream.on('data', results.push.bind(results));
			stream.on('error', reject);
			stream.on('end', resolve.bind(Promise, results));
		}).should.eventually.deep.equal([3,4,5]);
	});
	it('should interpret a stream of results', function() {
		var stream = inst.stream("{y: x + 2}", [{x: 1}, {x: 2}, {x: 3}]);
		return inst.eval('y * 2', stream).should.eventually.deep.equal([6,8,10]);
	});
});
