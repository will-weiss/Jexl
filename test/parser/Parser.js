/*
 * Jexl
 * Copyright (c) 2015 TechnologyAdvice
 */

var should = require('chai').should(),
  Lexer = require('../../lib/Lexer'),
  Parser = require('../../lib/parser/Parser'),
  grammar = require('../../lib/grammar').elements;

var lexer = new Lexer(grammar);

function completeParse(exp) {
  var tokenized = lexer.tokenize(exp);
  var inst = new Parser(grammar, null, null, 'programStart');
  inst.addTokens(tokenized);
  return inst.complete();
};

function simpleParse(exp) {
  var tokenized = lexer.tokenize(exp);
  var inst = new Parser(grammar);
  inst.addTokens(tokenized);
  return inst.complete();
};

// function simpleParse(exp) {
//   return completeParse(exp).body[0];
// }

describe('Parser', function() {
  it('constructs an AST for 1+2', function() {
    simpleParse('1+2').should.deep.equal({
      type: 'BinaryExpression',
      operator: '+',
      left: {type: 'Literal', value: 1},
      right: {type: 'Literal', value: 2}
    });
  });
  it('adds heavier operations to the right for 2+3*4', function() {
    simpleParse('2+3*4').should.deep.equal({
      type: 'BinaryExpression',
      operator: '+',
      left: {type: 'Literal', value: 2},
      right: {
        type: 'BinaryExpression',
        operator: '*',
        left: {type: 'Literal', value: 3},
        right: {type: 'Literal', value: 4}
      }
    });
  });
  it('encapsulates for lighter operation in 2*3+4', function() {
    simpleParse('2*3+4').should.deep.equal({
      type: 'BinaryExpression',
      operator: '+',
      left: {
        type: 'BinaryExpression',
        operator: '*',
        left: {type: 'Literal', value: 2},
        right: {type: 'Literal', value: 3}
      },
      right: {type: 'Literal', value: 4}
    });
  });
  it('handles encapsulation of subtree in 2+3*4==5/6-7', function() {
    simpleParse('2+3*4==5/6-7').should.deep.equal({
      type: 'BinaryExpression',
      operator: '==',
      left: {
        type: 'BinaryExpression',
        operator: '+',
        left: {type: 'Literal', value: 2},
        right: {
          type: 'BinaryExpression',
          operator: '*',
          left: {type: 'Literal', value: 3},
          right: {type: 'Literal', value: 4}
        }
      },
      right: {
        type: 'BinaryExpression',
        operator: '-',
        left: {
          type: 'BinaryExpression',
          operator: '/',
          left: {type: 'Literal', value: 5},
          right: {type: 'Literal', value: 6}
        },
        right: {type: 'Literal', value: 7}
      }
    });
  });
  it('handles a unary operator', function() {
    simpleParse('1*!!true-2').should.deep.equal({
      type: 'BinaryExpression',
      operator: '-',
      left: {
        type: 'BinaryExpression',
        operator: '*',
        left: {type: 'Literal', value: 1},
        right: {
          type: 'UnaryExpression',
          operator: '!',
          right: {
            type: 'UnaryExpression',
            operator: '!',
            right: {type: 'Literal', value: true}
          }
        }
      },
      right: {type: 'Literal', value: 2}
    });
  });
  it('handles a subexpression', function() {
    simpleParse('(2+3)*4').should.deep.equal({
      type: 'BinaryExpression',
      operator: '*',
      left: {
        type: 'BinaryExpression',
        operator: '+',
        left: {type: 'Literal', value: 2},
        right: {type: 'Literal', value: 3}
      },
      right: {type: 'Literal', value: 4}
    });
  });
  it('handles nested subexpressions', function() {
    simpleParse('(4*(2+3))/5').should.deep.equal({
      type: 'BinaryExpression',
      operator: '/',
      left: {
        type: 'BinaryExpression',
        operator: '*',
        left: {type: 'Literal', value: 4},
        right: {
          type: 'BinaryExpression',
          operator: '+',
          left: {type: 'Literal', value: 2},
          right: {type: 'Literal', value: 3}
        }
      },
      right: {type: 'Literal', value: 5}
    });
  });
  it('handles object literals', function() {
    simpleParse('{foo: "bar", tek: 1+2}').should.deep.equal({
      type: 'ObjectLiteral',
      value: {
        foo: {type: 'Literal', value: 'bar'},
        tek: {
          type: 'BinaryExpression',
          operator: '+',
          left: {type: 'Literal', value: 1},
          right: {type: 'Literal', value: 2}
        }
      }
    });
  });
  it('handles nested object literals', function() {
    simpleParse('{foo: {bar: "tek"}}').should.deep.equal({
      type: 'ObjectLiteral',
      value: {
        foo: {
          type: 'ObjectLiteral',
          value: {
            bar: {type: 'Literal', value: 'tek'}
          }
        }
      }
    });
  });
  it('handles empty object literals', function() {
    simpleParse('{}').should.deep.equal({
      type: 'ObjectLiteral',
      value: {}
    });
  });
  it('handles array literals', function() {
    simpleParse('["foo", 1+2]').should.deep.equal({
      type: 'ArrayLiteral',
      value: [
        {type: 'Literal', value: 'foo'},
        {
          type: 'BinaryExpression',
          operator: '+',
          left: {type: 'Literal', value: 1},
          right: {type: 'Literal', value: 2}
        }
      ]
    });
  });
  it('handles nested array literals', function() {
    simpleParse('["foo", ["bar", "tek"]]').should.deep.equal({
      type: 'ArrayLiteral',
      value: [
        {type: 'Literal', value: 'foo'},
        {
          type: 'ArrayLiteral',
          value: [
            {type: 'Literal', value: 'bar'},
            {type: 'Literal', value: 'tek'}
          ]
        }
      ]
    });
  });
  it('handles empty array literals', function() {
    simpleParse('[]').should.deep.equal({
      type: 'ArrayLiteral',
      value: []
    });
  });
  it('applies functions', function() {
    simpleParse('foo bar 2').should.deep.equal({
      "type": "CallExpression",
      "function": {
        "type": "CallExpression",
        "function": {
          "type": "Identifier",
          "value": "foo"
        },
        "right": {
          "type": "Identifier",
          "value": "bar"
        }
      },
      "right": {
        "type": "Literal",
        "value": 2
      }
    });
  });
  it('applies functions using parens', function() {
    simpleParse('foo(5 + 7)').should.deep.equal({
      "type": "CallExpression",
      "function": {
        "type": "Identifier",
        "value": "foo"
      },
      "right": {
        "type": "BinaryExpression",
        "operator": "+",
        "left": {
          "type": "Literal",
          "value": 5
        },
        "right": {
          "type": "Literal",
          "value": 7
        }
      }
    });
  });
  it('applies more functions using parens', function() {
    simpleParse('foo(bar 5 7)').should.deep.equal({
      "type": "CallExpression",
      "function": {
        "type": "Identifier",
        "value": "foo"
      },
      "right": {
        "type": "CallExpression",
        "function": {
          "type": "CallExpression",
          "function": {
            "type": "Identifier",
            "value": "bar"
          },
          "right": {
            "type": "Literal",
            "value": 5
          }
        },
        "right": {
          "type": "Literal",
          "value": 7
        }
      }
    });
  });
  it('treats dot as function application', function() {
    simpleParse('foo.bar.baz + 1').should.deep.equal({
      type: 'BinaryExpression',
      operator: '+',
      left: {
        type: 'CallExpression',
        function: {
          "type": "Identifier",
          "value": "baz"
        },
        right: {
          type: 'CallExpression',
          function: {
            "type": "Identifier",
            "value": "bar"
          },
          right: {
            type: 'Identifier',
            value: 'foo'
          }
        }
      },
      right: {type: 'Literal', value: 1}
    });
  });
  it('treats dot as function application with additional arguments', function() {
    simpleParse('foo.slice(1)').should.deep.equal({
      type: 'CallExpression',
      function: {
        type: 'CallExpression',
        function: {
          "type": "Identifier",
          "value": "slice"
        },
        right: {
          type: 'Identifier',
          value: 'foo'
        }
      },
      right: {
        "type": "Literal",
        "value": 1
      },
    });
    simpleParse('foo.slice(1)').should.deep.equal(simpleParse('slice foo 1'));
  });
  it('allows variable declarations', function() {
    simpleParse('foo = 5').should.deep.equal({
      type: 'Definition',
      "left": {
        "type": "Identifier",
        "value": "foo"
      },
      right: {
        type: 'Literal',
        value: 5
      }
    });
  });
  it('allows enum type declarations', function() {
    simpleParse('Color = red | blue | yellow').should.deep.equal({
      type: 'Definition',
      left: {
        "type": "Identifier",
        "value": "Color"
      },
      right: {
        type: 'UnionExpression',
        left: {
          type: 'Identifier',
          value: 'red'
        },
        right: {
          type: 'UnionExpression',
          left: {
            type: 'Identifier',
            value: 'blue'
          },
          right: {
            type: 'Identifier',
            value: 'yellow'
          }
        }
      }
    });
  });
  it('recognizes typings', function() {
    simpleParse('foo: string = "b"').should.deep.equal({
      "type": "Definition",
      "varType": "string",
      "left": {
        "type": "Identifier",
        "value": "foo"
      },
      "right": {
        "type": "Literal",
        "value": "b"
      }
    });
  });
  it('recognizes function typings', function() {
    simpleParse('foo: string -> number -> boolean').should.deep.equal({
      "type": "Definition",
      "varType": ["string", "number", "boolean"],
      "left": {
        "type": "Identifier",
        "value": "foo"
      }
    });
  });
  it('recognizes function typings', function() {
    simpleParse('foo a b = a + b').should.deep.equal({
      "type": "Definition",
      "left": {
        "type": "CallExpression",
        "function": {
          "type": "CallExpression",
          "function": {
            "type": "Identifier",
            "value": "foo",
          },
          "right": {
            "type": "Identifier",
            "value": "a",
          },
        },
        "right": {
          "type": "Identifier",
          "value": "b",
        },
      },
      "right": {
        "type": "BinaryExpression",
        "operator": "+",
        "left": {
          "type": "Identifier",
          "value": "a",
        },
        "right": {
          "type": "Identifier",
          "value": "b",
        },
      },
    });
  });
  it('throws on multiple definitions', function() {
    return simpleParse.bind(null, 'foo = bar = baz').should.throw();
  });
  it('throws on relative definitions', function() {
    return simpleParse.bind(null, '[a = 5]').should.throw();
  });
  it('throws on relative definitions', function() {
    return simpleParse.bind(null, '(a = 5)').should.throw();
  });



  // it('allows dot notation for all operands', function() {
  //   simpleParse('"foo".length + {foo: "bar"}.foo').should.deep.equal({
  //     type: 'BinaryExpression',
  //     operator: '+',
  //     left: {
  //       type: 'Identifier',
  //       value: 'length',
  //       from: {type: 'Literal', value: 'foo'}
  //     },
  //     right: {
  //       type: 'Identifier',
  //       value: 'foo',
  //       from: {
  //         type: 'ObjectLiteral',
  //         value: {
  //           foo: {type: 'Literal', value: 'bar'}
  //         }
  //       }
  //     }
  //   });
  // });
  // it('allows dot notation on subexpressions', function() {
  //   simpleParse('("foo" + "bar").length').should.deep.equal({
  //     type: 'Identifier',
  //     value: 'length',
  //     from: {
  //       type: 'BinaryExpression',
  //       operator: '+',
  //       left: {type: 'Literal', value: 'foo'},
  //       right: {type: 'Literal', value: 'bar'}
  //     }
  //   });
  // });
  // it('allows dot notation on arrays', function() {
  //   simpleParse('["foo", "bar"].length').should.deep.equal({
  //     type: 'Identifier',
  //     value: 'length',
  //     from: {
  //       type: 'ArrayLiteral',
  //       value: [
  //         {type: 'Literal', value: 'foo'},
  //         {type: 'Literal', value: 'bar'}
  //       ]
  //     }
  //   });
  // });
});
