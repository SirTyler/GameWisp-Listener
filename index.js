'use strict';
var bodyParser = require('body-parser');

var EventEmitter = require('events').EventEmitter,
    app = require('express')(),
	server = require('http').Server(app),
    util = require('util');
	
var socketClient = require("socket.io-client")('https://singularity.gamewisp.com');

/**
 * GameWisp constructor
 *
 * @param {Object} options
 */
function GameWisp(options) {
    // Makes "new" optional
    if (!(this instanceof GameWisp)) return new GameWisp(options);
    this.options = options;

    // Socket.io object
    this.loadSocketIO();
}

util.inherits(GameWisp, EventEmitter);

/**
 * Loads the socket.io client
 */
GameWisp.prototype.loadSocketIO = function() {
    if(this._socket) return;

    var _self = this;
	
	app.use(bodyParser());

	//oauth configuration
	var oAuthInfo = {
		site: 'https://api.gamewisp.com',
		clientID: _self.options.clientID,
		clientSecret: _self.options.clientSecret,
		tokenPath: '/pub/v1/oauth/token',
		authorizationPath: '/pub/v1/oauth/authorize'
	};

	var oauth2 = require('simple-oauth2')(oAuthInfo);

	// Authorization Channel uri definition 
	var authorization_uri = oauth2.authCode.authorizeURL({
		redirect_uri: _self.options.redirect_uri,
		scope: 'read_only,user_read',
		state: 'nodecg'
	});

	// Authorization Subscriber uri definition 
	var authorization_uri2 = oauth2.authCode.authorizeURL({
		redirect_uri: _self.options.redirect_uri,
		scope: 'user_read',
		state: 'nodecg'
	});

	//------APPLICATION ROUTES-------//

	//basic endpoint to auth a channel. 
	app.get('/auth', function(req, res){
		res.redirect(authorization_uri);
	});

	//basic endpoint to auth a subscriber.
	app.get('/auth-subscriber', function(req, res){
		res.redirect(authorization_uri2)
	});

	//basic up and running page
	app.get('/', function(req, res){
		res.send('<h1>You made it to the skeleton service</h1> <p> Hit /auth if you need to authorize a channel. </p><p>Hit /auth-subscriber if you need to authorize a subscriber.</p>');
	});

	//use this as the redirect_uri for your client credentials.
	app.get(_self.options.redirect_path, function(req,res){
		var code = req.query.code;
		var token = oauth2.authCode.getToken({
			code: code,
			redirect_uri: (_self.options.redirect_uri)
		}).then(function saveToken(result){
			if(result.error == undefined){
				token = oauth2.accessToken.create(result);
				var accessToken = token.token.access_token;
				_self.emit('channel-connect', token.token);
				
				res.send('<h1>You got a token object from GameWisp. Here is the auth token:' + token.token.access_token);
			} else {
				res.send('<h1> There was an error: ' + result.error_description + '</h1>');
			}
		}).catch( function logError(error){
			_self.emit('error', error);
		});
	});

	server.listen(_self.options.nodePort);
	
	var initSocketApiConnectionForChannel = function(accessToken){
		var data = {   
			access_token: accessToken,
		};

		//connect the channels. 
		console.log('attempting to connect channel with access_token: ' + accessToken);
		sendSingularityData(data, 'channel-connect');
	}


	//sends data to singularity.
	var sendSingularityData = function(channelJson, call){
		socketClient.emit(call, channelJson);
	};

	//------ SINGULARITY ------//

	//--- CONNECTION
	socketClient.on('connect', function(){  
		_self.emit('connected');
		socketClient.emit('authentication', {
			key: oAuthInfo.clientID, 
			secret: oAuthInfo.clientSecret,
		});
	});


	//--- AUTHENTICATION
	//Fires when your client is successfully authenticated
	socketClient.on('authenticated', function(data) {
		_self.emit('authenticated');
	});

	//Fires if there is an error with authentication. Typically bad client credentials. 
	socketClient.on('unauthorized', function(err){
		_self.emit('authenticationFailed');
	});

    socketClient.on('connect', function() {
        _self.emit('connected');
    });

    socketClient.on('authenticated', function() {
        _self.emit('authenticated');
    });

//--- ON-DEMAND RESPONSES (see: https://gamewisp.readme.io/docs/on-demand-event-basics)

	socketClient.on('app-channel-connected', function(data, callback){
		_self.emit('app-channel-connected', data);
	});

	socketClient.on('app-channel-subscribers', function(data, callback){
		_self.emit('app-channel-subscribers', data);
	});

	socketClient.on('app-channel-tiers', function(data, callback){
		_self.emit('app-channel-tiers', data);
	});


	//--- REAL TIME EVENTS (see: https://gamewisp.readme.io/docs/real-time-events)

	socketClient.on('subscriber-new', function(data, callback){
		_self.emit('subscriber-new', data);
	});

	socketClient.on('subscriber-renewed', function(data, callback){
		_self.emit('subscriber-renewed', data);
	});

	socketClient.on('subscriber-status-change', function(data, callback){
		_self.emit('subscriber-status-change', data);
	});

	socketClient.on('subscriber-benefits-change', function(data, callback){
		_self.emit('subscriber-benefits-change', data);
	});

	socketClient.on('benefit-fulfilled', function(data, callback){
		_self.emit('benefit-fulfilled', data);
	});

	socketClient.on('benefit-dismissed-user', function(data, callback){
		_self.emit('benefit-dismissed-user', data);
	});

	socketClient.on('benefit-dismissed-channel', function(data, callback){
		_self.emit('benefit-dismissed-channel', data);
	});

	socketClient.on('tier-published', function(data, callback){
		_self.emit('tier-published', data);
	});

	socketClient.on('tier-unpublished', function(data, callback){
		_self.emit('tier-unpublished', data);
	});

	socketClient.on('tier-modified', function(data, callback){
		_self.emit('tier-modified', data); 
	});

	socketClient.on('tier-benefit-added', function(data, callback){
		_self.emit('tier-benefit-added', data); 
	});

	socketClient.on('tier-benefit-removed', function(data, callback){
		_self.emit('tier-benefit-remoed', data); 
	});
};

module.exports = GameWisp;