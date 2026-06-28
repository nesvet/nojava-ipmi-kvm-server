{# Multi-host <select> is the default path. Single-host: read-only label + hidden #kvm-server (config key). #}
{% if len(servers) == 1 %}
{% for server in servers %}
{% set label = server_labels[server] if server in server_labels else server %}
<label id="kvm-server-label">Server Name:</label>
<p class="server-name" id="kvm-server-display" aria-labelledby="kvm-server-label">
	{% if label != server %}{{ server }} — {{ label }}{% else %}{{ label }}{% end %}
</p>
<input type="hidden" id="kvm-server" name="server" value="{{ server }}">
{% end %}
{% else %}
<label for="kvm-server">Server Name:</label>
<select id="kvm-server" name="server" required>
	{% for server in servers %}
	{% set label = server_labels[server] if server in server_labels else server %}
	<option value="{{ server }}">{% if label != server %}{{ server }} — {{ label }}{% else %}{{ label }}{% end %}</option>
	{% end %}
</select>
{% end %}
