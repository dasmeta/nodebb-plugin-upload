<h1><i class="fa fa-picture-o"></i>Upload Configuration</h1>
<hr/>

<p>You can configure this plugin via <em>environment variables</em>. You can also specify values in the form below, and those will be
	stored in the database.</p>

<h3>Environment Variables</h3>
<pre><code>
// s3
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export S3_UPLOAD_BUCKET="your-bucket-name"
export S3_UPLOAD_HOST="host"
export S3_UPLOAD_PATH="path"

// gcs
export GCS_SERVICE_ACCOUNT="your-service-account-json"
export GCS_UPLOAD_BUCKET="your-bucket-name"
export GCS_UPLOAD_HOST="host"
export GCS_UPLOAD_PATH="path"

// minio
export MINIO_ACCESS_KEY="your-access-key"
export MINIO_SECRET_KEY="your-secret-key"
export MINIO_UPLOAD_BUCKET="your-bucket-name"
export MINIO_ENDPOINT="endpoint" // api host
export MINIO_UPLOAD_HOST="host" // host for reading files, usually same as endpoint
export MINIO_UPLOAD_PATH="path"

</code></pre>

<p>
	Asset host and asset path are optional. You can leave these blank to default to the standard asset url -
	http://mybucket.s3.amazonaws.com/uuid.jpg.<br/>
	Asset host can be set to a custom asset host. For example, if set to cdn.mywebsite.com then the asset url is
	http://cdn.mywebsite.com/uuid.jpg.<br/>
	Asset path can be set to a custom asset path. For example, if set to /assets, then the asset url is
	http://mybucket.s3.amazonaws.com/assets/uuid.jpg.<br/>
	If both are asset host and path are set, then the url will be http://cdn.mywebsite.com/assets/uuid.jpg.
</p>

<h3>Database Stored configuration:</h3>
<form id="upload-settings">
	<label for="upload-provider">Upload Provider</label><br/>
	<select id="upload-provider" name="provider" title="Upload Provider" class="form-control">
		<option value="s3">AWS S3</option>
		<option value="gcs">Google Cloud Storage</option>
		<option value="minio">Minio</option>
	</select>
	<label for="bucket">Bucket</label><br/>
	<input type="text" id="bucket" name="bucket" value="{bucket}" title="Bucket" class="form-control input-lg"
	       placeholder="Bucket"><br/>

	<div id="endpoint-wrapper">
		<label for="endpoint">Endpoint</label><br/>
		<input type="text" id="endpoint" name="endpoint" value="{endpoint}" title="Endpoint" class="form-control input-lg"
			placeholder="website.com or https://website.com"><br/>
	</div>

	<label for="host">Host</label><br/>
	<input type="text" id="host" name="host" value="{host}" title="Host" class="form-control input-lg"
	       placeholder="website.com or https://website.com"><br/>

	<label for="path">Path</label><br/>
	<input type="text" id="path" name="path" value="{path}" title="Path" class="form-control input-lg"
	       placeholder="/assets"><br/>

	<div id="region-wrapper">
		<label for="region">Region</label><br/>
		<select id="region" name="region" title="AWS Region" class="form-control">
			<option value="">..</option>
			<option value="us-east-1">Standard (us-east-1)</option>
			<option value="us-west-1">N. California (us-west-1)</option>
			<option value="us-west-2">Oregon (us-west-2)</option>
			<option value="ca-central-1">Canada (ca-central-1)</option>
			<option value="eu-west-1">Ireland (eu-west-1)</option>
			<option value="eu-west-2">London (eu-west-2)</option>
			<option value="eu-central-1">Frankfurt (eu-central-1)</option>
			<option value="ap-northeast-1">Tokyo (ap-northeast-1)</option>
			<option value="ap-northeast-2">Seoul (ap-northeast-2)</option>
			<option value="ap-southeast-1">Singapore (ap-southeast-1)</option>
			<option value="ap-southeast-2">Sydney (ap-southeast-2)</option>
			<option value="ap-south-1">Mumbai (ap-south-1)</option>
			<option value="sa-east-1">São Paulo (sa-east-1)</option>
		</select>
	</div>
	<br/>

	<button class="btn btn-primary" type="submit">Save</button>
</form>

<br><br>
<form id="upload-credentials">
	<label for="bucket">Credentials</label><br/>
	<div class="alert alert-warning">
		Configuring this plugin using the fields below is <strong>NOT recommended</strong>, as it can be a potential
		security issue. We highly recommend to use <strong>Environment Variables</strong> instead
	</div>
	<div id="credentials">
		<input type="text" name="accessKeyId" value="{accessKeyId}" maxlength="20" title="Access Key ID"
			class="form-control input-lg" placeholder="Access Key ID"><br/>
		<input type="text" name="secretAccessKey" value="{secretAccessKey}" title="Secret Access Key"
			class="form-control input-lg" placeholder="Secret Access Key"><br/>
	</div>
	<div id="service-account" style="display:none">
		<input type="text" name="serviceAccount" value="{serviceAccount}" title="Service Account JSON (base64 encoded)"
			class="form-control input-lg" placeholder="Service Account (base64 encoded JSON)"><br/>
	</div>
	<button class="btn btn-primary" type="submit">Save</button>
</form>

<script>
	$(document).ready(function () {

		$('#region option[value="{region}"]').prop('selected', true)
		$('#upload-provider option[value="{provider}"]').prop('selected', true);

		$("#upload-settings").on("submit", function (e) {
			e.preventDefault();
			save("uploadsettings", this);
		});

		$("#upload-credentials").on("submit", function (e) {
			e.preventDefault();
			var form = this;
			bootbox.confirm("Are you sure you wish to store your credentials in the database?", function (confirm) {
				if (confirm) {
					save("uploadcredentials", form);
				}
			});
		});

		$("#upload-provider").on("change", function (e) {
			if($(this).val() === "gcs") {
				$("#credentials").hide();
				$("#service-account").show();
			} else {
				$("#credentials").show();
				$("#service-account").hide();
			}

			if($(this).val() === "gcs" || $(this).val() === "minio") {
				$('#region-wrapper').hide();
			} else {
				$('#region-wrapper').show();
			}

			if($(this).val() === "minio") {
				$('#endpoint-wrapper').show();
			} else {
				$('#endpoint-wrapper').hide();
			}
		})
		$('#upload-provider').change();

		function save(type, form) {
			var data = {
				_csrf: '{csrf}' || $('#csrf_token').val()
			};

			var values = $(form).serializeArray();
			for (var i = 0, l = values.length; i < l; i++) {
				data[values[i].name] = values[i].value;
			}

			$.post('{forumPath}api/admin/plugins/upload/' + type, data).done(function (response) {
				if (response) {
					ajaxify.refresh();
					app.alertSuccess(response);
				}
			}).fail(function (jqXHR, textStatus, errorThrown) {
				ajaxify.refresh();
				app.alertError(jqXHR.responseJSON ? jqXHR.responseJSON.error : 'Error saving!');
			});
		}
	});
</script>
