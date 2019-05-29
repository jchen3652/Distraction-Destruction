// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.


var environmentCreateTime;
var previousLogTime = 0;
var logTimeDiffThreshold = 3000;
var previousURL = '';
var capped = true;
var lastFocusEvent = 0; // amount of times since the last time

// Boonkganged for easier logging
var bkg = chrome.extension.getBackgroundPage().console;

chrome.runtime.onInstalled.addListener(function() {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [new chrome.declarativeContent.PageStateMatcher({})],
      actions: [new chrome.declarativeContent.ShowPageAction()]
    }]);
  });
});

// Called when tab is changed
chrome.tabs.onActivated.addListener(function(activeInfo) {
  handlePageChange();
});

// Called when tab is updated
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  handlePageChange();
});

// Called when focus changes
chrome.windows.onFocusChanged.addListener(function(window) {
  if (lastFocusEvent == 0) {
    lastFocusEvent = Date.now();
  } else {
    currentTime = Date.now();

    if ((currentTime - lastFocusEvent) < 1000) {
      bkg.log('crisis averted');
    } else {
      if ((window == chrome.windows.WINDOW_ID_NONE)) {
        bkg.log('Window lost focus');
        cap();
      } else {
        bkg.log('Window regained focus');
        handlePageChange();
      }
      lastFocusEvent = Date.now();
    }
  }
});

// General page change call
function handlePageChange() {
  chrome.tabs.getSelected(null, function(tab) {
    var tablink = tab.url;


    if (tablink.includes('devtools')) {
      // Do nothing
    } else if (capped) {
      uncap();

      previousLogTime = Date.now();
      environmentCreateTime = previousLogTime;
      bkg.log('Log time initialized to ' + previousLogTime);
      previousURL = tablink;

      var toStore = new Object();
      toStore.url = tablink;
      toStore.startTime = 0;
      toStore.endTime;
      toStore.duration;
      toStore.rawDuration;

      chrome.storage.local.get({
        log: []
      }, function(result) {
        // the input argument is ALWAYS an object containing the queried keys
        // so we select the key we need
        var logArray = result.log;

        logArray[result.log.length] = toStore;

        chrome.storage.local.set({
          log: logArray
        }, function() {
          bkg.log(logArray);
        });
      });

      // Executes if uncapped and not a repeat
    } else if (!capped && (previousURL != tablink)) {
      // Update information
      bkg.log(tablink + ' ' + Date());
      previousURL = tablink;
      var currentTime = timeFromStart();

      chrome.storage.local.get({
        log: []
      }, function(result) {

        // Increment next entry
        var toStore = new Object();
        toStore.url = tablink;
        toStore.startTime = currentTime;
        result.log[result.log.length] = toStore;

        // Modify previous entry
        var previousEntry = result.log[result.log.length - 2];
        previousEntry.endTime = currentTime;
        previousEntry.rawDuration = currentTime - previousEntry.startTime;
        previousEntry.duration = msToPrettyString(previousEntry.rawDuration);

        // Update and log results
        chrome.storage.local.set(result);
        bkg.log(result.log);
      });

    } else {
      // bkg.log('False tab switch caught. Previous URL is ' + previousURL + ' and current url is ' + tablink);
    }
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
  if (!capped) {
    capped = true;
    bkg.log("Log has been capped");
  }

  chrome.storage.local.get({
    log: []
  }, function(result) {
    var currentTime = timeFromStart();

    var previousEntry = result.log[result.log.length - 1];

    previousEntry.endTime = currentTime;
    previousEntry.rawDuration = currentTime - previousEntry.startTime;
    previousEntry.duration = msToPrettyString(previousEntry.rawDuration);




    chrome.storage.local.set(result);
    bkg.log(result.log);
  });
}

function uncap() {
  if (capped) {
    capped = false
    bkg.log("Log has been uncapped");
  }
}

// function updateLog(currentData) {
//   var logArray;
//   bkg.log('Update log called');
//   chrome.storage.local.get({
//     log: []
//   }, function(result) {
//     // the input argument is ALWAYS an object containing the queried keys
//     // so we select the key we need
//     logArray = result.log;
//     bkg.log('original log size: ' + logArray.length)
//     // logArray.push(currentData);
//     logArray.push("foo");
//
//     bkg.log('final log size: ' + logArray.length)
//     // set the new array value to the same key
//     chrome.storage.local.set({
//       log: logArray
//     }, function() {
//
//       chrome.storage.local.get({
//         log: []
//       }, function(result) {
//         bkg.log('actual log size: ' + result.log.length)
//       })
//     });
//   });
//
// }
