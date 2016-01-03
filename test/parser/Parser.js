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

function parse(exp) {
  var tokenized = lexer.tokenize(exp);
  var inst = new Parser(grammar);
  inst.addTokens(tokenized);
  return inst.complete();
};

// function parse(exp) {
//   return completeParse(exp).body[0];
// }

describe('Parser', function() {
  it('constructs an AST for 1+2', function() {
    parse('1+2').should.deep.equal({
      type: 'BinaryExpression',
      operator: '+',
      left: {type: 'Literal', value: 1},
      right: {type: 'Literal', value: 2}
    });
  });
  it('adds heavier operations to the right for 2+3*4', function() {
    parse('2+3*4').should.deep.equal({
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
    parse('2*3+4').should.deep.equal({
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
    parse('2+3*4==5/6-7').should.deep.equal({
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
    parse('1*!!true-2').should.deep.equal({
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
    parse('(2+3)*4').should.deep.equal({
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
    parse('(4*(2+3))/5').should.deep.equal({
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
    parse('{foo: "bar", tek: 1+2}').should.deep.equal({
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
    parse('{foo: {bar: "tek"}}').should.deep.equal({
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
    parse('{}').should.deep.equal({
      type: 'ObjectLiteral',
      value: {}
    });
  });
  it('handles array literals', function() {
    parse('["foo", 1+2]').should.deep.equal({
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
    parse('["foo", ["bar", "tek"]]').should.deep.equal({
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
    parse('[]').should.deep.equal({
      type: 'ArrayLiteral',
      value: []
    });
  });
  it('applies functions', function() {
    parse('foo bar 2').should.deep.equal({
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
    parse('foo(5 + 7)').should.deep.equal({
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
    parse('foo(bar 5 7)').should.deep.equal({
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
    parse('foo.bar.baz + 1').should.deep.equal({
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
    parse('foo.slice(1)').should.deep.equal({
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
    parse('foo.slice(1)').should.deep.equal(parse('slice foo 1'));
  });
  it('allows variable declarations', function() {
    parse('foo = 5').should.deep.equal({
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
    parse('Color = red | blue | yellow').should.deep.equal({
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
    parse('foo: string = "b"').should.deep.equal({
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
    parse('foo: string -> number -> boolean').should.deep.equal({
      "type": "Definition",
      "varType": ["string", "number", "boolean"],
      "left": {
        "type": "Identifier",
        "value": "foo"
      }
    });
  });
  it('recognizes function typings', function() {
    parse('foo a b = a + b').should.deep.equal({
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
    parse.bind(null, 'foo = bar = baz').should.throw();
  });
  it('throws on relative definitions', function() {
    parse.bind(null, '[a = 5]').should.throw();
    parse.bind(null, '(a = 5)').should.throw();
  });
  it('parses record syntax', function() {
    parse('foo = a Foo { a = 3 }').should.deep.equal({

    });
  });
});
