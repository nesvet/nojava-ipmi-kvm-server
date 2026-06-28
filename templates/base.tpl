{% import os %}
{% if version %}{% set ui_cache = version %}{% else %}{% set ui_cache = os.environ.get("UI_CACHE_VERSION", "1") %}{% end %}
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>{{ title }}</title>
	<link rel="stylesheet" href="/static/app.core.css?v={{ ui_cache }}">
</head>
<body>
	<div class="app-shell app-page" id="app-shell">
		<header class="app-header">
			<h1>{{ title }}</h1>
			{% if user['name'] != 'anonymous' %}
			<p class="user-meta">Hello {{ user['name'] }} ({{ user['email'] }})</p>
			{% end %}
		</header>

		{% block main %}{% end %}

		{% block footer %}
		{% if 'OAUTH_HOST' in os.environ %}
		<footer class="app-footer">
			<a href="/oauth/login" id="logout-link">Logout.</a>
		</footer>
		{% end %}
		{% end %}
	</div>

	<div id="container"></div>

	{% block after_container %}{% end %}

	<script>
		window.KVM_UI_CONFIG = {% block kvm_config %}{}{% end %};
	</script>
	<script src="/static/app.core.js?v={{ ui_cache }}"></script>
</body>
</html>
