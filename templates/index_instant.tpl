{% extends "base.tpl" %}

{% block main %}
		<main class="card is-connecting" id="kvm-card" aria-busy="true">
			<div id="status" class="status is-visible is-busy" role="status" aria-live="polite">
				<span class="status-spinner" aria-hidden="true"></span>
				<span class="status-text">Connecting…</span>
			</div>
			{% set logs_empty = False %}
			{% include "_session_log.tpl" %}
		</main>
{% end %}

{% block kvm_config %}
{
	websocketUri: "{{ websocket_uri }}",
	autoConnect: true,
	autoServer: {{ server_name }},
	autoPassword: {{ password }},
	autoResolution: {{ resolution }},
	serverCount: 1
}
{% end %}
