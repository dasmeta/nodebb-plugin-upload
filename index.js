var Package = require("./package.json");

var AWS = require("aws-sdk"),
	Minio = require("minio"),
	mime = require("mime"),
	uuid = require("uuid").v4,
	fs = require("fs"),
	request = require("request"),
	path = require("path"),
	winston = require.main.require("winston"),
	nconf = require.main.require('nconf'),
	gm = require("gm"),
	im = gm.subClass({imageMagick: true}),
	meta = require.main.require("./src/meta"),
	db = require.main.require("./src/database"),
	set = require("lodash").set();

var plugin = {};

"use strict";

var connection = null;
var uploadProvider = process.env.UPLOAD_PROVIDER || "s3";

var settings = initSettingsFromEnv();

var accessKeyIdFromDb = false;
var secretAccessKeyFromDb = false;
var serviceAccountFromDb = false;

function initSettingsFromEnv() {
	switch(uploadProvider) {
		case "s3": {
			return {
				"provider": "s3",
				"accessKeyId": process.env.AWS_ACCESS_KEY_ID ,
				"secretAccessKey": process.env.AWS_SECRET_ACCESS_KEY ,
				"region": process.env.AWS_DEFAULT_REGION || "us-east-1",
				"bucket": process.env.S3_UPLOAD_BUCKET || undefined,
				"host": process.env.S3_UPLOAD_HOST || "s3.amazonaws.com",
				"path": process.env.S3_UPLOAD_PATH || undefined,
				"acl" : process.env.ACL || undefined,
				"cloudFrontDomain": process.env.CLOUD_FRONT_DOMAIN || undefined,
			}
		}
		case "gcs": {
			return {
				"provider": "gcs",
				"serviceAccount": JSON.parse(Buffer.from(process.env.GCS_SERVICE_ACCOUNT || '', 'base64').toString('utf-8') || '{}'),
				"bucket": process.env.GCS_UPLOAD_BUCKET || undefined,
				"host": process.env.GCS_UPLOAD_HOST || "storage.googleapis.com",
				"path": process.env.GCS_UPLOAD_PATH || undefined,
			}
		}
		case "minio": {
			return {
				"provider": "minio",
				"accessKeyId": process.env.MINIO_ACCESS_KEY ,
				"secretAccessKey": process.env.MINIO_SECRET_KEY ,
				"bucket": process.env.MINIO_UPLOAD_BUCKET || undefined,
				"host": process.env.MINIO_UPLOAD_HOST || "localhost:9000",
				"path": process.env.MINIO_UPLOAD_PATH || undefined,
			}
		}
		default: {
			return {};
		}
	} 
}

function fetchSettings(callback) {
	db.getObjectFields(Package.name, Object.keys(settings), function (err, newSettings) {
		if (err) {
			winston.error(err.message);
			if (typeof callback === "function") {
				callback(err);
			}
			return;
		}

		if(!newSettings.provider) {
			settings.provider = process.env.UPLOAD_PROVIDER || "s3";
		}

		if(settings.provider === "s3") {
			accessKeyIdFromDb = false;
			secretAccessKeyFromDb = false;
	
			if (newSettings.accessKeyId) {
				settings.accessKeyId = newSettings.accessKeyId;
				accessKeyIdFromDb = true;
			}
	
			if (newSettings.secretAccessKey) {
				settings.secretAccessKey = newSettings.secretAccessKey;
				secretAccessKeyFromDb = false;
			}
	
			if (!newSettings.bucket) {
				settings.bucket = process.env.S3_UPLOAD_BUCKET || "";
			}
	
			if (!newSettings.host) {
				settings.host = process.env.S3_UPLOAD_HOST || "";
			}
	
			if (!newSettings.path) {
				settings.path = process.env.S3_UPLOAD_PATH || "";
			}
	
			if (!newSettings.region) {
				settings.region = process.env.AWS_DEFAULT_REGION || "";
			}
	
			if (settings.accessKeyId && settings.secretAccessKey) {
				AWS.config.update({
					accessKeyId: settings.accessKeyId,
					secretAccessKey: settings.secretAccessKey
				});
			}
	
			if (settings.region) {
				AWS.config.update({
					region: settings.region
				});
			}
		} 

		if(settings.provider === "minio") {
			accessKeyIdFromDb = false;
			secretAccessKeyFromDb = false;
	
			if (newSettings.accessKeyId) {
				settings.accessKeyId = newSettings.accessKeyId;
				accessKeyIdFromDb = true;
			}
	
			if (newSettings.secretAccessKey) {
				settings.secretAccessKey = newSettings.secretAccessKey;
				secretAccessKeyFromDb = false;
			}
	
			if (!newSettings.bucket) {
				settings.bucket = process.env.MINIO_UPLOAD_BUCKET || "";
			}
	
			if (!newSettings.host) {
				settings.host = process.env.MINIO_UPLOAD_HOST || "";
			}
	
			if (!newSettings.path) {
				settings.path = process.env.MINIO_UPLOAD_PATH || "";
			}
	
			if (settings.accessKeyId && settings.secretAccessKey) {

				var urlObj = new URL(!settings.host.startsWith("http") ? "http://" + settings.host : settings.host);
				connection = new Minio.Client({
					useSSL: urlObj.protocol === "https:",
					accessKey: settings.accessKeyId,
					secretKey: settings.secretKey,
					endPoint: urlObj.hostname,
					port: urlObj.port ? parseInt(urlObj.port) : 80,
				});
			}
		}

		if(settings.provider === "gcp") {
			secretAccessKeyFromDb = false;
	
			if (newSettings.serviceAccount) {
				settings.serviceAccount = newSettings.serviceAccount;
				secretAccessKeyFromDb = true;
			}
	
			if (!newSettings.bucket) {
				settings.bucket = process.env.GCS_UPLOAD_BUCKET || "";
			}
	
			if (!newSettings.host) {
				settings.host = process.env.GCS_UPLOAD_HOST || "";
			}
	
			if (!newSettings.path) {
				settings.path = process.env.GCS_UPLOAD_PATH || "";
			}
	
			if (settings.serviceAccount) {
				// TODO
			}
		}

		if (typeof callback === "function") {
			callback();
		}
	});
}

