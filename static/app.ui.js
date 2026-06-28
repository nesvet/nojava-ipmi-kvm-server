(function () {
	"use strict";

	var k = window.KvmUi;
	if (!k) {
		return;
	}

	var RESOLUTION_STORAGE_KEY = "nojava-kvm-resolution";
	var LEGACY_RESOLUTION_STORAGE_KEY = "kvm-resolution";

	function repeatChar(ch, count) {
		var out = "";
		for (var i = 0; i < count; i += 1) {
			out += ch;
		}
		return out;
	}

	function getResolutionOptions() {
		if (!k.els.resolution) {
			return [];
		}
		return Array.prototype.map.call(k.els.resolution.options, function (option) {
			return option.value;
		});
	}

	function migrateResolutionStorage() {
		try {
			var legacy = localStorage.getItem(LEGACY_RESOLUTION_STORAGE_KEY);
			if (legacy && !localStorage.getItem(RESOLUTION_STORAGE_KEY)) {
				localStorage.setItem(RESOLUTION_STORAGE_KEY, legacy);
				localStorage.removeItem(LEGACY_RESOLUTION_STORAGE_KEY);
			}
		} catch (e) {
			/* ignore */
		}
	}

	k.saveResolution = function () {
		var value = k.readResolution();
		if (!value) {
			return;
		}
		try {
			localStorage.setItem(RESOLUTION_STORAGE_KEY, value);
		} catch (e) {
			/* ignore */
		}
	};

	k.restoreResolution = function () {
		if (!k.els.resolution) {
			return;
		}
		try {
			var saved = localStorage.getItem(RESOLUTION_STORAGE_KEY);
			if (saved && getResolutionOptions().indexOf(saved) !== -1) {
				k.els.resolution.value = saved;
			}
		} catch (e) {
			/* ignore */
		}
	};

	k.startConnectingAnimation = function () {
		var dots = 0;
		k.stopConnectingAnimation();
		var hostName = k.getHostName();
		var text = "Connecting to " + hostName + "…";
		k.setStatus(text, "busy");
		document.title = text;
		k._connectTimer = window.setInterval(function () {
			dots = (dots + 1) % 4;
			var animated = "Connecting to " + hostName + repeatChar(".", dots);
			var textNode = k.els.status && k.els.status.querySelector(".status-text");
			if (textNode) {
				textNode.textContent = animated;
			} else {
				k.setStatus(animated, "busy");
			}
			document.title = animated;
		}, 500);
	};

	migrateResolutionStorage();
	k.restoreResolution();
})();
