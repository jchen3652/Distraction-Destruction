// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

var bkg = chrome.extension.getBackgroundPage().console;
var storage;

// Upon page load
document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get('isDebug',
    function(result) {
      document.getElementById("debugBox").checked = result.isDebug;
      bkg.log('Is debug: ' + result.isDebug);
    });

  // Initialize a Line chart in the container with the ID chart2

});

// Upon debug checkbox pressed
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

// Upon "Export" press
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

// Upon "Analyze" press
document.getElementById("analyze").addEventListener("click", function() {
  var storage = new DataStorage()
});

function DataStorage() {
  chrome.storage.local.get({
    log: []
  }, function(result) {
    var logArray;

    this.storageArray = [];

    logArray = result.log;

    candidate = new Category(logArray[0]);
    this.storageArray[0] = candidate;

    var i;
    for (i = 1; i < logArray.length - 1; i++) {
      var matchingIndexInStorage;
      var isNew = true;
      var candidate = new Category(logArray[i])
      // bkg.log('Chrome storage entry of index ' + i + ' is compared with');

      var j;

      for (j = 0; j < this.storageArray.length; j++) {
        if (candidate.equals(this.storageArray[j].url)) {
          isNew = false;
          matchingIndexInStorage = j;
        }
      }
      if (isNew) {
        // bkg.log('Entry is new. Creating a new one and adding')
        // this.storageArray.push(candidate);
        this.storageArray.push(candidate);
        // bkg.log('Term to be added: ');
        // bkg.log(candidate);
        // bkg.log('Storage after term is added: ');
        // bkg.log(JSON.parse(JSON.stringify(this.storageArray)));
      } else {
        // bkg.log('Entry is not new. Existing one is modified')

        this.storageArray[matchingIndexInStorage].addTime(candidate);
        // bkg.log('Storage after time has been added');
        // bkg.log(JSON.parse(JSON.stringify(this.storageArray)));
      }
    }
    bkg.log(this.storageArray);
    this.storageArray.sort(compare);
    drawTable('activity', this.storageArray);


    // Build bar chart
    var xAxis = [];
    var yAxis = [];

    var pieURLs = [];
    var percent = [];
    var pieOutputPercent = [];
    var sum = 0;

    var allOthersPercent = 0;
    var allOthersSum = 0;
    var barGraphYAxis = [];


    for (var i = 0; i < this.storageArray.length; i++) {
      xAxis[i] = this.storageArray[i].url;
      yAxis[i] = this.storageArray[i].sum / 1000;
      sum += this.storageArray[i].sum / 1000;
    }

    for (var i = 0; i < this.storageArray.length; i++) {
      percent[i] = this.storageArray[i].sum / 1000 / sum;
      if (percent[i] < 0.05) {
        // pieURLs[i] = "";
        allOthersPercent += percent[i];
        allOthersSum += this.storageArray[i].sum / 1000;
        // percent[i] = 0;
      } else {
        pieURLs[i] = this.storageArray[i].url;
        pieOutputPercent[i] = percent[i];
        barGraphYAxis[i] = this.storageArray[i].sum/ 1000;
      }
    }
    if (allOthersSum != 0) {
      pieURLs.push('All others');
      pieOutputPercent.push(allOthersPercent);
      barGraphYAxis.push(allOthersSum);
      // bkg.log(allOthersSum);

    }

    new Chartist.Bar('#chart2', {
      labels: pieURLs,
      series: [
        barGraphYAxis
      ]
    });

    // build pie graph
    var data = {
      labels: pieURLs,
      series: pieOutputPercent    };

    var options = {
      labelInterpolationFnc: function(value) {
        return value[0]
      }
    };

    var responsiveOptions = [
      ['screen and (min-width: 640px)', {
        chartPadding: 30,
        labelOffset: 100,
        labelDirection: 'explode',
        labelInterpolationFnc: function(value) {
          return value;
        }
      }],
      ['screen and (min-width: 1024px)', {
        labelOffset: 80,
        chartPadding: 20
      }]
    ];

    new Chartist.Pie('#chart1', data, options, responsiveOptions);

  });
}

function Category(dataObject) {
  this.sum = dataObject.time.rawDuration;
  this.visits = 1;
  if (dataObject.url.length == 32 && !dataObject.url.includes('.')) {
    this.url = 'options';
  } else {
    this.url = dataObject.url;
  }

  this.equals = function(otherURL) {
    return (this.url == otherURL);
  }

  this.addTime = function(otherObject) {
    if (otherObject.sum != NaN && otherObject.sum != null) {
      this.sum += otherObject.sum;
      this.visits++;
    }
  }
}

function drawTable(tbody, dataSource) {
  var tr, td;
  var table = document.getElementById(tbody); // loop through data source

  // while (table.rows.length > 0) {
  //   table.deleteRow(0);
  // }
  while (table.rows.length >= 2) {
    table.deleteRow(1);
  }

  for (var i = 0; i < dataSource.length; i++) {
    tr = table.insertRow(table.rows.length);

    td = tr.insertCell(tr.cells.length);
    td.setAttribute("align", "center");
    td.innerHTML = dataSource[i].url;

    td = tr.insertCell(tr.cells.length);
    td.setAttribute("align", "center");
    td.innerHTML = msToPrettyString(dataSource[i].sum);

    td = tr.insertCell(tr.cells.length);
    td.setAttribute("align", "center");
    td.innerHTML = dataSource[i].visits;

  }
}

function compare(a, b) {
  if (a.sum > b.sum) {
    return -1;
  } else if (a.sum < b.sum) {
    return 1;
  } else {
    return 0;
  }
}
