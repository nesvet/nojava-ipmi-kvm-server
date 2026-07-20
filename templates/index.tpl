{% extends "base.tpl" %}

{% block main %}
		<main class="card" id="kvm-card">
			<form id="kvm-form">
				{% module xsrf_form_html() %}

				<div class="form-grid">
					{% include "_server_field.tpl" %}

					<label for="kvm-password">Password:</label>
					<input id="kvm-password" name="password" type="password" autocomplete="current-password" required>

					<label for="kvm-resolution">Resolution:</label>
					{% include "_resolution_select.tpl" %}

					<div class="form-actions">
						<button type="submit" class="btn btn-primary" id="connect-btn">Connect!</button>
						<button type="button" class="btn btn-secondary" id="new-tab-btn">Connect in new tab!</button>
					</div>
				</div>
			</form>

			<div id="status" class="status" role="status" aria-live="polite"></div>

			{% set logs_empty = True %}
			{% include "_session_log.tpl" %}
		</main>
{% end %}

{% block kvm_config %}
{
	websocketUri: "{{ websocket_uri }}",
	autoConnect: false,
	serverCount: {{ len(servers) }},
	defaultResolution: "{{ default_resolution }}"
}
{% end %}
