/*
 * Jexl
 * Copyright (c) 2015 TechnologyAdvice
 */

var h = require('./handlers');

/**
 * A mapping of all states in the finite state machine to a set of instructions
 * for handling or transitioning into other states. Each state can be handled
 * in one of two schemes: a tokenTypes map, or a subHandler.
 *
 * Standard expression elements are handled through the tokenTypes object. This
 * is an object map of all legal token types to encounter in this state (and
 * any unexpected token types will generate a thrown error) to an options
 * object that defines how they're handled.  The available options are:
 *
 *      {string} toState: The name of the state to which to transition
 *          immediately after handling this token
 *      {string} handler: The handler function to call when this token type is
 *          encountered in this state.  If omitted, the default handler
 *          matching the token's "type" property will be called. If the handler
 *          function does not exist, no call will be made and no error will be
 *          generated.  This is useful for tokens whose sole purpose is to
 *          transition to other states.
 *
 * States that consume a subexpression should define a subHandler, the
 * function to be called with an expression tree argument when the
 * subexpression is complete. Completeness is determined through the
 * endStates object, which maps tokens on which an expression should end to the
 * state to which to transition once the subHandler function has been called.
 *
 * Additionally, any state in which it is legal to mark the AST as completed
 * should have a 'completable' property set to boolean true.  Attempting to
 * call {@link Parser#complete} in any state without this property will result
 * in a thrown Error.
 *
 * @type {{}}
 */
