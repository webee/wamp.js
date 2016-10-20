class Transports {
	constructor() {
		this._repository = {};
	}

	register(name, factory) {
		this._repository[name] = factory;
	}

	isRegistered(name) {
		return this._repository[name] ? true : false;
	}

	get(name) {
		if (this._repository[name] !== undefined) {
			return this._repository[name];
		} else {
			throw "no such transport: " + name;
		}
	}

	list() {
		let items = [];
		for (let name in this._repository) {
			items.push(name);
		}
		return items;
	}
}


var _transports = new Transports();

// register default transports
var websocket = require('./transport/websocket.js');
_transports.register("websocket", websocket.Factory);

export const transports = _transports;

