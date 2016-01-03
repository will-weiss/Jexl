/*
 * Jexl
 * Copyright (c) 2015 TechnologyAdvice
 */

var should = require('chai').should(),
  Lexer = require('../../lib/Lexer'),
  Parser = require('../../lib/parser/Parser'),
  grammar = require('../../lib/grammar').elements;

var inst,
  lexer = new Lexer(grammar);

function completeParse(exp) {
  var tokenized = lexer.tokenize(exp);
  // console.log(tokenized)

  inst.addTokens(tokenized);
  return inst.complete();
};

function simpleParse(exp) {
  return completeParse(exp).body[0];
}

describe('Parser', function() {
  beforeEach(function() {
    inst = new Parser(grammar, null, null, 'programStart');
  });
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
    simpleParse('foo 1 2').should.deep.equal({
      type: 'CallExpression',
      function: {
        type: 'CallExpression',
        function: {type: 'VariableIdentifier', value: 'foo'},
        argument: {type: 'Literal', value: 1}
      },
      argument: {type: 'Literal', value: 2}
    });
  });
  it('chains traversed identifiers', function() {
    simpleParse('foo.bar.baz + 1').should.deep.equal({
      type: 'BinaryExpression',
      operator: '+',
      left: {
        type: 'VariableIdentifier',
        value: 'baz',
        from: {
          type: 'VariableIdentifier',
          value: 'bar',
          from: {
            type: 'VariableIdentifier',
            value: 'foo'
          }
        }
      },
      right: {type: 'Literal', value: 1}
    });
  });
  it('allows dot notation for all operands', function() {
    simpleParse('"foo".length + {foo: "bar"}.foo').should.deep.equal({
      type: 'BinaryExpression',
      operator: '+',
      left: {
        type: 'VariableIdentifier',
        value: 'length',
        from: {type: 'Literal', value: 'foo'}
      },
      right: {
        type: 'VariableIdentifier',
        value: 'foo',
        from: {
          type: 'ObjectLiteral',
          value: {
            foo: {type: 'Literal', value: 'bar'}
          }
        }
      }
    });
  });
  it('allows dot notation on subexpressions', function() {
    simpleParse('("foo" + "bar").length').should.deep.equal({
      type: 'VariableIdentifier',
      value: 'length',
      from: {
        type: 'BinaryExpression',
        operator: '+',
        left: {type: 'Literal', value: 'foo'},
        right: {type: 'Literal', value: 'bar'}
      }
    });
  });
  it('allows dot notation on arrays', function() {
    simpleParse('["foo", "bar"].length').should.deep.equal({
      type: 'VariableIdentifier',
      value: 'length',
      from: {
        type: 'ArrayLiteral',
        value: [
          {type: 'Literal', value: 'foo'},
          {type: 'Literal', value: 'bar'}
        ]
      }
    });
  });
  it('handles a ternary expression', function() {
    simpleParse('foo ? 1 : 0').should.deep.equal({
      type: 'ConditionalExpression',
      test: {type: 'VariableIdentifier', value: 'foo'},
      consequent: {type: 'Literal', value: 1},
      alternate: {type: 'Literal', value: 0}
    });
  });
  it('handles nested and grouped ternary expressions', function() {
    simpleParse('foo ? (bar ? 1 : 2) : 3').should.deep.equal({
      type: 'ConditionalExpression',
      test: {type: 'VariableIdentifier', value: 'foo'},
      consequent: {
        type: 'ConditionalExpression',
        test: {type: 'VariableIdentifier', value: 'bar'},
        consequent: {type: 'Literal', value: 1},
        alternate: {type: 'Literal', value: 2}
      },
      alternate: {type: 'Literal', value: 3}
    });
  });
  it('handles nested, non-grouped ternary expressions', function() {
    simpleParse('foo ? bar ? 1 : 2 : 3').should.deep.equal({
      type: 'ConditionalExpression',
      test: {type: 'VariableIdentifier', value: 'foo'},
      consequent: {
        type: 'ConditionalExpression',
        test: {type: 'VariableIdentifier', value: 'bar'},
        consequent: {type: 'Literal', value: 1},
        alternate: {type: 'Literal', value: 2}
      },
      alternate: {type: 'Literal', value: 3}
    });
  });
  it('handles ternary expression with objects', function() {
    simpleParse('foo ? {bar: "tek"} : "baz"').should.deep.equal({
      type: 'ConditionalExpression',
      test: {type: 'VariableIdentifier', value: 'foo'},
      consequent: {
        type: 'ObjectLiteral',
        value: {
          bar: {type: 'Literal', value: 'tek'}
        }
      },
      alternate: {type: 'Literal', value: 'baz'}
    });
  });
  it('allows variable declarations', function() {
    simpleParse('foo = 5').should.deep.equal({
      type: 'VariableDeclaration',
      identifier: 'foo',
      right: {
        type: 'Literal',
        value: 5
      }
    });
  });
  it('allows enum type declarations', function() {
    simpleParse('Color = red | blue | yellow').should.deep.equal({
      type: 'TypeDeclaration',
      identifier: 'Color',
      right: {
        type: 'UnionExpression',
        left: {
          type: 'VariableIdentifier',
          value: 'red'
        },
        right: {
          type: 'UnionExpression',
          left: {
            type: 'VariableIdentifier',
            value: 'blue'
          },
          right: {
            type: 'VariableIdentifier',
            value: 'yellow'
          }
        }
      }
    });
  });
});