exports.states = {
	expectInitialOperand: {
		tokenTypes: {
			literal: {toState: 'postLiteral'},
			identifier: {toState: 'initialIdentifier'},
			unaryOp: {},
			openParen: {toState: 'subExpression'},
			openCurl: {toState: 'expectObjKey', handler: h.objStart},
			dot: {toState: 'traverse'},
			openBracket: {toState: 'arrayVal', handler: h.arrayStart}
		}
	},
	expectOperand: {
		tokenTypes: {
			literal: {toState: 'postLiteral'},
			identifier: {toState: 'identifier'},
			unaryOp: {},
			openParen: {toState: 'subExpression'},
			openCurl: {toState: 'expectObjKey', handler: h.objStart},
			dot: {toState: 'traverse'},
			openBracket: {toState: 'arrayVal', handler: h.arrayStart}
		}
	},
	expectArgVal: {
		tokenTypes: {
			literal: {toState: 'postLiteral'},
			identifier: {toState: 'identifier'},
			unaryOp: {},
			openParen: {toState: 'subExpressionOrLambdaArgNames'},
			openCurl: {toState: 'expectObjKey', handler: h.objStart},
			dot: {toState: 'traverse'},
			openBracket: {toState: 'arrayVal', handler: h.arrayStart}
		}
	},
	expectBinOp: {
		tokenTypes: {
			binaryOp: {toState: 'expectOperand'},
			pipe: {toState: 'expectTransform'},
			dot: {toState: 'traverse'},
			openBracket: {toState: 'filter'},
			openFind: {toState: 'find'},
			openIter: {toState: 'iter'},
			question: {toState: 'ternaryMid', handler: h.ternaryStart}
		},
		completable: true
	},
	expectBinOpOrLambda: {
		tokenTypes: {
			binaryOp: {toState: 'expectOperand'},
			pipe: {toState: 'expectTransform'},
			dot: {toState: 'traverse'},
			openBracket: {toState: 'filter'},
			openFind: {toState: 'find'},
			openIter: {toState: 'iter'},
			rightArrow: {toState: 'expectOperand', handler: h.lambdaExpression},
			question: {toState: 'ternaryMid', handler: h.ternaryStart}
		},
		completable: true
	},
	expectLambda: {
		tokenTypes: {
			rightArrow: {toState: 'expectOperand', handler: h.lambdaExpression}
		}
	},
	expectTransform: {
		tokenTypes: {
			identifier: {toState: 'postTransform', handler: h.transform}
		}
	},
	expectTransformAssignment: {
		tokenTypes: {
			turnstile: {toState: 'expectOperand', handler: h.transformAssignmentEnd}
		}
	},
	expectObjKey: {
		tokenTypes: {
			identifier: {toState: 'expectKeyValSep', handler: h.objKey},
			literal: {toState: 'expectKeyValSep', handler: h.objKey},
			closeCurl: {toState: 'expectBinOp'}
		}
	},
	expectKeyValSep: {
		tokenTypes: {
			colon: {toState: 'objVal'}
		}
	},
	postLiteral: {
		tokenTypes: {
			binaryOp: {toState: 'expectOperand'},
			pipe: {toState: 'expectTransform'},
			dot: {toState: 'traverse'},
			question: {toState: 'ternaryMid', handler: h.ternaryStart}
		},
		completable: true
	},
	postTransform: {
		tokenTypes: {
			openParen: {toState: 'argVal'},
			binaryOp: {toState: 'expectOperand'},
			dot: {toState: 'traverse'},
			openBracket: {toState: 'filter'},
			openFind: {toState: 'find'},
			openIter: {toState: 'iter'},
			pipe: {toState: 'expectTransform'}
		},
		completable: true
	},
	postTransformArgs: {
		tokenTypes: {
			binaryOp: {toState: 'expectOperand'},
			dot: {toState: 'traverse'},
			openBracket: {toState: 'filter'},
			openFind: {toState: 'find'},
			openIter: {toState: 'iter'},
			pipe: {toState: 'expectTransform'}
		},
		completable: true
	},
	initialIdentifier: {
		tokenTypes: {
			equals: {toState: 'expectOperand'},
			binaryOp: {toState: 'expectOperand'},
			dot: {toState: 'traverse'},
			openBracket: {toState: 'filter'},
			openFind: {toState: 'find'},
			openIter: {toState: 'iter'},
			pipe: {toState: 'expectTransform'},
			identifier: {toState: 'identifier'},
			openParen: {toState: 'transformArgName', handler: h.transformAssignmentStart},
			question: {toState: 'ternaryMid', handler: h.ternaryStart}
		},
		completable: true
	},
	identifier: {
		tokenTypes: {
			binaryOp: {toState: 'expectOperand'},
			dot: {toState: 'traverse'},
			openBracket: {toState: 'filter'},
			openFind: {toState: 'find'},
			openIter: {toState: 'iter'},
			pipe: {toState: 'expectTransform'},
			identifier: {toState: 'identifier'},
			question: {toState: 'ternaryMid', handler: h.ternaryStart}
		},
		completable: true
	},
	lambdaArgName: {
		sub: {
			handler: h.argName,
			state: 'expectOperand'
		},
		endStates: {
			comma: 'lambdaArgName',
			closeParen: 'expectLambda'
		}
	},
	transformArgName: {
		sub: {
			handler: h.argName,
			state: 'expectOperand'
		},
		endStates: {
			comma: 'transformArgName',
			closeParen: 'expectTransformAssignment'
 		}
	},
	traverse: {
		tokenTypes: {
			identifier: {toState: 'identifier'}
		}
	},
	filter: {
		sub: {
			handler: h.filter,
			state: 'expectOperand'
		},
		endStates: {
			closeBracket: 'identifier'
		}
	},
	iter: {
		sub: {
			handler: h.iter,
			state: 'expectOperand'
		},
		endStates: {
			comma: 'reduce',
			closeIter: 'expectBinOp'
		}
	},
	find: {
		sub: {
			handler: h.find,
			state: 'expectOperand'
		},
		endStates: {
			closeIter: 'expectBinOp'
		}
	},
	reduce: {
		sub: {
			handler: h.reduce,
			state: 'expectOperand'
		},
		endStates: {
			closeIter: 'expectBinOp'
		}
	},
	assignmentEnd: {
		sub: {
			handler: h.assignmentEnd,
			state: 'expectOperand'
		},
		completable: true
	},
	subExpression: {
		sub: {
			handler: h.subExpression,
			state: 'expectOperand'
		},
		endStates: {
			closeParen: 'expectBinOp'
		}
	},
	subExpressionOrLambdaArgNames: {
		sub: {
			handler: h.subExpression,
			state: 'expectOperand'
		},
		endStates: {
			comma: 'lambdaArgNames',
			closeParen: 'expectBinOpOrLambda'
		}
	},
	lambdaArgNames: {
		sub: {
			handler: h.lambdaArgNames,
			state: 'expectOperand'
		},
		endStates: {
			comma: 'lambdaArgName',
			closeParen: 'expectLambda'
		}
	},
	argVal: {
		sub: {
			handler: h.argVal,
			state: 'expectArgVal'
		},
		endStates: {
			comma: 'argVal',
			closeParen: 'postTransformArgs'
		}
	},
	objVal: {
		sub: {
			handler: h.objVal,
			state: 'expectOperand'
		},
		endStates: {
			comma: 'expectObjKey',
			closeCurl: 'expectBinOp'
		}
	},
	arrayVal: {
		sub: {
			handler: h.arrayVal,
			state: 'expectOperand'
		},
		endStates: {
			comma: 'arrayVal',
			closeBracket: 'expectBinOp'
		}
	},
	ternaryMid: {
		sub: {
			handler: h.ternaryMid,
			state: 'expectOperand'
		},
		endStates: {
			colon: 'ternaryEnd'
		}
	},
	ternaryEnd: {
		sub: {
			handler: h.ternaryEnd,
			state: 'expectOperand'
		},
		completable: true
	}
};
