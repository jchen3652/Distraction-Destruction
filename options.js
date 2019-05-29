// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

var bkg = chrome.extension.getBackgroundPage().console;

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
