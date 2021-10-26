function begin() {
	let input = document.getElementsByClassName("code")[0].value;
	console.log(expr(input));
}

function expr(e) {
	let errors = [];
	
	function identchar(ch) {
		return ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch == '_';
	}
	
	function kind(node) {
		if (node === undefined)
			return undefined;
		if (typeof node == "number")
			return "number";
		if (typeof node == "string")
			return identchar(node[0]) ? "ident" : "op";
		if (typeof node == "function")
			return "builtin-function";
		if (Array.isArray(node))
			return "array";
		if (node.op && node.left && node.middle && node.right)
			return "ternary";
		if (node.op && node.left && node.right)
			return "binary";
		if (node.op && node.expr)
			return "unary";
		if (node.args && node.ret)
			return "function";
		return undefined;
	}
	
	function tokenize(e) {
		let result = [];
		let head = 0;
		
		function numchar(ch) {
			return ch >= '0' && ch <= '9' || ch == '.';
		}
		
		while (head < e.length) {
			while (e[head] == ' ' || e[head] == '`' || e[head] == '\t' || e[head] == '\n' || e[head] == '\r')
				++head;
			
			if (head >= e.length)
				break;
			
			if (identchar(e[head])) {
				let begin = head++;
				
				while (identchar(e[head]) || numchar(e[head]))
					++head;
				
				result.push(e.slice(begin, head));
				continue;
			}
			
			if (numchar(e[head])) {
				let begin = head++;
				
				while (numchar(e[head]) || e[head] == '_')
					++head;
				
				result.push(Number(e.slice(begin, head).replace('_', "")));
				continue;
			}
			
			let begin = head;
			
			// for double-char operators, increment head
			switch (e[head]) {
				case '=':
					if (['=', '>'].includes(e[head+1]))
						++head;
					break;
				
				case '<':
				case '>':
					if (e[head+1] == e[head]) {
						++head;
						break;
					}
				
				case '!':
					if (e[head+1] == '=')
						++head;
					break;
				
				case '|':
					if (['>', '|'].includes(e[head+1]))
						++head;
					break;
				
				case '&':
					if (e[head+1] == '&')
						++head;
					break;
			}
			
			result.push(e.slice(begin, ++head));
		}
		
		return result;
	}
	
	function parse(_tokens) {
		let tokens = _tokens;
		let tok;
		
		function next(desired) {
			if (desired != undefined && tok != desired) {
				errors.push(`expecting '${desired}', but got '${tok}'`);
			}
			tok = tokens.shift();
		}
		
		function trynext(desired) {
			if (tok == desired) {
				next();
				return true;
			}
			return false;
		}
		
		next();
		
		const precedence = {
			"?": 1,
			
			"||": 2,
			"&&": 3,
			
			"==": 4,
			"!=": 4,
			">=": 4,
			"<=": 4,
			"<": 4,
			">": 4,
			
			"|>": 5,
			
			"+": 6,
			"-": 6,
			"|": 6,
			
			"<<": 7,
			">>": 7,
			
			"*": 8,
			"/": 8,
			"%": 8,
			"^": 8,
			"&": 8,
		};
		
		const right2left = {
			
		};
		
		function factor() {
			let result = undefined;
			
			function push(e) {
				if (result == undefined)
					result = e;
				else
					result = { op: "call", left: result, right: e };
			}
			
			loop: while (tok && precedence[tok] == undefined) {
				switch (tok) {
					case '[': {
						let arr = [];
						
						next();
						while (trynext(','))
							arr.push(0);
						while (tok != ']') {
							arr.push(expr());
							
							if (tok != ']')
								next(',');
							while (trynext(','))
								arr.push(0);
						}
						next(']');
						
						push(arr);
					} break;
					
					case '(': {
						let arr = [];
						let shouldBeArray = false;
						
						next();
						if (tok != ')' && tok != "=>") {
							while (trynext(','))
								arr.push(0);
								
							while (tok != ')' && tok != "=>") {
								arr.push(expr());
								if (tok != ')' && tok != "=>")
									next(',');
								
								while (trynext(','))
									arr.push(0);
							}
						}
						
						if (tok == '=>') {
							next();
							push({ args: arr, ret: expr() });
							next(')');
						} else {
							next(')');

							if (arr.length == 1)
								push(arr[0]);
							else
								push(arr);
						}
					} break;
					
					default: {
						if (["number", "ident"].includes(kind(tok))) {
							push(tok);
							next();
						} else {
							break loop;
						}
					} break;
				}
			}
			
			if (result == undefined) {
				result = 0;
				errors.push("expected value");
			}
			
			return result;
		}
		
		function expr(lvl = 0) {
			let left = factor();
			let prec = precedence[tok];
			
			while (prec && prec > lvl) {
				let op = tok;
				next();
				let right = factor();
				
				let lookahead = tok;
				while (precedence[lookahead] &&
					   (precedence[lookahead] > prec ||
						(precedence[lookahead] == prec && right2left[lookahead]))) {
					next();
					
					if (lookahead == '?') {
						let if_true = expr();
						next(':');
						let if_false = expr();
						
						right = {
							op: '?',
							left: right,
							middle: if_true,
							right: if_false,
						};
					} else {
						let other = expr(precedence[lookahead] + 1);
						right = {
							op: lookahead,
							left: right,
							right: other,
						};
					}
					
					lookahead = tok;
				}
				
				left = { op, left, right };
				prec = precedence[tok];
			}
			
			return left;
		}
		
		return expr();
	}
	
	function run(ast) {
		let callstack = 0;
		let callstackLimit = 100;
		
		function makeBuiltin(orig) {
			return function f(v) {
				return kind(v[0]) == "array" ? v[0].map(item => call(f, item)) : orig(...v);
			}
		}
		
		function kind2(value) {
			let k = kind(value);
			if (k == "builtin-function")
				k = "function";
			
			return k;
		}
		
		function clean(array) {
			for (let i = 0; i < array.length; ++i) {
				if (array[i] == undefined || array[i] == null) {
					array[i] = 0;
				}
			}
		}
		
		function makeBuilder(required, exec, reqfn = kind2) {
			let recievedArgs = {};
			let argsNames = Object.keys(required);
			let neededArgs = argsNames.map(key => required[key]);
			
			return function builder(args) {
				for (const arg of args) {
					let k = reqfn(arg);
					
					let ind = neededArgs.indexOf(k);
					if (ind == -1) {
						errors.push("argument of unneeded type");
					} else {
						neededArgs[ind] = "";
						recievedArgs[argsNames[ind]] = arg;
					}
				}
				
				if (neededArgs.reduce((a, v) => a + v, "") == "") {
					return exec(recievedArgs);
				} else {
					return builder;
				}
			}
		}
		
		let env = {
			reduce: (args) => {
				let startacc = 0;
				let fn = (a,b) => a+b;
				
				switch (args.length) {
					case 0:
						errors.push("expected at least one argument for function 'reduce'");
						return 0;
						
					default:
					case 3:
						return args[2].reduce((acc, val, i) => call(args[0], [acc, val, i]), args[1]);
						
					case 2:
						startacc = args[1];
					case 1:
						fn = args[0];
						break;
				}
				
				return function([arr]) {
					let acc = startacc;
					for (let i = 0; i < arr.length; ++i) {
						acc = call(fn, [acc, arr[i], i]);
					}
					return acc;
				};
			},
			filter: makeBuilder({ arr: "array", fn: "function" },
								({arr, fn}) => arr.filter((value, index) => call(fn, [value, index]))),
			map: makeBuilder({ arr: "array", fn: "function" },
							({arr, fn}) => arr.map((value, index) => call(fn, [value, index]))),
			join: makeBuilder({ first: "array", second: "array" },
							 ({first, second}) => [...first, ...second]),
			find: makeBuilder({ arr: "array", n: "number" },
							  ({arr, n}) => arr.indexOf(n)),
			has: makeBuilder({ arr: "array", n: "number" },
							 ({arr, n}) => arr.includes(n) + 0),
			where: makeBuilder({ arr: "array", n: "number", fn: "function" },
							 ({arr, n, fn}) => arr.map((val, i) => val == n ? call(fn, [val, i]) : val)),
			take: makeBuilder({ inds: "array", from: "array" },
							 ({inds, from}) => from.filter((_, i) => inds.includes(i))),
			drop: makeBuilder({ inds: "array", from: "array" },
							 ({inds, from}) => from.filter((_, i) => !inds.includes(i))),
			group: makeBuilder({ inds: "array", vals: "array" },
							 ({inds, vals}) => clean(vals.reduce((a, val) => (a[inds.shift()] = val, a), []))),
			sin: makeBuiltin(Math.sin),
			cos: makeBuiltin(Math.cos),
			abs: makeBuiltin(Math.abs),
			acos: makeBuiltin(Math.acos),
			asin: makeBuiltin(Math.asin),
			atan: makeBuiltin(Math.atan),
			atan2: makeBuiltin(Math.atan2),
			cbrt: makeBuiltin(Math.cbrt),
			ceil: makeBuiltin(Math.ceil),
			exp: makeBuiltin(Math.exp),
			floor: makeBuiltin(Math.floor),
			hypot: makeBuiltin(Math.hypot),
			log: makeBuiltin(Math.log),
			log10: makeBuiltin(Math.log10),
			log2: makeBuiltin(Math.log2),
			max: makeBuiltin(Math.max),
			min: makeBuiltin(Math.min),
			pow: makeBuiltin(Math.pow),
			random: makeBuiltin(Math.random),
			round: makeBuiltin(Math.round),
			sign: makeBuiltin(Math.sign),
			sqrt: makeBuiltin(Math.sqrt),
			tan: makeBuiltin(Math.tan),
			trunc: makeBuiltin(Math.trunc),
			sqr: makeBuiltin(x => x*x),
			PI: Math.PI,
			E: Math.E,
			SQRT2: Math.SQRT2,
		};
		
		function find(ident) {
			let result;
			let e = env;
			
			do {
				result = e[ident];
			} while (result == undefined && (e = e[0]) != undefined);
			
			if (result == undefined) {
				errors.push(`unknown identifier '${ident}'`);
				result = 0;
			}
			
			return result;
		}
		
		function call(fn, args) {
			if (callstack > callstackLimit) {
				errors.push(`stack overflow (limit: ${callstackLimit})`);
				return 0;
			}
			
			let result = 0;
			++callstack;
			let argsk = kind(args);
			
			switch (kind(fn)) {
				case "function":
					if (argsk != "array")
						args = [args];
					
					let oldenv = env;
					if (fn.env != undefined) {
						env = fn.env;
					} else {
						env = { 0: env };
					}
					
					for (const arg of fn.args) {
						let val = args.shift();
						if (val == undefined)
							val = 0;
						
						if (arg != undefined && arg != 0)
							env[arg] = val;
					}
					result = interpret(fn.ret);
					env = oldenv;
					break;
				case "builtin-function":
					if (argsk != "array")
						args = [args];
					
					result = fn(args);
					break;
				case "array":
					if (argsk == "array") {
						if (kind(args[0]) == "number") {
							result = fn[args[0]];
							
							if (result == undefined) {
								errors.push(`index '${args[0]}' out of bounds (length = ${fn.length})`);
								result = 0;
							}
						} else {
							errors.push("array index should be a number");
							result = 0;
						}
					} else if (argsk == "function" || argsk == "builtin-function")
						result = call(args, [fn]);
					else if (argsk == "number") {
						result = [];
						let i = 0;
						for (; i < fn.length; ++i)
							result[i] = fn[i];
						for (; i < args; ++i)
							result[i] = 0;
					} else {
						errors.push("invalid use of array");
						result = 0;
					}
					break;
				default:
					errors.push("left-side of function call is not a function");
					break;
			}
			--callstack;
			
			return result;
		}
		
		function unary(op, expr) {
			expr = interpret(expr);
			
			switch (op) {
				case '+': return  expr;
				case '-': return -expr;
				case '~': return ~expr;
				case '!': return !expr;
				default: return expr;
			}
		}
		
		function binary(op, left, right) {
			let leftk = kind(left);
			let rightk = kind(right);
			
			if (["+", "-", "/", "*", "%", "<<", ">>", "&", "|", "^"].includes(op)) {
				if (leftk == "array" && rightk == "number")
					return left.map(v => binary(op, v, right));
				if (leftk == "number" && rightk == "array")
					return right.map(v => binary(op, left, v));
				if (leftk == "array" && rightk == "array" && left.length == right.length)
					return left.map((v, i) => binary(op, v, right[i]));
			}
			
			switch (op) {
				case "call": return call(left, right);
				case "+": return left + right;
				case "-": return left - right;
				case "*": return left * right;
				case "/": return left / right;
				case "%": return left % right;
				case ">>": return left >> right;
				case "<<": return left << right;
				case "|>": return call(right, left);
				case "==": return left == right;
				case "!=": return left != right;
				case ">=": return left >= right;
				case "<=": return left <= right;
				case ">": return left > right;
				case "<": return left < right;
				case "&": return left & right;
				case "|": return left | right;
				case "^": return left ^ right;
				case "&&": return left && right;
				case "||": return left || right;
			}
			
			errors.push(`unknown binary operation ${op}`);
			return 0;
		}
		
		function interpret(node) {
			switch (kind(node)) {
				case "number": return node;
				case "ident": return find(node);
				case "binary": return binary(node.op, interpret(node.left), interpret(node.right));
				case "ternary": return interpret(node.left) ? interpret(node.middle) : interpret(node.right);
				case "unary": return unary(node.op, node.expr);
				case "array": return node.map(value => interpret(value));
				case "function":
					node.env = env;
				default: return node;
			}
		}
		
		//return ast;
		return interpret(ast);
	}
	
	let tokens = tokenize(e);
	let ast = parse(tokens);
	let result = run(ast);
	
	if (errors.length > 0)
		console.log({ errors });
	
	return result;
}
