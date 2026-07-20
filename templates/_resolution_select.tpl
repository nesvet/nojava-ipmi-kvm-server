<select id="kvm-resolution" name="resolution">
	<option value="800x600"{% if default_resolution == "800x600" %} selected{% end %}>800 × 600</option>
	<option value="1024x768"{% if default_resolution == "1024x768" %} selected{% end %}>1024 × 768</option>
	<option value="1280x960"{% if default_resolution == "1280x960" %} selected{% end %}>1280 × 960</option>
	<option value="1600x1200"{% if default_resolution == "1600x1200" %} selected{% end %}>1600 × 1200</option>
</select>
