(function () {
  "use strict";

  /* ---------- Mobile nav toggle ---------- */
  var burger = document.getElementById("navBurger");
  var navLinks = document.getElementById("navLinks");

  if (burger && navLinks) {
    burger.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("is-open");
      burger.classList.toggle("is-open", isOpen);
      burger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("is-open");
        burger.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Animated highlight counters ---------- */
  var counters = document.querySelectorAll(".highlight__num[data-count]");
  function animateCounter(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    var suffix = el.getAttribute("data-suffix") || "";
    var duration = 900;
    var start = null;

    function step(timestamp) {
      if (!start) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.floor(eased * target);
      el.textContent = current + suffix;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = target + suffix;
      }
    }
    window.requestAnimationFrame(step);
  }

  if ("IntersectionObserver" in window && counters.length) {
    var counterObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach(function (el) { counterObserver.observe(el); });
  } else {
    counters.forEach(function (el) {
      el.textContent = el.getAttribute("data-count") + (el.getAttribute("data-suffix") || "");
    });
  }

  /* ---------- Bridge network data population ---------- */
  var conditionMap = {
    Good:               { label: "Good",               cls: "status--good" },
    Moderate:           { label: "Moderate",           cls: "status--moderate" },
    "Attention Required":{ label: "Attention Required", cls: "status--attention" },
    good:               { label: "Good",               cls: "status--good" },
    moderate:           { label: "Moderate",           cls: "status--moderate" },
    attention:          { label: "Attention Required", cls: "status--attention" }
  };

  var fallbackRecords = [
    { id: "BR001", name: "Nerul Creek Bridge",        area: "Nerul",       condition: "Good",               lastInspection: "12 Jun 2026", status: "Under Maintenance" },
    { id: "BR002", name: "Palm Beach Road Flyover",    area: "Nerul",       condition: "Moderate",           lastInspection: "03 Jun 2026", status: "Up to date" },
    { id: "BR003", name: "Seawoods Rail Overbridge",   area: "Seawoods",    condition: "Attention Required", lastInspection: "28 May 2026", status: "Assigned" },
    { id: "BR004", name: "Seawoods Grand Central FOB", area: "Seawoods",    condition: "Good",               lastInspection: "19 Jun 2026", status: "Up to date" },
    { id: "BR005", name: "Belapur Bridge No. 2",       area: "CBD Belapur", condition: "Moderate",           lastInspection: "07 Jun 2026", status: "Up to date" },
    { id: "BR006", name: "Sector 11 Pedestrian Bridge",area: "CBD Belapur", condition: "Good",               lastInspection: "22 May 2026", status: "Up to date" },
    { id: "BR007", name: "Nerul West Underpass",       area: "Nerul",       condition: "Attention Required", lastInspection: "15 Apr 2026", status: "Assigned" },
    { id: "BR008", name: "Seawoods–Darave Link",       area: "Seawoods",    condition: "Good",               lastInspection: "30 Jun 2026", status: "Up to date" },
    { id: "BR009", name: "Belapur CBD Flyover",        area: "CBD Belapur", condition: "Moderate",           lastInspection: "11 Jun 2026", status: "Up to date" },
    { id: "BR010", name: "Nerul Sector 20 Bridge",     area: "Nerul",       condition: "Good",               lastInspection: "24 Jun 2026", status: "Up to date" }
  ];

  function renderBridgeTable(records) {
    var tbody = document.getElementById("bridgeTableBody");
    if (!tbody) return;

    var rows = records.map(function (b) {
      var c = conditionMap[b.current_health_status || b.condition] || { label: b.current_health_status || b.condition || "Unknown", cls: "status--moderate" };
      var statusText = b.status || (b.current_health_status === "Good" ? "Up to date" : (b.current_health_status === "Attention Required" ? "Assigned" : "Scheduled"));
      var statusCls = (statusText.toLowerCase().includes("maintenance") || statusText.toLowerCase().includes("assigned")) ? "status--maintenance" : (statusText.toLowerCase().includes("up to date") ? "status--good" : "status--moderate");

      return (
        "<tr>" +
        '<td class="mono">' + (b.bridge_id || b.id) + "</td>" +
        "<td><strong>" + (b.bridge_name || b.name) + "</strong></td>" +
        "<td>" + (b.location || b.area) + "</td>" +
        '<td><span class="status ' + c.cls + '">' + c.label + "</span></td>" +
        '<td class="mono">' + (b.lastInspection || "Active") + "</td>" +
        '<td><span class="status ' + statusCls + '">' + statusText + "</span></td>" +
        "</tr>"
      );
    });

    tbody.innerHTML = rows.join("");
  }

  // Fetch live bridge network from Supabase backend API
  fetch('/api/bridges')
    .then(function (res) {
      if (res.ok) return res.json();
      throw new Error('API unavailable');
    })
    .then(function (result) {
      if (result.success && result.data && result.data.length > 0) {
        renderBridgeTable(result.data);
      } else {
        renderBridgeTable(fallbackRecords);
      }
    })
    .catch(function () {
      renderBridgeTable(fallbackRecords);
    });

  /* ---------- Navbar shadow on scroll ---------- */
  var nav = document.getElementById("nav");
  if (nav) {
    var lastState = false;
    window.addEventListener(
      "scroll",
      function () {
        var scrolled = window.scrollY > 8;
        if (scrolled !== lastState) {
          nav.style.boxShadow = scrolled ? "0 1px 0 rgba(16,35,61,0.06)" : "none";
          lastState = scrolled;
        }
      },
      { passive: true }
    );
  }
})();
