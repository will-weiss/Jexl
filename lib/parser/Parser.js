/*
 * Jexl
 * Copyright (c) 2015 TechnologyAdvice
 */

var handlers = require('./handlers'),
	states = require('./states').states;

/**
 * The Parser is a state machine that converts tokens from the {@link Lexer}
 * into an Abstract Syntax Tree (AST), capable of being evaluated in any
 * context by the {@link Evaluator}.  The Parser expects that all tokens
 * provided to it are legal and typed properly according to the grammar, but
 * accepts that the tokens may still be in an invalid order or in some other
 * unparsable configuration that requires it to throw an Error.
 * @param {{}} grammar The grammar map to use to parse Jexl strings
 * @param {string} [prefix] A string prefix to prepend to the expression string
 *      for error messaging purposes.  This is useful for when a new Parser is
 *      instantiated to parse an subexpression, as the parent Parser's
 *      expression string thus far can be passed for a more user-friendly
 *      error message.
 * @param {{}} [stopMap] A mapping of token types to any truthy value. When the
 *      token type is encountered, the parser will return the mapped value
 *      instead of boolean false.
 * @param {string} [state] A state to begin in.
 * @constructor
 */
function Parser(grammar, prefix, stopMap, state) {
	this._grammar = grammar;
	this._tree = null;
	this._exprStr = prefix || '';
	this._relative = false;
	this._stopMap = stopMap || {};
	this._state = state || 'expectInitialOperand';
};

/**
 * Processes an array of tokenized lines into an array of complete ASTs. Throws
 * an error if lines make assignments to the same variable.
 * @param {{}} grammar The grammar map to use to parse Jexl strings.
 * @param {string tokenizedLines An array of tokenized lines of an expression.
 * @returns {Array<{}>} An array of complete ASTs.
 */
Parser.completeLines = function(grammar, tokenizedLines) {
	var assigned = {};
	return tokenizedLines.map(function(tokenizedLine) {
		var parser = new Parser(grammar),
			line = parser.addTokens(tokenizedLine);
		if (parser._assignment) {
			if (assigned[parser._assignment])
				throw new Error(parser._assignment);
			assigned[parser._assignment] = true;
		}
		return line;
	});
};

/**
 * Processes a new token into the AST and manages the transitions of the state
 * machine.
 * @param {{type: <string>}} token A token object, as provided by the
 *      {@link Lexer#tokenize} function.
 * @throws {Error} if a token is added when the Parser has been marked as
 *      complete by {@link #complete}, or if an unexpected token type is added.
 * @returns {boolean|*} the stopState value if this parser encountered a token
 *      in the stopState map; false if tokens can continue.
 */
Parser.prototype.addToken = function(token) {
	if (this._state == 'complete')
		throw new Error('Cannot add a new token to a completed Parser');
	var state = states[this._state],
		startExpr = this._exprStr;
	this._exprStr += token.raw;
	if (state.sub) {
		if (!this._subParser)
			this._startSubExpression(startExpr);
		var stopState = this._subParser.addToken(token);
		if (stopState) {
			this._endSubExpression();
			if (this._parentStop)
				return stopState;
			this._state = stopState;
		}
	}
	else if (state.tokenTypes[token.type]) {
		var typeOpts = state.tokenTypes[token.type],
			handleFunc = handlers[token.type];
		if (typeOpts.handler)
			handleFunc = typeOpts.handler;
		if (handleFunc) {
			try {
				handleFunc.call(this, token);
			}
			catch (err) {
				this._throwTokenError(token, err);
			}
		}
		if (typeOpts.toState)
			this._state = typeOpts.toState;
	}
	else if (this._stopMap[token.type])
		return this._stopMap[token.type];
	else
		this._throwTokenError(token);
	return false;
};

/**
 * Processes an array of tokens iteratively through the {@link #addToken}
 * function.
 * @param {Array<{type: <string>}>} tokens An array of tokens, as provided by
 *      the {@link Lexer#tokenizeLines} function.
 */
