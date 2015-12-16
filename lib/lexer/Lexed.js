var numericRegex = /^-?(?:(?:[0-9]*\.[0-9]+)|[0-9]+)$/,
	identRegex = /^[a-z][a-zA-Z0-9_\$]*$/,
	typeRegex = /^[A-Z][a-zA-Z0-9_\$]*$/,
	escEscRegex = /\\\\/;

function Token(lexed, elem) {
	if (elem[0] == '"' || elem[0] == "'") {
		this.type = 'stringLiteral';
		this.value = unquote(elem);
	} else if (elem.match(numericRegex)) {
		this.type = 'numberLiteral';
		this.value = parseFloat(elem);
	} else if (elem === 'true' || elem === 'false') {
		this.type = 'booleanLiteral';
		this.value = elem === 'true';
	} else if (elem === 'null') {
		this.type = 'nullLiteral';
		this.value = null;
	} else if (lexed.grammar[elem]) {
		this.type = lexed.grammar[elem].type;
		this.value = elem;
	} else if (elem.match(identRegex)) {
		this.type = 'identifier';
		this.value = elem;
	} else if (elem.match(typeRegex)) {
		this.type = 'type';
		this.value = elem;
	} else
		throw new Error("Invalid expression token: " + element);
	this.raw = elem;
	this.lineIx = lexed.lines.length;
	this.charIx = lexed.line.str.length;
}

function Line(lexed) {
	this._lexed = lexed;
	this.tokens = [];
	this.bindLexed(lexed);
}

Line.prototype.str = '';
Line.prototype.leadingWhitespace = '';

Line.prototype.addToken = function(elem) {
	var tokens = this.tokens,
		notWhitespace = elem !== ' ' && elem !== '\t';
	if (notWhitespace)
		tokens.push(new Token(this._lexed, elem));
	else if (!this.tokens.length)
		this.leadingWhitespace += elem;
	else
		tokens[tokens.length - 1].raw += elem;
	this.str += elem;
};

function Lexed(lexer, str) {
	this.str = str;
	this.lines = [];
	this.addLine();
	this.grammar = lexer.grammar;
	lexer.getElements(str).forEach(this.addToken, this);
}

Lexed.prototype.addLine = function() {
	this.line = new Line(this);
	this.lines.push(this.line);
};

Lexed.prototype.addToken = function(elem) {
	if (elem !== '\n')
		this.line.addToken(elem);
	else
		this.addLine();
};

function unquote(str) {
	var quote = str[0],
		escQuoteRegex = new RegExp('\\\\' + quote, 'g');
	return str.substr(1, str.length - 2)
		.replace(escQuoteRegex, quote)
		.replace(escEscRegex, '\\');
};
