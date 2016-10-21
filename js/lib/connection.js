import * as configs from './configure';
import * as log from './log';
import * as util from './util';
import { Session } from './session';

export const CLOSE_REASON = {
	UNSUPPORTED: 'unsupported',
	UNREACHABLE: 'unreachable',
	LOST: "lost",
	CLOSED: "closed"
};

// wamp status, not transport status.
export const STATUS = {
	DISCONNECTED: 'DISCONNECTED',
	CONNECTING: 'CONNECTING',
	CONNECTED: 'CONNECTED',
	CLOSED: 'CLOSED'
};

export class Connection {
	constructor(options) {
		var self = this;

		self._options = options;

		// APIs
		self.onopen = undefined;
		self.onclose = undefined;
		self._status = STATUS.DISCONNECTED;
		self.onstatuschange = function (status, details) {
		};

		// WAMP transport
		//
		self._options.transports = [
			{
				type: 'websocket',
				url: self._options.url
			}
		];
		self._transport_factories = [];
		self._init_transport_factories();


		// WAMP session
		//
		self._session = null;
		self._session_close_reason = null;
		self._session_close_message = null;

		// automatic reconnection configuration
		//

		// enable automatic reconnect if host is unreachable
		if (self._options.retry_if_unreachable !== undefined) {
			self._retry_if_unreachable = self._options.retry_if_unreachable;
		} else {
			self._retry_if_unreachable = true;
		}

		// maximum number of reconnection attempts
		self._max_retries = self._options.max_retries !== undefined ? self._options.max_retries : 15;

		// initial retry delay in seconds
		self._initial_retry_delay = self._options.initial_retry_delay || 1.0;

		// maximum seconds between reconnection attempts
		self._max_retry_delay = self._options.max_retry_delay || 300;

		// the growth factor applied to the retry delay on each retry cycle
		self._retry_delay_growth = self._options.retry_delay_growth || 1.5;

		// the SD of a Gaussian to jitter the delay on each retry cycle
		// as a fraction of the mean
		self._retry_delay_jitter = self._options.retry_delay_jitter || 0.1;

		// reconnection tracking
		//

		// total number of successful connections
		self._connect_successes = 0;

		// controls if we should try to reconnect
		self._retry = false;

		// current number of reconnect cycles we went through
		self._retry_count = 0;

		// the current retry delay
		self._retry_delay = self._initial_retry_delay;

		// flag indicating if we are currently in a reconnect cycle
		self._is_retrying = false;

		// when retrying, this is the timer object returned from setTimeout()
		self._retry_timer = null;
	}

	// Deferred factory
	_defer() {
		var deferred = {};
		deferred.promise = new Promise(function (resolve, reject) {
			deferred.resolve = resolve;
			deferred.reject = reject;
		});
		return deferred;
	}

	get status() {
		return this._status;
	}

	get session() {
		return this._session;
	}

	get isOpen() {
		return !!(this._session && this._session.isOpen);
	}

	get isConnected() {
		return !!this._transport;
	}

	get transport() {
		if (this._transport) {
			return this._transport;
		} else {
			return { info: { type: 'none', url: null, protocol: null } };
		}
	}

	get isRetrying() {
		return this._is_retrying;
	}

	_init_transport_factories() {
		var self = this;
		// WAMP transport
		//
		var transport_options, transport_factory, transport_factory_klass;

		for (var i = 0; i < self._options.transports.length; ++i) {
			// cascading transports until we find one which works
			transport_options = self._options.transports[i];

			try {
				transport_factory_klass = configs.transports.get(transport_options.type);
				if (transport_factory_klass) {
					transport_factory = new transport_factory_klass(transport_options);
					self._transport_factories.push(transport_factory);
				}
			} catch (exc) {
				console.error(exc);
			}
		}
	}

	_create_transport() {
		var self = this;

		for (var i = 0; i < self._transport_factories.length; ++i) {
			var transport_factory = self._transport_factories[i];
			log.debug("trying to create WAMP transport of type: " + transport_factory.type);
			try {
				var transport = transport_factory.create();
				if (transport) {
					log.debug("using WAMP transport type: " + transport_factory.type);
					return transport;
				}
			} catch (e) {
				// ignore
				log.debug("could not create WAMP transport '" + transport_factory.type + "': " + e);
			}
		}

		// could not create any WAMP transport
		return null;
	}

	_autoreconnect_reset_timer() {
		if (this._retry_timer) {
			clearTimeout(this._retry_timer);
		}
		this._retry_timer = null;
	}

	_autoreconnect_reset() {
		this._autoreconnect_reset_timer();

		this._retry_count = 0;
		this._retry_delay = this._initial_retry_delay;
		this._is_retrying = false;
	}

