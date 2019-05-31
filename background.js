// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
'use strict';

var environmentCreateTime;
var previousLogTime = 0;
var logTimeDiffThreshold = 3000;
var previousURL = '';
var capped = true; // The log is 'capped' when the last entry has its end time set
var lastFocusEvent = 0; // amount of times since the last time
var previousTabID;
var previousTabURL = '';

var lostFocusEventTriggered = false;
var checkGeneralFocus = true;

// Boonkganged for easier logging
var bkg = chrome.extension.getBackgroundPage().console;


setInterval(function() {
  chrome.windows.getCurrent(function(window) {
    // bkg.log(window.focused);
    if (!window.focused && checkGeneralFocus) {
      // bkg.log('capping due to bogus loss of focus');
      cap();
    }
  });
}, 1000);


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
  checkGeneralFocus = false;
  if ((activeInfo.tabId != previousTabID)) {
    bkg.log('Tab change detected while window may still be in focus');
    handlePageChange();
    previousTabID = activeInfo.tabID;

    lostFocusEventTriggered = false;
  } else if (lostFocusEventTriggered) {
    lostFocusEventTriggered = false;
    bkg.log('Simultaneous focus change and tab change detected. Only acting upon focus change');
  } else {
    bkg.log('Nothing should happen');
  }
  checkGeneralFocus = true;

});

// Called when tab is updated
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  checkGeneralFocus = false;
  // bkg.log('Tab update detected');
  // bkg.log('URL of updated tab: ' + changeInfo.url);
  if (typeof changeInfo.url == 'undefined') {
    // bkg.log('No actual change. Doing nothing.');

  } else {
    if (previousTabURL == '') {
      previousTabURL = changeInfo.url;
    } else if (changeInfo.url != previousTabURL) {
      if (lostFocusEventTriggered) {
        lostFocusEventTriggered = false;
        bkg.log('but it was rejected');

      } else {
        handlePageChange();
      }
    } else {
      bkg.log('Identical URL detected; no action taking place');
    }
  }
  checkGeneralFocus = true;
});



// Called when focus changes
chrome.windows.onFocusChanged.addListener(function(window) {
  checkGeneralFocus = false;
  bkg.log('Begin focusChanged listener');
  var currentTime;

  if (lastFocusEvent == 0) {
    lastFocusEvent = Date.now();
  } else {
    currentTime = Date.now();

    if ((currentTime - lastFocusEvent) <= 250) {
      bkg.log('Duplicate focus event blocked');
    } else {
      if ((window == chrome.windows.WINDOW_ID_NONE)) {
        bkg.log('Window lost focus');
        lostFocusEventTriggered = true;
        cap();

      } else {
        bkg.log('Window regained focus; log capped: ' + capped);
        if (!capped) {
          bkg.log("Window is refocused and uncapped");
          cap();
        } else {
          handlePageChange();
        }
        lostFocusEventTriggered = false;


        // lostFocusEventTriggered = true;
      }
      lastFocusEvent = Date.now();
    }
  }
  bkg.log('End focusChanged listener');
  checkGeneralFocus = true;
});

// General page change call
function handlePageChange() {



  chrome.tabs.getSelected(null, function(tab) {
    if(previousURL == '') {
      previousURL = tablink;
    }

    bkg.log('Page handler called. Log capped: ' + capped);
    var tablink = tab.url;
    if (tablink.includes('devtools')) {
      // Do nothing; the program has detected the console window.
      bkg.log('tab link includes dev tools');

      // If it is already capped, it adds a new term
    } else if (capped && (previousURL != tablink)) {


      chrome.storage.local.get({
        log: []
      }, function(result) {
        uncap();
        bkg.log('Now uncapped');

        previousLogTime = Date.now();
        environmentCreateTime = previousLogTime;
        bkg.log('Log time initialized to ' + previousLogTime);
        previousURL = tablink;

        var toStore = new Object();
        toStore.url = tablink;
        toStore.startTime = 0;
        toStore.endTime = NaN;
        toStore.duration = NaN;
        toStore.rawDuration = NaN;




        // the input argument is ALWAYS an object containing the queried keys
        // so we select the key we need
        var logArray = result.log;

        logArray[result.log.length] = toStore;

        chrome.storage.local.set({
          log: logArray
        }, function() {

        });
        bkg.log('Log from uncapping:')
        bkg.log(result.log);
      });

      // Executes if uncapped and not a repeat
    } else if ((!capped) && (previousURL != tablink)) {

      chrome.storage.local.get({
        log: []
      }, function(result) {
        // Update information
        bkg.log('Closed previous entry and created new');


        // bkg.log(tablink + ' ' + Date());
        previousURL = tablink;
        var currentTime = timeFromStart();


        var temp = result.log;

        // Increment next entry
        var toStore = new Object();
        toStore.url = tablink;
        toStore.startTime = currentTime;
        temp[temp.length] = toStore;

        // Modify previous entry
        var previousEntry = temp[temp.length - 2];
        previousEntry.endTime = currentTime;
        previousEntry.rawDuration = currentTime - previousEntry.startTime;
        previousEntry.duration = msToPrettyString(previousEntry.rawDuration);

        // Update and log results
        chrome.storage.local.set({
          log: temp
        });
        bkg.log('log from incrementation');
        bkg.log(result.log);
      });

    } else {
      bkg.log('False tab switch caught. Previous URL is ' + previousURL + ' and current url is ' + tablink);
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

  chrome.storage.local.get({
    log: []
  }, function(result) {
    previousURL = '';


    if (!capped) {
      capped = true;
      bkg.log("Previous entry capped");

      var currentTime = timeFromStart();

      var previousEntry = result.log[result.log.length - 1];

      previousEntry.endTime = currentTime;
      previousEntry.rawDuration = currentTime - previousEntry.startTime;
      previousEntry.duration = msToPrettyString(previousEntry.rawDuration);



      bkg.log('log after being capped:')
      chrome.storage.local.set(result, function() {

      });
      bkg.log(result.log);
    }




  });
}

function uncap() {
  if (capped) {
    capped = false
    bkg.log("Previous entry uncapped");
  }
}
