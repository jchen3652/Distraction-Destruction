// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
'use strict';

var environmentCreateTime;
var previousLogTime = 0;
var previousURL = '';
var capped = true; // The log is 'capped' when the last entry has its end time set
var lastFocusEvent = 0; // amount of times since the last time
var previousTabID;

var isDebug = false;

var lostFocusEventTriggered = false;

var checkGeneralFocus = true;
var lostFocusByTime = false;
var timeFocusLoggedOnce = false;

// Boonkganged for easier logging
var bkg = chrome.extension.getBackgroundPage().console;

chrome.runtime.onInstalled.addListener(function() {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [new chrome.declarativeContent.PageStateMatcher({})],
      actions: [new chrome.declarativeContent.ShowPageAction()]
    }]);
  });

  // Initialize value of debug
  chrome.storage.local.set({
    isDebug: isDebug
  }, function() {
    bkg.log('Debug mode: ' + isDebug);
  });
});

setInterval(function() {
  chrome.windows.getCurrent(function(innerWindow) {



    // If it really changed, cap the log
    var isFocused = false;


    try {
      isFocused = innerWindow.focused;
    } catch (err) {
      isFocused = false;
      if (chrome.runtime.lastError) {
        debugWarn("Whoops.. " + chrome.runtime.lastError.message);
      } else {
        // do nothing
      }

    }


    if (!isFocused) {
      cap();
      if (!lostFocusByTime) {
        lostFocusByTime = true;
        if (!timeFocusLoggedOnce) {
          bkg.log('Lost focus by time');
          timeFocusLoggedOnce = true;
        }
        previousURL = '';
      }

    } else {
      if (isFocused && lostFocusByTime) {
        if (timeFocusLoggedOnce) {
          timeFocusLoggedOnce = false;
          bkg.log('Regained focus by time');

        }
        // bkg.log('Regained focus by time')
        // bkg.log('Regained focus by time');
        handlePageChange();
        lostFocusByTime = false;
      } else {

        debugLog('False lost focus by time');
      }
    }

  });

}, 1000);

// Called when tab is changed
chrome.tabs.onActivated.addListener(function(activeInfo) {
  debugLog('Chrome activated function called');
  chrome.tabs.getSelected(null, function(tab) {
    checkGeneralFocus = false;
    if ((tab.url != previousURL && !lostFocusEventTriggered)) {
      // debugLog('Tab change detected.');
      lostFocusByTime = false;

      // debugLog('Value of tab capped: ' + capped);
      debugLog('Tab URL has changed, so it is known that the page changed.');
      handlePageChange();


      lostFocusEventTriggered = false;


    } else if (lostFocusEventTriggered) {
      lostFocusEventTriggered = false;
      debugLog('Simultaneous focus change and tab change detected. Only acting upon focus change');
    } else {
      debugLog('Nothing should happen');
    }
    checkGeneralFocus = true;
    previousURL = tab.url;
  });

});

// Called when tab is updated
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  checkGeneralFocus = false;
  // bkg.log('Tab update detected');
  // bkg.log('URL of updated tab: ' + changeInfo.url);
  if (previousURL == '') {
    previousURL = changeInfo.url;
  } else if (changeInfo.url != previousURL) {
    if (lostFocusEventTriggered) {
      lostFocusEventTriggered = false;
      debugLog('Simultaneous focus change and tab change detected. Only acting upon focus change')
    } else {
      handlePageChange();
      lostFocusByTime = false;
    }
  } else {
    debugLog('Identical URL detected; no action taking place');
  }

  checkGeneralFocus = true;
});

// Called when focus changes
chrome.windows.onFocusChanged.addListener(function(window) {
  chrome.tabs.getSelected(null, function(tab) {
    var isDevTools;

    try {
      isDevTools = tab.url.includes('devtools');
    } catch (err) {
      isDevTools = false;
      if (chrome.runtime.lastError) {
        debugWarn("Whoops.. " + chrome.runtime.lastError.message);
      }
    }

    checkGeneralFocus = false;

    var currentTime;

    if (lastFocusEvent == 0) {
      lastFocusEvent = Date.now();
    } else {
      currentTime = Date.now();

      if ((currentTime - lastFocusEvent) <= 500) {
        debugLog('Duplicated focus event blocked. Disregard this message');
      } else if (isDevTools) {
        debugLog('Devtools focus event blocked. Disregard this message.')
      } else {
        // It thinks through the event that the window has changed. It's not always right so...
        if ((window == chrome.windows.WINDOW_ID_NONE)) {
          wait(100);
          // Double checks to see whether the window really changed
          chrome.windows.getCurrent(function(innerWindow) {
            // If it really changed, cap the log
            var isFocused;

            try {
              isFocused = innerWindow.focused;
            } catch (err) {
              innerWindow = false;
              if (chrome.runtime.lastError) {
                console.warn("Whoops.. " + chrome.runtime.lastError.message);
              }
            }

            if (!isFocused) {
              bkg.log('Window lost focus');
              lostFocusEventTriggered = true;
              cap();
              lostFocusByTime = false;

              // Otherwise, don't cap the log
            } else {
              debugLog("False focus change event.");
            }
          });

          // Presumably, then, the focus has in fact been regained
        } else {
          lostFocusByTime = false;
          bkg.log('Window gained focus');

          // If the focus has been regained while the log is capped
          if (!capped) {
            // Uncap the log
            debugLog('The log is currently uncapped, so it will be incremented.')
            handlePageChange();
          } else {
            if (tab.url == previousURL) {
              debugLog('False alarm. The tab thingy will handle this.')
            } else {

              debugLog('The log is currently capped, so it will be uncapped.')
              handlePageChange();
            }
          }
          lostFocusEventTriggered = false;
        }
        lastFocusEvent = Date.now();
      }
    }
    checkGeneralFocus = true;
  });
});

