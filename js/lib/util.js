import * as log from './log';


export function rand_normal(mean, sd) {
	// Derive a Gaussian from Uniform random variables
	// http://en.wikipedia.org/wiki/Box%E2%80%93Muller_transform
	var x1, x2, rad;

	do {
		x1 = 2 * Math.random() - 1;
		x2 = 2 * Math.random() - 1;
		rad = x1 * x1 + x2 * x2;
	} while (rad >= 1 || rad == 0);

	var c = Math.sqrt(-2 * Math.log(rad) / rad);

	return (mean || 0) + (x1 * c) * (sd || 1);
};


export function assert(cond, text) {
	if (cond) {
		return;
	}

	throw new Error(text || "Assertion failed!");
};

/**
 * Merge a list of objects from left to right
 *
 * For each object passed to the function, add to the previous object the keys
 *     that are present in the former but not the latter. If the last argument
 *     is a boolean, it sets whether or not to recursively merge objects.
 *
 * This function mutates the first passed object. To avopid this, you can pass
 *     a new empty object as the first arg:
 *
 *     defaults({}, obj1, obj2, ...)
 *
 * @example
 *     defaults({ a: 1 }, { a: 2, b: 2 }, { b: 3, c: 3 })
 *     // { a: 1, b: 2, c: 3 }
 *
 *     defaults({ a: { k1: 1 } }, { a: { k2: 2 } })
 *     // { a: { k1: 1 } }
 *
 *     defaults({ a: { k1: 1 } }, { a: { k2: 2 } })
 *     // { a: { k1: 1 } }
 *
 * @param {Object} base The object to merge defaults to
 * @param {Object} source[, ...] The default values source
 * @param {Boolean} [recursive] Whether to recurse fro object values*
 *     (default: false)
 * @returns {Object} The mutated `base` object
 */
export function defaults() {
	// Return an empty object if no arguments are passed
	if (arguments.length === 0) return {};

	var base = arguments[0];
	var recursive = false;
	var len = arguments.length;

	// Check for recursive mode param
	if (typeof arguments[len - 1] === 'boolean') {
		recursive = arguments[len - 1];
		len -= 1; // Ignore the last arg
	}

	// Merging function used by Array#forEach()
	var do_merge = function (key) {
		var val = obj[key];

		// Set if unset
		if (!(key in base)) {
			base[key] = val;
			// If the value is an object and we use recursive mode, use defaults on
			// the value
		} else if (recursive && typeof val === 'object' &&
			typeof base[key] === 'object') {
			defaults(base[key], val);
		}
		// Otherwise ignore the value
	};

	// Iterate over source objects
	for (var i = 1; i < len; i++) {
		var obj = arguments[i];

		// Ignore falsy values
		if (!obj) continue;

		// Require object
		if (typeof obj !== 'object') {
			throw new Error('Expected argument at index ' + i +
				' to be an object');
		}

		// Merge keys
		Object.keys(obj).forEach(do_merge);
	}

	// Return the mutated base object
	return base;
}

