var _WAMP_DEBUG = false;

export function debug(...args) {
	if (_WAMP_DEBUG) {
		console.log.apply(null, args);
	}
}

export function debugOn() {
	_WAMP_DEBUG = true;
}

export function debugOff() {
	_WAMP_DEBUG = false;
}