	_autoreconnect_advance() {
		// jitter retry delay
		if (this._retry_delay_jitter) {
			this._retry_delay = util.rand_normal(this._retry_delay, this._retry_delay * this._retry_delay_jitter);
		}

		// cap the retry delay
		if (this._retry_delay > this._max_retry_delay) {
			this._retry_delay = this._max_retry_delay;
		}

		// count number of retries
		this._retry_count += 1;

		var res;
		if (this._retry && (this._max_retries === -1 || this._retry_count <= this._max_retries)) {
			res = {
				count: this._retry_count,
				delay: this._retry_delay,
				will_retry: true
			};
		} else {
			res = {
				count: null,
				delay: null,
				will_retry: false
			}
		}

		// retry delay growth for next retry cycle
		if (this._retry_delay_growth) {
			this._retry_delay = this._retry_delay * this._retry_delay_growth;
		}

		return res;
	}

	_change_status(status, details) {
		this._status = status;
		this.onstatuschange(status, details);
	}

	open() {
		var self = this;

		if (self._transport) {
			throw "connection already open (or opening)";
		}

		self._autoreconnect_reset();
		self._retry = true;

		function retry() {
			// emit status
			self._change_status(STATUS.CONNECTING);

			// create a WAMP transport
			self._transport = self._create_transport();

			if (!self._transport) {
				// failed to create a WAMP transport
				self._retry = false;
				var details = {
					close_reason: CLOSE_REASON.UNSUPPORTED,
					reason: null,
					message: null,
					retry_delay: null,
					retry_count: null,
					will_retry: false
				};
				// emit status
				self._change_status(STATUS.CLOSED, details);

				if (self.onclose) {
					self.onclose(details.close_reason, details);
				}
				return;
			}

			// create a new WAMP session using the WebSocket connection as transport
			self._session = new Session(self._transport, self._defer, self._options.onchallenge);
			self._session_close_reason = null;
			self._session_close_message = null;

			self._transport.onopen = function () {
				log.debug(`${self._transport.info.type} transport open`);

				// reset auto-reconnect timer and tracking
				self._autoreconnect_reset();

				// log successful connections
				self._connect_successes += 1;

				// start WAMP session
				self._session.join(self._options.realm, self._options.authmethods, self._options.authid);
			};

			self._session.onjoin = function (details) {
				// ... WAMP session is now attached to realm.
				try {
					// emit status
					self._change_status(STATUS.CONNECTED, details);

					// TODO: remove onclose and onopen.
					if (self.onopen) {
						self.onopen(self._session, details);
					}
				} catch (e) {
					log.debug("Exception raised from app code while firing Connection.onopen()", e);
				}
			};

			self._session.onleave = function (reason, details) {
				self._session_close_reason = reason;
				self._session_close_message = details.message || "";
				self._retry = false;
				self._transport.close(1000);
			};

			self._transport.onclose = function (evt) {
				// remove any pending reconnect timer
				self._autoreconnect_reset_timer();

				self._transport = null;

				var reason = null;
				if (self._connect_successes === 0) {
					reason = CLOSE_REASON.UNREACHABLE;
					if (!self._retry_if_unreachable) {
						self._retry = false;
					}
				} else if (!evt.wasClean) {
					reason = CLOSE_REASON.LOST;
				} else {
					reason = CLOSE_REASON.CLOSED;
				}

				var next_retry = self._autoreconnect_advance();

				// fire app code handler
				//
				var details = {
					close_reason: reason,
					reason: self._session_close_reason,
					message: self._session_close_message,
					retry_delay: next_retry.delay,
					retry_count: next_retry.count,
					will_retry: next_retry.will_retry
				};
				try {
					var stop_retrying;
					if (details.will_retry) {
						// emit status
						stop_retrying = self._change_status(STATUS.DISCONNECTED, details);
					} else {
						// emit status
						self._change_status(STATUS.CLOSED, details);
					}

					// TODO: remove onclose and onopen.
					if (self.onclose) {
						// Connection.onclose() allows to cancel any subsequent retry attempt
						stop_retrying = self.onclose(details.close_reason, details);
					}
				} catch (e) {
					log.debug("Exception raised from app code while firing Connection.onclose()", e);
				}

				// reset session info
				//
				if (self._session) {
					self._session._id = null;
					self._session = null;
					self._session_close_reason = null;
					self._session_close_message = null;
				}

				// automatic reconnection
				//
				if (self._retry && !stop_retrying) {
					if (next_retry.will_retry) {
						self._is_retrying = true;

						log.debug("retrying in " + next_retry.delay + " s");
						self._retry_timer = setTimeout(retry, next_retry.delay * 1000);
					} else {
						log.debug("giving up trying to reconnect");
					}
				}
				if (self.status !== STATUS.CLOSED) {
					details.will_retry = false;
					// emit status
					self._change_status(STATUS.CLOSED, details);
				}
			};

			// open transport.
			self._transport.open();
		}

		retry();
	}

	close(reason, message) {
		if (!this._transport && !this._is_retrying) {
			throw "connection already closed";
		}

		// the app wants to close .. don't retry
		this._retry = false;

		if (this._session && this._session.isOpen) {
			// if there is an open session, close that first.
			this._session.leave(reason, message);
		} else if (this._transport) {
			// no session active: just close the transport
			this._transport.close(1000);
		}
	}
}
