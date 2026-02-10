(function hookColonistSocket() {
  if (window.__CATAN_HELPER_HOOKED__) return;
  window.__CATAN_HELPER_HOOKED__ = true;

  const NativeWebSocket = window.WebSocket;

  const WrappedWebSocket = new Proxy(NativeWebSocket, {
    construct(target, args, newTarget) {
      const socket = Reflect.construct(target, args, newTarget);

      socket.addEventListener("message", (event) => {
        forwardSocketPayload(event.data);
      });

      return socket;
    }
  });

  window.WebSocket = WrappedWebSocket;

  function forwardSocketPayload(payload) {
    if (typeof payload === "string") {
      publish(payload);
      return;
    }

    if (payload instanceof ArrayBuffer) {
      publish(decodeUtf8(payload));
      return;
    }

    if (ArrayBuffer.isView(payload)) {
      publish(decodeUtf8(payload.buffer));
      return;
    }

    if (payload instanceof Blob) {
      payload
        .text()
        .then((text) => publish(text))
        .catch(() => {
          // Ignore binary payloads we cannot decode safely.
        });
      return;
    }

    // Ignore unknown payload types to avoid flooding runtime with non-JSON payloads.
  }

  function decodeUtf8(buffer) {
    try {
      return new TextDecoder().decode(buffer);
    } catch {
      return "";
    }
  }

  function publish(data) {
    if (typeof data !== "string" || data.length === 0) return;

    window.postMessage(
      {
        source: "CATAN_HELPER_PAGE",
        type: "COLONIST_SOCKET_MESSAGE",
        payload: data
      },
      "*"
    );
  }
})();
