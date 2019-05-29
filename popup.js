'use strict';

// Boonkganged for easier logging
var bkg = chrome.extension.getBackgroundPage().console;

document.addEventListener('DOMContentLoaded', function() {
  bkg.log('Popup opened');
});
