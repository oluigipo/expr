# expr
simple expression parser with weird features in javascript

## how to use
* `left op right`, where **op** is an infix operator;
* `[item0, item1,, item3]` makes an array;
* `func arg0` calls a function;
* `array func` is the same as `func [array]`, passing an array as the first argument;
* `array number` is going to make the array have at least `number` items adding 0 as padding if necessary;
* `arr0 arr1` is going to use the first item of the `arr1` as an index to `arr0`. this only exists so we can do `arr[index]`;
* parenthesis are used to change precedence of infix operators, but can also be used to make arrays if it has a `,` in it;
* `(arg0,, arg2 => expr)` is a lambda, parenthesis are needed;
* function calls are left-to-right, so `a b c` is `(a b) c`;
* booleans are 0 (false) and anything other than 0 (true);
* infix operators precedence and what they do:
* * `?`: ternary operator, syntax is `cond ? then : otherwise`;
* * `||`: "or" operator, checks if left or right are not 0;
* * `&&`: same as above, but it's "and";
* * `==`, `!=`, `>=`, `<=`, `>`, `<`: compares the left with the right operands;
* * `|>`: pipe operator, it's going to call right with left as argument -- same as `right left`;
* * `+`, `-`, `|`: plus, minus, and bitwise or;
* * `*`, `/`, `%`, `^`, `&`: multiply, divide, modulus, bitwise xor, and bitwise and;
* all operators are left-to-right;
* ` `, `\t`, `\n`, `\r`, and `\`` are treated as whitespaces, only thing they do is separate tokens;
* there are a lot of other strange semantics I'm not explaining here;

## examples
`(1280, 720) / 2`
+ `[640, 360]`

`[]100 map(, i => i) sqr`
+ returns an array of 100 elements which each element is the square of it's index
