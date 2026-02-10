(function hookColonistSocket() {
  if (window.__CATAN_HELPER_HOOKED__) return;
  window.__CATAN_HELPER_HOOKED__ = true;

  const NativeWebSocket = window.WebSocket;

  const WrappedWebSocket = new Proxy(NativeWebSocket, {
    construct(target, args, newTarget) {
      const socket = Reflect.construct(target, args, newTarget);

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
  });

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
