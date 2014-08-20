"use strict";

// Declare app level module which depends on filters, and services
angular.module("myApp", [
	"ui.router",
	"ngTouch",
	"ngCookies",
	"ngSanitize",
	"ajoslin.promise-tracker",
	"angularMoment",
	"hmTouchEvents",
	"LocalStorageModule"
])
.factory("AuthInterceptor", ["$q", "$rootScope", "$log", "$cookies", "$timeout", "$stateParams", "$injector",

	// intercept all 401's and return to login screen
	function ($q, $rootScope, $log, $cookies, $timeout, $stateParams, $injector) {
		return {
			responseError: function (response) {

				var $state = $injector.get("$state");

				$log.log("going to state ", $state);

				// if you're on the login page, errors are expected
				if ($state.is("login") && response.status !== 502) {
					return $q.reject(response);
				}

				if (response.status === 502) {

					$rootScope.$broadcast("showDisconnectedDialog");

				} else if (response.status === 503) {

					window.location.href = "go to server down url";
					return $q.reject(response);

				}
				// every other error is rejected
				return $q.reject(response);

			}
		};
	}]
)
.factory("CacheInterceptor", ["$q", function($q) {

	return {

		request: function (config) {

			if (config.url.indexOf("api") !== -1) {

				// kill the cache for api calls
				var separator = config.url.indexOf("?") === -1 ? "?" : "&",
					d = new Date();

				config.url += separator + "cacheBuster=" + d.getTime();

			}

			return config;
		}
	};
}])
.config(["$stateProvider", "$httpProvider", "$urlRouterProvider", function($stateProvider, $httpProvider, $urlRouterProvider) {

	// In Internet Explorer 9 (and 8), the console object is only exposed when the developer tools are opened for a particular tab.
	// Below lines will prevent any error because of console.log usage.
	window.console = window.console || {};
	window.console.log = window.console.log || function() {};

	//intercept 401, 403, 503
	$httpProvider.interceptors.push("AuthInterceptor");

	// ie tries to cache requests, add cachebuster to make new calls
	if (bowser.msie) {
		$httpProvider.interceptors.push("CacheInterceptor");
	}

	$stateProvider.state("home", {		
		templateUrl: "views/home/home.html",
		controller: "HomeController"
	});
	
	//$urlRouterProvider.otherwise("home");

	// Deal with missing trailing slash
	$urlRouterProvider.rule(function($injector, $location) {
		var path = $location.path(), search = $location.search();
		if (path[path.length-1] !== "/") {
			if (search === {}) {
				return path + "/";
			} else {
				var params = [];
				angular.forEach(search, function(v, k){
					params.push(k + "=" + v);
				});
				return path + "/?" + params.join("&");
			}
		}
	});

}])
.run(function($rootScope, $location, $document, $log, $cookieStore, $state, $timeout, $window) {

	// This function runs once when app is initialized

	// This is a hack to get mobile safari to recognize CSS pseudo classes
	document.addEventListener("touchstart", function() {}, false);

	$rootScope.$on("$stateChangeError", function(event, toState, toParams, fromState, fromParams, error) {
		$log.log("failed state change: " , error);
		$state.go("login");
	});

	$rootScope.$on("$stateChangeSuccess", function() {
		// Go to top of page on URL change
		document.body.scrollTop = document.documentElement.scrollTop = 0;
	});

	$rootScope.$on("showDisconnectedDialog", function(e) {
		$rootScope.disconnectedDialogVisible = true;
	});

	$rootScope.$on("hideDisconnectedDialog", function(e) {
		$rootScope.disconnectedDialogVisible = false;
	});

	$rootScope.retryConnectionHandler = function() {

	}

	// Check if we're on touch device
	var isTouchDevice = "ontouchstart" in document.documentElement;
	$rootScope.isTouchDevice = isTouchDevice;

	// Global click event listener
	$document.bind("click", function(e) {
		// Only use this if NOT on mobile
		if (!$rootScope.isTouchDevice) {
			$rootScope.$broadcast("globalClick", e);
		}
	});

	// Global click event listener for mobile
	$document.bind("touchend", function(e) {
		$rootScope.$broadcast("globalClick", e);
	});

	// Global enter event listener
	$document.bind("keyup", function(e) {
		if (e.which === 13 || e.keyCode === 13) {
			$rootScope.$broadcast("globalEnter", e);
		}
	});

	var supportsOrientationChange = "onorientationchange" in window;

	// Global orientation change listener
	if (supportsOrientationChange) {
		angular.element($window).bind("orientationchange", function() {
			$rootScope.$broadcast("orientationChange");
		});
	} else {
		// Also listen to resize for android devices not detecting orientationchange
		angular.element($window).bind("resize", function() {
			$rootScope.$broadcast("orientationChange");
		});
	}

	// Check for global errors
	$timeout(function() {
		// Browser check
		// Checks got kind of ugly because android needed additional kindle check because of
		// problems detecting browser version

		// Kindle flag
		var isSilk;
		if (navigator.userAgent.search("Silk") > -1) {
			isSilk = true;
		} else {
			isSilk = false
		}

		// Android/Kindle check
		if (bowser.android && bowser.version < 4 && !isSilk) {
			$state.go("global-error", {errorType: "not-supported"});
		} else if(bowser.android && bowser.version < 3 && isSilk) {
			$state.go("global-error", {errorType: "not-supported"});
		}

		// Rest of browser checks
		else if ((bowser.msie && bowser.version < 9) ||
			(bowser.firefox && bowser.version < 13) ||
			(bowser.safari && bowser.version < 5) ||
			(bowser.chrome && bowser.version < 21) ||
			(bowser.ios && bowser.version < 6)
		){
				$state.go("global-error", {errorType: "not-supported"});

		} else {
			// There's a message that is shown by default saying the browser isn't supported,
			// because some browsers like IE8 won't even get far enough in the app to call the
			// above `$state.go()` function. In the event we ARE on a supported browser, hide
			// this message.
			$rootScope.$broadcast("hideBrowserError");
		}

		// Cookie check
		var cookiesEnabled = navigator.cookieEnabled;

		if (!cookiesEnabled) {
			// Need to use $location.path because $state.go blows up if cookies are disabled
			$location.path("/global-error/cookies");
		}

		// Phone check
		if ($rootScope.isTouchDevice && screen.width < 641) {
			$location.path("/global-error/phone");
		}

		// Windows 8 touch check
		if (window.navigator.msMaxTouchPoints) {
			//alert("In windows 8 touch");
		}

	});

});