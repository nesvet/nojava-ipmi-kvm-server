(function () {
	"use strict";

	var config = window.KVM_UI_CONFIG;
	if (!config) {
		return;
	}

	var pageTitle = document.title;
	var ws = null;
	var hostName = "";
	var isConnecting = false;

	window.KvmUi = { _connectTimer: -1 };

	var els = {
		card: document.getElementById("kvm-card"),
		form: document.getElementById("kvm-form"),
		server: document.getElementById("kvm-server"),
		password: document.getElementById("kvm-password"),
		resolution: document.getElementById("kvm-resolution"),
		connectBtn: document.getElementById("connect-btn"),
		newTabBtn: document.getElementById("new-tab-btn"),
		status: document.getElementById("status"),
		logsPanel: document.getElementById("logs"),
		logsUl: document.getElementById("logsul"),
		container: document.getElementById("container"),
	};

	function isServerSelectable() {
		return els.server && els.server.tagName === "SELECT";
	}

	function restorePageTitle() {
		document.title = pageTitle;
	}

	function formatLogTimestamp() {
		return new Date().toLocaleString("de-DE");
	}

	function replaceContainerChildren(container, child) {
		if (!container) {
			return;
		}
		if (typeof container.replaceChildren === "function") {
			container.replaceChildren(child);
			return;
		}
		while (container.firstChild) {
			container.removeChild(container.firstChild);
		}
		container.appendChild(child);
	}

	function setStatus(message, kind) {
		if (!els.status) {
			return;
		}
		var visible = Boolean(message) || kind === "busy";
		els.status.className = "status" + (visible ? " is-visible" : "") + (kind ? " is-" + kind : "");
		if (kind === "busy") {
			els.status.innerHTML =
				'<span class="status-spinner" aria-hidden="true"></span>' +
				'<span class="status-text"></span>';
			els.status.querySelector(".status-text").textContent = message;
			return;
		}
		els.status.textContent = message || "";
	}

	function setFormDisabled(disabled) {
		isConnecting = disabled;
		if (els.card) {
			els.card.classList.toggle("is-connecting", disabled);
			els.card.setAttribute("aria-busy", disabled ? "true" : "false");
		}
		["connectBtn", "newTabBtn", "server", "password", "resolution"].forEach(function (key) {
			if (els[key]) {
				els[key].disabled = disabled;
			}
		});
		updateLogsVisibility();
	}

	function unlockForm(restoreTitle) {
		setFormDisabled(false);
		if (restoreTitle !== false) {
			restorePageTitle();
		}
	}

	function updateLogsVisibility() {
		if (!els.logsPanel) {
			return;
		}
		var hasEntries = els.logsUl && els.logsUl.children.length > 0;
		els.logsPanel.classList.toggle("is-empty", !hasEntries && !isConnecting);
	}

	function appendLog(message, isError) {
		if (!els.logsUl) {
			return;
		}
		var item = document.createElement("li");
		if (isError) {
			item.className = "error-log";
		}
		item.textContent = formatLogTimestamp() + ": " + message;
		els.logsUl.appendChild(item);
		els.logsUl.scrollTop = els.logsUl.scrollHeight;
		updateLogsVisibility();
	}

	function clearLogs() {
		if (!els.logsUl) {
			return;
		}
		els.logsUl.innerHTML = "";
		updateLogsVisibility();
	}

	function stopConnectingAnimation() {
		if (window.KvmUi._connectTimer !== -1) {
			clearInterval(window.KvmUi._connectTimer);
			window.KvmUi._connectTimer = -1;
		}
	}

	function startConnectingAnimation() {
		stopConnectingAnimation();
		var text = "Connecting to " + hostName + "…";
		setStatus(text, "busy");
		document.title = text;
	}

	function getServerCount() {
		if (typeof config.serverCount === "number") {
			return config.serverCount;
		}
		if (els.server && els.server.tagName === "SELECT") {
			return els.server.options.length;
		}
		return 1;
	}

	function readServerName() {
		if (config.autoConnect) {
			return config.autoServer || "";
		}
		return els.server ? els.server.value.trim() : "";
	}

	function readPassword() {
		if (config.autoConnect) {
			return config.autoPassword || "";
		}
		return els.password ? els.password.value : "";
	}

	function readResolution() {
		if (config.autoConnect) {
			return config.autoResolution || "";
		}
		return els.resolution ? els.resolution.value : "";
	}

	function focusField(field) {
		if (field && typeof field.focus === "function" && field.type !== "hidden") {
			field.focus();
		}
	}

	function applyInitialFocus() {
		if (config.autoConnect || !els.password) {
			return;
		}
		if (getServerCount() > 1) {
			focusField(els.server);
			return;
		}
		focusField(els.password);
	}

	function focusAfterFailure() {
		if (config.autoConnect) {
			return;
		}
		focusField(els.password);
	}

	function focusAfterNotice(message) {
		if (/hostname is not valid/i.test(message) && isServerSelectable()) {
			focusField(els.server);
			return;
		}
		if (/already connected/i.test(message) || /no unused port/i.test(message)) {
			return;
		}
		focusAfterFailure();
	}

	function getXsrfToken() {
		var input = document.querySelector("input[name='_xsrf']");
		return input ? input.value : "";
	}

	function deleteAllCookies() {
		var paths = ["/", "/oauth"];
		document.cookie.split(";").forEach(function (cookie) {
			var eqPos = cookie.indexOf("=");
			var name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
			if (!name) {
				return;
			}
			paths.forEach(function (path) {
				document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=" + path;
			});
			document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
		});
	}

	function enterSession(url) {
		document.body.classList.add("session-active");
		var iframe = document.createElement("iframe");
		iframe.className = "kvm-iframe";
		iframe.src = url;
		iframe.title = "KVM console";
		iframe.textContent = "Your browser does not support iframes.";
		replaceContainerChildren(els.container, iframe);
	}

	function handleConnectFailure(statusMessage, focusFn, options) {
		options = options || {};
		stopConnectingAnimation();
		unlockForm();
		setStatus(statusMessage, "error");
		document.title = options.title || statusMessage;
		if (options.logMessage !== false) {
			appendLog(options.logMessage || statusMessage, true);
		}
		if (focusFn) {
			focusFn();
		}
	}

	function connectWebSocket() {
		if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
			return ws;
		}
		ws = new WebSocket(config.websocketUri + "/kvm");
		ws.onopen = function () {
			if (config.autoConnect) {
				startKvm();
			}
		};
		ws.onmessage = function (evt) {
			var data;
			try {
				data = JSON.parse(evt.data);
			} catch (e) {
				return;
			}
			if (data.action === "notice") {
				stopConnectingAnimation();
				unlockForm();
				setStatus(data.message, "info");
				appendLog(data.message, false);
				focusAfterNotice(data.message);
				if (data.refresh) {
					window.setTimeout(function () {
						window.location.href = "/";
					}, 1500);
				}
				return;
			}
			if (data.action === "connected") {
				stopConnectingAnimation();
				setFormDisabled(false);
				setStatus("", "");
				document.title = "Connected to " + hostName;
				enterSession(data.url);
				return;
			}
			if (data.action === "log" || data.action === "error") {
				var isError = data.action === "error";
				appendLog(data.message, isError);
				if (isError) {
					handleConnectFailure("Failed to connect.", focusAfterFailure, {
						title: "Failed to connect",
						logMessage: false,
					});
				}
			}
		};
		ws.onclose = function () {
			if (!isConnecting) {
				return;
			}
			handleConnectFailure("Connection to server lost.", focusAfterFailure);
		};
		ws.onerror = function () {
			if (!isConnecting) {
				setStatus("WebSocket error.", "error");
				return;
			}
			handleConnectFailure("WebSocket error.", focusAfterFailure);
		};
		return ws;
	}

	function validateConnectForm() {
		hostName = readServerName();
		if (!hostName) {
			setStatus("Select a server.", "error");
			if (isServerSelectable()) {
				focusField(els.server);
			}
			return false;
		}
		if (!readPassword()) {
			setStatus("Enter the KVM password.", "error");
			focusField(els.password);
			return false;
		}
		return true;
	}

	function saveResolution() {}

	function startKvm() {
		if (isConnecting) {
			return;
		}
		if (!validateConnectForm()) {
			return;
		}
		saveResolution();
		clearLogs();
		setFormDisabled(true);
		startConnectingAnimation();
		var socket = connectWebSocket();
		var payload = JSON.stringify({
			action: "connect",
			server: hostName,
			password: readPassword(),
			resolution: readResolution(),
		});
		function send() {
			socket.send(payload);
		}
		if (socket.readyState === WebSocket.OPEN) {
			send();
		} else {
			socket.addEventListener("open", send, { once: true });
		}
	}

	function openInNewTab() {
		if (!validateConnectForm()) {
			return;
		}
		saveResolution();
		var form = document.createElement("form");
		form.method = "POST";
		form.action = "/";
		form.target = "_blank";
		[
			{ name: "_xsrf", value: getXsrfToken() },
			{ name: "server_name", value: hostName },
			{ name: "password", value: readPassword() },
			{ name: "resolution", value: readResolution() },
		].forEach(function (field) {
			var input = document.createElement("input");
			input.type = "hidden";
			input.name = field.name;
			input.value = field.value;
			form.appendChild(input);
		});
		document.body.appendChild(form);
		form.submit();
		form.remove();
	}

	window.KvmUi = Object.assign(window.KvmUi, {
		config: config,
		els: els,
		getHostName: function () {
			return hostName;
		},
		setHostName: function (value) {
			hostName = value;
		},
		setStatus: setStatus,
		stopConnectingAnimation: stopConnectingAnimation,
		startConnectingAnimation: startConnectingAnimation,
		saveResolution: saveResolution,
		restoreResolution: function () {},
		applyInitialFocus: applyInitialFocus,
		focusField: focusField,
		isServerSelectable: isServerSelectable,
		getServerCount: getServerCount,
		readResolution: readResolution,
		stopConnectingAnimation: stopConnectingAnimation,
		startConnectingAnimation: startConnectingAnimation,
	});

	var logoutLink = document.getElementById("logout-link");
	if (logoutLink) {
		logoutLink.addEventListener("click", deleteAllCookies);
	}
	if (els.card) {
		els.card.setAttribute("aria-busy", "false");
	}
	updateLogsVisibility();
	connectWebSocket();
	if (els.form) {
		els.form.addEventListener("submit", function (evt) {
			evt.preventDefault();
			startKvm();
		});
	}
	if (els.newTabBtn) {
		els.newTabBtn.addEventListener("click", openInNewTab);
	}
	if (isServerSelectable()) {
		els.server.addEventListener("change", function () {
			if (!config.autoConnect && els.password && !els.password.value) {
				focusField(els.password);
			}
		});
	}
	if (config.autoConnect) {
		hostName = config.autoServer || "";
	} else {
		applyInitialFocus();
	}
})();
