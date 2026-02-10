import "./runtimeCore.js";
(function bootstrap() {
  injectPageHook();
  injectOverlayStyles();

  onDocumentReady(() => {
    const overlay = createOverlayRoot();
    installDragBehavior(overlay);
  const overlay = createOverlayRoot();
  installDragBehavior(overlay);

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== "CATAN_HELPER_PAGE") return;

    chrome.runtime.sendMessage(
      {
        type: event.data.type,
        payload: event.data.payload
      },
      () => {
        if (chrome.runtime.lastError) {
          console.debug("Catan Helper sendMessage warning:", chrome.runtime.lastError.message);
        }
      }
    );
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "OVERLAY_DATA") return;
    renderOverlay(overlay, message.payload);
  });

    chrome.runtime.sendMessage({ type: "REQUEST_STATE" }, (payload) => {
      if (!payload) return;
      renderOverlay(overlay, payload);
    });
  });
})();

function onDocumentReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
    return;
  }

  callback();
}

  chrome.runtime.sendMessage({ type: "REQUEST_STATE" }, (payload) => {
    if (!payload) return;
    renderOverlay(overlay, payload);
  });
})();

function injectPageHook() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("src/content/pageHook.js");
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();
}

function injectOverlayStyles() {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("src/ui/overlay.css");
  (document.head || document.documentElement).appendChild(link);
  document.documentElement.appendChild(link);
}

function createOverlayRoot() {
  const root = document.createElement("aside");
  root.id = "catan-helper-overlay";
  root.innerHTML = `<div id="catan-helper-overlay-header"><button id="catan-helper-drag-handle" aria-label="Drag overlay">⠿</button><h2>Catan Helper</h2></div><p>Waiting for game events...</p>`;
  root.innerHTML = "<h2>Catan Helper</h2><p>Waiting for game events...</p>";
  document.documentElement.appendChild(root);
  return root;
}

function installDragBehavior(root) {
  const storedTop = window.localStorage.getItem("catan-helper-top");
  const storedLeft = window.localStorage.getItem("catan-helper-left");

  if (storedTop && storedLeft) {
    root.style.top = `${Number(storedTop)}px`;
    root.style.left = `${Number(storedLeft)}px`;
    root.style.right = "auto";
  }

  root.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest("#catan-helper-drag-handle")) return;

    event.preventDefault();

    const rect = root.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    function onMove(moveEvent) {
      const left = clamp(moveEvent.clientX - offsetX, 0, window.innerWidth - rect.width);
      const top = clamp(moveEvent.clientY - offsetY, 0, window.innerHeight - 48);
      root.style.left = `${left}px`;
      root.style.top = `${top}px`;
      root.style.right = "auto";
    }

    function onUp(upEvent) {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);

      const finalRect = root.getBoundingClientRect();
      window.localStorage.setItem("catan-helper-top", String(Math.round(finalRect.top)));
      window.localStorage.setItem("catan-helper-left", String(Math.round(finalRect.left)));
      upEvent.preventDefault();
    }

    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
  });
}

function renderOverlay(root, data) {
  const topVertices = (data.placement?.rankedVertices || [])
    .slice(0, 5)
    .map((v) => `<li>#${v.vertexId}: <strong>${v.score.toFixed(2)}</strong> <span>${escapeHtml(v.detail)}</span></li>`)
    .join("");

  const topPair = data.placement?.rankedPairs?.[0];
  const robber = data.robber?.bestTile;
  const players = (data.players || [])
    .map((p) => {
      const options = Object.entries(p.buildOptions || {})
        .filter(([, can]) => can)
        .map(([name]) => name)
        .join(", ");
      return `<li><strong>${escapeHtml(p.name || p.id)}</strong> - cards: ${resourceTotal(p.resourceEstimates)} - can build: ${escapeHtml(options || "nothing")}</li>`;
    })
    .join("");

  const diagnostics = data.diagnostics || {};
  const eventStatus = diagnostics.inboundMessages > 0 ? "Receiving game traffic" : "No game traffic yet";

  root.innerHTML = `
    <div id="catan-helper-overlay-header">
      <button id="catan-helper-drag-handle" aria-label="Drag overlay">⠿</button>
      <h2>Catan Helper</h2>
    </div>
  root.innerHTML = `
    <h2>Catan Helper</h2>
    <div class="section"><h3>Phase</h3><p>${escapeHtml(data.phase)} (setup turn ${data.setupTurn})</p></div>
    <div class="section"><h3>Top Setup Vertices</h3><ol>${topVertices || "<li>No setup recommendations</li>"}</ol></div>
    <div class="section">
      <h3>Best Pair + Road</h3>
      <p>${topPair ? `#${topPair.first} + #${topPair.second} (score ${topPair.score.toFixed(2)})` : "N/A"}</p>
      <p>${topPair?.suggestedRoad ? escapeHtml(`${topPair.suggestedRoad.from} -> ${topPair.suggestedRoad.to}`) : "No road suggestion"}</p>
    </div>
    <div class="section">
      <h3>Robber Recommendation</h3>
      <p>${robber ? `Tile ${robber.tileId} (${robber.resource} ${robber.token}) score ${robber.score.toFixed(2)}` : "No robber target"}</p>
    </div>
    <div class="section"><h3>Player Economy</h3><ul>${players || "<li>No players tracked yet.</li>"}</ul></div>
    <div class="section">
      <h3>Diagnostics</h3>
      <p>${escapeHtml(eventStatus)} • messages: ${diagnostics.inboundMessages || 0} • parsed events: ${diagnostics.parsedEvents || 0}</p>
      <p>tiles: ${diagnostics.trackedTiles || 0} • vertices: ${diagnostics.trackedVertices || 0} • players: ${diagnostics.trackedPlayers || 0}</p>
      <p>${escapeHtml(diagnostics.lastError ? `last error: ${diagnostics.lastError}` : "last error: none")}</p>
    </div>
  `;
}

function resourceTotal(resources = {}) {
  return Object.values(resources).reduce((acc, value) => acc + value, 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