Parser.prototype.addTokens = function(tokens) {
	tokens.forEach(this.addToken, this);
	return this.complete();
};

/**
 * Marks this Parser instance as completed and retrieves the full AST.
 * @returns {{}|null} a full expression tree, ready for evaluation by the
 *      {@link Evaluator#eval} function, or null if no tokens were passed to
 *      the parser before complete was called
 * @throws {Error} if the parser is not in a state where it's legal to end
 *      the expression, indicating that the expression is incomplete
 */

/**
 * Marks this Parser instance as completed and retrieves the full AST.
 * @returns {{}|null} a full expression tree, ready for evaluation by the
 *      {@link Evaluator#eval} function, or null if no tokens were passed to
 *      the parser before complete was called
 * @throws {Error} if the parser is not in a state where it's legal to end
 *      the expression, indicating that the expression is incomplete
 */
Parser.prototype.complete = function() {
	var cur = this._cursor;
	if (cur && (!states[this._state].completable))
		throw new Error('Unexpected end of expression: ' + this._exprStr);
	if (this._subParser)
		this._endSubExpression();
	this._state = 'complete';
	return cur ? this._tree : null;
};

/**
 * Indicates whether the expression tree contains a relative path identifier.
 * @returns {boolean} true if a relative identifier exists; false otherwise.
 */
Parser.prototype.isRelative = function() {
	return this._relative;
};

/**
 * Ends a subexpression by completing the subParser and passing its result
 * to the subHandler configured in the current state.
 * @private
 */
Parser.prototype._endSubExpression = function() {
	states[this._state].sub.handler.call(this, this._subParser.complete());
	this._subParser = null;
};

/**
 * Places a new tree node at the current position of the cursor (to the 'right'
 * property) and then advances the cursor to the new node. This function also
 * handles setting the parent of the new node.
 * @param {{type: <string>}} node A node to be added to the AST
 * @private
 */
Parser.prototype._placeAtCursor = function(node) {
	if (!this._cursor)
		this._tree = node;
	else {
		this._cursor.right = node;
		this._setParent(node, this._cursor);
	}
	this._cursor = node;
};

/**
 * Places a tree node before the current position of the cursor, replacing
 * the node that the cursor currently points to. This should only be called in
 * cases where the cursor is known to exist, and the provided node already
 * contains a pointer to what's at the cursor currently.
 * @param {{type: <string>}} node A node to be added to the AST
 * @private
 */
Parser.prototype._placeBeforeCursor = function(node) {
	this._cursor = this._cursor._parent;
	this._placeAtCursor(node);
};

/**
 * Sets the parent of a node by creating a non-enumerable _parent property
 * that points to the supplied parent argument.
 * @param {{type: <string>}} node A node of the AST on which to set a new
 *      parent
 * @param {{type: <string>}} parent An existing node of the AST to serve as the
 *      parent of the new node
 * @private
 */
Parser.prototype._setParent = function(node, parent) {
	Object.defineProperty(node, '_parent', {
		value: parent,
		writable: true
	});
};

/**
 * Prepares the Parser to accept a subexpression by (re)instantiating the
 * subParser.
 * @param {string} [exprStr] The expression string to prefix to the new Parser
 * @private
 */
Parser.prototype._startSubExpression = function(exprStr) {
	var state = states[this._state],
		endStates = state.endStates;
	if (!endStates) {
		this._parentStop = true;
		endStates = this._stopMap;
	}
	this._subParser = new Parser(this._grammar, exprStr, endStates, state.sub.state);
};

/**
 * Throws an error when a token is unexpected.
 * @param {{type: <string>}} token The unexpected token
 * @private
 */
Parser.prototype._throwTokenError = function(token, err) {
	msg = 'Token ' + token.raw + ' (' + token.type +
		') unexpected in expression: ' + this._exprStr;
	if (err && err.message)
		msg += '\n' + err.message;
	throw new Error(msg);
};

module.exports = Parser;
