var Lexed = require('./Lexed'),
	preOpRegexElems = [
		// Strings
		"'(?:(?:\\\\')?[^'])*'",
		'"(?:(?:\\\\")?[^"])*"',
		// Booleans
		'\\btrue\\b',
		'\\bfalse\\b'
		// Null
		'\\bnull\\b'
	],
	postOpRegexElems = [
		// Identifiers & Types
		'\\b[a-zA-Z][a-zA-Z0-9_\\$]*\\b',
		// Numerics (without negative symbol)
		'(?:(?:[0-9]*\\.[0-9]+)|[0-9]+)'
	];

function Lexer(grammar) {
	this._grammar = grammar;
	this._regex = getSplitRegex(grammar);
}

Lexer.prototype.getElements = function(str) {
	return str.split(this._regex).filter(function(elem) {
		// Remove empty strings
		return elem;
	});
};

Lexer.prototype.tokenize = function(str) {
	return new Lexed(this, str);
};

function escapeRegExp(str) {
	str = str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	if (str.match(identRegex))
		str = '\\b' + str + '\\b';
	return str;
};

function getSplitRegex(grammar) {
	// Sort by most characters to least, then regex escape each
	var elemArray = Object.keys(grammar).sort(function(a, b) {
		return b.length - a.length;
	}).map(escapeRegExp);
	return new RegExp('(' + [
		'^\\s+',
		preOpRegexElems.join('|'),
		elemArray.join('|'),
		postOpRegexElems.join('|')
	].join('|') + ')');
};

module.exports = Lexer;
