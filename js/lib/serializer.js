export class JSONSerializer {
	constructor(replacer, reviver) {
		this.replacer = replacer;
		this.reviver = reviver;
		this.SERIALIZER_ID = 'json';
		this.BINARY = false;
	}

	serialize(obj) {
		return JSON.stringify(obj, this.replacer);
	}

	unserialize(payload) {
		return JSON.parse(payload, this.reviver);
	}
}