// General page change call
function handlePageChange() {
  chrome.storage.local.get({
    log: []
  }, function(result) {
    chrome.tabs.getSelected(null, function(tab) {
      if (chrome.runtime.lastError) {
        debugWarn("Whoops.. " + chrome.runtime.lastError.message);
      } else {

        if (previousURL == '') {
          previousURL = tablink;
        }

        debugLog('Page handler called.');
        var tablink = cleanURL(tab.url);

        if (tablink.includes('devtools')) {
          debugLog('devtools handling blocked.')
        } else {
          var logArray = result.log;

          // If the previous entry was capped
          if (capped && (previousURL != tablink)) {
            uncap();
            // debugLog('Now uncapped');

            previousLogTime = Date.now();
            environmentCreateTime = previousLogTime;
            // bkg.log('Log time initialized to ' + previousLogTime);
            previousURL = tablink;

            var toStore = new Object();
            toStore.url = tablink;
            toStore.startTime = 0;
            toStore.endTime = NaN;
            toStore.duration = NaN;
            toStore.rawDuration = NaN;
            // the input argument is ALWAYS an object containing the queried keys
            // so we select the key we need

            logArray[logArray.length] = toStore;

            chrome.storage.local.set({
              log: logArray
            }, function() {
              bkg.log('Log from uncapping')
              bkg.log(logArray);
            });


            // If the previous entry isn't capped
          } else if ((!capped) && (previousURL != tablink)) {

            // Update information
            bkg.log('Incrementing entry. Log will increase in size by one.');
            previousURL = tablink;
            var currentTime = timeFromStart();

            // Increment next entry
            var toStore = new Object();
            toStore.url = tablink;
            toStore.startTime = currentTime;
            logArray[logArray.length] = toStore;

            // Modify previous entry
            var previousEntry = logArray[logArray.length - 2];
            previousEntry.endTime = currentTime;
            previousEntry.rawDuration = currentTime - previousEntry.startTime;
            previousEntry.duration = msToPrettyString(previousEntry.rawDuration);

            // Update and log results
            chrome.storage.local.set({
              log: logArray
            }, function() {
              bkg.log('Log from incrementation: ');
              bkg.log(logArray);
            });
          } else {

            debugLog('False tab switch caught. Previous URL is ' + previousURL + ' and current url is ' + tablink);

          }
        }
      }
    });
  });
}


///////////////////////////////////////////////////////////////////////////////////////////////
// Utilities
///////////////////////////////////////////////////////////////////////////////////////////////

// Returns time since the creation of the environment
function timeFromStart() {
  return Date.now() - environmentCreateTime;
}

function msToPrettyString(ms) {
  var seconds = ms / 1000;
  var hours = parseInt(seconds / 3600);
  seconds = seconds % 3600;
  var minutes = parseInt(seconds / 60);
  seconds = seconds % 60;
  return ("0" + hours).slice(-2) + ":" + ("0" + minutes).slice(-2) + ":" + ("0" + Math.floor(seconds)).slice(-2);
}



function cap() {

  chrome.storage.local.get({
    log: []
  }, function(result) {
    previousURL = '';


    if (!capped) {
      capped = true;
      bkg.log("Log capping. Log will stay the same length.");

      var currentTime = timeFromStart();

      var previousEntry = result.log[result.log.length - 1];

      previousEntry.endTime = currentTime;
      previousEntry.rawDuration = currentTime - previousEntry.startTime;
      previousEntry.duration = msToPrettyString(previousEntry.rawDuration);



      bkg.log('Log after being capped:')
      chrome.storage.local.set(result, function() {

      });
      bkg.log(result.log);
    }
  });
}

function uncap() {
  if (capped) {
    capped = false
    bkg.log("Log uncapping. Log will increase in size by one.");
  }
}

function cleanURL(url) {
  var counter = 0;
  var startSearchIndex = 0;
  var beginTrim;

  while (counter < 3) {
    startSearchIndex = url.indexOf('/', startSearchIndex) + 1;
    counter++;

    // Locate the index of the first character after the http:// or whatever
    if (counter == 2) {
      beginTrim = startSearchIndex;
    }
  }

  return url.substring(beginTrim, startSearchIndex - 1);
}

function debugLog(toLog) {
  if (chrome.runtime.lastError) {
    debugWarn("Whoops.. " + chrome.runtime.lastError.message);
  }
  chrome.storage.local.get({
    isDebug
  }, function(result) {
    if (result.isDebug) {
      bkg.log('[DEBUG]: ' + toLog);
    }
  });
}

function debugWarn(toLog) {

  chrome.storage.local.get({
    isDebug
  }, function(result) {
    if (result.isDebug) {
      bkg.warn('[DEBUG]: ' + toLog);
      // bkg.log('^proper isDebug log');;
      // } else {
      //   bkg.log(result.isDebug);
    }
  });
}

function wait(time) {
  var initialTime = Date.now();
  while (Date.now() - initialTime < time) {
    // Do nothing
  }
  debugLog('Waited for ' + time + ' ms.')
}
