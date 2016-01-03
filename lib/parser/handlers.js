/*
 * Jexl
 * Copyright (c) 2015 TechnologyAdvice
 */

exports.programStart = function(ast) {
  this._placeAtCursor({
    type: 'Program',
    body: [ast]
  });
}

exports.variableDefinition = function() {
  if (this._definition)
    throw new Error("Only one definition per line");
  if (this._relative)
    throw new Error("Definitions only at top level");
  var parent = this._cursor._parent;
  var node = {
    type: 'VariableDefinition',
    left: this._cursor
  };
  this._setParent(this._cursor, node);
  this._cursor = parent;
  this._placeAtCursor(node);
  this._definition = true;
}

exports.arrow = function() {
  if (!Array.isArray(this._cursor.varType))
    this._cursor.varType = [this._cursor.varType];
}

exports.typeDeclaration = function(token) {
  if (this._cursor.varType)
    this._cursor.varType.push(token.value)
  else
    this._cursor.varType = token.value;
}

exports.typeDefinition = function(token) {
  var parent = this._cursor._parent;
  var node = {
    type: 'TypeDefinition',
    identifier: this._cursor.value
  };
  this._setParent(this._cursor, node);
  this._cursor = parent;
  this._placeAtCursor(node);
}

/**
 * Handles a subexpression that's used to define a transform argument's value.
 * @param {{type: <string>}} ast The subexpression tree
 */
exports.argVal = function(ast) {
  this._cursor.args.push(ast);
};

/**
 * Handles new array literals by adding them as a new node in the AST,
 * initialized with an empty array.
 */
exports.arrayStart = function() {
  this._placeAtCursor({
    type: 'ArrayLiteral',
    value: []
  });
};

/**
 * Handles a subexpression representing an element of an array literal.
 * @param {{type: <string>}} ast The subexpression tree
 */
exports.arrayVal = function(ast) {
  if (ast)
    this._cursor.value.push(ast);
};

/**
 * Handles tokens of type 'binaryOp', indicating an operation that has two
 * inputs: a left side and a right side.
 * @param {{type: <string>}} token A token object
 */
exports.binaryOp = function(token) {
  var precedence = this._grammar[token.value].precedence || 0,
    parent = this._cursor._parent;
  while (parent && parent.operator &&
      this._grammar[parent.operator].precedence >= precedence) {
    this._cursor = parent;
    parent = parent._parent;
  }
  var node = {
    type: 'BinaryExpression',
    operator: token.value,
    left: this._cursor
  };
  this._setParent(this._cursor, node);
  this._cursor = parent;
  this._placeAtCursor(node);
};

exports.callExpression = function(ast) {
  this._placeBeforeCursor({
    type: 'CallExpression',
    function: this._cursor,
    right: ast,
  });
}

exports.union = function(token) {
  var parent = this._cursor._parent;
  var node = {
    type: 'UnionExpression',
    left: this._cursor
  };
  this._setParent(this._cursor, node);
  this._cursor = parent;
  this._placeAtCursor(node);
}

exports.apply = function(ast) {
  this._placeBeforeCursor({
    type: 'CallExpression',
    function: ast,
    right: this._cursor
  });
}




exports.dot = function() {};

/**
 * Handles a subexpression used for filtering an array returned by an
 * identifier chain.
 * @param {{type: <string>}} ast The subexpression tree
 */
exports.filter = function(ast) {
  this._placeBeforeCursor({
    type: 'FilterExpression',
    expr: ast,
    relative: this._subParser.isRelative(),
    subject: this._cursor
  });
};

/**
 * Handles identifier tokens by adding them as a new node in the AST.
 * @param {{type: <string>}} token A token object
 */
exports.variableIdentifier = function(token) {
  this._placeAtCursor({
    type: 'VariableIdentifier',
    value: token.value
  });
};

exports.typeIdentifier = function(token) {
  var node = {
    type: 'TypeIdentifier',
    value: token.value
  };
  this._placeAtCursor(node);
};

/**
 * Handles literal values, such as strings, booleans, and numerics, by adding
 * them as a new node in the AST.
 * @param {{type: <string>}} token A token object
 */
exports.literal = function(token) {
  this._placeAtCursor({
    type: 'Literal',
    value: token.value
  });
};

/**
 * Queues a new object literal key to be written once a value is collected.
 * @param {{type: <string>}} token A token object
 */
exports.objKey = function(token) {
  this._curObjKey = token.value;
};

/**
 * Handles new object literals by adding them as a new node in the AST,
 * initialized with an empty object.
 */
exports.objStart = function() {
  this._placeAtCursor({
    type: 'ObjectLiteral',
    value: {}
  });
};

/**
 * Handles an object value by adding its AST to the queued key on the object
 * literal node currently at the cursor.
 * @param {{type: <string>}} ast The subexpression tree
 */
exports.objVal = function(ast) {
  this._cursor.value[this._curObjKey] = ast;
};

/**
 * Handles traditional subexpressions, delineated with the groupStart and
 * groupEnd elements.
 * @param {{type: <string>}} ast The subexpression tree
 */
exports.subExpression = function(ast) {
  this._placeAtCursor(ast);
};

/**
 * Handles a completed alternate subexpression of a ternary operator.
 * @param {{type: <string>}} ast The subexpression tree
 */
exports.ternaryEnd = function(ast) {
  this._cursor.alternate = ast;
};

/**
 * Handles a completed consequent subexpression of a ternary operator.
 * @param {{type: <string>}} ast The subexpression tree
 */
exports.ternaryMid = function(ast) {
  this._cursor.consequent = ast;
};

/**
 * Handles the start of a new ternary expression by encapsulating the entire
 * AST in a ConditionalExpression node, and using the existing tree as the
 * test element.
 */
exports.ternaryStart = function() {
  this._tree = {
    type: 'ConditionalExpression',
    test: this._tree
  };
  this._cursor = this._tree;
};

/**
 * Handles identifier tokens when used to indicate the name of a transform to
 * be applied.
 * @param {{type: <string>}} token A token object
 */
exports.transform = function(token) {
  this._placeBeforeCursor({
    type: 'Transform',
    name: token.value,
    args: [],
    subject: this._cursor
  });
};

/**
 * Handles token of type 'unaryOp', indicating that the operation has only
 * one input: a right side.
 * @param {{type: <string>}} token A token object
 */
exports.unaryOp = function(token) {
  this._placeAtCursor({
    type: 'UnaryExpression',
    operator: token.value
  });
};
