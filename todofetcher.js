/* Magic Mirror
 * Node Helper: MMM-iCal-ToDo
 *
 * Adapted by nixnuex https://github.com/nixnuex/
 * based on Magic Mirror Calendar by Michael Teeuw http://michaelteeuw.nl

 * MIT Licensed.
 */

var ical = require("./vendor/ical.js");
var moment = require("moment");

var ToDoFetcher = function(url, reloadInterval, excludedEvents, maximumEntries, maximumNumberOfDays, auth, includePastEvents) {
	var self = this;

	var reloadTimer = null;
	var events = [];

	var fetchFailedCallback = function() {};
	var eventsReceivedCallback = function() {};

	/* fetchToDo()
	 * Initiates todo fetch.
	 */
	var fetchToDo = function() {

		clearTimeout(reloadTimer);
		reloadTimer = null;

		nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1]);
		var opts = {
			headers: {
				"User-Agent": "Mozilla/5.0 (Node.js "+ nodeVersion + ") MagicMirror/"  + global.version +  " (https://github.com/MichMich/MagicMirror/)"
			},
			gzip: true
		};

		if (auth) {
			if(auth.method === "bearer"){
				opts.auth = {
					bearer: auth.pass
				};

			} else {
				opts.auth = {
					user: auth.user,
					pass: auth.pass
				};

				if(auth.method === "digest"){
					opts.auth.sendImmediately = false;
				} else {
					opts.auth.sendImmediately = true;
				}
			}
		}

		ical.fromURL(url, opts, function(err, data) {
			if (err) {
				fetchFailedCallback(self, err);
				scheduleTimer();
				return;
			}

			// console.log(data);
			newEvents = [];

			// limitFunction doesn't do much limiting, see comment re: the dates array in rrule section below as to why we need to do the filtering ourselves
			var limitFunction = function(date, i) {return true;};

			var eventDate = function(event, time) {
				return (event[time].length === 8) ? moment(event[time], "YYYYMMDD") : moment(new Date(event[time]));
			};

			for (var e in data) {
				var event = data[e];
				var now = new Date();
				var today = moment().startOf("day").toDate();
				var future = moment().startOf("day").add(maximumNumberOfDays, "days").subtract(1,"seconds").toDate(); // Subtract 1 second so that events that start on the middle of the night will not repeat.
				var past = today;

				if (includePastEvents) {
					past = moment().startOf("day").subtract(maximumNumberOfDays, "days").toDate();
				}

				// FIXME:
				// Ugly fix to solve the facebook birthday issue.
				// Otherwise, the recurring events only show the birthday for next year.
				var isFacebookBirthday = false;
				if (typeof event.uid !== "undefined") {
					if (event.uid.indexOf("@facebook.com") !== -1) {
						isFacebookBirthday = true;
					}
				}

				if (event.type === "VTODO") {

					var startDate;

					var title = getTitleFromEvent(event);
					if (event.status === "COMPLETED") {
					    continue;
					}

					newEvents.push({
						title: title,
					});
				}
			}

//			newEvents.sort(function(a, b) {
//				return a.startDate - b.startDate;
//			});

			//console.log(newEvents);

			events = newEvents.slice(0, maximumEntries);

			self.broadcastEvents();
			scheduleTimer();
		});
	};

	/* scheduleTimer()
	 * Schedule the timer for the next update.
	 */
	var scheduleTimer = function() {
		//console.log('Schedule update timer.');
		clearTimeout(reloadTimer);
		reloadTimer = setTimeout(function() {
			fetchToDo();
		}, reloadInterval);
	};

	/* getTitleFromEvent(event)
	* Gets the title from the event.
	*
	* argument event object - The event object to check.
	*
	* return string - The title of the event, or "Event" if no title is found.
	*/
	var getTitleFromEvent = function (event) {
		var title = "Event";
		if (event.summary) {
			title = (typeof event.summary.val !== "undefined") ? event.summary.val : event.summary;
		} else if (event.description) {
			title = event.description;
		}

		return title;
	};

	var testTitleByFilter = function (title, filter, useRegex, regexFlags) {
		if (useRegex) {
			// Assume if leading slash, there is also trailing slash
			if (filter[0] === "/") {
				// Strip leading and trailing slashes
				filter = filter.substr(1).slice(0, -1);
			}

			filter = new RegExp(filter, regexFlags);

			return filter.test(title);
		} else {
			return title.includes(filter);
		}
	};

	/* public methods */

	/* startFetch()
	 * Initiate fetchToDo();
	 */
	this.startFetch = function() {
		fetchToDo();
	};

	/* broadcastItems()
	 * Broadcast the existing events.
	 */
	this.broadcastEvents = function() {
		//console.log('Broadcasting ' + events.length + ' events.');
		eventsReceivedCallback(self);
	};

	/* onReceive(callback)
	 * Sets the on success callback
	 *
	 * argument callback function - The on success callback.
	 */
	this.onReceive = function(callback) {
		eventsReceivedCallback = callback;
	};

	/* onError(callback)
	 * Sets the on error callback
	 *
	 * argument callback function - The on error callback.
	 */
	this.onError = function(callback) {
		fetchFailedCallback = callback;
	};

	/* url()
	 * Returns the url of this fetcher.
	 *
	 * return string - The url of this fetcher.
	 */
	this.url = function() {
		return url;
	};

	/* events()
	 * Returns current available events for this fetcher.
	 *
	 * return array - The current available events for this fetcher.
	 */
	this.events = function() {
		return events;
	};
};

module.exports = ToDoFetcher;
