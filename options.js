// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

var bkg = chrome.extension.getBackgroundPage().console;


document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get('isDebug',
    function(result) {
      document.getElementById("debugBox").checked = result.isDebug;
      bkg.log('Is debug: ' + result.isDebug);
    });
});


document.getElementById("debugBox").addEventListener('change', function() {
  bkg.log('event has been triggered');
  chrome.storage.local.get('isDebug', function(result) {
    chrome.storage.local.set({
      isDebug: !result.isDebug
    }, function() {
      bkg.log('Debug mode: ' + !result.isDebug);
    });
  });
});

// Export data feature
document.getElementById("export").addEventListener("click", function() {
  chrome.extension.getBackgroundPage().console.log('Attempting to log background data');
  chrome.storage.local.get({
    log: []
  }, function(result) {
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", result + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  });
});
