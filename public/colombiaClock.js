(function () {
  // Helper to pad numbers with leading zeros
  function pad(num) {
    return String(num).padStart(2, "0");
  }

  // Create the clock element
  const clockEl = document.createElement("div");
  clockEl.id = "colombia-clock";
  document.body.appendChild(clockEl);

  // Update the clock every second
  function updateClock() {
    const now = new Date();
    // Convert current time to UTC milliseconds
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    // Colombia is UTC-5 (no DST)
    const colMs = utcMs + -5 * 60 * 60 * 1000;
    const colDate = new Date(colMs);
    const hours = pad(colDate.getUTCHours());
    const minutes = pad(colDate.getUTCMinutes());
    const seconds = pad(colDate.getUTCSeconds());
    clockEl.textContent = `${hours}:${minutes}:${seconds}`;
  }

  updateClock();
  setInterval(updateClock, 1000);
})();