// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
'use strict';

var previousURL = '';
var capped = true; // The log is 'capped' when the last entry has its end time set
var lastFocusEvent = 0; // amount of times since the last time
var previousTabID;

var isDebug = false;

var lostFocusEventTriggered = false;

var checkGeneralFocus = true;
var lostFocusByTime = false;
var timeFocusLoggedOnce = false;
var uncapFromWindowChange = false;

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
    if (checkGeneralFocus) {

      if (!isFocused) {
        cap(false);
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
          uncapFromWindowChange = false;
        }
      }
    }
  });

}, 100);

// Called when tab is changed
chrome.tabs.onActivated.addListener(function(activeInfo) {
  debugLog('Chrome activated function called');
  // bkg.log(activeInfo);
  chrome.tabs.getSelected(null, function(tab) {
    checkGeneralFocus = false;
    if ((tab.url != previousURL && !lostFocusEventTriggered)) {
      // debugLog('Tab change detected.');
      lostFocusByTime = false;

      if (!uncapFromWindowChange) {
        // debugLog('Value of tab capped: ' + capped);
        debugLog('Tab URL has changed, so it is known that the page changed.');
        handlePageChange();


        lostFocusEventTriggered = false;

      } else {
        uncapFromWindowChange = false;
        debugLog('Overlapped tab activated and window change blocked.')
      }
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
      debugLog('Chrome updated function called');
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
              cap(false);
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
              uncapFromWindowChange = true;
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
        if (previousURL != tablink) {
          previousURL = tablink;
          var currentTime = Date.now();


          // If the previous entry is capped, then uncap
          if (capped) {
            chrome.storage.local.get({
              log: []
            }, function(result) {

              var logArray = result.log;

              uncap();


              // bkg.log('Log time initialized to ' + previousLogTime);



              var toStore = new DataEntry(tablink, currentTime);
              logArray[logArray.length] = toStore;

              chrome.storage.local.set({
                log: logArray
              }, function() {
                bkg.log('Log from uncapping')
                bkg.log(logArray);
              });
            });

            // If the previous entry is uncapped, then increment
          } else if (!capped) {
            chrome.storage.local.get({
              log: []
            }, function(result) {
              var logArray = result.log;

              uncapFromWindowChange = false;
              // Update information
              bkg.log('Incrementing entry. Log will increase in size by one.');
              // Add next entry
              var toStore = new DataEntry(tablink, currentTime);
              logArray[logArray.length] = toStore;
              // Modify previous entry
              var previousEntry = logArray[logArray.length - 2];
              incrementData(previousEntry, currentTime);

              // Update and log results
              chrome.storage.local.set({
                log: logArray
              }, function() {
                bkg.log('Log from incrementation: ');
                bkg.log(logArray);
              });
            });

          } else {
            debugLog('False tab switch caught. Previous URL is ' + previousURL + ' and current url is ' + tablink);
          }
        }
      }
    }
  });
}

///////////////////////////////////////////////////////////////////////////////////////////////
// Utilities
///////////////////////////////////////////////////////////////////////////////////////////////

// Returns time since the creation of the environment
function timeFromStart() {
  return Date.now(); //- environmentCreateTime;
}

function msToPrettyString(ms) {
  var seconds = ms / 1000;
  var hours = parseInt(seconds / 3600);
  seconds = seconds % 3600;
  var minutes = parseInt(seconds / 60);
  seconds = seconds % 60;
  return ("0" + hours).slice(-2) + ":" + ("0" + minutes).slice(-2) + ":" + ("0" + Math.floor(seconds)).slice(-2);
}

function cap(isIncrement) {
  chrome.storage.local.get({
    log: []
  }, function(result) {
    var logArray = result.log;
    previousURL = '';
    if (!capped) {
      capped = true;
      uncapFromWindowChange = false;
      if (isIncrement) {
        bkg.log("Log incrementing. Log will increase in size by 1.");
      } else {
        bkg.log("Log capping. Log will stay the same length.");
      }
      var currentTime = timeFromStart();

      var previousEntry = logArray[logArray.length - 1];

      incrementData(previousEntry, currentTime);
      chrome.storage.local.set({
        log: logArray
      }, function() {
        bkg.log('Log after being capped: ');
        bkg.log(logArray);
      });

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

function timeConverter(UNIX_timestamp) {
  var a = new Date(UNIX_timestamp * 1000);
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var hour = a.getHours();
  var min = a.getMinutes();
  var sec = a.getSeconds();
  var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec;
  return time;
}

class DataEntry {
  constructor(url, time) {
    this.url = url;
    this.time = new TimeWrapper(time);
  }
}

class TimeWrapper {
  constructor(rawStartTime) {
    this.rawStartTime = rawStartTime;
    var date = new Date(rawStartTime);
    this.prettyDate = date.toString();
  }
}

class Category {

  constructor(dataObject) {
    this.sum = 0;
    this.url = dataObject.url;
  }

  equals(otherURL) {
    return (this.url == otherURL)
  }
}

function incrementData(dataObject, rawEndTime) {
  dataObject.time.rawEndTime = rawEndTime;
  dataObject.time.rawDuration = dataObject.time.rawEndTime - dataObject.time.rawStartTime;
  dataObject.duration = msToPrettyString(dataObject.time.rawDuration);
}
