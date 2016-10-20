import * as util from '../util';
import * as log from '../log';
import * as serializer from '../serializer';

export class Factory {
	constructor(options) {
		var self = this;
		util.assert(options.url !== undefined, "options.url missing");
		util.assert(typeof options.url === "string", "options.url must be a string");

		options.serializers = [new serializer.JSONSerializer()];

		options.protocols = [];
		options.serializers.forEach(function (ser) {
			options.protocols.push("wamp.2." + ser.SERIALIZER_ID);
		});

		self._options = options;
	}

	get type() {
		return "websocket";
	}

	create() {
		var self = this;
		// the WAMP transport we create
		var transport = {
			info: {
				type: self.type,
				url: self._options.url,
				protocol: null
			},
			// these will get defined further below
			protocol: undefined,
			serializer: undefined,
			send: undefined,
			close: undefined,

			// these will get overridden by the WAMP session using this transport
			onmessage: function () {
			},
			onopen: function () {
			},
			onclose: function () {
			}
		};

		// running in the browser or react-native
		//
		(function () {
			var websocket;

			// Chrome, MSIE, newer Firefox
			if ("WebSocket" in global) {
				if (self._options.protocols) {
					websocket = new global.WebSocket(self._options.url, self._options.protocols);
				} else {
					websocket = new global.WebSocket(self._options.url);
				}
				websocket.binaryType = 'arraybuffer';
				// older versions of Firefox prefix the WebSocket object
			} else if ("MozWebSocket" in global) {
				if (self._options.protocols) {
					websocket = new global.MozWebSocket(self._options.url, self._options.protocols);
				} else {
					websocket = new global.MozWebSocket(self._options.url);
				}
			} else {
				throw "browser does not support WebSocket or WebSocket in Web workers";
			}

			websocket.onmessage = function (evt) {
				log.debug("WebSocket transport receive", evt.data);

				var msg = transport.serializer.unserialize(evt.data);
				transport.onmessage(msg);
			}

			websocket.onopen = function (evt) {
				if (!websocket.protocol) {
					websocket.protocol = "wamp.2.json";
				}
				var serializer_part = websocket.protocol.split('.')[2];
				for (var index in self._options.serializers) {
					var serializer = self._options.serializers[index];
					if (serializer.SERIALIZER_ID == serializer_part) {
						transport.serializer = serializer;
						break;
					}
				}

				transport.info.protocol = websocket.protocol;
				transport.onopen();
			}

			websocket.onclose = function (evt) {
				var details = {
					code: evt.code,
					reason: evt.message,
					wasClean: evt.wasClean
				}
				transport.onclose(details);
			}

			// do NOT do the following, since that will make
			// transport.onclose() fire twice (browsers already fire
			// websocket.onclose() for errors also)
			//websocket.onerror = websocket.onclose;

			transport.send = function (msg) {
				var payload = transport.serializer.serialize(msg);
				log.debug("WebSocket transport send", payload);
				websocket.send(payload);
			}

			transport.close = function (code, reason) {
				websocket.close(code, reason);
			};
		})();

		return transport;
	}
}
