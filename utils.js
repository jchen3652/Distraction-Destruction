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