function getConnection() {

	if (!connection) {

		if(settings.provider === "s3") {
			connection = new AWS.S3();
		}

		if(settings.provider === "minio") {
			var urlObj = new URL(!settings.host.startsWith("http") ? "http://" + settings.host : settings.host);
			connection = new Minio.Client({
				useSSL: urlObj.protocol === "https:",
				accessKey: settings.accessKeyId,
				secretKey: settings.secretKey,
				endPoint: urlObj.hostname,
				port: urlObj.port ? parseInt(urlObj.port) : 80,
			});
		}

		if(settings.provider === "gcs") {
			// TODO
		}
	}

	return connection;
}

function makeError(err) {
	if (err instanceof Error) {
		err.message = Package.name + " :: " + err.message;
	} else {
		err = new Error(Package.name + " :: " + err);
	}

	winston.error(err.message);
	return err;
}

plugin.activate = function (data) {
	if (data.id === 'nodebb-plugin-upload') {
		fetchSettings();
	}

};

plugin.deactivate = function (data) {
	if (data.id === 'nodebb-plugin-upload') {
		connection = null;
	}
};

plugin.load = function (params, callback) {
	fetchSettings(function (err) {
		if (err) {
			return winston.error(err.message);
		}
		var adminRoute = "/admin/plugins/upload";

		params.router.get(adminRoute, params.middleware.applyCSRF, params.middleware.admin.buildHeader, renderAdmin);
		params.router.get("/api" + adminRoute, params.middleware.applyCSRF, renderAdmin);

		params.router.post("/api" + adminRoute + "/uploadsettings", prepareSettings);
		params.router.post("/api" + adminRoute + "/uploadcredentials", prepareCredentials);

		callback();
	});
};

function renderAdmin(req, res) {
	// Regenerate csrf token
	var token = req.csrfToken();

	var forumPath = nconf.get('url');
	if(forumPath.split("").reverse()[0] != "/" ){
		forumPath = forumPath + "/";
	}
	var data = {
		provider: settings.provider,
		bucket: settings.bucket,
		host: settings.host,
		path: settings.path,
		forumPath: forumPath,
		region: settings.region,
		accessKeyId: (accessKeyIdFromDb && settings.accessKeyId) || "",
		secretAccessKey: (accessKeyIdFromDb && settings.secretAccessKey) || "",
		serviceAccount: (serviceAccountFromDb && settings.serviceAccount) || "",
		csrf: token
	};

	res.render("admin/plugins/upload", data);
}

function prepareSettings(req, res, next) {
	var data = req.body;
	var newSettings = {
		provider: data.provider || "s3",
		bucket: data.bucket || "",
		host: data.host || "",
		path: data.path || "",
		region: data.region || ""
	};

	saveSettings(newSettings, res, next);
}

function prepareCredentials(req, res, next) {
	var data = req.body;
	var newSettings = {
		accessKeyId: data.accessKeyId || "",
		secretAccessKey: data.secretAccessKey || "",
		serviceAccount: data.serviceAccount || "",
	};

	saveSettings(newSettings, res, next);
}

function saveSettings(settings, res, next) {
	db.setObject(Package.name, settings, function (err) {
		if (err) {
			return next(makeError(err));
		}

		fetchSettings();
		res.json("Saved!");
	});
}

