// Your details. They appear on the end card of the advert, the demos index page
// and the booking site's footer. Change them here and re-run demos/record.mjs.
window.PROFILE = {
  name: 'Niamh Kearney',
  // Full link to your Fiverr profile, e.g. 'https://www.fiverr.com/yourusername'
  fiverr: 'https://www.fiverr.com/lawgistics_my',
};

// Shared helper: "https://www.fiverr.com/abc/" -> "fiverr.com/abc"
window.PROFILE.fiverrLabel = function () {
  return String(this.fiverr || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
};
