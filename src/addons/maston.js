define(['mathlive/core/definitions', 'mathlive/core/mathAtom'],
    function(Definitions, MathAtom) {

        /**
 * Return the operator precedence of the atom
 * or -1 if not an operator
 * @param {*} atom 
 * @return {number}
 */
function opPrec(atom) {
    if (!atom) return -1;
    return Definitions.getPrecedence(
        Definitions.getCanonicalName(atom.latex || atom.value));
}

const RIGHT_DELIM = {
    '(':    ')',
    '{':    '}',
    '[':    ']',
    '|':    '|',
    '\\lbrace': '\\rbrace',
    '\\langle': '\\rangle',
    '\\lfloor': '\\rfloor',
    '\\lceil':  '\\rceil',
    '\\vert':   '\\vert',
    '\\lvert':  '\\rvert',
    '\\Vert':   '\\Vert',
    '\\lVert':  '\\rVert',
    '\\lbrack': '\\rbrack',
    '\\ulcorner':   '\\urcorner',
    '\\llcorner':   '\\lrcorner',
    '\\lgroup': '\\rgroup',
    '\\lmoustache': '\\rmoustache'
}

const DELIM_FUNCTION = {
    '\\lfloor\\rfloor': 'floor',
    '\\lceil\\rceil': 'ceil',
    '\\vert\\vert': 'abs',
    '\\lvert\\rvert': 'abs',
    '||': 'abs',
    '\\Vert\\Vert': 'norm',
    '\\lVert\\rVert': 'norm',
    '\\ulcorner\\urcorner': 'ucorner',
    '\\llcorner\\lrcorner': 'lcorner',
    '\\langle\\rangle': 'angle',
    '\\lgroup\\rgroup': 'group',
    '\\lmoustache\\rmoustache': 'moustache',
    '\\lbrace\\rbrace': 'brace'
}

const POSTFIX_FUNCTION = {
    '!':    'factorial',
    '\\dag': 'dagger',
    '\\dagger': 'dagger',
    '\\ddager': 'dagger2',
    '\\maltese': 'maltese',
    '\\backprime': 'backprime',
    '\\backdoubleprime': 'backprime2',
    '\\prime':  'prime',
    '\\doubleprime': 'prime2',
    '\\$': '$',
    '\\%': '%',
    '\\_': '_',
    '\\degree': 'degree'
}

/**
 * 
 * @param {Object} expr -- Abstract Syntax Tree object
 * @return {string} -- A string, the symbol, or undefined
 */
function asSymbol(expr) {
    let result = expr;
    if (typeof result !== 'string') {
        result = expr !== undefined ? expr.sym : undefined;
    }
    if (result) {
        const latex = Definitions.getLatexForSymbol(result);
        result = latex || result;
    }
    return result;
}



/**
 * 
 * @param {Object} num -- Abstract Syntax Tree object
 * @return {number} -- A Javascript number, the value of the AST or NaN
 */
function asNumber(num) {
    const BUILT_IN_CONSTANTS = {
        'π':        Math.PI,
        '\u03c4':   2 * Math.PI,            // GREEK SMALL LETTER TAU
        '\u212f':   Math.E,                 // ℯ SCRIPT SMALL E
        '\u2147':   Math.E,                 // ⅇ DOUBLE-STRUCK ITALIC SMALL E 
        'e':        Math.E,
        '\u03d5':   1.618033988749895      //  GREEK SMALL LETTER PHI
    }
    let result = undefined;
    if (num !== undefined) {
        if (num.num !== undefined) {
            result = parseFloat(num.num);
        } else if (asSymbol(num)) {
            if (BUILT_IN_CONSTANTS[asSymbol(num)]) {
                result = BUILT_IN_CONSTANTS[asSymbol(num)];
            }
        } else if (typeof num === 'number') {
            result = parseFloat(num);
        }
    }
    return result;
}

function isNumber(expr) {
    return asNumber(expr) !== undefined;
}

/**
 * Return true if the current atom is of the specified type and value.
 * @param {Object} expr 
 * @param {string} type 
 * @param {string} value 
 */
function isAtom(expr, type, value) {
    let result = false;
    const atom = expr.atoms[expr.index];
    if (atom && atom.type === type) {
        if (value === undefined) {
            result = true;
        } else {
            if (type === 'mord' || type === 'mbin' || type === 'mrel' || type === 'mop') {
                result = (atom.latex && atom.latex.trim() === value) || atom.value === value;
            } else if (type === 'textord') {
                result = atom.latex.trim() === value;
            } else {
                result = atom.value === value;
            }
        }
    }
    return result;
}



/**
 * Parse for a possible sup/sub at the current token location.
 * Handles both sup/sub attached directly to the current atom 
 * as well as "empty" atoms with a sup/sub following the current
 * atom.
 * @param {Object} expr 
 */
function parseSupsub(expr) {
    let atom = expr.atoms[expr.index - 1];

    // Is there a supsub directly on this atom?
    if (!atom || !(atom.superscript || atom.subscript)) {
        atom = null;
    }

    // Is the following atom a subsup atom?
    if (!atom) {
        atom = expr.atoms[expr.index];
        if (isAtom(expr, 'mord', '\u200b') && (atom.superscript || atom.subscript)) {
            expr.index += 1;
        } else {
            atom = null;
        }
    }

    if (atom) {
        if (typeof expr.ast === 'string') {
            expr.ast = {sym: expr.ast};            
        } else if (typeof expr.ast === 'number') {
            expr.ast = {num: expr.ast};            
        } else if (!expr.ast.group && !expr.ast.fn && !expr.ast.sym) {
            expr.ast = {group: expr.ast};
        }
        if (atom.subscript) expr.ast.sub = parse(atom.subscript);
        if (atom.superscript) expr.ast.sup = parse(atom.superscript);
    }

    return expr;
}


/**
 * Parse postfix operators, such as "!" (factorial)
 */
function parsePostfix(expr) {
    const atom = expr.atoms[expr.index];
    const lhs = expr.ast;
    const digraph = parseDigraph(expr);
    if (digraph) {
        expr.ast = {op: digraph.ast, lhs: lhs};
        expr = parseSupsub(expr);
        expr = parsePostfix(expr);
    } else if (atom && atom.type === 'textord' && POSTFIX_FUNCTION[atom.latex.trim()]) {
        expr.index += 1;
        expr.ast = {fn: POSTFIX_FUNCTION[atom.latex.trim()], arg: lhs};
        expr = parseSupsub(expr);
        expr = parsePostfix(expr);
    }
    return expr;
}



/**
 * Delimiters can be expressed:
 * - as a matching pair of regular characters: '(a)'
 * - a as 'leftright' expression: '\left(a\right)'
 * - as a matching pair of 'sizeddelim': '\Bigl(a\Bigr)
 * 
 * Note that the '\delim' command is only used for delimiters in the middle
 * of a \left\right pair and not to represent pair-matched delimiters.
 * 
 * This function handles all three cases
 * 
 */ 
 function parseDelim(expr, ldelim, rdelim) {
    expr.index = expr.index || 0;

    if (expr.atoms.length === 0 || expr.index >= expr.atoms.length) {
        expr.ast = undefined;
        return expr;
    }
    
    let atom = expr.atoms[expr.index];

    if (!ldelim) {
        // If we didn't expect a specific delimiter, parse any delimiter
        // and return it as a function application
        let pairedDelim = true;
        if (atom.type === 'mopen') {
            ldelim = atom.latex.trim();
            rdelim = RIGHT_DELIM[ldelim];
        } else if (atom.type === 'sizeddelim') {
            ldelim = atom.delim;
            rdelim = RIGHT_DELIM[ldelim];
        } else if (atom.type === 'leftright') {
            pairedDelim = false;
            ldelim = atom.leftDelim;
            rdelim = atom.rightDelim;
        } else if (atom.type === 'textord') {
            ldelim = atom.latex.trim();
            rdelim = RIGHT_DELIM[ldelim];
        }
        if (ldelim && rdelim) {
            expr = parseDelim(expr, ldelim, rdelim);
            if (expr) {
                if (pairedDelim) expr.index += 1;
                expr.ast = {
                    fn: DELIM_FUNCTION[ldelim + rdelim] || (ldelim + rdelim),
                    arg: expr.ast};
                return expr;
            }
        }
        return undefined;
    }

    if (atom.type === 'mopen' && (atom.latex.trim() === ldelim || atom.value === ldelim)) {
        expr.index += 1;    // Skip the open delim
        expr = parseExpression(parsePrimary(expr));
        atom = expr.atoms[expr.index];
        if (atom && atom.type === 'mclose' && 
            (atom.latex.trim() === rdelim || atom.value === rdelim)) {
            expr.index += 1;
            expr = parseSupsub(expr);
            expr = parsePostfix(expr);
        } // TODO: else, syntax error?

    } else if (atom.type === 'textord' && (atom.latex.trim() === ldelim || atom.value === ldelim)) {
            expr.index += 1;    // Skip the open delim
            expr = parseExpression(parsePrimary(expr));
            atom = expr.atoms[expr.index];
            if (atom && atom.type === 'textord' && 
                (atom.latex.trim() === rdelim || atom.value === rdelim)) {
                expr.index += 1;
                expr = parseSupsub(expr);
                expr = parsePostfix(expr);
            } // TODO: else, syntax error?
    
    } else if (atom.type === 'sizeddelim' && atom.delim === ldelim) {
        expr.index += 1;    // Skip the open delim
        expr = parseExpression(parsePrimary(expr));
        atom = expr.atoms[expr.index];
        if (atom && atom.type === 'sizeddelim' && atom.delim === rdelim) {
            expr.index += 1;
            expr = parseSupsub(expr);
            expr = parsePostfix(expr);
        } // TODO: else, syntax error?

    } else if (atom.type === 'leftright' && 
        atom.leftDelim === ldelim && 
        atom.rightDelim === rdelim) {
        // This atom type includes the content of the parenthetical expression 
        // in its body
        expr.ast = parse(atom.body);
        expr.index += 1;
        expr = parseSupsub(expr);
        expr = parsePostfix(expr);

    } else {
        return undefined;
    }

    return expr;
}


/** 
 * Some symbols are made up of two consecutive characters.
 * Handle them here. Return undefined if not a digraph.
 * TODO: other digraphs:
 * :=
 * ++
 * **
 * =:
 * °C U+2103
 * °F U+2109
 * 
*/
function parseDigraph(expr) {
    expr.index = expr.index || 0;

    if (expr.atoms.length === 0 || expr.index >= expr.atoms.length) {
        return undefined;
    }
    
    if (isAtom(expr, 'textord', '\\nabla')) {
        expr.index += 1;
        if (isAtom(expr, 'mbin', '\\times')) {
            expr.index += 1;
            expr.ast = 'curl';   // divergence
            return expr;
        } else if (isAtom(expr, 'mbin', '\\cdot')) {
            expr.index += 1;
            expr.ast = 'div';  
            return expr;
        }
        expr.index -= 1;
    } else if (isAtom(expr, 'textord', '!')) {
        expr.index += 1;
        if (isAtom(expr, 'textord', '!')) {
            expr.index += 1;
            expr.ast = 'factorial2';
            return expr;
        }
        expr.index -= 1;
    }

    return undefined;
}


function parsePrimary(expr) {

    // <primary> := ('-'|'+) <primary> | <number> | '(' <expression> ')' | <symbol> 

     expr.index = expr.index || 0;
     expr.ast = undefined;

    if (expr.atoms.length === 0 || expr.index >= expr.atoms.length) {
        return expr;
    }
    
    let atom = expr.atoms[expr.index];
    const val = Definitions.getCanonicalName(atom.latex || atom.value);

    const digraph = parseDigraph(expr);
    if (digraph) {
        // expr = parseSupsub(expr);
        const fn = {op: expr.ast};
        fn.lhs = parsePrimary(expr).ast;
        expr.ast = fn;

    } else if (atom.type === 'mbin' && (val === '-' || val === '+')) {
        // Prefix + or - sign
        expr.index += 1;  // Skip the '+' or '-' symbol
        atom = expr.atoms[expr.index];
        expr = parsePrimary(expr);
        if (atom && '0123456789.'.indexOf(atom.latex) >= 0) {
            if (expr.ast.num && typeof expr.ast.num === 'number') {
                expr.ast.num = val === '-' ? -expr.ast.num : expr.ast.num;
            } else if (typeof expr.ast === 'number') {
                expr.ast = val === '-' ? -expr.ast : expr.ast;
            } else {
                expr.ast = {op: val, rhs: expr.ast};
            }
        } else {
            expr.ast = {op: val, rhs: expr.ast};
        }

    } else if ((atom.type === 'mord' && '0123456789.'.indexOf(atom.latex) >= 0)
         || isAtom(expr, 'mpunct', ',')) {
        // Looks like a number
        let num = '';
        let done = false;
        let pat = '0123456789,.eEdD';
        while (expr.index < expr.atoms.length && !done && (isAtom(expr, 'spacing') ||
                (
                    (
                        isAtom(expr, 'mord') || 
                        isAtom(expr, 'mpunct', ',') || 
                        isAtom(expr, 'mbin')
                    ) &&
                        pat.indexOf(expr.atoms[expr.index].latex) >= 0
                    )
                )
            ) {
            if (expr.atoms[expr.index].type === 'spacing') {
                expr.index += 1;
            } else {
                let digit = expr.atoms[expr.index].latex;
                if (digit === 'd' || digit === 'D') {
                    digit = 'e';
                    pat = '0123456789.+-'
                } else if (digit === 'e' || digit === 'E') {
                    pat = '0123456789.+-'
                } else if (pat === '0123456789.+-') {
                    pat = '0123456789';
                }
                num += digit === ',' ? '' : digit;
                if (atom.superscript !== undefined || atom.underscript !== undefined) {
                    done = true; 
                } else {
                    expr.index += 1;
                }                
            }
        }
        expr.ast = parseFloat(num);

        // This was a number. Is it followed by a fraction, e.g. 2 1/2
        atom = expr.atoms[expr.index];
        if (atom && atom.type === 'genfrac' && 
            (expr.ast.num !== undefined || !isNaN(expr.ast))) {
            // Add an invisible plus, i.e. 2 1/2 = 2 + 1/2
            const lhs = expr.ast;
            expr = parsePrimary(expr);
            expr.ast = {lhs: lhs, op:'+', rhs: expr.ast};
        }   
        expr = parseSupsub(expr);
        expr = parsePostfix(expr);
        
    } else if (atom.type === 'genfrac' || atom.type === 'surd') {
        expr.index += 1;
        expr.ast = atom.toAST();
        expr = parseSupsub(expr);
        expr = parsePostfix(expr);

    } else if (atom.type === 'mord') {
        // A 'mord' but not a number, either an identifier ('x') or a function
        // ('\\Zeta')
        const name = Definitions.getCanonicalName(atom.latex || atom.value);
        if (Definitions.isFunction(name) && opPrec(atom) < 0) {
            // A function
            expr.ast = {fn: name};
            expr = parseSupsub(expr);

            const fn = expr.ast;
            expr.index += 1;  // Skip the function name
            fn.arg = parsePrimary(expr).ast;
            expr.ast = fn;
                
            expr = parsePostfix(expr);
        } else {
            // An identifier
            expr.ast = atom.toAST();
            if (atom.superscript === undefined) {
                expr.index += 1;
            }
            expr = parseSupsub(expr);
            expr = parsePostfix(expr);
        }

    } else if (atom.type === 'textord') {
        // Note that 'textord' can also be operators, and are handled as such 
        // in parseExpression()
        if (opPrec(atom) < 0) {
            // This doesn't look like a textord operator
            if (!RIGHT_DELIM[atom.latex.trim()]) {
                // Not an operator, not a fence, it's a symbol or a function
                const name = Definitions.getCanonicalName(atom.latex || atom.value);
                if (Definitions.isFunction(name)) {
                    // It's a function
                    expr.ast = {fn: name};
                    expr = parseSupsub(expr);
        
                    const fn = expr.ast;
                    expr.index += 1;  // Skip the function name
                    fn.arg = parsePrimary(expr).ast;
                    expr.ast = fn;
                        
                    expr = parsePostfix(expr);
                            
                } else {
                    // It was a symbol...
                    expr.ast = atom.toAST();
                    if (atom.superscript === undefined) {
                        expr.index += 1;
                    }
                    expr = parseSupsub(expr);
                    expr = parsePostfix(expr);
                }
            }
        }

    } else if (atom.type === 'mop') {
        // Could be a function or an operator.
        const name = Definitions.getCanonicalName(atom.latex || atom.value);
        if (Definitions.isFunction(name) && opPrec(atom) < 0) {
            expr.index += 1;
            expr.ast = {fn: name};
            expr = parseSupsub(expr);

            if (expr.ast.sup) {
                // There was an exponent with the function. 
                if (expr.ast.sup === -1 || (expr.ast.sup.op === '-' && expr.ast.sup.rhs === 1)) {
                    // This is the inverse function
                    const INVERSE_FUNCTION = {
                        'sin' : 'arcsin',
                        'cos':  'arccos',
                        'tan':  'arctan',
                        'cot':  'arccot',
                        'sec':  'arcsec',
                        'csc':  'arccsc',
                        'sinh': 'arsinh',
                        'cosh': 'arcosh',
                        'tanh': 'artanh',
                        'csch': 'arcsch',
                        'sech': 'arsech',
                        'coth': 'arcoth'
                    };
                    if (INVERSE_FUNCTION[expr.ast.fn]) {
                        const fn = {fn: INVERSE_FUNCTION[expr.ast.fn]};
                        fn.arg = parsePrimary(expr).ast;
                        expr.ast = fn;
                    } else {
                        const fn = expr.ast;
                        fn.arg = parsePrimary(expr).ast;
                        expr.ast = fn;
                    }
                } else {
                    // Keep the exponent, add the argument
                    const fn = expr.ast;
                    fn.arg = parsePrimary(expr).ast;
                    expr.ast = fn;
                }

            } else {
                const fn = expr.ast;
                fn.arg = parsePrimary(expr).ast;
                expr.ast = fn;
            }
        }
    } else if (atom.type === 'font') {
        expr.ast = atom.toAST();
        if (atom.superscript === undefined) {
            expr.index += 1;
        }
        expr = parseSupsub(expr);
        expr = parsePostfix(expr);
}


    if (expr.ast === undefined) {
        // Parse either a group of paren, and return their content as the result
        // or a pair of delimiters, and return them as a function applied 
        // to their content, i.e. "|x|" -> {fn: "||", arg: "x"}
        const delim = parseDelim(expr, '(', ')') || parseDelim(expr);
        if (delim) {
            expr = delim;
        } else {
            if (opPrec(atom) < 0) {
                // This is not an operator (if it is, it may be an operator 
                // dealing with an empty lhs. It's possible.
                // Couldn't interpret the expression. Output an error.
                expr.ast = {text: '?'};
                expr.ast.error = 'Unexpected token ' + 
                    "'" + atom.type + "' = " + atom.value + ' = ' + atom.latex;
                expr.index += 1;    // Skip the unexpected token, and attempt to continue
            }
        }
    }

    atom = expr.atoms[expr.index];
    if (atom && (atom.type === 'mord' || 
            atom.type === 'surd' || 
            atom.type === 'mop' || 
            atom.type === 'mopen' || 
            atom.type === 'sizeddelim' || 
            atom.type === 'leftright')) {
        if (atom.type === 'sizeddelim') {
            for (const d in RIGHT_DELIM) {
                if (atom.delim === RIGHT_DELIM[d]) {
                    // This is (most likely) a closing delim, exit.
                    // There are ambiguous cases, for example |x|y|z|.
                    expr.index += 1;
                    return expr;
                }
            }
        }
        if ((atom.type === 'mord' || atom.type === 'textord' || atom.type === 'mop') && opPrec(atom) >= 0) {
            // It's actually an operator
            return expr;
        }
        const lhs = expr.ast;
        expr = parsePrimary(expr);
        if ((lhs === 'f' || lhs === 'g') && expr && expr.ast) {
            // TODO: need to parse multiple arguments, e.g. f(x, y)
            expr.ast  = {fn: lhs, arg: expr.ast};
        } else if (expr && expr.ast) {
            // Invisible times, e.g. '2x'
            expr.ast = {lhs: lhs, op:'*', rhs: expr.ast};
        } else {
            expr.ast = lhs;
        }
    }

    return expr;
}

/**
 * Given an atom or an array of atoms, return their MathML representation as 
 * a string.
 * @param {Object} expr An expressions, including expr.atoms, expr.index, 
 * expr.minPrec the minimum precedence that this parser should parse
 * before returning; expr.lhs (optional); expr.ast, the resulting AST.
 * @return {Object} the expr object, updated
 * @private
 */
function parseExpression(expr) {
    expr.minPrec = expr.minPrec || 0;
    expr.index = expr.index || 0;

    if (expr.atoms.length === 0 || expr.index >= expr.atoms.length) {
        return expr;
    }
    
    let atom = expr.atoms[expr.index];

    let lhs = expr.ast;
    expr.lhs = undefined;
    while (atom && (atom.type === 'delim' || opPrec(atom) >= expr.minPrec)) {
        const opName = parseDigraph(expr) || Definitions.getCanonicalName(atom.latex);
        atom = expr.atoms[expr.index];  // parseDigraph may have avanced to the next token.
        const opPrecedence = opPrec(atom);
        expr.index += 1;    // advance to next token
        let rhs = parsePrimary(expr).ast;
        atom = expr.atoms[expr.index];
        while (atom && (atom.type === 'delim' || opPrec(atom) >= opPrecedence)) {
            expr.lhs = rhs;
            expr.minPrec = opPrec(atom);
            rhs = parseExpression(expr).ast;
            atom = expr.atoms[expr.index];
        }
        lhs = {lhs: lhs, op: opName, rhs: rhs}
    }

    expr.ast = lhs;

    return expr;
}



function toString(atoms) {
    let result = '';
    for (const atom of atoms) {
        if (atom.type === 'textord' || atom.type === 'mord') {
            result += atom.value;
        }
    }
    return escapeText(result);
}


/**
 * Return a string escaped as necessary to comply with the JSON format
 * @param {string} s 
 * @return {string}
 */
function escapeText(s) {
    return s
    .replace(/[\\]/g, '\\\\')
    .replace(/["]/g, '\\"')
    .replace(/[\b]/g, "\\b")
    .replace(/[\f]/g, "\\f")
    .replace(/[\n]/g, "\\n")
    .replace(/[\r]/g, "\\r")
    .replace(/[\t]/g, "\\t");
}

/**
 * Return an AST representation of a single atom
 * 
 * @return {Object}
 */
MathAtom.MathAtom.prototype.toAST = function() {
    const MATH_VARIANTS = {
        'mathrm':   'normal',
        'mathbb': 'double-struck',
        'mathbf': 'bold',
        'mathcal': 'script',
        'mathfrak': 'fraktur',
        'mathscr': 'script',
        'mathsf': 'sans-serif',
        'mathtt': 'monospace'
    };
    // TODO: See https://www.w3.org/TR/MathML2/chapter6.html#chars.letter-like-tables

    let result = {};
    let sym = '';
    const variant = MATH_VARIANTS[this.fontFamily || this.font];

    const command = this.latex ? this.latex.trim() : null;
    switch(this.type) {
        case 'root':
            result.group = parse(this.children);
            break;

        case 'genfrac':
            // @todo: deal with fracs delimiters, hasBarLine === false
            result.lhs = parse(this.numer);
            result.op = '/';
            result.rhs = parse(this.denom);
            break;

        case 'surd':
            if (this.index) {
                result.fn = 'pow';
                result.arg = [parse(this.body)];
                result.arg[1] = {lhs: 1, op: '/', rhs: parse(this.index)};
            } else {
                result.fn = 'sqrt';
                result.arg = parse(this.body);
            }
            break;

        case 'rule':
            break;

        case 'font':
            if (this.latex === '\\text ') {
                result.text = toString(this.body);
                if (this.toLatex) {
                    result.latex = this.toLatex();
                }
            } else {
                result.sym = toString(this.body);
            }
            break;

        case 'line':
        case 'overlap':
        case 'accent':
            break;

        case 'overunder':
            break;

        case 'mord':
        case 'textord':
            sym = Definitions.getCanonicalName(command || this.value);
            if (sym.length > 0 && sym.charAt(0) === '\\') {
                // This is an identifier with no special handling. 
                // Use the Unicode value if outside ASCII range
                if (this.value) {
                    // TODO: consider making this an option?
                    // if (this.value.charCodeAt(0) > 255) {
                    //     sym = '&#x' + ('000000' + 
                    //         this.value.charCodeAt(0).toString(16)).substr(-4) + ';';
                    // } else {
                        sym = this.value.charAt(0);
                    // }
                }
            }
            if (variant) {
                result.sym = escapeText(sym);
            } else {
                result = escapeText(sym);       // Shortcut: symbol as string
            }
            break;

        // case 'mbin':
        // break;

        // case 'mpunct':
        //     result = '<mo separator="true">' + command + '</mo>';
        //     break;

        case 'minner':
            break;

        case 'op':
        case 'mop':
            break;

        case 'color':
            break;
        case 'box':
            break;

        case 'enclose':
            // result = '<menclose notation="';
            // for (const notation in this.notation) {
            //     if (this.notation.hasOwnProperty(notation) && 
            //         this.notation[notation]) {
            //         result += sep + notation;
            //         sep = ' ';
            //     }
            // }
            // result += '">' + toAST(this.body).mathML + '</menclose>';
            break;

        case 'spacing':
        case 'space':
        case 'sizing':
        case 'mathstyle':
            break;
        default: 
            console.log('Unhandled atom ' + this.type + ' - ' + this.value);
            
    }

    if (variant) {
        result.variant = variant;
    }

    return result;
}

/**
 * 
 * @param {*} atoms an array of atoms
 * @return  {string}
 */
function parse(atoms) {

    return parseExpression(parsePrimary({atoms: atoms})).ast;
}

MathAtom.toAST = function(atoms) {
    return parse(atoms);
}

/**
 * 
 * @param {string} fence -- The fence to validate
 * @param {string} -- Default values, in case no fence is provided
 * @return {string} -- A valid fence
 */
function validateFence(fence, defaultFence) {
    let result = fence || defaultFence;

    // Make sure there are some default values, even if no default fence was 
    // provided.
    // A fence can be up to three characters:
    // - open fence
    // - close fence
    // - middle fence
    // '.' indicate and empty, invisible fence.

    result += '...';

    return result;
}


/**
 * Return a formatted mantissa:
 * 1234567 -> 123 456 7
 * 1233333 -> 12(3)
 * @param {*} m 
 * @param {*} config 
 */
function formatMantissa(m, config) {
    const originalLength = m.length;
    m = m.substr(0, Math.min(m.length, config.precision - 1));
    for (let i = 0; i < m.length - 16; i++) {    
        const offset = m.substr(0, i);
        for (let j = 0; j < 17; j++) {
            const pad = m.substr(i, j + 1);
            const times = Math.ceil((m.length - offset.length) / pad.length);
            if (times > 1) {
                const repeat = new Array(times + 1).join(pad); // Silly String.repeat hack
                if ((offset + repeat).substr(0, m.length).startsWith(m)) {
                    return offset.replace(/(\d{3})/g, '$1' + config.groupSeparator) +
                    config.beginRepeatingDigits + pad.replace(/(\d{3})/g, '$1' + config.groupSeparator) + config.endRepeatingDigits;
                }
            }
        }
    }
    if (originalLength !== m.length) {
        m += '\\ldots';
    }
    return  m.replace(/(\d{3})/g, '$1' + config.groupSeparator);
}

 /**
 * 
 * @param {Object|number} num -- A number element, or a number or a bignumber or a fraction
 * @return {string} -- A LaTeX representation of the AST
 */
function numberAsLatex(num, config) {
    let result = '';
    if (typeof num === 'string' && num.indexOf('/') >= 0) {
        result = num;
        // It's a fraction
        const m = num.match(/(\+|-)?(\d*)\/(\d*)/);
        if (m) {
            result = (m[1] || '');
            if (m[3] === '0') {
                result = 0;
            } else if (m[3] === '1') {
                result += m[2];
            } else {
                result += '\\frac{' + m[2] + '}{' + m[3] + '}';
            }
        }

        return result;
    }

    if (typeof config.precision === 'number') {
        if (typeof num === 'number') {
            num = parseFloat(num.toFixed(config.precision));
        } else if (typeof num === 'string' && num.indexOf('/') >= 0) {
            // It's a fraction. We can ignore the precision
        } else {
            let sign = '';
            if (num[0] === '-') {
                sign = '-';
                num = num.substr(1);
            } else if (num[0] === '+') {
                num = num.substr(1);
            }
            if (num.indexOf('.') >= 0) {
                if (num.length - 1 < config.precision) {
                    // 
                    return sign + num;
                }
                if (num.match(/^((\d)*\.)/)[1] === '0.') {
                    let p = 2;
                    while (num[p] === '0' && p < num.length - 1) {
                        p += 1;
                    }
                    let r;
                    if (p === 2) {
                        p = 1;
                        r = num[0]
                    } else {
                        r = num[p];
                    }
                    r += config.decimalMarker;
                    r += formatMantissa(num.substr(p + 1, config.precision - 2), config);
                    if (!r.endsWid && num.length - 1 > config.precision) {
                        r += '\\ldots';
                    }
                    if (p > 1) {
                        r += config.exponentProduct;
                        if (config.exponentMarker) {
                            r += config.exponentMarker + (1 - p).toString();
                        } else {
                            r += '10^{' + (1 - p).toString() + '}';
                        }
                    }
                    num = r;
                } else {
                    const m = num.match(/(\d*).(\d*)/);
                    num = m[1] + config.decimalMarker;
                    num += formatMantissa(m[2].substr(0, config.precision + 1), config);
                    if (!num.endsWith('\\ldots') && num.length - 1 > config.precision) {
                        num += '\\ldots';
                    }
                }
            } else if (num.length > config.precision) {
                const len = num.length;
                let r = num[0];
                r += config.decimalMarker;
                r += formatMantissa(num.substr(1, config.precision - 1), config);
                if (r[r.length - 1] !== '}') {
                    r += '\\ldots';
                }
                r += config.exponentProduct;
                if (config.exponentMarker) {
                    r += config.exponentMarker + (len - 1).toString();
                } else {
                    r += '10^{' + (len - 1).toString() + '}';
                }
                num = r;
            }
            return sign + num;
        }
    }
    if (config.scientificNotation === 'engineering') {
        // Ensure the exponent is a multiple of 3
        if (num === 0) {
            result = '0';
        } else {
            const y = Math.abs(num);
            let exponent = Math.round(Math.log10(y));
            exponent = exponent - exponent % 3;
            if (y < 1000) exponent = 0;
            let mantissa = y / Math.pow(10, exponent);
            const m = mantissa.toString().match(/^(.*)\.(.*)$/);
            if (m && m[1] && m[2]) {
                mantissa = m[1] + config.decimalMarker + m[2];
            }
            if (config.groupSeparator) {
                mantissa = formatMantissa(mantissa.toExponential(), config);
            }
            if (exponent === 0) {
                exponent = '';
            } else if (config.exponentMarker) {
                exponent = config.exponentMarker + exponent;
            } else {
                exponent = config.exponentProduct + ' 10^{' + exponent + '}';
            }
            result = (num < 0 ? '-' : '') + mantissa + exponent;
        }
    } else {
        const valString = typeof num === 'string' ? num : num.toString();
        let m = valString.match(/^(.*)[e|E]([-+]?[0-9]*)$/i);
        let base, exponent, mantissa;
        base = valString;
        mantissa = '';
        if (m && m[1] && m[2]) {
            // There is an exponent...
            base = m[1];
            if (config.exponentMarker) {
                exponent = config.exponentMarker + m[2];
            } else {
                exponent = config.exponentProduct + ' 10^{' + m[2] + '}';
            }
        }
        m = base.match(/^(.*)\.(.*)$/);
        if (m && m[1] && m[2]) {
            base = m[1];
            mantissa = m[2];
        }
        if (config.groupSeparator) {
            base = base.replace(/\B(?=(\d{3})+(?!\d))/g, config.groupSeparator);
            mantissa = formatMantissa(mantissa, config);
        }
        if (mantissa) mantissa = config.decimalMarker + mantissa;
        result = base + mantissa + (exponent || '');
    }
    return result;
}



 /**
 * 
 * @param {Object} ast -- Abstract Syntax Tree object
 * @return {string} -- A LaTeX representation of the AST
 */
function asLatex(ast, options) {
    const config = Object.assign({
        precision:              14,
        decimalMarker:          '.',
        groupSeparator:         '\\, ',
        product:                '\\cdot ',   // \\times, \\,
        exponentProduct:        '\\cdot ',
        exponentMarker:         '',
        arcSeparator:           '\\,',
        scientificNotation:     'auto', // 'engineering', 'auto', 'on'
        beginRepeatingDigits:   '\\overline{',
        endRepeatingDigits:     '}',
    }, options, config);

    let result = '';

    if (ast === undefined) return '';

    if (ast.latex) {
        // If ast.latex key is present, use it to render the element
        result = ast.latex;

    } else if (isNumber(ast)) {
        const val = asNumber(ast);
        if (isNaN(val)) {
            result = '\\mathrm{NaN}';
        } else if (val === -Infinity) {
            result = '-\\infty ';
        } else if (val === Infinity) {
            result = '\\infty ';
        } else {
            result = numberAsLatex(ast.num || ast, config);
        }
        if (ast.sup) result += '^{' + asLatex(ast.sup, config) + '}';
        if (ast.sub) result += '_{' + asLatex(ast.sub, config) + '}';

    } else if (ast.re !== undefined || ast.im !== undefined ) {
        let wrap = false;
        if (Math.abs(ast.im) <= 1e-14 && Math.abs(ast.re) <= 1e-14) {
            result = '0';
        } else {
            if (ast.re && Math.abs(ast.re) > 1e-14) {
                result = numberAsLatex(ast.re, config);
            }
            if (Math.abs(ast.im) > 1e-14) {
                const im = asNumber(ast.im); 
                if (Math.abs(ast.re) > 1e-14) {
                    result += im > 0 ? '+' : '';
                    wrap = true;
                }
                result += (Math.abs(im) !== 1 ? 
                    numberAsLatex(ast.im, config) : '') + '\\imaginaryI ';
            }
            if (wrap) {
                const fence = validateFence(ast.fence, '(),');
                result = fence[0] + result + fence[1];
            }
        }
        if (ast.sup) result += '^{' + asLatex(ast.sup, config) + '}';
        if (ast.sub) result += '_{' + asLatex(ast.sub, config) + '}';

    } else if (ast.group) {
        result = asLatex(ast.group);
        if (!isNumber(ast.group) && !asSymbol(ast.group)) {
            const fence = validateFence(ast.fence, '(),');
            result = fence[0] + result + fence[1];
        }
        if (ast.sup) result += '^{' + asLatex(ast.sup, config) + '}';
        if (ast.sub) result += '_{' + asLatex(ast.sub, config) + '}';

    } else if (ast.fn) {
        if (ast.fn === 'pow' && Array.isArray(ast.arg) && ast.arg.length >= 2) {
            result = asLatex(ast.arg[0], config);
            if (!isNumber(ast.arg[0]) && !asSymbol(ast.arg[0])) {
                const fence = validateFence(ast.fence, '(),');
                result = fence[0] + result + fence[1];
            }
    
            result += '^{' + asLatex(ast.arg[1], config) + '}';
        } else {
            const fn = Definitions.getLatexTemplateForFunction(ast.fn);
            let argstring = '';
            const optionalParen = ast.fn.match(/^(factorial(2)?|(((ar|arc)?(sin|cos|tan|cot|sec|csc)h?)|ln|log|lb))$/);
            if (Array.isArray(ast.arg) || !optionalParen) {
                let sep = '';
                const fence = validateFence(ast.fence, '(),');
                if (fence[0] !== '.') argstring += fence[0];
                if (Array.isArray(ast.arg)) {
                    for (const arg of ast.arg) {
                        argstring += sep + asLatex(arg, config);
                        sep = ', ';
                    }
                } else if (ast.arg) {
                    argstring += asLatex(ast.arg, config);
                }
                if (fence[1] !== '.') argstring += fence[1];
            } else if (ast.arg !== undefined) {
                // The parenthesis may be option...
                if (typeof ast.arg === 'number' || 
                    typeof ast.arg === 'string' ||
                    ast.arg.num !== undefined ||
                    ast.arg.sym !== undefined ||
                    ast.arg.op === '/' ||
                    ast.arg.fn === 'sqrt') {
                    // A simple argument, no need for parentheses
                    argstring = asLatex(ast.arg, config);

                } else {
                    // A complex expression, use parentheses if the arguments 
                    // are the last element of the function template.
                    // For example, for abs()... |%|, parenthesis are not necessary.
                    if (fn[fn.length - 1] === '%') {
                        const fence = validateFence(ast.fence, '(),');
                        argstring += fence[0];
                        argstring += asLatex(ast.arg, config);
                        argstring += fence[1];
                    } else {
                        argstring = asLatex(ast.arg, config);
                    }
                }
            }

            result = fn;
            if (ast.over || ast.sup) {
                result = result.replace('%^','^{' + asLatex(ast.over || ast.sup, config) + '}');
            } else {
                result = result.replace('%^','');
            }
            if (ast.under || ast.sub) {
                result = result.replace('%_','_{' + asLatex(ast.under || ast.sub, config) + '}');
            } else {
                result = result.replace('%_','');
            }

            // Insert the arguments in the function template
            result = result.replace('%', argstring);
        }

    } else if (ast.sym !== undefined || typeof ast === 'string') {
        result = asSymbol(ast);
        // Is it a Unicode value?
        let m = result.match(/^&#x([0-9a-f]+);$/i);
        if (m && m[1]) {
            result = String.fromCodePoint(parseInt(m[1], 16));
        } else {
            m = result.match(/^&#([0-9]+);$/i);
            if (m && m[1]) {
                result = String.fromCodePoint(parseInt(m[1]));
            }
        }

        // Is there a variant info attached to it?
        if (ast.variant) {
            const MATH_VARIANTS = {
                'normal':   'mathrm',
                'double-struck': 'mathbb',
                'bold': 'mathbf',
                // 'script': 'mathcal',
                'fraktur': 'mathfrak',
                'script': 'mathscr',
                'sans-serif': 'mathsf',
                'monospace': 'mathtt'
            };
            result = '\\' + MATH_VARIANTS[ast.variant] + 
                '{' + result + '}';
        }
        if (ast.sup) result += '^{' + asLatex(ast.sup, config) + '}';
        if (ast.sub) result += '_{' + asLatex(ast.sub, config) + '}';

    } else if (ast.op) {
        if (ast.op === '/') {
            result = '\\frac{' + asLatex(ast.lhs, config) + '}{' + asLatex(ast.rhs, config) + '}';
            if (ast.sup || ast.sub) {
                result = '(' + result + ')';
                if (ast.sup) result += '^{' + asLatex(ast.sup, config) + '}';
                if (ast.sub) result += '_{' + asLatex(ast.sub, config) + '}';
            }
        } else {
            let lhs, rhs;
            lhs = asLatex(ast.lhs, config);
            if (ast.lhs && ast.lhs.op && Definitions.getPrecedence(ast.lhs.op) < Definitions.getPrecedence(ast.op)) {
                lhs = '(' + lhs + ')';
            }
            
            rhs = asLatex(ast.rhs, config);
            if (ast.rhs && ast.rhs.op && Definitions.getPrecedence(ast.rhs.op) < Definitions.getPrecedence(ast.op)) {
                rhs = '(' + rhs + ')';
            }

            if (ast.op === '*') {
                result = '%0 ' + config.product + ' %1';
            } else {
                result = Definitions.getLatexTemplateForOperator(ast.op);
            }
            result = result.replace('%^', ast.sup ? '^{' + asLatex(ast.sup, config) + '}' : '');
            result = result.replace('%_', ast.sub ? '_{' + asLatex(ast.sub, config) + '}' : '');
            result = result.replace('%0', lhs).replace('%1', rhs).replace('%', lhs);
        }

    } else if (ast.text) {
        result = '\\text{' + ast.text + '}';

    } else if (ast.array) {
        // TODO
    }

    // If there was an error attached to this node, 
    // display it on a red background
    if (ast.error) {
        result = '\\bbox[#F56165]{' + result + '}';
    }

    return result;
}


// Export the public interface for this module
return { 
    asLatex,
    asNumber,
    isNumber,
    asSymbol,
}


})