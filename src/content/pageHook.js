(function hookColonistSocket() {
  if (window.__CATAN_HELPER_HOOKED__) return;
  window.__CATAN_HELPER_HOOKED__ = true;

  const NativeWebSocket = window.WebSocket;

  const WrappedWebSocket = new Proxy(NativeWebSocket, {
    construct(target, args, newTarget) {
      const socket = Reflect.construct(target, args, newTarget);

      socket.addEventListener("message", (event) => {
        forwardSocketPayload(event.data);
        window.postMessage(
          {
            source: "CATAN_HELPER_PAGE",
            type: "COLONIST_SOCKET_MESSAGE",
            payload: event.data
          },
          "*"
        );
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
      publish(new TextDecoder().decode(payload));
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

    // Best-effort fallback for structured messages.
    publish(payload);
  }

  function publish(data) {
    window.postMessage(
      {
        source: "CATAN_HELPER_PAGE",
        type: "COLONIST_SOCKET_MESSAGE",
        payload: data
      },
      "*"
    );
  }
  // Preserve native constants and behavior (CONNECTING/OPEN/etc.) by using a Proxy
  // and replacing only the constructor reference.
  window.WebSocket = WrappedWebSocket;
  function WrappedWebSocket(url, protocols) {
    const socket = protocols ? new NativeWebSocket(url, protocols) : new NativeWebSocket(url);

    socket.addEventListener("message", (event) => {
      window.postMessage(
        {
          source: "CATAN_HELPER_PAGE",
          type: "COLONIST_SOCKET_MESSAGE",
          payload: event.data
        },
        "*"
      );
    });

    return socket;
  }

  WrappedWebSocket.prototype = NativeWebSocket.prototype;
  Object.defineProperty(window, "WebSocket", {
    value: WrappedWebSocket,
    configurable: true,
    writable: false
  });
})();
