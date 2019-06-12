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

function msToPrettyString(ms) {
  var seconds = ms / 1000;
  var hours = parseInt(seconds / 3600);
  seconds = seconds % 3600;
  var minutes = parseInt(seconds / 60);
  seconds = seconds % 60;
  return ("0" + hours).slice(-2) + ":" + ("0" + minutes).slice(-2) + ":" + ("0" + Math.floor(seconds)).slice(-2);
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