plugin.uploadImage = function (data, callback) {
	var image = data.image;

	if (!image) {
		winston.error("invalid image" );
		return callback(new Error("invalid image"));
	}

	//check filesize vs. settings
	if (image.size > parseInt(meta.config.maximumFileSize, 10) * 1024) {
		winston.error("error:file-too-big, " + meta.config.maximumFileSize );
		return callback(new Error("[[error:file-too-big, " + meta.config.maximumFileSize + "]]"));
	}

	var type = image.url ? "url" : "file";
	var allowedMimeTypes = ['image/png', 'image/jpeg', 'image/gif'];

	if (type === "file") {
		if (!image.path) {
			return callback(new Error("invalid image path"));
		}

		if (allowedMimeTypes.indexOf(mime.getType(image.path)) === -1) {
			return callback(new Error("invalid mime type"));
		}

		fs.readFile(image.path, function (err, buffer) {
			upload(image.name, err, buffer, callback);
		});
	}
	else {
		if (allowedMimeTypes.indexOf(mime.getType(image.url)) === -1) {
			return callback(new Error("invalid mime type"));
		}
		var filename = image.url.split("/").pop();

		var imageDimension = parseInt(meta.config.profileImageDimension, 10) || 128;

		// Resize image.
		im(request(image.url), filename)
			.resize(imageDimension + "^", imageDimension + "^")
			.stream(function (err, stdout, stderr) {
				if (err) {
					return callback(makeError(err));
				}

				// This is sort of a hack - We"re going to stream the gm output to a buffer and then upload.
				// See https://github.com/aws/aws-sdk-js/issues/94
				var buf = new Buffer(0);
				stdout.on("data", function (d) {
					buf = Buffer.concat([buf, d]);
				});
				stdout.on("end", function () {
					upload(filename, null, buf, callback);
				});
			});
	}
};

plugin.uploadFile = function (data, callback) {
	var file = data.file;

	if (!file) {
		return callback(new Error("invalid file"));
	}

	if (!file.path) {
		return callback(new Error("invalid file path"));
	}

	//check filesize vs. settings
	if (file.size > parseInt(meta.config.maximumFileSize, 10) * 1024) {
		winston.error("error:file-too-big, " + meta.config.maximumFileSize );
		return callback(new Error("[[error:file-too-big, " + meta.config.maximumFileSize + "]]"));
	}

	fs.readFile(file.path, function (err, buffer) {
		upload(file.name, err, buffer, callback);
	});
};

function upload(filename, err, buffer, callback) {
	if(settings.provider === "s3") {
		uploadToS3(filename, err, buffer, callback);
	}
	if(settings.provider === "minio") {
		uploadToMinio(filename, err, buffer, callback);
	}
	if(settings.provider === "gcs") {
		uploadToGCS(filename, err, buffer, callback);
	}
}

function uploadToS3(filename, err, buffer, callback) {
	if (err) {
		return callback(makeError(err));
	}

	var s3Path;
	if (settings.path && 0 < settings.path.length) {
		s3Path = settings.path;

		if (!s3Path.match(/\/$/)) {
			// Add trailing slash
			s3Path = s3Path + "/";
		}
	}
	else {
		s3Path = "/";
	}

	var s3KeyPath = s3Path.replace(/^\//, ""); // S3 Key Path should not start with slash.

	var params = {
		Bucket: settings.bucket,
		Key: s3KeyPath + uuid() + path.extname(filename),
		Body: buffer,
		ContentLength: buffer.length,
		ContentType: mime.getType(filename)
	};

	if(settings.acl){
		set(params, "ACL", settings.acl);
	}

	getConnection().putObject(params, function (err) {
		if (err) {
			return callback(makeError(err));
		}

		// amazon has https enabled, we use it by default
		var host = "https://" + params.Bucket +".s3.amazonaws.com";
		if (settings.host && 0 < settings.host.length) {
			host = settings.host;
			// host must start with http or https
			if (!host.startsWith("http")) {
				host = "http://" + host;
			}
		}

		var urlPrefix = settings.cloudFrontDomain || host;

		callback(null, {
			name: filename,
			url: urlPrefix + "/" + params.Key
		});
	});
}

function uploadToMinio(filename, err, buffer, callback) {
	if (err) {
		return callback(makeError(err));
	}

	var minioPath;
	if (settings.path && 0 < settings.path.length) {
		minioPath = settings.path;

		if (!minioPath.match(/\/$/)) {
			// Add trailing slash
			minioPath = minioPath + "/";
		}
	}
	else {
		minioPath = "/";
	}

	var minioKeyPath = minioPath.replace(/^\//, ""); // S3 Key Path should not start with slash.
	var newFilename = minioKeyPath + uuid() + path.extname(filename);

	getConnection().putObject(settings.bucket, newFilename, buffer, function (err) {
		if (err) {
			return callback(makeError(err));
		}

		// amazon has https enabled, we use it by default
		var host = "https://" + settings.bucket +".play.min.io";
		if (settings.host && 0 < settings.host.length) {
			host = settings.host + "/" + settings.bucket;
			// host must start with http or https
			if (!host.startsWith("http")) {
				host = "http://" + host;
			}
		}

		callback(null, {
			name: filename,
			url: host + "/" + newFilename
		});
	});
}

function uploadToGCS(filename, err, buffer, callback) {
	// TODO
}

var admin = plugin.admin = {};

admin.menu = function (custom_header, callback) {
	custom_header.plugins.push({
		"route": "/plugins/upload",
		"icon": "fa-envelope-o",
		"name": "Cloud upload"
	});

	callback(null, custom_header);
};

module.exports = plugin;
